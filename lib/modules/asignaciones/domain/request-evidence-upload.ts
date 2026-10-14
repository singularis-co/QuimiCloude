/**
 * El enlace firmado para subir una foto de evidencia desde el navegador. No escribe ninguna fila:
 * la foto cuenta cuando `register-evidence.ts` la registra.
 */
import { z } from 'zod';

import { EvidenceLimitError, EvidenceNotFoundError, ValidationError } from './errors';
import { requireEvidenceAccess, resolveEvidenceTarget, type EvidenceTargetDeps } from './evidence-target';
import { EVIDENCE_PHASES, MAX_EVIDENCE_PER_STEP, buildEvidencePath, stepRequiresEvidence } from './step-evidence';

import type { Actor } from './actor';
import type { EvidenceSignedUpload, EvidenceStorage } from '../ports/evidence-storage';
import type { StepEvidenceRepository } from '../ports/step-evidence-repository';

/** Estricto: ningun campo de la entrada puede elegir la ruta. */
const requestEvidenceUploadSchema = z.strictObject({
  orderId: z.string().uuid(),
  phase: z.enum(EVIDENCE_PHASES),
  stepPosition: z.number().int().min(1),
  replacesEvidenceId: z.string().uuid().optional(),
});

export type RequestEvidenceUploadDeps = EvidenceTargetDeps & {
  readonly evidence: StepEvidenceRepository;
  readonly storage: EvidenceStorage;
};

export type RequestEvidenceUploadResult = EvidenceSignedUpload;

export function createRequestEvidenceUpload(
  deps: RequestEvidenceUploadDeps,
): (actor: Actor | null | undefined, input: unknown) => Promise<RequestEvidenceUploadResult> {
  return async function requestEvidenceUpload(
    actor: Actor | null | undefined,
    input: unknown,
  ): Promise<RequestEvidenceUploadResult> {
    requireEvidenceAccess(actor);

    const parsed = requestEvidenceUploadSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { orderId, phase, stepPosition, replacesEvidenceId } = parsed.data;

    const target = await resolveEvidenceTarget(deps, actor, orderId, phase);
    if (!stepRequiresEvidence(target.steps, stepPosition)) {
      throw new ValidationError(`el paso ${String(stepPosition)} no pide evidencia`);
    }

    if (replacesEvidenceId === undefined) {
      const rows = await deps.evidence.listByOrder(actor.companyId, orderId, phase);
      const inStep = rows.filter((row) => row.stepPosition === stepPosition).length;
      if (inStep >= MAX_EVIDENCE_PER_STEP) throw new EvidenceLimitError();
    } else {
      const replaced = await deps.evidence.findById(actor.companyId, orderId, phase, replacesEvidenceId);
      if (replaced?.stepPosition !== stepPosition) throw new EvidenceNotFoundError();
    }

    return deps.storage.createSignedUpload(buildEvidencePath(actor.companyId, orderId));
  };
}
