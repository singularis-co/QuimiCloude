// lib/modules/asignaciones/domain/record-conditioning-step.ts
/**
 * Dejar atras un paso de acondicionamiento. Si es el siguiente al ultimo completado, lo completa;
 * si ya estaba completado, solo anota un cambio de responsables cuando el conjunto es otro. El
 * avance vive en el registro de ejecucion: nada se edita ni se borra.
 *
 * Los pasos son los de la formula ACTUAL, leidos en cada llamada.
 */
import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { conditioningProgress, sameResponsibles } from './conditioning-steps';
import {
  ConditioningResponsibleNotAllowedError,
  ConditioningResponsiblesRequiredError,
  ConditioningStepOutOfOrderError,
  EvidenceRequiredError,
  OrderConditioningTakenError,
  OrderNotConditionableError,
  OrderNotFoundError,
  ValidationError,
} from './errors';

import type { ConditioningTeamRepository } from '../ports/conditioning-team-repository';
import type { ExecutionLogRepository } from '../ports/execution-log-repository';
import type { StepEvidenceRepository } from '../ports/step-evidence-repository';
import type { OrderCatalog } from '@/lib/modules/pedidos';
import type { ConditioningStepView, RecipeConditioningStepsReader } from '@/lib/modules/recetas';

const recordConditioningStepSchema = z.strictObject({
  orderId: z.string().uuid(),
  stepPosition: z.number().int().min(1),
  responsibleUserIds: z
    .array(z.string().uuid())
    .refine((ids) => new Set(ids).size === ids.length, { message: 'responsables repetidos' })
    .default([]),
});

export type RecordConditioningStepDeps = {
  readonly orders: OrderCatalog;
  readonly conditioningSteps: RecipeConditioningStepsReader;
  readonly team: Pick<ConditioningTeamRepository, 'listByOrderInCompany'>;
  readonly log: Pick<ExecutionLogRepository, 'append' | 'listEntriesForOrders'>;
  readonly evidence: Pick<StepEvidenceRepository, 'listByOrder'>;
  readonly now?: () => Date;
};

export type RecordConditioningStepResult = {
  readonly completedCount: number;
  readonly allCompleted: boolean;
};

async function assertResponsibles(
  deps: RecordConditioningStepDeps,
  actor: Actor,
  orderId: string,
  step: ConditioningStepView,
  responsibleUserIds: readonly string[],
): Promise<void> {
  if (step.requiresAssignment !== true) {
    if (responsibleUserIds.length > 0) throw new ValidationError('responsables en un paso sin asignacion');
    return;
  }
  if (responsibleUserIds.length === 0) throw new ConditioningResponsiblesRequiredError();
  const team = await deps.team.listByOrderInCompany(actor.companyId, orderId);
  const allowed = new Set([actor.id, ...team.map((member) => member.userId)]);
  if (responsibleUserIds.some((id) => !allowed.has(id))) throw new ConditioningResponsibleNotAllowedError();
}

export function createRecordConditioningStep(
  deps: RecordConditioningStepDeps,
): (actor: Actor | null | undefined, input: unknown) => Promise<RecordConditioningStepResult> {
  return async function recordConditioningStep(
    actor: Actor | null | undefined,
    input: unknown,
  ): Promise<RecordConditioningStepResult> {
    // Autorizar va antes de validar la entrada y antes de tocar ningun puerto.
    requirePermission(actor, 'acondicionamiento.modificar');

    const parsed = recordConditioningStepSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { orderId, stepPosition, responsibleUserIds } = parsed.data;
    const companyId = actor.companyId;

    const target = await deps.orders.findAliveById(orderId, companyId);
    if (target === null) throw new OrderNotFoundError();
    const page = await deps.orders.listAliveSummariesByIds(companyId, [orderId], [target.status], 1, 1);
    const summary = page.items[0];
    if (summary === undefined) throw new OrderNotFoundError();
    if (target.status !== 'EN_ACONDICIONAMIENTO') throw new OrderNotConditionableError();
    if (summary.conditionedBy !== actor.id) throw new OrderConditioningTakenError();

    const steps = (await deps.conditioningSteps.findConditioningStepsById(summary.recipeId, companyId)) ?? [];
    const step = steps[stepPosition - 1];
    if (step === undefined) throw new ConditioningStepOutOfOrderError(`paso ${String(stepPosition)} inexistente`);

    await assertResponsibles(deps, actor, orderId, step, responsibleUserIds);

    const entries = await deps.log.listEntriesForOrders(companyId, [orderId]);
    const progress = conditioningProgress(entries, steps.length);
    const occurredAt = deps.now?.() ?? new Date();
    const assigned = step.requiresAssignment === true;

    if (stepPosition <= progress.completedCount) {
      const current = progress.responsibles.get(stepPosition);
      if (assigned && (current === undefined || !sameResponsibles(current, responsibleUserIds))) {
        await deps.log.append({
          action: 'conditioning_responsibles_change',
          companyId,
          orderId,
          userId: actor.id,
          stepPosition,
          responsibleUserIds,
          occurredAt,
        });
      }
      return { completedCount: progress.completedCount, allCompleted: progress.completedCount === steps.length };
    }

    if (stepPosition !== progress.completedCount + 1) {
      throw new ConditioningStepOutOfOrderError(
        `paso ${String(stepPosition)} con ${String(progress.completedCount)} completados`,
      );
    }

    if (step.requiresEvidence === true) {
      const photos = await deps.evidence.listByOrder(companyId, orderId, 'conditioning');
      if (!photos.some((photo) => photo.stepPosition === stepPosition)) {
        throw new EvidenceRequiredError(`paso ${String(stepPosition)} sin evidencia`);
      }
    }

    const outcome = await deps.log.append({
      action: stepPosition === steps.length ? 'conditioning_steps_complete' : 'conditioning_step_advance',
      companyId,
      orderId,
      userId: actor.id,
      stepPosition,
      responsibleUserIds: assigned ? responsibleUserIds : null,
      occurredAt,
    });
    if (outcome === 'step_already_completed') {
      throw new ConditioningStepOutOfOrderError(`paso ${String(stepPosition)} ya completado`);
    }
    return { completedCount: stepPosition, allCompleted: stepPosition === steps.length };
  };
}
