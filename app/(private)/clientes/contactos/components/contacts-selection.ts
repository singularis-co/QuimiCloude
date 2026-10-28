import type { ChatTarget } from './chat-view';

export const CONTACTS_SELECTION_PARAMS = {
  contact: 'contacto',
  customer: 'cliente',
} as const;

type SearchSource = { get(name: string): string | null };

/** Con los dos parámetros manda `contacto`: es la conversación concreta. */
export function selectionFromSearch(search: SearchSource): ChatTarget | null {
  const contactId = search.get(CONTACTS_SELECTION_PARAMS.contact);
  if (contactId) return { contactId };
  const customerId = search.get(CONTACTS_SELECTION_PARAMS.customer);
  if (customerId) return { customerId };
  return null;
}

export function searchOfSelection(target: ChatTarget): string {
  const params = new URLSearchParams(
    'contactId' in target
      ? { [CONTACTS_SELECTION_PARAMS.contact]: target.contactId }
      : { [CONTACTS_SELECTION_PARAMS.customer]: target.customerId },
  );
  return `?${params.toString()}`;
}
