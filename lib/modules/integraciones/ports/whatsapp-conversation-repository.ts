import type { IntegracionesScope } from '../domain/integraciones-scope';
import type {
  WhatsappMessageDirection,
  WhatsappMessageOrigin,
  WhatsappMessageStatus,
  WhatsappMessageType,
} from '../domain/whatsapp-message';

export type ConversationContactRow = {
  readonly id: string;
  readonly waId: string;
  readonly customerId: string | null;
  readonly blockedAt: Date | null;
  readonly lastInboundAt: Date | null;
};

export type ConversationLastMessage = {
  readonly direction: WhatsappMessageDirection;
  readonly type: WhatsappMessageType;
  readonly body: string | null;
  readonly status: WhatsappMessageStatus;
  readonly at: Date;
};

export type ConversationRow = ConversationContactRow & {
  readonly unreadCount: number;
  readonly lastMessage: ConversationLastMessage | null;
};

export type ChatMessageRow = {
  readonly id: string;
  readonly direction: WhatsappMessageDirection;
  readonly type: WhatsappMessageType;
  readonly body: string | null;
  readonly payload: unknown;
  readonly status: WhatsappMessageStatus;
  readonly errorCode: string | null;
  readonly errorReason: string | null;
  readonly origin: WhatsappMessageOrigin | null;
  readonly sentById: string | null;
  readonly templateName: string | null;
  readonly at: Date;
};

export type ConversationBlockedFilter = 'all' | 'blocked' | 'not_blocked';

/** Coincide quien está en `nameMatchIds` o cuyo número contiene `digits`; `digits` vacío no filtra por número. */
export type ConversationSearch = {
  readonly nameMatchIds: readonly string[];
  readonly digits: string;
};

export type ConversationPageQuery = {
  readonly connectionId: string;
  readonly customerIds: readonly string[];
  readonly search: ConversationSearch | null;
  readonly blocked: ConversationBlockedFilter;
  readonly offset: number;
  readonly limit: number;
};

export type ConversationMessagesPage = { readonly before: string | null; readonly limit: number };

/**
 * Solo filas de la empresa de `scope`: una de otra empresa no existe. `scope` va al final de cada
 * firma: una llamada que lo omita no compila. La hora de un mensaje es la de Meta si la tiene y, si
 * no, la de guardado.
 */
export interface WhatsappConversationRepository {
  /** Clientes distintos de los contactos de la conexión que tienen al menos un mensaje. */
  listLinkedCustomerIds(connectionId: string, scope: IntegracionesScope): Promise<readonly string[]>;
  /** Por la hora del último mensaje, de la más reciente a la más antigua; a igual hora, por id de contacto. */
  listPage(
    query: ConversationPageQuery,
    scope: IntegracionesScope,
  ): Promise<{ readonly rows: readonly ConversationRow[]; readonly total: number }>;
  findContact(id: string, connectionId: string, scope: IntegracionesScope): Promise<ConversationContactRow | null>;
  findLatestContactOfCustomer(
    customerId: string,
    connectionId: string,
    scope: IntegracionesScope,
  ): Promise<ConversationContactRow | null>;
  /** Del más reciente al más antiguo; con `before`, solo los anteriores a ese mensaje. */
  listMessages(
    contactId: string,
    connectionId: string,
    page: ConversationMessagesPage,
    scope: IntegracionesScope,
  ): Promise<readonly ChatMessageRow[] | 'cursor_not_found'>;
  countUnread(contactId: string, scope: IntegracionesScope): Promise<number>;
  /** Sin `upToMessageId`, hasta el último mensaje del contacto. La marca nunca retrocede. */
  advanceLastRead(
    contactId: string,
    upToMessageId: string | null,
    scope: IntegracionesScope,
  ): Promise<'ok' | 'message_not_found'>;
}
