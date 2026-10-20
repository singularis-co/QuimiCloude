import { waIdCandidates } from '@/lib/modules/clientes';

import { resolveContactLink, sameContactLink } from './whatsapp-contact-link';

import type { IntegracionesScope } from './integraciones-scope';
import type { CustomerPhoneOwners } from '../ports/customer-phone-owners';
import type { WhatsappContactRepository } from '../ports/whatsapp-contact-repository';

export type RefreshWhatsappContactLinksDeps = {
  readonly contacts: WhatsappContactRepository;
  readonly owners: CustomerPhoneOwners;
};

export type RefreshWhatsappContactLinks = (
  numbers: readonly string[],
  scope: IntegracionesScope,
) => Promise<void>;

/** `numbers`: los números que un cambio de teléfonos añadió o quitó a un cliente. */
export function createRefreshWhatsappContactLinks(
  deps: RefreshWhatsappContactLinksDeps,
): RefreshWhatsappContactLinks {
  return async function refreshWhatsappContactLinks(numbers, scope) {
    if (numbers.length === 0) return;

    const candidates = [...new Set(numbers.flatMap((number) => waIdCandidates(number)))];
    const contacts = await deps.contacts.findByWaIds(candidates, scope);

    for (const contact of contacts) {
      const owners = await deps.owners.ownersOf(contact.waId, scope.companyId);
      const next = resolveContactLink(contact.link, owners);
      if (!sameContactLink(next, contact.link)) {
        await deps.contacts.setLink(contact.id, next, scope);
      }
    }
  };
}
