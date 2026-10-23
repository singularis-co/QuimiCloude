/**
 * El registro del servidor cuando Meta rechaza un envío o no responde (QC-240 R46, `design.md > 7`).
 *
 * Un puerto y no un `console.warn` en el dominio: el dominio no conoce el mundo exterior y R46 solo
 * se prueba si el test puede espiar la llamada. Mismo patrón que `identity/ports/session-check-log.ts`.
 *
 * La firma solo admite el id del mensaje y el diagnóstico interno (`Graph enviar mensaje: <kind>;
 * code=<n>; subcode=<n>`). Nunca el texto de Meta, el mensaje, los valores, el número ni el token.
 */
export type WhatsappSendFailure = {
  readonly messageId: string;
  readonly diagnostic: string;
};

export interface WhatsappSendLog {
  /** `void` a propósito: registrar es el mejor esfuerzo y no cambia el resultado del envío. */
  sendFailed(failure: WhatsappSendFailure): void;
}
