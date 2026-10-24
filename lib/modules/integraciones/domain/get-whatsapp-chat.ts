import { formatPhoneInternational, type CustomerCatalog, type CustomerRef } from '@/lib/modules/clientes';
import type { PeopleDirectory } from '@/lib/modules/identity';

import { requireReadPermission, type Actor } from './actor';
import {
  LinkedCustomerNotFoundError,
  ValidationError,
  WhatsappContactNotFoundError,
  WhatsappMessageNotFoundError,
} from './errors';
import { scopeOf, type IntegracionesScope } from './integraciones-scope';
import type { WhatsappConnectionRecord } from './whatsapp-connection';
import {
  attachmentOf,
  customerNameOf,
  failureReasonOf,
  windowOf,
  type WhatsappChat,
  type WhatsappChatMessage,
} from './whatsapp-conversation';
import { chatPageSizeOf, getWhatsappChatSchema, type GetWhatsappChatQuery } from './whatsapp-conversation-input';

import type { WhatsappConnectionRepository } from '../ports/whatsapp-connection-repository';
import type {
  ChatMessageRow,
  ConversationContactRow,
  WhatsappConversationRepository,
} from '../ports/whatsapp-conversation-repository';

export type ChatCustomerDeps = {
  readonly conversations: Pick<WhatsappConversationRepository, 'findContact' | 'findLatestContactOfCustomer'>;
  readonly customers: Pick<CustomerCatalog, 'findAliveRefById'>;
};

export type GetWhatsappChatDeps = ChatCustomerDeps & {
  readonly connections: Pick<WhatsappConnectionRepository, 'findLive'>;
  readonly conversations: Pick<WhatsappConversationRepository, 'listMessages' | 'countUnread'>;
  readonly people: Pick<PeopleDirectory, 'findRefsIncludingDeletedInCompany'>;
  readonly now?: () => Date;
};

export type ChatTarget = GetWhatsappChatQuery['target'];

/** `contact: null` = el cliente aún no tiene conversación en la conexión actual. */
export type ResolvedChatCustomer = {
  readonly customer: CustomerRef;
  readonly contact: ConversationContactRow | null;
};

/**
 * Un contacto sin cliente, con el cliente dado de baja, de otra conexión o de otra empresa es el
 * mismo «no encontrado»: la respuesta no deja distinguir cuál de los casos es.
 */
export async function requireConversationContact(
  deps: ChatCustomerDeps,
  contactId: string,
  connection: WhatsappConnectionRecord | null,
  scope: IntegracionesScope,
): Promise<{ readonly customer: CustomerRef; readonly contact: ConversationContactRow }> {
  if (connection === null) throw new WhatsappContactNotFoundError();
  const contact = await deps.conversations.findContact(contactId, connection.id, scope);
  if (contact === null || contact.customerId === null) throw new WhatsappContactNotFoundError();
  const customer = await deps.customers.findAliveRefById(contact.customerId, scope.companyId);
  if (customer === null) throw new WhatsappContactNotFoundError();
  return { customer, contact };
}

export async function resolveChatCustomer(
  deps: ChatCustomerDeps,
  target: ChatTarget,
  connection: WhatsappConnectionRecord | null,
  scope: IntegracionesScope,
): Promise<ResolvedChatCustomer> {
  if ('contactId' in target) return requireConversationContact(deps, target.contactId, connection, scope);

  const customer = await deps.customers.findAliveRefById(target.customerId, scope.companyId);
  if (customer === null) throw new LinkedCustomerNotFoundError();
  if (connection === null) return { customer, contact: null };
  const contact = await deps.conversations.findLatestContactOfCustomer(customer.id, connection.id, scope);
  return { customer, contact };
}

function messageOf(row: ChatMessageRow, authors: ReadonlyMap<string, string>): WhatsappChatMessage {
  return {
    id: row.id,
    direction: row.direction,
    type: row.type,
    body: row.body,
    attachment: attachmentOf(row.type, row.payload),
    status: row.status,
    errorReason: failureReasonOf(row),
    origin: row.origin,
    sentBy: row.sentById === null ? null : { id: row.sentById, displayName: authors.get(row.sentById) ?? null },
    templateName: row.templateName,
    at: row.at.toISOString(),
  };
}

async function authorsOf(
  deps: GetWhatsappChatDeps,
  rows: readonly ChatMessageRow[],
  companyId: string,
  now: Date,
): Promise<ReadonlyMap<string, string>> {
  const ids = [...new Set(rows.flatMap((row) => (row.sentById === null ? [] : [row.sentById])))];
  if (ids.length === 0) return new Map();
  const refs = await deps.people.findRefsIncludingDeletedInCompany(companyId, ids, now);
  return new Map(refs.map((ref) => [ref.id, ref.displayName]));
}

/** Leer el chat no mueve la marca de lectura: eso lo hace solo `markWhatsappChatRead`. */
export function createGetWhatsappChat(
  deps: GetWhatsappChatDeps,
): (input: unknown, actor: Actor | null | undefined) => Promise<WhatsappChat> {
  return async function getWhatsappChat(input, actor) {
    requireReadPermission(actor);
    const scope = scopeOf(actor);

    const parsed = getWhatsappChatSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const pageSize = chatPageSizeOf(parsed.data.pageSize);
    const now = deps.now?.() ?? new Date();

    const connection = await deps.connections.findLive(scope);
    const { customer, contact } = await resolveChatCustomer(deps, parsed.data.target, connection, scope);
    const customerView = { id: customer.id, name: customerNameOf(customer) };
    if (connection === null || contact === null) {
      return {
        connectionStatus: connection?.status ?? null,
        contact: null,
        customer: customerView,
        window: { open: false, closesAt: null },
        messages: [],
        hasMore: false,
        nextCursor: null,
      };
    }

    // Uno de más para saber si quedan anteriores sin otra consulta.
    const fetched = await deps.conversations.listMessages(
      contact.id,
      connection.id,
      { before: parsed.data.before ?? null, limit: pageSize + 1 },
      scope,
    );
    if (fetched === 'cursor_not_found') throw new WhatsappMessageNotFoundError();
    const hasMore = fetched.length > pageSize;
    const rows = fetched.slice(0, pageSize).reverse();

    const authors = await authorsOf(deps, rows, scope.companyId, now);
    const messages = rows.map((row) => messageOf(row, authors));
    const unreadCount = await deps.conversations.countUnread(contact.id, scope);
    return {
      connectionStatus: connection.status,
      contact: {
        id: contact.id,
        phone: formatPhoneInternational(contact.waId),
        isBlocked: contact.blockedAt !== null,
        unreadCount,
      },
      customer: customerView,
      window: windowOf(contact.lastInboundAt, now),
      messages,
      hasMore,
      nextCursor: hasMore && messages.length > 0 ? messages[0].id : null,
    };
  };
}
