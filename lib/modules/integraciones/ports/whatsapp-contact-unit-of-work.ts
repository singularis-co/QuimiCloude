import type { CustomerPhoneLinks } from './customer-phone-links';
import type { CustomerPhoneOwners } from './customer-phone-owners';
import type { WhatsappContactRepository } from './whatsapp-contact-repository';

/** Todos atados a la misma transacción: el vínculo y los teléfonos del cliente pasan o no pasa nada. */
export type WhatsappContactTransactionScope = {
  readonly contacts: WhatsappContactRepository;
  readonly customerPhones: CustomerPhoneLinks;
  readonly owners: CustomerPhoneOwners;
};

export interface WhatsappContactUnitOfWork {
  run<T>(work: (scope: WhatsappContactTransactionScope) => Promise<T>): Promise<T>;
}
