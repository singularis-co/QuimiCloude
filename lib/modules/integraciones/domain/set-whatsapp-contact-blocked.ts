import { requireCustomerLinkPermission, type Actor } from './actor';
import { WhatsappContactNotFoundError } from './errors';
import { scopeOf } from './integraciones-scope';
import { contactInputError, setWhatsappContactBlockedSchema } from './whatsapp-contact-input';

import type { WhatsappContactRepository } from '../ports/whatsapp-contact-repository';

export type SetWhatsappContactBlockedDeps = {
  readonly contacts: WhatsappContactRepository;
  readonly now?: () => Date;
};

export type SetWhatsappContactBlocked = (input: unknown, actor: Actor | null | undefined) => Promise<void>;

/** Sin unidad de trabajo: solo escribe el contacto. Desbloquear no recupera nada: lo descartado nunca se guardó. */
export function createSetWhatsappContactBlocked(deps: SetWhatsappContactBlockedDeps): SetWhatsappContactBlocked {
  const now = deps.now ?? (() => new Date());

  return async function setWhatsappContactBlocked(input, actor) {
    requireCustomerLinkPermission(actor);
    const scope = scopeOf(actor);

    const parsed = setWhatsappContactBlockedSchema.safeParse(input);
    if (!parsed.success) throw contactInputError(parsed.error);
    const { contactId, blocked } = parsed.data;

    const result = await deps.contacts.setBlocked(contactId, blocked ? { at: now(), by: actor.id } : null, scope);
    if (result === 'not_found') throw new WhatsappContactNotFoundError();
  };
}
