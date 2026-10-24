// Diálogo «Enviar plantilla»: selector de plantilla, selector «Pedido» solo con más de un pedido
// abierto, vista previa ya resuelta sin pedir variables y envío desde el diálogo.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatComposer, type ChatComposerProps } from '@/app/(private)/clientes/contactos/components/chat-composer';
import type { ChatContextView, ChatMessageView, ChatOrderView } from '@/app/(private)/clientes/contactos/components/chat-view';
import {
  SendTemplateDialog,
  type SendTemplateDialogProps,
} from '@/app/(private)/clientes/contactos/components/send-template-dialog';
import { errorMessage, UNEXPECTED_ERROR_CODE } from '@/lib/modules/errores';
import type { WhatsappSendableTemplate } from '@/lib/modules/integraciones';
import { constantLabelsForBackend } from '@/lib/shared/ui/whatsapp-system-constants';

import { esperarInteractiva, setupUser } from '../../helpers/user-event';

const sendMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/modules/integraciones/adapters/driving/whatsapp-message-actions', () => ({
  sendWhatsappMessageAction: sendMock,
  retryWhatsappMessageAction: vi.fn(),
}));

const CLIENTE = '22222222-2222-4222-8222-222222222222';

type Variable = WhatsappSendableTemplate['variables'][number];

function sistema(key: string): Variable {
  return { slot: `body.${key}`, position: 1, kind: 'system', key, label: null, value: null };
}

function propia(key: string): Variable {
  return { slot: `body.${key}`, position: 2, kind: 'company', key, label: 'Horario', value: 'de 8 a 17 h' };
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

const LISTO = plantilla('t-listo', 'pedido_listo', 'Hola {{cliente.nombre}}, tu pedido {{pedido.numero}} está listo. Atendemos {{horario}}.', [
  sistema('cliente.nombre'),
  sistema('pedido.numero'),
  propia('horario'),
]);
const TOTAL = plantilla('t-total', 'total_pedido', 'Tu pedido {{pedido.numero}} suma {{pedido.total}}.', [
  sistema('pedido.numero'),
  sistema('pedido.total'),
]);

function pedido(id: string, number: string): ChatOrderView {
  return { id, number, statusLabel: 'En producción', productName: null, totalLabel: null, lines: [] };
}

function contexto(orders: readonly ChatOrderView[], numero = 'PED-00131'): ChatContextView {
  return {
    orders,
    selectedOrderId: orders[0]?.id ?? null,
    values: { 'cliente.nombre': 'Laura Gómez', 'pedido.numero': numero, 'pedido.total': null, horario: 'de 8 a 17 h' },
  };
}

function pintar(overrides: Partial<SendTemplateDialogProps> = {}) {
  const props: SendTemplateDialogProps = {
    open: true,
    onOpenChange: vi.fn(),
    templates: [LISTO, TOTAL],
    context: contexto([pedido('p131', 'PED-00131')]),
    contextLoading: false,
    onSelectOrder: vi.fn(),
    sending: false,
    failure: null,
    onSend: vi.fn(),
    ...overrides,
  };
  const view = render(<SendTemplateDialog {...props} />);
  return { ...view, props };
}

const dialogo = () => screen.getByRole('dialog', { name: 'Enviar plantilla' });
const vistaPrevia = () => within(dialogo()).getByRole('img');
const botonEnviar = () => within(dialogo()).getByRole('button', { name: 'Enviar plantilla' });

async function elegirPlantilla(user: ReturnType<typeof setupUser>, name: string) {
  await user.click(within(dialogo()).getByRole('combobox', { name: 'Plantilla' }));
  await user.click(await esperarInteractiva(await screen.findByRole('option', { name })));
}

beforeEach(() => sendMock.mockReset());
afterEach(() => cleanup());

describe('R31 · diálogo «Enviar plantilla»', () => {
  it('R31: el selector de plantilla lista solo las enviables, por su nombre', async () => {
    const user = setupUser();
    pintar();
    await user.click(within(dialogo()).getByRole('combobox', { name: 'Plantilla' }));
    const opciones = await screen.findAllByRole('option');
    expect(opciones.map((opcion) => opcion.textContent)).toEqual(['pedido_listo', 'total_pedido']);
  });

  it('R31: la vista previa trae el texto ya resuelto y no hay ningún campo de variables', () => {
    pintar();
    expect(vistaPrevia().getAttribute('aria-label')).toBe(
      'Vista previa del mensaje: Hola Laura Gómez, tu pedido PED-00131 está listo. Atendemos de 8 a 17 h.',
    );
    expect(within(dialogo()).queryByRole('textbox')).toBeNull();
    expect(within(dialogo()).queryByRole('spinbutton')).toBeNull();
  });

  it('R31: con un solo pedido abierto no hay selector «Pedido»', () => {
    pintar();
    expect(within(dialogo()).queryByRole('combobox', { name: 'Pedido' })).toBeNull();
  });

  it('R31: sin pedidos abiertos tampoco hay selector «Pedido»', () => {
    pintar({ context: contexto([]) });
    expect(within(dialogo()).queryByRole('combobox', { name: 'Pedido' })).toBeNull();
  });

  it('R31: con más de uno, el selector «Pedido» lleva el pedido elegido en el chat y cambiarlo avisa al padre', async () => {
    const user = setupUser();
    const orders = [pedido('p131', 'PED-00131'), pedido('p124', 'PED-00124')];
    const { props } = pintar({ context: { ...contexto(orders), selectedOrderId: 'p124' } });
    const selector = within(dialogo()).getByRole('combobox', { name: 'Pedido' });
    expect(selector.textContent).toContain('PED-00124');

    await user.click(selector);
    await user.click(await esperarInteractiva(await screen.findByRole('option', { name: 'PED-00131' })));
    expect(props.onSelectOrder).toHaveBeenCalledWith('p131');
  });

  it('R34: la vista previa sigue los `values` del pedido nuevo y no se puede editar', () => {
    const orders = [pedido('p131', 'PED-00131'), pedido('p124', 'PED-00124')];
    const { props, rerender } = pintar({ context: contexto(orders) });
    expect(vistaPrevia().getAttribute('aria-label')).toContain('PED-00131');

    rerender(<SendTemplateDialog {...props} context={{ ...contexto(orders, 'PED-00124'), selectedOrderId: 'p124' }} />);
    expect(vistaPrevia().getAttribute('aria-label')).toContain('PED-00124');
    expect(within(dialogo()).queryByRole('textbox')).toBeNull();
  });

  it('R36: con `[falta pedido.total]` el envío queda deshabilitado y dice «Falta el valor de …»', async () => {
    const user = setupUser();
    const { props } = pintar();
    await elegirPlantilla(user, 'total_pedido');
    expect(vistaPrevia().getAttribute('aria-label')).toBe('Vista previa del mensaje: Tu pedido PED-00131 suma [falta pedido.total].');
    expect(botonEnviar().hasAttribute('disabled')).toBe(true);
    expect(within(dialogo()).getByTestId('send-template-missing').textContent).toBe('Falta el valor de Total del pedido');
    await user.click(botonEnviar());
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it('R36: muestra el `message` de un `missing_values` devuelto por la acción', () => {
    pintar({ failure: { status: 'missing_values', message: 'Falta el valor de Horario' } });
    expect(within(dialogo()).getByTestId('send-template-error').textContent).toBe('Falta el valor de Horario');
  });

  it('R40: muestra el `message` del error de la acción', () => {
    pintar({ failure: { status: 'error', code: 'unauthorized', message: 'No tienes permiso para esta acción.' } });
    expect(within(dialogo()).getByTestId('send-template-error').textContent).toContain('No tienes permiso para esta acción.');
  });
});

describe('R37 · envío desde el diálogo', () => {
  function pintarCaja(overrides: Partial<ChatComposerProps> = {}) {
    const props: ChatComposerProps = {
      contactId: null,
      customerId: CLIENTE,
      canSend: true,
      window: { open: false, closesAt: null },
      hasMessages: true,
      templates: [LISTO, TOTAL],
      context: contexto([pedido('p131', 'PED-00131')]),
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

  it('R37: envía por cliente con las constantes de `values` (sin las propias), cierra el diálogo y recarga', async () => {
    const user = setupUser();
    sendMock.mockResolvedValue({
      status: 'success',
      data: {
        id: '33333333-3333-4333-8333-333333333333',
        type: 'TEMPLATE',
        status: 'SENT',
        body: 'Hola Laura Gómez, tu pedido PED-00131 está listo. Atendemos de 8 a 17 h.',
        templateName: 'pedido_listo',
        templateLanguage: 'es_MX',
        errorCode: null,
        errorReason: null,
        createdAt: '2026-10-23T15:00:00.000Z',
      },
    });
    const props = pintarCaja();
    await user.click(screen.getByRole('button', { name: 'Enviar plantilla' }));
    await user.click(await esperarInteractiva(botonEnviar()));

    await waitFor(() => expect(props.onSent).toHaveBeenCalledTimes(1));
    expect(sendMock).toHaveBeenCalledWith({
      kind: 'template',
      recipient: { customerId: CLIENTE },
      templateId: 't-listo',
      constants: { 'cliente.nombre': 'Laura Gómez', 'pedido.numero': 'PED-00131' },
      constantLabels: { ...constantLabelsForBackend() },
    });
    const provisional = vi.mocked(props.onOptimistic).mock.calls[0]?.[0] as ChatMessageView;
    expect(provisional).toMatchObject({
      delivery: 'sending',
      content: { kind: 'text', text: 'Hola Laura Gómez, tu pedido PED-00131 está listo. Atendemos de 8 a 17 h.' },
    });
    expect(vi.mocked(props.onSent).mock.calls[0]?.[0]).toBe(provisional.id);
    expect(props.onReloadChat).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('R40: con error el diálogo sigue abierto, quita el provisional y muestra el `message`', async () => {
    const user = setupUser();
    sendMock.mockResolvedValue({ status: 'error', code: 'unauthorized', message: 'No tienes permiso para esta acción.' });
    const props = pintarCaja();
    await user.click(screen.getByRole('button', { name: 'Enviar plantilla' }));
    await user.click(await esperarInteractiva(botonEnviar()));

    await waitFor(() => expect(props.onSendFailed).toHaveBeenCalledTimes(1));
    expect(within(dialogo()).getByTestId('send-template-error').textContent).toContain('No tienes permiso para esta acción.');
    expect(props.onSent).not.toHaveBeenCalled();
    expect(props.onReloadChat).not.toHaveBeenCalled();
  });

  it('R40: si la acción no responde (red caída) el diálogo sigue abierto, quita el provisional y pinta el error inesperado', async () => {
    const user = setupUser();
    sendMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const props = pintarCaja();
    await user.click(screen.getByRole('button', { name: 'Enviar plantilla' }));
    await user.click(await esperarInteractiva(botonEnviar()));

    await waitFor(() => expect(props.onSendFailed).toHaveBeenCalledTimes(1));
    const alerta = within(dialogo()).getByTestId('send-template-error');
    expect(alerta.textContent).toContain(errorMessage(UNEXPECTED_ERROR_CODE));
    expect(within(alerta).getByTestId('unexpected-error-notice-reference')).toBeTruthy();
    expect(props.onSent).not.toHaveBeenCalled();
    expect(props.onReloadChat).not.toHaveBeenCalled();
    expect(botonEnviar().hasAttribute('disabled')).toBe(false);
  });
});
