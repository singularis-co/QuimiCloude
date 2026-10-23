// El sheet «Entregar sin pedido» con las Server Actions dobladas: lectura, bloques por cliente,
// topes del lote y del excedente, nota, envio, rechazos y borrador.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DIRECT_DELIVERY_CANCEL_TESTID,
  DIRECT_DELIVERY_COUNTER_TESTID,
  DIRECT_DELIVERY_DRAFT_ADJUSTED_TESTID,
  DIRECT_DELIVERY_ERROR_TESTID,
  DIRECT_DELIVERY_NOTE_ERROR_TESTID,
  DIRECT_DELIVERY_NOTE_TESTID,
  DIRECT_DELIVERY_NO_SURPLUS_TESTID,
  DIRECT_DELIVERY_OVER_SURPLUS_TESTID,
  DIRECT_DELIVERY_REJECTED_TESTID,
  DIRECT_DELIVERY_SHEET_TESTID,
  DIRECT_DELIVERY_SKELETON_TESTID,
  DIRECT_DELIVERY_STOCK_OVER_TESTID,
  DIRECT_DELIVERY_SUBMIT_TESTID,
  DIRECT_DELIVERY_SURPLUS_TESTID,
  DirectDeliverySheet,
  directDeliveryDraftKey,
} from '@/app/(private)/inventario/components';
import {
  ORDER_DELIVERY_ADD_CUSTOMER_TESTID,
  ORDER_DELIVERY_BATCH_OVER_TESTID,
  ORDER_DELIVERY_BATCH_PACKAGES_TESTID,
  ORDER_DELIVERY_BATCH_TESTID,
  ORDER_DELIVERY_BLOCK_ERROR_TESTID,
  ORDER_DELIVERY_BLOCK_REMOVE_TESTID,
  ORDER_DELIVERY_BLOCK_TESTID,
  ORDER_DELIVERY_LINE_TESTID,
} from '@/components/shared/order-delivery-customer-block';
import type { DirectDeliveryView, OrderCustomer } from '@/lib/modules/pedidos';
import type {
  DeliverDirectActionResult,
  DirectDeliveryResult,
  OrderCustomerOptionsResult,
} from '@/lib/modules/pedidos/adapters/driving/order-actions';

import {
  DIRECT_DELIVERY_ERROR_STATES,
  DIRECT_DELIVERY_KEY,
  DIRECT_DELIVERY_RESULTS,
  DIRECT_FIRST_CUSTOMER_ID,
  DIRECT_NEWER_BATCH_ID,
  DIRECT_OLDER_BATCH_ID,
  DIRECT_PRODUCT_ID,
  DIRECT_SECOND_CUSTOMER_ID,
  deliverDirectInput,
  directDeliveryView,
} from '../../fixtures/direct-delivery';
import { setupUser } from '../../helpers/user-event';

const { getDirectMock, deliverDirectMock, searchCustomersMock, routerMock } = vi.hoisted(() => ({
  getDirectMock: vi.fn<(productId: string) => Promise<DirectDeliveryResult>>(),
  deliverDirectMock: vi.fn<(input: unknown) => Promise<DeliverDirectActionResult>>(),
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
    throw new Error(`${nombre} no debe invocarse desde el sheet de entrega sin pedido`);
  };
  return {
    getDirectDeliveryAction: getDirectMock,
    deliverDirectAction: deliverDirectMock,
    searchOrderCustomersAction: searchCustomersMock,
    listDirectDeliverySurplusAction: vi.fn(noDebeInvocarse('listDirectDeliverySurplusAction')),
    getDirectDeliveryForVoidAction: vi.fn(noDebeInvocarse('getDirectDeliveryForVoidAction')),
    voidDirectDeliveryAction: vi.fn(noDebeInvocarse('voidDirectDeliveryAction')),
    getOrderDeliveryAction: vi.fn(noDebeInvocarse('getOrderDeliveryAction')),
    deliverOrderAction: vi.fn(noDebeInvocarse('deliverOrderAction')),
    voidDeliveryAction: vi.fn(noDebeInvocarse('voidDeliveryAction')),
  };
});

const ANA: OrderCustomer = { id: DIRECT_FIRST_CUSTOMER_ID, name: 'Ana Perez', isDeleted: false };
const BRUNO: OrderCustomer = { id: DIRECT_SECOND_CUSTOMER_ID, name: 'Bruno Diaz', isDeleted: false };
const DRAFT_KEY = directDeliveryDraftKey(DIRECT_PRODUCT_ID);
const GONE_BATCH_ID = 'e0000000-0000-4000-8000-000000000999';

const TEXTO = {
  sinCliente: 'Elige el cliente.',
  repetido: 'Este cliente ya está en la entrega.',
  sinEnvases: 'Este cliente no lleva envases: indica al menos uno.',
  notaLarga: 'La nota no puede pasar de 500 caracteres.',
  ajustado: 'Algunos lotes del borrador ya no están disponibles y se quitaron sus envases.',
} as const;

const cerrar = vi.fn<(open: boolean) => void>();

function ok(view: DirectDeliveryView = directDeliveryView()): DirectDeliveryResult {
  return { status: 'success', data: view };
}

type BloqueGuardado = { readonly customer: OrderCustomer | null; readonly packages: Record<string, string> };

function guardarBorrador(bloques: readonly BloqueGuardado[], note = '') {
  window.localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      v: 1,
      productId: DIRECT_PRODUCT_ID,
      deliveryKey: DIRECT_DELIVERY_KEY,
      blocks: bloques.map((bloque, index) => ({ key: String(index + 1), ...bloque })),
      note,
    }),
  );
}

function borradorGuardado(): Record<string, unknown> | null {
  const raw = window.localStorage.getItem(DRAFT_KEY);
  return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>);
}

function montar() {
  render(<DirectDeliverySheet productId={DIRECT_PRODUCT_ID} open onOpenChange={cerrar} />);
}

/** Monta el sheet como lo montan sus entradas: solo mientras esta abierto, con un boton para reabrir. */
function ConReapertura() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid="reabrir">
        reabrir
      </button>
      {open ? <DirectDeliverySheet productId={DIRECT_PRODUCT_ID} open onOpenChange={setOpen} /> : null}
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

async function disponibles(index: number, batchId: string): Promise<string> {
  const fila = await lote(index, batchId);
  return fila.querySelector('.tabular-nums')?.textContent ?? '';
}

function cliente(el: HTMLElement): HTMLInputElement {
  return within(el).getByRole('combobox', { name: 'Cliente' }) as HTMLInputElement;
}

function nota(): HTMLTextAreaElement {
  return screen.getByTestId(DIRECT_DELIVERY_NOTE_TESTID) as HTMLTextAreaElement;
}

function entregar(): HTMLElement {
  return screen.getByTestId(DIRECT_DELIVERY_SUBMIT_TESTID);
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

/** El borrador del tablero: Ana con 4 del lote viejo; Bruno con 1 del viejo y 1 del nuevo. */
function guardarBorradorDelFixture(note = 'Venta mostrador, factura 0012') {
  guardarBorrador(
    [
      { customer: ANA, packages: { [DIRECT_OLDER_BATCH_ID]: '4' } },
      { customer: BRUNO, packages: { [DIRECT_OLDER_BATCH_ID]: '1', [DIRECT_NEWER_BATCH_ID]: '1' } },
    ],
    note,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(DIRECT_DELIVERY_KEY);
  getDirectMock.mockResolvedValue(ok());
  deliverDirectMock.mockResolvedValue({ status: 'success', data: DIRECT_DELIVERY_RESULTS.delivered });
  searchCustomersMock.mockResolvedValue({
    status: 'success',
    data: { items: [ANA, BRUNO], total: 2, page: 1, pageSize: 10, totalPages: 1 },
  });
});

afterEach(() => {
  cleanup();
  toast.dismiss();
  vi.restoreAllMocks();
});

describe('lectura', () => {
  it('mientras lee muestra el esqueleto y pide el contenido del producto', async () => {
    let resolver: (value: DirectDeliveryResult) => void = () => undefined;
    getDirectMock.mockReturnValue(new Promise((resolve) => (resolver = resolve)));
    montar();

    expect(screen.getByTestId(DIRECT_DELIVERY_SKELETON_TESTID)).toBeInTheDocument();
    expect(getDirectMock).toHaveBeenCalledWith(DIRECT_PRODUCT_ID);
    resolver(ok());
    expect(await bloques()).toHaveLength(1);
    expect(screen.queryByTestId(DIRECT_DELIVERY_SKELETON_TESTID)).toBeNull();
  });

  it('si la lectura falla muestra el mensaje del catalogo y ningun campo', async () => {
    getDirectMock.mockResolvedValue(DIRECT_DELIVERY_ERROR_STATES.unauthorized);
    montar();

    const error = await screen.findByTestId(DIRECT_DELIVERY_ERROR_TESTID);
    expect(error).toHaveAttribute('data-code', 'unauthorized');
    expect(error).toHaveTextContent(DIRECT_DELIVERY_ERROR_STATES.unauthorized.message);
    expect(screen.queryByTestId(DIRECT_DELIVERY_SUBMIT_TESTID)).toBeNull();
  });

  it('la cabecera dice «Entregar sin pedido» con el producto y su presentacion', async () => {
    montar();

    const sheet = await screen.findByTestId(DIRECT_DELIVERY_SHEET_TESTID);
    expect(within(sheet).getByRole('heading', { name: 'Entregar sin pedido' })).toBeInTheDocument();
    await waitFor(() => expect(sheet).toHaveTextContent('Desengrasante industrial · Botella 1 L.'));
  });

  it('R10: muestra la tarjeta «Excedente» con lo de la vista', async () => {
    montar();

    const tarjeta = await screen.findByTestId(DIRECT_DELIVERY_SURPLUS_TESTID);
    expect(tarjeta).toHaveTextContent('20 envases');
    expect(tarjeta).toHaveTextContent('−8 envases');
    expect(tarjeta).toHaveTextContent('Se puede entregar12 envases');
    expect(tarjeta).toHaveTextContent('Pedido 2026-0000031 · faltan 5 envases');
  });

  it('R12: sin borrador muestra un solo bloque «Cliente 1» con cliente, envases y nota vacios', async () => {
    montar();

    const [primero, ...resto] = await bloques();
    expect(resto).toHaveLength(0);
    expect(within(primero as HTMLElement).getByRole('heading', { name: 'Cliente 1' })).toBeInTheDocument();
    expect(cliente(primero as HTMLElement)).toHaveValue('');
    expect(await campo(0, DIRECT_OLDER_BATCH_ID)).toHaveValue('');
    expect(await campo(0, DIRECT_NEWER_BATCH_ID)).toHaveValue('');
    expect(nota()).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Nota (opcional)' })).toBe(nota());
  });

  it('R13: cada bloque lista los lotes entregables con su codigo, sus disponibles y un campo, sin fechas', async () => {
    montar();

    const primero = await bloque(0);
    expect(within(primero).getAllByTestId(ORDER_DELIVERY_LINE_TESTID)).toHaveLength(1);
    const filas = within(primero).getAllByTestId(ORDER_DELIVERY_BATCH_TESTID);
    expect(filas.map((fila) => fila.getAttribute('data-batch-id'))).toEqual([DIRECT_OLDER_BATCH_ID, DIRECT_NEWER_BATCH_ID]);
    expect(filas[0]).toHaveTextContent('L-2026-0288');
    expect(await disponibles(0, DIRECT_OLDER_BATCH_ID)).toBe('12');
    expect(await disponibles(0, DIRECT_NEWER_BATCH_ID)).toBe('8');
    const sheet = screen.getByTestId(DIRECT_DELIVERY_SHEET_TESTID);
    for (const fecha of ['2026-10-01', '2027-10-01', '2026-10-10']) {
      expect(sheet).not.toHaveTextContent(fecha);
    }
  });

  it('R15: el buscador de cliente de cada bloque pide los clientes con purpose="deliver"', async () => {
    const user = setupUser();
    montar();

    const combo = cliente(await bloque(0));
    await user.click(combo);
    await user.type(combo, 'An');

    await waitFor(() => expect(searchCustomersMock).toHaveBeenCalled());
    for (const call of searchCustomersMock.mock.calls) {
      expect(call[1]).toBe('deliver');
    }
  });
});

describe('bloques', () => {
  it('R14: «Añadir cliente» pone al final un bloque «Cliente 2» sin cliente y sin envases', async () => {
    const user = setupUser();
    montar();

    await user.type(await campo(0, DIRECT_OLDER_BATCH_ID), '2');
    await user.click(screen.getByTestId(ORDER_DELIVERY_ADD_CUSTOMER_TESTID));

    const segundo = await bloque(1);
    expect(within(segundo).getByRole('heading', { name: 'Cliente 2' })).toBeInTheDocument();
    expect(cliente(segundo)).toHaveValue('');
    expect(await campo(1, DIRECT_OLDER_BATCH_ID)).toHaveValue('');
    expect(await campo(1, DIRECT_NEWER_BATCH_ID)).toHaveValue('');
  });

  it('R14: con un solo bloque «Quitar» no existe; con dos, cada bloque lo ofrece', async () => {
    const user = setupUser();
    montar();

    expect(within(await bloque(0)).queryByTestId(ORDER_DELIVERY_BLOCK_REMOVE_TESTID)).toBeNull();
    await user.click(screen.getByTestId(ORDER_DELIVERY_ADD_CUSTOMER_TESTID));
    for (const index of [0, 1]) {
      expect(within(await bloque(index)).getByTestId(ORDER_DELIVERY_BLOCK_REMOVE_TESTID)).toBeInTheDocument();
    }
  });

  it('R14: quitar un bloque se lleva sus envases y renumera los demas', async () => {
    const user = setupUser();
    guardarBorrador([
      { customer: ANA, packages: { [DIRECT_OLDER_BATCH_ID]: '3' } },
      { customer: BRUNO, packages: { [DIRECT_NEWER_BATCH_ID]: '2' } },
    ]);
    montar();

    await user.click(within(await bloque(0)).getByTestId(ORDER_DELIVERY_BLOCK_REMOVE_TESTID));

    const restantes = await bloques();
    expect(restantes).toHaveLength(1);
    expect(within(restantes[0] as HTMLElement).getByRole('heading', { name: 'Cliente 1' })).toBeInTheDocument();
    expect(cliente(restantes[0] as HTMLElement)).toHaveValue('Bruno Diaz');
    expect(await disponibles(0, DIRECT_OLDER_BATCH_ID)).toBe('12');
    expect(await campo(0, DIRECT_NEWER_BATCH_ID)).toHaveValue('2');
    expect(within(restantes[0] as HTMLElement).queryByTestId(ORDER_DELIVERY_BLOCK_REMOVE_TESTID)).toBeNull();
  });

  it('R16: los disponibles de un lote restan lo escrito en todos los bloques, igual en todos', async () => {
    const user = setupUser();
    montar();

    await user.type(await campo(0, DIRECT_OLDER_BATCH_ID), '9');
    await user.click(screen.getByTestId(ORDER_DELIVERY_ADD_CUSTOMER_TESTID));
    expect(await disponibles(0, DIRECT_OLDER_BATCH_ID)).toBe('3');
    expect(await disponibles(1, DIRECT_OLDER_BATCH_ID)).toBe('3');

    await user.type(await campo(1, DIRECT_OLDER_BATCH_ID), '3');
    expect(await disponibles(0, DIRECT_OLDER_BATCH_ID)).toBe('0');
    expect(await disponibles(1, DIRECT_OLDER_BATCH_ID)).toBe('0');
    expect(await disponibles(1, DIRECT_NEWER_BATCH_ID)).toBe('8');
  });

  it('R16: el campo solo acepta digitos', async () => {
    const user = setupUser();
    montar();

    const input = await campo(0, DIRECT_NEWER_BATCH_ID);
    await user.type(input, 'a2.,-x');
    expect(input).toHaveValue('2');
  });

  it('R16: el campo se queda en lo que el lote tiene menos lo escrito por los demas bloques', async () => {
    const user = setupUser();
    montar();

    await user.type(await campo(0, DIRECT_NEWER_BATCH_ID), '99');
    expect(await campo(0, DIRECT_NEWER_BATCH_ID)).toHaveValue('8');
    await user.clear(await campo(0, DIRECT_NEWER_BATCH_ID));
    await user.type(await campo(0, DIRECT_NEWER_BATCH_ID), '5');
    await user.click(screen.getByTestId(ORDER_DELIVERY_ADD_CUSTOMER_TESTID));

    await user.type(await campo(1, DIRECT_NEWER_BATCH_ID), '9');
    expect(await campo(1, DIRECT_NEWER_BATCH_ID)).toHaveValue('3');
    expect(screen.queryByTestId(DIRECT_DELIVERY_STOCK_OVER_TESTID)).toBeNull();
  });

  it('R11: el contador suma lo escrito en todos los bloques', async () => {
    const user = setupUser();
    montar();

    const contador = await screen.findByTestId(DIRECT_DELIVERY_COUNTER_TESTID);
    expect(contador).toHaveTextContent('Entregas 0 de 12');
    expect(contador).toHaveTextContent('Sin envases');
    await user.type(await campo(0, DIRECT_OLDER_BATCH_ID), '4');
    await user.click(screen.getByTestId(ORDER_DELIVERY_ADD_CUSTOMER_TESTID));
    await user.type(await campo(1, DIRECT_NEWER_BATCH_ID), '3');
    expect(contador).toHaveTextContent('Entregas 7 de 12');
    expect(contador).toHaveTextContent('Quedan 5 libres');
  });
});

describe('topes', () => {
  it('R17: si lo escrito en un lote supera sus disponibles, marca «Solo hay N» en todos los bloques, avisa y deshabilita «Entregar»', async () => {
    guardarBorrador([
      { customer: ANA, packages: { [DIRECT_NEWER_BATCH_ID]: '5' } },
      { customer: BRUNO, packages: { [DIRECT_NEWER_BATCH_ID]: '5' } },
    ]);
    montar();

    for (const index of [0, 1]) {
      expect(
        within(await lote(index, DIRECT_NEWER_BATCH_ID)).getByTestId(ORDER_DELIVERY_BATCH_OVER_TESTID),
      ).toHaveTextContent('Solo hay 8');
      expect(await campo(index, DIRECT_NEWER_BATCH_ID)).toHaveAttribute('aria-invalid', 'true');
      expect(within(await lote(index, DIRECT_OLDER_BATCH_ID)).queryByTestId(ORDER_DELIVERY_BATCH_OVER_TESTID)).toBeNull();
    }
    expect(screen.getByTestId(DIRECT_DELIVERY_STOCK_OVER_TESTID)).toHaveTextContent(
      'Entre todos los clientes se pasa de lo disponible en un lote. Baja los envases para poder entregar.',
    );
    expect(entregar()).toBeDisabled();
    expect(screen.queryByTestId(DIRECT_DELIVERY_OVER_SURPLUS_TESTID)).toBeNull();
  });

  it('R18: si los escritos superan el excedente, avisa con el excedente y deshabilita «Entregar»', async () => {
    const user = setupUser();
    montar();

    await user.type(await campo(0, DIRECT_OLDER_BATCH_ID), '10');
    expect(screen.queryByTestId(DIRECT_DELIVERY_OVER_SURPLUS_TESTID)).toBeNull();
    await user.click(screen.getByTestId(ORDER_DELIVERY_ADD_CUSTOMER_TESTID));
    await user.type(await campo(1, DIRECT_NEWER_BATCH_ID), '3');

    expect(screen.getByTestId(DIRECT_DELIVERY_OVER_SURPLUS_TESTID)).toHaveTextContent(
      'Entre todos los clientes se pasa del excedente: solo se pueden entregar 12 envases sin tocar lo que esperan los pedidos.',
    );
    expect(screen.getByTestId(DIRECT_DELIVERY_COUNTER_TESTID)).toHaveTextContent('Sobran 1');
    expect(entregar()).toBeDisabled();
    expect(screen.queryByTestId(DIRECT_DELIVERY_STOCK_OVER_TESTID)).toBeNull();

    await user.clear(await campo(1, DIRECT_NEWER_BATCH_ID));
    await user.type(await campo(1, DIRECT_NEWER_BATCH_ID), '2');
    expect(screen.queryByTestId(DIRECT_DELIVERY_OVER_SURPLUS_TESTID)).toBeNull();
    expect(entregar()).toBeEnabled();
  });

  it('R21: con excedente cero muestra «No hay envases libres…» con el stock, sin bloques ni nota y «Entregar» deshabilitado', async () => {
    getDirectMock.mockResolvedValue(ok(directDeliveryView({ waitingPackages: 20, surplusPackages: 0 })));
    montar();

    const vacio = await screen.findByTestId(DIRECT_DELIVERY_NO_SURPLUS_TESTID);
    expect(vacio).toHaveTextContent('No hay envases libres para entregar sin pedido');
    expect(vacio).toHaveTextContent('Los 20 envases en stock esperan a pedidos terminados.');
    expect(screen.queryByTestId(ORDER_DELIVERY_BLOCK_TESTID)).toBeNull();
    expect(screen.queryByTestId(ORDER_DELIVERY_ADD_CUSTOMER_TESTID)).toBeNull();
    expect(screen.queryByTestId(DIRECT_DELIVERY_NOTE_TESTID)).toBeNull();
    expect(entregar()).toBeDisabled();
  });
});

describe('validacion al pulsar «Entregar»', () => {
  it('R19: un bloque sin cliente muestra «Elige el cliente.» bajo su campo y no envia', async () => {
    const user = setupUser();
    montar();

    await user.type(await campo(0, DIRECT_OLDER_BATCH_ID), '2');
    expect(screen.queryByTestId(ORDER_DELIVERY_BLOCK_ERROR_TESTID)).toBeNull();
    await user.click(entregar());

    const error = await within(await bloque(0)).findByTestId(ORDER_DELIVERY_BLOCK_ERROR_TESTID);
    expect(error).toHaveTextContent(TEXTO.sinCliente);
    expect(cliente(await bloque(0))).toHaveAttribute('aria-describedby', error.id);
    expect(deliverDirectMock).not.toHaveBeenCalled();
  });

  it('R19: un cliente repetido marca el bloque posterior y no envia', async () => {
    const user = setupUser();
    guardarBorrador([
      { customer: ANA, packages: { [DIRECT_OLDER_BATCH_ID]: '1' } },
      { customer: BRUNO, packages: { [DIRECT_NEWER_BATCH_ID]: '1' } },
      { customer: ANA, packages: { [DIRECT_NEWER_BATCH_ID]: '1' } },
    ]);
    montar();

    await bloques();
    await user.click(entregar());

    expect(await within(await bloque(2)).findByTestId(ORDER_DELIVERY_BLOCK_ERROR_TESTID)).toHaveTextContent(TEXTO.repetido);
    expect(within(await bloque(0)).queryByTestId(ORDER_DELIVERY_BLOCK_ERROR_TESTID)).toBeNull();
    expect(within(await bloque(1)).queryByTestId(ORDER_DELIVERY_BLOCK_ERROR_TESTID)).toBeNull();
    expect(deliverDirectMock).not.toHaveBeenCalled();
  });

  it('R19: un bloque sin envases dice «Este cliente no lleva envases: indica al menos uno.»; uno por bloque y en orden', async () => {
    const user = setupUser();
    guardarBorrador([
      { customer: ANA, packages: { [DIRECT_OLDER_BATCH_ID]: '0' } },
      { customer: null, packages: {} },
    ]);
    montar();

    await bloques();
    await user.click(entregar());

    expect(await within(await bloque(0)).findByTestId(ORDER_DELIVERY_BLOCK_ERROR_TESTID)).toHaveTextContent(TEXTO.sinEnvases);
    const errores = within(await bloque(1)).getAllByTestId(ORDER_DELIVERY_BLOCK_ERROR_TESTID);
    expect(errores).toHaveLength(1);
    expect(errores[0]).toHaveTextContent(TEXTO.sinCliente);
    expect(deliverDirectMock).not.toHaveBeenCalled();
  });

  it('R20: una nota de mas de 500 caracteres sin los espacios de los extremos avisa y no envia', async () => {
    const user = setupUser();
    guardarBorrador([{ customer: ANA, packages: { [DIRECT_OLDER_BATCH_ID]: '2' } }], 'x'.repeat(501));
    montar();

    const error = await screen.findByTestId(DIRECT_DELIVERY_NOTE_ERROR_TESTID);
    expect(error).toHaveTextContent(TEXTO.notaLarga);
    expect(nota()).toHaveAttribute('aria-invalid', 'true');
    await user.click(entregar());
    expect(deliverDirectMock).not.toHaveBeenCalled();
  });

  it('R20: 500 caracteres con espacios en los extremos no pasan del tope y se envian recortados', async () => {
    const user = setupUser();
    const texto = 'y'.repeat(500);
    guardarBorrador([{ customer: ANA, packages: { [DIRECT_OLDER_BATCH_ID]: '2' } }], `  ${texto}  `);
    montar();

    await bloques();
    expect(screen.queryByTestId(DIRECT_DELIVERY_NOTE_ERROR_TESTID)).toBeNull();
    await user.click(entregar());

    await waitFor(() => expect(deliverDirectMock).toHaveBeenCalledTimes(1));
    expect(deliverDirectMock.mock.calls[0]?.[0]).toMatchObject({ note: texto });
  });
});

describe('envio', () => {
  it('R22: envia una sola entrega con la clave del borrador, el producto, cada bloque con sus envases > 0 por lote y la nota recortada', async () => {
    const user = setupUser();
    montar();

    await elegirCliente(user, await bloque(0), 'Ana Perez');
    await user.type(await campo(0, DIRECT_OLDER_BATCH_ID), '4');
    await user.type(await campo(0, DIRECT_NEWER_BATCH_ID), '0');
    await user.click(screen.getByTestId(ORDER_DELIVERY_ADD_CUSTOMER_TESTID));
    await elegirCliente(user, await bloque(1), 'Bruno Diaz');
    await user.type(await campo(1, DIRECT_OLDER_BATCH_ID), '1');
    await user.type(await campo(1, DIRECT_NEWER_BATCH_ID), '1');
    await user.type(nota(), '  Venta mostrador, factura 0012  ');
    await user.click(entregar());

    await waitFor(() => expect(deliverDirectMock).toHaveBeenCalledTimes(1));
    expect(deliverDirectMock).toHaveBeenCalledWith(deliverDirectInput());
  });

  it('R22: sin nota, o con una nota solo de espacios, envia la nota en null', async () => {
    const user = setupUser();
    guardarBorradorDelFixture('   ');
    montar();

    await bloques();
    await user.click(entregar());

    await waitFor(() => expect(deliverDirectMock).toHaveBeenCalledTimes(1));
    expect(deliverDirectMock).toHaveBeenCalledWith(deliverDirectInput({ note: null }));
  });
});

describe('despues de enviar', () => {
  it.each([
    ['delivered', DIRECT_DELIVERY_RESULTS.delivered],
    ['already_registered', DIRECT_DELIVERY_RESULTS.alreadyRegistered],
  ] as const)('R24: tras %s borra el borrador, cierra, avisa y refresca', async (_caso, data) => {
    const user = setupUser();
    const exito = vi.spyOn(toast, 'success');
    deliverDirectMock.mockResolvedValue({ status: 'success', data });
    guardarBorradorDelFixture();
    montar();

    await bloques();
    expect(borradorGuardado()).not.toBeNull();
    await user.click(entregar());

    await waitFor(() => expect(cerrar).toHaveBeenCalledWith(false));
    expect(borradorGuardado()).toBeNull();
    expect(exito).toHaveBeenCalledWith('Entrega sin pedido registrada');
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['delivery_exceeds_surplus', DIRECT_DELIVERY_ERROR_STATES.exceedsSurplus],
    ['delivery_batch_insufficient', DIRECT_DELIVERY_ERROR_STATES.batchInsufficient],
  ] as const)('R25: tras %s sigue abierto, muestra el mensaje, relee y conserva el borrador', async (code, error) => {
    const user = setupUser();
    deliverDirectMock.mockResolvedValue(error);
    guardarBorradorDelFixture();
    montar();

    await bloques();
    await user.click(entregar());

    const aviso = await screen.findByTestId(DIRECT_DELIVERY_REJECTED_TESTID);
    expect(aviso).toHaveAttribute('data-code', code);
    expect(aviso).toHaveTextContent(error.message);
    await waitFor(() => expect(getDirectMock).toHaveBeenCalledTimes(2));
    expect(cerrar).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
    expect(await campo(0, DIRECT_OLDER_BATCH_ID)).toHaveValue('4');
    expect(borradorGuardado()).toMatchObject({
      v: 1,
      deliveryKey: DIRECT_DELIVERY_KEY,
      note: 'Venta mostrador, factura 0012',
      blocks: [{ customer: ANA }, { customer: BRUNO }],
    });
  });

  it('R25: si al releer un lote ya no se ofrece, quita sus envases, avisa y conserva el resto', async () => {
    const user = setupUser();
    deliverDirectMock.mockResolvedValue(DIRECT_DELIVERY_ERROR_STATES.batchInsufficient);
    guardarBorradorDelFixture();
    montar();

    await bloques();
    expect(screen.queryByTestId(DIRECT_DELIVERY_DRAFT_ADJUSTED_TESTID)).toBeNull();
    const base = directDeliveryView();
    getDirectMock.mockResolvedValue(
      ok({ ...base, batches: base.batches.flatMap((batch) => (batch.batchId === DIRECT_NEWER_BATCH_ID ? [] : [batch])) }),
    );
    await user.click(entregar());

    expect(await screen.findByTestId(DIRECT_DELIVERY_DRAFT_ADJUSTED_TESTID)).toHaveTextContent(TEXTO.ajustado);
    expect(within(await bloque(1)).getAllByTestId(ORDER_DELIVERY_BATCH_TESTID)).toHaveLength(1);
    expect(await campo(1, DIRECT_OLDER_BATCH_ID)).toHaveValue('1');
    expect(borradorGuardado()).toMatchObject({
      blocks: [{ packages: { [DIRECT_OLDER_BATCH_ID]: '4' } }, { packages: { [DIRECT_OLDER_BATCH_ID]: '1' } }],
    });
  });

  it('R25: si al releer el excedente es cero, muestra el estado sin excedente', async () => {
    const user = setupUser();
    deliverDirectMock.mockResolvedValue(DIRECT_DELIVERY_ERROR_STATES.exceedsSurplus);
    guardarBorradorDelFixture();
    montar();

    await bloques();
    getDirectMock.mockResolvedValue(ok(directDeliveryView({ waitingPackages: 20, surplusPackages: 0 })));
    await user.click(entregar());

    expect(await screen.findByTestId(DIRECT_DELIVERY_NO_SURPLUS_TESTID)).toBeInTheDocument();
    expect(screen.getByTestId(DIRECT_DELIVERY_REJECTED_TESTID)).toHaveAttribute('data-code', 'delivery_exceeds_surplus');
    expect(entregar()).toBeDisabled();
    expect(borradorGuardado()).not.toBeNull();
  });

  it.each([
    ['customer_not_found', DIRECT_DELIVERY_ERROR_STATES.customerNotFound],
    ['product_not_found', DIRECT_DELIVERY_ERROR_STATES.productNotFound],
    ['invalid_input', DIRECT_DELIVERY_ERROR_STATES.invalidInput],
  ] as const)('R26: tras %s muestra el mensaje y sigue abierto con los bloques y la nota', async (code, error) => {
    const user = setupUser();
    deliverDirectMock.mockResolvedValue(error);
    guardarBorradorDelFixture();
    montar();

    await bloques();
    await user.click(entregar());

    const aviso = await screen.findByTestId(DIRECT_DELIVERY_ERROR_TESTID);
    expect(aviso).toHaveAttribute('data-code', code);
    expect(aviso).toHaveTextContent(error.message);
    expect(getDirectMock).toHaveBeenCalledTimes(1);
    expect(cerrar).not.toHaveBeenCalled();
    expect(await bloques()).toHaveLength(2);
    expect(nota()).toHaveValue('Venta mostrador, factura 0012');
    expect(borradorGuardado()).not.toBeNull();
  });

  it('R26: si la action rechaza la promesa, muestra el error inesperado y sigue abierto', async () => {
    const user = setupUser();
    deliverDirectMock.mockRejectedValue(new Error('red caida'));
    guardarBorradorDelFixture();
    montar();

    await bloques();
    await user.click(entregar());

    expect(await screen.findByTestId(DIRECT_DELIVERY_ERROR_TESTID)).toHaveAttribute('data-code', 'unexpected');
    expect(cerrar).not.toHaveBeenCalled();
  });
});

describe('borrador', () => {
  it('R27: cada cambio de bloques, clientes, envases y nota se guarda al momento con la clave de entrega', async () => {
    const user = setupUser();
    montar();

    await user.type(await campo(0, DIRECT_OLDER_BATCH_ID), '2');
    expect(borradorGuardado()).toMatchObject({
      v: 1,
      productId: DIRECT_PRODUCT_ID,
      deliveryKey: DIRECT_DELIVERY_KEY,
      blocks: [{ key: '1', customer: null, packages: { [DIRECT_OLDER_BATCH_ID]: '2' } }],
    });
    await elegirCliente(user, await bloque(0), 'Ana Perez');
    expect(borradorGuardado()).toMatchObject({ blocks: [{ customer: ANA }] });
    await user.type(nota(), 'Hola');
    expect(borradorGuardado()).toMatchObject({ note: 'Hola' });
    await user.click(screen.getByTestId(ORDER_DELIVERY_ADD_CUSTOMER_TESTID));
    expect(borradorGuardado()).toMatchObject({ blocks: [{ key: '1' }, { key: '2', customer: null, packages: {} }] });
    await user.click(within(await bloque(0)).getByTestId(ORDER_DELIVERY_BLOCK_REMOVE_TESTID));
    expect(borradorGuardado()).toMatchObject({ blocks: [{ key: '2', customer: null }] });
  });

  it.each([
    ['la X', async (user: ReturnType<typeof setupUser>) => user.click(screen.getByRole('button', { name: 'Close' }))],
    ['Escape', async (user: ReturnType<typeof setupUser>) => user.keyboard('{Escape}')],
  ] as const)('R27: cerrar con %s conserva el borrador y al reabrir lo restaura en orden con su nota y su clave', async (_via, closeWith) => {
    const user = setupUser();
    render(<ConReapertura />);

    await elegirCliente(user, await bloque(0), 'Ana Perez');
    await user.type(await campo(0, DIRECT_OLDER_BATCH_ID), '4');
    await user.click(screen.getByTestId(ORDER_DELIVERY_ADD_CUSTOMER_TESTID));
    await elegirCliente(user, await bloque(1), 'Bruno Diaz');
    await user.type(await campo(1, DIRECT_OLDER_BATCH_ID), '1');
    await user.type(await campo(1, DIRECT_NEWER_BATCH_ID), '1');
    await user.type(nota(), 'Venta mostrador, factura 0012');
    await closeWith(user);
    await waitFor(() => expect(screen.queryByTestId(DIRECT_DELIVERY_SHEET_TESTID)).toBeNull());
    expect(borradorGuardado()).toMatchObject({ v: 1, deliveryKey: DIRECT_DELIVERY_KEY });

    vi.mocked(crypto.randomUUID).mockReturnValue('b0000000-0000-4000-8000-0000000000ff');
    await user.click(screen.getByTestId('reabrir'));

    expect(await bloques()).toHaveLength(2);
    expect(cliente(await bloque(0))).toHaveValue('Ana Perez');
    expect(cliente(await bloque(1))).toHaveValue('Bruno Diaz');
    expect(await campo(0, DIRECT_OLDER_BATCH_ID)).toHaveValue('4');
    expect(await campo(1, DIRECT_OLDER_BATCH_ID)).toHaveValue('1');
    expect(await campo(1, DIRECT_NEWER_BATCH_ID)).toHaveValue('1');
    expect(nota()).toHaveValue('Venta mostrador, factura 0012');
    await user.click(entregar());
    await waitFor(() => expect(deliverDirectMock).toHaveBeenCalledTimes(1));
    expect(deliverDirectMock).toHaveBeenCalledWith(deliverDirectInput());
  });

  it('R27: «Cancelar» borra el borrador y cierra', async () => {
    const user = setupUser();
    montar();

    await user.type(await campo(0, DIRECT_OLDER_BATCH_ID), '2');
    expect(borradorGuardado()).not.toBeNull();
    await user.click(screen.getByTestId(DIRECT_DELIVERY_CANCEL_TESTID));

    expect(borradorGuardado()).toBeNull();
    expect(cerrar).toHaveBeenCalledWith(false);
    expect(deliverDirectMock).not.toHaveBeenCalled();
  });

  it('R28: al restaurar descarta de todos los bloques los lotes que ya no se ofrecen y avisa', async () => {
    guardarBorrador([
      { customer: ANA, packages: { [DIRECT_OLDER_BATCH_ID]: '2', [GONE_BATCH_ID]: '3' } },
      { customer: BRUNO, packages: { [GONE_BATCH_ID]: '1' } },
    ]);
    montar();

    expect(await screen.findByTestId(DIRECT_DELIVERY_DRAFT_ADJUSTED_TESTID)).toHaveTextContent(TEXTO.ajustado);
    expect(await campo(0, DIRECT_OLDER_BATCH_ID)).toHaveValue('2');
    expect(borradorGuardado()).toMatchObject({
      blocks: [{ packages: { [DIRECT_OLDER_BATCH_ID]: '2' } }, { packages: {} }],
    });
  });

  it('R28: si todos los lotes del borrador se siguen ofreciendo no avisa', async () => {
    guardarBorradorDelFixture();
    montar();

    await bloques();
    expect(screen.queryByTestId(DIRECT_DELIVERY_DRAFT_ADJUSTED_TESTID)).toBeNull();
  });
});
