// Los costos unitarios del inventario solo llegan a quien cumple `canViewUnitCosts` (hoy
// `inventario.modificar`, que entre los roles de empresa solo tiene el Administrador). Para el
// resto, el servidor no los envia: ni `ProductView.averageUnitCost` en el listado de productos ni
// `ProductBatchView.unitCost` en los lotes de un producto o de un pedido. En el listado, ademas,
// la consulta de costos ni se lanza.
//
// Dos niveles: el caso de uso con dobles del puerto, y el adaptador `listAliveProducts` contra un
// doble del cliente Prisma -para afirmar que sin costos pedidos no hay consulta de costos-.

import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaDouble = vi.hoisted(() => ({
  product: { findMany: vi.fn(), count: vi.fn() },
  productBatch: { findMany: vi.fn(), groupBy: vi.fn() },
  presentation: { findMany: vi.fn() },
}));

vi.mock('@/lib/shared/db/prisma', () => ({ prisma: prismaDouble }));

import { listAliveProducts } from '@/lib/modules/inventario/adapters/driven/persistence/product-prisma';
import { canViewUnitCosts, type Actor } from '@/lib/modules/inventario/domain/actor';
import { createListOrderBatches } from '@/lib/modules/inventario/domain/list-order-batches';
import { createListProductBatches } from '@/lib/modules/inventario/domain/list-product-batches';
import { createListProducts } from '@/lib/modules/inventario/domain/list-products';
import { SEED_ROLE_PERMISSIONS } from '@/lib/modules/identity/domain/permissions';
import {
  ROLE_ACONDICIONAMIENTO,
  ROLE_ADMINISTRADOR,
  ROLE_EMPACADOR,
  ROLE_MAESTRO,
  ROLE_OPERADOR,
} from '@/lib/modules/identity/domain/roles';

import type { ListQuery } from '@/lib/modules/inventario/domain/list-query';
import type { Page } from '@/lib/modules/inventario/domain/page';
import type { ProductBatchView } from '@/lib/modules/inventario/domain/product-batch-view';
import type { ProductView } from '@/lib/modules/inventario/domain/product-view';
import type { ListQueryLog } from '@/lib/modules/inventario/ports/list-query-log';
import type { FinishedOrderRepository } from '@/lib/modules/inventario/ports/finished-order-repository';
import type { ProductRepository } from '@/lib/modules/inventario/ports/product-repository';

const EMPRESA_A = 'company-a';
const EMPRESA_B = 'company-b';
const ORDER_ID = '7d3f0c1e-2b4a-4c5d-8e9f-0a1b2c3d4e5f';
const PRODUCT_ID = '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d';

function actorDeRol(rol: string, companyId = EMPRESA_A): Actor {
  return { id: `actor-${rol}`, companyId, permissions: [...(SEED_ROLE_PERMISSIONS[rol] ?? [])] };
}

const ADMIN = actorDeRol(ROLE_ADMINISTRADOR);
const OPERADOR = actorDeRol(ROLE_OPERADOR);

const PRODUCTO: ProductView = {
  id: PRODUCT_ID,
  name: 'Sal',
  imagePath: null,
  stock: '5.0000',
  unitId: 'unidad-kg',
  qtyAlert: null,
  type: 'PRODUCT',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
  averageUnitCost: '12.5000',
};

const LOTE: ProductBatchView = {
  id: 'lote-1',
  lot: '7',
  stock: '5.0000',
  unitId: 'unidad-l',
  purchaseDate: '2026-10-01',
  expiryDate: null,
  packageContent: null,
  unitCost: '3.2500',
};

function pagina(items: readonly ProductView[]): Page<ProductView> {
  return { items, total: items.length, page: 1, pageSize: 10, totalPages: 1 };
}

function montarListado() {
  const listAlive = vi.fn<ProductRepository['listAlive']>(async () => pagina([PRODUCTO]));
  const products = { listAlive } as unknown as ProductRepository;
  const log: ListQueryLog = { ignoredFields: vi.fn<ListQueryLog['ignoredFields']>() };
  return { listAlive, listProducts: createListProducts({ products, log }) };
}

describe('canViewUnitCosts: quien ve los costos unitarios', () => {
  it('solo el Administrador, de los roles sembrados, ve costos', () => {
    expect(canViewUnitCosts(actorDeRol(ROLE_ADMINISTRADOR))).toBe(true);
    for (const rol of [ROLE_OPERADOR, ROLE_EMPACADOR, ROLE_MAESTRO, ROLE_ACONDICIONAMIENTO]) {
      expect(canViewUnitCosts(actorDeRol(rol)), rol).toBe(false);
    }
  });

  it('falla cerrado sin actor o sin permisos, sin lanzar', () => {
    for (const actor of [null, undefined, { permissions: [] }, { permissions: 'inventario.modificar' }]) {
      expect(canViewUnitCosts(actor as Actor | null | undefined)).toBe(false);
    }
  });
});

describe('listProducts: averageUnitCost solo para quien ve costos', () => {
  it('el Administrador pide costos al puerto y recibe averageUnitCost', async () => {
    const { listAlive, listProducts } = montarListado();

    const page = await listProducts({ page: 1 }, ADMIN);

    expect(listAlive).toHaveBeenCalledWith(expect.anything(), { companyId: EMPRESA_A }, { withUnitCosts: true });
    expect(page.items[0]?.averageUnitCost).toBe('12.5000');
  });

  it('el Operador NO pide costos al puerto y la fila sale sin la clave averageUnitCost', async () => {
    const { listAlive, listProducts } = montarListado();

    const page = await listProducts({ page: 1 }, OPERADOR);

    expect(listAlive).toHaveBeenCalledWith(expect.anything(), { companyId: EMPRESA_A }, { withUnitCosts: false });
    // Aunque el puerto devolviera el costo, el caso de uso lo quita.
    expect(page.items[0]).not.toHaveProperty('averageUnitCost');
    expect(page.items[0]?.name).toBe('Sal');
  });

  it('el ambito de empresa sigue siendo la del actor, con y sin costos', async () => {
    const { listAlive, listProducts } = montarListado();

    await listProducts({ page: 1 }, actorDeRol(ROLE_ADMINISTRADOR, EMPRESA_B));
    await listProducts({ page: 1 }, actorDeRol(ROLE_OPERADOR, EMPRESA_B));

    expect(listAlive.mock.calls.map((call) => call[1])).toEqual([{ companyId: EMPRESA_B }, { companyId: EMPRESA_B }]);
  });
});

describe('listProductBatches / listOrderBatches: unitCost solo para quien ve costos', () => {
  function montarLotes() {
    const findBatchesOfAliveProduct = vi.fn<ProductRepository['findBatchesOfAliveProduct']>(async () => [LOTE]);
    const findBatchesOfOrder = vi.fn<FinishedOrderRepository['findBatchesOfOrder']>(async () => [LOTE]);
    const products = { findBatchesOfAliveProduct } as unknown as ProductRepository;
    const finishedOrders = { findBatchesOfOrder } as unknown as FinishedOrderRepository;
    return {
      findBatchesOfAliveProduct,
      findBatchesOfOrder,
      listProductBatches: createListProductBatches({ products }),
      listOrderBatches: createListOrderBatches({ finishedOrders }),
    };
  }

  it('el Administrador recibe unitCost en los lotes de un producto y de un pedido', async () => {
    const { listProductBatches, listOrderBatches } = montarLotes();

    expect((await listProductBatches(PRODUCT_ID, ADMIN))[0]?.unitCost).toBe('3.2500');
    expect((await listOrderBatches(ORDER_ID, ADMIN))[0]?.unitCost).toBe('3.2500');
  });

  it('el Operador recibe los lotes sin la clave unitCost', async () => {
    const { listProductBatches, listOrderBatches } = montarLotes();

    const delProducto = await listProductBatches(PRODUCT_ID, OPERADOR);
    const delPedido = await listOrderBatches(ORDER_ID, OPERADOR);

    expect(delProducto[0]).not.toHaveProperty('unitCost');
    expect(delPedido[0]).not.toHaveProperty('unitCost');
    expect(delProducto[0]?.lot).toBe('7');
    expect(delPedido[0]?.lot).toBe('7');
  });

  it('el ambito de empresa sigue siendo la del actor', async () => {
    const { listProductBatches, listOrderBatches, findBatchesOfAliveProduct, findBatchesOfOrder } = montarLotes();

    await listProductBatches(PRODUCT_ID, actorDeRol(ROLE_OPERADOR, EMPRESA_B));
    await listOrderBatches(ORDER_ID, actorDeRol(ROLE_ADMINISTRADOR, EMPRESA_B));

    expect(findBatchesOfAliveProduct).toHaveBeenCalledWith(PRODUCT_ID, { companyId: EMPRESA_B });
    expect(findBatchesOfOrder).toHaveBeenCalledWith(ORDER_ID, { companyId: EMPRESA_B }, null);
  });
});

describe('listAliveProducts (adaptador): sin costos pedidos no hay consulta de costos', () => {
  const QUERY: ListQuery = { page: 1, sort: null, filters: {}, search: '' };
  const SCOPE = { companyId: EMPRESA_A };

  /** Las llamadas a `productBatch.findMany` que leen costos: las que seleccionan `unitCost`. */
  function consultasDeCosto(): unknown[] {
    return prismaDouble.productBatch.findMany.mock.calls.filter(
      ([args]) => (args as { select?: { unitCost?: boolean } }).select?.unitCost === true,
    );
  }

  beforeEach(() => {
    prismaDouble.product.findMany.mockReset().mockResolvedValue([
      {
        id: PRODUCT_ID,
        name: 'Sal',
        imagePath: null,
        stock: new Prisma.Decimal('5'),
        unitId: 'unidad-kg',
        qtyAlert: null,
        type: 'PRODUCT',
        createdAt: new Date('2026-10-01T00:00:00Z'),
        updatedAt: new Date('2026-10-01T00:00:00Z'),
        presentationId: null,
      },
    ]);
    prismaDouble.product.count.mockReset().mockResolvedValue(1);
    prismaDouble.productBatch.groupBy.mockReset().mockResolvedValue([]);
    prismaDouble.presentation.findMany.mockReset().mockResolvedValue([]);
    prismaDouble.productBatch.findMany.mockReset().mockImplementation(async (args: { select?: { unitCost?: boolean } }) =>
      args.select?.unitCost === true
        ? [
            { productId: PRODUCT_ID, stock: new Prisma.Decimal('2'), unitCost: new Prisma.Decimal('10') },
            { productId: PRODUCT_ID, stock: new Prisma.Decimal('3'), unitCost: new Prisma.Decimal('20') },
          ]
        : [],
    );
  });

  it('sin opciones (cerrado por defecto) no lanza la consulta de costos ni pone la clave', async () => {
    const page = await listAliveProducts(QUERY, SCOPE);

    expect(consultasDeCosto()).toHaveLength(0);
    expect(page.items[0]).not.toHaveProperty('averageUnitCost');
  });

  it('con withUnitCosts: false tampoco', async () => {
    const page = await listAliveProducts(QUERY, SCOPE, { withUnitCosts: false });

    expect(consultasDeCosto()).toHaveLength(0);
    expect(page.items[0]).not.toHaveProperty('averageUnitCost');
  });

  it('con withUnitCosts: true lanza UNA consulta de costos, con el ambito de empresa, y pondera', async () => {
    const page = await listAliveProducts(QUERY, SCOPE, { withUnitCosts: true });

    const consultas = consultasDeCosto();
    expect(consultas).toHaveLength(1);
    expect(JSON.stringify(consultas[0])).toContain(EMPRESA_A);
    // (10 x 2 + 20 x 3) / 5 = 16
    expect(page.items[0]?.averageUnitCost).toBe('16.0000');
  });
});
