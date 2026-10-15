import { describe, expect, it, vi } from 'vitest';

import { ROLE_ADMINISTRADOR, SEED_ROLE_PERMISSIONS } from '@/lib/modules/identity';
import { createListFinishedProductCosts } from '@/lib/modules/inventario/domain/list-finished-product-costs';
import { ProductNotFoundError, UnauthorizedError, ValidationError } from '@/lib/modules/inventario/domain/errors';
import {
  FINISHED_ORDER_ID,
  FINISHED_ORDER_NUMBER,
  FINISHED_PRODUCT_ID,
  GALLON_BATCH_ID,
  LITER_BATCH_ID,
  finishedProductCostRow,
  finishedProductPage,
} from '@/tests/fixtures/finished-product-detail';

import type { Actor } from '@/lib/modules/inventario/domain/actor';
import type { OrderNumberDirectory } from '@/lib/modules/inventario/domain/reservation';
import type {
  FinishedProductCostRecord,
  FinishedProductDetailRepository,
  FinishedProductRecord,
} from '@/lib/modules/inventario/ports/finished-product-detail-repository';

const EMPRESA = 'company-a';
const LECTOR: Actor = { id: 'u-lector', companyId: EMPRESA, permissions: ['inventario.consultar'] };

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

function costo(overrides: Partial<FinishedProductCostRecord> = {}): FinishedProductCostRecord {
  return {
    batchId: LITER_BATCH_ID,
    lot: 'L-2026-0225',
    orderId: FINISHED_ORDER_ID,
    quantity: '12.0000',
    packageContent: '1.0000',
    unitCost: '2.5000',
    createdAt: '2026-10-10T12:00:00.000Z',
    ...overrides,
  };
}

function montar(items: readonly FinishedProductCostRecord[] = [costo()], record: FinishedProductRecord | null = REGISTRO) {
  const products: FinishedProductDetailRepository = {
    findAliveFinished: vi.fn<FinishedProductDetailRepository['findAliveFinished']>(async () => record),
    listBatches: vi.fn<FinishedProductDetailRepository['listBatches']>(),
    listMovements: vi.fn<FinishedProductDetailRepository['listMovements']>(),
    // 2026-10-15 (QC-282): el puerto pierde `listDeliveryMovements`; el tab Entregas lee las lineas de `pedidos`.
    listProductionCosts: vi.fn<FinishedProductDetailRepository['listProductionCosts']>(async () => finishedProductPage(items)),
    findProducedProducts: vi.fn<FinishedProductDetailRepository['findProducedProducts']>(),
  };
  const orders: OrderNumberDirectory = {
    findNumberTexts: vi.fn<OrderNumberDirectory['findNumberTexts']>(async () => new Map([[FINISHED_ORDER_ID, FINISHED_ORDER_NUMBER]])),
  };
  const deps = { products, orders };
  return { products, orders, deps, listar: createListFinishedProductCosts(deps) };
}

function ningunPuerto(m: ReturnType<typeof montar>): void {
  for (const fn of [...Object.values(m.products), m.orders.findNumberTexts]) {
    expect(fn).not.toHaveBeenCalled();
  }
}

describe('listFinishedProductCosts', () => {
  it('R2: sin inventario.consultar responde unauthorized antes de validar y no llama a ningun puerto', async () => {
    const m = montar();
    const sinPermiso: Actor = { id: 'u-sin', companyId: EMPRESA, permissions: ['recetas.consultar'] };

    await expect(m.listar(FINISHED_PRODUCT_ID, {}, sinPermiso)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(m.listar('no-es-uuid', { page: -1 }, sinPermiso)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(m.listar(FINISHED_PRODUCT_ID, {}, undefined)).rejects.toBeInstanceOf(UnauthorizedError);
    ningunPuerto(m);
  });

  it('R3: un actor de otro rol con el permiso es aceptado', async () => {
    const m = montar();
    const deOtroRol: Actor = {
      id: 'u-auditor',
      companyId: EMPRESA,
      permissions: ['proveedores.consultar', 'inventario.consultar'],
    };

    await expect(m.listar(FINISHED_PRODUCT_ID, {}, deOtroRol)).resolves.toEqual(finishedProductPage([finishedProductCostRow()]));
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

  it('R4: con solo inventario.consultar, sin recetas ni pedidos, ve el costo y el pedido', async () => {
    const m = montar();

    const pagina = await m.listar(FINISHED_PRODUCT_ID, {}, LECTOR);

    expect(pagina.items[0]).toMatchObject({ unitCost: '2.5000', totalCost: '30.0000', orderNumberText: FINISHED_ORDER_NUMBER });
  });

  it('R5: un id sin uuid o un producto que no vuelve responde product_not_found y no lista', async () => {
    const malformado = montar();
    await expect(malformado.listar('no-es-uuid', {}, LECTOR)).rejects.toBeInstanceOf(ProductNotFoundError);
    ningunPuerto(malformado);

    const ausente = montar(undefined, null);
    await expect(ausente.listar(FINISHED_PRODUCT_ID, {}, LECTOR)).rejects.toBeInstanceOf(ProductNotFoundError);
    expect(ausente.products.listProductionCosts).not.toHaveBeenCalled();
    expect(ausente.orders.findNumberTexts).not.toHaveBeenCalled();
  });

  it('R21: cada lote producido sale con su cantidad en envases, su costo unitario y el total redondeado mitad arriba', async () => {
    const m = montar([
      costo(),
      costo({ batchId: GALLON_BATCH_ID, lot: 'L-2026-0226', quantity: '9.0000', packageContent: '4.0000', unitCost: '1.33335' }),
    ]);

    const pagina = await m.listar(FINISHED_PRODUCT_ID, { page: 1, pageSize: 25 }, LECTOR);

    expect(m.products.listProductionCosts).toHaveBeenCalledWith(FINISHED_PRODUCT_ID, { page: 1, pageSize: 25 }, { companyId: EMPRESA });
    expect(pagina.items).toEqual([
      finishedProductCostRow(),
      finishedProductCostRow({
        batchId: GALLON_BATCH_ID,
        lot: 'L-2026-0226',
        quantity: '9.0000',
        packaged: { packages: 2, remainder: '1' },
        unitCost: '1.33335',
        totalCost: '12.0002',
      }),
    ]);
  });

  it('R21: un lote sin costo unitario guardado deja el total en null', async () => {
    const m = montar([costo({ unitCost: null, orderId: null })]);

    const pagina = await m.listar(FINISHED_PRODUCT_ID, {}, LECTOR);

    expect(pagina.items[0]).toMatchObject({ unitCost: null, totalCost: null, orderNumberText: null });
    expect(m.orders.findNumberTexts).not.toHaveBeenCalled();
  });

  it('R22: el total sale de unitCost x cantidad del registro, sin ningun puerto de recetas ni de costos', async () => {
    const m = montar([costo({ quantity: '3.2500', unitCost: '4.1000' })]);

    const pagina = await m.listar(FINISHED_PRODUCT_ID, {}, LECTOR);

    expect(Object.keys(m.deps).sort()).toEqual(['orders', 'products']);
    expect(pagina.items[0]?.totalCost).toBe('13.3250');
    const llamados = Object.entries(m.products)
      .filter(([, fn]) => vi.mocked(fn).mock.calls.length > 0)
      .map(([nombre]) => nombre);
    expect(llamados.sort()).toEqual(['findAliveFinished', 'listProductionCosts']);
  });

  it('R23: una pagina o un tamano invalidos, o un campo de mas, responden invalid_input', async () => {
    for (const entrada of [{ page: 0 }, { pageSize: -1 }, { page: 1.1 }, { page: 1, sort: 'cost' }, 7]) {
      const m = montar();
      await expect(m.listar(FINISHED_PRODUCT_ID, entrada, LECTOR)).rejects.toBeInstanceOf(ValidationError);
      expect(m.products.listProductionCosts).not.toHaveBeenCalled();
    }
  });
});
