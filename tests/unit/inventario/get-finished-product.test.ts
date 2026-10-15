import { describe, expect, it, vi } from 'vitest';

import { ROLE_ADMINISTRADOR, SEED_ROLE_PERMISSIONS } from '@/lib/modules/identity';
import { createGetFinishedProduct } from '@/lib/modules/inventario/domain/get-finished-product';
import { ProductNotFoundError, UnauthorizedError } from '@/lib/modules/inventario/domain/errors';
import {
  EMPTY_BATCH_ID,
  FINISHED_PRESENTATION_ID,
  FINISHED_PRODUCT_ID,
  FINISHED_UNIT_ID,
  GALLON_BATCH_ID,
  LITER_BATCH_ID,
  UNPACKAGED_BATCH_ID,
  finishedProductDetail,
} from '@/tests/fixtures/finished-product-detail';

import type { Actor } from '@/lib/modules/inventario/domain/actor';
import type {
  FinishedProductDetailRepository,
  FinishedProductRecord,
} from '@/lib/modules/inventario/ports/finished-product-detail-repository';
import type { UnitCatalog, UnitRef } from '@/lib/modules/unidades';

const EMPRESA = 'company-a';
const LECTOR: Actor = { id: 'u-lector', companyId: EMPRESA, permissions: ['inventario.consultar'] };
const PRESENTATION_UNIT_ID = 'c2000000-0000-4000-8000-000000000225';

const LITRO: UnitRef = { id: FINISHED_UNIT_ID, name: 'Litro', symbol: 'L', baseUnitId: null, factor: null };

function registro(overrides: Partial<FinishedProductRecord> = {}): FinishedProductRecord {
  return {
    id: FINISHED_PRODUCT_ID,
    name: 'Limpiador multiusos',
    imagePath: null,
    qtyAlert: '5.0000',
    unitId: FINISHED_UNIT_ID,
    recipeId: null,
    presentation: { id: FINISHED_PRESENTATION_ID, name: 'Botella 1 L', content: '1.0000', unitId: FINISHED_UNIT_ID },
    batches: [
      { id: LITER_BATCH_ID, stock: '10.5000', packageContent: '1.0000' },
      { id: GALLON_BATCH_ID, stock: '9.0000', packageContent: '4.0000' },
      { id: UNPACKAGED_BATCH_ID, stock: '2.2500', packageContent: null },
      { id: EMPTY_BATCH_ID, stock: '0.0000', packageContent: '1.0000' },
    ],
    ...overrides,
  };
}

function montar(record: FinishedProductRecord | null = registro(), refs: readonly UnitRef[] = [LITRO]) {
  const products: FinishedProductDetailRepository = {
    findAliveFinished: vi.fn<FinishedProductDetailRepository['findAliveFinished']>(async () => record),
    listBatches: vi.fn<FinishedProductDetailRepository['listBatches']>(),
    listMovements: vi.fn<FinishedProductDetailRepository['listMovements']>(),
    listDeliveryMovements: vi.fn<FinishedProductDetailRepository['listDeliveryMovements']>(),
    listProductionCosts: vi.fn<FinishedProductDetailRepository['listProductionCosts']>(),
    findProducedProducts: vi.fn<FinishedProductDetailRepository['findProducedProducts']>(),
  };
  const units: Pick<UnitCatalog, 'findRefs'> = {
    findRefs: vi.fn<UnitCatalog['findRefs']>(async () => refs),
  };
  return { products, units, obtener: createGetFinishedProduct({ products, units }) };
}

function ningunPuerto(m: ReturnType<typeof montar>): void {
  for (const fn of [...Object.values(m.products), m.units.findRefs]) {
    expect(fn).not.toHaveBeenCalled();
  }
}

describe('getFinishedProduct', () => {
  it('R2: sin inventario.consultar responde unauthorized, incluso con un id invalido, y no llama a ningun puerto', async () => {
    const m = montar();
    const sinPermiso: Actor = { id: 'u-sin', companyId: EMPRESA, permissions: ['pedidos.consultar'] };

    await expect(m.obtener(FINISHED_PRODUCT_ID, sinPermiso)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(m.obtener('no-es-uuid', sinPermiso)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(m.obtener(FINISHED_PRODUCT_ID, null)).rejects.toBeInstanceOf(UnauthorizedError);
    ningunPuerto(m);
  });

  it('R3: un actor de otro rol con el permiso es aceptado', async () => {
    const m = montar();
    const deOtroRol: Actor = {
      id: 'u-auditor',
      companyId: EMPRESA,
      permissions: ['asignaciones.consultar', 'inventario.consultar'],
    };

    await expect(m.obtener(FINISHED_PRODUCT_ID, deOtroRol)).resolves.toEqual(finishedProductDetail());
  });

  it('R3: un Administrador sin inventario.consultar en su conjunto es rechazado', async () => {
    const m = montar();
    const delAdministrador = [...SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]];
    expect(delAdministrador).toContain('inventario.consultar');
    const adminSinPermiso: Actor = {
      id: 'u-admin',
      companyId: EMPRESA,
      permissions: delAdministrador.filter((p) => p !== 'inventario.consultar'),
    };

    await expect(m.obtener(FINISHED_PRODUCT_ID, adminSinPermiso)).rejects.toBeInstanceOf(UnauthorizedError);
    ningunPuerto(m);
  });

  it('R5: un id sin forma de uuid responde product_not_found sin consultar', async () => {
    const m = montar();

    await expect(m.obtener('no-es-uuid', LECTOR)).rejects.toBeInstanceOf(ProductNotFoundError);
    ningunPuerto(m);
  });

  it('R5: si el repositorio no lo encuentra vivo en la empresa responde product_not_found y no resuelve unidades', async () => {
    const m = montar(null);

    await expect(m.obtener(FINISHED_PRODUCT_ID, LECTOR)).rejects.toBeInstanceOf(ProductNotFoundError);
    expect(m.products.findAliveFinished).toHaveBeenCalledWith(FINISHED_PRODUCT_ID, { companyId: EMPRESA });
    expect(m.units.findRefs).not.toHaveBeenCalled();
  });

  it('R10: resuelve la unidad base y la de la presentacion en una sola llamada al catalogo', async () => {
    const presentacion: UnitRef = { id: PRESENTATION_UNIT_ID, name: 'Mililitro', symbol: 'ml', baseUnitId: FINISHED_UNIT_ID, factor: '0.0010' };
    const m = montar(
      registro({
        presentation: { id: FINISHED_PRESENTATION_ID, name: 'Botella 500 ml', content: '500.0000', unitId: PRESENTATION_UNIT_ID },
      }),
      [LITRO, presentacion],
    );

    const detalle = await m.obtener(FINISHED_PRODUCT_ID, LECTOR);

    expect(m.units.findRefs).toHaveBeenCalledTimes(1);
    expect(m.units.findRefs).toHaveBeenCalledWith([FINISHED_UNIT_ID, PRESENTATION_UNIT_ID], EMPRESA);
    expect(detalle.unit).toEqual({ id: FINISHED_UNIT_ID, name: 'Litro', symbol: 'L' });
    expect(detalle.presentation).toEqual({
      id: FINISHED_PRESENTATION_ID,
      name: 'Botella 500 ml',
      content: '500.0000',
      unit: { id: PRESENTATION_UNIT_ID, name: 'Mililitro', symbol: 'ml' },
    });
    expect(detalle.qtyAlert).toBe('5.0000');
    expect(detalle.imagePath).toBeNull();
  });

  it('R10: sin presentacion ni unidad no llama al catalogo, y una unidad que no vuelve sale como ausente', async () => {
    const sinNada = montar(registro({ unitId: null, presentation: null, qtyAlert: null }));
    const vacio = await sinNada.obtener(FINISHED_PRODUCT_ID, LECTOR);
    expect(sinNada.units.findRefs).not.toHaveBeenCalled();
    expect(vacio.unit).toBeNull();
    expect(vacio.presentation).toBeNull();
    expect(vacio.qtyAlert).toBeNull();

    const sinRef = montar(registro(), []);
    const detalle = await sinRef.obtener(FINISHED_PRODUCT_ID, LECTOR);
    expect(detalle.unit).toBeNull();
    expect(detalle.presentation?.unit).toBeNull();
  });

  it('R11, R12: el stock sale de los lotes del registro: total exacto, envases por contenido y sin envase', async () => {
    const m = montar();

    const detalle = await m.obtener(FINISHED_PRODUCT_ID, LECTOR);

    expect(detalle).toEqual(finishedProductDetail());
    expect(detalle.stock).toEqual({
      total: '21.7500',
      byPackageContent: [
        { packageContent: '1.0000', packages: 10, remainder: '0.5' },
        { packageContent: '4.0000', packages: 2, remainder: '1' },
      ],
      withoutPackage: '2.2500',
    });
  });
});
