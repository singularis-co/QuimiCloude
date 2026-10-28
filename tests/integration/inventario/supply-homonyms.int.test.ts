/**
 * Homonimos de un alta de insumo contra Postgres real: la lectura `findAliveSupplyHomonyms` y el
 * alta convertida por el caso de uso cableado en `lib/composition`.
 *
 * AISLAMIENTO: el adaptador usa el cliente Prisma GLOBAL, asi que lo sembrado queda confirmado.
 * Cada caso crea su empresa efimera y la borra en un `finally`.
 */
import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { inventario } from '@/lib/composition';
import { normalizeCompanyName } from '@/lib/modules/identity';
import { PRODUCT_TYPES, normalizeProductName, type Actor } from '@/lib/modules/inventario';
import {
  createWithFirstBatch,
  findAliveSupplyHomonyms,
} from '@/lib/modules/inventario/adapters/driven/persistence/product-prisma';
import { prisma } from '@/lib/shared/db/prisma';

import type { InventoryScope } from '@/lib/modules/inventario/domain/inventory-scope';
import type { NewProductBatch } from '@/lib/modules/inventario/domain/product-batch';

function token(): string {
  return randomUUID().replace(/-/gu, '');
}

type Fixture = {
  readonly companyId: string;
  readonly actorId: string;
  readonly roleId: string;
  readonly documentTypeCode: string;
  readonly mlId: string;
  readonly lId: string;
};

async function createFixture(): Promise<Fixture> {
  const marca = token();
  const documentType = await prisma.documentType.create({
    data: { code: `DOC${marca.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  });
  const role = await prisma.role.create({
    data: { name: `rol-${marca}`, description: 'Rol de prueba' },
    select: { id: true },
  });
  const companyName = `Empresa ${marca}`;
  const company = await prisma.company.create({
    data: { name: companyName, nameNormalized: normalizeCompanyName(companyName) },
    select: { id: true },
  });
  const user = await prisma.user.create({
    data: {
      firstNames: 'Ana Maria',
      lastNames: 'Perez Gomez',
      birthDate: new Date('1990-05-17T00:00:00.000Z'),
      email: `ana.${marca}@quimicloude.test`,
      phone: '+57 300 111 2233',
      documentTypeCode: documentType.code,
      documentNumber: marca.slice(0, 12),
      username: `ana.${marca}`,
      passwordHash: 'hash-de-prueba-no-es-un-algoritmo-real',
      roleId: role.id,
      companyId: company.id,
    },
    select: { id: true },
  });
  const systemUnit = (nameNormalized: string) =>
    prisma.unit.findFirstOrThrow({ where: { companyId: null, nameNormalized }, select: { id: true } });
  const ml = await systemUnit('mililitro');
  const l = await systemUnit('litro');
  return {
    companyId: company.id,
    actorId: user.id,
    roleId: role.id,
    documentTypeCode: documentType.code,
    mlId: ml.id,
    lId: l.id,
  };
}

async function dropFixture(fixture: Fixture): Promise<void> {
  const { companyId } = fixture;
  await prisma.inventoryMovement.deleteMany({ where: { companyId } });
  await prisma.productBatch.deleteMany({ where: { companyId } });
  await prisma.product.deleteMany({ where: { companyId } });
  await prisma.user.delete({ where: { id: fixture.actorId } });
  await prisma.role.delete({ where: { id: fixture.roleId } });
  await prisma.documentType.delete({ where: { code: fixture.documentTypeCode } });
  await prisma.company.delete({ where: { id: companyId } });
}

async function withFixture(body: (fixture: Fixture) => Promise<void>): Promise<void> {
  const fixture = await createFixture();
  try {
    await body(fixture);
  } finally {
    await dropFixture(fixture);
  }
}

function scopeOf(fixture: Fixture): InventoryScope {
  return { companyId: fixture.companyId };
}

function batchOf(fixture: Fixture, stock: string): NewProductBatch {
  return {
    presentationId: null,
    stock,
    unitCost: '2.5000',
    lot: null,
    purchaseDate: '2026-10-01',
    expiryDate: null,
    createdBy: fixture.actorId,
  };
}

async function seedSupply(
  fixture: Fixture,
  name: string,
  unitId: string,
  stock: string,
  createdAt: Date,
): Promise<string> {
  const created = await createWithFirstBatch(
    { name, qtyAlert: '1', type: PRODUCT_TYPES.PRODUCT, unitId },
    batchOf(fixture, stock),
    createdAt,
    scopeOf(fixture),
  );
  return created.id;
}

describe('QC-203 — findAliveSupplyHomonyms', () => {
  it('R1 devuelve los vivos con unidad del mismo nombre normalizado, en orden de antigüedad, con su existencia', async () => {
    await withFixture(async (fixture) => {
      const name = `Glicerina ${token()}`;
      const nuevo = await seedSupply(fixture, name, fixture.mlId, '100', new Date('2026-10-02T00:00:00.000Z'));
      const antiguo = await seedSupply(fixture, name, fixture.lId, '2.5', new Date('2026-10-01T00:00:00.000Z'));
      await seedSupply(fixture, `Otro ${token()}`, fixture.lId, '1', new Date('2026-10-01T00:00:00.000Z'));

      const homonimos = await findAliveSupplyHomonyms(`  ${name.toUpperCase()} `, scopeOf(fixture));

      expect(homonimos).toEqual([
        { id: antiguo, name, type: PRODUCT_TYPES.PRODUCT, unitId: fixture.lId, stock: '2.5000' },
        { id: nuevo, name, type: PRODUCT_TYPES.PRODUCT, unitId: fixture.mlId, stock: '100.0000' },
      ]);
    });
  });

  it('R1 no devuelve los dados de baja ni los sin unidad', async () => {
    await withFixture(async (fixture) => {
      const name = `Glicerina ${token()}`;
      const vivo = await seedSupply(fixture, name, fixture.lId, '1', new Date('2026-10-01T00:00:00.000Z'));
      const borrado = await seedSupply(fixture, name, fixture.lId, '9', new Date('2026-10-02T00:00:00.000Z'));
      await prisma.product.update({ where: { id: borrado }, data: { deletedAt: new Date() } });
      await prisma.product.create({
        data: {
          name,
          nameNormalized: normalizeProductName(name),
          type: 'PRODUCT',
          companyId: fixture.companyId,
        },
      });

      const homonimos = await findAliveSupplyHomonyms(name, scopeOf(fixture));

      expect(homonimos.map((homonimo) => homonimo.id)).toEqual([vivo]);
    });
  });

  it('R12 no devuelve el homónimo de otra empresa', async () => {
    await withFixture(async (fixture) => {
      await withFixture(async (otra) => {
        const name = `Glicerina ${token()}`;
        const propio = await seedSupply(fixture, name, fixture.lId, '1', new Date('2026-10-01T00:00:00.000Z'));
        await seedSupply(otra, name, otra.lId, '50', new Date('2026-09-01T00:00:00.000Z'));

        const homonimos = await findAliveSupplyHomonyms(name, scopeOf(fixture));

        expect(homonimos.map((homonimo) => homonimo.id)).toEqual([propio]);
      });
    });
  });
});

describe('QC-203 — alta convertida por el caso de uso cableado', () => {
  it('R29 tras el alta convertida el otro homónimo conserva unidad, existencia y lotes', async () => {
    await withFixture(async (fixture) => {
      const name = `Glicerina ${token()}`;
      // 2 l = 2000 ml contra 100 ml: el destino es el de litros.
      const enMl = await seedSupply(fixture, name, fixture.mlId, '100', new Date('2026-10-01T00:00:00.000Z'));
      const enL = await seedSupply(fixture, name, fixture.lId, '2', new Date('2026-10-02T00:00:00.000Z'));
      const lotesDeMlAntes = await prisma.productBatch.findMany({
        where: { productId: enMl },
        select: { id: true, stock: true, unitCost: true },
      });
      const actor: Actor = { id: fixture.actorId, companyId: fixture.companyId, permissions: ['inventario.modificar'] };

      const resultado = await inventario.createProduct(
        { name, type: PRODUCT_TYPES.PRODUCT, stock: '500', qtyAlert: '1', unitId: fixture.mlId, unitCost: '0.004' },
        actor,
      );

      expect(resultado).toMatchObject({
        id: enL,
        conversion: { productName: name, stock: '0.5', unitId: fixture.lId },
      });

      const destino = await prisma.product.findUniqueOrThrow({ where: { id: enL }, select: { unitId: true, stock: true } });
      expect(destino.unitId).toBe(fixture.lId);
      expect(destino.stock.toFixed(4)).toBe('2.5000');
      const lotesDestino = await prisma.productBatch.findMany({
        where: { productId: enL },
        orderBy: { createdAt: 'asc' },
        select: { stock: true, unitCost: true },
      });
      expect(lotesDestino.map((lote) => [lote.stock.toFixed(4), lote.unitCost?.toFixed(4)])).toEqual([
        ['2.0000', '2.5000'],
        ['0.5000', '4.0000'],
      ]);

      const partido = await prisma.product.findUniqueOrThrow({
        where: { id: enMl },
        select: { unitId: true, stock: true, deletedAt: true },
      });
      expect(partido.unitId).toBe(fixture.mlId);
      expect(partido.stock.toFixed(4)).toBe('100.0000');
      expect(partido.deletedAt).toBeNull();
      const lotesDeMlDespues = await prisma.productBatch.findMany({
        where: { productId: enMl },
        select: { id: true, stock: true, unitCost: true },
      });
      expect(lotesDeMlDespues).toEqual(lotesDeMlAntes);

      expect(
        await prisma.product.count({ where: { companyId: fixture.companyId, nameNormalized: normalizeProductName(name) } }),
      ).toBe(2);
    });
  });
});
