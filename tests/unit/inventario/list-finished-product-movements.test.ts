import { describe, expect, it, vi } from 'vitest';

import { ROLE_ADMINISTRADOR, SEED_ROLE_PERMISSIONS } from '@/lib/modules/identity';
import { createListFinishedProductMovements } from '@/lib/modules/inventario/domain/list-finished-product-movements';
import { ProductNotFoundError, UnauthorizedError, ValidationError } from '@/lib/modules/inventario/domain/errors';
import {
  FINISHED_ORDER_ID,
  FINISHED_ORDER_NUMBER,
  FINISHED_PRODUCT_ID,
  GALLON_BATCH_ID,
  LITER_BATCH_ID,
  UNPACKAGED_BATCH_ID,
  finishedProductPage,
} from '@/tests/fixtures/finished-product-detail';

import type { Actor } from '@/lib/modules/inventario/domain/actor';
import type { OrderNumberDirectory } from '@/lib/modules/inventario/domain/reservation';
import type {
  FinishedProductDetailRepository,
  FinishedProductMovementRecord,
  FinishedProductRecord,
} from '@/lib/modules/inventario/ports/finished-product-detail-repository';

const EMPRESA = 'company-a';
const LECTOR: Actor = { id: 'u-lector', companyId: EMPRESA, permissions: ['inventario.consultar'] };
const OTRO_PEDIDO = 'a0000000-0000-4000-8000-000000000226';

const REGISTRO: FinishedProductRecord = {
  id: FINISHED_PRODUCT_ID,
  name: 'Limpiador multiusos',
  imagePath: null,
  qtyAlert: null,
  unitId: null,
  recipeId: null,
  presentation: null,
  batches: [],
};

function asiento(overrides: Partial<FinishedProductMovementRecord> = {}): FinishedProductMovementRecord {
  return {
    id: '20000000-0000-4000-8000-000000000225',
    kind: 'production',
    batchId: LITER_BATCH_ID,
    lot: 'L-2026-0225',
    quantity: '12.0000',
    packageContent: '1.0000',
    orderId: FINISHED_ORDER_ID,
    reason: null,
    createdAt: '2026-10-10T12:00:00.000Z',
    ...overrides,
  };
}

function montar(
  items: readonly FinishedProductMovementRecord[] = [asiento()],
  record: FinishedProductRecord | null = REGISTRO,
  numeros: ReadonlyMap<string, string> = new Map([[FINISHED_ORDER_ID, FINISHED_ORDER_NUMBER]]),
) {
  const products: FinishedProductDetailRepository = {
    findAliveFinished: vi.fn<FinishedProductDetailRepository['findAliveFinished']>(async () => record),
    listBatches: vi.fn<FinishedProductDetailRepository['listBatches']>(),
    listMovements: vi.fn<FinishedProductDetailRepository['listMovements']>(async () => finishedProductPage(items)),
    // 2026-10-15 (QC-282): el puerto pierde `listDeliveryMovements`; el tab Entregas lee las lineas de `pedidos`.
    listProductionCosts: vi.fn<FinishedProductDetailRepository['listProductionCosts']>(),
    findProducedProducts: vi.fn<FinishedProductDetailRepository['findProducedProducts']>(),
  };
  const orders: OrderNumberDirectory = {
    findNumberTexts: vi.fn<OrderNumberDirectory['findNumberTexts']>(async () => numeros),
  };
  return { products, orders, listar: createListFinishedProductMovements({ products, orders }) };
}

function ningunPuerto(m: ReturnType<typeof montar>): void {
  for (const fn of [...Object.values(m.products), m.orders.findNumberTexts]) {
    expect(fn).not.toHaveBeenCalled();
  }
}

describe('listFinishedProductMovements', () => {
  it('R2: sin inventario.consultar responde unauthorized antes de validar y no llama a ningun puerto', async () => {
    const m = montar();
    const sinPermiso: Actor = { id: 'u-sin', companyId: EMPRESA, permissions: ['pedidos.consultar'] };

    await expect(m.listar(FINISHED_PRODUCT_ID, { direction: 'in' }, sinPermiso)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(m.listar('no-es-uuid', { direction: 'arriba' }, sinPermiso)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(m.listar(FINISHED_PRODUCT_ID, { direction: 'out' }, null)).rejects.toBeInstanceOf(UnauthorizedError);
    ningunPuerto(m);
  });

  it('R3: un actor de otro rol con el permiso es aceptado', async () => {
    const m = montar();
    const deOtroRol: Actor = {
      id: 'u-auditor',
      companyId: EMPRESA,
      permissions: ['terminados.consultar', 'inventario.consultar'],
    };

    await expect(m.listar(FINISHED_PRODUCT_ID, { direction: 'in' }, deOtroRol)).resolves.toMatchObject({ total: 1 });
  });

  it('R3: un Administrador sin inventario.consultar en su conjunto es rechazado', async () => {
    const m = montar();
    const adminSinPermiso: Actor = {
      id: 'u-admin',
      companyId: EMPRESA,
      permissions: [...SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]].filter((p) => p !== 'inventario.consultar'),
    };

    await expect(m.listar(FINISHED_PRODUCT_ID, { direction: 'in' }, adminSinPermiso)).rejects.toBeInstanceOf(UnauthorizedError);
    ningunPuerto(m);
  });

  it('R5: un id sin uuid o un producto que no vuelve responde product_not_found y no lista', async () => {
    const malformado = montar();
    await expect(malformado.listar('no-es-uuid', { direction: 'in' }, LECTOR)).rejects.toBeInstanceOf(ProductNotFoundError);
    ningunPuerto(malformado);

    const ausente = montar(undefined, null);
    await expect(ausente.listar(FINISHED_PRODUCT_ID, { direction: 'in' }, LECTOR)).rejects.toBeInstanceOf(ProductNotFoundError);
    expect(ausente.products.listMovements).not.toHaveBeenCalled();
  });

  it('R15, R16: una entrada sale con su tipo de origen, su lote, su cantidad en envases y su pedido', async () => {
    const m = montar([
      asiento(),
      asiento({ id: '20000000-0000-4000-8000-000000000226', kind: 'opening', batchId: UNPACKAGED_BATCH_ID, lot: 'L-2026-0227', quantity: '2.2500', packageContent: null, orderId: null }),
    ]);

    const pagina = await m.listar(FINISHED_PRODUCT_ID, { direction: 'in' }, LECTOR);

    expect(pagina.items).toEqual([
      {
        id: '20000000-0000-4000-8000-000000000225',
        kind: 'production',
        batchId: LITER_BATCH_ID,
        lot: 'L-2026-0225',
        quantity: '12.0000',
        packaged: { packages: 12, remainder: null },
        orderNumberText: FINISHED_ORDER_NUMBER,
        reason: null,
        createdAt: '2026-10-10T12:00:00.000Z',
      },
      {
        id: '20000000-0000-4000-8000-000000000226',
        kind: 'opening',
        batchId: UNPACKAGED_BATCH_ID,
        lot: 'L-2026-0227',
        quantity: '2.2500',
        packaged: null,
        orderNumberText: null,
        reason: null,
        createdAt: '2026-10-10T12:00:00.000Z',
      },
    ]);
  });

  it('R16: un ajuste que suma sale con su motivo', async () => {
    const m = montar([
      asiento({ kind: 'adjustment', batchId: GALLON_BATCH_ID, quantity: '1.0000', packageContent: '4.0000', orderId: null, reason: 'conteo_fisico' }),
    ]);

    const pagina = await m.listar(FINISHED_PRODUCT_ID, { direction: 'in' }, LECTOR);

    expect(pagina.items[0]).toMatchObject({ kind: 'adjustment', reason: 'conteo_fisico', packaged: { packages: 0, remainder: '1' }, orderNumberText: null });
    expect(m.orders.findNumberTexts).not.toHaveBeenCalled();
  });

  it('R17: una salida sale en valor absoluto, con envases y resto sobre ese valor, y su pedido', async () => {
    const m = montar([
      asiento({ id: '20000000-0000-4000-8000-000000000230', kind: 'delivery', quantity: '-4.5000' }),
      asiento({ id: '20000000-0000-4000-8000-000000000231', kind: 'adjustment', quantity: '-0.5000', orderId: null, reason: 'merma' }),
    ]);

    const pagina = await m.listar(FINISHED_PRODUCT_ID, { direction: 'out' }, LECTOR);

    expect(pagina.items[0]).toMatchObject({ kind: 'delivery', quantity: '4.5000', packaged: { packages: 4, remainder: '0.5' }, orderNumberText: FINISHED_ORDER_NUMBER });
    expect(pagina.items[1]).toMatchObject({ kind: 'adjustment', quantity: '0.5000', packaged: { packages: 0, remainder: '0.5' }, reason: 'merma' });
  });

  it('R18: la direccion pedida llega tal cual al puerto, que clasifica por el signo', async () => {
    const m = montar();

    await m.listar(FINISHED_PRODUCT_ID, { direction: 'out', page: 3, pageSize: 25 }, LECTOR);
    await m.listar(FINISHED_PRODUCT_ID, { direction: 'in' }, LECTOR);

    expect(m.products.listMovements).toHaveBeenNthCalledWith(1, FINISHED_PRODUCT_ID, 'out', { page: 3, pageSize: 25 }, { companyId: EMPRESA });
    expect(m.products.listMovements).toHaveBeenNthCalledWith(2, FINISHED_PRODUCT_ID, 'in', { page: 1 }, { companyId: EMPRESA });
  });

  it('R18: el numero de pedido se pide una vez por pagina, con ids sin repetir, y el que no vuelve sale null', async () => {
    const m = montar([asiento(), asiento({ id: '20000000-0000-4000-8000-000000000227' }), asiento({ id: '20000000-0000-4000-8000-000000000228', orderId: OTRO_PEDIDO })]);

    const pagina = await m.listar(FINISHED_PRODUCT_ID, { direction: 'in' }, LECTOR);

    expect(m.orders.findNumberTexts).toHaveBeenCalledTimes(1);
    expect(m.orders.findNumberTexts).toHaveBeenCalledWith(EMPRESA, [FINISHED_ORDER_ID, OTRO_PEDIDO]);
    expect(pagina.items.map((item) => item.orderNumberText)).toEqual([FINISHED_ORDER_NUMBER, FINISHED_ORDER_NUMBER, null]);
  });

  it('R35: un delivery_void de entrada sale con su numero de pedido', async () => {
    const m = montar([asiento({ id: '20000000-0000-4000-8000-000000000229', kind: 'delivery_void', quantity: '2.0000' })]);

    const pagina = await m.listar(FINISHED_PRODUCT_ID, { direction: 'in' }, LECTOR);

    expect(pagina.items).toEqual([
      expect.objectContaining({
        kind: 'delivery_void',
        quantity: '2.0000',
        packaged: { packages: 2, remainder: null },
        orderNumberText: FINISHED_ORDER_NUMBER,
      }),
    ]);
  });

  it('R23: una direccion desconocida o ausente, o una pagina invalida, responden invalid_input', async () => {
    for (const entrada of [{ direction: 'arriba' }, {}, { direction: 'in', page: 0 }, { direction: 'in', pageSize: 1.5 }, { direction: 'in', extra: 1 }]) {
      const m = montar();
      await expect(m.listar(FINISHED_PRODUCT_ID, entrada, LECTOR)).rejects.toBeInstanceOf(ValidationError);
      expect(m.products.listMovements).not.toHaveBeenCalled();
    }
  });
});
