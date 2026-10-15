import { describe, expect, it, vi } from 'vitest';

import { ROLE_ADMINISTRADOR, SEED_ROLE_PERMISSIONS } from '@/lib/modules/identity';
import { createListFinishedProductDeliveries } from '@/lib/modules/inventario/domain/list-finished-product-deliveries';
import { ProductNotFoundError, UnauthorizedError, ValidationError } from '@/lib/modules/inventario/domain/errors';
import {
  EMPTY_BATCH_ID,
  FINISHED_CUSTOMER_ID,
  FINISHED_DELIVERY_ID,
  FINISHED_ORDER_ID,
  FINISHED_ORDER_NUMBER,
  FINISHED_PRODUCT_ID,
  FINISHED_VOID_REASON,
  GALLON_BATCH_ID,
  LITER_BATCH_ID,
  UNPACKAGED_BATCH_ID,
  VOIDED_DELIVERY_ROW,
  finishedProductDeliveriesPage,
  finishedProductDeliveryRow,
  finishedProductPage,
} from '@/tests/fixtures/finished-product-detail';

import type { CustomerCatalog, CustomerRef } from '@/lib/modules/clientes';
import type { Actor } from '@/lib/modules/inventario/domain/actor';
import type { DeliveredTotal, FinishedDeliveryDirectory } from '@/lib/modules/inventario/domain/finished-product-detail';
import type { OrderNumberDirectory } from '@/lib/modules/inventario/domain/reservation';
import type {
  FinishedProductDeliveryMovementRecord,
  FinishedProductDetailRepository,
  FinishedProductRecord,
} from '@/lib/modules/inventario/ports/finished-product-detail-repository';
import type { Page } from '@/lib/modules/inventario/domain/page';

const EMPRESA = 'company-a';
const LECTOR: Actor = { id: 'u-lector', companyId: EMPRESA, permissions: ['inventario.consultar'] };
const OTRA_ENTREGA = '10000000-0000-4000-8000-000000000226';
const OTRO_CLIENTE = 'b0000000-0000-4000-8000-000000000226';
const TODOS_LOS_LOTES = [LITER_BATCH_ID, GALLON_BATCH_ID, UNPACKAGED_BATCH_ID, EMPTY_BATCH_ID];

const REGISTRO: FinishedProductRecord = {
  id: FINISHED_PRODUCT_ID,
  name: 'Limpiador multiusos',
  imagePath: null,
  qtyAlert: null,
  unitId: null,
  recipeId: null,
  presentation: null,
  batches: [
    { id: LITER_BATCH_ID, stock: '10.5000', packageContent: '1.0000' },
    { id: GALLON_BATCH_ID, stock: '9.0000', packageContent: '4.0000' },
    { id: UNPACKAGED_BATCH_ID, stock: '2.2500', packageContent: null },
    { id: EMPTY_BATCH_ID, stock: '0.0000', packageContent: '1.0000' },
  ],
};

const ANA: CustomerRef = { id: FINISHED_CUSTOMER_ID, firstNames: 'Ana', lastNames: 'Perez', isDeleted: false };
const ENTREGADO: DeliveredTotal = { quantity: '4.0000', packages: 4 };

function asiento(overrides: Partial<FinishedProductDeliveryMovementRecord> = {}): FinishedProductDeliveryMovementRecord {
  return {
    id: '20000000-0000-4000-8000-000000000230',
    orderDeliveryId: FINISHED_DELIVERY_ID,
    orderId: FINISHED_ORDER_ID,
    batchId: LITER_BATCH_ID,
    lot: 'L-2026-0225',
    quantity: '-4.0000',
    createdAt: '2026-10-11T10:00:00.000Z',
    ...overrides,
  };
}

const ASIENTO_ANULADO = asiento({ id: VOIDED_DELIVERY_ROW.movementId, batchId: GALLON_BATCH_ID, lot: 'L-2026-0226' });

type Detalles = Awaited<ReturnType<FinishedDeliveryDirectory['findDeliveryDetails']>>;

function detallesDe(customerId = FINISHED_CUSTOMER_ID): Detalles {
  return new Map([
    [
      FINISHED_DELIVERY_ID,
      {
        customerId,
        linesByBatch: new Map([
          [LITER_BATCH_ID, { packages: 4, void: null }],
          [GALLON_BATCH_ID, { packages: 1, void: { reason: FINISHED_VOID_REASON } }],
        ]),
      },
    ],
  ]);
}

type Montaje = {
  readonly items?: readonly FinishedProductDeliveryMovementRecord[];
  readonly pagina?: Partial<Page<FinishedProductDeliveryMovementRecord>>;
  readonly record?: FinishedProductRecord | null;
  readonly detalles?: Detalles;
  readonly clientes?: readonly CustomerRef[];
};

function montar({
  items = [asiento(), ASIENTO_ANULADO],
  pagina = {},
  record = REGISTRO,
  detalles = detallesDe(),
  clientes = [ANA],
}: Montaje = {}) {
  const products: FinishedProductDetailRepository = {
    findAliveFinished: vi.fn<FinishedProductDetailRepository['findAliveFinished']>(async () => record),
    listBatches: vi.fn<FinishedProductDetailRepository['listBatches']>(),
    listMovements: vi.fn<FinishedProductDetailRepository['listMovements']>(),
    listDeliveryMovements: vi.fn<FinishedProductDetailRepository['listDeliveryMovements']>(async () =>
      finishedProductPage(items, pagina),
    ),
    listProductionCosts: vi.fn<FinishedProductDetailRepository['listProductionCosts']>(),
    findProducedProducts: vi.fn<FinishedProductDetailRepository['findProducedProducts']>(),
  };
  const orders: OrderNumberDirectory = {
    findNumberTexts: vi.fn<OrderNumberDirectory['findNumberTexts']>(async () => new Map([[FINISHED_ORDER_ID, FINISHED_ORDER_NUMBER]])),
  };
  const deliveries: FinishedDeliveryDirectory = {
    findDeliveryDetails: vi.fn<FinishedDeliveryDirectory['findDeliveryDetails']>(async () => detalles),
    summarizeDelivered: vi.fn<FinishedDeliveryDirectory['summarizeDelivered']>(async () => ENTREGADO),
  };
  const customers: Pick<CustomerCatalog, 'findRefsIncludingDeleted'> = {
    findRefsIncludingDeleted: vi.fn<CustomerCatalog['findRefsIncludingDeleted']>(async () => clientes),
  };
  return {
    products,
    orders,
    deliveries,
    customers,
    listar: createListFinishedProductDeliveries({ products, orders, deliveries, customers }),
  };
}

function directorios(m: ReturnType<typeof montar>) {
  return [
    m.orders.findNumberTexts,
    m.deliveries.findDeliveryDetails,
    m.deliveries.summarizeDelivered,
    m.customers.findRefsIncludingDeleted,
  ];
}

function ningunPuerto(m: ReturnType<typeof montar>): void {
  for (const fn of [...Object.values(m.products), ...directorios(m)]) {
    expect(fn).not.toHaveBeenCalled();
  }
}

describe('listFinishedProductDeliveries', () => {
  it('R2: sin inventario.consultar responde unauthorized antes de validar y no llama a ningun puerto', async () => {
    const m = montar();
    const sinPermiso: Actor = { id: 'u-sin', companyId: EMPRESA, permissions: ['pedidos.consultar', 'clientes.consultar'] };

    await expect(m.listar(FINISHED_PRODUCT_ID, {}, sinPermiso)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(m.listar('no-es-uuid', { page: 0 }, sinPermiso)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(m.listar(FINISHED_PRODUCT_ID, {}, null)).rejects.toBeInstanceOf(UnauthorizedError);
    ningunPuerto(m);
  });

  it('R3: un actor de otro rol con el permiso es aceptado', async () => {
    const m = montar();
    const deOtroRol: Actor = {
      id: 'u-auditor',
      companyId: EMPRESA,
      permissions: ['documentos.consultar', 'inventario.consultar'],
    };

    await expect(m.listar(FINISHED_PRODUCT_ID, {}, deOtroRol)).resolves.toEqual(finishedProductDeliveriesPage());
  });

  it('R3: un Administrador sin inventario.consultar en su conjunto es rechazado', async () => {
    const m = montar();
    const adminSinPermiso: Actor = {
      id: 'u-admin',
      companyId: EMPRESA,
      permissions: [...SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]].filter((p) => p !== 'inventario.consultar'),
    };

    await expect(m.listar(FINISHED_PRODUCT_ID, {}, adminSinPermiso)).rejects.toBeInstanceOf(UnauthorizedError);
    ningunPuerto(m);
  });

  it('R4: con solo inventario.consultar, sin pedidos ni clientes, ve el cliente y el pedido de cada entrega', async () => {
    const m = montar();

    const pagina = await m.listar(FINISHED_PRODUCT_ID, {}, LECTOR);

    expect(pagina.items[0]).toMatchObject({ customer: ANA, orderNumberText: FINISHED_ORDER_NUMBER });
  });

  it('R5: un id sin uuid o un producto que no vuelve responde product_not_found y no lista', async () => {
    const malformado = montar();
    await expect(malformado.listar('no-es-uuid', {}, LECTOR)).rejects.toBeInstanceOf(ProductNotFoundError);
    ningunPuerto(malformado);

    const ausente = montar({ record: null });
    await expect(ausente.listar(FINISHED_PRODUCT_ID, {}, LECTOR)).rejects.toBeInstanceOf(ProductNotFoundError);
    expect(ausente.products.listDeliveryMovements).not.toHaveBeenCalled();
    for (const fn of directorios(ausente)) expect(fn).not.toHaveBeenCalled();
  });

  it('R19: cada lote de cada entrega sale con fecha, cliente, pedido, lote, envases y cantidad en valor absoluto', async () => {
    const m = montar();

    const pagina = await m.listar(FINISHED_PRODUCT_ID, { page: 1, pageSize: 10 }, LECTOR);

    expect(m.products.listDeliveryMovements).toHaveBeenCalledWith(FINISHED_PRODUCT_ID, { page: 1, pageSize: 10 }, { companyId: EMPRESA });
    expect(pagina).toEqual(finishedProductDeliveriesPage());
    expect(m.deliveries.findDeliveryDetails).toHaveBeenCalledTimes(1);
    expect(m.deliveries.findDeliveryDetails).toHaveBeenCalledWith(EMPRESA, [FINISHED_DELIVERY_ID]);
    expect(m.orders.findNumberTexts).toHaveBeenCalledTimes(1);
    expect(m.orders.findNumberTexts).toHaveBeenCalledWith(EMPRESA, [FINISHED_ORDER_ID]);
    expect(m.customers.findRefsIncludingDeleted).toHaveBeenCalledTimes(1);
    expect(m.customers.findRefsIncludingDeleted).toHaveBeenCalledWith([FINISHED_CUSTOMER_ID], EMPRESA);
  });

  it('R20: un cliente dado de baja sale con su marca y la fila no se oculta', async () => {
    const deBaja: CustomerRef = { ...ANA, isDeleted: true };
    const m = montar({ clientes: [deBaja] });

    const pagina = await m.listar(FINISHED_PRODUCT_ID, {}, LECTOR);

    expect(pagina.items).toHaveLength(2);
    expect(pagina.items.map((item) => item.customer)).toEqual([deBaja, deBaja]);
  });

  it('R20: un cliente que no vuelve sale como null y la fila sigue', async () => {
    const m = montar({ detalles: detallesDe(OTRO_CLIENTE), clientes: [] });

    const pagina = await m.listar(FINISHED_PRODUCT_ID, {}, LECTOR);

    expect(pagina.items).toHaveLength(2);
    expect(pagina.items[0]).toMatchObject({ customer: null, packages: 4, orderNumberText: FINISHED_ORDER_NUMBER });
  });

  it('R20: una entrega que no vuelve del directorio deja cliente y envases en null, y la fila sigue', async () => {
    const m = montar({ items: [asiento({ orderDeliveryId: OTRA_ENTREGA })] });

    const pagina = await m.listar(FINISHED_PRODUCT_ID, {}, LECTOR);

    expect(pagina.items).toEqual([
      finishedProductDeliveryRow({ orderDeliveryId: OTRA_ENTREGA, customer: null, packages: null, void: null }),
    ]);
  });

  it('R23: una pagina o un tamano invalidos, o un campo de mas, responden invalid_input', async () => {
    for (const entrada of [{ page: 0 }, { pageSize: 0 }, { page: 2.5 }, { page: 1, direction: 'out' }, 'pagina']) {
      const m = montar();
      await expect(m.listar(FINISHED_PRODUCT_ID, entrada, LECTOR)).rejects.toBeInstanceOf(ValidationError);
      expect(m.products.listDeliveryMovements).not.toHaveBeenCalled();
    }
  });

  it('R33: el void de linesByBatch llega a su fila y la fila anulada no se filtra ni cambia de sitio', async () => {
    const m = montar({ items: [ASIENTO_ANULADO, asiento()] });

    const pagina = await m.listar(FINISHED_PRODUCT_ID, {}, LECTOR);

    expect(pagina.items).toEqual([VOIDED_DELIVERY_ROW, finishedProductDeliveryRow()]);
    expect(pagina.items[0]?.void).toEqual({ reason: FINISHED_VOID_REASON });
    expect(pagina.items[1]?.void).toBeNull();
  });

  it('R33: una linea que no vuelve en linesByBatch deja void y envases en null', async () => {
    const m = montar({ items: [asiento({ batchId: UNPACKAGED_BATCH_ID, lot: 'L-2026-0227' })] });

    const pagina = await m.listar(FINISHED_PRODUCT_ID, {}, LECTOR);

    expect(pagina.items).toHaveLength(1);
    expect(pagina.items[0]).toMatchObject({ batchId: UNPACKAGED_BATCH_ID, customer: ANA, packages: null, void: null });
  });

  it('R34: summarizeDelivered se llama una vez con todos los lotes del producto, tambien en la pagina 2', async () => {
    const m = montar({ items: [asiento()], pagina: { page: 2, total: 11, totalPages: 2 } });

    const pagina = await m.listar(FINISHED_PRODUCT_ID, { page: 2 }, LECTOR);

    expect(m.deliveries.summarizeDelivered).toHaveBeenCalledTimes(1);
    expect(m.deliveries.summarizeDelivered).toHaveBeenCalledWith(EMPRESA, TODOS_LOS_LOTES);
    expect(pagina.delivered).toBe(ENTREGADO);
    expect(pagina).toMatchObject({ page: 2, total: 11, totalPages: 2 });
  });

  it('R34: sin filas no se llama a summarizeDelivered ni a los directorios, y el total vale cero', async () => {
    const m = montar({ items: [] });

    const pagina = await m.listar(FINISHED_PRODUCT_ID, {}, LECTOR);

    expect(pagina.items).toEqual([]);
    expect(pagina.delivered).toEqual({ quantity: '0.0000', packages: 0 });
    for (const fn of directorios(m)) expect(fn).not.toHaveBeenCalled();
  });

  it('R36: un actor con solo inventario.consultar recibe la anulacion y el total entregado', async () => {
    const m = montar();

    const pagina = await m.listar(FINISHED_PRODUCT_ID, {}, LECTOR);

    expect(LECTOR.permissions).toEqual(['inventario.consultar']);
    expect(pagina.items.map((item) => item.void)).toEqual([null, { reason: FINISHED_VOID_REASON }]);
    expect(pagina.delivered).toEqual(ENTREGADO);
  });
});
