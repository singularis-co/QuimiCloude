import type { ExecutionEntryRecord } from './execution-entry';

export type ConditioningProgress = {
  readonly completedCount: number;
  readonly responsibles: ReadonlyMap<number, readonly string[]>;
};

function completesStep(entry: ExecutionEntryRecord): boolean {
  return entry.action === 'conditioning_step_advance' || entry.action === 'conditioning_steps_complete';
}

function carriesResponsibles(entry: ExecutionEntryRecord): boolean {
  return completesStep(entry) || entry.action === 'conditioning_responsibles_change';
}

/**
 * Avance de UN pedido a partir de sus anotaciones en orden. Se recorta a la lista actual porque
 * la formula se lee en vivo y puede haber perdido pasos desde que se completaron.
 */
export function conditioningProgress(
  entries: readonly ExecutionEntryRecord[],
  stepsCount: number,
): ConditioningProgress {
  let completed = 0;
  const responsibles = new Map<number, readonly string[]>();
  for (const entry of entries) {
    if (entry.stepPosition === null || !carriesResponsibles(entry)) continue;
    if (completesStep(entry)) completed = Math.max(completed, entry.stepPosition);
    if (entry.responsibleUserIds !== null) responsibles.set(entry.stepPosition, entry.responsibleUserIds);
  }
  return { completedCount: Math.min(completed, Math.max(0, stepsCount)), responsibles };
}

export function sameResponsibles(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((id) => right.has(id));
}
