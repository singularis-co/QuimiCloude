import type { IntegracionesScope } from '../domain/integraciones-scope';
import type { ContactLink } from '../domain/whatsapp-contact-link';
import type { NewOutboundMessage, OutboundContact, OutboundMessageRecord } from '../domain/whatsapp-outbound-message';

/**
 * Los contactos y los mensajes salientes de un envío. Solo filas de la empresa de `scope`: una de
 * otra empresa no existe. `scope` va al final de cada firma: una llamada que lo omita no compila.
 */
export interface WhatsappOutboxRepository {
  findContact(id: string, connectionId: string, scope: IntegracionesScope): Promise<OutboundContact | null>;
  findContactsByWaIds(
    connectionId: string,
    waIds: readonly string[],
    scope: IntegracionesScope,
  ): Promise<readonly OutboundContact[]>;
  /** Crea el contacto si no existe y lo devuelve; dos llamadas a la vez dejan una sola fila. */
  ensureContact(connectionId: string, waId: string, scope: IntegracionesScope): Promise<OutboundContact>;
  linkContact(id: string, link: ContactLink, scope: IntegracionesScope): Promise<void>;
  insertSending(row: NewOutboundMessage, scope: IntegracionesScope): Promise<OutboundMessageRecord>;
  /** `null` si el mensaje no existe o ya no está en `SENDING`: en ese caso no cambia nada. */
  markSent(id: string, wamid: string, scope: IntegracionesScope): Promise<OutboundMessageRecord | null>;
  /** `null` si el mensaje no existe o ya no está en `SENDING`: en ese caso no cambia nada. */
  markFailed(
    id: string,
    errorCode: string | null,
    errorReason: string,
    scope: IntegracionesScope,
  ): Promise<OutboundMessageRecord | null>;
  findOutbound(id: string, scope: IntegracionesScope): Promise<OutboundMessageRecord | null>;
  /** Mueve la fecha del último mensaje solo hacia delante. */
  touchContact(id: string, at: Date, scope: IntegracionesScope): Promise<void>;
}
