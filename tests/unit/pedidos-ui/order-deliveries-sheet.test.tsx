// El sheet de entregas con las Server Actions dobladas: lectura, esqueleto, error y relectura tras
// anular. Los controles se localizan por `data-testid`.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DELIVERY_VOID_CONFIRM_TESTID,
  DELIVERY_VOID_DIALOG_TESTID,
  DELIVERY_VOID_PRESENTATION_TESTID,
  DELIVERY_VOID_REASON_TESTID,
  DELIVERY_VOID_REJECTED_TESTID,
  ORDER_DELIVERIES_EMPTY_TESTID,
  ORDER_DELIVERIES_ERROR_TESTID,
  ORDER_DELIVERIES_SHEET_TESTID,
  ORDER_DELIVERIES_SKELETON_TESTID,
  ORDER_DELIVERY_ENTRY_TESTID,
  ORDER_DELIVERY_ENTRY_VOIDED_TESTID,
  ORDER_DELIVERY_VOID_TESTID,
  OrderDeliveriesSheet,
} from '@/app/(private)/pedidos/components';
import type { OrderDeliveryHistoryView } from '@/lib/modules/pedidos';
import type {
  OrderDeliveriesResult,
  VoidDeliveryActionResult,
} from '@/lib/modules/pedidos/adapters/driving/order-actions';

import {
  FIRST_CUSTOMER_ID,
  NEWER_DELIVERY_ID,
  OLDER_DELIVERY_ID,
  OPEN_LINE_ID,
  SECOND_CUSTOMER_ID,
  VOIDED_LINE_ID,
  VOID_ERROR_STATES,
  VOID_KEY,
  VOID_ORDER_ID,
  VOID_REASON,
  VOID_RESULTS,
  deliveryHistoryView,
  voidInput,
} from '../../fixtures/order-delivery-void';
import { setupUser } from '../../helpers/user-event';

const { listMock, voidMock, routerMock } = vi.hoisted(() => ({
  listMock: vi.fn<(orderId: string) => Promise<OrderDeliveriesResult>>(),
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
    throw new Error(`${nombre} no debe invocarse desde el sheet de entregas`);
  };
  return {
    listOrderDeliveriesAction: listMock,
    voidDeliveryAction: voidMock,
    deliverOrderAction: vi.fn(noDebeInvocarse('deliverOrderAction')),
    getOrderDeliveryAction: vi.fn(noDebeInvocarse('getOrderDeliveryAction')),
    cancelOrderAction: vi.fn(noDebeInvocarse('cancelOrderAction')),
    deleteOrderAction: vi.fn(noDebeInvocarse('deleteOrderAction')),
  };
});

type Uuid = `${string}-${string}-${string}-${string}-${string}`;

const ORDER = { id: VOID_ORDER_ID, numberText: '2026-0000024' } as const;

function ok(view: OrderDeliveryHistoryView = deliveryHistoryView()): OrderDeliveriesResult {
  return { status: 'success', data: view };
}

// 2026-10-15: las presentaciones van por cliente; se anula la del primero.
/** La vista tras anular la presentacion abierta de la entrega mas reciente. */
function trasAnular(): OrderDeliveryHistoryView {
  const view = deliveryHistoryView();
  const [newer, ...rest] = view.deliveries;
  if (newer === undefined) throw new Error('el fixture trae dos entregas');
  return {
    ...view,
    orderStatus: 'TERMINADO',
    deliveries: [
      {
        ...newer,
        customers: newer.customers.map((customer, index) =>
          index !== 0
            ? customer
            : {
                ...customer,
                presentations: customer.presentations.map((p) =>
                  p.presentationLineId === OPEN_LINE_ID
                    ? { ...p, void: { reason: VOID_REASON, authorName: 'Laura Gomez', createdAt: '2026-10-09T10:00:00.000Z' } }
                    : p,
                ),
              },
        ),
      },
      ...rest,
    ],
  };
}

const cerrar = vi.fn<(open: boolean) => void>();

function montar(canVoid = true) {
  render(<OrderDeliveriesSheet order={ORDER} open onOpenChange={cerrar} canVoid={canVoid} />);
}

function entrada(id: string): HTMLElement {
  const encontrada = screen
    .getAllByTestId(ORDER_DELIVERY_ENTRY_TESTID)
    .find((el) => el.getAttribute('data-delivery-id') === id);
  if (encontrada === undefined) throw new Error(`no se pinta la entrega ${id}`);
  return encontrada;
}

async function anularLaMasReciente(user: ReturnType<typeof setupUser>) {
  await screen.findAllByTestId(ORDER_DELIVERY_ENTRY_TESTID);
  await user.click(within(entrada(NEWER_DELIVERY_ID)).getByTestId(ORDER_DELIVERY_VOID_TESTID));
  await screen.findByTestId(DELIVERY_VOID_DIALOG_TESTID);
  // 2026-10-15: el dialogo abre sin nada marcado; se marca la botella de Ana.
  const botellaDeAna = screen
    .getAllByTestId(DELIVERY_VOID_PRESENTATION_TESTID)
    .find(
      (c) =>
        c.getAttribute('data-customer-id') === FIRST_CUSTOMER_ID &&
        c.getAttribute('data-presentation-line-id') === OPEN_LINE_ID,
    );
  if (botellaDeAna === undefined) throw new Error('no se pinta la botella de Ana');
  await user.click(botellaDeAna);
  await user.type(screen.getByTestId(DELIVERY_VOID_REASON_TESTID), VOID_REASON);
  await user.click(screen.getByTestId(DELIVERY_VOID_CONFIRM_TESTID));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(VOID_KEY as Uuid);
  listMock.mockResolvedValue(ok());
  voidMock.mockResolvedValue({ status: 'success', data: VOID_RESULTS.voided });
});

afterEach(() => {
  cleanup();
  toast.dismiss();
  vi.restoreAllMocks();
});

describe('lectura', () => {
  it('mientras lee muestra el esqueleto y pide las entregas del pedido', () => {
    listMock.mockReturnValue(new Promise(() => undefined));
    montar();

    expect(screen.getByTestId(ORDER_DELIVERIES_SHEET_TESTID)).toBeInTheDocument();
    expect(screen.getByTestId(ORDER_DELIVERIES_SKELETON_TESTID)).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledWith(VOID_ORDER_ID);
    expect(screen.queryByTestId(ORDER_DELIVERY_ENTRY_TESTID)).toBeNull();
  });

  it('con datos pinta la lista y quita el esqueleto', async () => {
    montar();

    const entradas = await screen.findAllByTestId(ORDER_DELIVERY_ENTRY_TESTID);
    expect(entradas.map((e) => e.getAttribute('data-delivery-id'))).toEqual([NEWER_DELIVERY_ID, OLDER_DELIVERY_ID]);
    expect(screen.queryByTestId(ORDER_DELIVERIES_SKELETON_TESTID)).toBeNull();
    expect(screen.queryByTestId(ORDER_DELIVERIES_ERROR_TESTID)).toBeNull();
  });

  it('sin entregas pinta el vacio', async () => {
    listMock.mockResolvedValue(ok(deliveryHistoryView({ deliveries: [] })));
    montar();

    expect(await screen.findByTestId(ORDER_DELIVERIES_EMPTY_TESTID)).toBeInTheDocument();
  });

  it('sin el permiso de anular la lista no ofrece «Anular»', async () => {
    montar(false);

    await screen.findAllByTestId(ORDER_DELIVERY_ENTRY_TESTID);
    expect(screen.queryByTestId(ORDER_DELIVERY_VOID_TESTID)).toBeNull();
  });

  it.each([
    ['order_not_found', VOID_ERROR_STATES.orderNotFound],
    ['unauthorized', VOID_ERROR_STATES.unauthorized],
  ] as const)('si la lectura falla con %s muestra el error y no la lista', async (code, error) => {
    listMock.mockResolvedValue(error);
    montar();

    const region = await screen.findByTestId(ORDER_DELIVERIES_ERROR_TESTID);
    expect(region).toHaveAttribute('data-code', code);
    expect(region).toHaveTextContent(error.message);
    expect(screen.queryByTestId(ORDER_DELIVERIES_SKELETON_TESTID)).toBeNull();
    expect(screen.queryByTestId(ORDER_DELIVERY_ENTRY_TESTID)).toBeNull();
  });

  it('si la action revienta muestra el error inesperado', async () => {
    listMock.mockRejectedValue(new Error('red caida'));
    montar();

    expect(await screen.findByTestId(ORDER_DELIVERIES_ERROR_TESTID)).toHaveAttribute('data-code', 'unexpected');
  });
});

describe('anular desde el sheet', () => {
  // 2026-10-15: los pares van por cliente y abren sin marcar.
  it('R36: «Anular» abre el dialogo con los pares sin anular de esa entrega, sin marcar', async () => {
    const user = setupUser();
    montar();

    await screen.findAllByTestId(ORDER_DELIVERY_ENTRY_TESTID);
    await user.click(within(entrada(NEWER_DELIVERY_ID)).getByTestId(ORDER_DELIVERY_VOID_TESTID));

    await screen.findByTestId(DELIVERY_VOID_DIALOG_TESTID);
    const casillas = screen.getAllByTestId(DELIVERY_VOID_PRESENTATION_TESTID);
    expect(
      casillas.map((c) => `${c.getAttribute('data-customer-id')}:${c.getAttribute('data-presentation-line-id')}`),
    ).toEqual([`${FIRST_CUSTOMER_ID}:${OPEN_LINE_ID}`, `${SECOND_CUSTOMER_ID}:${VOIDED_LINE_ID}`]);
    for (const c of casillas) expect(c).toHaveAttribute('aria-checked', 'false');
  });

  it('R15: tras anular cierra el dialogo, relee la lista con el estado nuevo y refresca', async () => {
    const user = setupUser();
    const exito = vi.spyOn(toast, 'success');
    listMock.mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok(trasAnular()));
    montar();

    await anularLaMasReciente(user);

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
    expect(voidMock).toHaveBeenCalledWith(voidInput());
    await waitFor(() => expect(screen.queryByTestId(DELIVERY_VOID_DIALOG_TESTID)).toBeNull());
    expect(exito).toHaveBeenCalledWith('Entrega anulada');
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
    // 2026-10-15: lo de Ana queda anulado entero, pero a Bruno le queda el galon: las dos entregas
    // siguen ofreciendo «Anular».
    await waitFor(() => {
      const botellaDeAna = entrada(NEWER_DELIVERY_ID).querySelector<HTMLElement>(
        `[data-customer-id="${FIRST_CUSTOMER_ID}"] [data-presentation-line-id="${OPEN_LINE_ID}"]`,
      );
      expect(botellaDeAna).not.toBeNull();
      expect(within(botellaDeAna!).getByTestId(ORDER_DELIVERY_ENTRY_VOIDED_TESTID)).toBeInTheDocument();
    });
    expect(within(entrada(NEWER_DELIVERY_ID)).getByTestId(ORDER_DELIVERY_VOID_TESTID)).toBeInTheDocument();
    expect(within(entrada(OLDER_DELIVERY_ID)).getByTestId(ORDER_DELIVERY_VOID_TESTID)).toBeInTheDocument();
    expect(cerrar).not.toHaveBeenCalled();
  });

  it('R16: tras delivery_already_voided relee la lista con el dialogo abierto y el rechazo a la vista', async () => {
    const user = setupUser();
    voidMock.mockResolvedValue(VOID_ERROR_STATES.alreadyVoided);
    montar();

    await anularLaMasReciente(user);

    expect(await screen.findByTestId(DELIVERY_VOID_REJECTED_TESTID)).toBeInTheDocument();
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId(DELIVERY_VOID_DIALOG_TESTID)).toBeInTheDocument();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it('si la relectura falla conserva la lista y avisa encima', async () => {
    const user = setupUser();
    listMock.mockResolvedValueOnce(ok()).mockResolvedValueOnce(VOID_ERROR_STATES.orderNotFound);
    montar();

    await anularLaMasReciente(user);

    expect(await screen.findByTestId(ORDER_DELIVERIES_ERROR_TESTID)).toHaveAttribute('data-code', 'order_not_found');
    expect(screen.getAllByTestId(ORDER_DELIVERY_ENTRY_TESTID)).toHaveLength(2);
  });
});
