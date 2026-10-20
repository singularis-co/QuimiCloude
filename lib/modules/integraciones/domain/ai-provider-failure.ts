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

/** Los fallos de la cuenta, no del proveedor ni de la red: son los únicos que marcan la conexión. */
export function isAccountFailure(failure: AiProviderFailure): failure is AiProviderAccountFailure {
  return failure.kind === 'rejected_key' || failure.kind === 'quota';
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
      return `${PROBE_FAILURE_PREFIX} tu cuenta no tiene acceso al modelo ${failure.model}.`;
    case 'unreachable':
      return `${PROBE_FAILURE_PREFIX} no respondió a tiempo. Vuelve a probar en unos minutos.`;
    case 'unexpected':
      return `${PROBE_FAILURE_PREFIX} respondió con un error inesperado (${statusText(failure.httpStatus)}).`;
  }
}

/** Solo los fallos de cuenta llegan a la conexión al leer; el resto no la marca. */
export function readingFailureMessage(failure: AiProviderAccountFailure, providerName: string): string {
  const status = statusText(failure.httpStatus);
  return failure.kind === 'rejected_key'
    ? `${providerName} rechazó la key (${status}).`
    : `${providerName} indicó que tu cuenta no tiene cuota o saldo (${status}).`;
}
