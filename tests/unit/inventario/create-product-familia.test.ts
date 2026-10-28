import type { Mock } from 'vitest';

import {
  ActionNotAllowedError,
  ConvertedCostOutOfRangeError,
  ConvertedStockOutOfRangeError,
  PRODUCT_TYPES,
  UnauthorizedError,
  ValidationError,
  type Actor,
  type ProductType,
  type SupplyHomonym,
} from '@/lib/modules/inventario';
import { createCreateProduct } from '@/lib/modules/inventario/domain/create-product';
import type { ProductRepository } from '@/lib/modules/inventario/ports/product-repository';
import type { UnitCatalog, UnitRef } from '@/lib/modules/unidades';

const EMPRESA = 'company-a';
const ADMIN: Actor = { id: 'admin-1', companyId: EMPRESA, permissions: ['inventario.modificar'] };
const SOLO_CONSULTA: Actor = { id: 'consulta-1', companyId: EMPRESA, permissions: ['inventario.consultar'] };
const AHORA = new Date('2026-10-14T10:00:00.000Z');

const ML = '11111111-1111-4111-8111-111111111111';
const L = '22222222-2222-4222-8222-222222222222';
const KG = '33333333-3333-4333-8333-333333333333';

const UNIDADES: readonly UnitRef[] = [
  { id: ML, name: 'mililitro', symbol: 'ml', baseUnitId: null, factor: null },
  { id: L, name: 'litro', symbol: 'l', baseUnitId: ML, factor: '1000' },
  { id: KG, name: 'kilogramo', symbol: 'kg', baseUnitId: null, factor: null },
];

const ALTA_EN_ML = {
  name: 'Glicerina',
  stock: '500',
  qtyAlert: '1',
  unitId: ML,
  unitCost: '0.004',
};

type DobleDelPuerto = { [K in keyof ProductRepository]: Mock<ProductRepository[K]> };

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
    findAliveSupplyHomonyms: vi.fn<ProductRepository['findAliveSupplyHomonyms']>(async () => homonimos),
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

function homonimo(
  id: string,
  unitId: string,
  stock: string,
  type: ProductType = PRODUCT_TYPES.PRODUCT,
): SupplyHomonym {
  return { id, name: 'Glicerina', type, unitId, stock };
}

function montar(homonimos: readonly SupplyHomonym[]) {
  const products = montarRepositorio(homonimos);
  const units = {
    findRefs: vi.fn<UnitCatalog['findRefs']>(async (ids) => UNIDADES.filter((unidad) => ids.includes(unidad.id))),
  };
  const createProduct = createCreateProduct({ products, units, now: () => AHORA });
  return { products, units, createProduct };
}

type Repositorio = ReturnType<typeof montarRepositorio>;

function afirmarSinEscribir(products: Repositorio): void {
  expect(products.createWithFirstBatch).not.toHaveBeenCalled();
  expect(products.addBatchToAlive).not.toHaveBeenCalled();
  expect(products.create).not.toHaveBeenCalled();
  expect(products.updateAlive).not.toHaveBeenCalled();
  expect(products.softDeleteAlive).not.toHaveBeenCalled();
  expect(products.adjustBatchStock).not.toHaveBeenCalled();
}

function loteAgregado(products: Repositorio) {
  const llamada = products.addBatchToAlive.mock.calls[0];
  if (llamada === undefined) throw new Error('addBatchToAlive no fue llamado');
  return { productId: llamada[0], batch: llamada[1] };
}

describe('QC-203 — alta de insumo por familia de unidad', () => {
  it('R1 un homónimo de otra familia no cuenta y crea', async () => {
    const { products, createProduct } = montar([homonimo('en-kg', KG, '10.0000')]);

    const resultado = await createProduct(ALTA_EN_ML, ADMIN);

    expect(resultado).toEqual({ id: 'producto-nuevo', lot: '1' });
    expect(products.createWithFirstBatch).toHaveBeenCalledTimes(1);
    expect(products.createWithFirstBatch.mock.calls[0]?.[0]).toMatchObject({ unitId: ML });
    expect(products.addBatchToAlive).not.toHaveBeenCalled();
  });

  it('R3 sin homónimo crea con la unidad del alta', async () => {
    const { products, createProduct } = montar([]);

    const resultado = await createProduct(ALTA_EN_ML, ADMIN);

    expect(resultado).toEqual({ id: 'producto-nuevo', lot: '1' });
    const llamada = products.createWithFirstBatch.mock.calls[0];
    expect(llamada?.[0]).toEqual({ name: 'Glicerina', qtyAlert: '1', type: PRODUCT_TYPES.PRODUCT, unitId: ML });
    expect(llamada?.[1]).toMatchObject({ presentationId: null, stock: '500', unitCost: '0.004' });
  });

  it('R4 con homónimo en otra unidad agrega el lote convertido y no crea', async () => {
    const { products, createProduct } = montar([homonimo('en-l', L, '3.0000')]);

    const resultado = await createProduct(ALTA_EN_ML, ADMIN);

    expect(products.createWithFirstBatch).not.toHaveBeenCalled();
    const { productId, batch } = loteAgregado(products);
    expect(productId).toBe('en-l');
    expect(batch).toMatchObject({ presentationId: null, stock: '0.5', createdBy: ADMIN.id });
    expect(resultado).toEqual({
      id: 'en-l',
      lot: '2',
      conversion: { productName: 'Glicerina', stock: '0.5', unitId: L },
    });
  });

  it('R4 con homónimo en la misma unidad agrega sin convertir', async () => {
    const { products, createProduct } = montar([homonimo('en-ml', ML, '100.0000')]);

    const resultado = await createProduct(ALTA_EN_ML, ADMIN);

    const { productId, batch } = loteAgregado(products);
    expect(productId).toBe('en-ml');
    expect(batch).toMatchObject({ stock: '500', unitCost: '0.004' });
    expect(resultado).toEqual({ id: 'en-ml', lot: '2' });
    expect(products.createWithFirstBatch).not.toHaveBeenCalled();
  });

  it('R5 entre varios va al de más existencia', async () => {
    // 100 ml contra 2 l = 2000 ml: gana el más nuevo porque tiene más, no por antigüedad.
    const { products, createProduct } = montar([
      homonimo('antiguo-en-ml', ML, '100.0000'),
      homonimo('nuevo-en-l', L, '2.0000'),
    ]);

    const resultado = await createProduct(ALTA_EN_ML, ADMIN);

    expect(loteAgregado(products).productId).toBe('nuevo-en-l');
    expect(resultado.conversion).toEqual({ productName: 'Glicerina', stock: '0.5', unitId: L });
  });

  it('R6 convierte el costo unitario', async () => {
    const { products, createProduct } = montar([homonimo('en-l', L, '3.0000')]);

    await createProduct(ALTA_EN_ML, ADMIN);

    expect(loteAgregado(products).batch).toMatchObject({ stock: '0.5', unitCost: '4' });
  });

  it('R7 con solo costo total deriva sobre la existencia convertida', async () => {
    const { products, createProduct } = montar([homonimo('en-l', L, '3.0000')]);

    await createProduct({ ...ALTA_EN_ML, unitCost: undefined, totalCost: '10' }, ADMIN);

    // 10 / 0.5 l = 20 por l; sobre los 500 ml sin convertir saldría 0.02.
    expect(loteAgregado(products).batch).toMatchObject({ stock: '0.5', unitCost: '20.0000' });
  });

  it('R7 si el derivado queda en 0 rechaza como hoy', async () => {
    // 1 l pasa a 1000 ml: 0.0001 / 1000 redondea a 0.0000.
    const { products, createProduct } = montar([homonimo('en-ml', ML, '5.0000')]);

    await expect(
      createProduct({ ...ALTA_EN_ML, stock: '1', unitId: L, unitCost: undefined, totalCost: '0.0001' }, ADMIN),
    ).rejects.toBeInstanceOf(ValidationError);
    afirmarSinEscribir(products);
  });

  it('R8 existencia que no cabe: ConvertedStockOutOfRangeError sin escribir', async () => {
    const { products, createProduct } = montar([homonimo('en-l', L, '3.0000')]);

    await expect(createProduct({ ...ALTA_EN_ML, stock: '0.25' }, ADMIN)).rejects.toBeInstanceOf(
      ConvertedStockOutOfRangeError,
    );
    afirmarSinEscribir(products);
  });

  it('R9 costo que no cabe: ConvertedCostOutOfRangeError sin escribir', async () => {
    // 0.25 por l son 0.00025 por ml.
    const { products, createProduct } = montar([homonimo('en-ml', ML, '5.0000')]);

    await expect(
      createProduct({ ...ALTA_EN_ML, stock: '1', unitId: L, unitCost: '0.25' }, ADMIN),
    ).rejects.toBeInstanceOf(ConvertedCostOutOfRangeError);
    afirmarSinEscribir(products);
  });

  it('R10 destino terminado: action_not_allowed sin escribir', async () => {
    const { products, createProduct } = montar([homonimo('terminado', L, '3.0000', PRODUCT_TYPES.FINISHED_PRODUCT)]);

    const error = await createProduct(ALTA_EN_ML, ADMIN).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ActionNotAllowedError);
    expect((error as ActionNotAllowedError).code).toBe('action_not_allowed');
    afirmarSinEscribir(products);
  });

  it('R11 sin inventario.modificar no consulta ni escribe', async () => {
    const { products, units, createProduct } = montar([homonimo('en-l', L, '3.0000')]);

    for (const actor of [SOLO_CONSULTA, null]) {
      await expect(createProduct(ALTA_EN_ML, actor)).rejects.toBeInstanceOf(UnauthorizedError);
    }
    expect(products.findAliveSupplyHomonyms).not.toHaveBeenCalled();
    expect(units.findRefs).not.toHaveBeenCalled();
    afirmarSinEscribir(products);
  });

  it('R29 solo llama a addBatchToAlive sobre el destino', async () => {
    const { products, createProduct } = montar([
      homonimo('partido-en-ml', ML, '100.0000'),
      homonimo('destino-en-l', L, '2.0000'),
      homonimo('partido-en-l', L, '0.0000'),
    ]);

    await createProduct(ALTA_EN_ML, ADMIN);

    expect(products.addBatchToAlive).toHaveBeenCalledTimes(1);
    expect(loteAgregado(products).productId).toBe('destino-en-l');
    expect(products.createWithFirstBatch).not.toHaveBeenCalled();
    expect(products.create).not.toHaveBeenCalled();
    expect(products.updateAlive).not.toHaveBeenCalled();
    expect(products.softDeleteAlive).not.toHaveBeenCalled();
    expect(products.adjustBatchStock).not.toHaveBeenCalled();
  });
});
