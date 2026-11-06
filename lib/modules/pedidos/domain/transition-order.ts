// lib/modules/pedidos/domain/transition-order.ts
//
// Implementa `OrderCatalog['transitionAliveById']` (`order-catalog.ts`) sobre la unidad de
// trabajo compartida con `inventario`: mueve el estado de UNA linea, vuelve a derivar el del pedido
// y, si el destino es `POR_EMPACAR`, consume el material apartado para esa linea, todo en la MISMA
// transaccion. Los destinos de empaque, acondicionamiento y cierre no son de este metodo: solo los
// alcanzan los metodos que conocen a quien empaca o acondiciona. `asignaciones` solo conoce la
// firma del puerto, nunca este archivo.

import { InsufficientMaterialError, InvalidTransitionError, RecipeWithoutLinesError } from './errors';
import { buildRequirement } from './order-requirement';
import { loadRequirementUnits } from './order-requirement-units';
import { assertTransition } from './order-transitions';

import type { OrderLineStatus } from './order-classification';
import type { OrderCatalog } from './order-catalog';

import type { OrderUnitOfWork } from '../ports/order-unit-of-work';

const DESTINOS_RESERVADOS: readonly OrderLineStatus[] = [
  'EN_EMPAQUE',
  'POR_ACONDICIONAR',
  'EN_ACONDICIONAMIENTO',
  'TERMINADO',
  'ENTREGADO',
];

export type TransitionOrderDeps = {
  readonly unitOfWork: OrderUnitOfWork;
};

/** Se lanza dentro de la unidad de trabajo cuando la linea ya consumio material pero no pudo
 *  mover su estado: deshace la transaccion y lleva el resultado real hacia fuera. */
class StatusChangeAfterConsumptionFailedError extends Error {
  constructor(readonly outcome: 'not_found' | 'stale') {
    super(`setLineStatus devolvio '${outcome}' tras consumir material`);
  }
}

/** Firma exacta de `OrderCatalog['transitionAliveById']`: es lo que `asignaciones` invoca sin
 *  saber que, por dentro, hay una transaccion con tres modulos. */
export function createTransitionOrder(deps: TransitionOrderDeps): OrderCatalog['transitionAliveById'] {
  return async function transitionAliveById(
    id: string,
    lineId: string,
    companyId: string,
    from: OrderLineStatus,
    to: OrderLineStatus,
    actorId: string,
    now: Date,
  ) {
    // Falla rapido, sin abrir transaccion, si el destino no es alcanzable desde el estado actual.
    assertTransition(from, to);
    // Son destinos legales de la matriz, pero este metodo no conoce a quien empaca ni a quien
    // acondiciona; `CANCELADO` lleva motivo y es de cancelar. Se rechazan igual que un destino
    // fuera de la matriz.
    if (to === 'CANCELADO' || DESTINOS_RESERVADOS.includes(to)) {
      throw new InvalidTransitionError(`de ${from} a ${to}`);
    }

    try {
      return await deps.unitOfWork.run(async (scope) => {
        const locked = await scope.orders.lockAliveLine(id, lineId, { companyId });
        if (locked === null) return 'not_found';
        // La linea sigue viva pero ya no esta en `from`: otra operacion la movio entre la
        // lectura de quien llama y este bloqueo.
        if (locked.line.status !== from) return 'stale';

        // Consume ANTES de mover el estado: si falta material o la receta no tiene lineas, la
        // excepcion deshace la transaccion entera y el estado no queda escrito.
        if (to === 'POR_EMPACAR') {
          // Con el cliente de ESTA transaccion (`scope.recipes`), no con el lector global: pedir
          // una segunda conexion mientras esta retiene la suya es espera o error bajo carga.
          const content = await scope.recipes.findExecutionContentById(locked.line.recipeId, companyId);
          const recipeLines = content?.lines ?? [];
          const units = await loadRequirementUnits(
            scope,
            recipeLines.map((line) => line.productId),
            locked.line.unitId,
            companyId,
          );
          const requirement = buildRequirement(recipeLines, locked.line.quantity, units);
          // Sin necesidad en la unidad del insumo no hay con que comprobar lo que se consume.
          if (requirement.kind === 'not_convertible') {
            throw new InsufficientMaterialError(`productIds=${requirement.productIds.join(',')}`);
          }

          // Solo la receta: los envases del reparto siguen apartados hasta Terminar el empaque.
          const outcome = await scope.reservations.consumeForLine({
            orderId: id,
            orderLineId: lineId,
            companyId,
            fallbackRequirement: requirement.lines,
            productIds: recipeLines.map((line) => line.productId),
            actorId,
            now,
          });

          if (outcome.kind === 'insufficient') throw new InsufficientMaterialError();
          if (outcome.kind === 'nothing_to_consume') throw new RecipeWithoutLinesError();
        }

        const result = await scope.orders.setLineStatus(id, lineId, from, to, actorId, now, { companyId });
        if (result !== 'ok') throw new StatusChangeAfterConsumptionFailedError(result);
        // Lo apartado ya se consumio: el plazo de la reserva deja de contar.
        if (to === 'POR_EMPACAR') await scope.orders.setLineReservedAt(id, lineId, null, { companyId });

        await scope.orders.refreshStatus(id, actorId, now, { companyId });
        return 'ok' as const;
      });
    } catch (err) {
      if (err instanceof InsufficientMaterialError) return 'insufficient_material';
      if (err instanceof RecipeWithoutLinesError) return 'recipe_without_lines';
      if (err instanceof StatusChangeAfterConsumptionFailedError) return err.outcome;
      throw err;
    }
  };
}
