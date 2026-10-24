/**
 * El subtipo de empaque no abre ninguna puerta entre empresas, contra Postgres real (R40): el
 * homonimo de otra empresa no choca en el alta ni en el Excel, el filtro por subtipo no ve lo
 * ajeno y una tapa ajena en el reparto es un envase inexistente.
 *
 * AISLAMIENTO: commit. El alta (`createWithFirstBatch`, `addBatchToAlive`), la importacion, el
 * listado y el catalogo de envases usan el cliente Prisma global y el alta abre su propia
 * transaccion. Cada caso fabrica dos empresas efimeras y las limpia en un `finally`.
 */
import { afterAll, describe, expect, it } from 'vitest';

import { PACKAGING_SUBTYPES, PRODUCT_TYPES, type PackagingSubtype } from '@/lib/modules/inventario';
import {
  findPackagingCostingBatches,
  findPackagingRefs,
} from '@/lib/modules/inventario/adapters/driven/persistence/packaging-catalog-prisma';
import {
  findPresentationRefs,
  findPresentationsByNormalizedNames,
} from '@/lib/modules/inventario/adapters/driven/persistence/presentation-catalog-prisma';
import { createWithFirstBatch, listAliveProducts } from '@/lib/modules/inventario/adapters/driven/persistence/product-prisma';
import { ActionNotAllowedError } from '@/lib/modules/inventario/domain/errors';
import { resolveDistributionLines } from '@/lib/modules/pedidos/domain/resolve-distribution';
import {
  findMassVolumeBridge,
  findPackageUnitId,
  findUnitRefs,
} from '@/lib/modules/unidades/adapters/driven/persistence/unit-catalog-prisma';
import { findUnitRefsSharingBaseInCompany } from '@/lib/modules/unidades/adapters/driven/persistence/unit-prisma';
import { prisma } from '@/lib/shared/db/prisma';
import { MAX_PAGE_SIZE } from '@/lib/shared/pagination';

import { borrarEmpresa, sembrarEmpresa, sembrarPresentacion, sembrarUnidad, token } from './inventory-import-fixture';
import { actorOf, csvFile, wireImport } from './inventory-import-wiring';

import type { Empresa } from './inventory-import-fixture';
import type { ImportCells, InventoryImportResult } from '@/lib/modules/inventario';
import type { ListQuery } from '@/lib/modules/inventario/domain/list-query';
import type { DistributionCatalogs } from '@/lib/modules/pedidos/domain/resolve-distribution';

afterAll(async () => {
  await prisma.$disconnect();
});

type Pareja = {
  /** La empresa que actua. */
  readonly propia: Empresa;
  /** La otra: lo suyo tiene que seguir siendo inexistente para la propia. */
  readonly ajena: Empresa;
};

async function conDosEmpresas(body: (pareja: Pareja) => Promise<void>): Promise<void> {
  const propia = await sembrarEmpresa();
  const ajena = await sembrarEmpresa();
  try {
    await body({ propia, ajena });
  } finally {
    // La ajena primero: su presentacion puede usar una unidad sembrada a cuenta de la propia.
    await borrarEmpresa(ajena);
    await borrarEmpresa(propia);
  }
}

/** Un empaque con su primer lote por el adaptador real. Solo el envase lleva presentacion. */
async function sembrarEmpaque(
  empresa: Empresa,
  name: string,
  packagingSubtype: PackagingSubtype,
  presentationId: string | null = null,
): Promise<string> {
  const unitId = await findPackageUnitId();
  if (unitId === null) throw new Error('falta la unidad de sistema de envases');
  const created = await createWithFirstBatch(
    { name, qtyAlert: '0', type: PRODUCT_TYPES.PACKAGING },
    {
      presentationId: null,
      stock: '100',
      unitCost: '0.2000',
      lot: null,
      purchaseDate: '2026-09-01',
      expiryDate: null,
      createdBy: empresa.userId,
    },
    new Date(),
    { companyId: empresa.companyId },
    { presentationId, unitId, packagingSubtype },
  );
  return created.id;
}

async function filasDe(empresa: Empresa) {
  return {
    productos: await prisma.product.count({ where: { companyId: empresa.companyId } }),
    lotes: await prisma.productBatch.count({ where: { companyId: empresa.companyId } }),
    asientos: await prisma.inventoryMovement.count({ where: { companyId: empresa.companyId } }),
  };
}

const catalogos: DistributionCatalogs = {
  packaging: { findRefs: findPackagingRefs, findCostingBatches: findPackagingCostingBatches },
  presentations: { findRefs: findPresentationRefs, findByNormalizedNames: findPresentationsByNormalizedNames },
  units: {
    findRefs: findUnitRefs,
    listVisibleRefs: () => Promise.reject(new Error('no se usa')),
    findMassVolumeBridge: () => findMassVolumeBridge(),
    findRefsSharingBaseInCompany: findUnitRefsSharingBaseInCompany,
  },
};

describe('QT-296 — el subtipo de empaque respeta el ambito de empresa', () => {
  it('R40 — un empaque de otra empresa con el mismo nombre y otro subtipo no da action_not_allowed en el alta', async () => {
    await conDosEmpresas(async ({ propia, ajena }) => {
      const nombre = `Gatillo ${token().slice(0, 12)}`;
      const tapaAjena = await sembrarEmpaque(ajena, nombre, PACKAGING_SUBTYPES.CAP);
      const ajenaAntes = await filasDe(ajena);
      const { manualCreate } = wireImport();
      const actor = actorOf(propia);

      const creado = await manualCreate(
        {
          name: nombre,
          type: PRODUCT_TYPES.PACKAGING,
          packagingSubtype: PACKAGING_SUBTYPES.MEASURER,
          qtyAlert: '0',
          stock: '10',
          unitCost: '0.3000',
        },
        actor,
      );

      expect(creado.id).not.toBe(tapaAjena);
      expect(
        await prisma.product.findUniqueOrThrow({
          where: { id: creado.id },
          select: { companyId: true, packagingSubtype: true },
        }),
      ).toEqual({ companyId: propia.companyId, packagingSubtype: PACKAGING_SUBTYPES.MEASURER });
      expect(await filasDe(ajena)).toEqual(ajenaAntes);

      // Control: el mismo homonimo con otro subtipo DENTRO de la propia empresa si se rechaza,
      // asi que lo que deja pasar el alta de arriba es el ambito, no un cableado que no compara.
      await expect(
        manualCreate(
          {
            name: nombre,
            type: PRODUCT_TYPES.PACKAGING,
            packagingSubtype: PACKAGING_SUBTYPES.CAP,
            qtyAlert: '0',
            stock: '5',
            unitCost: '0.3000',
          },
          actor,
        ),
      ).rejects.toBeInstanceOf(ActionNotAllowedError);
    });
  });

  it('R40 — un empaque de otra empresa con el mismo nombre y otro subtipo no da subtype_mismatch en el Excel', async () => {
    await conDosEmpresas(async ({ propia, ajena }) => {
      const marca = token().slice(0, 12);
      const ajeno = `Valvula ${marca}`;
      const propio = `Atomizador ${marca}`;
      await sembrarEmpaque(ajena, ajeno, PACKAGING_SUBTYPES.CAP);
      await sembrarEmpaque(propia, propio, PACKAGING_SUBTYPES.CAP);
      const ajenaAntes = await filasDe(ajena);
      const actor = actorOf(propia);
      const filas: Partial<ImportCells>[] = [
        { type: 'Empaque', subtype: 'medidor', name: ajeno, stock: '20', unitCost: '0,2', qtyAlert: '2' },
        // Control: el homonimo propio con otro subtipo si choca, en el mismo archivo y la misma corrida.
        { type: 'Empaque', subtype: 'medidor', name: propio, stock: '20', unitCost: '0,2', qtyAlert: '2' },
      ];
      const { preview, confirm } = wireImport();

      const vista = await preview(csvFile(filas), actor);
      const outcome = await confirm({ ...csvFile(filas), importKey: crypto.randomUUID() }, actor);

      expect(vista.kind).toBe('preview');
      const filasVista = vista.kind === 'preview' ? vista.rows : [];
      expect(filasVista.map((row) => row.status)).toEqual(['create', 'error']);
      expect(JSON.stringify(filasVista[0])).not.toContain('subtype_mismatch');
      expect(JSON.stringify(filasVista[1])).toContain('subtype_mismatch');

      const result = outcome as InventoryImportResult;
      expect(result.rows.map((row) => [row.status, row.packagingSubtype])).toEqual([
        ['created', PACKAGING_SUBTYPES.MEASURER],
        ['error', PACKAGING_SUBTYPES.MEASURER],
      ]);
      const creados = await prisma.product.findMany({
        where: { nameNormalized: { contains: marca.toLowerCase() } },
        select: { companyId: true, name: true, packagingSubtype: true },
        orderBy: [{ name: 'asc' }, { companyId: 'asc' }],
      });
      expect(creados).toEqual(
        expect.arrayContaining([
          { companyId: propia.companyId, name: ajeno, packagingSubtype: PACKAGING_SUBTYPES.MEASURER },
          { companyId: ajena.companyId, name: ajeno, packagingSubtype: PACKAGING_SUBTYPES.CAP },
          { companyId: propia.companyId, name: propio, packagingSubtype: PACKAGING_SUBTYPES.CAP },
        ]),
      );
      expect(creados).toHaveLength(3);
      expect(await filasDe(ajena)).toEqual(ajenaAntes);
    });
  });

  it('R40 — el filtro por subtipo no devuelve productos de otra empresa', async () => {
    await conDosEmpresas(async ({ propia, ajena }) => {
      const marca = `ambito${token().slice(0, 12)}`;
      const tapaPropia = await sembrarEmpaque(propia, `Tapa 28 ${marca}`, PACKAGING_SUBTYPES.CAP);
      const tapaAjena = await sembrarEmpaque(ajena, `Tapa 28 ${marca}`, PACKAGING_SUBTYPES.CAP);
      await sembrarEmpaque(ajena, `Tapa 38 ${marca}`, PACKAGING_SUBTYPES.CAP);
      const query: ListQuery = {
        page: 1,
        pageSize: MAX_PAGE_SIZE,
        sort: null,
        search: marca,
        filters: { packagingSubtype: { kind: 'select', values: [PACKAGING_SUBTYPES.CAP] } },
      };

      const propias = await listAliveProducts(query, { companyId: propia.companyId });
      expect(propias.items.map((item) => item.id)).toEqual([tapaPropia]);
      expect(propias.total).toBe(1);

      // Control: la misma consulta desde la otra empresa ve solo lo suyo, asi que hay algo ajeno que dejar fuera.
      const ajenas = await listAliveProducts(query, { companyId: ajena.companyId });
      expect(ajenas.items.map((item) => item.id)).toContain(tapaAjena);
      expect(ajenas.items.map((item) => item.id)).not.toContain(tapaPropia);
      expect(ajenas.total).toBe(2);
    });
  });

  it('R40 — el id de una tapa de otra empresa en el reparto da packaging_not_found', async () => {
    await conDosEmpresas(async ({ propia, ajena }) => {
      const unidad = await sembrarUnidad(propia);
      const marca = token().slice(0, 12);
      const presentacionPropia = await sembrarPresentacion(propia, unidad, { name: `Botella ${marca}` });
      const presentacionAjena = await sembrarPresentacion(ajena, unidad, { name: `Botella ajena ${marca}` });
      const envasePropio = await sembrarEmpaque(propia, `Botella PET ${marca}`, PACKAGING_SUBTYPES.CONTAINER, presentacionPropia);
      const envaseAjeno = await sembrarEmpaque(ajena, `Botella PET ${marca}`, PACKAGING_SUBTYPES.CONTAINER, presentacionAjena);
      const tapaAjena = await sembrarEmpaque(ajena, `Tapa ${marca}`, PACKAGING_SUBTYPES.CAP);

      const conTapaAjena = await resolveDistributionLines(catalogos, propia.companyId, unidad, [
        { packagingProductId: tapaAjena, packages: 1 },
      ]);
      expect(conTapaAjena).toEqual({ kind: 'packaging_not_found', packagingProductId: tapaAjena });

      // Tambien junto a un envase propio valido: la tapa ajena no se cuela por ir acompanada.
      expect(
        await resolveDistributionLines(catalogos, propia.companyId, unidad, [
          { packagingProductId: envasePropio, packages: 1 },
          { packagingProductId: tapaAjena, packages: 1 },
        ]),
      ).toEqual({ kind: 'packaging_not_found', packagingProductId: tapaAjena });

      // Controles: el envase ajeno tampoco existe para la propia (es el ambito, no solo el
      // subtipo), y el envase propio si se resuelve (el cableado funciona).
      expect(
        await resolveDistributionLines(catalogos, propia.companyId, unidad, [{ packagingProductId: envaseAjeno, packages: 1 }]),
      ).toEqual({ kind: 'packaging_not_found', packagingProductId: envaseAjeno });
      const propio = await resolveDistributionLines(catalogos, propia.companyId, unidad, [
        { packagingProductId: envasePropio, packages: 1 },
      ]);
      expect(propio.kind).toBe('resolved');
      expect(await findPackagingRefs([tapaAjena, envaseAjeno], propia.companyId)).toEqual([]);
    });
  });
});
