// lib/modules/asignaciones/domain/finish-conditioning.ts
/**
 * Terminar el acondicionamiento de la receta nombrada: `EN_ACONDICIONAMIENTO -> TERMINADO`, con
 * `finished_at`, solo si el actor es quien la acondiciona, completo los pasos de acondicionamiento
 * de la formula actual y todas las lineas del reparto tienen sus datos de lote. No toca inventario.
 * La transicion y su anotacion en el registro de ejecucion van en una transaccion.
 *
 * Devuelve el numero visible del pedido, leido antes de la transicion.
 *
 * Los datos de lote se comprueban fuera de la transicion: no se pueden borrar y el reparto no se
 * edita en este estado, asi que una vez completos siguen completos.
 */
import { requirePermission, type Actor } from './actor';
import { missingBatchDataLines } from './conditioning-batch-data';
import { lineConditioningProgress } from './conditioning-steps';
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
import { readOutcomeRecipe, type OutcomeRecipe } from './recipe-of-order';
import { findLine, orderLineInputSchema } from './order-line-target';

import type { ExecutionLogRepository } from '../ports/execution-log-repository';
import type { ExecutionTransaction } from '../ports/execution-transaction';

import type { FinishedBatchLabels } from '@/lib/modules/inventario';
import {
  formatOrderNumber,
  type AssignedOrderSummary,
  type OrderCatalog,
} from '@/lib/modules/pedidos';
import type { RecipeCatalog, RecipeConditioningStepsReader } from '@/lib/modules/recetas';

export type FinishConditioningDeps = {
  readonly orders: OrderCatalog;
  readonly recipes: Pick<RecipeCatalog, 'findRefsIncludingDeleted'>;
  readonly batches: Pick<FinishedBatchLabels, 'listOfOrder'>;
  readonly transaction: ExecutionTransaction;
  readonly conditioningSteps: RecipeConditioningStepsReader;
  readonly log: Pick<ExecutionLogRepository, 'listEntriesForOrders'>;
  readonly now?: () => Date;
};

async function assertConditioningStepsCompleted(
  deps: FinishConditioningDeps,
  companyId: string,
  summary: Pick<AssignedOrderSummary, 'id' | 'lineId' | 'recipeId'>,
): Promise<void> {
  const steps = (await deps.conditioningSteps.findConditioningStepsById(summary.recipeId, companyId)) ?? [];
  if (steps.length === 0) return;
  const entries = await deps.log.listEntriesForOrders(companyId, [summary.id]);
  const { completedCount } = lineConditioningProgress(entries, summary.lineId, steps.length);
  if (completedCount < steps.length) {
    throw new ConditioningStepsPendingError(`${String(completedCount)} de ${String(steps.length)} pasos`);
  }
}

function finishConditioningError(outcome: ExecutionWriteOutcome): AsignacionesError {
  if (outcome === 'not_conditioner') return new OrderConditioningTakenError();
  if (outcome === 'not_conditionable') return new OrderNotConditionableError();
  return new OrderNotFoundError();
}

export type FinishConditioningResult = OutcomeRecipe & {
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

    const parsed = orderLineInputSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { orderId, lineId } = parsed.data;

    const summary = await findLine(deps.orders, actor.companyId, orderId, lineId);
    const numberText = formatOrderNumber(summary.number);

    // Quien no acondiciona la receta recibe su error aunque falten datos: no le toca saberlo.
    if (summary.status !== 'EN_ACONDICIONAMIENTO') throw new OrderNotConditionableError();
    if (summary.conditionedBy !== actor.id) throw new OrderConditioningTakenError();

    await assertConditioningStepsCompleted(deps, actor.companyId, summary);

    const batches = await deps.batches.listOfOrder(actor.companyId, orderId, summary.lineId);
    if (missingBatchDataLines(summary.presentationLines, batches) > 0) throw new ConditioningBatchDataMissingError();

    const outcomeRecipe = await readOutcomeRecipe(deps, actor.companyId, orderId, summary.recipeId);
    const now = deps.now?.() ?? new Date();
    const companyId = actor.companyId;
    try {
      await deps.transaction.run(async ({ conditioning, log }) => {
        const result = await conditioning.finishConditioningAliveById(orderId, summary.lineId, companyId, actor.id, now);
        if (result !== 'ok') throw new ExecutionAbortedError(result);
        await log.append({
          action: 'conditioning_finish',
          companyId,
          orderId,
          orderLineId: summary.lineId,
          userId: actor.id,
          stepPosition: null,
          occurredAt: now,
        });
      });
    } catch (error) {
      if (error instanceof ExecutionAbortedError) throw finishConditioningError(error.outcome);
      throw error;
    }
    return { numberText, ...outcomeRecipe };
  };
}
