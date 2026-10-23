/**
 * La única implementación de `WhatsappSendLog` (QC-240 R46, `design.md > 7`): escribe el aviso en
 * el registro del servidor con `console.warn`. Al navegador no llega nada de esto.
 */
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
