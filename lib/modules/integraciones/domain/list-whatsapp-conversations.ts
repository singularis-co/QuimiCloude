import { formatPhoneInternational, type CustomerCatalog, type CustomerRef } from '@/lib/modules/clientes';

import { requireReadPermission, type Actor } from './actor';
import { ValidationError } from './errors';
import { scopeOf } from './integraciones-scope';
import type { WhatsappConnectionStatus } from './whatsapp-connection';
import { customerNameOf, previewOf, type WhatsappConversationItem, type WhatsappConversationList } from './whatsapp-conversation';
import { conversationsPageSizeOf, listWhatsappConversationsSchema } from './whatsapp-conversation-input';

import type { WhatsappConnectionRepository } from '../ports/whatsapp-connection-repository';
import type {
  ConversationRow,
  ConversationSearch,
  WhatsappConversationRepository,
} from '../ports/whatsapp-conversation-repository';

export type ListWhatsappConversationsDeps = {
  readonly connections: Pick<WhatsappConnectionRepository, 'findLive'>;
  readonly conversations: Pick<WhatsappConversationRepository, 'listLinkedCustomerIds' | 'listPage'>;
  readonly customers: Pick<CustomerCatalog, 'findRefsIncludingDeleted' | 'findAliveIdsMatchingName'>;
};

function listOf(
  connectionStatus: WhatsappConnectionStatus | null,
  items: readonly WhatsappConversationItem[],
  total: number,
  page: number,
  pageSize: number,
): WhatsappConversationList {
  return {
    connectionStatus,
    page: { items, total, page, pageSize, totalPages: total === 0 ? 1 : Math.ceil(total / pageSize) },
  };
}

function itemOf(row: ConversationRow, refs: ReadonlyMap<string, CustomerRef>): WhatsappConversationItem | null {
  const ref = row.customerId === null ? undefined : refs.get(row.customerId);
  if (ref === undefined || row.lastMessage === null) return null;
  return {
    contactId: row.id,
    customerId: ref.id,
    customerName: customerNameOf(ref),
    phone: formatPhoneInternational(row.waId),
    isBlocked: row.blockedAt !== null,
    unreadCount: row.unreadCount,
    lastMessage: {
      direction: row.lastMessage.direction,
      type: row.lastMessage.type,
      preview: previewOf(row.lastMessage.body),
      status: row.lastMessage.status,
      at: row.lastMessage.at.toISOString(),
    },
  };
}

/**
 * Los clientes dados de baja se descartan aquí y no en la consulta: la baja es de `clientes`, y sus
 * contactos y mensajes siguen intactos en la base.
 */
export function createListWhatsappConversations(
  deps: ListWhatsappConversationsDeps,
): (input: unknown, actor: Actor | null | undefined) => Promise<WhatsappConversationList> {
  return async function listWhatsappConversations(input, actor) {
    requireReadPermission(actor);
    const scope = scopeOf(actor);

    const parsed = listWhatsappConversationsSchema.safeParse(input ?? {});
    if (!parsed.success) throw new ValidationError();
    const { page, blocked } = parsed.data;
    const pageSize = conversationsPageSizeOf(parsed.data.pageSize);

    const connection = await deps.connections.findLive(scope);
    if (connection === null) return listOf(null, [], 0, page, pageSize);

    const linkedIds = await deps.conversations.listLinkedCustomerIds(connection.id, scope);
    if (linkedIds.length === 0) return listOf(connection.status, [], 0, page, pageSize);
    const aliveRefs = (await deps.customers.findRefsIncludingDeleted(linkedIds, scope.companyId)).filter(
      (ref) => !ref.isDeleted,
    );
    if (aliveRefs.length === 0) return listOf(connection.status, [], 0, page, pageSize);
    const aliveIds = aliveRefs.map((ref) => ref.id);

    const text = parsed.data.search.trim();
    const search: ConversationSearch | null =
      text === ''
        ? null
        : {
            nameMatchIds: await deps.customers.findAliveIdsMatchingName(text, aliveIds, scope.companyId),
            digits: text.replace(/\D/g, ''),
          };

    const { rows, total } = await deps.conversations.listPage(
      {
        connectionId: connection.id,
        customerIds: aliveIds,
        search,
        blocked,
        offset: (page - 1) * pageSize,
        limit: pageSize,
      },
      scope,
    );
    const refs = new Map(aliveRefs.map((ref) => [ref.id, ref]));
    const items = rows.flatMap((row) => {
      const item = itemOf(row, refs);
      return item === null ? [] : [item];
    });
    return listOf(connection.status, items, total, page, pageSize);
  };
}
