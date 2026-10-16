// El sheet de entrega con las Server Actions dobladas: lectura, bloques por cliente, topes, envio,
// rechazos y borrador.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ORDER_ACTION_DELIVER_TESTID,
  ORDER_DELIVERY_ADD_CUSTOMER_TESTID,
  ORDER_DELIVERY_BATCH_OVER_TESTID,
  ORDER_DELIVERY_BATCH_PACKAGES_TESTID,
  ORDER_DELIVERY_BATCH_TESTID,
  ORDER_DELIVERY_BLOCK_ERROR_TESTID,
  ORDER_DELIVERY_BLOCK_REMOVE_TESTID,
  ORDER_DELIVERY_BLOCK_TESTID,
  ORDER_DELIVERY_CANCEL_TESTID,
  ORDER_DELIVERY_DRAFT_ADJUSTED_TESTID,
  ORDER_DELIVERY_ERROR_TESTID,
  ORDER_DELIVERY_LINE_EXCEEDS_TESTID,
  ORDER_DELIVERY_LINE_TESTID,
  ORDER_DELIVERY_NUMBER_TESTID,
  ORDER_DELIVERY_REJECTED_TESTID,
  ORDER_DELIVERY_SHEET_TESTID,
  ORDER_DELIVERY_SKELETON_TESTID,
  ORDER_DELIVERY_STOCK_OVER_TESTID,
  ORDER_DELIVERY_SUBMIT_TESTID,
  ORDER_DELIVERY_SUMMARY_LINE_TESTID,
  ORDER_DELIVERY_SUMMARY_TESTID,
  ORDER_RECIPE_IMAGE_TESTID,
  OrderDeliverySheet,
  OrderTable,
  orderDeliveryDraftKey,
  packagesKey,
} from '@/app/(private)/pedidos/components';
import { createDefaultParams } from '@/components/shared/data-table';
import { formatOrderNumber, type OrderCustomer, type OrderDeliveryView, type OrderSummary } from '@/lib/modules/pedidos';
import type {
  DeliverOrderActionResult,
  OrderCustomerOptionsResult,
  OrderDeliveryResult,
} from '@/lib/modules/pedidos/adapters/driving/order-actions';

import {
  COMPLETE_LINE_ID,
  DELIVERY_ERROR_STATES,
  DELIVERY_KEY,
  DELIVERY_ORDER_ID,
  DELIVER_RESULTS,
  GALLON_BATCH_ID,
  NEWER_BATCH_ID,
  OLDER_BATCH_ID,
  PENDING_LINE_ID,
  SECOND_DELIVERY_CUSTOMER_ID,
  SECOND_PENDING_LINE_ID,
  deliverInput,
  deliveryView,
  multiCustomerDeliveryView,
} from '../../fixtures/order-delivery';
import { setupUser } from '../../helpers/user-event';
import { WIDE_VIEWPORT, resetViewport, setViewportWidth } from '../../helpers/viewport';

const { getDeliveryMock, deliverMock, searchCustomersMock, routerMock } = vi.hoisted(() => ({
  getDeliveryMock: vi.fn<(orderId: string) => Promise<OrderDeliveryResult>>(),
  deliverMock: vi.fn<(input: unknown) => Promise<DeliverOrderActionResult>>(),
  searchCustomersMock: vi.fn<(query: unknown, purpose: string) => Promise<OrderCustomerOptionsResult>>(),
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
    throw new Error(`${nombre} no debe invocarse desde el sheet de entrega`);
  };
  return {
    getOrderDeliveryAction: getDeliveryMock,
    deliverOrderAction: deliverMock,
    searchOrderCustomersAction: searchCustomersMock,
    setOrderCustomerAction: vi.fn(noDebeInvocarse('setOrderCustomerAction')),
    getOrderCustomerFilterOptionAction: vi.fn(noDebeInvocarse('getOrderCustomerFilterOptionAction')),
    updateOrderDistributionAction: vi.fn(noDebeInvocarse('updateOrderDistributionAction')),
    quoteOrderPresentationAvailabilityAction: vi.fn(noDebeInvocarse('quoteOrderPresentationAvailabilityAction')),
    listOrdersAction: vi.fn(noDebeInvocarse('listOrdersAction')),
    getOrderAction: vi.fn(noDebeInvocarse('getOrderAction')),
    createOrderAction: vi.fn(noDebeInvocarse('createOrderAction')),
    updateOrderAction: vi.fn(noDebeInvocarse('updateOrderAction')),
    cancelOrderAction: vi.fn(noDebeInvocarse('cancelOrderAction')),
    deleteOrderAction: vi.fn(noDebeInvocarse('deleteOrderAction')),
  };
});

vi.mock('@/lib/modules/recetas/adapters/driving/recipe-actions', () => ({
  getRecipeAction: vi.fn(async () => ({ status: 'error', code: 'recipe_not_found', message: 'sin receta' })),
  listRecipesAction: vi.fn(() => {
    throw new Error('listRecipesAction no debe invocarse desde este archivo');
  }),
}));

vi.mock('@/lib/modules/inventario/adapters/driving/presentation-actions', () => ({
  listPresentationsAction: vi.fn(() => {
    throw new Error('listPresentationsAction no debe invocarse desde este archivo');
  }),
  createPresentationAction: vi.fn(() => {
    throw new Error('createPresentationAction no debe invocarse desde este archivo');
  }),
}));

const ORDER = { id: DELIVERY_ORDER_ID, numberText: '2026-0000007' } as const;
const ANA = { id: 'c0000000-0000-4000-8000-00000000000a', name: 'Ana Perez', isDeleted: false };
const LUIS = { id: SECOND_DELIVERY_CUSTOMER_ID, name: 'Luis Gil', isDeleted: false };
const DRAFT_KEY = orderDeliveryDraftKey(DELIVERY_ORDER_ID);
const GONE_BATCH_ID = 'e0000000-0000-4000-8000-000000000099';

const TEXTO = {
  sinCliente: 'Elige el cliente.',
  repetido: 'Este cliente ya está en la entrega.',
  sinEnvases: 'Este cliente no lleva envases: indica al menos uno en alguna presentación.',
} as const;

const cerrar = vi.fn<(open: boolean) => void>();

function ok(view: OrderDeliveryView = deliveryView()): OrderDeliveryResult {
  return { status: 'success', data: view };
}

/** La vista sin el lote mas nuevo: lo que el servidor devuelve si otro se lo llevo entero. */
function viewWithoutNewerBatch(): OrderDeliveryView {
  const base = deliveryView();
  return {
    ...base,
    lines: base.lines.map((line) =>
      line.presentationLineId === PENDING_LINE_ID
        ? { ...line, batches: line.batches.filter((batch) => batch.batchId !== NEWER_BATCH_ID) }
        : line,
    ),
  };
}

type BloqueGuardado = { readonly customer: OrderCustomer | null; readonly packages: Record<string, string> };

function guardarBorrador(bloques: readonly BloqueGuardado[]) {
  window.localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      v: 2,
      orderId: DELIVERY_ORDER_ID,
      deliveryKey: DELIVERY_KEY,
      blocks: bloques.map((bloque, index) => ({ key: String(index + 1), ...bloque })),
    }),
  );
}

function montar() {
  render(<OrderDeliverySheet order={ORDER} open onOpenChange={cerrar} />);
}

/** Monta el sheet como lo monta la fila: solo mientras esta abierto, con un boton para reabrir. */
function ConReapertura() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid="reabrir">
        reabrir
      </button>
      {open ? <OrderDeliverySheet order={ORDER} open onOpenChange={setOpen} /> : null}
    </>
  );
}

async function bloques(): Promise<HTMLElement[]> {
  return screen.findAllByTestId(ORDER_DELIVERY_BLOCK_TESTID);
}

async function bloque(index: number): Promise<HTMLElement> {
  const encontrado = (await bloques()).find((el) => el.getAttribute('data-block-index') === String(index));
  if (encontrado === undefined) throw new Error(`no hay bloque ${index}`);
  return encontrado;
}

async function lote(index: number, batchId: string): Promise<HTMLElement> {
  const fila = within(await bloque(index))
    .getAllByTestId(ORDER_DELIVERY_BATCH_TESTID)
    .find((row) => row.getAttribute('data-batch-id') === batchId);
  if (fila === undefined) throw new Error(`no hay fila para el lote ${batchId} en el bloque ${index}`);
  return fila;
}

async function campo(index: number, batchId: string): Promise<HTMLInputElement> {
  return within(await lote(index, batchId)).getByTestId(ORDER_DELIVERY_BATCH_PACKAGES_TESTID) as HTMLInputElement;
}

/** El numero de «Disponibles» que muestra la fila del lote. */
async function disponibles(index: number, batchId: string): Promise<string> {
  const fila = await lote(index, batchId);
  const numero = fila.querySelector('.tabular-nums');
  return numero?.textContent ?? '';
}

function cliente(el: HTMLElement): HTMLInputElement {
  return within(el).getByRole('combobox', { name: 'Cliente' }) as HTMLInputElement;
}

function resumen(lineId: string): HTMLElement {
  const fila = within(screen.getByTestId(ORDER_DELIVERY_SUMMARY_TESTID))
    .getAllByTestId(ORDER_DELIVERY_SUMMARY_LINE_TESTID)
    .find((row) => row.getAttribute('data-presentation-line-id') === lineId);
  if (fila === undefined) throw new Error(`no hay fila de resumen ${lineId}`);
  return fila;
}

async function elegirCliente(user: ReturnType<typeof setupUser>, el: HTMLElement, nombre: string) {
  const combo = cliente(el);
  await user.click(combo);
  await user.type(combo, nombre.slice(0, 2));
  const opcion = (await screen.findAllByTestId('order-customer-picker-option')).find((op) => op.textContent === nombre);
  if (opcion === undefined) throw new Error(`no hay opcion ${nombre}`);
  await user.click(opcion);
  await waitFor(() => expect(combo).toHaveValue(nombre));
}

function borradorGuardado(): Record<string, unknown> | null {
  const raw = window.localStorage.getItem(DRAFT_KEY);
  return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>);
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(DELIVERY_KEY);
  getDeliveryMock.mockResolvedValue(ok());
  deliverMock.mockResolvedValue({ status: 'success', data: DELIVER_RESULTS.partial });
  searchCustomersMock.mockResolvedValue({
    status: 'success',
    data: { items: [LUIS], total: 1, page: 1, pageSize: 10, totalPages: 1 },
  });
});

afterEach(() => {
  cleanup();
  toast.dismiss();
  vi.restoreAllMocks();
});

describe('lectura', () => {
  it('mientras lee muestra el esqueleto y pide la entrega del pedido', async () => {
    let resolver: (value: OrderDeliveryResult) => void = () => undefined;
    getDeliveryMock.mockReturnValue(new Promise((resolve) => (resolver = resolve)));
    montar();

    expect(screen.getByTestId(ORDER_DELIVERY_SKELETON_TESTID)).toBeInTheDocument();
    expect(getDeliveryMock).toHaveBeenCalledWith(DELIVERY_ORDER_ID);
    resolver(ok());
    expect(await bloques()).toHaveLength(1);
    expect(screen.queryByTestId(ORDER_DELIVERY_SKELETON_TESTID)).toBeNull();
  });

  it('si la lectura falla muestra el mensaje del catalogo y ningun campo', async () => {
    getDeliveryMock.mockResolvedValue(DELIVERY_ERROR_STATES.actionNotAllowed);
    montar();

    const error = await screen.findByTestId(ORDER_DELIVERY_ERROR_TESTID);
    expect(error).toHaveAttribute('data-code', 'action_not_allowed');
    expect(error).toHaveTextContent(DELIVERY_ERROR_STATES.actionNotAllowed.message);
    expect(screen.queryByTestId(ORDER_DELIVERY_SUBMIT_TESTID)).toBeNull();
  });

  it('R4: sin borrador muestra un solo bloque «Cliente 1» con el cliente vivo del pedido', async () => {
    montar();

    const [primero, ...resto] = await bloques();
    expect(resto).toHaveLength(0);
    expect(within(primero as HTMLElement).getByRole('heading', { name: 'Cliente 1' })).toBeInTheDocument();
    expect(cliente(primero as HTMLElement)).toHaveValue('Ana Perez');
  });

  it.each([
    ['sin cliente', null],
    ['con el cliente dado de baja', { ...LUIS, isDeleted: true }],
  ])('R5: sin borrador y %s en el pedido, el unico bloque abre con el cliente vacio', async (_caso, customer) => {
    getDeliveryMock.mockResolvedValue(ok(deliveryView({ customer })));
    montar();

    expect(await bloques()).toHaveLength(1);
    expect(cliente(await bloque(0))).toHaveValue('');
  });

  it('R10: el buscador de cliente de cada bloque pide los clientes con purpose="deliver"', async () => {
    const user = setupUser();
    getDeliveryMock.mockResolvedValue(ok(deliveryView({ customer: null })));
    montar();

    const combo = cliente(await bloque(0));
    await user.click(combo);
    await user.type(combo, 'Lu');

    await waitFor(() => expect(searchCustomersMock).toHaveBeenCalled());
    for (const call of searchCustomersMock.mock.calls) {
      expect(call[1]).toBe('deliver');
    }
  });

  it('R6: el bloque lista por presentacion pendiente sus lotes con codigo, disponibles y campo; la completa no tiene campos', async () => {
    montar();

    const primero = await bloque(0);
    const presentaciones = within(primero).getAllByTestId(ORDER_DELIVERY_LINE_TESTID);
    expect(presentaciones.map((el) => el.getAttribute('data-presentation-line-id'))).toEqual([PENDING_LINE_ID]);
    expect(presentaciones[0]).toHaveTextContent('Botella 1 L');
    const filas = within(primero).getAllByTestId(ORDER_DELIVERY_BATCH_TESTID);
    expect(filas.map((row) => row.getAttribute('data-batch-id'))).toEqual([OLDER_BATCH_ID, NEWER_BATCH_ID]);
    expect(await lote(0, OLDER_BATCH_ID)).toHaveTextContent('L-2026-0001');
    expect(await disponibles(0, OLDER_BATCH_ID)).toBe('4');
    expect(await lote(0, NEWER_BATCH_ID)).toHaveTextContent('L-2026-0002');
    expect(await disponibles(0, NEWER_BATCH_ID)).toBe('6');
    expect(await campo(0, OLDER_BATCH_ID)).toHaveAttribute('inputmode', 'numeric');
    expect(within(primero).getAllByTestId(ORDER_DELIVERY_BATCH_PACKAGES_TESTID)).toHaveLength(2);
    expect(
      screen.getByTestId(ORDER_DELIVERY_SHEET_TESTID).querySelector(`[data-presentation-line-id="${COMPLETE_LINE_ID}"] input`),
    ).toBeNull();
  });

  it('R7: ni la fecha de vencimiento ni la de entrada del lote salen en el sheet', async () => {
    montar();

    const sheet = await screen.findByTestId(ORDER_DELIVERY_SHEET_TESTID);
    await bloques();
    expect(within(sheet).queryByText('Vence')).toBeNull();
    expect(sheet).not.toHaveTextContent('2027-09-30');
    expect(sheet).not.toHaveTextContent('2026-09-30');
    expect(sheet).not.toHaveTextContent('2026-10-05');
  });

  it('R11: el resumen «Por entregar» sustituye a «Pedidos · Entregados · Faltan»', async () => {
    montar();
    await bloques();

    expect(resumen(PENDING_LINE_ID)).toHaveTextContent('Botella 1 LEntregas 0 de 7Faltan 7');
    expect(resumen(COMPLETE_LINE_ID)).toHaveTextContent('Galon 4 LEntregas 0 de 0Completa');
    expect(screen.getByTestId(ORDER_DELIVERY_SHEET_TESTID)).not.toHaveTextContent(/Pedidos \d+ · Entregados/);
  });
});

describe('bloques por cliente', () => {
  it('R8: «Añadir cliente» pone al final un bloque «Cliente 2» sin cliente y sin envases', async () => {
    const user = setupUser();
    montar();

    await user.type(await campo(0, OLDER_BATCH_ID), '2');
    await user.click(screen.getByTestId(ORDER_DELIVERY_ADD_CUSTOMER_TESTID));

    const todos = await bloques();
    expect(todos).toHaveLength(2);
    const segundo = await bloque(1);
    expect(within(segundo).getByRole('heading', { name: 'Cliente 2' })).toBeInTheDocument();
    expect(cliente(segundo)).toHaveValue('');
    for (const input of within(segundo).getAllByTestId(ORDER_DELIVERY_BATCH_PACKAGES_TESTID)) {
      expect(input).toHaveValue('');
    }
    expect(cliente(await bloque(0))).toHaveValue('Ana Perez');
    expect(await campo(0, OLDER_BATCH_ID)).toHaveValue('2');
  });

  it('R9: con un solo bloque «Quitar» no existe; con dos, cada bloque lo ofrece', async () => {
    const user = setupUser();
    montar();

    await bloques();
    expect(screen.queryByTestId(ORDER_DELIVERY_BLOCK_REMOVE_TESTID)).toBeNull();
    await user.click(screen.getByTestId(ORDER_DELIVERY_ADD_CUSTOMER_TESTID));

    for (const el of await bloques()) {
      expect(within(el).getByTestId(ORDER_DELIVERY_BLOCK_REMOVE_TESTID)).toHaveAccessibleName(/^Quitar el cliente \d$/);
    }
  });

  it('R9: quitar un bloque se lleva sus envases y renumera los demas', async () => {
    const user = setupUser();
    getDeliveryMock.mockResolvedValue(ok(multiCustomerDeliveryView()));
    guardarBorrador([
      { customer: ANA, packages: { [packagesKey(PENDING_LINE_ID, OLDER_BATCH_ID)]: '3' } },
      { customer: LUIS, packages: { [packagesKey(SECOND_PENDING_LINE_ID, GALLON_BATCH_ID)]: '2' } },
    ]);
    montar();

    await user.click(within(await bloque(0)).getByTestId(ORDER_DELIVERY_BLOCK_REMOVE_TESTID));

    expect(await bloques()).toHaveLength(1);
    const unico = await bloque(0);
    expect(within(unico).getByRole('heading', { name: 'Cliente 1' })).toBeInTheDocument();
    expect(cliente(unico)).toHaveValue('Luis Gil');
    expect(await campo(0, OLDER_BATCH_ID)).toHaveValue('');
    expect(await campo(0, GALLON_BATCH_ID)).toHaveValue('2');
    expect(resumen(PENDING_LINE_ID)).toHaveTextContent('Entregas 0 de 7');
    expect(screen.queryByTestId(ORDER_DELIVERY_BLOCK_REMOVE_TESTID)).toBeNull();
  });
});

describe('topes y validacion', () => {
  beforeEach(() => getDeliveryMock.mockResolvedValue(ok(multiCustomerDeliveryView())));

  it('R11: el resumen suma lo escrito en todos los bloques por presentacion', async () => {
    const user = setupUser();
    montar();

    await user.type(await campo(0, OLDER_BATCH_ID), '3');
    await user.click(screen.getByTestId(ORDER_DELIVERY_ADD_CUSTOMER_TESTID));
    await user.type(await campo(1, NEWER_BATCH_ID), '4');
    await user.type(await campo(1, GALLON_BATCH_ID), '5');

    expect(resumen(PENDING_LINE_ID)).toHaveTextContent('Entregas 7 de 7Completa');
    expect(resumen(SECOND_PENDING_LINE_ID)).toHaveTextContent('Entregas 5 de 5Completa');
  });

  it('R12: si la suma de una presentacion supera lo que le falta, marca «Sobran N» y no envia', async () => {
    const user = setupUser();
    montar();

    await user.type(await campo(0, OLDER_BATCH_ID), '4');
    await user.type(await campo(0, NEWER_BATCH_ID), '4');

    expect(within(resumen(PENDING_LINE_ID)).getByTestId(ORDER_DELIVERY_LINE_EXCEEDS_TESTID)).toHaveTextContent(
      'Sobran 1',
    );
    await user.click(screen.getByTestId(ORDER_DELIVERY_SUBMIT_TESTID));
    expect(deliverMock).not.toHaveBeenCalled();
  });

  it('R13: los disponibles de un lote restan lo escrito en todos los bloques, igual en todos', async () => {
    const user = setupUser();
    montar();

    await user.type(await campo(0, OLDER_BATCH_ID), '3');
    await user.click(screen.getByTestId(ORDER_DELIVERY_ADD_CUSTOMER_TESTID));
    expect(await disponibles(0, OLDER_BATCH_ID)).toBe('1');
    expect(await disponibles(1, OLDER_BATCH_ID)).toBe('1');

    await user.type(await campo(1, OLDER_BATCH_ID), '1');
    expect(await disponibles(0, OLDER_BATCH_ID)).toBe('0');
    expect(await disponibles(1, OLDER_BATCH_ID)).toBe('0');
    expect(await disponibles(1, NEWER_BATCH_ID)).toBe('6');
  });

  it('R14: el campo solo acepta digitos', async () => {
    const user = setupUser();
    montar();

    const input = await campo(0, NEWER_BATCH_ID);
    await user.type(input, 'a2.,-x');
    expect(input).toHaveValue('2');
  });

  it('R14: el campo se queda en lo que el lote tiene sin contar lo de los demas bloques', async () => {
    const user = setupUser();
    montar();

    await user.type(await campo(0, OLDER_BATCH_ID), '9');
    expect(await campo(0, OLDER_BATCH_ID)).toHaveValue('4');
    await user.clear(await campo(0, OLDER_BATCH_ID));
    await user.type(await campo(0, OLDER_BATCH_ID), '3');
    await user.click(screen.getByTestId(ORDER_DELIVERY_ADD_CUSTOMER_TESTID));

    await user.type(await campo(1, OLDER_BATCH_ID), '9');
    expect(await campo(1, OLDER_BATCH_ID)).toHaveValue('1');
    expect(screen.queryByTestId(ORDER_DELIVERY_STOCK_OVER_TESTID)).toBeNull();
  });

  it('R15: si lo escrito en un lote supera sus disponibles, marca «Solo hay N» en todos los bloques, avisa y deshabilita «Entregar»', async () => {
    guardarBorrador([
      { customer: ANA, packages: { [packagesKey(PENDING_LINE_ID, OLDER_BATCH_ID)]: '3' } },
      { customer: LUIS, packages: { [packagesKey(PENDING_LINE_ID, OLDER_BATCH_ID)]: '3' } },
    ]);
    montar();

    for (const index of [0, 1]) {
      expect(within(await lote(index, OLDER_BATCH_ID)).getByTestId(ORDER_DELIVERY_BATCH_OVER_TESTID)).toHaveTextContent(
        'Solo hay 4',
      );
      expect(await campo(index, OLDER_BATCH_ID)).toHaveAttribute('aria-invalid', 'true');
      expect(within(await lote(index, NEWER_BATCH_ID)).queryByTestId(ORDER_DELIVERY_BATCH_OVER_TESTID)).toBeNull();
    }
    expect(screen.getByTestId(ORDER_DELIVERY_STOCK_OVER_TESTID)).toHaveTextContent(
      'Entre todos los clientes se pasa de lo disponible en un lote.',
    );
    expect(screen.getByTestId(ORDER_DELIVERY_SUBMIT_TESTID)).toBeDisabled();
    expect(screen.queryByTestId(ORDER_DELIVERY_DRAFT_ADJUSTED_TESTID)).toBeNull();
  });

  it('R16: al pulsar «Entregar» con un bloque sin cliente, muestra «Elige el cliente.» bajo su campo y no envia', async () => {
    const user = setupUser();
    montar();

    await user.type(await campo(0, OLDER_BATCH_ID), '2');
    await user.click(screen.getByTestId(ORDER_DELIVERY_ADD_CUSTOMER_TESTID));
    await user.type(await campo(1, NEWER_BATCH_ID), '1');
    expect(screen.queryByTestId(ORDER_DELIVERY_BLOCK_ERROR_TESTID)).toBeNull();
    await user.click(screen.getByTestId(ORDER_DELIVERY_SUBMIT_TESTID));

    const error = await within(await bloque(1)).findByTestId(ORDER_DELIVERY_BLOCK_ERROR_TESTID);
    expect(error).toHaveTextContent(TEXTO.sinCliente);
    expect(cliente(await bloque(1))).toHaveAttribute('aria-describedby', error.id);
    expect(within(await bloque(0)).queryByTestId(ORDER_DELIVERY_BLOCK_ERROR_TESTID)).toBeNull();
    expect(deliverMock).not.toHaveBeenCalled();
  });

  it('R17: un cliente repetido marca el bloque posterior con «Este cliente ya está en la entrega.» y no envia', async () => {
    const user = setupUser();
    guardarBorrador([
      { customer: ANA, packages: { [packagesKey(PENDING_LINE_ID, OLDER_BATCH_ID)]: '1' } },
      { customer: LUIS, packages: { [packagesKey(PENDING_LINE_ID, NEWER_BATCH_ID)]: '1' } },
      { customer: ANA, packages: { [packagesKey(SECOND_PENDING_LINE_ID, GALLON_BATCH_ID)]: '1' } },
    ]);
    montar();

    await bloques();
    await user.click(screen.getByTestId(ORDER_DELIVERY_SUBMIT_TESTID));

    expect(await within(await bloque(2)).findByTestId(ORDER_DELIVERY_BLOCK_ERROR_TESTID)).toHaveTextContent(TEXTO.repetido);
    expect(within(await bloque(0)).queryByTestId(ORDER_DELIVERY_BLOCK_ERROR_TESTID)).toBeNull();
    expect(within(await bloque(1)).queryByTestId(ORDER_DELIVERY_BLOCK_ERROR_TESTID)).toBeNull();
    expect(deliverMock).not.toHaveBeenCalled();
  });

  it('R18: un bloque con cliente y sin envases muestra su error y no envia; cada bloque, un solo error', async () => {
    const user = setupUser();
    guardarBorrador([
      { customer: ANA, packages: { [packagesKey(PENDING_LINE_ID, OLDER_BATCH_ID)]: '0' } },
      { customer: null, packages: {} },
    ]);
    montar();

    await bloques();
    await user.click(screen.getByTestId(ORDER_DELIVERY_SUBMIT_TESTID));

    expect(await within(await bloque(0)).findByTestId(ORDER_DELIVERY_BLOCK_ERROR_TESTID)).toHaveTextContent(TEXTO.sinEnvases);
    const errores = within(await bloque(1)).getAllByTestId(ORDER_DELIVERY_BLOCK_ERROR_TESTID);
    expect(errores).toHaveLength(1);
    expect(errores[0]).toHaveTextContent(TEXTO.sinCliente);
    expect(deliverMock).not.toHaveBeenCalled();
  });

  it('R16: el error de un bloque desaparece al corregirlo', async () => {
    const user = setupUser();
    guardarBorrador([{ customer: null, packages: { [packagesKey(PENDING_LINE_ID, OLDER_BATCH_ID)]: '2' } }]);
    montar();

    await bloques();
    await user.click(screen.getByTestId(ORDER_DELIVERY_SUBMIT_TESTID));
    expect(await screen.findByTestId(ORDER_DELIVERY_BLOCK_ERROR_TESTID)).toHaveTextContent(TEXTO.sinCliente);

    await elegirCliente(user, await bloque(0), 'Luis Gil');
    await waitFor(() => expect(screen.queryByTestId(ORDER_DELIVERY_BLOCK_ERROR_TESTID)).toBeNull());
  });

  it('R19: envia una sola entrega con la clave del borrador y cada bloque con su cliente y sus envases', async () => {
    const user = setupUser();
    montar();

    await user.type(await campo(0, OLDER_BATCH_ID), '3');
    await user.click(screen.getByTestId(ORDER_DELIVERY_ADD_CUSTOMER_TESTID));
    await elegirCliente(user, await bloque(1), 'Luis Gil');
    await user.type(await campo(1, OLDER_BATCH_ID), '1');
    await user.type(await campo(1, GALLON_BATCH_ID), '2');
    await user.type(await campo(1, NEWER_BATCH_ID), '0');
    await user.click(screen.getByTestId(ORDER_DELIVERY_SUBMIT_TESTID));

    await waitFor(() => expect(deliverMock).toHaveBeenCalledTimes(1));
    expect(deliverMock).toHaveBeenCalledWith(deliverInput());
  });
});

describe('despues de enviar', () => {
  it.each([
    ['delivered con el pedido aun TERMINADO', DELIVER_RESULTS.partial, 'Entrega registrada'],
    ['delivered que deja el pedido ENTREGADO', DELIVER_RESULTS.completed, 'Pedido entregado'],
    ['already_registered', DELIVER_RESULTS.alreadyRegistered, 'Pedido entregado'],
  ] as const)('QC-223 R33: tras %s borra el borrador, cierra, avisa y refresca', async (_caso, data, mensaje) => {
    const user = setupUser();
    const exito = vi.spyOn(toast, 'success');
    deliverMock.mockResolvedValue({ status: 'success', data });
    montar();

    await user.type(await campo(0, OLDER_BATCH_ID), '2');
    expect(borradorGuardado()).not.toBeNull();
    await user.click(screen.getByTestId(ORDER_DELIVERY_SUBMIT_TESTID));

    await waitFor(() => expect(cerrar).toHaveBeenCalledWith(false));
    expect(borradorGuardado()).toBeNull();
    expect(exito).toHaveBeenCalledWith(mensaje);
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['delivery_exceeds_remaining', DELIVERY_ERROR_STATES.exceedsRemaining],
    ['delivery_batch_insufficient', DELIVERY_ERROR_STATES.batchInsufficient],
  ] as const)('QC-223 R34: tras %s sigue abierto, muestra el mensaje, relee y conserva el borrador', async (code, error) => {
    const user = setupUser();
    deliverMock.mockResolvedValue(error);
    montar();

    await user.type(await campo(0, OLDER_BATCH_ID), '3');
    await user.click(screen.getByTestId(ORDER_DELIVERY_SUBMIT_TESTID));

    const aviso = await screen.findByTestId(ORDER_DELIVERY_REJECTED_TESTID);
    expect(aviso).toHaveAttribute('data-code', code);
    expect(aviso).toHaveTextContent(error.message);
    await waitFor(() => expect(getDeliveryMock).toHaveBeenCalledTimes(2));
    expect(cerrar).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
    expect(await campo(0, OLDER_BATCH_ID)).toHaveValue('3');
    expect(borradorGuardado()).toMatchObject({
      v: 2,
      deliveryKey: DELIVERY_KEY,
      blocks: [{ customer: ANA, packages: { [packagesKey(PENDING_LINE_ID, OLDER_BATCH_ID)]: '3' } }],
    });
  });

  it('R46: si al releer un lote ya no se ofrece, descarta sus envases, avisa y conserva el resto', async () => {
    const user = setupUser();
    deliverMock.mockResolvedValue(DELIVERY_ERROR_STATES.batchInsufficient);
    montar();

    await user.type(await campo(0, OLDER_BATCH_ID), '1');
    await user.type(await campo(0, NEWER_BATCH_ID), '2');
    getDeliveryMock.mockResolvedValue(ok(viewWithoutNewerBatch()));
    await user.click(screen.getByTestId(ORDER_DELIVERY_SUBMIT_TESTID));

    expect(await screen.findByTestId(ORDER_DELIVERY_DRAFT_ADJUSTED_TESTID)).toBeInTheDocument();
    expect(screen.getAllByTestId(ORDER_DELIVERY_BATCH_TESTID)).toHaveLength(1);
    expect(await campo(0, OLDER_BATCH_ID)).toHaveValue('1');
    expect(borradorGuardado()).toMatchObject({
      blocks: [{ packages: { [packagesKey(PENDING_LINE_ID, OLDER_BATCH_ID)]: '1' } }],
    });
  });

  it('cualquier otro error, incluido customer_not_found, se muestra y el sheet sigue abierto con el borrador', async () => {
    const user = setupUser();
    deliverMock.mockResolvedValue(DELIVERY_ERROR_STATES.customerNotFound);
    montar();

    await user.type(await campo(0, OLDER_BATCH_ID), '2');
    await user.click(screen.getByTestId(ORDER_DELIVERY_SUBMIT_TESTID));

    const error = await screen.findByTestId(ORDER_DELIVERY_ERROR_TESTID);
    expect(error).toHaveAttribute('data-code', 'customer_not_found');
    expect(getDeliveryMock).toHaveBeenCalledTimes(1);
    expect(cerrar).not.toHaveBeenCalled();
    expect(borradorGuardado()).not.toBeNull();
  });
});

describe('borrador', () => {
  it.each([
    ['la X', async (user: ReturnType<typeof setupUser>) => user.click(screen.getByRole('button', { name: 'Close' }))],
    ['Escape', async (user: ReturnType<typeof setupUser>) => user.keyboard('{Escape}')],
  ] as const)('R45: cerrar con %s conserva los bloques y al reabrir los restaura en orden con su clave', async (_via, closeWith) => {
    const user = setupUser();
    getDeliveryMock.mockResolvedValue(ok(multiCustomerDeliveryView()));
    render(<ConReapertura />);

    await user.type(await campo(0, OLDER_BATCH_ID), '3');
    await user.click(screen.getByTestId(ORDER_DELIVERY_ADD_CUSTOMER_TESTID));
    await elegirCliente(user, await bloque(1), 'Luis Gil');
    await user.type(await campo(1, OLDER_BATCH_ID), '1');
    await user.type(await campo(1, GALLON_BATCH_ID), '2');
    await closeWith(user);
    await waitFor(() => expect(screen.queryByTestId(ORDER_DELIVERY_SHEET_TESTID)).toBeNull());
    expect(borradorGuardado()).toMatchObject({ v: 2, deliveryKey: DELIVERY_KEY });

    vi.mocked(crypto.randomUUID).mockReturnValue('b0000000-0000-4000-8000-0000000000ff');
    await user.click(screen.getByTestId('reabrir'));

    expect(await bloques()).toHaveLength(2);
    expect(cliente(await bloque(0))).toHaveValue('Ana Perez');
    expect(cliente(await bloque(1))).toHaveValue('Luis Gil');
    expect(await campo(0, OLDER_BATCH_ID)).toHaveValue('3');
    expect(await campo(1, OLDER_BATCH_ID)).toHaveValue('1');
    expect(await campo(1, GALLON_BATCH_ID)).toHaveValue('2');
    await user.click(screen.getByTestId(ORDER_DELIVERY_SUBMIT_TESTID));
    await waitFor(() => expect(deliverMock).toHaveBeenCalledTimes(1));
    expect(deliverMock).toHaveBeenCalledWith(deliverInput());
  });

  it('R45: cada cambio de los bloques se guarda al momento', async () => {
    const user = setupUser();
    montar();

    await user.type(await campo(0, OLDER_BATCH_ID), '2');
    expect(borradorGuardado()).toMatchObject({ blocks: [{ key: '1', customer: ANA }] });
    await user.click(screen.getByTestId(ORDER_DELIVERY_ADD_CUSTOMER_TESTID));
    expect(borradorGuardado()).toMatchObject({ blocks: [{ key: '1' }, { key: '2', customer: null, packages: {} }] });
    await user.click(within(await bloque(0)).getByTestId(ORDER_DELIVERY_BLOCK_REMOVE_TESTID));
    expect(borradorGuardado()).toMatchObject({ blocks: [{ key: '2', customer: null }] });
  });

  it('R45: un borrador v1 de antes de los bloques se restaura como un solo bloque con su cliente', async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        v: 1,
        orderId: DELIVERY_ORDER_ID,
        deliveryKey: DELIVERY_KEY,
        customer: LUIS,
        packages: { [packagesKey(PENDING_LINE_ID, OLDER_BATCH_ID)]: '2' },
      }),
    );
    montar();

    expect(await bloques()).toHaveLength(1);
    expect(cliente(await bloque(0))).toHaveValue('Luis Gil');
    expect(await campo(0, OLDER_BATCH_ID)).toHaveValue('2');
  });

  it('QC-223 R36: «Cancelar» borra el borrador y cierra', async () => {
    const user = setupUser();
    montar();

    await user.type(await campo(0, OLDER_BATCH_ID), '2');
    expect(borradorGuardado()).not.toBeNull();
    await user.click(screen.getByTestId(ORDER_DELIVERY_CANCEL_TESTID));

    expect(borradorGuardado()).toBeNull();
    expect(cerrar).toHaveBeenCalledWith(false);
    expect(deliverMock).not.toHaveBeenCalled();
  });

  it('R46: al restaurar descarta de todos los bloques los lotes que ya no se ofrecen y avisa', async () => {
    guardarBorrador([
      { customer: ANA, packages: { [packagesKey(PENDING_LINE_ID, OLDER_BATCH_ID)]: '2' } },
      {
        customer: LUIS,
        packages: {
          [packagesKey(PENDING_LINE_ID, NEWER_BATCH_ID)]: '1',
          [packagesKey(PENDING_LINE_ID, GONE_BATCH_ID)]: '3',
        },
      },
    ]);
    montar();

    expect(await screen.findByTestId(ORDER_DELIVERY_DRAFT_ADJUSTED_TESTID)).toHaveTextContent(
      'Algunos lotes del borrador ya no están disponibles y se quitaron sus envases.',
    );
    expect(await campo(0, OLDER_BATCH_ID)).toHaveValue('2');
    expect(await campo(1, NEWER_BATCH_ID)).toHaveValue('1');
    expect(borradorGuardado()).toMatchObject({
      blocks: [
        { packages: { [packagesKey(PENDING_LINE_ID, OLDER_BATCH_ID)]: '2' } },
        { packages: { [packagesKey(PENDING_LINE_ID, NEWER_BATCH_ID)]: '1' } },
      ],
    });
  });

  it('R46: un borrador restaurado que supera lo que falta no muestra el aviso de borrador', async () => {
    guardarBorrador([
      {
        customer: ANA,
        packages: {
          [packagesKey(PENDING_LINE_ID, OLDER_BATCH_ID)]: '4',
          [packagesKey(PENDING_LINE_ID, NEWER_BATCH_ID)]: '6',
        },
      },
    ]);
    montar();

    expect(await within(await waitForResumen()).findByTestId(ORDER_DELIVERY_LINE_EXCEEDS_TESTID)).toBeInTheDocument();
    expect(screen.queryByTestId(ORDER_DELIVERY_DRAFT_ADJUSTED_TESTID)).toBeNull();
  });
});

async function waitForResumen(): Promise<HTMLElement> {
  return screen.findByTestId(ORDER_DELIVERY_SUMMARY_TESTID);
}

describe('montaje desde la fila', () => {
  // La tabla consulta el ancho con `matchMedia`, que jsdom no trae.
  beforeEach(() => setViewportWidth(WIDE_VIEWPORT));
  afterEach(() => resetViewport());

  function pedidoTerminado(): OrderSummary {
    return {
      id: DELIVERY_ORDER_ID,
      number: { year: 2026, sequence: 7 },
      numberText: formatOrderNumber({ year: 2026, sequence: 7 }),
      recipeId: '22222222-2222-4222-8222-222222222222',
      recipeName: 'Esmalte azul',
      recipeVersion: null,
      quantity: '100.0000',
      priority: 'MEDIA',
      status: 'TERMINADO',
      cancellationReason: null,
      ingredientsCost: null,
      createdAt: new Date('2026-01-15T10:00:00.000Z'),
      updatedAt: new Date('2026-01-15T10:00:00.000Z'),
      createdBy: null,
      updatedBy: null,
      presentationLines: [],
      unitId: null,
      unitLabel: null,
      customer: null,
      recipeImageUrl: null,
    };
  }

  it('QC-223 R4: solo se monta al pulsar «Entregar» en la fila y pide la entrega de ese pedido', async () => {
    const user = setupUser();
    render(
      <OrderTable
        orders={[pedidoTerminado()]}
        params={createDefaultParams()}
        totalPages={1}
        recipes={{ items: [], totalPages: 1 }}
        units={[]}
        bridge={null}
        canDeliver
      />,
    );

    expect(screen.queryByTestId(ORDER_DELIVERY_SHEET_TESTID)).toBeNull();
    expect(getDeliveryMock).not.toHaveBeenCalled();

    await user.click(within(screen.getByTestId(`data-table-row-${DELIVERY_ORDER_ID}`)).getByTestId('order-row-actions'));
    await user.click(await screen.findByTestId(ORDER_ACTION_DELIVER_TESTID));

    expect(await screen.findByTestId(ORDER_DELIVERY_SHEET_TESTID)).toBeInTheDocument();
    expect(getDeliveryMock).toHaveBeenCalledWith(DELIVERY_ORDER_ID);
  });
  it('desde la fila, el titulo es la receta del pedido y la imagen es la que trae el pedido', async () => {
    const user = setupUser();
    const pedido = { ...pedidoTerminado(), recipeImageUrl: 'https://img.example/esmalte.png' };
    render(
      <OrderTable
        orders={[pedido]}
        params={createDefaultParams()}
        totalPages={1}
        recipes={{ items: [], totalPages: 1 }}
        units={[]}
        bridge={null}
        canDeliver
      />,
    );

    await user.click(within(screen.getByTestId(`data-table-row-${DELIVERY_ORDER_ID}`)).getByTestId('order-row-actions'));
    await user.click(await screen.findByTestId(ORDER_ACTION_DELIVER_TESTID));

    expect(await screen.findByRole('dialog', { name: 'Esmalte azul' })).toBeInTheDocument();
    const resumen = await screen.findByTestId(ORDER_DELIVERY_SUMMARY_TESTID);
    expect(within(resumen).getByTestId(ORDER_RECIPE_IMAGE_TESTID)).toHaveAttribute(
      'src',
      'https://img.example/esmalte.png',
    );
  });
});

describe('los textos del panel son los de hoy (QC-262 R20)', () => {
  it('QC-262 R20: sin nombre de receta, el titulo es «Entregar pedido <numero>»; «Cancelar» y «Entregar»', async () => {
    montar();

    expect(await screen.findByRole('dialog', { name: `Entregar pedido ${ORDER.numberText}` })).toBeInTheDocument();
    expect(screen.queryByText('Elige el cliente y, por presentación, de qué lotes salen los envases.')).toBeNull();
    expect(screen.getByTestId(ORDER_DELIVERY_CANCEL_TESTID)).toHaveTextContent(/^Cancelar$/);
    expect(await screen.findByTestId(ORDER_DELIVERY_SUBMIT_TESTID)).toHaveTextContent(/^Entregar$/);
  });
});

describe('cabecera con el producto', () => {
  it('el titulo es el nombre de la receta y debajo va «Pedido <numero>» con el numero en mono', async () => {
    render(<OrderDeliverySheet order={{ ...ORDER, recipeName: 'Esmalte azul' }} open onOpenChange={cerrar} />);

    const dialog = await screen.findByRole('dialog', { name: 'Esmalte azul' });
    expect(within(dialog).getByRole('heading', { name: 'Esmalte azul' })).toBeInTheDocument();
    const numero = screen.getByTestId(ORDER_DELIVERY_NUMBER_TESTID);
    expect(numero).toHaveTextContent(`Pedido ${ORDER.numberText}`);
    expect(within(numero).getByText(ORDER.numberText)).toHaveClass('font-mono');
    expect(screen.queryByText('Elige el cliente y, por presentación, de qué lotes salen los envases.')).toBeNull();
  });

  it('la imagen del producto va junto a «Por entregar»; sin imagen, el marcador', async () => {
    const { unmount } = render(
      <OrderDeliverySheet
        order={{ ...ORDER, recipeName: 'Esmalte azul', recipeImageUrl: 'https://img.example/esmalte.png' }}
        open
        onOpenChange={cerrar}
      />,
    );

    const resumen = await screen.findByTestId(ORDER_DELIVERY_SUMMARY_TESTID);
    const imagen = within(resumen).getByTestId(ORDER_RECIPE_IMAGE_TESTID);
    expect(imagen).toHaveAttribute('src', 'https://img.example/esmalte.png');
    expect(imagen).toHaveAttribute('alt', 'Esmalte azul');
    expect(imagen).not.toHaveAttribute('data-missing');
    unmount();

    render(<OrderDeliverySheet order={{ ...ORDER, recipeName: 'Esmalte azul' }} open onOpenChange={cerrar} />);
    const sinImagen = within(await screen.findByTestId(ORDER_DELIVERY_SUMMARY_TESTID)).getByTestId(
      ORDER_RECIPE_IMAGE_TESTID,
    );
    expect(sinImagen).toHaveAttribute('data-missing', 'true');
  });
});
