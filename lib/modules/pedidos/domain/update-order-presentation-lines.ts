// lib/modules/pedidos/domain/update-order-presentation-lines.ts
//
// Edicion ACOTADA del reparto y la unidad de una linea del pedido, aparte de `updateOrder`:
// se permite tocar reparto y unidad hasta Comenzar empaque, `POR_EMPACAR` incluido,
// donde `updateOrder` no deja tocar nada (`ALLOWED.POR_EMPACAR` sin «quedarse
// igual»). Por eso este caso de uso NO pasa por `assertTransition`: `REPARTO_EDITABLE_STATUSES`
// es su propia ventana de estados, deliberadamente distinta de la matriz de transiciones.
//
// La AUTORIZACION (`pedidos.modificar`) la comprueba QUIEN LLAMA
// (`updateOrderDistributionAction`), no este caso de uso —mismo criterio que
// `finishAssignedOrder` con `startAssignedOrder`—: solo hay un llamador.
//
// Corre en la unidad de trabajo compartida con `inventario`: el reparto nombra envases y lo
// apartado tiene que seguirlo. Nunca toca `quantity` ni la receta, ni ninguna otra linea. Antes de
// Comenzar tambien recalcula el importe de la linea, que incluye los envases; desde Comenzar lo
// conserva.

import type { Actor } from './actor';
import {
  InsufficientMaterialError,
  OrderNotFoundError,
  OrderUnitNotConvertibleError,
  OrderWouldBlockError,
} from './errors';
import { validateDistribution } from './order-distribution';
import { isStartedOrderStatus, type OrderLineStatus } from './order-classification';
import { buildOrderRequirement, packagingLinesOf } from './order-requirement';
import { loadRequirementUnits, requireConvertibleRequirement } from './order-requirement-units';
import type { OrderScope } from './order-scope';
import { resolveStoredOrderCost, type OrderCostCatalogs } from './resolve-ingredients-cost';
import {
  resolveDistributionLines,
  type DistributionCatalogs,
  type DistributionLineInput,
} from './resolve-distribution';

import type { OrderUnitOfWork } from '../ports/order-unit-of-work';
import type { OrderWriteRepository } from '../ports/order-write-repository';

/**
 * El reparto y la unidad se pueden editar hasta Comenzar empaque. `'BLOQUEADO'` entra porque el
 * bloqueo es por material y editar el reparto puede resolverlo.
 */
export const REPARTO_EDITABLE_STATUSES: readonly OrderLineStatus[] = [
  'PENDIENTE',
  'EN_CURSO',
  'POR_EMPACAR',
  'BLOQUEADO',
];

export type UpdateOrderPresentationLinesInput = {
  /** La linea cuyo reparto se edita; una de otro pedido, de otra empresa o quitada es `not_found`. */
  readonly lineId: string;
  readonly unitId: string;
  readonly lines: readonly DistributionLineInput[];
  /** Permiso explicito para dejar el pedido bloqueado si un envase o material no alcanza. */
  readonly confirmBlocked?: boolean;
};

/**
 * Discriminado, NO lanzado: a diferencia de `createOrder`/`updateOrder`, que
 * dejan subir los errores de `resolveDistribution`, este caso de uso devuelve el resultado para
 * que quien llama lo traduzca a su codigo. El primer fallo aborta SIN escribir nada, ni la
 * unidad ni las lineas ni lo apartado. `invalid_lines`: dos lineas con la misma presentacion, o
 * una linea antigua que el pedido no tenia tal cual. `would_block`: falta disponible en un
 * pedido que se puede bloquear y no llego la confirmacion; `insufficient_material`: falta en uno
 * que no se puede bloquear. `unit_not_convertible`: con la unidad nueva, la cantidad no se puede
 * llevar a la unidad de algun insumo de la receta.
 */
export type UpdateOrderPresentationLinesResult =
  | 'ok'
  | 'not_found'
  | 'not_editable'
  | 'unit_not_found'
  | 'without_unit'
  | 'presentation_not_found'
  | 'packaging_not_found'
  | 'invalid_lines'
  | 'presentation_without_content'
  | 'incompatible_units'
  | 'exceeds_quantity'
  | 'would_block'
  | 'insufficient_material'
  | 'unit_not_convertible';

export type UpdateOrderPresentationLinesDeps = DistributionCatalogs &
  Pick<OrderCostCatalogs, 'recipes' | 'products'> & {
  readonly unitOfWork: OrderUnitOfWork;
  /** Ver el comentario identico de `create-order.ts` sobre el origen de este reloj. */
  readonly now?: () => Date;
};

/** Con la receta ya consumida no hay aviso posible: no existe `POR_EMPACAR -> BLOQUEADO`. */
const BLOCKABLE_STATUSES: readonly OrderLineStatus[] = ['PENDIENTE', 'BLOQUEADO'];

export function createUpdateOrderPresentationLines(
  deps: UpdateOrderPresentationLinesDeps,
): (
  orderId: string,
  actor: Actor,
  input: UpdateOrderPresentationLinesInput,
) => Promise<UpdateOrderPresentationLinesResult> {
  const now = deps.now ?? (() => new Date());

  return async function updateOrderPresentationLines(orderId, actor, input) {
    const companyId = actor.companyId;
    const actorId = actor.id;
    const scope: OrderScope = { companyId };
    const instant = now();

    try {
      return await deps.unitOfWork.run(async (transaction): Promise<UpdateOrderPresentationLinesResult> => {
        // El pedido y la linea se bloquean antes de leer o escribir nada mas, asi que Comenzar y
        // este guardado se serializan.
        const locked = await transaction.orders.lockAliveLine(orderId, input.lineId, scope);
        if (locked === null) return 'not_found';
        const { line } = locked;

        if (!REPARTO_EDITABLE_STATUSES.includes(line.status)) return 'not_editable';

        // Una linea antigua solo se conserva si llega igual que una de las que la linea ya tiene.
        const resolution = await resolveDistributionLines(deps, companyId, input.unitId, input.lines, {
          savedLines: line.presentationLines,
        });
        if (resolution.kind !== 'resolved') return resolution.kind;

        // El disponible o el primer fallo, con la cantidad de la linea ya bloqueada: este caso de uso
        // no la cambia.
        const result = validateDistribution(
          line.quantity,
          resolution.orderUnit,
          resolution.lines.map((item) => item.distribution),
        );
        switch (result.kind) {
          case 'without_unit':
            return 'without_unit';
          case 'presentation_without_content':
            return 'presentation_without_content';
          case 'incompatible_units':
            return 'incompatible_units';
          case 'exceeds_quantity':
            return 'exceeds_quantity';
          case 'ok':
            break;
        }

        const writeLines = resolution.lines.map((item) => item.write);

        // En POR_EMPACAR la receta ya se consumio: solo quedan por apartar los envases. La
        // necesidad se arma antes de escribir, con la unidad nueva: una linea no convertible
        // rechaza el cambio sin tocar nada.
        const materialsConsumed = line.status === 'POR_EMPACAR';
        const recipeLines = materialsConsumed
          ? []
          : ((await transaction.recipes.findExecutionContentById(line.recipeId, companyId))?.lines ?? []);
        const packagingLines = packagingLinesOf(writeLines);
        const units = await loadRequirementUnits(
          transaction,
          recipeLines.map((recipeLine) => recipeLine.productId),
          input.unitId,
          companyId,
        );
        const requirement = requireConvertibleRequirement(
          buildOrderRequirement({
            recipeLines,
            quantity: line.quantity,
            packagingLines,
            phase: materialsConsumed ? 'materials_consumed' : 'before_consumption',
            units,
          }),
        );

        const written = await transaction.orders.writeLines(
          orderId,
          {
            removedIds: [],
            edited: [
              {
                lineId: line.id,
                line: {
                  recipeId: line.recipeId,
                  originalRecipeId: line.originalRecipeId,
                  quantity: line.quantity,
                  unitId: input.unitId,
                  salePrice: line.salePrice,
                  presentationLines: writeLines,
                },
                cost: 'keep',
              },
            ],
            added: [],
          },
          actorId,
          instant,
          scope,
        );
        // El pedido y la linea estan bloqueados desde `lockAliveLine` en esta misma transaccion.
        if (written === null) return 'not_found';

        const reservation = await transaction.reservations.syncForLine({
          orderId,
          orderLineId: line.id,
          companyId,
          requirement,
          actorId,
          now: instant,
        });

        if (reservation.kind === 'insufficient') {
          // Lanzar deshace el reparto, la unidad y lo apartado.
          if (!BLOCKABLE_STATUSES.includes(line.status)) throw new InsufficientMaterialError();
          if (input.confirmBlocked !== true) throw new OrderWouldBlockError();
          if (line.status !== 'BLOQUEADO') {
            await moveLine(transaction.orders, orderId, line.id, line.status, 'BLOQUEADO', actorId, instant, scope);
          }
          if (line.ingredientsCost !== null) {
            await transaction.orders.setLineIngredientsCost(orderId, line.id, null, actorId, instant, scope);
          }
        } else {
          if (line.status === 'BLOQUEADO') {
            await moveLine(transaction.orders, orderId, line.id, 'BLOQUEADO', 'PENDIENTE', actorId, instant, scope);
          }
          // La receta y la cantidad salen de la linea bloqueada, asi que el importe se calcula aqui y
          // no antes de abrir la transaccion; lo apartado por esta linea cuenta como suyo.
          if (!isStartedOrderStatus(line.status)) {
            const cost = await resolveStoredOrderCost(
              deps,
              line.recipeId,
              line.quantity,
              input.unitId,
              packagingLines,
              companyId,
              { orderLineId: line.id },
            );
            await transaction.orders.setLineIngredientsCost(orderId, line.id, cost, actorId, instant, scope);
          }
        }

        await transaction.orders.setLineReservedAt(
          orderId,
          line.id,
          reservation.kind === 'reserved' ? instant : null,
          scope,
        );
        await transaction.orders.refreshStatus(orderId, actorId, instant, scope);
        return 'ok';
      });
    } catch (error) {
      if (error instanceof OrderWouldBlockError) return 'would_block';
      if (error instanceof InsufficientMaterialError) return 'insufficient_material';
      if (error instanceof OrderNotFoundError) return 'not_found';
      if (error instanceof OrderUnitNotConvertibleError) return 'unit_not_convertible';
      throw error;
    }
  };
}

/** La linea ya esta bloqueada: cualquier resultado distinto de `ok` es que dejo de existir para
 *  esta empresa. */
async function moveLine(
  orders: OrderWriteRepository,
  orderId: string,
  lineId: string,
  from: OrderLineStatus,
  to: Exclude<OrderLineStatus, 'CANCELADO'>,
  actorId: string,
  now: Date,
  scope: OrderScope,
): Promise<void> {
  const result = await orders.setLineStatus(orderId, lineId, from, to, actorId, now, scope);
  if (result !== 'ok') throw new OrderNotFoundError(`linea ${lineId}`);
}
