import type { WhatsappConversationItem, WhatsappConversationList } from '@/lib/modules/integraciones';

export const CONVERSATIONS_PAGE_SIZE = 25;

type ConversationPage = WhatsappConversationList['page'];

export type ConversationListState = {
  readonly items: readonly WhatsappConversationItem[];
  readonly page: number;
  readonly totalPages: number;
};

export function fromFirstPage(page: ConversationPage): ConversationListState {
  return { items: page.items, page: page.page, totalPages: page.totalPages };
}

export function hasMorePages(state: ConversationListState): boolean {
  return state.page < state.totalPages;
}

export function nextPageNumber(state: ConversationListState): number {
  return state.page + 1;
}

/** Una conversación que ya está (porque subió de página entre una petición y otra) no se repite. */
export function appendNextPage(state: ConversationListState, page: ConversationPage): ConversationListState {
  const known = new Set(state.items.map((item) => item.contactId));
  const fresh = page.items.filter((item) => !known.has(item.contactId));
  return { items: [...state.items, ...fresh], page: page.page, totalPages: page.totalPages };
}

/** La página 1 recién pedida va arriba y manda; del resto de lo cargado se queda lo que no trae. */
export function mergePolledFirstPage(state: ConversationListState, page: ConversationPage): ConversationListState {
  const polled = new Set(page.items.map((item) => item.contactId));
  const rest = state.items.filter((item) => !polled.has(item.contactId));
  return { items: [...page.items, ...rest], page: Math.max(state.page, page.page), totalPages: page.totalPages };
}
