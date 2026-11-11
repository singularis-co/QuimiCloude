// QT-314 T12 — El diálogo de cancelar una sola receta del pedido.
//
// `cancelOrderLineAction` es un doble espía; las demás acciones revientan si se las llama.

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CANCEL_ORDER_LINE_CONFIRM_TESTID,
  CANCEL_ORDER_LINE_DIALOG_TESTID,
  CANCEL_ORDER_LINE_ERROR_TESTID,
  CANCEL_ORDER_LINE_FORM_TESTID,
  CANCEL_ORDER_LINE_ID_FIELD,
  CANCEL_ORDER_LINE_LINE_ID_FIELD,
  CANCEL_ORDER_LINE_MESSAGE_TESTID,
  CANCEL_ORDER_LINE_REASON_FIELD,
  CANCEL_ORDER_LINE_REASON_TESTID,
  CancelOrderLineDialog,
} from '@/app/(private)/pedidos/components';
import type { OrderMutationFormState } from '@/lib/modules/pedidos/adapters/driving/order-actions';

import { setupUser } from '../../helpers/user-event';

const { cancelOrderLineActionMock, routerMock } = vi.hoisted(() => ({
  cancelOrderLineActionMock:
    vi.fn<(prev: OrderMutationFormState, data: FormData) => Promise<OrderMutationFormState>>(),
  routerMock: {
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => routerMock,
}));

vi.mock('@/lib/modules/pedidos/adapters/driving/order-actions', () => {
  const noDebeInvocarse = (nombre: string) => () => {
    throw new Error(`${nombre} no debe invocarse desde el dialogo de cancelar una receta`);
  };
  return {
    cancelOrderLineAction: cancelOrderLineActionMock,
    cancelOrderAction: vi.fn(noDebeInvocarse('cancelOrderAction')),
    listOrdersAction: vi.fn(noDebeInvocarse('listOrdersAction')),
    getOrderAction: vi.fn(noDebeInvocarse('getOrderAction')),
    createOrderAction: vi.fn(noDebeInvocarse('createOrderAction')),
    updateOrderAction: vi.fn(noDebeInvocarse('updateOrderAction')),
    deleteOrderAction: vi.fn(noDebeInvocarse('deleteOrderAction')),
  };
});

const PEDIDO = { id: '11111111-1111-4111-8111-111111111111', numberText: '2026-000042' };
const RECETA = { id: '50000000-0000-4000-8000-000000000002', recipeName: 'Desengrasante' };
const MOTIVO = 'El cliente ya no la quiere';

const cerrar = vi.fn<(open: boolean) => void>();

function seCerro(): boolean {
  return cerrar.mock.calls.some(([abierto]) => abierto === false);
}

let toastExito: ReturnType<typeof vi.spyOn>;

function montar() {
  render(<CancelOrderLineDialog order={PEDIDO} line={RECETA} open onOpenChange={cerrar} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  cancelOrderLineActionMock.mockResolvedValue({ status: 'success' });
  toastExito = vi.spyOn(toast, 'success');
});

afterEach(() => {
  cleanup();
  toast.dismiss();
  vi.restoreAllMocks();
});

describe('el diálogo nombra la receta y el pedido (R28)', () => {
  it('R28: título, receta, pedido y textos del tablero', () => {
    montar();

    expect(screen.getByRole('alertdialog', { name: 'Cancelar la receta' })).toBe(
      screen.getByTestId(CANCEL_ORDER_LINE_DIALOG_TESTID),
    );
    const mensaje = screen.getByTestId(CANCEL_ORDER_LINE_MESSAGE_TESTID);
    expect(mensaje).toHaveTextContent(
      'Se va a cancelar Desengrasante del pedido 2026-000042 y se libera su material. Las demás recetas siguen igual.',
    );
    expect(screen.getByLabelText('Motivo de la cancelación')).toBe(
      screen.getByTestId(CANCEL_ORDER_LINE_REASON_TESTID),
    );
    expect(screen.getByTestId(CANCEL_ORDER_LINE_REASON_TESTID)).toHaveAccessibleDescription(
      'Entre 1 y 500 caracteres.',
    );
    expect(screen.getByTestId(CANCEL_ORDER_LINE_CONFIRM_TESTID)).toHaveTextContent(/^Cancelar la receta$/);
  });
});

describe('sin motivo no se invoca nada (R28)', () => {
  it('R28: confirmar está deshabilitado con el motivo vacío o de solo espacios', async () => {
    const user = setupUser();
    montar();

    expect(screen.getByTestId(CANCEL_ORDER_LINE_CONFIRM_TESTID)).toBeDisabled();
    await user.type(screen.getByTestId(CANCEL_ORDER_LINE_REASON_TESTID), '   ');
    expect(screen.getByTestId(CANCEL_ORDER_LINE_CONFIRM_TESTID)).toBeDisabled();
    expect(cancelOrderLineActionMock).not.toHaveBeenCalled();
  });

  it('R28: un motivo de más de 500 caracteres no llega a la operación', async () => {
    montar();
    const campo = screen.getByTestId(CANCEL_ORDER_LINE_REASON_TESTID) as HTMLTextAreaElement;
    // Pegado y no tecleado: 501 teclas hacen el caso lento sin probar nada más.
    const user = setupUser();
    await user.click(campo);
    await user.paste('a'.repeat(501));

    (screen.getByTestId(CANCEL_ORDER_LINE_FORM_TESTID) as HTMLFormElement).requestSubmit();

    expect(await screen.findByTestId(CANCEL_ORDER_LINE_ERROR_TESTID)).toBeInTheDocument();
    expect(cancelOrderLineActionMock).not.toHaveBeenCalled();
  });
});

describe('confirmar envía el pedido, la receta y el motivo (R28)', () => {
  it('R28: llama a `cancelOrderLineAction` con `id`, `lineId` y `reason`', async () => {
    const user = setupUser();
    montar();

    await user.type(screen.getByTestId(CANCEL_ORDER_LINE_REASON_TESTID), MOTIVO);
    await user.click(screen.getByTestId(CANCEL_ORDER_LINE_CONFIRM_TESTID));

    await waitFor(() => expect(cancelOrderLineActionMock).toHaveBeenCalledTimes(1));
    const enviado = cancelOrderLineActionMock.mock.calls[0]?.[1] as FormData;
    expect(enviado.get(CANCEL_ORDER_LINE_ID_FIELD)).toBe(PEDIDO.id);
    expect(enviado.get(CANCEL_ORDER_LINE_LINE_ID_FIELD)).toBe(RECETA.id);
    expect(enviado.get(CANCEL_ORDER_LINE_REASON_FIELD)).toBe(MOTIVO);
  });

  it('R28: con éxito cierra, avisa con un toast y refresca el listado', async () => {
    const user = setupUser();
    montar();

    await user.type(screen.getByTestId(CANCEL_ORDER_LINE_REASON_TESTID), MOTIVO);
    await user.click(screen.getByTestId(CANCEL_ORDER_LINE_CONFIRM_TESTID));

    await waitFor(() => expect(seCerro()).toBe(true));
    expect(toastExito).toHaveBeenCalledWith('Receta cancelada. Su material quedó libre.');
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
    expect(routerMock.push).not.toHaveBeenCalled();
  });
});

describe('un rechazo se queda en el diálogo (R28)', () => {
  it('R28: muestra el mensaje del catálogo, no se cierra y conserva el motivo escrito', async () => {
    const user = setupUser();
    cancelOrderLineActionMock.mockResolvedValue({
      status: 'error',
      code: 'not_cancellable',
      message: 'Este pedido ya no se puede cancelar.',
    });
    montar();

    await user.type(screen.getByTestId(CANCEL_ORDER_LINE_REASON_TESTID), MOTIVO);
    await user.click(screen.getByTestId(CANCEL_ORDER_LINE_CONFIRM_TESTID));

    const region = await screen.findByTestId(CANCEL_ORDER_LINE_ERROR_TESTID);
    expect(region).toHaveAttribute('data-code', 'not_cancellable');
    expect(region).toHaveTextContent('Este pedido ya no se puede cancelar.');
    expect(screen.getByTestId(CANCEL_ORDER_LINE_DIALOG_TESTID)).toContainElement(region);
    expect(seCerro()).toBe(false);
    expect(toastExito).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
    expect(screen.getByTestId(CANCEL_ORDER_LINE_REASON_TESTID)).toHaveValue(MOTIVO);
  });
});
