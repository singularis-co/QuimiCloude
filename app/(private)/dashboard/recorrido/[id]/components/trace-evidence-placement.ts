import type { ExecutionTraceDetailStep, OrderEvidenceGroup } from '@/lib/modules/asignaciones';

export type TraceEvidencePlacement = {
  readonly byStepId: ReadonlyMap<string, OrderEvidenceGroup>;
  readonly others: readonly OrderEvidenceGroup[];
};

/**
 * Coloca cada grupo de fabricación bajo la última anotación con su número de paso: la de un paso
 * repetido es la que recoge el estado final de sus fotos. Los grupos de un paso que nadie anotó
 * quedan en `others`. Las anotaciones de empaque no llevan número, así que nunca reciben fotos.
 */
export function placeManufacturingEvidence(
  steps: readonly Pick<ExecutionTraceDetailStep, 'id' | 'stepPosition'>[],
  groups: readonly OrderEvidenceGroup[],
): TraceEvidencePlacement {
  const lastStepIdByPosition = new Map<number, string>();
  for (const step of steps) {
    if (step.stepPosition !== null) lastStepIdByPosition.set(step.stepPosition, step.id);
  }

  const byStepId = new Map<string, OrderEvidenceGroup>();
  const others: OrderEvidenceGroup[] = [];
  for (const group of groups) {
    const stepId = lastStepIdByPosition.get(group.stepPosition);
    if (stepId === undefined) others.push(group);
    else byStepId.set(stepId, group);
  }

  others.sort((a, b) => a.stepPosition - b.stepPosition);
  return { byStepId, others };
}
