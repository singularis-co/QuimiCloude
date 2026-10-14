import { describe, expect, it, vi } from 'vitest';

import type { Mock } from 'vitest';

import { createConfirmInventoryImport } from '@/lib/modules/inventario/domain/confirm-inventory-import';
import { createCreateProduct } from '@/lib/modules/inventario/domain/create-product';
import { normalizeProductName } from '@/lib/modules/inventario/domain/product-name';

import {
  CSV_FILE,
  fakeReader,
  fakeReadPorts,
  KG,
  LITRO,
  ML,
  NOW,
  productRef,
  ROW_INSUMO,
} from './inventory-import-kit';

import type { Actor, ImportCells, ImportResultRow, SupplyHomonym } from '@/lib/modules/inventario';
import type { ProductRepository } from '@/lib/modules/inventario/ports/product-repository';
import type { UnitCatalog } from '@/lib/modules/unidades';

const ADMIN: Actor = { id: 'user-1', companyId: 'company-1', permissions: ['inventario.modificar'] };
const FILE = { ...CSV_FILE, importKey: '9b2f6a52-5d0e-4c7e-9a36-0f1d7c1b2a10' };

type DobleDelPuerto = { [K in keyof ProductRepository]: Mock<ProductRepository[K]> };

/** El puerto del alta manual: devuelve los homónimos que hay en la base al confirmar. */
function montarRepositorio(homonimos: readonly SupplyHomonym[]): DobleDelPuerto & ProductRepository {
  return {
    create: vi.fn<ProductRepository['create']>(async () => ({ id: 'producto-1' })),
    findAliveById: vi.fn<ProductRepository['findAliveById']>(async () => null),
    updateAlive: vi.fn<ProductRepository['updateAlive']>(async () => true),
    softDeleteAlive: vi.fn<ProductRepository['softDeleteAlive']>(async () => true),
    listAlive: vi.fn<ProductRepository['listAlive']>(async () => ({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    })),
    findAliveIdByNameInPresentationUnit: vi.fn<ProductRepository['findAliveIdByNameInPresentationUnit']>(async () => null),
    findAliveSupplyHomonyms: vi.fn<ProductRepository['findAliveSupplyHomonyms']>(async (name) =>
      homonimos.filter((homonimo) => normalizeProductName(homonimo.name) === normalizeProductName(name)),
    ),
    findAlivePackagingByName: vi.fn<ProductRepository['findAlivePackagingByName']>(async () => null),
    createWithFirstBatch: vi.fn<ProductRepository['createWithFirstBatch']>(async () => ({
      id: 'producto-nuevo',
      batchId: 'lote-nuevo',
      lot: '1',
    })),
    addBatchToAlive: vi.fn<ProductRepository['addBatchToAlive']>(async () => ({ batchId: 'lote-2', lot: '2' })),
    adjustBatchStock: vi.fn<ProductRepository['adjustBatchStock']>(async () => ({ kind: 'batch_not_found' })),
    findBatchesOfAliveProduct: vi.fn<ProductRepository['findBatchesOfAliveProduct']>(async () => []),
    findBatchMovements: vi.fn<ProductRepository['findBatchMovements']>(async () => null),
  };
}

/** La confirmación con el alta manual real: la conversión la hace `createProduct`. */
function build(
  rows: readonly Partial<ImportCells>[],
  enLaVistaPrevia: Parameters<typeof fakeReadPorts>[0],
  enLaBase: readonly SupplyHomonym[],
) {
  const ports = fakeReadPorts(enLaVistaPrevia);
  const products = montarRepositorio(enLaBase);
  const units = {
    findRefs: vi.fn<UnitCatalog['findRefs']>(async (ids) => [KG, LITRO, ML].filter((unit) => ids.includes(unit.id))),
  };
  const createProduct = vi.fn(createCreateProduct({ products, units, now: () => NOW }));
  const digest = { sha256Hex: vi.fn(async () => 'a'.repeat(64)) };
  const confirm = createConfirmInventoryImport({
    ...ports,
    reader: fakeReader(rows),
    createProduct,
    digest,
    now: () => NOW,
  });
  return { confirm, products, createProduct };
}

function statuses(rows: readonly ImportResultRow[]): string[] {
  return rows.map((row) =>
    row.status === 'error' ? `error:${row.issues.map((issue) => `${issue.code}@${issue.column}`).join(',')}` : row.status,
  );
}

const GLICERINA_EN_L: SupplyHomonym = { id: 'p-l', name: 'Glicerina', type: 'PRODUCT', unitId: LITRO.id, stock: '2.0000' };

describe('confirmInventoryImport — insumo por familia de unidad', () => {
  it('R19 la confirmación escribe el lote convertido sobre el destino', async () => {
    const { confirm, products } = build(
      [{ ...ROW_INSUMO, name: 'Glicerina', unit: 'ml', stock: '500', unitCost: '0,004', lot: 'G-1' }],
      { products: [productRef({ id: 'p-l', nameNormalized: 'glicerina', unitId: LITRO.id, stock: '2.0000' })] },
      [GLICERINA_EN_L],
    );

    const outcome = await confirm(FILE, ADMIN);

    expect(outcome.kind).toBe('imported');
    if (outcome.kind !== 'imported') return;
    expect(outcome.rows[0]).toMatchObject({ status: 'batch_added', productId: 'p-l', lot: '2' });
    expect(products.createWithFirstBatch).not.toHaveBeenCalled();
    expect(products.addBatchToAlive).toHaveBeenCalledTimes(1);
    const [productId, batch] = products.addBatchToAlive.mock.calls[0] ?? [];
    expect(productId).toBe('p-l');
    expect(batch).toMatchObject({ stock: '0.5', unitCost: '4', lot: 'G-1' });
  });

  it('R20 la confirmación no escribe la fila que no cabe', async () => {
    const { confirm, products, createProduct } = build(
      [
        // La vista previa ya ve el homónimo en litros: la fila queda en error y no llega al alta.
        { ...ROW_INSUMO, name: 'Glicerina', unit: 'ml', stock: '0,05', unitCost: '1' },
        // El homónimo en litros nació después de la vista previa: el alta rechaza y la fila se traduce.
        { ...ROW_INSUMO, name: 'Alcohol', unit: 'ml', stock: '0,05', unitCost: '1' },
        // Lo mismo con el costo, también con la base cambiada: 0,0001 por l son 0,0000001 por ml.
        { ...ROW_INSUMO, name: 'Acetona', unit: 'Litro', stock: '1', unitCost: '0,0001' },
        ROW_INSUMO,
      ],
      { products: [productRef({ id: 'p-l', nameNormalized: 'glicerina', unitId: LITRO.id, stock: '2.0000' })] },
      [
        GLICERINA_EN_L,
        { id: 'p-alcohol', name: 'Alcohol', type: 'PRODUCT', unitId: LITRO.id, stock: '1.0000' },
        { id: 'p-acetona', name: 'Acetona', type: 'PRODUCT', unitId: ML.id, stock: '1.0000' },
      ],
    );

    const outcome = await confirm(FILE, ADMIN);

    expect(outcome.kind).toBe('imported');
    if (outcome.kind !== 'imported') return;
    expect(statuses(outcome.rows)).toEqual([
      'error:converted_stock_out_of_range@stock',
      'error:converted_stock_out_of_range@stock',
      'error:converted_cost_out_of_range@unitCost',
      'created',
    ]);
    expect(createProduct).toHaveBeenCalledTimes(3);
    expect(products.addBatchToAlive).not.toHaveBeenCalled();
    expect(products.createWithFirstBatch).toHaveBeenCalledTimes(1);
    expect(products.createWithFirstBatch.mock.calls[0]?.[0]).toMatchObject({ name: ROW_INSUMO.name });
  });
});
