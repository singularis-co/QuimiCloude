// El dialogo de anulacion con la Server Action doblada: casillas, avisos previos, clave, respuestas.
// Los controles se localizan por `data-testid`; el copy solo se afirma donde el diseño lo fija
// (el toast «Entrega anulada»).

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DELIVERY_VOID_CONFIRM_TESTID,
  DELIVERY_VOID_DIALOG_TESTID,
  DELIVERY_VOID_DISMISS_TESTID,
  DELIVERY_VOID_EMPTY_ERROR_TESTID,
  DELIVERY_VOID_ERROR_TESTID,
  DELIVERY_VOID_PRESENTATION_TESTID,
  DELIVERY_VOID_REASON_ERROR_TESTID,
  DELIVERY_VOID_REASON_TESTID,
  DELIVERY_VOID_REASON_TOO_LONG_TESTID,
  DELIVERY_VOID_REJECTED_TESTID,
  DeliveryVoidDialog,
  type OrderDeliveryHistoryEntry,
} from '@/app/(private)/pedidos/components';
import type { VoidDeliveryActionResult } from '@/lib/modules/pedidos/adapters/driving/order-actions';

import {
  OPEN_LINE_ID,
  VOIDED_LINE_ID,
  VOID_ERROR_STATES,
  VOID_KEY,
  VOID_REASON,
  VOID_RESULTS,
  deliveryHistoryView,
  voidInput,
} from '../../fixtures/order-delivery-void';
import { setupUser } from '../../helpers/user-event';

const { voidMock, routerMock } = vi.hoisted(() => ({
  voidMock: vi.fn<(input: unknown) => Promise<VoidDeliveryActionResult>>(),
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
    throw new Error(`${nombre} no debe invocarse desde el dialogo de anulacion`);
  };
  return {
    voidDeliveryAction: voidMock,
    listOrderDeliveriesAction: vi.fn(noDebeInvocarse('listOrderDeliveriesAction')),
    deliverOrderAction: vi.fn(noDebeInvocarse('deliverOrderAction')),
    getOrderDeliveryAction: vi.fn(noDebeInvocarse('getOrderDeliveryAction')),
    cancelOrderAction: vi.fn(noDebeInvocarse('cancelOrderAction')),
    deleteOrderAction: vi.fn(noDebeInvocarse('deleteOrderAction')),
  };
});

type Uuid = `${string}-${string}-${string}-${string}-${string}`;
const KEY: Uuid = VOID_KEY as Uuid;
const OTHER_KEY: Uuid = 'b0000000-0000-4000-8000-0000000000c2';
const SECOND_OPEN_LINE_ID = 'd0000000-0000-4000-8000-000000000026';

/** La entrega mas reciente del fixture: una presentacion sin anular y otra ya anulada. */
const NEWER: OrderDeliveryHistoryEntry = deliveryHistoryView().deliveries[0] as OrderDeliveryHistoryEntry;

/** Dos presentaciones sin anular y una anulada, para poder desmarcar. */
// 2026-10-15: las presentaciones van por cliente; la nueva se anade al primero.
const TWO_OPEN: OrderDeliveryHistoryEntry = {
  ...NEWER,
  customers: NEWER.customers.map((customer, index) =>
    index !== 0
      ? customer
      : {
          ...customer,
          presentations: [
            ...customer.presentations,
            {
              presentationLineId: SECOND_OPEN_LINE_ID,
              presentationName: 'Caneca 20 L',
              packages: 2,
              batches: [],
              void: null,
            },
          ],
        },
  ),
};

const reload = vi.fn<() => Promise<void>>();

function montar(delivery: OrderDeliveryHistoryEntry = NEWER) {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  render(<DeliveryVoidDialog delivery={delivery} open onOpenChange={onOpenChange} reload={reload} />);
  return onOpenChange;
}

/** Monta el dialogo solo mientras esta abierto, como lo hace el sheet de entregas. */
function Reabrible() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        reabrir
      </button>
      {open ? <DeliveryVoidDialog delivery={NEWER} open onOpenChange={setOpen} reload={reload} /> : null}
    </>
  );
}

function casillas(): HTMLElement[] {
  return screen.queryAllByTestId(DELIVERY_VOID_PRESENTATION_TESTID);
}

async function escribirMotivo(user: ReturnType<typeof setupUser>, texto = VOID_REASON) {
  const campo = screen.getByTestId(DELIVERY_VOID_REASON_TESTID);
  await user.clear(campo);
  if (texto !== '') await user.type(campo, texto);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(KEY);
  voidMock.mockResolvedValue({ status: 'success', data: VOID_RESULTS.voided });
  reload.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  toast.dismiss();
  vi.restoreAllMocks();
});

describe('casillas', () => {
  it('R11: lista solo las presentaciones sin anular, todas marcadas y sin campos de cantidad', () => {
    montar(TWO_OPEN);

    const dialogo = screen.getByTestId(DELIVERY_VOID_DIALOG_TESTID);
    expect(casillas().map((c) => c.getAttribute('data-presentation-line-id'))).toEqual([
      OPEN_LINE_ID,
      SECOND_OPEN_LINE_ID,
    ]);
    expect(dialogo.querySelector(`[data-presentation-line-id="${VOIDED_LINE_ID}"]`)).toBeNull();
    for (const casilla of casillas()) expect(casilla).toHaveAttribute('aria-checked', 'true');
    expect(within(dialogo).getByText(/Botella 1 L/)).toHaveTextContent('6');
    expect(within(dialogo).queryByRole('spinbutton')).toBeNull();
    expect(dialogo.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"])')).toHaveLength(0);
  });

  it('R11: deja desmarcar una y envia solo las que siguen marcadas', async () => {
    const user = setupUser();
    montar(TWO_OPEN);

    await user.click(casillas()[1] as HTMLElement);
    expect(casillas()[1]).toHaveAttribute('aria-checked', 'false');
    await escribirMotivo(user);
    await user.click(screen.getByTestId(DELIVERY_VOID_CONFIRM_TESTID));

    await waitFor(() => expect(voidMock).toHaveBeenCalledTimes(1));
    expect(voidMock).toHaveBeenCalledWith(voidInput());
  });
});

describe('avisos previos', () => {
  it('R12: sin ninguna marcada avisa y no envia', async () => {
    const user = setupUser();
    montar();

    await user.click(casillas()[0] as HTMLElement);
    await escribirMotivo(user);
    await user.click(screen.getByTestId(DELIVERY_VOID_CONFIRM_TESTID));

    expect(screen.getByTestId(DELIVERY_VOID_EMPTY_ERROR_TESTID)).toBeInTheDocument();
    expect(voidMock).not.toHaveBeenCalled();
  });

  it.each([
    ['vacio', ''],
    ['solo con espacios', '   '],
  ])('R13: con el motivo %s avisa de que es obligatorio y no envia', async (_caso, texto) => {
    const user = setupUser();
    montar();

    await escribirMotivo(user, texto);
    await user.click(screen.getByTestId(DELIVERY_VOID_CONFIRM_TESTID));

    expect(screen.getByTestId(DELIVERY_VOID_REASON_ERROR_TESTID)).toBeInTheDocument();
    expect(screen.queryByTestId(DELIVERY_VOID_REASON_TOO_LONG_TESTID)).toBeNull();
    expect(voidMock).not.toHaveBeenCalled();
  });

  it('R13: con mas de 500 caracteres avisa de que es demasiado largo y no envia', async () => {
    const user = setupUser();
    montar();

    const campo = screen.getByTestId(DELIVERY_VOID_REASON_TESTID);
    await user.click(campo);
    await user.paste('a'.repeat(501));
    await user.click(screen.getByTestId(DELIVERY_VOID_CONFIRM_TESTID));

    expect(screen.getByTestId(DELIVERY_VOID_REASON_TOO_LONG_TESTID)).toBeInTheDocument();
    expect(screen.queryByTestId(DELIVERY_VOID_REASON_ERROR_TESTID)).toBeNull();
    expect(voidMock).not.toHaveBeenCalled();
  });

  it('R13: con 500 caracteres justos si envia', async () => {
    const user = setupUser();
    montar();

    await user.click(screen.getByTestId(DELIVERY_VOID_REASON_TESTID));
    await user.paste('a'.repeat(500));
    await user.click(screen.getByTestId(DELIVERY_VOID_CONFIRM_TESTID));

    await waitFor(() => expect(voidMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId(DELIVERY_VOID_REASON_TOO_LONG_TESTID)).toBeNull();
  });
});

describe('clave de anulacion', () => {
  it('R14: dos confirmaciones del mismo dialogo envian la misma clave', async () => {
    const user = setupUser();
    voidMock.mockResolvedValueOnce(VOID_ERROR_STATES.actionNotAllowed);
    montar();

    await escribirMotivo(user);
    await user.click(screen.getByTestId(DELIVERY_VOID_CONFIRM_TESTID));
    await screen.findByTestId(DELIVERY_VOID_ERROR_TESTID);
    // El error se pinta antes de que termine la transicion: hasta entonces el boton sigue deshabilitado.
    await waitFor(() => expect(screen.getByTestId(DELIVERY_VOID_CONFIRM_TESTID)).toBeEnabled());
    await user.click(screen.getByTestId(DELIVERY_VOID_CONFIRM_TESTID));

    await waitFor(() => expect(voidMock).toHaveBeenCalledTimes(2));
    expect(voidMock).toHaveBeenNthCalledWith(1, voidInput({ voidKey: KEY }));
    expect(voidMock).toHaveBeenNthCalledWith(2, voidInput({ voidKey: KEY }));
  });

  it('R14: cerrarlo y reabrirlo envia otra clave', async () => {
    const user = setupUser();
    vi.mocked(crypto.randomUUID).mockReturnValueOnce(KEY).mockReturnValueOnce(OTHER_KEY);
    voidMock.mockResolvedValue(VOID_ERROR_STATES.actionNotAllowed);
    render(<Reabrible />);

    await escribirMotivo(user);
    await user.click(screen.getByTestId(DELIVERY_VOID_CONFIRM_TESTID));
    await screen.findByTestId(DELIVERY_VOID_ERROR_TESTID);
    await user.click(screen.getByTestId(DELIVERY_VOID_DISMISS_TESTID));
    await waitFor(() => expect(screen.queryByTestId(DELIVERY_VOID_DIALOG_TESTID)).toBeNull());

    await user.click(screen.getByRole('button', { name: 'reabrir', hidden: true }));
    await escribirMotivo(user);
    await user.click(screen.getByTestId(DELIVERY_VOID_CONFIRM_TESTID));

    await waitFor(() => expect(voidMock).toHaveBeenCalledTimes(2));
    expect(voidMock).toHaveBeenNthCalledWith(1, voidInput({ voidKey: KEY }));
    expect(voidMock).toHaveBeenNthCalledWith(2, voidInput({ voidKey: OTHER_KEY }));
  });
});

describe('respuestas', () => {
  it.each([
    ['voided', VOID_RESULTS.voided],
    ['already_registered', VOID_RESULTS.alreadyRegistered],
  ] as const)('R15: tras %s cierra, avisa, relee la lista y refresca', async (_caso, data) => {
    const user = setupUser();
    const exito = vi.spyOn(toast, 'success');
    voidMock.mockResolvedValue({ status: 'success', data });
    const onOpenChange = montar();

    await escribirMotivo(user);
    await user.click(screen.getByTestId(DELIVERY_VOID_CONFIRM_TESTID));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(exito).toHaveBeenCalledWith('Entrega anulada');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it('R16: con delivery_already_voided muestra el rechazo y relee la lista', async () => {
    const user = setupUser();
    voidMock.mockResolvedValue(VOID_ERROR_STATES.alreadyVoided);
    const onOpenChange = montar();

    await escribirMotivo(user);
    await user.click(screen.getByTestId(DELIVERY_VOID_CONFIRM_TESTID));

    const rechazo = await screen.findByTestId(DELIVERY_VOID_REJECTED_TESTID);
    expect(rechazo).toHaveTextContent(VOID_ERROR_STATES.alreadyVoided.message);
    expect(rechazo).toHaveAttribute('data-code', 'delivery_already_voided');
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId(DELIVERY_VOID_ERROR_TESTID)).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it.each([
    ['delivery_not_found', VOID_ERROR_STATES.deliveryNotFound],
    ['action_not_allowed', VOID_ERROR_STATES.actionNotAllowed],
    ['unauthorized', VOID_ERROR_STATES.unauthorized],
  ] as const)('R16: con %s sigue abierto con el mensaje y conserva lo marcado y el motivo', async (code, error) => {
    const user = setupUser();
    voidMock.mockResolvedValue(error);
    const onOpenChange = montar(TWO_OPEN);

    await user.click(casillas()[1] as HTMLElement);
    await escribirMotivo(user);
    await user.click(screen.getByTestId(DELIVERY_VOID_CONFIRM_TESTID));

    const region = await screen.findByTestId(DELIVERY_VOID_ERROR_TESTID);
    expect(region).toHaveAttribute('data-code', code);
    expect(region).toHaveTextContent(error.message);
    expect(screen.queryByTestId(DELIVERY_VOID_REJECTED_TESTID)).toBeNull();
    expect(screen.getByTestId(DELIVERY_VOID_DIALOG_TESTID)).toBeInTheDocument();
    expect(casillas().map((c) => c.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(screen.getByTestId(DELIVERY_VOID_REASON_TESTID)).toHaveValue(VOID_REASON);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(reload).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it('R16: si la action revienta sigue abierto con el aviso y lo escrito', async () => {
    const user = setupUser();
    voidMock.mockRejectedValue(new Error('red caida'));
    montar();

    await escribirMotivo(user);
    await user.click(screen.getByTestId(DELIVERY_VOID_CONFIRM_TESTID));

    expect(await screen.findByTestId(DELIVERY_VOID_ERROR_TESTID)).toHaveAttribute('data-code', 'unexpected');
    expect(screen.getByTestId(DELIVERY_VOID_REASON_TESTID)).toHaveValue(VOID_REASON);
    expect(reload).not.toHaveBeenCalled();
  });
});
