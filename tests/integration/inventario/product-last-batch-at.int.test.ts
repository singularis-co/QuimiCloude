/**
 * `products.last_batch_at` contra Postgres real: la carga de un lote la deja con el `created_at` de
 * ese lote, un ajuste no la toca, y el relleno de la migracion toma el lote mas reciente.
 *
 * AISLAMIENTO: commit en los casos de escritura. `createWithFirstBatch`, `addBatchToAlive` y
 * `adjustBatchStock` usan el cliente Prisma GLOBAL y abren SU PROPIA `prisma.$transaction`; una
 * transaccion del test no las envolveria. Cada caso fabrica su empresa efimera y la limpia en un
 * `finally`, como `adjust-by-count`. El caso de la migracion corre en una transaccion que termina
 * en `RollbackSignal`, con el `down.sql` y el `migration.sql` reales dentro.
 */
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { normalizeCompanyName } from '@/lib/modules/identity';
import {
  addBatchToAlive,
  adjustBatchStock,
  createWithFirstBatch,
} from '@/lib/modules/inventario/adapters/driven/persistence/product-prisma';
import { prisma } from '@/lib/shared/db/prisma';

import type { Prisma } from '@prisma/client';
import type { InventoryScope } from '@/lib/modules/inventario/domain/inventory-scope';
import type { NewProductBatch } from '@/lib/modules/inventario/domain/product-batch';

function token(): string {
  return randomUUID().replace(/-/gu, '');
}

function normalizeForTest(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]/gu, '');
}

type Fixture = {
  readonly actorId: string;
  readonly companyId: string;
  readonly presentationId: string;
  readonly roleId: string;
  readonly documentTypeCode: string;
  readonly productIds: string[];
};

function ambito(fixture: Fixture): InventoryScope {
  return { companyId: fixture.companyId };
}

async function createFixture(): Promise<Fixture> {
  const marker = token();
  const documentType = await prisma.documentType.create({
    data: { code: `DOC${marker.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  });
  const role = await prisma.role.create({
    data: { name: `rol-${marker}`, description: 'Rol de prueba' },
    select: { id: true },
  });
  const companyName = `Empresa ${marker}`;
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
  const unit = await prisma.unit.findFirstOrThrow({
    where: { nameNormalized: 'kilogramo', companyId: null },
    select: { id: true },
  });
  const presentationName = `Bidon ${token()}`;
  const presentation = await prisma.presentation.create({
    data: {
      name: presentationName,
      nameNormalized: normalizeForTest(presentationName),
      unitId: unit.id,
      companyId: company.id,
    },
    select: { id: true },
  });
  return {
    actorId: user.id,
    companyId: company.id,
    presentationId: presentation.id,
    roleId: role.id,
    documentTypeCode: documentType.code,
    productIds: [],
  };
}

/** En orden de FK: asientos, lotes, productos, presentacion, usuario, rol, tipo, empresa. */
async function dropFixture(fixture: Fixture): Promise<void> {
  await prisma.inventoryMovement.deleteMany({ where: { companyId: fixture.companyId } });
  await prisma.productBatch.deleteMany({ where: { productId: { in: fixture.productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: fixture.productIds } } });
  await prisma.presentation.deleteMany({ where: { id: fixture.presentationId } });
  await prisma.user.delete({ where: { id: fixture.actorId } });
  await prisma.role.delete({ where: { id: fixture.roleId } });
  await prisma.documentType.delete({ where: { code: fixture.documentTypeCode } });
  await prisma.company.delete({ where: { id: fixture.companyId } });
}

function nuevoLote(fixture: Fixture, stock: string): NewProductBatch {
  return {
    presentationId: fixture.presentationId,
    stock,
    unitCost: '2.5000',
    lot: null,
    purchaseDate: '2026-09-01',
    expiryDate: null,
    createdBy: fixture.actorId,
  };
}

async function productoDe(productId: string) {
  return prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: { lastBatchAt: true, updatedAt: true },
  });
}

async function creadoDelLote(batchId: string): Promise<Date> {
  const lote = await prisma.productBatch.findUniqueOrThrow({ where: { id: batchId }, select: { createdAt: true } });
  return lote.createdAt;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('products.last_batch_at la escribe solo la carga de un lote', () => {
  it('el alta con primer lote la deja igual al created_at de ese lote', async () => {
    const fixture = await createFixture();
    try {
      const now = new Date('2026-10-01T10:00:00.000Z');
      const creado = await createWithFirstBatch({ name: `Producto ${token()}` }, nuevoLote(fixture, '5'), now, ambito(fixture));
      fixture.productIds.push(creado.id);

      const producto = await productoDe(creado.id);
      expect(producto.lastBatchAt).toEqual(await creadoDelLote(creado.batchId));
      expect(producto.lastBatchAt).toEqual(now);
    } finally {
      await dropFixture(fixture);
    }
  });

  it('un lote nuevo sobre un producto existente la avanza a su created_at sin mover updated_at', async () => {
    const fixture = await createFixture();
    try {
      const primero = new Date('2026-10-01T10:00:00.000Z');
      const creado = await createWithFirstBatch({ name: `Producto ${token()}` }, nuevoLote(fixture, '5'), primero, ambito(fixture));
      fixture.productIds.push(creado.id);
      const antes = await productoDe(creado.id);

      const segundo = new Date('2026-10-05T08:30:00.000Z');
      const agregado = await addBatchToAlive(creado.id, nuevoLote(fixture, '3'), segundo, ambito(fixture));
      if (agregado === null || agregado === 'finished_product') throw new Error('el lote no se agrego');

      const despues = await productoDe(creado.id);
      expect(despues.lastBatchAt).toEqual(await creadoDelLote(agregado.batchId));
      expect(despues.lastBatchAt).toEqual(segundo);
      expect(despues.updatedAt).toEqual(antes.updatedAt);
    } finally {
      await dropFixture(fixture);
    }
  });

  it('un ajuste de existencia no la toca', async () => {
    const fixture = await createFixture();
    try {
      const now = new Date('2026-10-01T10:00:00.000Z');
      const creado = await createWithFirstBatch({ name: `Producto ${token()}` }, nuevoLote(fixture, '10'), now, ambito(fixture));
      fixture.productIds.push(creado.id);

      const outcome = await adjustBatchStock(
        { batchId: creado.batchId, seenStock: '10', countedStock: '7', reason: 'conteo_fisico' },
        fixture.actorId,
        new Date('2026-10-09T10:00:00.000Z'),
        ambito(fixture),
      );
      expect(outcome.kind).toBe('adjusted');

      expect((await productoDe(creado.id)).lastBatchAt).toEqual(now);
    } finally {
      await dropFixture(fixture);
    }
  });
});

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
const carpetas = readdirSync(migrationsDir).filter((name) => name.endsWith('_products_last_batch_at'));
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

async function columnExists(tx: Prisma.TransactionClient): Promise<boolean> {
  const rows = await tx.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'last_batch_at'`;
  return Number(rows[0]?.n ?? 0) === 1;
}

async function indexExists(tx: Prisma.TransactionClient): Promise<boolean> {
  const rows = await tx.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM pg_indexes WHERE indexname = 'products_company_id_last_batch_at_idx'`;
  return Number(rows[0]?.n ?? 0) === 1;
}

describe('migracion products_last_batch_at contra Postgres real', () => {
  it('existe exactamente una carpeta de la migracion', () => {
    expect(carpetas).toHaveLength(1);
  });

  it('el UP rellena con el lote mas reciente, deja NULL sin lotes, y el DOWN lo revierte', async () => {
    await inRolledBackTransaction(async (tx) => {
      const name = `Empresa relleno ${token()}`;
      const company = await tx.company.create({
        data: { name, nameNormalized: normalizeCompanyName(name) },
        select: { id: true },
      });
      const kg = await tx.unit.findFirstOrThrow({ where: { companyId: null, nameNormalized: 'kilogramo' }, select: { id: true } });
      const conLotes = await tx.product.create({
        data: { name: `Con lotes ${token()}`, nameNormalized: `conlotes${token()}`, companyId: company.id, unitId: kg.id },
        select: { id: true },
      });
      const sinLotes = await tx.product.create({
        data: { name: `Sin lotes ${token()}`, nameNormalized: `sinlotes${token()}`, companyId: company.id, unitId: kg.id },
        select: { id: true },
      });

      await apply(tx, DOWN);
      expect(await columnExists(tx)).toBe(false);
      expect(await indexExists(tx)).toBe(false);

      for (const createdAt of ['2026-03-01T00:00:00Z', '2026-07-15T09:30:00Z', '2026-05-01T00:00:00Z']) {
        await tx.$executeRaw`
          INSERT INTO "product_batches"
            ("product_id", "stock", "unit_cost", "lot", "purchase_date", "company_id", "created_at", "updated_at")
          VALUES
            (CAST(${conLotes.id} AS uuid), 1, 1, ${`L-${token()}`}, DATE '2026-01-01',
             CAST(${company.id} AS uuid), CAST(${createdAt} AS timestamptz), now())`;
      }

      await apply(tx, UP);
      expect(await columnExists(tx)).toBe(true);
      expect(await indexExists(tx)).toBe(true);

      const filas = await tx.$queryRaw<{ id: string; last_batch_at: Date | null }[]>`
        SELECT "id"::text, "last_batch_at" FROM "products"
         WHERE "id" IN (CAST(${conLotes.id} AS uuid), CAST(${sinLotes.id} AS uuid))`;
      const porId = new Map(filas.map((fila) => [fila.id, fila.last_batch_at]));
      expect(porId.get(conLotes.id)).toEqual(new Date('2026-07-15T09:30:00Z'));
      expect(porId.get(sinLotes.id)).toBeNull();
    });
  });
});
