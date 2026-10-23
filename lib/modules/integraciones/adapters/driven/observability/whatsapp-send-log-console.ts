/** Escribe en el registro del servidor, no en la respuesta: al navegador no llega nada de esto. */
import type { WhatsappSendFailure, WhatsappSendLog } from '../../../ports/whatsapp-send-log';

/** Etiqueta fija de la línea, localizable con una búsqueda exacta. */
export const WHATSAPP_SEND_FAILED_EVENT = 'whatsapp_send_failed';

/** `escribir` tiene valor por defecto para que el test lo espíe sin tocar `console`. */
export function createWhatsappSendLogConsole(
  escribir: (event: string, data: WhatsappSendFailure) => void = (event, data) => console.warn(event, data),
): WhatsappSendLog {
  return {
    sendFailed({ messageId, diagnostic }: WhatsappSendFailure): void {
      escribir(WHATSAPP_SEND_FAILED_EVENT, { messageId, diagnostic });
    },
  };
}
