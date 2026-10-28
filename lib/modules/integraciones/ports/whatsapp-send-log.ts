/**
 * Un puerto y no un `console.warn`: el dominio no conoce el mundo exterior, y la acción que
 * responde al navegador nunca ve el diagnóstico. Solo el id y el diagnóstico interno: nunca el
 * texto de Meta, el mensaje, los valores, el número ni el token.
 */
export type WhatsappSendFailure = {
  readonly messageId: string;
  readonly diagnostic: string;
};

export interface WhatsappSendLog {
  /** `void` a propósito: registrar es el mejor esfuerzo y no cambia el resultado del envío. */
  sendFailed(failure: WhatsappSendFailure): void;
}
