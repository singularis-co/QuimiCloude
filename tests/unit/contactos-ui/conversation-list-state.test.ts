import { describe, expect, it } from 'vitest';

import {
  appendNextPage,
  fromFirstPage,
  hasMorePages,
  mergePolledFirstPage,
  nextPageNumber,
} from '@/app/(private)/clientes/contactos/components/conversation-list-state';
import type { WhatsappConversationItem, WhatsappConversationList } from '@/lib/modules/integraciones';

function item(contactId: string, unreadCount = 0, preview = 'Hola'): WhatsappConversationItem {
  return {
    contactId,
    customerId: `cus-${contactId}`,
    customerName: `Cliente ${contactId}`,
    phone: '+593990000000',
    isBlocked: false,
    unreadCount,
    lastMessage: { direction: 'IN', type: 'TEXT', preview, status: 'RECEIVED', at: '2026-10-21T10:00:00.000Z' },
  };
}

function page(items: WhatsappConversationItem[], pageNumber: number, totalPages: number): WhatsappConversationList['page'] {
  return { items, total: totalPages * 25, page: pageNumber, pageSize: 25, totalPages };
}

const ids = (items: readonly WhatsappConversationItem[]) => items.map((i) => i.contactId);

describe('conversation-list-state', () => {
  it('R13: con más páginas pide la siguiente; en la última, no', () => {
    const state = fromFirstPage(page([item('a')], 1, 3));
    expect(hasMorePages(state)).toBe(true);
    expect(nextPageNumber(state)).toBe(2);
    expect(hasMorePages(fromFirstPage(page([item('a')], 1, 1)))).toBe(false);
    expect(hasMorePages(fromFirstPage(page([], 1, 0)))).toBe(false);
  });

  it('R13: añade la página siguiente al final sin repetir conversaciones', () => {
    const state = fromFirstPage(page([item('a'), item('b')], 1, 2));
    const next = appendNextPage(state, page([item('b'), item('c')], 2, 2));
    expect(ids(next.items)).toEqual(['a', 'b', 'c']);
    expect(next.page).toBe(2);
    expect(hasMorePages(next)).toBe(false);
  });

  it('R42: la página 1 del poller va arriba, gana su versión y conserva el resto de lo cargado', () => {
    const loaded = appendNextPage(fromFirstPage(page([item('a'), item('b', 1)], 1, 2)), page([item('c'), item('d')], 2, 2));
    const merged = mergePolledFirstPage(loaded, page([item('e', 1, 'Nuevo'), item('b', 3, 'Otra vez'), item('a')], 1, 2));
    expect(ids(merged.items)).toEqual(['e', 'b', 'a', 'c', 'd']);
    expect(merged.items.find((i) => i.contactId === 'b')).toMatchObject({ unreadCount: 3, lastMessage: { preview: 'Otra vez' } });
    expect(merged.page).toBe(2);
    expect(new Set(ids(merged.items)).size).toBe(merged.items.length);
  });

  it('R42: si el poller trae más páginas que antes, se puede seguir cargando', () => {
    const merged = mergePolledFirstPage(fromFirstPage(page([item('a')], 1, 1)), page([item('z'), item('a')], 1, 2));
    expect(hasMorePages(merged)).toBe(true);
  });
});
