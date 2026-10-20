import { requireCustomerLinkPermission, type Actor } from './actor';
import { WhatsappContactNotFoundError } from './errors';
import { scopeOf } from './integraciones-scope';
import { createRefreshWhatsappContactLinks } from './refresh-whatsapp-contact-links';
import { contactInputError, unlinkWhatsappContactSchema } from './whatsapp-contact-input';

import type { WhatsappContactUnitOfWork } from '../ports/whatsapp-contact-unit-of-work';

export type UnlinkWhatsappContactDeps = {
  readonly unitOfWork: WhatsappContactUnitOfWork;
  readonly now?: () => Date;
};

export type UnlinkWhatsappContact = (input: unknown, actor: Actor | null | undefined) => Promise<void>;

/**
 * Quita también el número de los teléfonos del cliente: si lo conservara, la regla volvería a
 * vincular el contacto al mismo cliente en el siguiente mensaje.
 */
export function createUnlinkWhatsappContact(deps: UnlinkWhatsappContactDeps): UnlinkWhatsappContact {
  const now = deps.now ?? (() => new Date());

  return async function unlinkWhatsappContact(input, actor) {
    requireCustomerLinkPermission(actor);
    const scope = scopeOf(actor);

    const parsed = unlinkWhatsappContactSchema.safeParse(input);
    if (!parsed.success) throw contactInputError(parsed.error);
    const { contactId } = parsed.data;
    const at = now();

    await deps.unitOfWork.run(async ({ contacts, customerPhones, owners }) => {
      const contact = await contacts.findById(contactId, scope);
      if (contact === null) throw new WhatsappContactNotFoundError();

      const customerId = contact.link.customerId;
      if (customerId === null) return;

      const removed = await customerPhones.removeWaId(customerId, contact.waId, actor.id, at, scope.companyId);
      await contacts.setLink(contact.id, { customerId: null, linkedBy: null }, scope);
      await createRefreshWhatsappContactLinks({ contacts, owners })(removed.numbers, scope);
    });
  };
}
