// El diálogo de anular una entrega sin pedido con las Server Actions dobladas: lectura, casillas por
// cliente, avisos previos, clave de anulación y respuestas.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DIRECT_DELIVERY_VOID_CONFIRM_TESTID,
  DIRECT_DELIVERY_VOID_CUSTOMER_TESTID,
  DIRECT_DELIVERY_VOID_DIALOG_TESTID,
  DIRECT_DELIVERY_VOID_DISMISS_TESTID,
  DIRECT_DELIVERY_VOID_EMPTY_ERROR_TESTID,
  DIRECT_DELIVERY_VOID_ERROR_TESTID,
  DIRECT_DELIVERY_VOID_LOAD_ERROR_TESTID,
  DIRECT_DELIVERY_VOID_LOADING_TESTID,
  DIRECT_DELIVERY_VOID_REASON_ERROR_TESTID,
  DIRECT_DELIVERY_VOID_REASON_TESTID,
  DIRECT_DELIVERY_VOID_REASON_TOO_LONG_TESTID,
  DIRECT_DELIVERY_VOID_REJECTED_TESTID,
  DIRECT_DELIVERY_VOID_RETRY_TESTID,
  DirectDeliveryVoidDialog,
} from '@/app/(private)/inventario/producto-terminado/[id]/components';
import type {
  DirectDeliveryVoidViewResult,
  VoidDirectDeliveryActionResult,
} from '@/lib/modules/pedidos/adapters/driving/order-actions';

import {
  DIRECT_DELIVERY_ERROR_STATES,
  DIRECT_DELIVERY_ID,
  DIRECT_DELIVERY_RESULTS,
  DIRECT_FIRST_CUSTOMER_ID,
  DIRECT_SECOND_CUSTOMER_ID,
  DIRECT_VOID_KEY,
  directDeliveryVoidView,
} from '../../fixtures/direct-delivery';
import { setupUser } from '../../helpers/user-event';

const { getForVoidMock, voidMock, routerMock } = vi.hoisted(() => ({
  getForVoidMock: vi.fn<(deliveryId: string) => Promise<DirectDeliveryVoidViewResult>>(),
  voidMock: vi.fn<(input: unknown) => Promise<VoidDirectDeliveryActionResult>>(),
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
    throw new Error(`${nombre} no debe invocarse desde el diálogo de anular sin pedido`);
  };
  return {
    getDirectDeliveryForVoidAction: getForVoidMock,
    voidDirectDeliveryAction: voidMock,
    voidDeliveryAction: vi.fn(noDebeInvocarse('voidDeliveryAction')),
    deliverDirectAction: vi.fn(noDebeInvocarse('deliverDirectAction')),
  };
});

type Uuid = `${string}-${string}-${string}-${string}-${string}`;
const KEY: Uuid = DIRECT_VOID_KEY as Uuid;
const OTHER_KEY: Uuid = 'b0000000-0000-4000-8000-0000000002c2';
const REASON = 'El cliente devolvió las botellas.';

function montar() {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  render(<DirectDeliveryVoidDialog deliveryId={DIRECT_DELIVERY_ID} open onOpenChange={onOpenChange} />);
  return onOpenChange;
}

/** Monta el diálogo solo mientras está abierto, como la tabla de Entregas. */
function Reabrible() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        reabrir
      </button>
      {open ? <DirectDeliveryVoidDialog deliveryId={DIRECT_DELIVERY_ID} open onOpenChange={setOpen} /> : null}
    </>
  );
}

function casillas(): HTMLElement[] {
  return screen.queryAllByTestId(DIRECT_DELIVERY_VOID_CUSTOMER_TESTID);
}

async function casilla(customerId: string): Promise<HTMLElement> {
  await waitFor(() => expect(casillas().length).toBeGreaterThan(0));
  const encontrada = casillas().find((c) => c.getAttribute('data-customer-id') === customerId);
  if (encontrada === undefined) throw new Error(`no se pinta el cliente ${customerId}`);
  return encontrada;
}

async function escribirMotivo(user: ReturnType<typeof setupUser>, texto = REASON) {
  const campo = screen.getByTestId(DIRECT_DELIVERY_VOID_REASON_TESTID);
  await user.clear(campo);
  if (texto !== '') await user.type(campo, texto);
}

async function marcarYConfirmar(user: ReturnType<typeof setupUser>, customerIds = [DIRECT_FIRST_CUSTOMER_ID]) {
  for (const id of customerIds) await user.click(await casilla(id));
  await escribirMotivo(user);
  await user.click(screen.getByTestId(DIRECT_DELIVERY_VOID_CONFIRM_TESTID));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(KEY);
  getForVoidMock.mockResolvedValue({ status: 'success', data: directDeliveryVoidView() });
  voidMock.mockResolvedValue({ status: 'success', data: DIRECT_DELIVERY_RESULTS.voided });
});

afterEach(() => {
  cleanup();
  toast.dismiss();
  vi.restoreAllMocks();
});

describe('lectura y casillas', () => {
  it('R44 — al abrir lee la entrega con esqueleto y pinta fecha, presentación y un cliente por casilla, sin marcar', async () => {
    let resolver: (value: DirectDeliveryVoidViewResult) => void = () => {};
    getForVoidMock.mockReturnValueOnce(new Promise((resolve) => (resolver = resolve)));
    montar();

    const dialogo = screen.getByTestId(DIRECT_DELIVERY_VOID_DIALOG_TESTID);
    expect(within(dialogo).getByRole('heading', { name: 'Anular la entrega sin pedido' })).toBeInTheDocument();
    expect(screen.getByTestId(DIRECT_DELIVERY_VOID_LOADING_TESTID)).toBeInTheDocument();
    expect(getForVoidMock).toHaveBeenCalledWith(DIRECT_DELIVERY_ID);
    expect(screen.getByTestId(DIRECT_DELIVERY_VOID_CONFIRM_TESTID)).toBeDisabled();

    resolver({ status: 'success', data: directDeliveryVoidView() });

    await waitFor(() => expect(casillas()).toHaveLength(2));
    expect(screen.queryByTestId(DIRECT_DELIVERY_VOID_LOADING_TESTID)).toBeNull();
    expect(screen.getByTestId('direct-delivery-void-message')).toHaveTextContent(
      'Entrega del 2026-10-16 10:30 · Botella 1 L.',
    );
    expect(casillas().map((c) => c.getAttribute('data-customer-id'))).toEqual([
      DIRECT_FIRST_CUSTOMER_ID,
      DIRECT_SECOND_CUSTOMER_ID,
    ]);
    for (const c of casillas()) expect(c).toHaveAttribute('aria-checked', 'false');
    expect(casillas()[0]).toHaveAccessibleName('Anular lo de Ana Perez · 4 envases');
    expect(casillas()[1]).toHaveAccessibleName('Anular lo de Bruno Diaz · 2 envases');
    expect(within(dialogo).queryByRole('spinbutton')).toBeNull();
    expect(dialogo.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"])')).toHaveLength(0);
  });

  it('R44 — no lista a un cliente cuya parte ya está anulada', async () => {
    getForVoidMock.mockResolvedValue({
      status: 'success',
      data: directDeliveryVoidView({
        customers: [{ customerId: DIRECT_SECOND_CUSTOMER_ID, customerName: 'Bruno Diaz', packages: 2 }],
      }),
    });
    montar();

    await waitFor(() => expect(casillas()).toHaveLength(1));
    expect(casillas()[0]).toHaveAttribute('data-customer-id', DIRECT_SECOND_CUSTOMER_ID);
    expect(screen.queryByText('Ana Perez')).toBeNull();
  });

  it('R44 — si la lectura falla muestra el error y reintenta', async () => {
    const user = setupUser();
    getForVoidMock.mockResolvedValueOnce(DIRECT_DELIVERY_ERROR_STATES.deliveryNotFound);
    montar();

    const error = await screen.findByTestId(DIRECT_DELIVERY_VOID_LOAD_ERROR_TESTID);
    expect(error).toHaveTextContent(DIRECT_DELIVERY_ERROR_STATES.deliveryNotFound.message);
    expect(screen.getByTestId(DIRECT_DELIVERY_VOID_CONFIRM_TESTID)).toBeDisabled();

    await user.click(screen.getByTestId(DIRECT_DELIVERY_VOID_RETRY_TESTID));

    await waitFor(() => expect(casillas()).toHaveLength(2));
    expect(getForVoidMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId(DIRECT_DELIVERY_VOID_LOAD_ERROR_TESTID)).toBeNull();
  });
});

describe('avisos previos', () => {
  it('R45 — sin ningún cliente marcado avisa «No hay nada que anular» y no envía', async () => {
    const user = setupUser();
    montar();
    await casilla(DIRECT_FIRST_CUSTOMER_ID);

    await escribirMotivo(user);
    await user.click(screen.getByTestId(DIRECT_DELIVERY_VOID_CONFIRM_TESTID));

    expect(screen.getByTestId(DIRECT_DELIVERY_VOID_EMPTY_ERROR_TESTID)).toHaveTextContent(
      'No hay nada que anular: marca al menos un cliente.',
    );
    expect(voidMock).not.toHaveBeenCalled();
  });

  it.each([
    ['vacío', ''],
    ['solo con espacios', '   '],
  ])('R45 (QC-224 R13) — con el motivo %s avisa de que es obligatorio y no envía', async (_caso, texto) => {
    const user = setupUser();
    montar();

    await user.click(await casilla(DIRECT_FIRST_CUSTOMER_ID));
    await escribirMotivo(user, texto);
    await user.click(screen.getByTestId(DIRECT_DELIVERY_VOID_CONFIRM_TESTID));

    expect(screen.getByTestId(DIRECT_DELIVERY_VOID_REASON_ERROR_TESTID)).toBeInTheDocument();
    expect(screen.getByTestId(DIRECT_DELIVERY_VOID_REASON_TESTID)).toHaveAttribute('aria-invalid', 'true');
    expect(voidMock).not.toHaveBeenCalled();
  });

  it('R45 (QC-224 R13) — con más de 500 caracteres avisa y no envía; con 500 justos sí envía', async () => {
    const user = setupUser();
    montar();

    await user.click(await casilla(DIRECT_FIRST_CUSTOMER_ID));
    const campo = screen.getByTestId(DIRECT_DELIVERY_VOID_REASON_TESTID);
    await user.click(campo);
    await user.paste('a'.repeat(501));
    await user.click(screen.getByTestId(DIRECT_DELIVERY_VOID_CONFIRM_TESTID));

    expect(screen.getByTestId(DIRECT_DELIVERY_VOID_REASON_TOO_LONG_TESTID)).toBeInTheDocument();
    expect(voidMock).not.toHaveBeenCalled();

    await user.clear(campo);
    await user.click(campo);
    await user.paste('a'.repeat(500));
    await user.click(screen.getByTestId(DIRECT_DELIVERY_VOID_CONFIRM_TESTID));

    await waitFor(() => expect(voidMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId(DIRECT_DELIVERY_VOID_REASON_TOO_LONG_TESTID)).toBeNull();
  });
});

describe('envío y clave de anulación', () => {
  it('R46 — envía la entrega, la clave, el motivo y solo los clientes marcados', async () => {
    const user = setupUser();
    montar();

    await marcarYConfirmar(user, [DIRECT_SECOND_CUSTOMER_ID]);

    await waitFor(() => expect(voidMock).toHaveBeenCalledTimes(1));
    expect(voidMock).toHaveBeenCalledWith({
      deliveryId: DIRECT_DELIVERY_ID,
      voidKey: KEY,
      customerIds: [DIRECT_SECOND_CUSTOMER_ID],
      reason: REASON,
    });
  });

  it('R46 — con los dos marcados los envía en el orden del diálogo', async () => {
    const user = setupUser();
    montar();

    await marcarYConfirmar(user, [DIRECT_SECOND_CUSTOMER_ID, DIRECT_FIRST_CUSTOMER_ID]);

    await waitFor(() => expect(voidMock).toHaveBeenCalledTimes(1));
    expect(voidMock.mock.calls[0]?.[0]).toMatchObject({
      customerIds: [DIRECT_FIRST_CUSTOMER_ID, DIRECT_SECOND_CUSTOMER_ID],
    });
  });

  it('R45 (QC-224 R14) — dos confirmaciones del mismo diálogo envían la misma clave', async () => {
    const user = setupUser();
    voidMock.mockResolvedValueOnce(DIRECT_DELIVERY_ERROR_STATES.invalidInput);
    montar();

    await marcarYConfirmar(user);
    await screen.findByTestId(DIRECT_DELIVERY_VOID_ERROR_TESTID);
    await waitFor(() => expect(screen.getByTestId(DIRECT_DELIVERY_VOID_CONFIRM_TESTID)).toBeEnabled());
    await user.click(screen.getByTestId(DIRECT_DELIVERY_VOID_CONFIRM_TESTID));

    await waitFor(() => expect(voidMock).toHaveBeenCalledTimes(2));
    expect(voidMock.mock.calls.map((call) => (call[0] as { voidKey: string }).voidKey)).toEqual([KEY, KEY]);
  });

  it('R45 (QC-224 R14) — cerrarlo y reabrirlo envía otra clave', async () => {
    const user = setupUser();
    vi.mocked(crypto.randomUUID).mockReturnValueOnce(KEY).mockReturnValueOnce(OTHER_KEY);
    voidMock.mockResolvedValue(DIRECT_DELIVERY_ERROR_STATES.invalidInput);
    render(<Reabrible />);

    await marcarYConfirmar(user);
    await screen.findByTestId(DIRECT_DELIVERY_VOID_ERROR_TESTID);
    await user.click(screen.getByTestId(DIRECT_DELIVERY_VOID_DISMISS_TESTID));
    await waitFor(() => expect(screen.queryByTestId(DIRECT_DELIVERY_VOID_DIALOG_TESTID)).toBeNull());

    await user.click(screen.getByRole('button', { name: 'reabrir', hidden: true }));
    await marcarYConfirmar(user);

    await waitFor(() => expect(voidMock).toHaveBeenCalledTimes(2));
    expect(voidMock.mock.calls.map((call) => (call[0] as { voidKey: string }).voidKey)).toEqual([KEY, OTHER_KEY]);
  });
});

describe('respuestas', () => {
  it.each([
    ['voided', DIRECT_DELIVERY_RESULTS.voided],
    ['already_registered', DIRECT_DELIVERY_RESULTS.voidAlreadyRegistered],
  ] as const)('R46 — tras %s cierra, avisa «Entrega anulada» y refresca la ficha', async (_caso, data) => {
    const user = setupUser();
    const exito = vi.spyOn(toast, 'success');
    voidMock.mockResolvedValue({ status: 'success', data });
    const onOpenChange = montar();

    await marcarYConfirmar(user);

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(exito).toHaveBeenCalledWith('Entrega anulada');
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it('R46 — con delivery_already_voided muestra el mensaje y vuelve a leer la entrega', async () => {
    const user = setupUser();
    voidMock.mockResolvedValue(DIRECT_DELIVERY_ERROR_STATES.alreadyVoided);
    const onOpenChange = montar();
    await casilla(DIRECT_FIRST_CUSTOMER_ID);
    getForVoidMock.mockResolvedValueOnce({
      status: 'success',
      data: directDeliveryVoidView({
        customers: [{ customerId: DIRECT_SECOND_CUSTOMER_ID, customerName: 'Bruno Diaz', packages: 2 }],
      }),
    });

    await marcarYConfirmar(user);

    const rechazo = await screen.findByTestId(DIRECT_DELIVERY_VOID_REJECTED_TESTID);
    expect(rechazo).toHaveTextContent(DIRECT_DELIVERY_ERROR_STATES.alreadyVoided.message);
    expect(rechazo).toHaveAttribute('data-code', 'delivery_already_voided');
    await waitFor(() => expect(getForVoidMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(casillas()).toHaveLength(1));
    expect(casillas()[0]).toHaveAttribute('data-customer-id', DIRECT_SECOND_CUSTOMER_ID);
    expect(screen.queryByTestId(DIRECT_DELIVERY_VOID_ERROR_TESTID)).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it.each([
    ['delivery_not_found', DIRECT_DELIVERY_ERROR_STATES.deliveryNotFound],
    ['invalid_input', DIRECT_DELIVERY_ERROR_STATES.invalidInput],
    ['unauthorized', DIRECT_DELIVERY_ERROR_STATES.unauthorized],
  ] as const)('R46 — con %s sigue abierto con el mensaje y conserva lo marcado y el motivo', async (code, error) => {
    const user = setupUser();
    voidMock.mockResolvedValue(error);
    const onOpenChange = montar();

    await marcarYConfirmar(user);

    const region = await screen.findByTestId(DIRECT_DELIVERY_VOID_ERROR_TESTID);
    expect(region).toHaveAttribute('data-code', code);
    expect(region).toHaveTextContent(error.message);
    expect(screen.queryByTestId(DIRECT_DELIVERY_VOID_REJECTED_TESTID)).toBeNull();
    expect(casillas().map((c) => c.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(screen.getByTestId(DIRECT_DELIVERY_VOID_REASON_TESTID)).toHaveValue(REASON);
    expect(getForVoidMock).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it('R46 — si la action se rechaza, sigue abierto con un error inesperado', async () => {
    const user = setupUser();
    voidMock.mockRejectedValue(new Error('red caída'));
    const onOpenChange = montar();

    await marcarYConfirmar(user);

    const region = await screen.findByTestId(DIRECT_DELIVERY_VOID_ERROR_TESTID);
    expect(region).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
