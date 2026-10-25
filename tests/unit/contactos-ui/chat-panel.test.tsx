// Panel del chat: marca de leído al abrir, vacío del chat, errores de carga con «Reintentar»,
// anteriores, reintento de un fallido y ausencia de acciones de vincular o bloquear.

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatPanel, type ChatPanelProps } from '@/app/(private)/clientes/contactos/components/chat-panel';
import type { ChatContextView } from '@/app/(private)/clientes/contactos/components/chat-view';
import { errorMessage, UNEXPECTED_ERROR_CODE, type ErrorState } from '@/lib/modules/errores';
import type { WhatsappChat, WhatsappChatMessage, WhatsappOutboundMessageView } from '@/lib/modules/integraciones';
import { constantLabelsForBackend } from '@/lib/shared/ui/whatsapp-system-constants';

import { setupUser } from '../../helpers/user-event';

const actions = vi.hoisted(() => ({
  getChat: vi.fn(),
  markRead: vi.fn(),
  send: vi.fn(),
  retry: vi.fn(),
}));

vi.mock('@/lib/modules/integraciones/adapters/driving/whatsapp-conversation-actions', () => ({
  getWhatsappChatAction: actions.getChat,
  markWhatsappChatReadAction: actions.markRead,
}));

vi.mock('@/lib/modules/integraciones/adapters/driving/whatsapp-message-actions', () => ({
  sendWhatsappMessageAction: actions.send,
  retryWhatsappMessageAction: actions.retry,
}));

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly targets = new Set<Element>();
  disconnected = false;

  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target: Element) {
    this.targets.add(target);
  }

  unobserve(target: Element) {
    this.targets.delete(target);
  }

  disconnect() {
    this.disconnected = true;
    this.targets.clear();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  trigger() {
    const entries = [...this.targets].map((target) => ({ target, isIntersecting: true }) as unknown as IntersectionObserverEntry);
    this.callback(entries, this as unknown as IntersectionObserver);
  }
}

function mostrarCentinela() {
  act(() => {
    for (const observer of FakeIntersectionObserver.instances) {
      if (!observer.disconnected) observer.trigger();
    }
  });
}

const CONTACTO = '11111111-1111-4111-8111-111111111111';
const CLIENTE = '22222222-2222-4222-8222-222222222222';
const NOMBRE = 'Distribuidora El Roble';
const TELEFONO = '+593 98 455 2107';
const ABIERTA = { open: true, closesAt: new Date(Date.now() + 3_600_000).toISOString() } as const;
const CERRADA = { open: false, closesAt: null } as const;
const PROHIBIDO = /vincular|desvincular|bloquear/i;

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
    at: new Date(2026, 9, 23, 9, minuto).toISOString(),
    ...overrides,
  };
}

function chatDe(overrides: Partial<WhatsappChat> = {}): WhatsappChat {
  return {
    connectionStatus: 'ACTIVE',
    contact: { id: CONTACTO, phone: TELEFONO, isBlocked: false, unreadCount: 2 },
    customer: { id: CLIENTE, name: NOMBRE },
    window: ABIERTA,
    messages: [mensaje('m1', 0), mensaje('m2', 1)],
    hasMore: false,
    nextCursor: null,
    ...overrides,
  };
}

const CONTEXTO: ChatContextView = {
  orders: [
    {
      id: 'p131',
      number: 'PED-00131',
      statusLabel: 'En producción',
      productName: 'Desinfectante',
      totalLabel: null,
      lines: [],
    },
  ],
  selectedOrderId: 'p131',
  values: { 'cliente.nombre': 'Laura Gómez', 'pedido.numero': 'PED-00131', 'pedido.total': null, propia: 'X' },
};

function props(overrides: Partial<ChatPanelProps> = {}): ChatPanelProps {
  return {
    chat: chatDe(),
    chatLoading: false,
    chatError: null,
    onRetryChat: vi.fn(),
    context: CONTEXTO,
    contextLoading: false,
    contextError: null,
    onRetryContext: vi.fn(),
    orderError: null,
    onSelectOrder: vi.fn(),
    canSend: true,
    templates: [],
    onBack: vi.fn(),
    onChatRead: vi.fn(),
    onReloadChat: vi.fn(),
    ...overrides,
  };
}

function pintar(overrides: Partial<ChatPanelProps> = {}) {
  const p = props(overrides);
  const view = render(<ChatPanel {...p} />);
  return { props: p, ...view };
}

function enviado(overrides: Partial<WhatsappOutboundMessageView> = {}): WhatsappOutboundMessageView {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    type: 'TEXT',
    status: 'SENT',
    body: 'Le envío la cotización',
    templateName: null,
    templateLanguage: null,
    errorCode: null,
    errorReason: null,
    createdAt: new Date(2026, 9, 23, 9, 30).toISOString(),
    ...overrides,
  };
}

const ERROR_CATALOGADO: ErrorState = { status: 'error', code: 'unauthorized', message: 'No tienes permiso para esta acción.' };
const ERROR_INESPERADO: ErrorState = {
  status: 'error',
  code: 'unexpected',
  message: 'Ocurrió un error inesperado.',
  reference: 'req-abc-123',
};

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  for (const mock of Object.values(actions)) mock.mockReset();
  actions.markRead.mockResolvedValue({ status: 'success', data: { unreadCount: 0 } });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('R27 · marca leída al abrir', () => {
  it('R27: al abrir un chat con conversación la marca leída hasta el último mensaje y avisa al padre', async () => {
    const { props: p } = pintar();
    await waitFor(() => expect(p.onChatRead).toHaveBeenCalledWith(CONTACTO));
    expect(actions.markRead).toHaveBeenCalledTimes(1);
    expect(actions.markRead).toHaveBeenCalledWith({ contactId: CONTACTO, upToMessageId: 'm2' });
  });

  it('R27: el último mostrado no es una reacción', async () => {
    const reaccion = mensaje('r1', 5, {
      type: 'REACTION',
      body: null,
      attachment: { kind: 'reaction', emoji: '👍', messageId: 'm1' },
    });
    pintar({ chat: chatDe({ messages: [mensaje('m1', 0), mensaje('m2', 1), reaccion] }) });
    await waitFor(() => expect(actions.markRead).toHaveBeenCalledWith({ contactId: CONTACTO, upToMessageId: 'm2' }));
  });

  it('R27: no marca nada si el chat no tiene conversación', async () => {
    const { props: p } = pintar({ chat: chatDe({ contact: null, messages: [], window: CERRADA }) });
    await act(async () => {});
    expect(actions.markRead).not.toHaveBeenCalled();
    expect(p.onChatRead).not.toHaveBeenCalled();
  });

  it('R27 · D4: si marcar leída rechaza, no deja promesa sin capturar ni pinta error', async () => {
    const sinCapturar = vi.fn();
    process.on('unhandledRejection', sinCapturar);
    try {
      actions.markRead.mockRejectedValue(new Error('red caída'));
      const { props: p } = pintar();
      await waitFor(() => expect(actions.markRead).toHaveBeenCalledTimes(1));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(sinCapturar).not.toHaveBeenCalled();
      expect(p.onChatRead).not.toHaveBeenCalled();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByText('Texto m2')).toBeTruthy();
    } finally {
      process.off('unhandledRejection', sinCapturar);
    }
  });

  it('R27: una consulta nueva del mismo chat no vuelve a marcarla', async () => {
    const p = props();
    const { rerender } = render(<ChatPanel {...p} />);
    await waitFor(() => expect(actions.markRead).toHaveBeenCalledTimes(1));
    rerender(<ChatPanel {...p} chat={chatDe({ messages: [mensaje('m1', 0), mensaje('m2', 1), mensaje('m3', 2)] })} />);
    expect(screen.getByText('Texto m3')).toBeTruthy();
    expect(screen.getByText('Texto m1')).toBeTruthy();
    await act(async () => {});
    expect(actions.markRead).toHaveBeenCalledTimes(1);
  });

  it('R27: si falla la marca no avisa al padre', async () => {
    actions.markRead.mockResolvedValue(ERROR_CATALOGADO);
    const { props: p } = pintar();
    await waitFor(() => expect(actions.markRead).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(p.onChatRead).not.toHaveBeenCalled();
  });
});

describe('R33 · chat sin mensajes', () => {
  it('R33: pinta «Aún no hay mensajes con este cliente» y cómo empezar', () => {
    pintar({ chat: chatDe({ contact: null, messages: [], window: CERRADA }) });
    const vacio = screen.getByTestId('chat-empty');
    expect(within(vacio).getByText('Aún no hay mensajes con este cliente')).toBeTruthy();
    expect(
      within(vacio).getByText(
        'Para iniciar la conversación, WhatsApp exige una plantilla aprobada. Elige una abajo y se rellena el mensaje.',
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId('chat-message-list')).toBeNull();
  });

  it('R33: con mensajes no pinta el vacío', () => {
    pintar();
    expect(screen.queryByTestId('chat-empty')).toBeNull();
    expect(screen.getByTestId('chat-message-list')).toBeTruthy();
  });
});

describe('R4 · errores de carga con «Reintentar»', () => {
  it('R4: error del chat con su mensaje tal cual y «Reintentar» que repite la carga', async () => {
    const user = setupUser();
    const { props: p } = pintar({ chat: null, chatError: ERROR_CATALOGADO });
    const alerta = screen.getByTestId('chat-load-error');
    expect(alerta.getAttribute('role')).toBe('alert');
    expect(within(alerta).getByText(ERROR_CATALOGADO.message)).toBeTruthy();
    await user.click(within(alerta).getByRole('button', { name: 'Reintentar' }));
    expect(p.onRetryChat).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('chat-composer')).toBeNull();
  });

  it('R4: error inesperado del chat con su referencia', () => {
    pintar({ chat: null, chatError: ERROR_INESPERADO });
    const alerta = screen.getByTestId('chat-load-error');
    expect(within(alerta).getByText(ERROR_INESPERADO.message, { exact: false })).toBeTruthy();
    expect(alerta.textContent).toContain('req-abc-123');
    expect(within(alerta).getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });

  it('R4: error del contexto con su mensaje y «Reintentar» que repite su carga, sin tapar el chat', async () => {
    const user = setupUser();
    const { props: p } = pintar({ context: null, contextError: ERROR_CATALOGADO });
    const alerta = screen.getByTestId('chat-context-error');
    expect(within(alerta).getByText(ERROR_CATALOGADO.message)).toBeTruthy();
    await user.click(within(alerta).getByRole('button', { name: 'Reintentar' }));
    expect(p.onRetryContext).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Texto m2')).toBeTruthy();
  });

  it('R4: mientras carga el chat no pinta historial ni caja', () => {
    pintar({ chat: null, chatLoading: true });
    expect(screen.getByTestId('chat-loading')).toBeTruthy();
    expect(screen.queryByTestId('chat-composer')).toBeNull();
  });
});

describe('R49 · sin acciones de vincular, desvincular ni bloquear', () => {
  const fallido = mensaje('f1', 3, {
    direction: 'OUT',
    status: 'FAILED',
    origin: 'USER',
    errorReason: 'Número no válido',
    body: 'Hola',
  });

  const casos: readonly [string, WhatsappChat][] = [
    ['contacto vinculado', chatDe({ messages: [mensaje('m1', 0), fallido] })],
    [
      'contacto bloqueado',
      chatDe({
        contact: { id: CONTACTO, phone: TELEFONO, isBlocked: true, unreadCount: 0 },
        window: CERRADA,
        messages: [mensaje('m1', 0), fallido],
      }),
    ],
    ['sin contacto', chatDe({ contact: null, messages: [], window: CERRADA })],
  ];

  it.each(casos)('R49: con %s ningún botón ni enlace habla de vincular, desvincular o bloquear', (_caso, chat) => {
    pintar({ chat });
    const controles = [...screen.queryAllByRole('button'), ...screen.queryAllByRole('link')];
    expect(controles.length).toBeGreaterThan(0);
    for (const control of controles) {
      const nombre = `${control.getAttribute('aria-label') ?? ''} ${control.textContent ?? ''}`;
      expect(nombre).not.toMatch(PROHIBIDO);
    }
    expect(screen.queryByText(PROHIBIDO)).toBeNull();
  });
});

describe('R25 · mensajes anteriores', () => {
  it('R25: al llegar al inicio pide la página anterior con el cursor y la antepone sin duplicar', async () => {
    let resolver: (value: unknown) => void = () => {};
    actions.getChat.mockReturnValue(new Promise((resolve) => (resolver = resolve)));
    pintar({ chat: chatDe({ nextCursor: 'cursor-1', hasMore: true }) });

    mostrarCentinela();
    expect(actions.getChat).toHaveBeenCalledWith({ target: { contactId: CONTACTO }, before: 'cursor-1', pageSize: 30 });
    expect(screen.getByText('Cargando mensajes anteriores…')).toBeTruthy();

    await act(async () => {
      resolver({ status: 'success', data: chatDe({ messages: [mensaje('m0', -5), mensaje('m1', 0)], nextCursor: null }) });
    });

    const textos = screen.getAllByTestId('chat-message').map((nodo) => nodo.textContent ?? '');
    expect(textos.filter((texto) => texto.includes('Texto m1'))).toHaveLength(1);
    expect(textos[0]).toContain('Texto m0');
    expect(screen.queryByText('Cargando mensajes anteriores…')).toBeNull();
    expect(screen.queryByTestId('chat-older-sentinel')).toBeNull();
  });

  it('R25: un error al pedir anteriores pinta su mensaje y conserva lo cargado', async () => {
    actions.getChat.mockResolvedValue(ERROR_CATALOGADO);
    pintar({ chat: chatDe({ nextCursor: 'cursor-1', hasMore: true }) });
    mostrarCentinela();
    const alerta = await screen.findByTestId('chat-older-error');
    expect(within(alerta).getByText(ERROR_CATALOGADO.message)).toBeTruthy();
    expect(screen.getByText('Texto m2')).toBeTruthy();
  });
});

describe('R41 · reintentar un fallido', () => {
  const fallido = mensaje('f1', 3, {
    direction: 'OUT',
    status: 'FAILED',
    origin: 'USER',
    errorReason: 'Número no válido',
    body: 'Hola',
  });

  it('R41: llama a reintentar con los valores del pedido elegido, añade el devuelto y deja el fallido', async () => {
    const user = setupUser();
    actions.retry.mockResolvedValue({ status: 'success', data: enviado() });
    pintar({ chat: chatDe({ messages: [mensaje('m1', 0), fallido] }) });

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(screen.getByText('Le envío la cotización')).toBeTruthy());
    expect(actions.retry).toHaveBeenCalledWith({
      messageId: 'f1',
      constants: { 'cliente.nombre': 'Laura Gómez', 'pedido.numero': 'PED-00131' },
      constantLabels: { ...constantLabelsForBackend() },
    });
    expect(screen.getByText('No se pudo enviar: Número no válido')).toBeTruthy();
    expect(screen.getAllByTestId('chat-message')).toHaveLength(3);
  });

  it('R41: un error del reintento pinta su mensaje tal cual', async () => {
    const user = setupUser();
    actions.retry.mockResolvedValue(ERROR_CATALOGADO);
    pintar({ chat: chatDe({ messages: [mensaje('m1', 0), fallido] }) });
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    const alerta = await screen.findByTestId('chat-retry-error');
    expect(within(alerta).getByText(ERROR_CATALOGADO.message)).toBeTruthy();
    expect(screen.getAllByTestId('chat-message')).toHaveLength(2);
  });

  it('R41: si la acción no responde (red caída) pinta el error inesperado y deja el fallido', async () => {
    const user = setupUser();
    actions.retry.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    pintar({ chat: chatDe({ messages: [mensaje('m1', 0), fallido] }) });
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    const alerta = await screen.findByTestId('chat-retry-error');
    expect(within(alerta).getByText(errorMessage(UNEXPECTED_ERROR_CODE))).toBeTruthy();
    expect(within(alerta).getByTestId('unexpected-error-notice-reference')).toBeTruthy();
    expect(screen.getAllByTestId('chat-message')).toHaveLength(2);
    expect(screen.getByText('No se pudo enviar: Número no válido')).toBeTruthy();
  });

  it('R41: sin permiso de envío no hay «Reintentar» ni caja', () => {
    pintar({ canSend: false, chat: chatDe({ messages: [mensaje('m1', 0), fallido] }) });
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(screen.queryByTestId('chat-composer')).toBeNull();
  });
});

describe('R32 · saliente provisional desde la caja', () => {
  it('R32: el texto enviado aparece en el historial y se reemplaza por el devuelto', async () => {
    const user = setupUser();
    let resolver: (value: unknown) => void = () => {};
    actions.send.mockReturnValue(new Promise((resolve) => (resolver = resolve)));
    pintar();

    await user.type(screen.getByRole('textbox', { name: 'Mensaje' }), 'Le envío la cotización');
    await user.keyboard('{Enter}');
    expect(screen.getByText('Le envío la cotización')).toBeTruthy();
    expect(screen.getAllByTestId('chat-message')).toHaveLength(3);

    await act(async () => {
      resolver({ status: 'success', data: enviado() });
    });
    expect(screen.getAllByTestId('chat-message')).toHaveLength(3);
    expect(screen.getByText('Le envío la cotización')).toBeTruthy();
  });
});
