/**
 * Solo los envases sirven al reparto del pedido, contra Postgres real: la consulta del selector y
 * `PackagingCatalog` (`findRefs`, `findCostingBatches`) con un envase, una tapa y un medidor de la
 * misma empresa, todos con existencia y costo.
 *
 * AISLAMIENTO: commit. `listAliveProducts`, `createWithFirstBatch` y el catalogo de envases usan el
 * cliente Prisma global. El caso fabrica su empresa efimera y la limpia en un `finally`.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, describe, expect, it } from 'vitest';

import { normalizeCompanyName } from '@/lib/modules/identity';
import { PACKAGING_SUBTYPES, PRODUCT_TYPES, type PackagingSubtype } from '@/lib/modules/inventario';
import {
  findPackagingCostingBatches,
  findPackagingRefs,
} from '@/lib/modules/inventario/adapters/driven/persistence/packaging-catalog-prisma';
import {
  createWithFirstBatch,
  listAliveProducts,
} from '@/lib/modules/inventario/adapters/driven/persistence/product-prisma';
import { findPackageUnitId } from '@/lib/modules/unidades/adapters/driven/persistence/unit-catalog-prisma';
import { prisma } from '@/lib/shared/db/prisma';
import { MAX_PAGE_SIZE } from '@/lib/shared/pagination';

import type { ListQuery } from '@/lib/modules/inventario/domain/list-query';
import type { NewProductBatch } from '@/lib/modules/inventario/domain/product-batch';

function token(): string {
  return randomUUID().replace(/-/gu, '');
}

afterAll(async () => {
  await prisma.$disconnect();
});

type Seeded = {
  readonly companyId: string;
  readonly litro: string;
  readonly envase: string;
  readonly tapa: string;
  readonly medidor: string;
  readonly marker: string;
};

async function withSeed(body: (seed: Seeded) => Promise<void>): Promise<void> {
  const marker = `solo${token().slice(0, 12)}`;
  const documentType = await prisma.documentType.create({
    data: { code: `DOC${marker.slice(-8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  });
  const role = await prisma.role.create({ data: { name: `rol-${marker}`, description: 'Rol de prueba' }, select: { id: true } });
  const companyName = `Empresa ${marker}`;
  const company = await prisma.company.create({
    data: { name: companyName, nameNormalized: normalizeCompanyName(companyName) },
    select: { id: true },
  });
  const companyId = company.id;
  const scope = { companyId };

  try {
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
        companyId,
      },
      select: { id: true },
    });
    const litro = (await prisma.unit.findFirstOrThrow({ where: { companyId: null, nameNormalized: 'litro' } })).id;
    const u = await findPackageUnitId();
    if (u === null) throw new Error('falta la unidad de sistema de envases');
    const presentationName = `Botella 1 L ${marker}`;
    const p1l = (
      await prisma.presentation.create({
        data: { name: presentationName, nameNormalized: presentationName.toLowerCase(), unitId: litro, companyId, content: '1' },
        select: { id: true },
      })
    ).id;

    const lote: NewProductBatch = {
      presentationId: null,
      stock: '20',
      unitCost: '0.5000',
      lot: null,
      purchaseDate: '2026-09-01',
      expiryDate: null,
      createdBy: user.id,
    };
    const empaque = async (name: string, packagingSubtype: PackagingSubtype, presentationId: string | null) =>
      (
        await createWithFirstBatch(
          { name: `${name} ${marker}`, qtyAlert: '0', type: PRODUCT_TYPES.PACKAGING },
          lote,
          new Date(),
          scope,
          { presentationId, unitId: u, packagingSubtype },
        )
      ).id;

    await body({
      companyId,
      litro,
      marker,
      envase: await empaque('Botella PET 1 L', PACKAGING_SUBTYPES.CONTAINER, p1l),
      tapa: await empaque('Tapa 28 mm', PACKAGING_SUBTYPES.CAP, null),
      medidor: await empaque('Vaso medidor', PACKAGING_SUBTYPES.MEASURER, null),
    });
  } finally {
    await prisma.reservationMovement.deleteMany({ where: { companyId } });
    await prisma.inventoryMovement.deleteMany({ where: { companyId } });
    await prisma.productBatch.deleteMany({ where: { companyId } });
    await prisma.product.deleteMany({ where: { companyId } });
    await prisma.presentation.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } });
    await prisma.role.delete({ where: { id: role.id } });
    await prisma.documentType.delete({ where: { code: documentType.code } });
  }
}

describe('QT-296 — solo los envases sirven al reparto del pedido', () => {
  it('R13 — la consulta del selector (type=PACKAGING, presentationUnitId={l}) devuelve solo el envase', async () => {
    await withSeed(async (seed) => {
      const query: ListQuery = {
        page: 1,
        pageSize: MAX_PAGE_SIZE,
        sort: null,
        search: seed.marker,
        filters: {
          type: { kind: 'select', values: [PRODUCT_TYPES.PACKAGING] },
          presentationUnitId: { kind: 'select', values: [seed.litro] },
        },
      };

      const selector = await listAliveProducts(query, { companyId: seed.companyId });
      expect(selector.items.map((item) => item.id)).toEqual([seed.envase]);
      expect(selector.items[0]?.packagingSubtype).toBe(PACKAGING_SUBTYPES.CONTAINER);

      // Control: sin el filtro por unidad salen los tres empaques, asi que es ese filtro el que deja fuera tapa y medidor.
      const todos = await listAliveProducts({ ...query, filters: { type: query.filters.type! } }, { companyId: seed.companyId });
      expect(new Set(todos.items.map((item) => item.id))).toEqual(new Set([seed.envase, seed.tapa, seed.medidor]));
    });
  });

  it('R14 — findRefs con los ids del envase, la tapa y el medidor devuelve solo el envase', async () => {
    await withSeed(async (seed) => {
      const refs = await findPackagingRefs([seed.envase, seed.tapa, seed.medidor], seed.companyId);

      expect(refs.map((ref) => ref.id)).toEqual([seed.envase]);
      expect(await findPackagingRefs([seed.tapa, seed.medidor], seed.companyId)).toEqual([]);
    });
  });

  it('R14 — findCostingBatches no trae lotes de la tapa ni del medidor, aunque tengan existencia y costo', async () => {
    await withSeed(async (seed) => {
      const batches = await findPackagingCostingBatches([seed.envase, seed.tapa, seed.medidor], seed.companyId);

      expect(batches.map((batch) => batch.productId)).toEqual([seed.envase]);
      expect(await findPackagingCostingBatches([seed.tapa, seed.medidor], seed.companyId)).toEqual([]);
    });
  });
});
