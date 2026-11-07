import { requirePermission, type Actor } from './actor';
import {
  InsufficientMaterialError,
  InvalidTransitionError,
  OrderNotFoundError,
  OrderWouldBlockError,
  ValidationError,
} from './errors';
import { isStartedOrderStatus, type OrderLineStatus } from './order-classification';
import type { StoredOrderCost } from './order-cost';
import { requireAliveCustomer } from './order-customer';
import { isUnchangedOrderLine } from './order-edit-change';
import { updateOrderWithLinesSchema, type OrderLineInput } from './order-input';
import {
  assertNoDuplicateOrderRecipe,
  assertOrderLineEditable,
  atLinePosition,
  diffOrderLines,
} from './order-line-diff';
import { assertOrderLinesRemovable } from './order-line-removal';
import { orderRecipeIds, requireOrderRecipe } from './order-recipe';
import { buildOrderRequirement } from './order-requirement';
import { loadRequirementUnits, requireConvertibleRequirement } from './order-requirement-units';
import { packagingLinesOfInput, resolveDistribution, type ResolvedDistribution } from './resolve-distribution';
import type { OrderScope } from './order-scope';
import { isEditableOrderLineStatus } from './order-transitions';
import type { OrderLineRow } from './order-view';
import { resolveStoredOrderCost } from './resolve-ingredients-cost';

import type { CustomerCatalog } from '@/lib/modules/clientes';
import type {
  PackagingCatalog,
  PresentationCatalog,
  ProductCatalog,
  ReservationOutcome,
  ReservationRequirementLine,
} from '@/lib/modules/inventario';
import type { RecipeCatalog, RecipeRef } from '@/lib/modules/recetas';
import type { UnitCatalog } from '@/lib/modules/unidades';

import type { OrderTransactionScope, OrderUnitOfWork } from '../ports/order-unit-of-work';
import type { OrderRepository } from '../ports/order-repository';
import type { OrderLineEditWrite, OrderLineWrite } from '../ports/order-write-repository';

/** `orders` lee el pedido y sus lineas antes de abrir la transaccion; la escritura y el apartado
 *  viven en `unitOfWork`. `products` y `units` recalculan el coste de las lineas que cambian. */
export type UpdateOrderDeps = {
  readonly orders: OrderRepository;
  readonly recipes: RecipeCatalog;
  readonly products: ProductCatalog;
  readonly units: UnitCatalog;
  /** Contrato publico de `inventario`: las presentaciones del reparto. */
  readonly presentations: PresentationCatalog;
  /** Contrato publico de `inventario`: los envases del reparto y su presentacion fija. */
  readonly packaging: PackagingCatalog;
  /** Contrato publico de `clientes`: comprueba el cliente cuando la edicion lo cambia. */
  readonly customerCatalog: Pick<CustomerCatalog, 'findAliveRefById'>;
  readonly unitOfWork: OrderUnitOfWork;
  /** Inyectado para que el test fije el instante sin tocar el reloj global. */
  readonly now?: () => Date;
};

/** Una linea de la entrada contrastada con las guardadas. `saved` falta en una linea nueva;
 *  `changed` es siempre verdadero en ella. `retry` marca una linea guardada en `BLOQUEADO` que llega
 *  sin cambios: vuelve a intentar apartar su material sin cambiar sus datos. */
type PlannedLine = {
  readonly position: number;
  readonly input: OrderLineInput;
  readonly saved: OrderLineRow | undefined;
  readonly effectiveRecipeId: string;
  readonly originalRecipeId: string;
  readonly changed: boolean;
  readonly retry: boolean;
};

type EditPlan = {
  readonly lines: readonly PlannedLine[];
  readonly removed: readonly OrderLineRow[];
};

/** Las referencias de receta que ya se pidieron al catalogo, para no repetir la lectura al volver
 *  a planear bajo el candado. */
type RecipeRefs = Map<string, RecipeRef>;

/**
 * Edicion de pedido: reemplazo completo de sus lineas, su prioridad y su cliente.
 *
 * Cada linea con identificador edita esa linea; cada una sin el es nueva, y cada linea viva sin
 * cancelar que falte se quita. Una linea con cambios tiene que estar en un estado editable y una que
 * se quita en `PENDIENTE` o `BLOQUEADO`; una que llega igual no se mira. Solo las lineas nuevas o
 * cambiadas recalculan coste, apartado y plazo, y tambien las `BLOQUEADO` que llegan igual, que
 * reintentan su reserva: las demas no se tocan. Una edicion que no anade ninguna linea necesita alguna linea activa editable, como hasta ahora necesitaba el pedido.
 *
 * Todo se comprueba dos veces: antes de abrir la transaccion, para fallar sin escribir, y otra vez
 * sobre las lineas que se acaban de bloquear, porque otra operacion pudo moverlas entre medias.
 *
 * El actor queda como autor de la ultima modificacion y el de la creacion no se toca. La edicion no
 * consume: solo vuelve a apartar.
 */
export function createUpdateOrder(
  deps: UpdateOrderDeps,
): (id: string, input: unknown, actor: Actor | null | undefined) => Promise<void> {
  const now = deps.now ?? (() => new Date());

  return async function updateOrder(
    id: string,
    input: unknown,
    actor: Actor | null | undefined,
  ): Promise<void> {
    requirePermission(actor, 'pedidos.modificar');

    // La empresa sale del actor y jamas de la entrada: nadie puede elegir consultar otra.
    const scope: OrderScope = { companyId: actor.companyId };
    const companyId = actor.companyId;

    const parsed = updateOrderWithLinesSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { confirmBlocked, priority, customerId, lines: entry } = parsed.data;

    // No existe y ya esta borrado son el mismo caso.
    const row = await deps.orders.findAliveById(id, scope);
    if (row === null) throw new OrderNotFoundError();
    const saved = await deps.orders.findAliveLines(id, scope);

    const refs: RecipeRefs = new Map();
    const plan = await planEdit(deps.recipes, entry, saved, refs, companyId);

    // Solo cambia el cliente: se escribe solo el cliente, sin catalogos, sin coste y sin tocar lo
    // apartado. Sin bloquear: esta escritura no pisa ningun dato que otra edicion cambie. Una linea
    // bloqueada obliga al camino completo, que reintenta su reserva.
    const linesUnchanged = plan.removed.length === 0 && plan.lines.every((line) => !line.changed && !line.retry);
    if (linesUnchanged && priority === row.priority && customerId !== row.customerId) {
      if (customerId !== null) {
        await requireAliveCustomer(deps.customerCatalog, customerId, companyId);
      }
      await deps.unitOfWork.run(async (transaction) => {
        const result = await transaction.orders.setCustomerAlive(id, customerId, actor.id, now(), scope);
        if (result === 'not_found') throw new OrderNotFoundError();
      });
      return;
    }

    // El mismo cliente que ya tiene se acepta aunque este dado de baja.
    if (customerId !== null && customerId !== row.customerId) {
      await requireAliveCustomer(deps.customerCatalog, customerId, companyId);
    }

    // El coste se calcula antes de abrir la transaccion, como siempre: pedir los catalogos con la
    // fila bloqueada retendria una conexion mientras se espera otra.
    const costs = new Map<number, StoredOrderCost | null | 'keep'>();
    for (const line of plan.lines.filter((planned) => planned.changed || planned.retry)) {
      costs.set(line.position, await atLinePosition(line.position, () => lineCost(deps, line, companyId)));
    }

    const instant = now();

    await deps.unitOfWork.run(async (transaction) => {
      const locked = await transaction.orders.lockAliveLines(id, scope);
      if (locked === null) throw new OrderNotFoundError();

      // Otra operacion pudo mover o quitar lineas entre la lectura de arriba y este candado: el
      // replanteo decide tambien que lineas bloqueadas siguen reintentando.
      const current = await planEdit(deps.recipes, entry, locked.lines, refs, companyId);
      const touched = current.lines.filter((line) => line.changed || line.retry);

      const prepared: PreparedLine[] = [];
      for (const line of touched) {
        prepared.push(
          await atLinePosition(line.position, () => prepareLine(deps, transaction, line, costs.get(line.position), companyId)),
        );
      }

      for (const removed of current.removed) {
        await transaction.reservations.releaseForLine({
          orderId: id,
          orderLineId: removed.id,
          companyId,
          reason: 'release',
          actorId: actor.id,
          now: instant,
        });
      }

      const edited: OrderLineEditWrite[] = [];
      const added: PreparedLine[] = [];
      for (const line of prepared) {
        // Una linea que reintenta su reserva no cambia sus datos: no se reescribe.
        if (line.planned.saved === undefined) added.push(line);
        else if (!line.planned.retry) edited.push({ lineId: line.planned.saved.id, line: line.write, cost: line.cost });
      }

      const written = await transaction.orders.writeLines(
        id,
        {
          removedIds: current.removed.map((line) => line.id),
          edited,
          added: added.map((line) => ({
            ...line.write,
            status: 'PENDIENTE',
            cost: line.cost === 'keep' ? null : line.cost,
          })),
        },
        actor.id,
        instant,
        scope,
      );
      if (written === null) throw new OrderNotFoundError();

      // Las editadas y las que reintentan por su posicion y despues las nuevas, que van detras: cada
      // una compite con lo que ya apartaron las anteriores.
      const toSync = [
        ...prepared
          .filter((line) => line.planned.saved !== undefined)
          .sort((a, b) => (a.planned.saved?.position ?? 0) - (b.planned.saved?.position ?? 0))
          .map((line) => ({ line, lineId: line.planned.saved?.id ?? '', status: line.planned.saved?.status ?? 'PENDIENTE' })),
        ...added.map((line, index) => ({ line, lineId: written[index]?.id ?? '', status: 'PENDIENTE' as const })),
      ];

      const outcomes: ReservationOutcome[] = [];
      for (const { line, lineId, status } of toSync) {
        const outcome = await transaction.reservations.syncForLine({
          orderId: id,
          orderLineId: lineId,
          companyId,
          requirement: line.requirement,
          actorId: actor.id,
          now: instant,
        });
        // Una linea en curso tiene que seguir teniendo con que producirse.
        if (outcome.kind === 'insufficient' && status === 'EN_CURSO') {
          throw new InsufficientMaterialError(`linea en la posicion ${String(line.planned.position)}`);
        }
        outcomes.push(outcome);
      }

      const blocked = toSync.flatMap(({ line }, index) =>
        outcomes[index]?.kind === 'insufficient' ? [line.planned.position] : [],
      );
      // Lanzar deshace todo lo escrito: sin confirmacion no queda nada.
      if (blocked.length > 0 && !confirmBlocked) {
        throw new OrderWouldBlockError(`lineas en las posiciones ${blocked.join(', ')}`);
      }

      for (const [index, { line, lineId, status }] of toSync.entries()) {
        const outcome = outcomes[index];
        if (outcome?.kind === 'insufficient') {
          if (status !== 'BLOQUEADO') {
            await moveLine(transaction, id, lineId, status, 'BLOQUEADO', actor.id, instant, scope);
          }
          if (line.cost !== null && line.cost !== 'keep') {
            await transaction.orders.setLineIngredientsCost(id, lineId, null, actor.id, instant, scope);
          }
        } else if (status === 'BLOQUEADO') {
          await moveLine(transaction, id, lineId, 'BLOQUEADO', 'PENDIENTE', actor.id, instant, scope);
          // La editada ya llevo su coste en `writeLines`; la que reintenta lo recibe aqui.
          if (line.planned.retry && line.cost !== 'keep') {
            const costed = await transaction.orders.setLineIngredientsCost(id, lineId, line.cost, actor.id, instant, scope);
            if (costed !== 'ok') throw new OrderNotFoundError(`linea ${lineId}`);
          }
        }
        await transaction.orders.setLineReservedAt(id, lineId, outcome?.kind === 'reserved' ? instant : null, scope);
      }

      const header = await transaction.orders.updateAlive(id, { priority, customerId }, actor.id, instant, scope);
      if (header === 'not_found') throw new OrderNotFoundError();

      await transaction.orders.refreshStatus(id, actor.id, instant, scope);
    });
  };
}

/**
 * Contrasta la entrada con las lineas guardadas y aplica las reglas que no escriben: lineas ajenas,
 * recetas, cambios en lineas no editables, lineas que no se pueden quitar y recetas repetidas.
 */
async function planEdit(
  recipes: RecipeCatalog,
  entry: readonly OrderLineInput[],
  saved: readonly OrderLineRow[],
  refs: RecipeRefs,
  companyId: string,
): Promise<EditPlan> {
  const diff = diffOrderLines(entry, saved);
  const savedByInput = new Map(diff.edited.map((pair) => [pair.input, pair.saved]));

  // Una receta que no cambia se acepta aunque este dada de baja o por revisar: corregir la cantidad
  // de una linea vieja no puede obligar a cambiarle la formula. Si cambia, se exige lo del alta.
  const needsCatalog = entry.filter((input) => {
    const match = savedByInput.get(input);
    return match === undefined || (input.recipeVersionId ?? input.recipeId) !== match.recipeId;
  });
  const missing = [
    ...new Set(needsCatalog.flatMap((input) => orderRecipeIds(input.recipeId, input.recipeVersionId))),
  ].filter((recipeId) => !refs.has(recipeId));
  if (missing.length > 0) {
    for (const ref of await recipes.findRefsIncludingDeleted(missing, companyId)) refs.set(ref.id, ref);
  }

  const lines: PlannedLine[] = [];
  for (const [position, input] of entry.entries()) {
    const match = savedByInput.get(input);
    const requested = input.recipeVersionId ?? input.recipeId;
    const keepsRecipe = match !== undefined && requested === match.recipeId;
    const effectiveRecipeId = keepsRecipe
      ? match.recipeId
      : await atLinePosition(position, () => requireOrderRecipe([...refs.values()], input.recipeId, input.recipeVersionId));
    const originalRecipeId = keepsRecipe ? match.originalRecipeId : input.recipeId;
    const changed =
      match === undefined ||
      !isUnchangedOrderLine(match, {
        recipeId: effectiveRecipeId,
        quantity: input.quantity,
        unitId: input.unitId,
        salePrice: input.salePrice,
        presentationLines: input.presentationLines,
      });
    if (match !== undefined) {
      await atLinePosition(position, () => assertOrderLineEditable(match.status, changed));
    }
    const retry = match !== undefined && !changed && match.status === 'BLOQUEADO';
    lines.push({ position, input, saved: match, effectiveRecipeId, originalRecipeId, changed, retry });
  }

  assertOrderLinesRemovable(diff.removed);
  assertNoDuplicateOrderRecipe(
    lines.map((line) => ({ id: line.saved?.id, originalRecipeId: line.originalRecipeId })),
    saved,
  );

  if (diff.added.length === 0 && !saved.some((line) => isEditableOrderLineStatus(line.status))) {
    throw new InvalidTransitionError('ninguna linea activa admite edicion');
  }

  return { lines, removed: diff.removed };
}

/** Lo que se escribe y se aparta de una linea nueva, cambiada o que reintenta su reserva. */
type PreparedLine = {
  readonly planned: PlannedLine;
  readonly write: OrderLineWrite;
  readonly cost: StoredOrderCost | null | 'keep';
  readonly requirement: readonly ReservationRequirementLine[];
};

/**
 * El coste de una linea nueva o cambiada. Desde Comenzar el guardado se conserva; antes se
 * recalcula, y lo que esa misma linea tiene apartado cuenta como disponible para ella.
 */
async function lineCost(
  deps: UpdateOrderDeps,
  planned: PlannedLine,
  companyId: string,
): Promise<StoredOrderCost | null | 'keep'> {
  const { input, saved } = planned;
  if (saved !== undefined && isStartedOrderStatus(saved.status)) return 'keep';
  return resolveStoredOrderCost(
    deps,
    planned.effectiveRecipeId,
    input.quantity,
    input.unitId,
    packagingLinesOfInput(input.presentationLines),
    companyId,
    saved === undefined ? undefined : { orderLineId: saved.id },
  );
}

/**
 * Reparto y necesidad de una linea, con las lineas ya bloqueadas. El reparto antiguo solo se
 * conserva si llega igual. El coste es el calculado antes del candado salvo que la linea se haya
 * comenzado entre medias, que lo congela, o que no se calculara porque entonces la linea no cambiaba.
 */
async function prepareLine(
  deps: UpdateOrderDeps,
  transaction: OrderTransactionScope,
  planned: PlannedLine,
  computedCost: StoredOrderCost | null | 'keep' | undefined,
  companyId: string,
): Promise<PreparedLine> {
  const { input, saved } = planned;
  const distribution: ResolvedDistribution = await resolveDistribution(
    deps,
    companyId,
    input.quantity,
    input.unitId,
    input.presentationLines,
    { savedLines: saved?.presentationLines ?? [] },
  );

  const content = await transaction.recipes.findExecutionContentById(planned.effectiveRecipeId, companyId);
  const recipeLines = content?.lines ?? [];
  const units = await loadRequirementUnits(
    transaction,
    recipeLines.map((line) => line.productId),
    input.unitId,
    companyId,
  );
  const requirement = requireConvertibleRequirement(
    buildOrderRequirement({
      recipeLines,
      quantity: input.quantity,
      packagingLines: distribution.packagingLines,
      phase: 'before_consumption',
      units,
    }),
  );

  const cost =
    saved !== undefined && isStartedOrderStatus(saved.status)
      ? 'keep'
      : computedCost !== undefined
        ? computedCost
        : await lineCost(deps, planned, companyId);

  return {
    planned,
    write: {
      recipeId: planned.effectiveRecipeId,
      originalRecipeId: planned.originalRecipeId,
      quantity: input.quantity,
      unitId: input.unitId,
      salePrice: input.salePrice,
      presentationLines: distribution.lines,
    },
    cost,
    requirement,
  };
}

/** Las lineas ya estan bloqueadas: cualquier resultado distinto de `ok` es que la linea dejo de
 *  existir para esta empresa. */
async function moveLine(
  transaction: OrderTransactionScope,
  orderId: string,
  lineId: string,
  from: OrderLineStatus,
  to: Exclude<OrderLineStatus, 'CANCELADO'>,
  actorId: string,
  now: Date,
  scope: OrderScope,
): Promise<void> {
  const result = await transaction.orders.setLineStatus(orderId, lineId, from, to, actorId, now, scope);
  if (result !== 'ok') throw new OrderNotFoundError(`linea ${lineId}`);
}
