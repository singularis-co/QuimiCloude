// lib/modules/asignaciones/domain/finish-conditioning.ts
/**
 * Terminar el acondicionamiento: `EN_ACONDICIONAMIENTO -> TERMINADO`, con `finished_at`, solo si el
 * actor es quien acondiciona el pedido, completo los pasos de acondicionamiento de la formula
 * actual y todas las lineas del reparto tienen sus datos de lote. No toca inventario. La transicion y su anotacion en el registro de ejecucion van en una transaccion.
 *
 * Devuelve el numero visible del pedido, leido ANTES de la transicion: una vez `TERMINADO`, el
 * filtro de estado con el que se leyo ya no lo encontraria.
 *
 * Los datos de lote se comprueban fuera de la transicion: no se pueden borrar y el reparto no se
 * edita en este estado, asi que una vez completos siguen completos.
 */
import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { missingBatchDataLines } from './conditioning-batch-data';
import { conditioningProgress } from './conditioning-steps';
import {
  ConditioningBatchDataMissingError,
  ConditioningStepsPendingError,
  OrderConditioningTakenError,
  OrderNotConditionableError,
  OrderNotFoundError,
  ValidationError,
  type AsignacionesError,
} from './errors';
import { ExecutionAbortedError, type ExecutionWriteOutcome } from './execution-entry';

import type { ExecutionLogRepository } from '../ports/execution-log-repository';
import type { ExecutionTransaction } from '../ports/execution-transaction';

import type { FinishedBatchLabels } from '@/lib/modules/inventario';
import { formatOrderNumber, type OrderAssignmentTarget, type OrderCatalog } from '@/lib/modules/pedidos';
import type { RecipeConditioningStepsReader } from '@/lib/modules/recetas';

const finishConditioningSchema = z.strictObject({
  orderId: z.string().uuid(),
});

export type FinishConditioningDeps = {
  readonly orders: OrderCatalog;
  readonly batches: Pick<FinishedBatchLabels, 'listOfOrder'>;
  readonly transaction: ExecutionTransaction;
  readonly conditioningSteps: RecipeConditioningStepsReader;
  readonly log: Pick<ExecutionLogRepository, 'listEntriesForOrders'>;
  readonly now?: () => Date;
};

async function assertConditioningStepsCompleted(
  deps: FinishConditioningDeps,
  companyId: string,
  orderId: string,
  recipeId: string,
): Promise<void> {
  const steps = (await deps.conditioningSteps.findConditioningStepsById(recipeId, companyId)) ?? [];
  if (steps.length === 0) return;
  const entries = await deps.log.listEntriesForOrders(companyId, [orderId]);
  const { completedCount } = conditioningProgress(entries, steps.length);
  if (completedCount < steps.length) {
    throw new ConditioningStepsPendingError(`${String(completedCount)} de ${String(steps.length)} pasos`);
  }
}

function finishConditioningError(outcome: ExecutionWriteOutcome): AsignacionesError {
  if (outcome === 'not_conditioner') return new OrderConditioningTakenError();
  if (outcome === 'not_conditionable') return new OrderNotConditionableError();
  return new OrderNotFoundError();
}

export type FinishConditioningResult = {
  readonly numberText: string;
};

export function createFinishConditioning(
  deps: FinishConditioningDeps,
): (actor: Actor | null | undefined, input: unknown) => Promise<FinishConditioningResult> {
  return async function finishConditioning(
    actor: Actor | null | undefined,
    input: unknown,
  ): Promise<FinishConditioningResult> {
    // Autorizar va antes de validar la entrada y antes de tocar ningun puerto.
    requirePermission(actor, 'acondicionamiento.modificar');

    const parsed = finishConditioningSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { orderId } = parsed.data;

    const target: OrderAssignmentTarget | null = await deps.orders.findAliveById(orderId, actor.companyId);
    if (target === null) throw new OrderNotFoundError();

    const summaryPage = await deps.orders.listAliveSummariesByIds(
      actor.companyId,
      [orderId],
      [target.status],
      1,
      1,
    );
    const summary = summaryPage.items[0];
    if (summary === undefined) throw new OrderNotFoundError();
    const numberText = formatOrderNumber(summary.number);

    // Quien no acondiciona el pedido recibe su error aunque falten datos: no le toca saberlo.
    if (target.status !== 'EN_ACONDICIONAMIENTO') throw new OrderNotConditionableError();
    if (summary.conditionedBy !== actor.id) throw new OrderConditioningTakenError();

    await assertConditioningStepsCompleted(deps, actor.companyId, orderId, summary.recipeId);

    const batches = await deps.batches.listOfOrder(actor.companyId, orderId);
    if (missingBatchDataLines(summary.presentationLines, batches) > 0) throw new ConditioningBatchDataMissingError();

    const now = deps.now?.() ?? new Date();
    const companyId = actor.companyId;
    try {
      await deps.transaction.run(async ({ conditioning, log }) => {
        const result = await conditioning.finishConditioningAliveById(orderId, companyId, actor.id, now);
        if (result !== 'ok') throw new ExecutionAbortedError(result);
        await log.append({
          action: 'conditioning_finish',
          companyId,
          orderId,
          userId: actor.id,
          stepPosition: null,
          occurredAt: now,
        });
      });
    } catch (error) {
      if (error instanceof ExecutionAbortedError) throw finishConditioningError(error.outcome);
      throw error;
    }
    return { numberText };
  };
}
