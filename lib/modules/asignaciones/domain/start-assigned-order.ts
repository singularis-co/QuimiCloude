// lib/modules/asignaciones/domain/start-assigned-order.ts
import { requirePermission, type Actor } from './actor';
import { OrderBlockedError, OrderNotFoundError, ValidationError } from './errors';
import { ExecutionAbortedError, isExecutionSuccess } from './execution-entry';
import { createGetAssignedOrderExecution, type GetAssignedOrderExecutionDeps } from './get-assigned-order-execution';
import { assertOrderAcceptsWrites } from './order-state';
import { findLine, lineAsTarget, orderLineInputSchema } from './order-line-target';

import type { AssignedOrderExecutionView, StartedOrderExecution } from './assigned-order-execution-view';
import type { ExecutionLogRepository } from '../ports/execution-log-repository';
import type { ExecutionTransaction } from '../ports/execution-transaction';

import type { AssignedOrderSummary } from '@/lib/modules/pedidos';

export type StartAssignedOrderDeps = GetAssignedOrderExecutionDeps & {
  readonly log: ExecutionLogRepository;
  readonly transaction: ExecutionTransaction;
  readonly now?: () => Date;
};

/**
 * Decide por el estado de la linea, no el del pedido. `PENDIENTE` transiciona a `EN_CURSO` y anota
 * el arranque en la misma transaccion; `EN_CURSO` anota el retomar en la ultima posicion anotada de
 * esa linea; `BLOQUEADO` rechaza con `order_blocked` sin anotar, tambien si una edicion la bloqueo
 * entre la lectura y la transicion; cualquier otro estado rechaza con el error de `order-state.ts`.
 * Si otro responsable arranca antes de la transicion, se relee la linea y se sigue por la rama del
 * estado nuevo.
 * La legalidad de la escritura la decide `pedidos` dentro de `transitionAliveById`, nunca esta
 * funcion.
 */
export function createStartAssignedOrder(
  deps: StartAssignedOrderDeps,
): (actor: Actor | null | undefined, input: unknown) => Promise<StartedOrderExecution> {
  const getAssignedOrderExecution = createGetAssignedOrderExecution(deps);

  return async function startAssignedOrder(
    actor: Actor | null | undefined,
    input: unknown,
  ): Promise<StartedOrderExecution> {
    requirePermission(actor, 'asignaciones.ejecutar');

    const parsed = orderLineInputSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { orderId, lineId } = parsed.data;

    const ids = await deps.assignments.listOrderIdsByUserInCompany(actor.companyId, actor.id);
    if (!ids.includes(orderId)) throw new OrderNotFoundError();

    let line: AssignedOrderSummary = await findLine(deps.orders, actor.companyId, orderId, lineId);
    // Los pasos no cambian al transicionar: tras un `stale` se reutiliza la vista ya leida.
    let view: AssignedOrderExecutionView | null = null;

    for (;;) {
      if (line.status === 'BLOQUEADO') throw new OrderBlockedError();

      if (line.status === 'EN_CURSO') {
        view ??= await getAssignedOrderExecution(actor, { orderId, lineId });
        const last = await deps.log.findLastStepPosition(actor.companyId, orderId, lineId);
        const position = view.steps.length === 0 ? null : last ?? 1;
        await deps.log.append({
          action: 'resume',
          companyId: actor.companyId,
          orderId,
          orderLineId: lineId,
          userId: actor.id,
          stepPosition: position,
          occurredAt: deps.now?.() ?? new Date(),
        });
        return { ...view, status: 'EN_CURSO', resumeStepPosition: position };
      }

      if (line.status !== 'PENDIENTE') {
        assertOrderAcceptsWrites(lineAsTarget(line));
        throw new OrderNotFoundError();
      }

      view ??= await getAssignedOrderExecution(actor, { orderId, lineId });
      const position = view.steps.length === 0 ? null : 1;
      const now = deps.now?.() ?? new Date();
      try {
        await deps.transaction.run(async ({ orders, log }) => {
          const outcome = await orders.transitionAliveById(
            orderId,
            lineId,
            actor.companyId,
            'PENDIENTE',
            'EN_CURSO',
            actor.id,
            now,
          );
          if (!isExecutionSuccess(outcome)) throw new ExecutionAbortedError(outcome);
          await log.append({
            action: 'start',
            companyId: actor.companyId,
            orderId,
            orderLineId: lineId,
            userId: actor.id,
            stepPosition: position,
            occurredAt: now,
          });
        });
        return { ...view, status: 'EN_CURSO', resumeStepPosition: position };
      } catch (error) {
        if (!(error instanceof ExecutionAbortedError)) throw error;
        if (error.outcome === 'not_found') throw new OrderNotFoundError();
        if (error.outcome !== 'stale') throw error;
        // Dos responsables entrando a la vez es un caso esperado: se relee y se sigue.
        line = await findLine(deps.orders, actor.companyId, orderId, lineId);
      }
    }
  };
}
