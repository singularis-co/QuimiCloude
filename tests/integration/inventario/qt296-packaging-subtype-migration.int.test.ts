/**
 * `*_packaging_subtype` contra Postgres real: el relleno de los empaques que ya existen.
 *
 * AISLAMIENTO: cada `it` corre en una transaccion interactiva que termina en `RollbackSignal`. El
 * `down.sql` y el `migration.sql` reales se aplican dentro de la transaccion; Postgres deshace
 * tambien ese DDL. Productos y lotes se siembran con SQL crudo: con la columna quitada, el
 * cliente generado la nombraria.
 */
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Prisma } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import { normalizeCompanyName } from '@/lib/modules/identity';
import { normalizePresentationName } from '@/lib/modules/inventario';
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
const carpetas = readdirSync(migrationsDir).filter((name) => name.endsWith('_packaging_subtype'));
const migrationDir = join(migrationsDir, carpetas[0] ?? 'missing');

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

type Fixture = {
  readonly companyId: string;
  readonly presentationId: string;
  readonly packageUnitId: string;
  readonly kgId: string;
};

async function seed(tx: Prisma.TransactionClient): Promise<Fixture> {
  const name = `Empresa subtipo ${token()}`;
  const company = await tx.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name) },
    select: { id: true },
  });
  const ml = await tx.unit.findFirstOrThrow({ where: { companyId: null, nameNormalized: 'mililitro' }, select: { id: true } });
  const kg = await tx.unit.findFirstOrThrow({ where: { companyId: null, nameNormalized: 'kilogramo' }, select: { id: true } });
  const unidad = await tx.unit.findFirstOrThrow({ where: { companyId: null, nameNormalized: 'unidad' }, select: { id: true } });
  const presentationName = `Botella ${token()}`;
  const presentation = await tx.presentation.create({
    data: {
      name: presentationName,
      nameNormalized: normalizePresentationName(presentationName),
      unitId: ml.id,
      companyId: company.id,
      content: '500',
    },
    select: { id: true },
  });
  return { companyId: company.id, presentationId: presentation.id, packageUnitId: unidad.id, kgId: kg.id };
}

type Seeded = { readonly productId: string; readonly batchId: string };

/** Producto y un lote por SQL crudo: valen con la columna y sin ella. */
async function insertProductWithBatch(
  tx: Prisma.TransactionClient,
  f: Fixture,
  type: 'PACKAGING' | 'PRODUCT',
  options: { readonly presentationId: string | null; readonly deleted: boolean; readonly stock: string },
): Promise<Seeded> {
  const productId = randomUUID();
  const name = `Producto ${token()}`;
  const unitId = type === 'PACKAGING' ? f.packageUnitId : f.kgId;
  await tx.$executeRaw`
    INSERT INTO "products"
      ("id", "name", "name_normalized", "type", "unit_id", "stock", "company_id", "presentation_id",
       "deleted_at", "updated_at")
    VALUES
      (CAST(${productId} AS uuid), ${name}, ${name.toLowerCase()}, CAST(${type} AS "ProductType"),
       CAST(${unitId} AS uuid), CAST(${options.stock} AS numeric), CAST(${f.companyId} AS uuid),
       CAST(${options.presentationId} AS uuid),
       CASE WHEN ${options.deleted} THEN TIMESTAMPTZ '2026-10-01 10:00:00+00' ELSE NULL END,
       TIMESTAMPTZ '2026-10-02 10:00:00+00')`;
  const batchId = randomUUID();
  await tx.$executeRaw`
    INSERT INTO "product_batches"
      ("id", "product_id", "stock", "unit_cost", "lot", "purchase_date", "company_id", "updated_at")
    VALUES
      (CAST(${batchId} AS uuid), CAST(${productId} AS uuid), CAST(${options.stock} AS numeric), 2,
       ${`L-${token()}`}, DATE '2026-10-01', CAST(${f.companyId} AS uuid), now())`;
  return { productId, batchId };
}

/** Las filas con todas sus columnas salvo la que anade la migracion. */
async function snapshotProducts(tx: Prisma.TransactionClient, ids: readonly string[]): Promise<unknown[]> {
  return tx.$queryRaw<unknown[]>`
    SELECT to_jsonb(p) - 'packaging_subtype' AS row FROM "products" p
     WHERE p."id" = ANY(CAST(${ids} AS uuid[])) ORDER BY p."id"`;
}

async function snapshotBatches(tx: Prisma.TransactionClient, ids: readonly string[]): Promise<unknown[]> {
  return tx.$queryRaw<unknown[]>`
    SELECT to_jsonb(b) AS row FROM "product_batches" b
     WHERE b."product_id" = ANY(CAST(${ids} AS uuid[])) ORDER BY b."id"`;
}

async function subtypesOf(tx: Prisma.TransactionClient, ids: readonly string[]): Promise<Map<string, string | null>> {
  const rows = await tx.$queryRaw<ReadonlyArray<{ id: string; subtype: string | null }>>`
    SELECT "id"::text AS id, "packaging_subtype"::text AS subtype FROM "products"
     WHERE "id" = ANY(CAST(${ids} AS uuid[]))`;
  return new Map(rows.map((row) => [row.id, row.subtype]));
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('QT-296 — migracion packaging_subtype contra Postgres real', () => {
  it('R4: existe exactamente una carpeta de la migracion', () => {
    expect(carpetas).toHaveLength(1);
  });

  it('R4: todo empaque existente (vivo, de baja o sin presentacion) queda como envase sin otro cambio; la materia prima queda sin subtipo', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seed(tx);
      await apply(tx, DOWN);

      const vivo = await insertProductWithBatch(tx, f, 'PACKAGING', {
        presentationId: f.presentationId,
        deleted: false,
        stock: '40',
      });
      const deBaja = await insertProductWithBatch(tx, f, 'PACKAGING', {
        presentationId: f.presentationId,
        deleted: true,
        stock: '7',
      });
      const antiguo = await insertProductWithBatch(tx, f, 'PACKAGING', {
        presentationId: null,
        deleted: false,
        stock: '12',
      });
      const materiaPrima = await insertProductWithBatch(tx, f, 'PRODUCT', {
        presentationId: null,
        deleted: false,
        stock: '3.5',
      });
      const ids = [vivo, deBaja, antiguo, materiaPrima].map((seeded) => seeded.productId);
      const productosAntes = await snapshotProducts(tx, ids);
      const lotesAntes = await snapshotBatches(tx, ids);

      await apply(tx, UP);

      const subtipos = await subtypesOf(tx, ids);
      expect(subtipos.get(vivo.productId)).toBe('CONTAINER');
      expect(subtipos.get(deBaja.productId)).toBe('CONTAINER');
      expect(subtipos.get(antiguo.productId)).toBe('CONTAINER');
      expect(subtipos.get(materiaPrima.productId)).toBeNull();
      expect(await snapshotProducts(tx, ids)).toEqual(productosAntes);
      expect(await snapshotBatches(tx, ids)).toEqual(lotesAntes);

      const sinSubtipo = await tx.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS n FROM "products" WHERE "type" = 'PACKAGING' AND "packaging_subtype" IS DISTINCT FROM 'CONTAINER'`;
      expect(Number(sinSubtipo[0]?.n), 'ningun empaque queda sin subtipo envase').toBe(0);
    });
  });

  it('R4: el DOWN quita la columna y el UP se vuelve a aplicar sobre lo que deja', async () => {
    await inRolledBackTransaction(async (tx) => {
      await apply(tx, DOWN);
      const columnas = await tx.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS n FROM information_schema.columns
         WHERE table_schema = 'public' AND column_name = 'packaging_subtype'`;
      expect(Number(columnas[0]?.n)).toBe(0);
      await apply(tx, UP);
      const despues = await tx.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS n FROM information_schema.columns
         WHERE table_schema = 'public' AND column_name = 'packaging_subtype'`;
      expect(Number(despues[0]?.n)).toBe(2);
    });
  });
});
