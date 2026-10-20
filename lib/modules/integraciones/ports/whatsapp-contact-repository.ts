import type { IntegracionesScope } from '../domain/integraciones-scope';
import type { ContactLink } from '../domain/whatsapp-contact-link';

export type WhatsappContactLinkRow = { readonly id: string; readonly waId: string; readonly link: ContactLink };

export type WhatsappContactBlock = { readonly at: Date; readonly by: string };

/**
 * Solo contactos de la empresa de `scope`: uno de otra empresa no existe. `scope` va al final de
 * cada firma: una llamada que lo omita no compila.
 */
export interface WhatsappContactRepository {
  findById(id: string, scope: IntegracionesScope): Promise<WhatsappContactLinkRow | null>;
  findByWaIds(waIds: readonly string[], scope: IntegracionesScope): Promise<readonly WhatsappContactLinkRow[]>;
  setLink(id: string, link: ContactLink, scope: IntegracionesScope): Promise<void>;
  /** `null` desbloquea. Volver a bloquear un contacto ya bloqueado conserva la marca original. */
  setBlocked(id: string, blocked: WhatsappContactBlock | null, scope: IntegracionesScope): Promise<'ok' | 'not_found'>;
}
