// QC-159 T3 — `createCreateRawMaterial`, con doble del puerto (`design.md > 5.3`, P1).
// Sin base de datos: lo que se prueba aqui es la DECISION del dominio, no Prisma (esa es la
// integracion, `create-raw-material.int.test.ts`).
//
// Cubre R25 (parte dominio) y la defensa en profundidad de R31.

import { describe, expect, it, vi } from 'vitest';

import { PRODUCT_TYPES } from '@/lib/modules/inventario';
import type { Actor } from '@/lib/modules/inventario/domain/actor';
import { createCreateRawMaterial } from '@/lib/modules/inventario/domain/create-raw-material';
import { UnauthorizedError, ValidationError } from '@/lib/modules/inventario/domain/errors';
import type { ProductRepository } from '@/lib/modules/inventario/ports/product-repository';
import type { UnitCatalog, UnitRef } from '@/lib/modules/unidades';

const EMPRESA = 'company-a';

const CON_PERMISO: Actor = {
  id: 'admin-1',
  companyId: EMPRESA,
  permissions: ['inventario.consultar', 'inventario.modificar'],
};

const SIN_PERMISO: Actor = {
  id: 'user-1',
  companyId: EMPRESA,
  permissions: ['inventario.consultar'],
};

const AHORA = new Date('2026-09-25T10:00:00.000Z');

const KG = '00000000-0000-4000-8000-0000000000a1';
const UNIDAD_OTRA_EMPRESA = '00000000-0000-4000-8000-0000000000b2';
const REF_KG: UnitRef = { id: KG, name: 'kilogramo', symbol: 'kg', baseUnitId: null, factor: null };

/** Doble del catalogo: solo `KG` es visible para la empresa. */
function montarUnidades(): Pick<UnitCatalog, 'findRefs'> {
  return {
    findRefs: vi.fn<UnitCatalog['findRefs']>(async (ids) => (ids.includes(KG) ? [REF_KG] : [])),
  };
}

function montarPuertoCreate(): Pick<ProductRepository, 'create'> {
  return { create: vi.fn<ProductRepository['create']>(async () => ({ id: 'producto-1' })) };
}

describe('createCreateRawMaterial (QC-159 T3)', () => {
  it('sin inventario.modificar rechaza con UnauthorizedError y no toca el puerto', async () => {
    const products = montarPuertoCreate();
    const createRawMaterial = createCreateRawMaterial({ products, units: montarUnidades(), now: () => AHORA });

    await expect(createRawMaterial({ name: 'Sosa caustica', unitId: KG }, SIN_PERMISO)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(products.create).not.toHaveBeenCalled();
  });

  it('un actor ausente rechaza igual, sin tocar el puerto', async () => {
    const products = montarPuertoCreate();
    const createRawMaterial = createCreateRawMaterial({ products, units: montarUnidades(), now: () => AHORA });

    await expect(createRawMaterial({ name: 'Sosa caustica', unitId: KG }, null)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(products.create).not.toHaveBeenCalled();
  });

  it('una clave de mas rechaza con ValidationError (invalid_input)', async () => {
    const products = montarPuertoCreate();
    const createRawMaterial = createCreateRawMaterial({ products, units: montarUnidades(), now: () => AHORA });

    await expect(
      createRawMaterial({ name: 'Sosa caustica', unitId: KG, type: 'PRODUCT' }, CON_PERMISO),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(products.create).not.toHaveBeenCalled();
  });

  it('un nombre de 201 caracteres rechaza con ValidationError', async () => {
    const products = montarPuertoCreate();
    const createRawMaterial = createCreateRawMaterial({ products, units: montarUnidades(), now: () => AHORA });

    await expect(
      createRawMaterial({ name: 'a'.repeat(201), unitId: KG }, CON_PERMISO),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(products.create).not.toHaveBeenCalled();
  });

  it('un nombre de 200 caracteres SI se acepta (control positivo del limite)', async () => {
    const products = montarPuertoCreate();
    const createRawMaterial = createCreateRawMaterial({ products, units: montarUnidades(), now: () => AHORA });

    await expect(
      createRawMaterial({ name: 'a'.repeat(200), unitId: KG }, CON_PERMISO),
    ).resolves.toEqual({ id: 'producto-1' });
  });

  it('llama a products.create con type PRODUCT, qtyAlert null y el nombre recortado', async () => {
    const products = montarPuertoCreate();
    const createRawMaterial = createCreateRawMaterial({ products, units: montarUnidades(), now: () => AHORA });

    const resultado = await createRawMaterial({ name: '  Sosa caustica  ', unitId: KG }, CON_PERMISO);

    expect(resultado).toEqual({ id: 'producto-1' });
    expect(products.create).toHaveBeenCalledWith(
      { name: 'Sosa caustica', type: PRODUCT_TYPES.PRODUCT, qtyAlert: null, unitId: KG },
      AHORA,
      { companyId: EMPRESA },
    );
  });

  it('R25 guarda la unidad', async () => {
    const products = montarPuertoCreate();
    const units = montarUnidades();
    const createRawMaterial = createCreateRawMaterial({ products, units, now: () => AHORA });

    await createRawMaterial({ name: 'Glicerina', unitId: KG }, CON_PERMISO);

    expect(units.findRefs).toHaveBeenCalledWith([KG], EMPRESA);
    expect(vi.mocked(products.create).mock.calls[0]?.[0]).toMatchObject({ unitId: KG });
  });

  it('R24 unidad de otra empresa da ValidationError', async () => {
    const products = montarPuertoCreate();
    const createRawMaterial = createCreateRawMaterial({ products, units: montarUnidades(), now: () => AHORA });

    await expect(
      createRawMaterial({ name: 'Glicerina', unitId: UNIDAD_OTRA_EMPRESA }, CON_PERMISO),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(products.create).not.toHaveBeenCalled();
  });

  it('R24 sin unidad da ValidationError sin tocar el puerto', async () => {
    const products = montarPuertoCreate();
    const createRawMaterial = createCreateRawMaterial({ products, units: montarUnidades(), now: () => AHORA });

    await expect(createRawMaterial({ name: 'Glicerina' }, CON_PERMISO)).rejects.toBeInstanceOf(ValidationError);
    expect(products.create).not.toHaveBeenCalled();
  });

  it('sin `now` inyectado usa el reloj real (no lanza y produce una fecha)', async () => {
    const products = montarPuertoCreate();
    const createRawMaterial = createCreateRawMaterial({ products, units: montarUnidades() });

    await createRawMaterial({ name: 'Sosa caustica', unitId: KG }, CON_PERMISO);

    const llamada = vi.mocked(products.create).mock.calls[0];
    expect(llamada?.[1]).toBeInstanceOf(Date);
  });
});
