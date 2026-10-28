import type { GraphFailure } from './graph-failure';

export const TOKEN_INVALID_MESSAGE = 'Revisa el token en Integraciones';
export const WINDOW_CLOSED_REASON =
  'Pasaron más de 24 horas desde el último mensaje del cliente: usa una plantilla.';
export const RATE_LIMITED_REASON = 'Demasiados mensajes, intenta en un momento';
export const REJECTED_WITHOUT_CODE_REASON = 'Meta no aceptó el mensaje. Intenta de nuevo o revisa la conexión.';
export const UNREACHABLE_REASON = 'No se pudo contactar con Meta. Intenta de nuevo en unos minutos.';

const TOKEN_INVALID_CODE = 190;
const WINDOW_CLOSED_CODE = 131047;
const RATE_LIMITED_CODES: readonly number[] = [130429, 131056];

export function rejectedWithCodeReason(code: number): string {
  return `Meta no aceptó el mensaje (código ${code}). Intenta de nuevo o revisa la conexión.`;
}

export type SendFailure = {
  readonly errorCode: string | null;
  readonly errorReason: string;
  readonly effect: 'token_invalid' | null;
};

export function sendFailureReasonOf(code: number): string {
  if (code === TOKEN_INVALID_CODE) return TOKEN_INVALID_MESSAGE;
  if (code === WINDOW_CLOSED_CODE) return WINDOW_CLOSED_REASON;
  if (RATE_LIMITED_CODES.includes(code)) return RATE_LIMITED_REASON;
  return rejectedWithCodeReason(code);
}

// El texto de Meta no se usa: puede repetir el número del destinatario o parte del mensaje.
export function sendFailureOf(failure: GraphFailure): SendFailure {
  if (failure.kind === 'unreachable') return { errorCode: null, errorReason: UNREACHABLE_REASON, effect: null };
  const code = failure.code ?? null;
  if (code === null) return { errorCode: null, errorReason: REJECTED_WITHOUT_CODE_REASON, effect: null };
  return {
    errorCode: String(code),
    errorReason: sendFailureReasonOf(code),
    effect: code === TOKEN_INVALID_CODE ? 'token_invalid' : null,
  };
}
