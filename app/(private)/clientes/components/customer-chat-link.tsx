import { MessageSquare } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import type { CustomerView } from '@/lib/modules/clientes';
import { CUSTOMER_CONTACTS_ROUTE } from '@/lib/shared/routes';
import { cn } from '@/lib/utils';

import { CONTACTS_SELECTION_PARAMS } from '../contactos/components/contacts-selection';

export const CUSTOMER_CHAT_LINK_TESTID = 'customer-chat-link';
export const CUSTOMER_CHAT_UNAVAILABLE_TESTID = 'customer-chat-unavailable';

export const CUSTOMER_CHAT_LINK_TEXT = 'Abrir chat';
export const CUSTOMER_CHAT_UNAVAILABLE_TEXT = 'Sin teléfono válido';

export function customerChatLinkLabel(name: string): string {
  return `Abrir chat de ${name}`;
}

export function customerChatHref(customerId: string): string {
  const search = new URLSearchParams({ [CONTACTS_SELECTION_PARAMS.customer]: customerId });
  return `${CUSTOMER_CONTACTS_ROUTE}?${search.toString()}`;
}

export function hasChatablePhone(customer: Pick<CustomerView, 'phoneE164' | 'phoneIssue'>): boolean {
  return customer.phoneE164 !== null && customer.phoneIssue === null;
}

export type CustomerChatLinkProps = {
  readonly customer: CustomerView;
  /** Si la sesión trae `whatsapp.consultar`. Decisión de presentación, bajada por props. */
  readonly canChat: boolean;
  readonly label?: string;
  readonly unavailableLabel?: string;
};

export function CustomerChatLink({
  customer,
  canChat,
  label = CUSTOMER_CHAT_LINK_TEXT,
  unavailableLabel = CUSTOMER_CHAT_UNAVAILABLE_TEXT,
}: CustomerChatLinkProps) {
  if (!canChat) return null;

  if (!hasChatablePhone(customer)) {
    return (
      <span
        data-testid={`${CUSTOMER_CHAT_UNAVAILABLE_TESTID}-${customer.id}`}
        className="text-xs text-muted-foreground"
      >
        {unavailableLabel}
      </span>
    );
  }

  return (
    <Link
      href={customerChatHref(customer.id)}
      aria-label={customerChatLinkLabel(`${customer.firstNames} ${customer.lastNames}`)}
      data-slot="button"
      data-testid={`${CUSTOMER_CHAT_LINK_TESTID}-${customer.id}`}
      className={cn(buttonVariants({ variant: 'outline', size: 'sm', touch: true }))}
    >
      <MessageSquare aria-hidden="true" />
      {label}
    </Link>
  );
}
