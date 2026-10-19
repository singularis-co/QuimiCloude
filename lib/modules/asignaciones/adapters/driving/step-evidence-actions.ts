'use server';

/**
 * Las tres Server Actions de las fotos de evidencia por paso. Esta capa no decide nada: resuelve
 * el actor, llama al caso de uso y traduce el error por su `code`. Los bytes de la foto nunca
 * pasan por aqui: el navegador los sube con el enlace firmado y luego pide registrarlos.
 *
 * Importado por su ruta exacta: un `'use server'` en el barrel lo volveria inimportable desde un
 * componente de cliente.
 */

import { asignaciones, identity, observabilidad } from '@/lib/composition';
import { createErrorStateTranslator, type ErrorState } from '@/lib/modules/errores';
import {
  AsignacionesError,
  type Actor,
  type EvidencePhase,
  type EvidenceStorageWarning,
  type StepEvidencePhotoView,
} from '@/lib/modules/asignaciones';
import { forModule } from '@/lib/shared/observability/logger';
import { runInRequestScope } from '@/lib/shared/request-scope';

const toErrorState = createErrorStateTranslator(
  AsignacionesError,
  observabilidad.readRequestIdHeader,
);

const log = forModule('asignaciones');

/** El actor, de las dos caras de la sesion, compartiendo una sola lectura por peticion. */
async function currentActor(): Promise<Actor | null> {
  const [sessionUser, sessionContext] = await runInRequestScope(() =>
    Promise.all([identity.getSessionUser(), identity.getSessionContext()]),
  );
  if (sessionUser === null || sessionContext === null) return null;
  return {
    id: sessionUser.id,
    companyId: sessionContext.companyId,
    permissions: sessionUser.permissions,
  };
}

/** La foto ya cuenta aunque el archivo viejo siga en el bucket: se registra y no se devuelve. */
function logStorageWarnings(warnings: readonly EvidenceStorageWarning[]): void {
  for (const warning of warnings) {
    log.warn('evidence_storage_cleanup_failed', {
      operation: warning.operation,
      path: warning.path,
      message: warning.message,
    });
  }
}

export type RequestEvidenceUploadInput = {
  readonly orderId: string;
  readonly phase: EvidencePhase;
  readonly stepPosition: number;
  readonly replacesEvidenceId?: string;
};

export type RequestEvidenceUploadActionResult =
  | { status: 'success'; data: { path: string; uploadUrl: string; token: string } }
  | ErrorState;

/** El enlace firmado para subir una foto. No escribe nada: la foto cuenta al registrarla. */
export async function requestEvidenceUploadAction(
  input: RequestEvidenceUploadInput,
): Promise<RequestEvidenceUploadActionResult> {
  const actor = await currentActor();

  try {
    const { path, uploadUrl, token } = await asignaciones.requestEvidenceUpload(actor, input);
    return { status: 'success', data: { path, uploadUrl, token } };
  } catch (error) {
    return toErrorState(error);
  }
}

export type RegisterEvidenceInput = {
  readonly orderId: string;
  readonly phase: EvidencePhase;
  readonly stepPosition: number;
  readonly path: string;
  readonly replacesEvidenceId?: string;
};

export type StepEvidencePhotosActionResult =
  | { status: 'success'; data: { photos: readonly StepEvidencePhotoView[] } }
  | ErrorState;

/** Registra la foto ya subida; desde aqui cuenta. Devuelve las fotos del paso. */
export async function registerEvidenceAction(
  input: RegisterEvidenceInput,
): Promise<StepEvidencePhotosActionResult> {
  const actor = await currentActor();

  try {
    const { photos, warnings } = await asignaciones.registerEvidence(actor, input);
    logStorageWarnings(warnings);
    return { status: 'success', data: { photos } };
  } catch (error) {
    return toErrorState(error);
  }
}

export type RemoveEvidenceInput = {
  readonly orderId: string;
  readonly phase: EvidencePhase;
  readonly evidenceId: string;
};

/** Quita una foto del paso. Devuelve las que le quedan. */
export async function removeEvidenceAction(
  input: RemoveEvidenceInput,
): Promise<StepEvidencePhotosActionResult> {
  const actor = await currentActor();

  try {
    const { photos, warnings } = await asignaciones.removeEvidence(actor, input);
    logStorageWarnings(warnings);
    return { status: 'success', data: { photos } };
  } catch (error) {
    return toErrorState(error);
  }
}
