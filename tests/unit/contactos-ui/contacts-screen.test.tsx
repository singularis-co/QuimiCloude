// Pantalla de Contactos: disposición lista / chat, selección en la URL, consulta periódica,
// contador a 0 tras marcar leído y contexto del chat al abrir y al cambiar de pedido.

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContactsScreen, type ContactsScreenProps } from '@/app/(private)/clientes/contactos/components/contacts-screen';
import type { TimerPort, VisibilityPort } from '@/app/(private)/clientes/contactos/components/contacts-poller';
import { errorMessage, UNEXPECTED_ERROR_CODE, type ErrorState } from '@/lib/modules/errores';
import type {
  WhatsappChat,
  WhatsappChatContext,
  WhatsappChatMessage,
  WhatsappConversationItem,
  WhatsappConversationList,
  WhatsappCustomerOrder,
} from '@/lib/modules/integraciones';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';

const actions = vi.hoisted(() => ({
  list: vi.fn(),
  getChat: vi.fn(),
  markRead: vi.fn(),
  getContext: vi.fn(),
  send: vi.fn(),
  retry: vi.fn(),
}));

vi.mock('@/lib/modules/integraciones/adapters/driving/whatsapp-conversation-actions', () => ({
  listWhatsappConversationsAction: actions.list,
  getWhatsappChatAction: actions.getChat,
  markWhatsappChatReadAction: actions.markRead,
  getWhatsappChatContextAction: actions.getContext,
}));

vi.mock('@/lib/modules/integraciones/adapters/driving/whatsapp-message-actions', () => ({
  sendWhatsappMessageAction: actions.send,
  retryWhatsappMessageAction: actions.retry,
}));

class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

type Page = WhatsappConversationList['page'];

const HACE_MINUTOS = new Date(Date.now() - 5 * 60_000).toISOString();
const ABIERTA = { open: true, closesAt: new Date(Date.now() + 3_600_000).toISOString() } as const;
const CERRADA = { open: false, closesAt: null } as const;

function conversacion(n: number, overrides: Partial<WhatsappConversationItem> = {}): WhatsappConversationItem {
  return {
    contactId: `contacto-${n}`,
    customerId: `cliente-${n}`,
    customerName: `Cliente ${n}`,
    phone: `+593 99 000 00${String(n).padStart(2, '0')}`,
    isBlocked: false,
    unreadCount: 0,
    lastMessage: { direction: 'IN', type: 'TEXT', preview: `Hola ${n}`, status: 'RECEIVED', at: HACE_MINUTOS },
    ...overrides,
  };
}

function pagina(items: WhatsappConversationItem[]): Page {
  return { items, total: items.length, page: 1, pageSize: 25, totalPages: 1 };
}

function mensaje(id: string, minuto: number, overrides: Partial<WhatsappChatMessage> = {}): WhatsappChatMessage {
  return {
    id,
    direction: 'IN',
    type: 'TEXT',
    body: `Texto ${id}`,
    attachment: null,
    status: 'RECEIVED',
    errorReason: null,
    origin: null,
    sentBy: null,
    templateName: null,
    at: new Date(Date.now() - (60 - minuto) * 60_000).toISOString(),
    ...overrides,
  };
}

function chatDe(n: number, overrides: Partial<WhatsappChat> = {}): WhatsappChat {
  return {
    connectionStatus: 'ACTIVE',
    contact: { id: `contacto-${n}`, phone: `+593 99 000 00${String(n).padStart(2, '0')}`, isBlocked: false, unreadCount: 0 },
    customer: { id: `cliente-${n}`, name: `Cliente ${n}` },
    window: ABIERTA,
    messages: [mensaje(`m${n}-1`, 0)],
    hasMore: false,
    nextCursor: null,
    ...overrides,
  };
}

function pedido(id: string, number: string): WhatsappCustomerOrder {
  return {
    id,
    number,
    status: 'POR_EMPACAR',
    requestedAt: '2026-10-20T10:00:00.000Z',
    total: null,
    productName: null,
    lines: [],
  };
}

function contextoDe(n: number, selectedOrderId = 'p131'): WhatsappChatContext {
  return {
    customer: { id: `cliente-${n}`, name: `Cliente ${n}` },
    orders: [pedido('p131', 'PED-00131'), pedido('p124', 'PED-00124')],
    selectedOrderId,
    values: { 'cliente.nombre': `Cliente ${n}` },
  };
}

function exito<T>(data: T) {
  return { status: 'success' as const, data };
}

function diferida<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function relojManual() {
  let pendiente: (() => void) | null = null;
  const timers: TimerPort = {
    setTimeout(callback) {
      pendiente = callback;
      return 1;
    },
    clearTimeout() {
      pendiente = null;
    },
  };
  return {
    timers,
    async disparar() {
      const callback = pendiente;
      pendiente = null;
      await act(async () => {
        callback?.();
      });
    },
  };
}

const VISIBLE: VisibilityPort = { isVisible: () => true, subscribe: () => () => {} };

const CONVERSACIONES = [conversacion(1, { unreadCount: 3 }), conversacion(2)];

function pintar(overrides: Partial<ContactsScreenProps> = {}) {
  const reloj = relojManual();
  const props: ContactsScreenProps = {
    initialPage: pagina(CONVERSACIONES),
    initialSelection: null,
    initialChat: null,
    initialContext: null,
    templates: [],
    canSend: true,
    pollPorts: { visibility: VISIBLE, timers: reloj.timers },
    ...overrides,
  };
  const utils = render(<ContactsScreen {...props} />);
  return { ...utils, reloj, props };
}

const pantalla = () => screen.getByTestId('contacts-screen');
const lista = () => screen.getByTestId('conversation-list');
const panelDelChat = () => screen.getByTestId('contacts-chat-pane');
const fila = (n: number) =>
  screen.getAllByTestId('conversation-item').find((item) => item.getAttribute('data-contact-id') === `contacto-${n}`)!;
const selectorPedido = () => screen.getByRole('combobox', { name: 'Pedido' });

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  window.history.replaceState(null, '', '/clientes/contactos');
  for (const action of Object.values(actions)) action.mockReset();
  actions.list.mockResolvedValue(exito({ connectionStatus: 'ACTIVE', page: pagina(CONVERSACIONES) }));
  actions.getChat.mockImplementation(async ({ target }: { target: { contactId?: string } }) =>
    exito(chatDe(Number(target.contactId?.split('-')[1] ?? 1))),
  );
  actions.getContext.mockImplementation(async ({ target }: { target: { contactId?: string } }) =>
    exito(contextoDe(Number(target.contactId?.split('-')[1] ?? 1))),
  );
  actions.markRead.mockResolvedValue(exito({ unreadCount: 0 }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('R5 · escritorio: lista y chat lado a lado', () => {
  it('R5: sin chat elegido, la lista y el estado neutro se ven juntos', () => {
    pintar();
    expect(lista()).toBeTruthy();
    expect(within(panelDelChat()).getByText('Elige una conversación para verla aquí.')).toBeTruthy();
    expect(lista().className).toContain('md:w-[360px]');
    expect(lista().className).not.toContain('max-md:hidden');
  });

  it('R5: con un chat elegido, la lista y el chat se ven juntos', () => {
    pintar({
      initialSelection: { contactId: 'contacto-1' },
      initialChat: exito(chatDe(1)),
      initialContext: exito(contextoDe(1)),
    });
    expect(lista()).toBeTruthy();
    expect(within(panelDelChat()).getByTestId('chat-panel')).toBeTruthy();
    expect(within(panelDelChat()).getByTestId('chat-header').textContent).toContain('Cliente 1');
  });
});

describe('R6 · teléfono: solo la lista o solo el chat', () => {
  it('R6: abrir una conversación pasa al chat y «Volver a conversaciones» vuelve a la lista', async () => {
    const user = setupUser();
    pintar();
    expect(pantalla().getAttribute('data-view')).toBe('list');
    expect(panelDelChat().className).toContain('max-md:hidden');

    await user.click(fila(1));
    expect(pantalla().getAttribute('data-view')).toBe('chat');
    expect(lista().className).toContain('max-md:hidden');
    expect(panelDelChat().className).not.toContain('max-md:hidden');
    expect(window.location.search).toBe('?contacto=contacto-1');
    await screen.findByTestId('chat-header');

    await user.click(within(screen.getByTestId('chat-header')).getByRole('button', { name: 'Volver a conversaciones' }));
    await waitFor(() => expect(pantalla().getAttribute('data-view')).toBe('list'));
    expect(window.location.search).toBe('');
    expect(lista().className).not.toContain('max-md:hidden');
  });

  it('R6: «Atrás» del navegador vuelve a la lista', async () => {
    const user = setupUser();
    pintar();
    await user.click(fila(1));
    await screen.findByTestId('chat-header');

    act(() => {
      window.history.back();
    });
    await waitFor(() => expect(pantalla().getAttribute('data-view')).toBe('list'));
    expect(screen.getByText('Elige una conversación para verla aquí.')).toBeTruthy();
  });

  it('R6: entre chats se reemplaza la URL, así que «Atrás» vuelve a la lista y no al chat anterior', async () => {
    const user = setupUser();
    pintar();
    await user.click(fila(1));
    await screen.findByTestId('chat-header');
    await user.click(fila(2));
    expect(window.location.search).toBe('?contacto=contacto-2');

    act(() => {
      window.history.back();
    });
    await waitFor(() => expect(pantalla().getAttribute('data-view')).toBe('list'));
  });

  it('R6: abierto desde la URL, «Volver a conversaciones» quita la selección sin salir de la página', async () => {
    const user = setupUser();
    window.history.replaceState(null, '', '/clientes/contactos?contacto=contacto-1');
    pintar({
      initialSelection: { contactId: 'contacto-1' },
      initialChat: exito(chatDe(1)),
      initialContext: exito(contextoDe(1)),
    });
    await user.click(within(screen.getByTestId('chat-header')).getByRole('button', { name: 'Volver a conversaciones' }));
    expect(pantalla().getAttribute('data-view')).toBe('list');
    expect(window.location.pathname).toBe('/clientes/contactos');
    expect(window.location.search).toBe('');
  });
});

describe('R14 · abrir una conversación', () => {
  it('R14: pide su chat, lo abre y la marca como la seleccionada', async () => {
    const user = setupUser();
    pintar();
    await user.click(fila(2));

    expect(actions.getChat).toHaveBeenCalledWith({ target: { contactId: 'contacto-2' }, pageSize: 30 });
    await waitFor(() => expect(screen.getByTestId('chat-header').textContent).toContain('Cliente 2'));
    expect(fila(2).getAttribute('aria-current')).toBe('true');
    expect(fila(1).getAttribute('aria-current')).toBeNull();
  });

  it('R14: si la carga del chat falla muestra su `message` y «Reintentar» la repite', async () => {
    const user = setupUser();
    const error: ErrorState = { status: 'error', code: 'unauthorized', message: 'No tienes permiso para esta acción.' };
    actions.getChat.mockResolvedValueOnce(error);
    pintar();
    await user.click(fila(2));

    const alerta = await screen.findByTestId('chat-load-error');
    expect(alerta.textContent).toContain('No tienes permiso para esta acción.');
    await user.click(within(alerta).getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByTestId('chat-header').textContent).toContain('Cliente 2'));
    expect(actions.getChat).toHaveBeenCalledTimes(2);
  });
});

describe('R27 · contador a 0 tras marcar leído', () => {
  it('R27: al abrir una conversación con no leídos la marca leída y su contador queda en 0', async () => {
    const user = setupUser();
    pintar();
    expect(within(fila(1)).getByRole('img', { name: '3 sin leer' })).toBeTruthy();

    await user.click(fila(1));
    await waitFor(() =>
      expect(actions.markRead).toHaveBeenCalledWith({ contactId: 'contacto-1', upToMessageId: 'm1-1' }),
    );
    await waitFor(() => expect(within(fila(1)).queryByTestId('conversation-unread')).toBeNull());
  });

  it('R27: si marcar leída falla, el contador se queda', async () => {
    const user = setupUser();
    actions.markRead.mockResolvedValue({ status: 'error', code: 'unauthorized', message: 'No tienes permiso para esta acción.' });
    pintar();
    await user.click(fila(1));
    await waitFor(() => expect(actions.markRead).toHaveBeenCalledTimes(1));
    expect(within(fila(1)).getByRole('img', { name: '3 sin leer' })).toBeTruthy();
  });
});

describe('R42 · la consulta periódica integra lo nuevo', () => {
  it('R42: trae la página 1 y el chat abierto, y añade la conversación y el mensaje nuevos sin duplicar', async () => {
    const { reloj } = pintar({
      initialSelection: { contactId: 'contacto-1' },
      initialChat: exito(chatDe(1)),
      initialContext: exito(contextoDe(1)),
    });
    await screen.findByText('Texto m1-1');
    actions.list.mockResolvedValue(
      exito({ connectionStatus: 'ACTIVE', page: pagina([conversacion(3, { unreadCount: 1 }), ...CONVERSACIONES]) }),
    );
    actions.getChat.mockResolvedValue(exito(chatDe(1, { messages: [mensaje('m1-1', 0), mensaje('m1-2', 5)] })));
    actions.getContext.mockClear();

    await reloj.disparar();

    expect(actions.list).toHaveBeenCalledWith({ search: '', page: 1, pageSize: 25 });
    expect(actions.getChat).toHaveBeenCalledWith({ target: { contactId: 'contacto-1' }, pageSize: 30 });
    await screen.findByText('Texto m1-2');
    expect(screen.getAllByText('Texto m1-1')).toHaveLength(1);
    await waitFor(() => expect(screen.getAllByTestId('conversation-item')).toHaveLength(3));
    expect(fila(3).textContent).toContain('Cliente 3');
  });

  it('R28: con entrantes nuevos en el chat abierto lo vuelve a marcar leído hasta el último', async () => {
    const { reloj } = pintar({
      initialSelection: { contactId: 'contacto-1' },
      initialChat: exito(chatDe(1)),
      initialContext: exito(contextoDe(1)),
    });
    await waitFor(() => expect(actions.markRead).toHaveBeenCalledTimes(1));
    actions.getChat.mockResolvedValue(exito(chatDe(1, { messages: [mensaje('m1-1', 0), mensaje('m1-2', 5)] })));

    await reloj.disparar();

    await waitFor(() =>
      expect(actions.markRead).toHaveBeenLastCalledWith({ contactId: 'contacto-1', upToMessageId: 'm1-2' }),
    );
  });

  it('R42: sin chat abierto solo pide la lista', async () => {
    const { reloj } = pintar();
    await reloj.disparar();
    await waitFor(() => expect(actions.list).toHaveBeenCalledTimes(1));
    expect(actions.getChat).not.toHaveBeenCalled();
  });
});

describe('R46 · abrir por cliente', () => {
  it('R46: abre el chat vacío del cliente sin conversación, con la ventana cerrada y su teléfono', () => {
    pintar({
      initialSelection: { customerId: 'cliente-9' },
      initialChat: exito(
        chatDe(9, { contact: null, customer: { id: 'cliente-9', name: 'Ferretería Sur' }, window: CERRADA, messages: [] }),
      ),
      initialContext: exito({ ...contextoDe(9), orders: [], selectedOrderId: null }),
      requestedCustomer: { id: 'cliente-9', phone: '+593 98 111 2233' },
    });
    const cabecera = screen.getByTestId('chat-header');
    expect(cabecera.textContent).toContain('Ferretería Sur');
    expect(cabecera.textContent).toContain('+593 98 111 2233');
    expect(screen.getByTestId('chat-window-badge').textContent).toContain('Ventana cerrada');
    expect(screen.getByText('Aún no hay mensajes con este cliente')).toBeTruthy();
    expect(lista()).toBeTruthy();
  });

  it('R46: con conversación, el teléfono sale de la conversación del cliente en la lista', () => {
    pintar({
      initialSelection: { customerId: 'cliente-2' },
      initialChat: exito(chatDe(2, { contact: null })),
      initialContext: exito(contextoDe(2)),
    });
    expect(screen.getByTestId('chat-header').textContent).toContain('+593 99 000 0002');
    expect(fila(2).getAttribute('aria-current')).toBe('true');
  });

  it('R46: si el cliente no existe muestra «El cliente solicitado no existe.» junto a la lista', () => {
    pintar({
      initialSelection: { customerId: 'cliente-0' },
      initialChat: { status: 'error', code: 'customer_not_found', message: 'El cliente solicitado no existe.' },
      initialContext: { status: 'error', code: 'customer_not_found', message: 'El cliente solicitado no existe.' },
    });
    expect(within(panelDelChat()).getByTestId('chat-load-error').textContent).toContain('El cliente solicitado no existe.');
    expect(lista()).toBeTruthy();
  });
});

describe('R54 · contexto del chat', () => {
  it('R54: al abrir una conversación pide su contexto una vez, solo con `{ target }`', async () => {
    const user = setupUser();
    pintar();
    await user.click(fila(2));
    await waitFor(() => expect(selectorPedido().textContent).toContain('PED-00131'));
    expect(actions.getContext).toHaveBeenCalledTimes(1);
    expect(actions.getContext).toHaveBeenCalledWith({ target: { contactId: 'contacto-2' } });
  });

  it('R54: al cambiar el pedido lo pide con `{ target, orderId }` y aplica el pedido nuevo', async () => {
    const user = setupUser();
    pintar({
      initialSelection: { contactId: 'contacto-1' },
      initialChat: exito(chatDe(1)),
      initialContext: exito(contextoDe(1)),
    });
    actions.getContext.mockResolvedValue(exito(contextoDe(1, 'p124')));
    await user.click(selectorPedido());
    await user.click(await esperarInteractiva(await screen.findByRole('option', { name: 'PED-00124' })));

    expect(actions.getContext).toHaveBeenCalledWith({ target: { contactId: 'contacto-1' }, orderId: 'p124' });
    await waitFor(() => expect(selectorPedido().textContent).toContain('PED-00124'));
  });

  it('R54: la consulta periódica no pide el contexto', async () => {
    const { reloj } = pintar({
      initialSelection: { contactId: 'contacto-1' },
      initialChat: exito(chatDe(1)),
      initialContext: exito(contextoDe(1)),
    });
    await reloj.disparar();
    await waitFor(() => expect(actions.getChat).toHaveBeenCalledTimes(1));
    await reloj.disparar();
    await waitFor(() => expect(actions.getChat).toHaveBeenCalledTimes(2));
    expect(actions.getContext).not.toHaveBeenCalled();
  });

  it('R54: la respuesta tardía del contexto de otro chat se descarta', async () => {
    const user = setupUser();
    const tardia = diferida<ReturnType<typeof exito<WhatsappChatContext>>>();
    actions.getContext.mockImplementationOnce(() => tardia.promise);
    pintar();
    await user.click(fila(1));
    await user.click(fila(2));
    await waitFor(() => expect(screen.getByTestId('chat-header').textContent).toContain('Cliente 2'));
    await waitFor(() => expect(selectorPedido().textContent).toContain('PED-00131'));

    await act(async () => {
      tardia.resolve(exito({ ...contextoDe(1, 'p124'), orders: [pedido('p124', 'PED-00999'), pedido('p131', 'PED-00131')] }));
    });
    expect(selectorPedido().textContent).toContain('PED-00131');
    expect(selectorPedido().textContent).not.toContain('PED-00999');
  });

  it('R54: si el cambio de pedido falla muestra su `message` junto al selector y conserva el pedido', async () => {
    const user = setupUser();
    pintar({
      initialSelection: { contactId: 'contacto-1' },
      initialChat: exito(chatDe(1)),
      initialContext: exito(contextoDe(1)),
    });
    actions.getContext.mockResolvedValue({ status: 'error', code: 'order_not_found', message: 'El pedido no existe.' });
    await user.click(selectorPedido());
    await user.click(await esperarInteractiva(await screen.findByRole('option', { name: 'PED-00124' })));

    const error = await screen.findByTestId('chat-order-error');
    expect(error.textContent).toContain('El pedido no existe.');
    expect(selectorPedido().textContent).toContain('PED-00131');
  });

  it('R54: una red caída al abrir el contexto se pinta como error inesperado con «Reintentar»', async () => {
    const user = setupUser();
    actions.getContext.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    pintar();
    await user.click(fila(2));

    const alerta = await screen.findByTestId('chat-context-error');
    expect(alerta.textContent).toContain(errorMessage(UNEXPECTED_ERROR_CODE));
    await user.click(within(alerta).getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(selectorPedido().textContent).toContain('PED-00131'));
  });
});
