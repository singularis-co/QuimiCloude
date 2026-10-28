import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  browserTimers,
  CONTACTS_POLL_INTERVAL_MS,
  createContactsPoller,
  type ContactsPollerDeps,
  type ContactsPollQuery,
  type ContactsPollTick,
  type VisibilityPort,
} from '@/app/(private)/clientes/contactos/components/contacts-poller';
import type {
  WhatsappChatResult,
  WhatsappConversationListResult,
} from '@/lib/modules/integraciones/adapters/driving/whatsapp-conversation-actions';
import type { WhatsappChat, WhatsappChatMessage } from '@/lib/modules/integraciones';

const LIST_OK: WhatsappConversationListResult = {
  status: 'success',
  data: { connectionStatus: 'ACTIVE', page: { items: [], total: 0, page: 1, pageSize: 25, totalPages: 0 } },
};

function inbound(id: string): WhatsappChatMessage {
  return {
    id,
    direction: 'IN',
    type: 'TEXT',
    body: 'Hola',
    attachment: null,
    status: 'RECEIVED',
    errorReason: null,
    origin: null,
    sentBy: null,
    templateName: null,
    at: '2026-10-21T10:00:00.000Z',
  };
}

function chatOk(messages: WhatsappChatMessage[]): WhatsappChatResult {
  const chat: WhatsappChat = {
    connectionStatus: 'ACTIVE',
    contact: { id: 'k1', phone: '+593990000000', isBlocked: false, unreadCount: 0 },
    customer: { id: 'c1', name: 'Laura Gómez' },
    window: { open: false, closesAt: null },
    messages,
    hasMore: false,
    nextCursor: null,
  };
  return { status: 'success', data: chat };
}

const ERROR = { status: 'error', code: 'invalid_input', message: 'Algo falló' } as const;
const UNAUTHORIZED = { status: 'error', code: 'unauthorized', message: 'Sin permiso' } as const;

function fakeVisibility(initial = true) {
  let visible = initial;
  const listeners = new Set<() => void>();
  const port: VisibilityPort = {
    isVisible: () => visible,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    port,
    set(next: boolean) {
      visible = next;
      for (const listener of listeners) listener();
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function setup(overrides: Partial<ContactsPollerDeps> = {}, query: ContactsPollQuery = { search: '', chat: null }) {
  const visibility = fakeVisibility();
  const listConversations = vi.fn<ContactsPollerDeps['listConversations']>(async () => LIST_OK);
  const getChat = vi.fn<ContactsPollerDeps['getChat']>(async () => chatOk([]));
  const ticks: ContactsPollTick[] = [];
  const onStop = vi.fn();
  const deps: ContactsPollerDeps = {
    listConversations,
    getChat,
    currentQuery: () => query,
    visibility: visibility.port,
    timers: browserTimers,
    ...overrides,
  };
  const poller = createContactsPoller(deps);
  const stop = poller.start((tick) => ticks.push(tick), onStop);
  return { poller, stop, ticks, onStop, visibility, listConversations, getChat, deps };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createContactsPoller', () => {
  it('R42: el primer turno espera 8 s (los datos ya llegan con la página) y pide la página 1 con la búsqueda vigente', async () => {
    const { listConversations, ticks } = setup({}, { search: 'laura', chat: null });
    expect(CONTACTS_POLL_INTERVAL_MS).toBe(8_000);
    await vi.advanceTimersByTimeAsync(7_999);
    expect(listConversations).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(listConversations).toHaveBeenCalledWith({ search: 'laura', page: 1, pageSize: 25 });
    expect(ticks).toHaveLength(1);
  });

  it('R42: con chat abierto pide también el chat sin before y lo entrega con su target', async () => {
    const query: ContactsPollQuery = { search: '', chat: { target: { contactId: 'k1' }, knownMessageIds: new Set() } };
    const { getChat, ticks } = setup({}, query);
    await vi.advanceTimersByTimeAsync(CONTACTS_POLL_INTERVAL_MS);
    expect(getChat).toHaveBeenCalledWith({ target: { contactId: 'k1' }, pageSize: 30 });
    expect(getChat.mock.calls[0]?.[0]).not.toHaveProperty('before');
    expect(ticks[0]?.chat?.target).toEqual({ contactId: 'k1' });
  });

  it('R42: el siguiente turno se programa 8 s después del fin de la consulta, no de su inicio', async () => {
    const slow = deferred<WhatsappConversationListResult>();
    const listConversations = vi.fn<ContactsPollerDeps['listConversations']>(() => slow.promise);
    setup({ listConversations });
    await vi.advanceTimersByTimeAsync(CONTACTS_POLL_INTERVAL_MS);
    expect(listConversations).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(20_000);
    expect(listConversations).toHaveBeenCalledTimes(1);

    listConversations.mockImplementation(async () => LIST_OK);
    slow.resolve(LIST_OK);
    await vi.advanceTimersByTimeAsync(CONTACTS_POLL_INTERVAL_MS - 1);
    expect(listConversations).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(listConversations).toHaveBeenCalledTimes(2);
  });

  it('R43: con la pestaña oculta no consulta, y al volver a ser visible consulta en ese momento', async () => {
    const { visibility, listConversations } = setup();
    visibility.set(false);
    await vi.advanceTimersByTimeAsync(CONTACTS_POLL_INTERVAL_MS * 5);
    expect(listConversations).not.toHaveBeenCalled();

    visibility.set(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(listConversations).toHaveBeenCalledTimes(1);
  });

  it('R43: arrancando con la pestaña oculta no programa nada hasta que es visible', async () => {
    const visibility = fakeVisibility(false);
    const listConversations = vi.fn<ContactsPollerDeps['listConversations']>(async () => LIST_OK);
    createContactsPoller({
      listConversations,
      getChat: vi.fn(),
      currentQuery: () => ({ search: '', chat: null }),
      visibility: visibility.port,
      timers: browserTimers,
    }).start(() => undefined, () => undefined);
    await vi.advanceTimersByTimeAsync(CONTACTS_POLL_INTERVAL_MS * 3);
    expect(listConversations).not.toHaveBeenCalled();
    visibility.set(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(listConversations).toHaveBeenCalledTimes(1);
  });

  it('R44: un error deja esa parte en null (se mantiene lo último) y el siguiente turno vuelve a consultar', async () => {
    const listConversations = vi.fn<ContactsPollerDeps['listConversations']>(async () => ERROR);
    const query: ContactsPollQuery = { search: '', chat: { target: { contactId: 'k1' }, knownMessageIds: new Set() } };
    const getChat = vi.fn<ContactsPollerDeps['getChat']>().mockRejectedValueOnce(new Error('red')).mockResolvedValue(chatOk([]));
    const { ticks, onStop } = setup({ listConversations, getChat }, query);

    await vi.advanceTimersByTimeAsync(CONTACTS_POLL_INTERVAL_MS);
    expect(ticks[0]).toEqual({ list: null, chat: null });

    listConversations.mockResolvedValue(LIST_OK);
    await vi.advanceTimersByTimeAsync(CONTACTS_POLL_INTERVAL_MS);
    expect(ticks).toHaveLength(2);
    expect(ticks[1]?.list).not.toBeNull();
    expect(ticks[1]?.chat).not.toBeNull();
    expect(onStop).not.toHaveBeenCalled();
  });

  it('R44: unauthorized en la lista o en el chat para la consulta', async () => {
    const listConversations = vi.fn<ContactsPollerDeps['listConversations']>(async () => UNAUTHORIZED);
    const { onStop, ticks } = setup({ listConversations });
    await vi.advanceTimersByTimeAsync(CONTACTS_POLL_INTERVAL_MS);
    expect(onStop).toHaveBeenCalledWith('unauthorized');
    expect(ticks).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(CONTACTS_POLL_INTERVAL_MS * 3);
    expect(listConversations).toHaveBeenCalledTimes(1);

    const getChat = vi.fn<ContactsPollerDeps['getChat']>(async () => UNAUTHORIZED);
    const query: ContactsPollQuery = { search: '', chat: { target: { customerId: 'c1' }, knownMessageIds: new Set() } };
    const second = setup({ getChat }, query);
    await vi.advanceTimersByTimeAsync(CONTACTS_POLL_INTERVAL_MS * 3);
    expect(second.onStop).toHaveBeenCalledWith('unauthorized');
    expect(getChat).toHaveBeenCalledTimes(1);
  });

  it('R28: avisa cuando el chat abierto trae entrantes que la pantalla no tenía', async () => {
    const getChat = vi.fn<ContactsPollerDeps['getChat']>(async () => chatOk([inbound('m1'), inbound('m2')]));
    const known = { search: '', chat: { target: { contactId: 'k1' }, knownMessageIds: new Set(['m1', 'm2']) } };
    let query: ContactsPollQuery = known;
    const { ticks } = setup({ getChat, currentQuery: () => query });

    await vi.advanceTimersByTimeAsync(CONTACTS_POLL_INTERVAL_MS);
    expect(ticks[0]?.chat?.hasNewInbound).toBe(false);

    query = { search: '', chat: { target: { contactId: 'k1' }, knownMessageIds: new Set(['m1']) } };
    await vi.advanceTimersByTimeAsync(CONTACTS_POLL_INTERVAL_MS);
    expect(ticks[1]?.chat?.hasNewInbound).toBe(true);
  });

  it('R28: si la pestaña se ocultó mientras llegaba la respuesta, no avisa de entrantes', async () => {
    const pending = deferred<WhatsappChatResult>();
    const getChat = vi.fn<ContactsPollerDeps['getChat']>(() => pending.promise);
    const query: ContactsPollQuery = { search: '', chat: { target: { contactId: 'k1' }, knownMessageIds: new Set() } };
    const { ticks, visibility } = setup({ getChat }, query);
    await vi.advanceTimersByTimeAsync(CONTACTS_POLL_INTERVAL_MS);
    visibility.set(false);
    pending.resolve(chatOk([inbound('nuevo')]));
    await vi.advanceTimersByTimeAsync(0);
    expect(ticks[0]?.chat?.hasNewInbound).toBe(false);
  });

  it('R54: el turno solo pide la lista y el chat, nunca el contexto ni con orderId', async () => {
    const getContext = vi.fn();
    const query: ContactsPollQuery = { search: '', chat: { target: { contactId: 'k1' }, knownMessageIds: new Set() } };
    const deps = { getWhatsappChatContext: getContext };
    const { listConversations, getChat } = setup(deps as Partial<ContactsPollerDeps>, query);
    await vi.advanceTimersByTimeAsync(CONTACTS_POLL_INTERVAL_MS * 3);
    expect(listConversations).toHaveBeenCalledTimes(3);
    expect(getChat).toHaveBeenCalledTimes(3);
    expect(getContext).not.toHaveBeenCalled();
    for (const [input] of getChat.mock.calls) expect(input).not.toHaveProperty('orderId');
  });

  it('refresh consulta ya y no solapa consultas en vuelo; stop deja de consultar', async () => {
    const { poller, stop, listConversations } = setup();
    await poller.refresh();
    expect(listConversations).toHaveBeenCalledTimes(1);
    stop();
    await vi.advanceTimersByTimeAsync(CONTACTS_POLL_INTERVAL_MS * 3);
    expect(listConversations).toHaveBeenCalledTimes(1);
  });
});
