import { describe, expect, it, vi } from 'vitest';

import { ROLE_ADMINISTRADOR, SEED_ROLE_PERMISSIONS } from '@/lib/modules/identity';
import { createListFinishedProductBatches } from '@/lib/modules/inventario/domain/list-finished-product-batches';
import { ProductNotFoundError, UnauthorizedError, ValidationError } from '@/lib/modules/inventario/domain/errors';
import {
  EMPTY_BATCH_ID,
  FINISHED_ORDER_ID,
  FINISHED_ORDER_NUMBER,
  FINISHED_PRODUCT_ID,
  LITER_BATCH_ID,
  UNPACKAGED_BATCH_ID,
  UNPACKAGED_BATCH_ROW,
  finishedProductBatchRow,
  finishedProductPage,
} from '@/tests/fixtures/finished-product-detail';

import type { Actor } from '@/lib/modules/inventario/domain/actor';
import type { FinishedProductBatchRow } from '@/lib/modules/inventario/domain/finished-product-detail';
import type { OrderNumberDirectory } from '@/lib/modules/inventario/domain/reservation';
import type {
  FinishedProductBatchRecord,
  FinishedProductDetailRepository,
  FinishedProductRecord,
} from '@/lib/modules/inventario/ports/finished-product-detail-repository';

const EMPRESA = 'company-a';
const LECTOR: Actor = { id: 'u-lector', companyId: EMPRESA, permissions: ['inventario.consultar'] };
const PEDIDO_SIN_NUMERO = 'a0000000-0000-4000-8000-000000000999';

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

/** La fila de la fixture tal como la devuelve el puerto: con `orderId` y sin lo que resuelve el caso de uso. */
function crudoDe(fila: FinishedProductBatchRow, orderId: string | null): FinishedProductBatchRecord {
  return {
    id: fila.id,
    lot: fila.lot,
    purchaseDate: fila.purchaseDate,
    productionDate: fila.productionDate,
    expiryDate: fila.expiryDate,
    packageContent: fila.packageContent,
    stock: fila.stock,
    createdAt: fila.createdAt,
    orderId,
  };
}

function loteCrudo(overrides: Partial<FinishedProductBatchRecord> = {}): FinishedProductBatchRecord {
  return { ...crudoDe(finishedProductBatchRow(), FINISHED_ORDER_ID), ...overrides };
}

const LOTE_SIN_PEDIDO = crudoDe(UNPACKAGED_BATCH_ROW, null);

const LOTE_AGOTADO = loteCrudo({ id: EMPTY_BATCH_ID, lot: 'L-2026-0228', stock: '0.0000' });

function montar(
  items: readonly FinishedProductBatchRecord[] = [loteCrudo(), LOTE_SIN_PEDIDO, LOTE_AGOTADO],
  record: FinishedProductRecord | null = REGISTRO,
  numeros: ReadonlyMap<string, string> = new Map([[FINISHED_ORDER_ID, FINISHED_ORDER_NUMBER]]),
) {
  const products: FinishedProductDetailRepository = {
    findAliveFinished: vi.fn<FinishedProductDetailRepository['findAliveFinished']>(async () => record),
    listBatches: vi.fn<FinishedProductDetailRepository['listBatches']>(async () => finishedProductPage(items)),
    listMovements: vi.fn<FinishedProductDetailRepository['listMovements']>(),
    // 2026-10-15 (QC-282): el puerto pierde `listDeliveryMovements`; el tab Entregas lee las lineas de `pedidos`.
    listProductionCosts: vi.fn<FinishedProductDetailRepository['listProductionCosts']>(),
    findProducedProducts: vi.fn<FinishedProductDetailRepository['findProducedProducts']>(),
  };
  const orders: OrderNumberDirectory = {
    findNumberTexts: vi.fn<OrderNumberDirectory['findNumberTexts']>(async () => numeros),
  };
  return { products, orders, listar: createListFinishedProductBatches({ products, orders }) };
}

function ningunPuerto(m: ReturnType<typeof montar>): void {
  for (const fn of [...Object.values(m.products), m.orders.findNumberTexts]) {
    expect(fn).not.toHaveBeenCalled();
  }
}

describe('listFinishedProductBatches', () => {
  it('R2: sin inventario.consultar responde unauthorized antes de validar y no llama a ningun puerto', async () => {
    const m = montar();
    const sinPermiso: Actor = { id: 'u-sin', companyId: EMPRESA, permissions: ['pedidos.consultar'] };

    await expect(m.listar(FINISHED_PRODUCT_ID, { page: 1 }, sinPermiso)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(m.listar('no-es-uuid', { page: 0 }, sinPermiso)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(m.listar(FINISHED_PRODUCT_ID, { page: 1 }, undefined)).rejects.toBeInstanceOf(UnauthorizedError);
    ningunPuerto(m);
  });

  it('R3: un actor de otro rol con el permiso es aceptado', async () => {
    const m = montar();
    const deOtroRol: Actor = {
      id: 'u-auditor',
      companyId: EMPRESA,
      permissions: ['clientes.consultar', 'inventario.consultar'],
    };

    await expect(m.listar(FINISHED_PRODUCT_ID, {}, deOtroRol)).resolves.toMatchObject({ total: 3 });
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

  it('R5: un id sin uuid o un producto que no vuelve responde product_not_found y no lista', async () => {
    const malformado = montar();
    await expect(malformado.listar('no-es-uuid', {}, LECTOR)).rejects.toBeInstanceOf(ProductNotFoundError);
    ningunPuerto(malformado);

    const ausente = montar(undefined, null);
    await expect(ausente.listar(FINISHED_PRODUCT_ID, {}, LECTOR)).rejects.toBeInstanceOf(ProductNotFoundError);
    expect(ausente.products.findAliveFinished).toHaveBeenCalledWith(FINISHED_PRODUCT_ID, { companyId: EMPRESA });
    expect(ausente.products.listBatches).not.toHaveBeenCalled();
    expect(ausente.orders.findNumberTexts).not.toHaveBeenCalled();
  });

  it('R13: lista todos los lotes, el agotado y el sin pedido incluidos, con su existencia en envases', async () => {
    const m = montar();

    const pagina = await m.listar(FINISHED_PRODUCT_ID, { page: 2, pageSize: 5 }, LECTOR);

    expect(m.products.listBatches).toHaveBeenCalledWith(FINISHED_PRODUCT_ID, { page: 2, pageSize: 5 }, { companyId: EMPRESA });
    expect(pagina.items).toEqual([
      finishedProductBatchRow(),
      UNPACKAGED_BATCH_ROW,
      finishedProductBatchRow({ id: EMPTY_BATCH_ID, lot: 'L-2026-0228', stock: '0.0000', packagedStock: { packages: 0, remainder: null } }),
    ]);
    expect(pagina.items.map((item) => item.id)).toEqual([LITER_BATCH_ID, UNPACKAGED_BATCH_ID, EMPTY_BATCH_ID]);
  });

  it('R14: el numero sale del directorio de pedidos en una sola llamada con ids sin repetir', async () => {
    const m = montar();

    await m.listar(FINISHED_PRODUCT_ID, {}, LECTOR);

    expect(m.orders.findNumberTexts).toHaveBeenCalledTimes(1);
    expect(m.orders.findNumberTexts).toHaveBeenCalledWith(EMPRESA, [FINISHED_ORDER_ID]);
  });

  it('R14: un pedido sin numero en el directorio sale como null y la fila sigue', async () => {
    const m = montar([loteCrudo({ orderId: PEDIDO_SIN_NUMERO })]);

    const pagina = await m.listar(FINISHED_PRODUCT_ID, {}, LECTOR);

    expect(pagina.items).toHaveLength(1);
    expect(pagina.items[0]).toMatchObject({ id: LITER_BATCH_ID, orderNumberText: null });
  });

  it('R23: una pagina o un tamano que no son enteros >= 1, o un campo de mas, responden invalid_input', async () => {
    for (const entrada of [{ page: 0 }, { page: 1.5 }, { pageSize: 0 }, { page: '1' }, { page: 1, extra: true }, null]) {
      const m = montar();
      await expect(m.listar(FINISHED_PRODUCT_ID, entrada, LECTOR)).rejects.toBeInstanceOf(ValidationError);
      expect(m.products.listBatches).not.toHaveBeenCalled();
    }
  });
});
