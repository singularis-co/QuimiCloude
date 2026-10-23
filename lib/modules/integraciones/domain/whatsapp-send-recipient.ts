import { waIdCandidates } from '@/lib/modules/clientes';

import {
  LinkedCustomerNotFoundError,
  WhatsappContactBlockedError,
  WhatsappContactLinkedElsewhereError,
  WhatsappContactNotFoundError,
  WhatsappCustomerWithoutPhoneError,
  WhatsappRecipientNotCustomerError,
} from './errors';
import type { IntegracionesScope } from './integraciones-scope';
import type { OutboundContact } from './whatsapp-outbound-message';
import type { WhatsappSendRecipient } from './whatsapp-send-input';

import type { CustomerPhoneLinks } from '../ports/customer-phone-links';
import type { WhatsappOutboxRepository } from '../ports/whatsapp-outbox-repository';

export type WhatsappSendRecipientDeps = {
  readonly outbox: Pick<WhatsappOutboxRepository, 'findContact' | 'findContactsByWaIds' | 'ensureContact' | 'linkContact'>;
  readonly customerPhones: Pick<CustomerPhoneLinks, 'mainPhoneOf' | 'isCustomerAlive'>;
};

export type ResolvedRecipient = { readonly contact: OutboundContact; readonly customerId: string };

export type RecipientContext = {
  readonly connectionId: string;
  readonly actorId: string;
  readonly scope: IntegracionesScope;
};

export async function recipientByContact(
  deps: WhatsappSendRecipientDeps,
  contactId: string,
  ctx: RecipientContext,
): Promise<ResolvedRecipient> {
  const contact = await deps.outbox.findContact(contactId, ctx.connectionId, ctx.scope);
  if (contact === null) throw new WhatsappContactNotFoundError();
  const { customerId } = contact;
  if (customerId === null) throw new WhatsappRecipientNotCustomerError();
  if (!(await deps.customerPhones.isCustomerAlive(customerId, ctx.scope.companyId))) {
    throw new WhatsappRecipientNotCustomerError();
  }
  if (contact.blockedAt !== null) throw new WhatsappContactBlockedError();
  return { contact, customerId };
}

function pickContactFor(customerId: string, candidates: readonly OutboundContact[]): OutboundContact | null {
  const own = candidates.find((contact) => contact.customerId === customerId);
  if (own !== undefined) return own;
  const free = candidates.find((contact) => contact.customerId === null);
  if (free !== undefined) return free;
  if (candidates.length > 0) throw new WhatsappContactLinkedElsewhereError();
  return null;
}

/**
 * El vínculo es manual: el usuario eligió al cliente, y así un recálculo por un número compartido
 * no lo deshace. Se escribe antes del mensaje, aunque el envío falle después.
 */
export async function recipientByCustomer(
  deps: WhatsappSendRecipientDeps,
  customerId: string,
  ctx: RecipientContext,
): Promise<ResolvedRecipient> {
  const phone = await deps.customerPhones.mainPhoneOf(customerId, ctx.scope.companyId);
  if (phone === 'customer_not_found') throw new LinkedCustomerNotFoundError();
  if (phone === 'no_phone') throw new WhatsappCustomerWithoutPhoneError();

  const candidates = await deps.outbox.findContactsByWaIds(ctx.connectionId, waIdCandidates(phone.e164), ctx.scope);
  const contact =
    pickContactFor(customerId, candidates) ?? (await deps.outbox.ensureContact(ctx.connectionId, phone.e164, ctx.scope));
  if (contact.customerId !== null && contact.customerId !== customerId) throw new WhatsappContactLinkedElsewhereError();
  if (contact.blockedAt !== null) throw new WhatsappContactBlockedError();

  if (contact.customerId === customerId) return { contact, customerId };
  await deps.outbox.linkContact(contact.id, { customerId, linkedBy: ctx.actorId }, ctx.scope);
  return { contact: { ...contact, customerId, customerLinkedBy: ctx.actorId }, customerId };
}

export function resolveRecipient(
  deps: WhatsappSendRecipientDeps,
  recipient: WhatsappSendRecipient,
  ctx: RecipientContext,
): Promise<ResolvedRecipient> {
  return 'contactId' in recipient
    ? recipientByContact(deps, recipient.contactId, ctx)
    : recipientByCustomer(deps, recipient.customerId, ctx);
}
