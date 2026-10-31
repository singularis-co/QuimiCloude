import { requireAgentOperatePermission, type Actor } from './actor';
import { WhatsappContactNotFoundError } from './errors';
import { scopeOf } from './integraciones-scope';
import { contactInputError } from './whatsapp-contact-input';
import { conversationModeInputSchema, planModeChange } from './whatsapp-conversation-mode';

import type { WhatsappContactRepository } from '../ports/whatsapp-contact-repository';

export type ReturnWhatsappConversationToAgentDeps = {
  readonly contacts: WhatsappContactRepository;
  readonly now?: () => Date;
};

export type ReturnWhatsappConversationToAgent = (input: unknown, actor: Actor | null | undefined) => Promise<void>;

/** Devolver al agente una conversación que ya lo está no falla ni reescribe motivo, fecha ni autor. */
export function createReturnWhatsappConversationToAgent(
  deps: ReturnWhatsappConversationToAgentDeps,
): ReturnWhatsappConversationToAgent {
  const now = deps.now ?? (() => new Date());

  return async function returnWhatsappConversationToAgent(input, actor) {
    requireAgentOperatePermission(actor);
    const scope = scopeOf(actor);

    const parsed = conversationModeInputSchema.safeParse(input);
    if (!parsed.success) throw contactInputError(parsed.error);
    const { contactId } = parsed.data;

    const state = await deps.contacts.findMode(contactId, scope);
    if (state === null) throw new WhatsappContactNotFoundError();
    if (planModeChange(state.mode, 'AGENT', 'MANUAL') === 'unchanged') return;

    const result = await deps.contacts.setMode(
      contactId,
      { mode: 'AGENT', reason: 'MANUAL', at: now(), by: actor.id },
      scope,
    );
    if (result === 'not_found') throw new WhatsappContactNotFoundError();
  };
}
