/**
 * El alta de un empaque con subtipo contra Postgres real: tapa sin presentacion en la unidad de
 * envases, empaque sin subtipo como envase, y homonimo con otro subtipo sin escribir nada.
 *
 * AISLAMIENTO: commit. `createWithFirstBatch` y `addBatchToAlive` usan el cliente Prisma global y
 * abren su propia transaccion. Cada caso fabrica su empresa efimera y la limpia en un `finally`.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, describe, expect, it } from 'vitest';

import { normalizeCompanyName } from '@/lib/modules/identity';
import { PACKAGING_SUBTYPES, PRODUCT_TYPES } from '@/lib/modules/inventario';
import {
  addBatchToAlive,
  adjustBatchStock,
  createProduct,
  createWithFirstBatch,
  findAliveIdByNameInPresentationUnit,
  findAliveIdByNameInUnit,
  findAlivePackagingByName,
  findAliveProductById,
  findBatchesOfAliveProduct,
  listAliveProducts,
  softDeleteAliveProduct,
  updateAliveProduct,
} from '@/lib/modules/inventario/adapters/driven/persistence/product-prisma';
import { findBatchMovements } from '@/lib/modules/inventario/adapters/driven/persistence/batch-movement-prisma';
import { findPackageUnitId } from '@/lib/modules/unidades/adapters/driven/persistence/unit-catalog-prisma';
import { createCreateProduct } from '@/lib/modules/inventario/domain/create-product';
import { ActionNotAllowedError } from '@/lib/modules/inventario/domain/errors';
import { prisma } from '@/lib/shared/db/prisma';

import type { Actor } from '@/lib/modules/inventario/domain/actor';
import type { ProductRepository } from '@/lib/modules/inventario/ports/product-repository';

const repositorio: ProductRepository = {
  create: createProduct,
  findAliveById: findAliveProductById,
  updateAlive: updateAliveProduct,
  softDeleteAlive: softDeleteAliveProduct,
  listAlive: listAliveProducts,
  findAliveIdByNameInPresentationUnit,
  findAliveIdByNameInUnit,
  findAlivePackagingByName,
  createWithFirstBatch,
  addBatchToAlive,
  adjustBatchStock,
  findBatchesOfAliveProduct,
  findBatchMovements,
};

const altaDeProducto = createCreateProduct({ products: repositorio, packageUnit: { findPackageUnitId } });

function token(): string {
  return randomUUID().replace(/-/gu, '');
}

type Fixture = {
  readonly actor: Actor;
  readonly companyId: string;
  readonly roleId: string;
  readonly documentTypeCode: string;
  readonly p500: string;
};

async function createFixture(): Promise<Fixture> {
  const marker = token();
  const documentType = await prisma.documentType.create({
    data: { code: `DOC${marker.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  });
  const role = await prisma.role.create({ data: { name: `rol-${marker}`, description: 'Rol de prueba' }, select: { id: true } });
  const companyName = `Empresa empaques ${marker}`;
  const company = await prisma.company.create({
    data: { name: companyName, nameNormalized: normalizeCompanyName(companyName) },
    select: { id: true },
  });
  const user = await prisma.user.create({
    data: {
      firstNames: 'Ana Maria',
      lastNames: 'Perez Gomez',
      birthDate: new Date('1990-05-17T00:00:00.000Z'),
      email: `ana.${marker}@quimicloude.test`,
      phone: '+57 300 111 2233',
      documentTypeCode: documentType.code,
      documentNumber: marker.slice(0, 12),
      username: `ana.${marker}`,
      passwordHash: 'hash-de-prueba-no-es-un-algoritmo-real',
      roleId: role.id,
      companyId: company.id,
    },
    select: { id: true },
  });
  const ml = (await prisma.unit.findFirstOrThrow({ where: { companyId: null, nameNormalized: 'mililitro' } })).id;
  const presentationName = `Botella ${token()}`;
  const presentation = await prisma.presentation.create({
    data: {
      name: presentationName,
      nameNormalized: presentationName.toLowerCase(),
      unitId: ml,
      companyId: company.id,
      content: '500',
    },
    select: { id: true },
  });
  return {
    actor: { id: user.id, companyId: company.id, permissions: ['inventario.consultar', 'inventario.modificar'] },
    companyId: company.id,
    roleId: role.id,
    documentTypeCode: documentType.code,
    p500: presentation.id,
  };
}

async function dropFixture(f: Fixture): Promise<void> {
  await prisma.inventoryMovement.deleteMany({ where: { companyId: f.companyId } });
  await prisma.productBatch.deleteMany({ where: { companyId: f.companyId } });
  await prisma.product.deleteMany({ where: { companyId: f.companyId } });
  await prisma.presentation.deleteMany({ where: { companyId: f.companyId } });
  await prisma.user.deleteMany({ where: { companyId: f.companyId } });
  await prisma.company.delete({ where: { id: f.companyId } });
  await prisma.role.delete({ where: { id: f.roleId } });
  await prisma.documentType.delete({ where: { code: f.documentTypeCode } });
}

async function packageUnitId(): Promise<string> {
  const id = await findPackageUnitId();
  if (id === null) throw new Error('falta la unidad de sistema de envases');
  return id;
}

async function productRow(id: string) {
  return prisma.product.findUniqueOrThrow({
    where: { id },
    select: { presentationId: true, unitId: true, stock: true, type: true, packagingSubtype: true },
  });
}

async function batchesOf(productId: string) {
  return prisma.productBatch.findMany({
    where: { productId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { presentationId: true, stock: true },
  });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('QT-296 — alta de empaque con subtipo contra la base', () => {
  it('R7 — una tapa queda con subtipo CAP, sin presentacion, en la unidad de envases y con un lote sin presentacion', async () => {
    const f = await createFixture();
    try {
      const { id } = await altaDeProducto(
        {
          name: `Tapa rosca ${token()}`,
          type: PRODUCT_TYPES.PACKAGING,
          packagingSubtype: PACKAGING_SUBTYPES.CAP,
          qtyAlert: '0',
          stock: '200',
          unitCost: '0.1000',
        },
        f.actor,
      );
      const row = await productRow(id);
      expect(row).toEqual(
        expect.objectContaining({
          type: PRODUCT_TYPES.PACKAGING,
          packagingSubtype: PACKAGING_SUBTYPES.CAP,
          presentationId: null,
          unitId: await packageUnitId(),
        }),
      );
      expect(row.stock.toFixed(4)).toBe('200.0000');
      expect((await batchesOf(id)).map((b) => [b.presentationId, b.stock.toFixed(4)])).toEqual([[null, '200.0000']]);
    } finally {
      await dropFixture(f);
    }
  });

  it('R5 — un empaque dado de alta sin subtipo queda como envase, con su presentacion', async () => {
    const f = await createFixture();
    try {
      const { id } = await altaDeProducto(
        {
          name: `Botella PET ${token()}`,
          type: PRODUCT_TYPES.PACKAGING,
          qtyAlert: '0',
          presentationId: f.p500,
          stock: '10',
          unitCost: '0.5000',
        },
        f.actor,
      );
      expect(await productRow(id)).toEqual(
        expect.objectContaining({ packagingSubtype: PACKAGING_SUBTYPES.CONTAINER, presentationId: f.p500 }),
      );
    } finally {
      await dropFixture(f);
    }
  });

  it('R9 — un homonimo con otro subtipo se rechaza sin escribir ninguna fila; con el mismo subtipo suma un lote', async () => {
    const f = await createFixture();
    try {
      const name = `Gatillo ${token()}`;
      const tapa = {
        name,
        type: PRODUCT_TYPES.PACKAGING,
        packagingSubtype: PACKAGING_SUBTYPES.CAP,
        qtyAlert: '0',
        stock: '50',
        unitCost: '0.2000',
      };
      const first = await altaDeProducto(tapa, f.actor);
      const filas = async () => ({
        productos: await prisma.product.count({ where: { companyId: f.companyId } }),
        lotes: await prisma.productBatch.count({ where: { companyId: f.companyId } }),
        asientos: await prisma.inventoryMovement.count({ where: { companyId: f.companyId } }),
      });
      const antes = await filas();

      await expect(
        altaDeProducto({ ...tapa, packagingSubtype: PACKAGING_SUBTYPES.MEASURER }, f.actor),
      ).rejects.toBeInstanceOf(ActionNotAllowedError);
      await expect(
        altaDeProducto({ ...tapa, packagingSubtype: PACKAGING_SUBTYPES.CONTAINER, presentationId: f.p500 }, f.actor),
      ).rejects.toBeInstanceOf(ActionNotAllowedError);
      expect(await filas()).toEqual(antes);

      const second = await altaDeProducto({ ...tapa, stock: '30' }, f.actor);
      expect(second.id).toBe(first.id);
      expect((await batchesOf(first.id)).map((b) => [b.presentationId, b.stock.toFixed(4)])).toEqual([
        [null, '50.0000'],
        [null, '30.0000'],
      ]);
      expect((await productRow(first.id)).stock.toFixed(4)).toBe('80.0000');
    } finally {
      await dropFixture(f);
    }
  });
});
