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
  FINISHED_PRESENTATION_ID,
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
import type {
  DeliveredTotal,
  FinishedDeliveryDirectory,
  FinishedDeliveryLineRecord,
} from '@/lib/modules/inventario/domain/finished-product-detail';
import type { OrderNumberDirectory } from '@/lib/modules/inventario/domain/reservation';
import type {
  FinishedProductDetailRepository,
  FinishedProductRecord,
} from '@/lib/modules/inventario/ports/finished-product-detail-repository';
import type { Page } from '@/lib/modules/inventario/domain/page';

const EMPRESA = 'company-a';
const LECTOR: Actor = { id: 'u-lector', companyId: EMPRESA, permissions: ['inventario.consultar'] };
const OTRO_CLIENTE = 'b0000000-0000-4000-8000-000000000226';
const TODOS_LOS_LOTES = [LITER_BATCH_ID, GALLON_BATCH_ID, UNPACKAGED_BATCH_ID, EMPTY_BATCH_ID];

// 2026-10-15 (QC-282): los lotes traen su codigo, del que sale el lote de cada fila, y el producto su
// presentacion, de la que sale la columna Presentacion.
const REGISTRO: FinishedProductRecord = {
  id: FINISHED_PRODUCT_ID,
  name: 'Limpiador multiusos',
  imagePath: null,
  qtyAlert: null,
  unitId: null,
  presentation: { id: FINISHED_PRESENTATION_ID, name: 'Botella 1 L', content: '1.0000', unitId: null },
  batches: [
    { id: LITER_BATCH_ID, lot: 'L-2026-0225', stock: '10.5000', packageContent: '1.0000' },
    { id: GALLON_BATCH_ID, lot: 'L-2026-0226', stock: '9.0000', packageContent: '4.0000' },
    { id: UNPACKAGED_BATCH_ID, lot: 'L-2026-0227', stock: '2.2500', packageContent: null },
    { id: EMPTY_BATCH_ID, lot: 'L-2026-0228', stock: '0.0000', packageContent: '1.0000' },
  ],
};

const ANA: CustomerRef = { id: FINISHED_CUSTOMER_ID, firstNames: 'Ana', lastNames: 'Perez', isDeleted: false };
const BRUNO: CustomerRef = { id: OTRO_CLIENTE, firstNames: 'Bruno', lastNames: 'Diaz', isDeleted: false };
const ENTREGADO: DeliveredTotal = { quantity: '4.0000', packages: 4 };

// 2026-10-15 (QC-282): la pagina del tab ya no son asientos completados con `findDeliveryDetails`,
// son las lineas de entrega de `listDeliveryLines`, con su cliente y su anulacion.
function linea(overrides: Partial<FinishedDeliveryLineRecord> = {}): FinishedDeliveryLineRecord {
  return {
    id: '30000000-0000-4000-8000-000000000230',
    orderDeliveryId: FINISHED_DELIVERY_ID,
    orderId: FINISHED_ORDER_ID,
    createdAt: '2026-10-11T10:00:00.000Z',
    customerId: FINISHED_CUSTOMER_ID,
    batchId: LITER_BATCH_ID,
    packages: 4,
    quantity: '4.0000',
    void: null,
    ...overrides,
  };
}

const LINEA_ANULADA = linea({
  id: VOIDED_DELIVERY_ROW.deliveryLineId,
  batchId: GALLON_BATCH_ID,
  packages: 1,
  quantity: '4.0000',
  void: { reason: FINISHED_VOID_REASON },
});

type Montaje = {
  readonly items?: readonly FinishedDeliveryLineRecord[];
  readonly pagina?: Partial<Page<FinishedDeliveryLineRecord>>;
  readonly record?: FinishedProductRecord | null;
  readonly clientes?: readonly CustomerRef[];
};

function montar({ items = [linea(), LINEA_ANULADA], pagina = {}, record = REGISTRO, clientes = [ANA] }: Montaje = {}) {
  const products: FinishedProductDetailRepository = {
    findAliveFinished: vi.fn<FinishedProductDetailRepository['findAliveFinished']>(async () => record),
    listBatches: vi.fn<FinishedProductDetailRepository['listBatches']>(),
    listMovements: vi.fn<FinishedProductDetailRepository['listMovements']>(),
    listProductionCosts: vi.fn<FinishedProductDetailRepository['listProductionCosts']>(),
    findProducedProducts: vi.fn<FinishedProductDetailRepository['findProducedProducts']>(),
  };
  const orders: OrderNumberDirectory = {
    findNumberTexts: vi.fn<OrderNumberDirectory['findNumberTexts']>(async () => new Map([[FINISHED_ORDER_ID, FINISHED_ORDER_NUMBER]])),
  };
  const deliveries: FinishedDeliveryDirectory = {
    listDeliveryLines: vi.fn<FinishedDeliveryDirectory['listDeliveryLines']>(async () => finishedProductPage(items, pagina)),
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
    m.deliveries.listDeliveryLines,
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
    for (const fn of directorios(ausente)) expect(fn).not.toHaveBeenCalled();
  });

  // 2026-10-15 (QC-282): la pagina la pide `listDeliveryLines` con los lotes del producto, y la fila
  // gana la presentacion (R43); el resto de la fila y de las llamadas no cambia.
  it('R19, R43: cada linea de entrega sale con fecha, cliente, pedido, presentacion, lote, envases y cantidad', async () => {
    const m = montar();

    const pagina = await m.listar(FINISHED_PRODUCT_ID, { page: 1, pageSize: 10 }, LECTOR);

    expect(m.deliveries.listDeliveryLines).toHaveBeenCalledTimes(1);
    expect(m.deliveries.listDeliveryLines).toHaveBeenCalledWith(EMPRESA, TODOS_LOS_LOTES, { page: 1, pageSize: 10 });
    expect(pagina).toEqual(finishedProductDeliveriesPage());
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
    // 2026-10-15 (QC-282): el cliente viene en la linea, no en el detalle de la entrega.
    const m = montar({ items: [linea({ customerId: OTRO_CLIENTE }), LINEA_ANULADA], clientes: [] });

    const pagina = await m.listar(FINISHED_PRODUCT_ID, {}, LECTOR);

    expect(pagina.items).toHaveLength(2);
    expect(pagina.items[0]).toMatchObject({ customer: null, packages: 4, orderNumberText: FINISHED_ORDER_NUMBER });
  });

  // 2026-10-15 (QC-282): la fila es la linea, que siempre trae su cliente y sus envases; lo que puede
  // no volver de un directorio es el numero del pedido.
  it('R20: un pedido que no vuelve deja el numero en null y la fila sigue', async () => {
    const m = montar({ items: [linea()] });
    vi.mocked(m.orders.findNumberTexts).mockResolvedValue(new Map());

    const pagina = await m.listar(FINISHED_PRODUCT_ID, {}, LECTOR);

    expect(pagina.items).toEqual([finishedProductDeliveryRow({ orderNumberText: null })]);
  });

  it('R43: con la presentacion del producto ausente, la columna sale en null y la fila sigue', async () => {
    const m = montar({ items: [linea()], record: { ...REGISTRO, presentation: null } });

    const pagina = await m.listar(FINISHED_PRODUCT_ID, {}, LECTOR);

    expect(pagina.items).toEqual([finishedProductDeliveryRow({ presentationName: null })]);
  });

  it('R43: dos clientes del mismo lote en una entrega son dos filas, cada una con su cliente y sus envases', async () => {
    const deBruno = linea({ id: '30000000-0000-4000-8000-000000000231', customerId: OTRO_CLIENTE, packages: 2, quantity: '2.0000' });
    const m = montar({ items: [linea(), deBruno], clientes: [ANA, BRUNO] });

    const pagina = await m.listar(FINISHED_PRODUCT_ID, {}, LECTOR);

    expect(pagina.items).toEqual([
      finishedProductDeliveryRow(),
      finishedProductDeliveryRow({
        deliveryLineId: deBruno.id,
        customer: BRUNO,
        packages: 2,
        quantity: '2.0000',
      }),
    ]);
    expect(m.customers.findRefsIncludingDeleted).toHaveBeenCalledTimes(1);
    expect(m.customers.findRefsIncludingDeleted).toHaveBeenCalledWith([FINISHED_CUSTOMER_ID, OTRO_CLIENTE], EMPRESA);
    expect(m.orders.findNumberTexts).toHaveBeenCalledWith(EMPRESA, [FINISHED_ORDER_ID]);
  });

  it('R23: una pagina o un tamano invalidos, o un campo de mas, responden invalid_input', async () => {
    for (const entrada of [{ page: 0 }, { pageSize: 0 }, { page: 2.5 }, { page: 1, direction: 'out' }, 'pagina']) {
      const m = montar();
      await expect(m.listar(FINISHED_PRODUCT_ID, entrada, LECTOR)).rejects.toBeInstanceOf(ValidationError);
      expect(m.deliveries.listDeliveryLines).not.toHaveBeenCalled();
    }
  });

  it('R33, R44: el void de la linea llega a su fila y la fila anulada no se filtra ni cambia de sitio', async () => {
    const m = montar({ items: [LINEA_ANULADA, linea()] });

    const pagina = await m.listar(FINISHED_PRODUCT_ID, {}, LECTOR);

    expect(pagina.items).toEqual([VOIDED_DELIVERY_ROW, finishedProductDeliveryRow()]);
    expect(pagina.items[0]?.void).toEqual({ reason: FINISHED_VOID_REASON });
    expect(pagina.items[1]?.void).toBeNull();
  });

  // 2026-10-15 (QC-282): sin detalles por lote, una linea no puede quedarse sin envases ni anulacion;
  // el caso pasa a la anulacion por par cliente-presentacion.
  it('R44: solo sale Anulada la fila de un par anulado, no la del otro cliente en el mismo lote', async () => {
    const deBrunoAnulada = linea({
      id: '30000000-0000-4000-8000-000000000231',
      customerId: OTRO_CLIENTE,
      packages: 2,
      quantity: '2.0000',
      void: { reason: FINISHED_VOID_REASON },
    });
    const m = montar({ items: [linea(), deBrunoAnulada], clientes: [ANA, BRUNO] });

    const pagina = await m.listar(FINISHED_PRODUCT_ID, {}, LECTOR);

    expect(pagina.items.map((item) => [item.customer?.id, item.lot, item.void])).toEqual([
      [FINISHED_CUSTOMER_ID, 'L-2026-0225', null],
      [OTRO_CLIENTE, 'L-2026-0225', { reason: FINISHED_VOID_REASON }],
    ]);
  });

  it('R44: la paginacion y el orden son los del directorio: la pagina y sus filas pasan tal cual', async () => {
    const m = montar({ items: [LINEA_ANULADA, linea()], pagina: { page: 3, pageSize: 2, total: 6, totalPages: 3 } });

    const pagina = await m.listar(FINISHED_PRODUCT_ID, { page: 3, pageSize: 2 }, LECTOR);

    expect(m.deliveries.listDeliveryLines).toHaveBeenCalledWith(EMPRESA, TODOS_LOS_LOTES, { page: 3, pageSize: 2 });
    expect(pagina).toMatchObject({ page: 3, pageSize: 2, total: 6, totalPages: 3 });
    expect(pagina.items.map((item) => item.deliveryLineId)).toEqual([LINEA_ANULADA.id, linea().id]);
  });

  it('R34, R44: summarizeDelivered se llama una vez con todos los lotes del producto, tambien en la pagina 2', async () => {
    const m = montar({ items: [linea()], pagina: { page: 2, total: 11, totalPages: 2 } });

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
    // 2026-10-15 (QC-282): la pagina vacia la da el propio directorio de lineas.
    expect(m.deliveries.listDeliveryLines).toHaveBeenCalledTimes(1);
    for (const fn of directorios(m).filter((fn) => fn !== m.deliveries.listDeliveryLines)) {
      expect(fn).not.toHaveBeenCalled();
    }
  });

  it('R36: un actor con solo inventario.consultar recibe la anulacion y el total entregado', async () => {
    const m = montar();

    const pagina = await m.listar(FINISHED_PRODUCT_ID, {}, LECTOR);

    expect(LECTOR.permissions).toEqual(['inventario.consultar']);
    expect(pagina.items.map((item) => item.void)).toEqual([null, { reason: FINISHED_VOID_REASON }]);
    expect(pagina.delivered).toEqual(ENTREGADO);
  });
});
