// lib/modules/asignaciones/domain/cancel-assigned-order.ts
import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { NotCancellableError, OrderNotFoundError, ValidationError } from './errors';
import { ExecutionAbortedError, isExecutionSuccess } from './execution-entry';
import { readOutcomeRecipe, type OutcomeRecipe } from './recipe-of-order';
import { findLine, orderLineInputSchema } from './order-line-target';

import type { ExecutionTransaction } from '../ports/execution-transaction';
import type { OrderAssignmentRepository } from '../ports/order-assignment-repository';

import { cancelOrderSchema, formatOrderNumber, type OrderCatalog } from '@/lib/modules/pedidos';
import type { RecipeCatalog } from '@/lib/modules/recetas';

const cancelAssignedOrderSchema = orderLineInputSchema.extend({
  stepPosition: z.number().int().min(1).nullable(),
  reason: cancelOrderSchema.shape.reason,
});

export type CancelAssignedOrderDeps = {
  readonly assignments: OrderAssignmentRepository;
  readonly orders: OrderCatalog;
  readonly recipes: Pick<RecipeCatalog, 'findRefsIncludingDeleted'>;
  readonly transaction: ExecutionTransaction;
  readonly now?: () => Date;
};

export type CancelAssignedOrderResult = OutcomeRecipe & {
  readonly numberText: string;
};

/**
 * Cancela solo la receta nombrada por el camino de `pedidos` -motivo, liberacion de su material,
 * estado del pedido derivado- y anota la cancelacion en el registro de esa receta con el mismo
 * motivo, todo en una transaccion: o quedan las dos cosas o ninguna.
 *
 * Que el estado de la linea sea cancelable lo decide `pedidos` bajo el candado de la fila, no esta
 * funcion: por eso la escritura no se reintenta por carrera, y cualquier estado no cancelable sale
 * por `not_cancellable`.
 *
 * El numero visible y la receta se leen antes de escribir, para que la lista pueda confirmar que
 * receta de que pedido se cancelo.
 */
export function createCancelAssignedOrder(
  deps: CancelAssignedOrderDeps,
): (actor: Actor | null | undefined, input: unknown) => Promise<CancelAssignedOrderResult> {
  return async function cancelAssignedOrder(
    actor: Actor | null | undefined,
    input: unknown,
  ): Promise<CancelAssignedOrderResult> {
    requirePermission(actor, 'asignaciones.ejecutar');

    const parsed = cancelAssignedOrderSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { orderId, lineId, stepPosition, reason } = parsed.data;

    const ids = await deps.assignments.listOrderIdsByUserInCompany(actor.companyId, actor.id);
    if (!ids.includes(orderId)) throw new OrderNotFoundError();

    const summary = await findLine(deps.orders, actor.companyId, orderId, lineId);
    const numberText = formatOrderNumber(summary.number);

    const outcomeRecipe = await readOutcomeRecipe(deps, actor.companyId, orderId, summary.recipeId);
    const now = deps.now?.() ?? new Date();
    try {
      await deps.transaction.run(async ({ orders, log }) => {
        const outcome = await orders.cancelLineAliveById(orderId, lineId, actor.companyId, reason, actor.id, now);
        if (!isExecutionSuccess(outcome)) throw new ExecutionAbortedError(outcome);
        await log.append({
          action: 'cancel',
          companyId: actor.companyId,
          orderId,
          orderLineId: lineId,
          userId: actor.id,
          stepPosition,
          reason,
          occurredAt: now,
        });
      });
    } catch (error) {
      if (!(error instanceof ExecutionAbortedError)) throw error;
      if (error.outcome === 'not_cancellable') throw new NotCancellableError();
      if (error.outcome === 'not_found') throw new OrderNotFoundError();
      throw error;
    }

    return { numberText, ...outcomeRecipe };
  };
}
