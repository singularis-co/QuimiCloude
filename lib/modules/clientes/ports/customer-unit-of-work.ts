import type { CustomerPhoneRepository } from './customer-phone-repository';
import type { CustomerWriteRepository } from './customer-write-repository';

/** Recalcula el vinculo de los contactos de esos numeros. Lo implementa otro modulo; `clientes`
 *  solo conoce este puerto. */
export type WhatsappLinkRefresher = {
  refresh(numbers: readonly string[], companyId: string): Promise<void>;
};

export type CustomerTransactionScope = {
  readonly customers: CustomerWriteRepository;
  readonly phones: CustomerPhoneRepository;
  readonly whatsappLinks: WhatsappLinkRefresher;
};

/** Todo lo que `work` escribe se confirma o se deshace junto. */
export interface CustomerUnitOfWork {
  run<T>(work: (scope: CustomerTransactionScope) => Promise<T>): Promise<T>;
}
