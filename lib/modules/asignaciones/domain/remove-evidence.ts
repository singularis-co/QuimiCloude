/**
 * Quitar una foto de un paso mientras el pedido sigue en curso para esa fase. La fila se borra
 * primero: desde ese momento ya no cuenta, aunque el archivo no se haya podido borrar del bucket.
 */
import { z } from 'zod';

import { EvidenceNotFoundError, ValidationError } from './errors';
import { removeEvidenceSafely, signStepPhotos, type EvidenceStorageWarning } from './evidence-photos';
import { requireEvidenceAccess, resolveEvidenceTarget, type EvidenceTargetDeps } from './evidence-target';
import { EVIDENCE_PHASES, type StepEvidencePhotoView } from './step-evidence';

import type { Actor } from './actor';
import type { EvidenceStorage } from '../ports/evidence-storage';
import type { StepEvidenceRepository } from '../ports/step-evidence-repository';

const removeEvidenceSchema = z.strictObject({
  orderId: z.string().uuid(),
  phase: z.enum(EVIDENCE_PHASES),
  evidenceId: z.string().uuid(),
});

export type RemoveEvidenceDeps = EvidenceTargetDeps & {
  readonly evidence: StepEvidenceRepository;
  readonly storage: EvidenceStorage;
};

export type RemoveEvidenceResult = {
  readonly stepPosition: number;
  /** Las fotos que le quedan al paso, por `slot`, con URL de lectura firmada. */
  readonly photos: readonly StepEvidencePhotoView[];
  readonly warnings: readonly EvidenceStorageWarning[];
};

export function createRemoveEvidence(
  deps: RemoveEvidenceDeps,
): (actor: Actor | null | undefined, input: unknown) => Promise<RemoveEvidenceResult> {
  return async function removeEvidence(
    actor: Actor | null | undefined,
    input: unknown,
  ): Promise<RemoveEvidenceResult> {
    requireEvidenceAccess(actor);

    const parsed = removeEvidenceSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { orderId, phase, evidenceId } = parsed.data;

    await resolveEvidenceTarget(deps, actor, orderId, phase);

    const removed = await deps.evidence.delete(actor.companyId, orderId, phase, evidenceId);
    if (removed === null) throw new EvidenceNotFoundError();

    const warning = await removeEvidenceSafely(deps.storage, removed.path);
    const rows = await deps.evidence.listByOrder(actor.companyId, orderId, phase);
    return {
      stepPosition: removed.stepPosition,
      photos: await signStepPhotos(deps.storage, rows, removed.stepPosition),
      warnings: warning === null ? [] : [warning],
    };
  };
}
