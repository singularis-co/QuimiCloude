// Caja del chat: texto con la ventana abierta, aviso y «Enviar plantilla» con la ventana cerrada,
// burbujas de plantillas en un chat sin mensajes, envío con saliente provisional y errores.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatComposer, type ChatComposerProps } from '@/app/(private)/clientes/contactos/components/chat-composer';
import type { ChatContextView, ChatMessageView } from '@/app/(private)/clientes/contactos/components/chat-view';
import { errorMessage, UNEXPECTED_ERROR_CODE } from '@/lib/modules/errores';
import type { WhatsappOutboundMessageView, WhatsappSendableTemplate } from '@/lib/modules/integraciones';
import { constantLabelsForBackend } from '@/lib/shared/ui/whatsapp-system-constants';

import { setupUser } from '../../helpers/user-event';

const sendMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/modules/integraciones/adapters/driving/whatsapp-message-actions', () => ({
  sendWhatsappMessageAction: sendMock,
  retryWhatsappMessageAction: vi.fn(),
}));

const CONTACTO = '11111111-1111-4111-8111-111111111111';
const CLIENTE = '22222222-2222-4222-8222-222222222222';
const ABIERTA = { open: true, closesAt: new Date(Date.now() + 3_600_000).toISOString() } as const;
const CERRADA = { open: false, closesAt: null } as const;

type Variable = WhatsappSendableTemplate['variables'][number];

function sistema(key: string): Variable {
  return { slot: `body.${key}`, position: 1, kind: 'system', key, label: null, value: null };
}

function plantilla(id: string, name: string, body: string, variables: readonly Variable[]): WhatsappSendableTemplate {
  return {
    id,
    name,
    language: 'es_MX',
    category: 'UTILITY',
    content: { header: null, body: { text: body, examples: [] }, footer: null, buttons: [] },
    variables,
  };
}

const SALUDO = plantilla('t-saludo', 'saludo_inicial', 'Hola {{cliente.nombre}}, somos {{empresa.nombre}}.', [
  sistema('cliente.nombre'),
  sistema('empresa.nombre'),
]);
const TOTAL = plantilla('t-total', 'total_pedido', 'Tu pedido {{pedido.numero}} suma {{pedido.total}}.', [
  sistema('pedido.numero'),
  sistema('pedido.total'),
]);

const CONTEXTO: ChatContextView = {
  orders: [],
  selectedOrderId: null,
  values: {
    'cliente.nombre': 'Laura Gómez',
    'empresa.nombre': 'Químicos del Sur',
    'pedido.numero': 'PED-00131',
    'pedido.total': null,
  },
};

function enviado(overrides: Partial<WhatsappOutboundMessageView> = {}): WhatsappOutboundMessageView {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    type: 'TEXT',
    status: 'SENT',
    body: 'Hola',
    templateName: null,
    templateLanguage: null,
    errorCode: null,
    errorReason: null,
    createdAt: '2026-10-23T15:00:00.000Z',
    ...overrides,
  };
}

function pintar(overrides: Partial<ChatComposerProps> = {}) {
  const props: ChatComposerProps = {
    contactId: CONTACTO,
    customerId: CLIENTE,
    canSend: true,
    window: ABIERTA,
    hasMessages: true,
    templates: [SALUDO, TOTAL],
    context: CONTEXTO,
    contextLoading: false,
    onSelectOrder: vi.fn(),
    onOptimistic: vi.fn(),
    onSent: vi.fn(),
    onSendFailed: vi.fn(),
    onReloadChat: vi.fn(),
    ...overrides,
  };
  render(<ChatComposer {...props} />);
  return props;
}

const caja = () => screen.getByRole('textbox', { name: 'Mensaje' }) as HTMLTextAreaElement;
const enviar = () => screen.getByRole('button', { name: 'Enviar' });

beforeEach(() => {
  sendMock.mockReset();
  sendMock.mockResolvedValue({ status: 'success', data: enviado() });
});

afterEach(() => cleanup());

describe('R29 · caja de texto con la ventana abierta', () => {
  it('R29: pinta «Escribe un mensaje» y «Enviar»', () => {
    pintar();
    expect(caja().getAttribute('placeholder')).toBe('Escribe un mensaje');
    expect(enviar()).toBeTruthy();
  });

  it('R29: Enter envía el texto al contacto', async () => {
    const user = setupUser();
    pintar();
    await user.type(caja(), 'Hola');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(sendMock).toHaveBeenCalledTimes(1));
    expect(sendMock).toHaveBeenCalledWith({ kind: 'text', recipient: { contactId: CONTACTO }, text: 'Hola' });
  });

  it('R29: Shift+Enter inserta un salto de línea y no envía', async () => {
    const user = setupUser();
    pintar();
    await user.type(caja(), 'Hola');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(caja(), 'mundo');
    expect(caja().value).toBe('Hola\nmundo');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('R29: Enter durante una composición IME no envía', () => {
    pintar();
    fireEvent.change(caja(), { target: { value: 'Hola' } });
    fireEvent.keyDown(caja(), { key: 'Enter', isComposing: true });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('R29: vacío o solo espacios no se puede enviar', async () => {
    const user = setupUser();
    pintar();
    expect(enviar().hasAttribute('disabled')).toBe(true);
    await user.type(caja(), '   ');
    expect(enviar().hasAttribute('disabled')).toBe(true);
    await user.keyboard('{Enter}');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('R29: con más de 4096 caracteres no se puede enviar; con 4096 sí', () => {
    pintar();
    fireEvent.change(caja(), { target: { value: 'a'.repeat(4097) } });
    expect(enviar().hasAttribute('disabled')).toBe(true);
    expect(caja().getAttribute('aria-invalid')).toBe('true');
    fireEvent.keyDown(caja(), { key: 'Enter' });
    expect(sendMock).not.toHaveBeenCalled();

    fireEvent.change(caja(), { target: { value: 'a'.repeat(4096) } });
    expect(enviar().hasAttribute('disabled')).toBe(false);
  });
});

describe('R32 · saliente provisional del texto', () => {
  it('R32: muestra el provisional «Enviando», vacía la caja y lo reemplaza por el devuelto', async () => {
    const user = setupUser();
    let responder: (value: unknown) => void = () => {};
    sendMock.mockReturnValue(new Promise((resolve) => (responder = resolve)));
    const props = pintar();
    await user.type(caja(), 'Hola');
    await user.click(enviar());

    expect(props.onOptimistic).toHaveBeenCalledTimes(1);
    const provisional = vi.mocked(props.onOptimistic).mock.calls[0]?.[0] as ChatMessageView;
    expect(provisional.id).toMatch(/^pending:\d+$/);
    expect(provisional.delivery).toBe('sending');
    expect(provisional.content).toEqual({ kind: 'text', text: 'Hola' });
    expect(caja().value).toBe('');

    responder({ status: 'success', data: enviado({ status: 'FAILED', errorReason: 'Número no válido' }) });
    await waitFor(() => expect(props.onSent).toHaveBeenCalledTimes(1));
    const [pendingId, devuelto] = vi.mocked(props.onSent).mock.calls[0] ?? [];
    expect(pendingId).toBe(provisional.id);
    expect(devuelto).toMatchObject({
      id: '33333333-3333-4333-8333-333333333333',
      delivery: 'failed',
      errorReason: 'Número no válido',
      retryable: true,
    });
    expect(props.onSendFailed).not.toHaveBeenCalled();
  });
});

describe('R40 · error del envío', () => {
  it('R40: quita el provisional, devuelve el texto a la caja y muestra el `message`', async () => {
    const user = setupUser();
    sendMock.mockResolvedValue({ status: 'error', code: 'unauthorized', message: 'No tienes permiso para esta acción.' });
    const props = pintar();
    await user.type(caja(), 'Hola');
    await user.click(enviar());

    await waitFor(() => expect(props.onSendFailed).toHaveBeenCalledTimes(1));
    const provisional = vi.mocked(props.onOptimistic).mock.calls[0]?.[0] as ChatMessageView;
    expect(props.onSendFailed).toHaveBeenCalledWith(provisional.id);
    expect(props.onSent).not.toHaveBeenCalled();
    expect(caja().value).toBe('Hola');
    expect(screen.getByTestId('chat-composer-error').textContent).toContain('No tienes permiso para esta acción.');
  });

  it('R40: si la acción no responde (red caída) quita el provisional, devuelve el texto y pinta el error inesperado', async () => {
    const user = setupUser();
    sendMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const props = pintar();
    await user.type(caja(), 'Hola');
    await user.click(enviar());

    await waitFor(() => expect(props.onSendFailed).toHaveBeenCalledTimes(1));
    const provisional = vi.mocked(props.onOptimistic).mock.calls[0]?.[0] as ChatMessageView;
    expect(props.onSendFailed).toHaveBeenCalledWith(provisional.id);
    expect(props.onSent).not.toHaveBeenCalled();
    expect(caja().value).toBe('Hola');
    const alerta = screen.getByTestId('chat-composer-error');
    expect(alerta.textContent).toContain(errorMessage(UNEXPECTED_ERROR_CODE));
    expect(within(alerta).getByTestId('unexpected-error-notice-reference')).toBeTruthy();
    expect(enviar().hasAttribute('disabled')).toBe(false);
  });
});

describe('R30 · ventana cerrada con mensajes', () => {
  it('R30: caja deshabilitada, aviso y «Enviar plantilla»', () => {
    pintar({ window: CERRADA });
    expect(caja().hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('status').textContent).toBe(
      'Pasaron más de 24 h desde el último mensaje del cliente: solo puedes enviar una plantilla aprobada.',
    );
    expect(screen.getByRole('button', { name: 'Enviar plantilla' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enviar' })).toBeNull();
  });

  it('R16 · R30: al llegar `closesAt` la caja pasa sola a ventana cerrada sin nueva consulta', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 23, 10, 0) });
    try {
      pintar({ window: { open: true, closesAt: new Date(2026, 9, 23, 10, 2).toISOString() } });
      act(() => vi.advanceTimersByTime(60_000));
      expect(caja().hasAttribute('disabled')).toBe(false);
      expect(screen.getByRole('button', { name: 'Enviar' })).toBeTruthy();
      act(() => vi.advanceTimersByTime(60_001));
      expect(caja().hasAttribute('disabled')).toBe(true);
      expect(screen.getByRole('status').textContent).toContain('solo puedes enviar una plantilla aprobada');
      expect(screen.getByRole('button', { name: 'Enviar plantilla' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Enviar' })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('R16 · R30: con una ventana que cierra en más de 24,8 días no la da por cerrada antes de tiempo', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 23, 10, 0) });
    try {
      const closesAt = new Date(2026, 9, 23, 10, 0).getTime() + 30 * 86_400_000;
      pintar({ window: { open: true, closesAt: new Date(closesAt).toISOString() } });
      act(() => vi.advanceTimersByTime(25 * 86_400_000));
      expect(caja().hasAttribute('disabled')).toBe(false);
      act(() => vi.advanceTimersByTime(5 * 86_400_000 + 1));
      expect(caja().hasAttribute('disabled')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('R31: «Enviar plantilla» abre el diálogo', async () => {
    const user = setupUser();
    pintar({ window: CERRADA });
    await user.click(screen.getByRole('button', { name: 'Enviar plantilla' }));
    expect(await screen.findByRole('dialog', { name: 'Enviar plantilla' })).toBeTruthy();
  });
});

describe('R33 · burbujas de plantillas en un chat sin mensajes', () => {
  const grupo = () => screen.getByRole('group', { name: 'Plantillas aprobadas' });
  const burbuja = (name: string) => within(grupo()).getByRole('button', { name });

  it('R33: una burbuja por plantilla enviable, con su nombre, que bajan de línea', () => {
    pintar({ hasMessages: false, window: CERRADA });
    expect(within(grupo()).getAllByRole('button').map((boton) => boton.textContent)).toEqual([
      'saludo_inicial',
      'total_pedido',
    ]);
    expect(grupo().className).toContain('flex-wrap');
  });

  it('R33: elegir una rellena la caja y la marca con `aria-pressed`; pulsarla otra vez la vacía', async () => {
    const user = setupUser();
    pintar({ hasMessages: false, window: CERRADA });
    expect(burbuja('saludo_inicial').getAttribute('aria-pressed')).toBe('false');

    await user.click(burbuja('saludo_inicial'));
    expect(burbuja('saludo_inicial').getAttribute('aria-pressed')).toBe('true');
    expect(caja().value).toBe('Hola Laura Gómez, somos Químicos del Sur.');

    await user.click(burbuja('saludo_inicial'));
    expect(burbuja('saludo_inicial').getAttribute('aria-pressed')).toBe('false');
    expect(caja().value).toBe('');
  });

  it('R34: con una plantilla elegida el texto resuelto es de solo lectura', async () => {
    const user = setupUser();
    pintar({ hasMessages: false, window: CERRADA });
    await user.click(burbuja('saludo_inicial'));
    expect(caja().readOnly).toBe(true);
    await user.type(caja(), 'xyz');
    expect(caja().value).toBe('Hola Laura Gómez, somos Químicos del Sur.');
  });

  it('R36: con `[falta pedido.total]` el envío queda deshabilitado y dice «Falta el valor de …»', async () => {
    const user = setupUser();
    pintar({ hasMessages: false, window: CERRADA });
    await user.click(burbuja('total_pedido'));
    expect(caja().value).toBe('Tu pedido PED-00131 suma [falta pedido.total].');
    expect(screen.getByRole('button', { name: 'Enviar plantilla' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('chat-composer-missing').textContent).toBe('Falta el valor de Total del pedido');
  });

  it('R37: envía al cliente sin conversación con `constants` de `values`, vacía la caja y recarga el chat', async () => {
    const user = setupUser();
    sendMock.mockResolvedValue({ status: 'success', data: enviado({ type: 'TEMPLATE', body: 'Hola Laura Gómez, somos Químicos del Sur.' }) });
    const props = pintar({ contactId: null, hasMessages: false, window: CERRADA });
    await user.click(burbuja('saludo_inicial'));
    await user.click(screen.getByRole('button', { name: 'Enviar plantilla' }));

    await waitFor(() => expect(props.onSent).toHaveBeenCalledTimes(1));
    expect(sendMock).toHaveBeenCalledWith({
      kind: 'template',
      recipient: { customerId: CLIENTE },
      templateId: 't-saludo',
      constants: { 'cliente.nombre': 'Laura Gómez', 'empresa.nombre': 'Químicos del Sur' },
      constantLabels: { ...constantLabelsForBackend() },
    });
    const provisional = vi.mocked(props.onOptimistic).mock.calls[0]?.[0] as ChatMessageView;
    expect(provisional.delivery).toBe('sending');
    expect(provisional.content).toEqual({ kind: 'text', text: 'Hola Laura Gómez, somos Químicos del Sur.' });
    expect(props.onReloadChat).toHaveBeenCalledTimes(1);
    expect(caja().value).toBe('');
    expect(burbuja('saludo_inicial').getAttribute('aria-pressed')).toBe('false');
  });

  it('R37: con contacto se envía por `contactId` y no se recarga el chat', async () => {
    const user = setupUser();
    const props = pintar({ hasMessages: false, window: CERRADA });
    await user.click(burbuja('saludo_inicial'));
    await user.click(screen.getByRole('button', { name: 'Enviar plantilla' }));
    await waitFor(() => expect(props.onSent).toHaveBeenCalledTimes(1));
    expect(sendMock.mock.calls[0]?.[0]).toMatchObject({ recipient: { contactId: CONTACTO } });
    expect(props.onReloadChat).not.toHaveBeenCalled();
  });

  it('R36: si la acción devuelve `missing_values`, muestra su `message` y no deja saliente', async () => {
    const user = setupUser();
    sendMock.mockResolvedValue({
      status: 'missing_values',
      message: 'Falta el valor de Nombre del cliente',
      missing: [{ key: 'cliente.nombre', label: 'Nombre del cliente' }],
    });
    const props = pintar({ hasMessages: false, window: CERRADA });
    await user.click(burbuja('saludo_inicial'));
    await user.click(screen.getByRole('button', { name: 'Enviar plantilla' }));
    await waitFor(() => expect(screen.getByTestId('chat-composer-error').textContent).toBe('Falta el valor de Nombre del cliente'));
    const provisional = vi.mocked(props.onOptimistic).mock.calls[0]?.[0] as ChatMessageView;
    expect(props.onSendFailed).toHaveBeenCalledWith(provisional.id);
    expect(props.onSent).not.toHaveBeenCalled();
  });
});

describe('R47 · sin `whatsapp.enviar`', () => {
  it('R47: con la ventana abierta no hay caja ni «Enviar»', () => {
    pintar({ canSend: false });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('R47: en un chat sin mensajes no hay burbujas de plantillas', () => {
    pintar({ canSend: false, hasMessages: false, window: CERRADA });
    expect(screen.queryByRole('group', { name: 'Plantillas aprobadas' })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('R47: con la ventana cerrada no hay «Enviar plantilla»', () => {
    pintar({ canSend: false, window: CERRADA });
    expect(screen.queryByRole('button', { name: 'Enviar plantilla' })).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
