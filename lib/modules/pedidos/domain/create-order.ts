import { requirePermission, type Actor } from './actor';
import { OrderNotFoundError, OrderWouldBlockError, ValidationError } from './errors';
import { DEFAULT_ORDER_STATUS, type OrderLineStatus } from './order-classification';
import type { StoredOrderCost } from './order-cost';
import { requireAliveCustomer } from './order-customer';
import { createOrderWithLinesSchema, type OrderLineInput } from './order-input';
import { assertNoDuplicateOrderRecipe, atLinePosition } from './order-line-diff';
import { formatOrderNumber, type OrderNumber } from './order-number';
import { orderRecipeIds, requireOrderRecipe } from './order-recipe';
import { buildOrderRequirement } from './order-requirement';
import { loadRequirementUnits, requireConvertibleRequirement } from './order-requirement-units';
import { packagingLinesOfInput, resolveDistribution, type ResolvedDistribution } from './resolve-distribution';
import { resolveStoredOrderCost } from './resolve-ingredients-cost';
import type { OrderScope } from './order-scope';

import type { CustomerCatalog } from '@/lib/modules/clientes';
import type {
  PackagingCatalog,
  PresentationCatalog,
  ProductCatalog,
  ReservationOutcome,
  ReservationRequirementLine,
} from '@/lib/modules/inventario';
import type { RecipeCatalog } from '@/lib/modules/recetas';
import type { UnitCatalog } from '@/lib/modules/unidades';

import type { OrderTransactionScope, OrderUnitOfWork } from '../ports/order-unit-of-work';

type NewLineStatus = Exclude<OrderLineStatus, 'CANCELADO'>;

/**
 * El estado con el que nace cada linea. El defecto del modulo esta tipado como `OrderStatus`, asi
 * que se estrecha una vez, aqui, con una comprobacion real en vez de un `as`: si alguien lo
 * cambiara a `CANCELADO` o `PARCIAL`, esto reventaria al cargar el modulo en lugar de abrir un
 * camino hacia una cancelacion sin motivo o una linea en un estado que solo es del pedido.
 */
const STATUS_DE_ALTA: NewLineStatus = ((status = DEFAULT_ORDER_STATUS) => {
  if (status === 'CANCELADO' || status === 'PARCIAL') {
    throw new Error(`DEFAULT_ORDER_STATUS no puede ser ${status}: una linea nace activa.`);
  }
  return status;
})();

export type CreateOrderDeps = {
  /** Contrato publico de `recetas`: `pedidos` no consulta su tabla. */
  readonly recipes: RecipeCatalog;
  /** Contrato publico de `inventario`: los lotes con existencia con los que se costea. */
  readonly products: ProductCatalog;
  /** Contrato publico de `unidades`: la unidad de cada linea y las de cada presentacion del
   *  reparto, para convertir y para el coste. */
  readonly units: UnitCatalog;
  /** Contrato publico de `inventario`: las presentaciones del reparto, para comprobar que existen
   *  en la empresa de quien escribe y copiar su contenido. */
  readonly presentations: PresentationCatalog;
  /** Contrato publico de `inventario`: los envases del reparto y su presentacion fija. */
  readonly packaging: PackagingCatalog;
  /** Contrato publico de `clientes`: comprueba que el cliente indicado esta vivo en la empresa. */
  readonly customerCatalog: Pick<CustomerCatalog, 'findAliveRefById'>;
  /** La transaccion compartida con `inventario`: crea el pedido y sus lineas y aparta su material,
   *  todo o nada. */
  readonly unitOfWork: OrderUnitOfWork;
  /** Inyectado para que el test fije el instante sin tocar el reloj global. */
  readonly now?: () => Date;
};

/** El identificador y el correlativo, ya compuesto con la unica definicion del formato. */
export type CreatedOrder = {
  readonly id: string;
  readonly number: OrderNumber;
  readonly numberText: string;
};

/** Una linea de la entrada ya validada fuera de la transaccion. */
type PreparedLine = {
  readonly input: OrderLineInput;
  readonly effectiveRecipeId: string;
  readonly originalRecipeId: string;
  readonly cost: StoredOrderCost | null;
  readonly distribution: ResolvedDistribution;
};

/**
 * Alta de pedido con sus lineas.
 *
 * El permiso es la primera linea: sin el no se valida la entrada ni se toca ningun puerto. Los
 * autores salen del actor y la empresa tambien; la entrada no los puede nombrar.
 *
 * Cada linea se valida con las reglas de un pedido de una receta, y un fallo rechaza el alta
 * entera con el codigo de siempre y la posicion de la linea en el diagnostico. Despues, en una
 * sola transaccion, se crea el pedido, se crean sus lineas y se aparta el material de cada una en
 * su orden: la segunda compite con lo que ya aparto la primera. Si a alguna no le alcanza, sin
 * confirmacion se deshace todo; con ella, solo esas quedan `BLOQUEADO`, sin apartado ni coste.
 *
 * El ano del correlativo y `created_at` salen del mismo instante, para no chocar con el CHECK que
 * los ata. El choque del correlativo lo reintenta `OrderUnitOfWork` con una transaccion nueva.
 */
export function createCreateOrder(
  deps: CreateOrderDeps,
): (input: unknown, actor: Actor | null | undefined) => Promise<CreatedOrder> {
  const now = deps.now ?? (() => new Date());

  return async function createOrder(
    input: unknown,
    actor: Actor | null | undefined,
  ): Promise<CreatedOrder> {
    requirePermission(actor, 'pedidos.modificar');

    // La empresa sale del actor y jamas de la entrada: nadie puede elegir consultar otra.
    const scope: OrderScope = { companyId: actor.companyId };

    const parsed = createOrderWithLinesSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { confirmBlocked, priority, customerId, lines } = parsed.data;

    // Todo se comprueba antes de abrir la transaccion: un alta rechazada no crea ninguna fila.
    const refs = await deps.recipes.findRefsIncludingDeleted(
      [...new Set(lines.flatMap((line) => orderRecipeIds(line.recipeId, line.recipeVersionId)))],
      actor.companyId,
    );
    const effectiveRecipeIds: string[] = [];
    for (const [position, line] of lines.entries()) {
      effectiveRecipeIds.push(
        await atLinePosition(position, () => requireOrderRecipe(refs, line.recipeId, line.recipeVersionId)),
      );
    }
    // `requireOrderRecipe` ya exige que `recipeId` sea la original: la version va aparte.
    assertNoDuplicateOrderRecipe(lines.map((line) => ({ originalRecipeId: line.recipeId })));

    if (customerId !== null) {
      await requireAliveCustomer(deps.customerCatalog, customerId, actor.companyId);
    }

    const prepared: PreparedLine[] = [];
    for (const [position, line] of lines.entries()) {
      const effectiveRecipeId = effectiveRecipeIds[position] ?? line.recipeId;
      prepared.push(
        await atLinePosition(position, async () => ({
          input: line,
          effectiveRecipeId,
          originalRecipeId: line.recipeId,
          cost: await resolveStoredOrderCost(
            deps,
            effectiveRecipeId,
            line.quantity,
            line.unitId,
            packagingLinesOfInput(line.presentationLines),
            actor.companyId,
          ),
          // Un reparto vacio es valido; una linea nueva no tiene reparto antiguo que conservar.
          distribution: await resolveDistribution(
            deps,
            actor.companyId,
            line.quantity,
            line.unitId,
            line.presentationLines,
            { savedLines: [] },
          ),
        })),
      );
    }

    const instant = now();
    const [first] = prepared;
    if (first === undefined) throw new ValidationError('alta sin lineas');

    const created = await deps.unitOfWork.run(async (transaction) => {
      // Las necesidades se arman antes del primer INSERT: una linea no convertible rechaza el
      // alta sin escribir nada.
      const requirements: (readonly ReservationRequirementLine[])[] = [];
      for (const [position, line] of prepared.entries()) {
        requirements.push(await atLinePosition(position, () => lineRequirement(transaction, line, actor.companyId)));
      }

      // Las columnas de receta del pedido nacen con las de su primera linea; el reparto va solo
      // en las lineas.
      const order = await transaction.orders.create(
        {
          recipeId: first.effectiveRecipeId,
          quantity: first.input.quantity,
          priority,
          unitId: first.input.unitId,
          status: STATUS_DE_ALTA,
          presentationLines: [],
          customerId,
          salePrice: first.input.salePrice,
        },
        instant.getUTCFullYear(),
        actor.id,
        instant,
        first.cost,
        scope,
      );

      const written = await transaction.orders.writeLines(
        order.id,
        {
          removedIds: [],
          edited: [],
          added: prepared.map((line) => ({
            recipeId: line.effectiveRecipeId,
            originalRecipeId: line.originalRecipeId,
            quantity: line.input.quantity,
            unitId: line.input.unitId,
            salePrice: line.input.salePrice,
            presentationLines: line.distribution.lines,
            status: STATUS_DE_ALTA,
            cost: line.cost,
          })),
        },
        actor.id,
        instant,
        scope,
      );
      if (written === null) throw new OrderNotFoundError(`pedido ${order.id} recien creado`);

      const outcomes: ReservationOutcome[] = [];
      for (const [position, line] of written.entries()) {
        outcomes.push(
          await transaction.reservations.syncForLine({
            orderId: order.id,
            orderLineId: line.id,
            companyId: actor.companyId,
            requirement: requirements[position] ?? [],
            actorId: actor.id,
            now: instant,
          }),
        );
      }

      const blocked = outcomes.flatMap((outcome, position) => (outcome.kind === 'insufficient' ? [position] : []));
      // Lanzar deshace el pedido, sus lineas y lo apartado: sin confirmacion no queda nada.
      if (blocked.length > 0 && !confirmBlocked) {
        throw new OrderWouldBlockError(`lineas en las posiciones ${blocked.join(', ')}`);
      }

      for (const [position, line] of written.entries()) {
        const outcome = outcomes[position];
        if (outcome?.kind === 'insufficient') {
          await transaction.orders.setLineStatus(order.id, line.id, STATUS_DE_ALTA, 'BLOQUEADO', actor.id, instant, scope);
          // El importe se calculo fuera de la transaccion: otra alta pudo apartar entre medias.
          if (prepared[position]?.cost !== null) {
            await transaction.orders.setLineIngredientsCost(order.id, line.id, null, actor.id, instant, scope);
          }
        }
        await transaction.orders.setLineReservedAt(order.id, line.id, outcome?.kind === 'reserved' ? instant : null, scope);
      }

      await transaction.orders.refreshStatus(order.id, actor.id, instant, scope);
      await transaction.orders.mirrorFirstLine(order.id, scope);
      return order;
    });

    return { id: created.id, number: created.number, numberText: formatOrderNumber(created.number) };
  };
}

/** La necesidad de reserva de una linea, leida con el cliente de la transaccion: pedir una segunda
 *  conexion mientras esta retiene la suya desperdiciaria una del pool. */
async function lineRequirement(
  transaction: OrderTransactionScope,
  line: PreparedLine,
  companyId: string,
): Promise<readonly ReservationRequirementLine[]> {
  const content = await transaction.recipes.findExecutionContentById(line.effectiveRecipeId, companyId);
  const recipeLines = content?.lines ?? [];
  const units = await loadRequirementUnits(
    transaction,
    recipeLines.map((recipeLine) => recipeLine.productId),
    line.input.unitId,
    companyId,
  );
  return requireConvertibleRequirement(
    buildOrderRequirement({
      recipeLines,
      quantity: line.input.quantity,
      packagingLines: line.distribution.packagingLines,
      phase: 'before_consumption',
      units,
    }),
  );
}
