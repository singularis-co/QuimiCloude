import { requireCustomerLinkPermission, type Actor } from './actor';
import {
  LinkedCustomerNotFoundError,
  WhatsappContactNotFoundError,
  WhatsappContactNumberInvalidError,
} from './errors';
import { scopeOf } from './integraciones-scope';
import { createRefreshWhatsappContactLinks } from './refresh-whatsapp-contact-links';
import { contactInputError, linkWhatsappContactSchema } from './whatsapp-contact-input';

import type { WhatsappContactUnitOfWork } from '../ports/whatsapp-contact-unit-of-work';

export type LinkWhatsappContactDeps = {
  readonly unitOfWork: WhatsappContactUnitOfWork;
  readonly now?: () => Date;
};

export type LinkWhatsappContact = (input: unknown, actor: Actor | null | undefined) => Promise<void>;

/** El número del contacto entra en los teléfonos del cliente, así que el vínculo sigue a ese teléfono. */
export function createLinkWhatsappContact(deps: LinkWhatsappContactDeps): LinkWhatsappContact {
  const now = deps.now ?? (() => new Date());

  return async function linkWhatsappContact(input, actor) {
    requireCustomerLinkPermission(actor);
    const scope = scopeOf(actor);

    const parsed = linkWhatsappContactSchema.safeParse(input);
    if (!parsed.success) throw contactInputError(parsed.error);
    const { contactId, customerId } = parsed.data;
    const at = now();

    await deps.unitOfWork.run(async ({ contacts, customerPhones, owners }) => {
      const contact = await contacts.findById(contactId, scope);
      if (contact === null) throw new WhatsappContactNotFoundError();

      const added = await customerPhones.addWaId(customerId, contact.waId, actor.id, at, scope.companyId);
      if (added === 'customer_not_found') throw new LinkedCustomerNotFoundError();
      if (added === 'invalid_number') throw new WhatsappContactNumberInvalidError();

      await contacts.setLink(contact.id, { customerId, linkedBy: actor.id }, scope);
      await createRefreshWhatsappContactLinks({ contacts, owners })(added.numbers, scope);
    });
  };
}
