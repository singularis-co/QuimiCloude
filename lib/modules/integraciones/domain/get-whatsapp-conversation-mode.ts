import { requireAgentModeReadPermission, type Actor } from './actor';
import { WhatsappContactNotFoundError } from './errors';
import { scopeOf } from './integraciones-scope';
import { contactInputError } from './whatsapp-contact-input';
import { conversationModeInputSchema, type ConversationModeView } from './whatsapp-conversation-mode';

import type { WhatsappContactRepository } from '../ports/whatsapp-contact-repository';

export type GetWhatsappConversationModeDeps = {
  readonly contacts: WhatsappContactRepository;
};

export type GetWhatsappConversationMode = (
  input: unknown,
  actor: Actor | null | undefined,
) => Promise<ConversationModeView>;

export function createGetWhatsappConversationMode(deps: GetWhatsappConversationModeDeps): GetWhatsappConversationMode {
  return async function getWhatsappConversationMode(input, actor) {
    requireAgentModeReadPermission(actor);
    const scope = scopeOf(actor);

    const parsed = conversationModeInputSchema.safeParse(input);
    if (!parsed.success) throw contactInputError(parsed.error);

    const state = await deps.contacts.findMode(parsed.data.contactId, scope);
    if (state === null) throw new WhatsappContactNotFoundError();
    return { mode: state.mode, reason: state.reason, changedAt: state.changedAt };
  };
}
