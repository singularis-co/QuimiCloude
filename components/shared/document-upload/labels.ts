import { errorMessage, UNEXPECTED_ERROR_CODE, type ErrorCode } from '@/lib/modules/errores';
import type { DocumentFileStatus } from '@/lib/modules/documentos';
import type { StatusTone } from '@/lib/shared/ui/status-tone';

/**
 * La fase del navegador: vive en memoria, muere con la pantalla y no es ninguno de los estados que
 * el modulo persiste.
 */
export type BrowserPhase = 'pending' | 'uploading' | 'uploaded' | 'failed';

export const BROWSER_PHASE_LABELS: Record<BrowserPhase, string> = {
  pending: 'Sin subir',
  uploading: 'Subiendo',
  uploaded: 'Subido',
  failed: 'No se pudo subir',
};

export const BROWSER_PHASE_TONES: Record<BrowserPhase, StatusTone> = {
  pending: 'neutral',
  uploading: 'progress',
  uploaded: 'success',
  failed: 'danger',
};

export const FILE_STATUS_LABELS: Record<DocumentFileStatus, string> = {
  queued: 'En cola',
  processing: 'Procesando',
  done: 'Listo',
  error: 'Error',
};

export const FILE_STATUS_TONES: Record<DocumentFileStatus, StatusTone> = {
  queued: 'neutral',
  processing: 'info',
  done: 'success',
  error: 'danger',
};

/** El texto de un archivo en error sale del catalogo por su `code`, nunca de un mensaje recibido. */
export function fileErrorMessage(code: ErrorCode | null): string {
  return errorMessage(code ?? UNEXPECTED_ERROR_CODE);
}

export const SELECTION_TRIGGER_LABEL = 'Elegir PDFs';
export const SUBMIT_LABEL = 'Subir';
export const CLEAR_LABEL = 'Quitar la selección';
export const RESUME_LABEL = 'Reanudar';
export const UNKNOWN_BATCH_LABEL = 'La tanda ya no está disponible.';
export const REVIEW_LABEL = 'Revisar';

export function tooManyFilesMessage(max: number): string {
  return `Se admiten como mucho ${max} archivos por tanda. Vuelve a elegir.`;
}

export const OPEN_LABEL = 'Subir PDFs';
export const DIALOG_TITLE = 'Subir PDFs';
export const CLOSE_LABEL = 'Cerrar';

export function dialogDescription(max: number): string {
  return `Solo PDF, hasta ${max} archivos por tanda.`;
}

/**
 * `attempts` cuenta entregas ya consumidas; con 0 la primera entrega sigue en camino, y «intento 1
 * de N» es lo mas honesto que se puede decir mientras nadie ha reclamado el archivo.
 */
export function attemptLabel(attempts: number, maxAttempts: number): string {
  return `Intento ${Math.max(1, attempts)} de ${maxAttempts}`;
}

export const PANEL_TITLE = 'Tandas de PDFs';
export const PANEL_BATCH_LABEL = 'Tanda';
export const DISCARD_BATCH_LABEL = 'Descartar';