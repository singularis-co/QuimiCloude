import { compressImage } from '@/components/shared/compress-image';
import { isAcceptedType, type UploadableFileType } from '@/components/shared/file-types';
import type { EvidencePhase, StepEvidencePhotoView } from '@/lib/modules/asignaciones';
import { errorMessage, UNEXPECTED_ERROR_CODE, type ErrorState } from '@/lib/modules/errores';
import { MAX_IMAGE_BYTES } from '@/lib/modules/recetas';

export const EVIDENCE_ACCEPTED_TYPES: readonly UploadableFileType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const EVIDENCE_MAX_DIMENSION = 1600;

export const UPLOAD_EVIDENCE_TEXTS = {
  invalidType: 'No se pudo subir: no es una foto JPG, PNG ni WebP. Elige otra foto.',
  tooLarge: 'No se pudo subir: pesa más de 5 MB. Elige otra foto.',
} as const;

export type EvidenceUploadTarget = {
  readonly orderId: string;
  readonly phase: EvidencePhase;
  readonly stepPosition: number;
  readonly replacesEvidenceId?: string;
};

type ActionError = ErrorState;

export type RequestEvidenceUpload = (
  input: EvidenceUploadTarget,
) => Promise<
  { status: 'success'; data: { path: string; uploadUrl: string; token: string } } | ActionError
>;

export type RegisterEvidence = (
  input: EvidenceUploadTarget & { readonly path: string },
) => Promise<{ status: 'success'; data: { photos: readonly StepEvidencePhotoView[] } } | ActionError>;

export type UploadEvidenceStage = 'file' | 'request' | 'upload' | 'register';

export type UploadEvidenceResult =
  | { readonly status: 'success'; readonly photos: readonly StepEvidencePhotoView[] }
  | {
      readonly status: 'error';
      readonly stage: UploadEvidenceStage;
      readonly message: string;
      /** El rechazo del servidor, si lo hubo; el resto de fallos no trae uno. */
      readonly error?: ActionError;
    };

export type UploadEvidenceOptions = {
  readonly requestUpload: RequestEvidenceUpload;
  readonly register: RegisterEvidence;
  /** Porcentaje entero de 0 a 100 de los bytes enviados al almacenamiento. */
  readonly onProgress?: (percent: number) => void;
};

const UNEXPECTED_MESSAGE = errorMessage(UNEXPECTED_ERROR_CODE);

function fail(
  stage: UploadEvidenceStage,
  message: string,
  error?: ActionError,
): UploadEvidenceResult {
  return error === undefined
    ? { status: 'error', stage, message }
    : { status: 'error', stage, message, error };
}

/**
 * `PUT` del archivo al enlace firmado. Con `XMLHttpRequest` y no `fetch`: solo
 * `xhr.upload.onprogress` informa de los bytes enviados.
 */
export function putWithProgress(
  uploadUrl: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('content-type', file.type);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.onabort = () => resolve(false);
    xhr.ontimeout = () => resolve(false);
    xhr.send(file);
  });
}

/**
 * Comprime, pide el enlace firmado, sube los bytes directamente al almacenamiento y pide
 * registrar la foto. Las acciones solo reciben datos del destino y la ruta, nunca el archivo.
 * Se comprime antes de pedir el enlace para que un archivo inválido no llegue al servidor.
 */
export async function uploadEvidence(
  file: File,
  target: EvidenceUploadTarget,
  { requestUpload, register, onProgress }: UploadEvidenceOptions,
): Promise<UploadEvidenceResult> {
  if (!isAcceptedType(file.type, EVIDENCE_ACCEPTED_TYPES)) {
    return fail('file', UPLOAD_EVIDENCE_TEXTS.invalidType);
  }

  const compressed = await compressImage(file, {
    maxBytes: MAX_IMAGE_BYTES,
    maxDimension: EVIDENCE_MAX_DIMENSION,
    accept: EVIDENCE_ACCEPTED_TYPES,
  });
  if (!compressed.ok || compressed.file.size > MAX_IMAGE_BYTES) {
    return fail('file', UPLOAD_EVIDENCE_TEXTS.tooLarge);
  }

  const destination = {
    orderId: target.orderId,
    phase: target.phase,
    stepPosition: target.stepPosition,
    ...(target.replacesEvidenceId === undefined
      ? {}
      : { replacesEvidenceId: target.replacesEvidenceId }),
  };

  let link: Awaited<ReturnType<RequestEvidenceUpload>>;
  try {
    link = await requestUpload(destination);
  } catch {
    return fail('request', UNEXPECTED_MESSAGE);
  }
  if (link.status !== 'success') return fail('request', link.message, link);

  onProgress?.(0);
  const uploaded = await putWithProgress(link.data.uploadUrl, compressed.file, (percent) =>
    onProgress?.(percent),
  );
  if (!uploaded) return fail('upload', UNEXPECTED_MESSAGE);

  let registered: Awaited<ReturnType<RegisterEvidence>>;
  try {
    registered = await register({ ...destination, path: link.data.path });
  } catch {
    return fail('register', UNEXPECTED_MESSAGE);
  }
  if (registered.status !== 'success') return fail('register', registered.message, registered);

  return { status: 'success', photos: registered.data.photos };
}
