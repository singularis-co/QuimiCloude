// La seccion del listado de producto terminado: con el permiso de entregas, lee el excedente de los
// productos de la pagina en una sola llamada y se lo pasa a la tabla. Sin permiso o con error, el
// mapa queda vacio y ninguna fila ofrece «Entregar».

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FinishedStockListSection } from '@/app/(private)/inventario/components/finished-stock-list-section';
import type { DataTableParams } from '@/components/shared/data-table';
import type { SessionUser } from '@/lib/modules/identity';
import { PRODUCT_TYPES, type FinishedStockRow, type ProductView } from '@/lib/modules/inventario';
import type { FinishedStockListResult } from '@/lib/modules/inventario/adapters/driving/product-actions';
import type { DirectDeliverySurplusResult } from '@/lib/modules/pedidos/adapters/driving/order-actions';

import { DIRECT_DELIVERY_ERROR_STATES } from '../../fixtures/direct-delivery';

const { getSessionUserMock, listFinishedStockMock, listSurplusMock, tableMock } = vi.hoisted(() => ({
  getSessionUserMock: vi.fn<() => Promise<SessionUser | null>>(),
  listFinishedStockMock: vi.fn<(query: unknown) => Promise<FinishedStockListResult>>(),
  listSurplusMock: vi.fn<(productIds: readonly string[]) => Promise<DirectDeliverySurplusResult>>(),
  tableMock: vi.fn<(props: Record<string, unknown>) => null>(() => null),
}));

vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: getSessionUserMock },
}));

vi.mock('@/lib/modules/inventario/adapters/driving/product-actions', () => ({
  listFinishedStockAction: listFinishedStockMock,
}));

vi.mock('@/lib/modules/pedidos/adapters/driving/order-actions', () => ({
  listDirectDeliverySurplusAction: listSurplusMock,
}));

vi.mock('@/app/(private)/inventario/components/finished-stock-table', () => ({
  FinishedStockTable: tableMock,
}));

const PARAMS: DataTableParams = { page: 1, pageSize: 10, sort: null, filters: {}, search: '' };

function usuario(permissions: readonly string[]): SessionUser {
  return { id: 'u-1', username: 'ana', displayName: 'Ana', roleName: 'Ventas', permissions };
}

function producto(id: string): ProductView {
  return {
    id,
    name: `Producto ${id}`,
    imagePath: null,
    stock: '1',
    unitId: 'unit-l',
    qtyAlert: null,
    type: PRODUCT_TYPES.FINISHED_PRODUCT,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

function pedido(key: string, productIds: readonly string[]): FinishedStockRow {
  return {
    kind: 'order',
    key,
    orderId: key,
    orderNumber: { year: 2026, sequence: 1 },
    numberText: '2026-0001',
    recipeName: 'Receta',
    packagedStock: null,
    products: productIds.map((id) => ({ product: producto(id), stock: '1', packagedStock: null })),
  };
}

function sinPedido(productId: string): FinishedStockRow {
  return {
    kind: 'withoutOrder',
    key: `without-${productId}`,
    productId,
    stock: '1',
    unitId: 'unit-l',
    products: [{ product: producto(productId), stock: '1', packagedStock: null }],
  };
}

function pagina(items: readonly FinishedStockRow[]): FinishedStockListResult {
  return { status: 'success', data: { items, total: items.length, page: 1, pageSize: 10, totalPages: 1 } };
}

async function montar() {
  render(await FinishedStockListSection({ params: PARAMS }));
}

function propsDeLaTabla(): Record<string, unknown> {
  const llamada = tableMock.mock.calls.at(-1);
  if (llamada === undefined) throw new Error('la tabla no se pinto');
  return llamada[0];
}

const ENTREGAS = ['inventario.consultar', 'entregas.modificar'];

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUserMock.mockResolvedValue(usuario(ENTREGAS));
  listSurplusMock.mockResolvedValue({ status: 'success', data: {} });
});

afterEach(() => cleanup());

describe('excedente del listado', () => {
  it('R8: pide el excedente de los productos distintos de la pagina en una sola llamada y lo pasa a la tabla', async () => {
    listFinishedStockMock.mockResolvedValue(
      pagina([pedido('o-1', ['p-1', 'p-2']), pedido('o-2', ['p-1']), sinPedido('p-3')]),
    );
    listSurplusMock.mockResolvedValue({ status: 'success', data: { 'p-1': 4, 'p-2': 0, 'p-3': 2 } });

    await montar();

    expect(listSurplusMock).toHaveBeenCalledTimes(1);
    expect(listSurplusMock).toHaveBeenCalledWith(['p-1', 'p-2', 'p-3']);
    expect(propsDeLaTabla().surplusByProduct).toEqual({ 'p-1': 4, 'p-2': 0, 'p-3': 2 });
  });

  it.each([1, 25])('R8: con %i filas sigue siendo una sola lectura', async (filas) => {
    listFinishedStockMock.mockResolvedValue(
      pagina(Array.from({ length: filas }, (_, index) => pedido(`o-${index}`, [`p-${index}`, `q-${index}`]))),
    );

    await montar();

    expect(listSurplusMock).toHaveBeenCalledTimes(1);
    expect(listSurplusMock.mock.calls[0]?.[0]).toHaveLength(filas * 2);
  });

  it('R8: con mas de 200 productos distintos los pide en tandas de 200 y junta el mapa', async () => {
    const ids = Array.from({ length: 201 }, (_, index) => `p-${index}`);
    listFinishedStockMock.mockResolvedValue(pagina([pedido('o-1', ids)]));
    listSurplusMock.mockImplementation(async (productIds) => ({
      status: 'success',
      data: Object.fromEntries(productIds.map((id) => [id, 1])),
    }));

    await montar();

    expect(listSurplusMock.mock.calls.map(([productIds]) => productIds.length)).toEqual([200, 1]);
    expect(Object.keys(propsDeLaTabla().surplusByProduct as object)).toHaveLength(201);
  });

  it('R6: si la lectura del excedente falla, la tabla recibe el mapa vacio', async () => {
    listFinishedStockMock.mockResolvedValue(pagina([pedido('o-1', ['p-1'])]));
    listSurplusMock.mockResolvedValue(DIRECT_DELIVERY_ERROR_STATES.unauthorized);

    await montar();

    expect(propsDeLaTabla().surplusByProduct).toEqual({});
  });

  it('R6: si la action rechaza, la tabla recibe el mapa vacio', async () => {
    listFinishedStockMock.mockResolvedValue(pagina([pedido('o-1', ['p-1'])]));
    listSurplusMock.mockRejectedValue(new Error('red caida'));

    await montar();

    expect(propsDeLaTabla().surplusByProduct).toEqual({});
  });

  it.each([
    ['sin entregas.modificar', usuario(['inventario.consultar', 'inventario.modificar'])],
    ['sin sesion', null],
  ])('R6: %s no pide el excedente y la tabla recibe el mapa vacio', async (_caso, user) => {
    getSessionUserMock.mockResolvedValue(user);
    listFinishedStockMock.mockResolvedValue(pagina([pedido('o-1', ['p-1'])]));

    await montar();

    expect(listSurplusMock).not.toHaveBeenCalled();
    expect(propsDeLaTabla().surplusByProduct).toEqual({});
  });

  it('R6: el permiso decide, no el rol: un Administrador sin entregas.modificar no pide el excedente', async () => {
    getSessionUserMock.mockResolvedValue({ ...usuario(['inventario.consultar']), roleName: 'Administrador' });
    listFinishedStockMock.mockResolvedValue(pagina([pedido('o-1', ['p-1'])]));

    await montar();

    expect(listSurplusMock).not.toHaveBeenCalled();
  });

  it('una pagina vacia no pide el excedente', async () => {
    listFinishedStockMock.mockResolvedValue(pagina([]));

    await montar();

    expect(listSurplusMock).not.toHaveBeenCalled();
    expect(propsDeLaTabla().surplusByProduct).toEqual({});
  });
});
