/**
 * Registrar una foto ya subida al bucket: desde aqui cuenta. El contenido se comprueba en el
 * servidor, nunca se fia del tipo que declaro el navegador; lo que no pasa se borra del bucket.
 */
import { z } from 'zod';

import {
  EvidenceInvalidFileError,
  EvidenceLimitError,
  EvidenceNotFoundError,
  ValidationError,
} from './errors';
import { describeWarning, removeEvidenceSafely, signStepPhotos, type EvidenceStorageWarning } from './evidence-photos';
import { requireEvidenceAccess, resolveEvidenceTarget, type EvidenceTargetDeps } from './evidence-target';
import { EVIDENCE_PHASES, isEvidencePathOf, stepRequiresEvidence, type StepEvidencePhotoView } from './step-evidence';

import type { Actor } from './actor';
import type { EvidenceStorage } from '../ports/evidence-storage';
import type { NewStepEvidence, StepEvidenceRepository } from '../ports/step-evidence-repository';

import { validateRecipeImage } from '@/lib/modules/recetas';

const registerEvidenceSchema = z.strictObject({
  orderId: z.string().uuid(),
  phase: z.enum(EVIDENCE_PHASES),
  stepPosition: z.number().int().min(1),
  path: z.string().min(1).max(512),
  replacesEvidenceId: z.string().uuid().optional(),
});

export type RegisterEvidenceDeps = EvidenceTargetDeps & {
  readonly evidence: StepEvidenceRepository;
  readonly storage: EvidenceStorage;
};

export type RegisterEvidenceResult = {
  /** Las fotos del paso tras registrar, por `slot`, con URL de lectura firmada. */
  readonly photos: readonly StepEvidencePhotoView[];
  /** Borrados del bucket que fallaron despues de registrar; el registro sigue en pie. */
  readonly warnings: readonly EvidenceStorageWarning[];
};

export function createRegisterEvidence(
  deps: RegisterEvidenceDeps,
): (actor: Actor | null | undefined, input: unknown) => Promise<RegisterEvidenceResult> {
  /** Rechaza lo ya subido: el archivo se borra y el error es el del rechazo, no el del borrado. */
  async function rejectUpload(path: string, toError: (diagnostic?: string) => Error): Promise<never> {
    throw toError(describeWarning(await removeEvidenceSafely(deps.storage, path)));
  }

  return async function registerEvidence(
    actor: Actor | null | undefined,
    input: unknown,
  ): Promise<RegisterEvidenceResult> {
    requireEvidenceAccess(actor);

    const parsed = registerEvidenceSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { orderId, phase, stepPosition, path, replacesEvidenceId } = parsed.data;

    const target = await resolveEvidenceTarget(deps, actor, orderId, phase);
    // La formula pudo cambiar entre pedir el enlace y registrar.
    if (!stepRequiresEvidence(target.steps, stepPosition)) {
      throw new ValidationError(`el paso ${String(stepPosition)} no pide evidencia`);
    }
    if (!isEvidencePathOf(path, actor.companyId, orderId)) {
      throw new ValidationError('la ruta no es de este pedido');
    }

    const replaced =
      replacesEvidenceId === undefined
        ? null
        : await deps.evidence.findById(actor.companyId, orderId, phase, replacesEvidenceId);
    if (replacesEvidenceId !== undefined && replaced?.stepPosition !== stepPosition) {
      return rejectUpload(path, (diagnostic) => new EvidenceNotFoundError(diagnostic));
    }

    const bytes = await deps.storage.download(path);
    if (bytes === null) throw new EvidenceInvalidFileError('no hay nada subido en esa ruta');
    const validation = validateRecipeImage(bytes);
    if (!validation.ok) {
      const { reason } = validation;
      return rejectUpload(
        path,
        (diagnostic) => new EvidenceInvalidFileError(diagnostic === undefined ? reason : `${reason}; ${diagnostic}`),
      );
    }

    const row: NewStepEvidence = {
      companyId: actor.companyId,
      orderId,
      phase,
      stepPosition,
      path,
      contentType: validation.contentType,
      sizeBytes: bytes.byteLength,
      uploadedBy: actor.id,
    };

    const warnings: EvidenceStorageWarning[] = [];
    if (replaced === null) {
      const inserted = await deps.evidence.insert(row);
      if (inserted === 'limit') return rejectUpload(path, (diagnostic) => new EvidenceLimitError(diagnostic));
    } else {
      const outcome = await deps.evidence.replace(replaced.id, row);
      if (outcome === 'not_found') return rejectUpload(path, (diagnostic) => new EvidenceNotFoundError(diagnostic));
      const warning = await removeEvidenceSafely(deps.storage, replaced.path);
      if (warning !== null) warnings.push(warning);
    }

    const rows = await deps.evidence.listByOrder(actor.companyId, orderId, phase);
    return { photos: await signStepPhotos(deps.storage, rows, stepPosition), warnings };
  };
}
