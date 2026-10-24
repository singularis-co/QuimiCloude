import { requireReadPermission, type Actor } from './actor';
import { ValidationError, WhatsappMessageNotFoundError } from './errors';
import { requireConversationContact, type ChatCustomerDeps } from './get-whatsapp-chat';
import { scopeOf } from './integraciones-scope';
import { markWhatsappChatReadSchema } from './whatsapp-conversation-input';

import type { WhatsappConnectionRepository } from '../ports/whatsapp-connection-repository';
import type { WhatsappConversationRepository } from '../ports/whatsapp-conversation-repository';

export type MarkWhatsappChatReadDeps = ChatCustomerDeps & {
  readonly connections: Pick<WhatsappConnectionRepository, 'findLive'>;
  readonly conversations: Pick<WhatsappConversationRepository, 'advanceLastRead' | 'countUnread'>;
};

/** La marca es de la conversación, compartida por la empresa, y no se avisa a Meta. */
export function createMarkWhatsappChatRead(
  deps: MarkWhatsappChatReadDeps,
): (input: unknown, actor: Actor | null | undefined) => Promise<{ readonly unreadCount: number }> {
  return async function markWhatsappChatRead(input, actor) {
    requireReadPermission(actor);
    const scope = scopeOf(actor);

    const parsed = markWhatsappChatReadSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    const connection = await deps.connections.findLive(scope);
    const { contact } = await requireConversationContact(deps, parsed.data.contactId, connection, scope);
    const outcome = await deps.conversations.advanceLastRead(contact.id, parsed.data.upToMessageId ?? null, scope);
    if (outcome === 'message_not_found') throw new WhatsappMessageNotFoundError();
    return { unreadCount: await deps.conversations.countUnread(contact.id, scope) };
  };
}
