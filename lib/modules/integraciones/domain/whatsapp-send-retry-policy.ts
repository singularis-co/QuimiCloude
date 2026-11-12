import type { GraphFailure } from './graph-failure';
import { RATE_LIMITED_CODES } from './whatsapp-send-failure';

/** Un `QUEUED` que no cambió en este plazo se da por perdido en la cola y se vuelve a publicar. */
export const QUEUED_STALE_MS = 5 * 60 * 1000;

/** Un `SENDING` que no cambió en este plazo se da por colgado: no se sabe si Meta lo recibió. */
export const SENDING_STUCK_MS = 10 * 60 * 1000;

export const SENDING_STUCK_REASON =
  'No se pudo confirmar si el mensaje llegó. Revisa con el cliente antes de volver a enviarlo.';
export const RETRIES_EXHAUSTED_REASON = 'No se pudo enviar después de varios intentos.';
export const NOT_DELIVERABLE_REASON =
  'No se envió: la conexión de WhatsApp no estaba activa o el contacto no estaba disponible.';

/** La primera entrega más los reintentos de la cola. */
export function maxAttemptsOf(maxRetries: number): number {
  return 1 + maxRetries;
}

/**
 * Un 5xx de Meta y un 2xx sin `wamid` ya llegan como `unreachable` desde el cliente de Graph, por
 * eso aquí no se mira el estado HTTP.
 */
export function isTemporarySendFailure(failure: GraphFailure): boolean {
  if (failure.kind === 'unreachable') return true;
  const code = failure.code ?? null;
  return code !== null && RATE_LIMITED_CODES.includes(code);
}
