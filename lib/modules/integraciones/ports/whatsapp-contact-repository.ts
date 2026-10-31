import type { IntegracionesScope } from '../domain/integraciones-scope';
import type { ContactLink } from '../domain/whatsapp-contact-link';
import type { ConversationMode, ConversationModeReason } from '../domain/whatsapp-conversation-mode';

export type WhatsappContactLinkRow = { readonly id: string; readonly waId: string; readonly link: ContactLink };

export type WhatsappContactBlock = { readonly at: Date; readonly by: string };

export type ConversationModeState = {
  readonly mode: ConversationMode;
  readonly reason: ConversationModeReason | null;
  readonly changedAt: Date | null;
  readonly lastMessageAt: Date | null;
};

/** `by` nulo: el cambio lo hizo el sistema. */
export type ConversationModeChange = {
  readonly mode: ConversationMode;
  readonly reason: ConversationModeReason;
  readonly at: Date;
  readonly by: string | null;
};

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
  findMode(id: string, scope: IntegracionesScope): Promise<ConversationModeState | null>;
  /** Solo escribe si el modo actual es distinto del de destino; si ya lo es, no toca nada. */
  setMode(id: string, change: ConversationModeChange, scope: IntegracionesScope): Promise<'changed' | 'unchanged' | 'not_found'>;
}
