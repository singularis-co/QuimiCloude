import { errorMessage, UNEXPECTED_ERROR_CODE, type ErrorCode } from '@/lib/modules/errores';
import type { BatchStatus, DocumentFileStatus } from '@/lib/modules/documentos';
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

/**
 * El texto de un archivo en error sale del catalogo por su `code`, nunca de un mensaje recibido.
 */
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
  const current = Math.min(Math.max(1, attempts), maxAttempts);
  return `Intento ${current} de ${maxAttempts}`;
}

export const PANEL_TITLE = 'Tandas de PDFs';
export const DISCARD_BATCH_LABEL = 'Descartar';

export const READ_ONLY_NOTICE =
  'La subida de PDFs está desactivada. Las tandas que ya enviaste siguen procesándose: ' +
  'puedes revisarlas y descartarlas.';

const TIME_FORMAT = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' });
const DAY_FORMAT = new Intl.DateTimeFormat('es', { day: '2-digit', month: '2-digit' });
const DAY_WITH_YEAR_FORMAT = new Intl.DateTimeFormat('es', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function sameCivilDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** «de hoy, 14:32», «de ayer, 14:32» o «del 15/10, 09:12», por día civil local. */
function batchMoment(rememberedAt: number, now: number): string {
  const at = new Date(rememberedAt);
  const today = new Date(now);
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const time = TIME_FORMAT.format(at);

  if (sameCivilDay(at, today)) return `de hoy, ${time}`;
  if (sameCivilDay(at, yesterday)) return `de ayer, ${time}`;

  const day = at.getFullYear() === today.getFullYear() ? DAY_FORMAT : DAY_WITH_YEAR_FORMAT;
  return `del ${day.format(at)}, ${time}`;
}

function fileCountLabel(fileCount: number): string {
  return fileCount === 1 ? '1 archivo' : `${fileCount} archivos`;
}

export function batchLabel(rememberedAt: number, fileCount: number | null, now: number): string {
  const label = `Tanda ${batchMoment(rememberedAt, now)}`;
  return fileCount === null ? label : `${label} · ${fileCountLabel(fileCount)}`;
}

export function discardBatchLabel(rememberedAt: number, now: number): string {
  return `Descartar la tanda ${batchMoment(rememberedAt, now)}`;
}

export function resumeBatchLabel(rememberedAt: number, now: number): string {
  return `Reanudar la tanda ${batchMoment(rememberedAt, now)}`;
}

function isFinished(status: DocumentFileStatus): boolean {
  return status === 'done' || status === 'error';
}

/** Lo que el panel sabe de una tanda recordada: la ultima foto del sondeo, si la hay. */
export type BatchSummaryInput = {
  readonly status: BatchStatus | null;
  readonly missing: boolean;
};

/**
 * Una tanda sin foto todavia cuenta como en curso: no consta que haya terminado. Una tanda que ya
 * no existe no cuenta en ninguna parte.
 */
export function batchesSummary(batches: readonly BatchSummaryInput[]): string {
  const known = batches.filter((batch) => !batch.missing);
  const inProgress = known.filter(
    ({ status }) => status === null || status.files.some((file) => !isFinished(file.status)),
  ).length;
  const withErrors = known.filter(
    ({ status }) => status !== null && status.files.some((file) => file.status === 'error'),
  ).length;

  const parts = [
    inProgress > 0 ? `${inProgress} en curso` : null,
    withErrors > 0 ? `${withErrors} con errores` : null,
  ].filter((part) => part !== null);
  return parts.length === 0 ? 'Todas terminadas' : parts.join(' · ');
}
