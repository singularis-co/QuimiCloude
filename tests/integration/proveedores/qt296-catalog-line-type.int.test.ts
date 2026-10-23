/**
 * Tipo y subtipo de empaque de la linea de catalogo contra Postgres real: el enum
 * `CatalogLineType`, el CHECK del subtipo y que la migracion deja intactas las lineas que ya hay.
 *
 * AISLAMIENTO: cada `it` corre en una transaccion interactiva que termina en `RollbackSignal`. Lo
 * que se espera que falle va dentro de un SAVEPOINT. El `down.sql` y el `migration.sql` reales se
 * aplican dentro de la transaccion; Postgres deshace tambien ese DDL. Las lineas se siembran con
 * SQL crudo: con las columnas quitadas, el cliente generado las nombraria.
 */
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Prisma } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import { normalizeCompanyName } from '@/lib/modules/identity';
import { normalizeSupplierName } from '@/lib/modules/proveedores';
import { prisma } from '@/lib/shared/db/prisma';

class RollbackSignal extends Error {
  constructor() {
    super('rollback de aislamiento del test');
    this.name = 'RollbackSignal';
  }
}

async function inRolledBackTransaction(body: (tx: Prisma.TransactionClient) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await body(tx);
        throw new RollbackSignal();
      },
      { maxWait: 20_000, timeout: 60_000 },
    );
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error;
  }
}

let savepointSeq = 0;

async function expectRejected(tx: Prisma.TransactionClient, run: () => Promise<unknown>): Promise<string> {
  savepointSeq += 1;
  const savepoint = `qt296_line_sp_${String(savepointSeq)}`;
  await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
  try {
    await run();
  } catch (error) {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    const meta: unknown = error instanceof Prisma.PrismaClientKnownRequestError ? error.meta : undefined;
    const code =
      typeof meta === 'object' && meta !== null && 'code' in meta ? String((meta as { code: unknown }).code) : '';
    return `${code}\n${error instanceof Error ? error.message : String(error)}`;
  }
  throw new Error('se esperaba un rechazo de la base y no lo hubo');
}

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    try {
      readFileSync(join(dir, 'package.json'));
      return dir;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) throw new Error(`no se encontro package.json subiendo desde ${startDir}`);
      dir = parent;
    }
  }
}

const migrationsDir = join(findRepoRoot(dirname(fileURLToPath(import.meta.url))), 'db', 'migrations');
const migrationDir = join(
  migrationsDir,
  readdirSync(migrationsDir).find((name) => name.endsWith('_packaging_subtype')) ?? 'missing',
);

function statementsOf(sql: string): readonly string[] {
  return sql
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

const UP = statementsOf(readFileSync(join(migrationDir, 'migration.sql'), 'utf8'));
const DOWN = statementsOf(readFileSync(join(migrationDir, 'down.sql'), 'utf8'));

async function apply(tx: Prisma.TransactionClient, statements: readonly string[]): Promise<void> {
  for (const statement of statements) await tx.$executeRawUnsafe(statement);
}

function token(): string {
  return randomUUID().replace(/-/gu, '');
}

type Fixture = { readonly companyId: string; readonly supplierId: string; readonly presentationId: string };

async function seed(tx: Prisma.TransactionClient): Promise<Fixture> {
  const companyName = `Empresa catalogo ${token()}`;
  const company = await tx.company.create({
    data: { name: companyName, nameNormalized: normalizeCompanyName(companyName) },
    select: { id: true },
  });
  const supplierName = `Proveedor ${token()}`;
  const supplier = await tx.supplier.create({
    data: {
      name: supplierName,
      nameNormalized: normalizeSupplierName(supplierName),
      phone: '+57 300 000 0000',
      companyId: company.id,
    },
    select: { id: true },
  });
  const kg = await tx.unit.findFirstOrThrow({ where: { companyId: null, nameNormalized: 'kilogramo' }, select: { id: true } });
  const presentationName = `Bidon ${token()}`;
  const presentation = await tx.presentation.create({
    data: { name: presentationName, nameNormalized: presentationName.toLowerCase(), unitId: kg.id, companyId: company.id },
    select: { id: true },
  });
  return { companyId: company.id, supplierId: supplier.id, presentationId: presentation.id };
}

/** Linea sin tipo ni subtipo: vale con las columnas y sin ellas. */
async function insertPlainLine(tx: Prisma.TransactionClient, f: Fixture, deleted: boolean): Promise<string> {
  const id = randomUUID();
  const name = `Linea ${token()}`;
  await tx.$executeRaw`
    INSERT INTO "supplier_catalog_lines"
      ("id", "supplier_id", "company_id", "name", "name_normalized", "presentation_id", "cost",
       "min_purchase", "delivery_time", "material", "measurements", "deleted_at", "updated_at")
    VALUES (
      CAST(${id} AS uuid), CAST(${f.supplierId} AS uuid), CAST(${f.companyId} AS uuid), ${name},
      ${normalizeSupplierName(name)}, CAST(${f.presentationId} AS uuid), 12.5000, 3, 5, 'Polietileno',
      CAST(${JSON.stringify({ diameter: { value: '7.5000', unit: 'cm' }, height: null, mouth: null })} AS jsonb),
      CASE WHEN ${deleted} THEN TIMESTAMPTZ '2026-10-01 10:00:00+00' ELSE NULL END,
      TIMESTAMPTZ '2026-10-02 10:00:00+00')`;
  return id;
}

async function insertClassifiedLine(
  tx: Prisma.TransactionClient,
  f: Fixture,
  type: string | null,
  packagingSubtype: string | null,
): Promise<string> {
  const id = randomUUID();
  const name = `Linea ${token()}`;
  await tx.$executeRaw`
    INSERT INTO "supplier_catalog_lines"
      ("id", "supplier_id", "company_id", "name", "name_normalized", "presentation_id", "cost",
       "type", "packaging_subtype", "updated_at")
    VALUES (
      CAST(${id} AS uuid), CAST(${f.supplierId} AS uuid), CAST(${f.companyId} AS uuid), ${name},
      ${normalizeSupplierName(name)}, CAST(${f.presentationId} AS uuid), 10.0000,
      CAST(${type} AS "CatalogLineType"), CAST(${packagingSubtype} AS "PackagingSubtype"), now())`;
  return id;
}

const CHECK_VIOLATION = '23514';
const INVALID_ENUM_VALUE = '22P02';
const SUBTYPE_CHECK = 'supplier_catalog_lines_packaging_subtype_matches_type';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('QT-296 — tipo y subtipo de la linea de catalogo, contra Postgres real', () => {
  it('R23: el tipo admite materia prima, herramienta, empaque o nada; producto terminado y valores ajenos no caben', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seed(tx);
      for (const ajeno of ['FINISHED_PRODUCT', 'PACKAGING', 'PRODUCT', 'raw_material', 'Materia prima']) {
        const rechazo = await expectRejected(tx, () => insertClassifiedLine(tx, f, ajeno, null));
        expect(rechazo, ajeno).toContain(INVALID_ENUM_VALUE);
      }
      const ids = [
        await insertClassifiedLine(tx, f, 'RAW_MATERIAL', null),
        await insertClassifiedLine(tx, f, 'TOOL', null),
        await insertClassifiedLine(tx, f, 'PACKAGING_MATERIAL', null),
        await insertClassifiedLine(tx, f, null, null),
      ];
      const filas = await tx.supplierCatalogLine.findMany({ where: { id: { in: ids } }, select: { type: true } });
      expect(filas.map((row) => row.type).sort()).toEqual(['PACKAGING_MATERIAL', 'RAW_MATERIAL', 'TOOL', null].sort());
    });
  });

  it('R24: un subtipo solo cabe con tipo empaque; sin tipo o con otro tipo se rechaza, y empaque sin subtipo entra', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seed(tx);
      for (const [type, subtype] of [
        ['RAW_MATERIAL', 'CAP'],
        ['TOOL', 'CONTAINER'],
        [null, 'MEASURER'],
      ] as const) {
        const rechazo = await expectRejected(tx, () => insertClassifiedLine(tx, f, type, subtype));
        expect(rechazo, `${String(type)} + ${subtype}`).toContain(CHECK_VIOLATION);
        expect(rechazo, `${String(type)} + ${subtype}`).toContain(SUBTYPE_CHECK);
      }
      const subtipoAjeno = await expectRejected(tx, () => insertClassifiedLine(tx, f, 'PACKAGING_MATERIAL', 'GATILLO'));
      expect(subtipoAjeno).toContain(INVALID_ENUM_VALUE);

      const sinSubtipo = await insertClassifiedLine(tx, f, 'PACKAGING_MATERIAL', null);
      const tapa = await insertClassifiedLine(tx, f, 'PACKAGING_MATERIAL', 'CAP');
      const filas = await tx.supplierCatalogLine.findMany({
        where: { id: { in: [sinSubtipo, tapa] } },
        select: { id: true, type: true, packagingSubtype: true },
      });
      expect(filas.find((row) => row.id === sinSubtipo)).toMatchObject({
        type: 'PACKAGING_MATERIAL',
        packagingSubtype: null,
      });
      expect(filas.find((row) => row.id === tapa)).toMatchObject({ type: 'PACKAGING_MATERIAL', packagingSubtype: 'CAP' });

      const cambiarTipo = await expectRejected(
        tx,
        () => tx.$executeRaw`
          UPDATE "supplier_catalog_lines" SET "type" = 'TOOL' WHERE "id" = CAST(${tapa} AS uuid)`,
      );
      expect(cambiarTipo).toContain(SUBTYPE_CHECK);
    });
  });

  it('R25: una linea guardada antes de la migracion queda sin tipo ni subtipo y con el resto de columnas igual', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seed(tx);
      await apply(tx, DOWN);
      const viva = await insertPlainLine(tx, f, false);
      const deBaja = await insertPlainLine(tx, f, true);
      const snapshot = (): Promise<unknown[]> => tx.$queryRaw<unknown[]>`
        SELECT to_jsonb(l) - 'type' - 'packaging_subtype' AS row FROM "supplier_catalog_lines" l
         WHERE l."supplier_id" = CAST(${f.supplierId} AS uuid) ORDER BY l."id"`;
      const antes = await snapshot();
      const totalAntes = await tx.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "supplier_catalog_lines"`;

      await apply(tx, UP);

      expect(await snapshot()).toEqual(antes);
      const totalDespues = await tx.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "supplier_catalog_lines"`;
      expect(totalDespues[0]?.n).toBe(totalAntes[0]?.n);
      const clasificacion = await tx.supplierCatalogLine.findMany({
        where: { id: { in: [viva, deBaja] } },
        select: { type: true, packagingSubtype: true },
      });
      expect(clasificacion).toEqual([
        { type: null, packagingSubtype: null },
        { type: null, packagingSubtype: null },
      ]);
      const conTipo = await tx.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS n FROM "supplier_catalog_lines" WHERE "type" IS NOT NULL OR "packaging_subtype" IS NOT NULL`;
      expect(Number(conTipo[0]?.n), 'ninguna linea queda con tipo o subtipo').toBe(0);
    });
  });
});
