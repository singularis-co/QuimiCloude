export type AiProviderFailureKind =
  | 'rejected_key'
  | 'quota'
  | 'model_unavailable'
  | 'unreachable'
  | 'unexpected';

/**
 * Solo el tipo, el código HTTP y el modelo: el texto libre del proveedor no entra, así que ningún
 * mensaje compuesto puede arrastrar la key ni lo que el proveedor diga de ella.
 */
export type AiProviderFailure =
  | {
      readonly kind: 'model_unavailable';
      readonly httpStatus: number | null;
      readonly model: string;
    }
  | {
      readonly kind: Exclude<AiProviderFailureKind, 'model_unavailable'>;
      readonly httpStatus: number | null;
      readonly model: null;
    };

export type AiProviderAccountFailure = AiProviderFailure & { readonly kind: 'rejected_key' | 'quota' };

export type AiProviderProbeResult =
  | { readonly ok: true; readonly elapsedMs: number }
  | { readonly ok: false; readonly failure: AiProviderFailure };

export const PROBE_FAILURE_PREFIX = 'Error con tu proveedor:';
export const UNREADABLE_KEY_MESSAGE = 'No se pudo leer la key guardada. Vuelve a escribirla.';
export const READING_FAILURE_PREFIX = 'La última lectura falló: ';
const MODEL_UNAVAILABLE_NOTICE_TAIL = 'Elige otro modelo para volver a leer fórmulas y catálogos en PDF.';

/** Los fallos de la cuenta, no del proveedor ni de la red. */
export function isAccountFailure(failure: AiProviderFailure): failure is AiProviderAccountFailure {
  return failure.kind === 'rejected_key' || failure.kind === 'quota';
}

/** La red o un error inesperado no dicen nada de la key ni del modelo: no marcan la conexión. */
export function marksConnection(failure: AiProviderFailure): boolean {
  return isAccountFailure(failure) || failure.kind === 'model_unavailable';
}

function statusText(httpStatus: number | null): string {
  return httpStatus === null ? 'sin código' : String(httpStatus);
}

export function probeFailureMessage(failure: AiProviderFailure): string {
  switch (failure.kind) {
    case 'rejected_key':
      return `${PROBE_FAILURE_PREFIX} la key fue rechazada. Revísala y vuelve a probar.`;
    case 'quota':
      return `${PROBE_FAILURE_PREFIX} tu cuenta no tiene cuota o saldo disponible.`;
    case 'model_unavailable':
      return `${PROBE_FAILURE_PREFIX} el modelo ${failure.model} ya no está disponible.`;
    case 'unreachable':
      return `${PROBE_FAILURE_PREFIX} no respondió a tiempo. Vuelve a probar en unos minutos.`;
    case 'unexpected':
      return `${PROBE_FAILURE_PREFIX} respondió con un error inesperado (${statusText(failure.httpStatus)}).`;
  }
}

export function readingFailureMessage(failure: AiProviderAccountFailure, providerName: string): string {
  const status = statusText(failure.httpStatus);
  return failure.kind === 'rejected_key'
    ? `${providerName} rechazó la key (${status}).`
    : `${providerName} indicó que tu cuenta no tiene cuota o saldo (${status}).`;
}

export function modelUnavailableNotice(model: string, providerName: string, chosen: boolean): string {
  const which = chosen ? `El modelo ${model} que elegiste` : `El modelo ${model}`;
  return `${which} ya no está disponible en ${providerName}. ${MODEL_UNAVAILABLE_NOTICE_TAIL}`;
}

/** Se reconoce por el texto que compone este módulo, con o sin el prefijo de la lectura. */
export function isModelUnavailableNotice(lastError: string | null): boolean {
  if (lastError === null) return false;
  const notice = lastError.startsWith(READING_FAILURE_PREFIX)
    ? lastError.slice(READING_FAILURE_PREFIX.length)
    : lastError;
  return (
    notice.startsWith('El modelo ') &&
    notice.includes(' ya no está disponible en ') &&
    notice.endsWith(`. ${MODEL_UNAVAILABLE_NOTICE_TAIL}`)
  );
}

const STATUS_SLOT = '\u0000';
const STATUS_TEXT = /^(?:\d+|sin código)$/;

/** El texto de la lectura lleva el código HTTP: se compara el resto exacto y el hueco solo admite un código. */
function matchesWithStatus(text: string, template: string): boolean {
  const [before, after] = template.split(STATUS_SLOT) as [string, string];
  if (!text.startsWith(before) || !text.endsWith(after)) return false;
  if (text.length < before.length + after.length) return false;
  return STATUS_TEXT.test(text.slice(before.length, text.length - after.length));
}

/** Key rechazada o sin cuota, tal como la escriben «Probar conexión» y la lectura en `lastError`. */
export function isAccountFailureNotice(lastError: string | null, providerName: string): boolean {
  if (lastError === null) return false;
  const kinds = ['rejected_key', 'quota'] as const;
  return kinds.some((kind) => {
    if (lastError === probeFailureMessage({ kind, httpStatus: null, model: null })) return true;
    const reading = READING_FAILURE_PREFIX + readingFailureMessage({ kind, httpStatus: null, model: null }, providerName);
    return matchesWithStatus(lastError, reading.replace('(sin código)', `(${STATUS_SLOT})`));
  });
}
