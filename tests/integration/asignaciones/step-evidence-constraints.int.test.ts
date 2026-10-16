/**
 * Las restricciones de `order_step_evidence` contra una base Postgres REAL, y la reversion de su
 * migracion.
 *
 * Aqui se comprueba lo que la base HACE cuando alguien intenta saltarse el caso de uso: una cuarta
 * foto en un paso, un `slot` fuera de 1..3, una ruta fuera de `<empresa>/<pedido>/`, un pedido o una
 * persona de otra empresa, un tipo o un tamano fuera de rango.
 *
 * Cada `it` corre dentro de una transaccion interactiva que siempre termina en `ROLLBACK`, y cada
 * operacion que se espera rechazada va en un SAVEPOINT para poder seguir afirmando despues dentro
 * de la misma transaccion. Todo `INSERT` sobre la tabla es SQL crudo, y se afirma sobre el SQLSTATE,
 * nunca sobre el texto. Cada transaccion fabrica sus dos empresas efimeras: nada depende del seed.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Prisma } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import { normalizeCompanyName } from '@/lib/modules/identity';
import { prisma } from '@/lib/shared/db/prisma';

class RollbackSignal extends Error {
  constructor() {
    super('rollback de aislamiento del test');
    this.name = 'RollbackSignal';
  }
}

async function inRolledBackTransaction(
  body: (tx: Prisma.TransactionClient) => Promise<void>,
  isolationLevel?: Prisma.TransactionIsolationLevel,
): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await body(tx);
        throw new RollbackSignal();
      },
      { maxWait: 10_000, timeout: 30_000, ...(isolationLevel === undefined ? {} : { isolationLevel }) },
    );
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error;
  }
}

const TABLE = 'order_step_evidence';
const CHECK_VIOLATION = '23514';
const FOREIGN_KEY_VIOLATION = '23503';
const UNIQUE_VIOLATION = '23505';
const DEPENDENT_OBJECTS_STILL_EXIST = '2BP01';
const MAX_BYTES = 5 * 1024 * 1024;

let savepointSeq = 0;

function sqlStateOf(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta: unknown = error.meta;
    if (typeof meta === 'object' && meta !== null && 'code' in meta) {
      const code: unknown = (meta as { code: unknown }).code;
      if (typeof code === 'string') return code;
    }
    return error.code;
  }
  return error instanceof Error ? error.message : String(error);
}

async function expectRejectedByDatabase(
  tx: Prisma.TransactionClient,
  run: () => Promise<unknown>,
  what: string,
): Promise<string> {
  savepointSeq += 1;
  const savepoint = `sp_evidence_${String(savepointSeq)}`;
  await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
  try {
    await run();
  } catch (error) {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    return sqlStateOf(error);
  }
  await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
  throw new Error(`se esperaba que la base rechazara la operacion, pero la acepto: ${what}`);
}

function token(): string {
  return randomUUID().replace(/-/gu, '');
}

async function createCompany(tx: Prisma.TransactionClient, label: string): Promise<string> {
  const name = `Empresa evidencia ${label} ${token()}`;
  const company = await tx.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name) },
    select: { id: true },
  });
  return company.id;
}

async function createUser(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
  const marca = token();
  const documentType = await tx.documentType.create({
    data: { code: `DOC${marca.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  });
  const role = await tx.role.create({
    data: { name: `rol-${marca}`, description: 'Rol de prueba' },
    select: { id: true },
  });
  const user = await tx.user.create({
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
      companyId,
    },
    select: { id: true },
  });
  return user.id;
}

let nextSequence = 840_000;

async function createOrder(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
  const marca = token();
  const recipe = await tx.recipe.create({
    data: { name: `Receta ${marca}`, nameNormalized: `receta${marca}`, companyId },
    select: { id: true },
  });
  nextSequence += 1;
  const order = await tx.order.create({
    data: {
      companyId,
      orderYear: new Date().getUTCFullYear(),
      orderSequence: nextSequence,
      recipeId: recipe.id,
      quantity: new Prisma.Decimal('10'),
    },
    select: { id: true },
  });
  return order.id;
}

interface Company {
  readonly companyId: string;
  readonly orderId: string;
  readonly otherOrderId: string;
  readonly userId: string;
}

interface Fixtures {
  readonly a: Company;
  readonly b: Company;
}

async function seedCompany(tx: Prisma.TransactionClient, label: string): Promise<Company> {
  const companyId = await createCompany(tx, label);
  return {
    companyId,
    orderId: await createOrder(tx, companyId),
    otherOrderId: await createOrder(tx, companyId),
    userId: await createUser(tx, companyId),
  };
}

async function seedFixtures(tx: Prisma.TransactionClient): Promise<Fixtures> {
  return { a: await seedCompany(tx, 'A'), b: await seedCompany(tx, 'B') };
}

interface EvidenceValues {
  readonly companyId: string;
  readonly orderId: string;
  readonly phase: 'MANUFACTURING' | 'PACKING';
  readonly stepPosition: number;
  readonly slot: number;
  readonly path: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly uploadedBy: string;
}

function rawInsertEvidence(tx: Prisma.TransactionClient, v: EvidenceValues): Promise<number> {
  return tx.$executeRaw`
    INSERT INTO "order_step_evidence"
      ("company_id", "order_id", "phase", "step_position", "slot", "path", "content_type", "size_bytes", "uploaded_by")
    VALUES (
      CAST(${v.companyId} AS uuid),
      CAST(${v.orderId} AS uuid),
      CAST(${v.phase} AS "evidence_phase"),
      CAST(${v.stepPosition} AS integer),
      CAST(${v.slot} AS smallint),
      CAST(${v.path} AS text),
      CAST(${v.contentType} AS text),
      CAST(${v.sizeBytes} AS integer),
      CAST(${v.uploadedBy} AS uuid)
    )`;
}

function pathOf(companyId: string, orderId: string): string {
  return `${companyId}/${orderId}/${randomUUID()}`;
}

/** Fila valida de la empresa A, paso 1 de fabricacion, `slot` 1; cada caso cambia lo que fuerza. */
function evidenceOf(f: Fixtures, overrides: Partial<EvidenceValues> = {}): EvidenceValues {
  return {
    companyId: f.a.companyId,
    orderId: f.a.orderId,
    phase: 'MANUFACTURING',
    stepPosition: 1,
    slot: 1,
    path: pathOf(f.a.companyId, f.a.orderId),
    contentType: 'image/jpeg',
    sizeBytes: 1024,
    uploadedBy: f.a.userId,
    ...overrides,
  };
}

async function countEvidence(tx: Prisma.TransactionClient, orderId: string): Promise<number> {
  const rows = await tx.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM "order_step_evidence" WHERE "order_id" = CAST(${orderId} AS uuid)`;
  return rows[0]?.n ?? 0;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('order_step_evidence — tope de 3 fotos por paso (R29)', () => {
  it('R29: con los slots 1, 2 y 3 ocupados, una cuarta foto en el mismo paso se rechaza (23505)', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seedFixtures(tx);
      for (const slot of [1, 2, 3]) {
        expect(await rawInsertEvidence(tx, evidenceOf(f, { slot }))).toBe(1);
      }

      for (const slot of [1, 2, 3]) {
        const repetido = await expectRejectedByDatabase(
          tx,
          () => rawInsertEvidence(tx, evidenceOf(f, { slot })),
          `cuarta foto en el slot ${String(slot)}`,
        );
        expect(repetido).toBe(UNIQUE_VIOLATION);
      }
      expect(await countEvidence(tx, f.a.orderId)).toBe(3);
    });
  });

  it('R29: rechaza el slot 0 y el slot 4 (23514)', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seedFixtures(tx);
      for (const slot of [0, 4, -1]) {
        const estado = await expectRejectedByDatabase(
          tx,
          () => rawInsertEvidence(tx, evidenceOf(f, { slot })),
          `slot ${String(slot)}`,
        );
        expect(estado).toBe(CHECK_VIOLATION);
      }
      expect(await countEvidence(tx, f.a.orderId)).toBe(0);
    });
  });

  it('R29: el mismo slot se acepta en otro paso, en la otra fase y en otro pedido', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seedFixtures(tx);
      expect(await rawInsertEvidence(tx, evidenceOf(f))).toBe(1);
      expect(await rawInsertEvidence(tx, evidenceOf(f, { stepPosition: 2 }))).toBe(1);
      expect(await rawInsertEvidence(tx, evidenceOf(f, { phase: 'PACKING' }))).toBe(1);
      expect(
        await rawInsertEvidence(
          tx,
          evidenceOf(f, { orderId: f.a.otherOrderId, path: pathOf(f.a.companyId, f.a.otherOrderId) }),
        ),
      ).toBe(1);
      expect(await countEvidence(tx, f.a.orderId)).toBe(3);
      expect(await countEvidence(tx, f.a.otherOrderId)).toBe(1);
    });
  });

  it('R29: rechaza step_position 0 (23514): los pasos se numeran desde 1', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seedFixtures(tx);
      const estado = await expectRejectedByDatabase(
        tx,
        () => rawInsertEvidence(tx, evidenceOf(f, { stepPosition: 0 })),
        'step_position 0',
      );
      expect(estado).toBe(CHECK_VIOLATION);
      expect(await countEvidence(tx, f.a.orderId)).toBe(0);
    });
  });
});

describe('order_step_evidence — ruta dentro de <empresa>/<pedido>/ (R30, R31)', () => {
  it('R30, R31: rechaza una ruta de otra empresa, de otro pedido o sin el prefijo completo (23514)', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seedFixtures(tx);
      const fuera: readonly [string, string][] = [
        [pathOf(f.b.companyId, f.a.orderId), 'empresa B, pedido de A'],
        [pathOf(f.a.companyId, f.a.otherOrderId), 'otro pedido de la misma empresa'],
        [pathOf(f.b.companyId, f.b.orderId), 'empresa y pedido de B'],
        [`${f.a.companyId}/${randomUUID()}`, 'sin el segmento del pedido'],
        [`${f.a.orderId}/${f.a.companyId}/${randomUUID()}`, 'segmentos invertidos'],
        [`x/${f.a.companyId}/${f.a.orderId}/${randomUUID()}`, 'prefijo delante de la empresa'],
        [`${f.a.companyId}/${f.a.orderId}`, 'sin la barra final'],
      ];
      for (const [path, what] of fuera) {
        const estado = await expectRejectedByDatabase(
          tx,
          () => rawInsertEvidence(tx, evidenceOf(f, { path })),
          what,
        );
        expect(estado, what).toBe(CHECK_VIOLATION);
      }
      expect(await countEvidence(tx, f.a.orderId)).toBe(0);
    });
  });

  it('R30: la misma ruta no se registra dos veces en la empresa (23505)', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seedFixtures(tx);
      const path = pathOf(f.a.companyId, f.a.orderId);
      expect(await rawInsertEvidence(tx, evidenceOf(f, { path }))).toBe(1);
      const estado = await expectRejectedByDatabase(
        tx,
        () => rawInsertEvidence(tx, evidenceOf(f, { path, slot: 2 })),
        'ruta repetida',
      );
      expect(estado).toBe(UNIQUE_VIOLATION);
      expect(await countEvidence(tx, f.a.orderId)).toBe(1);
    });
  });
});

describe('order_step_evidence — empresa de la fila (R39)', () => {
  it('R39: rechaza un pedido o una persona de la empresa B en una fila de la A (23503)', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seedFixtures(tx);

      // La ruta cumple el CHECK con el pedido de B: lo que rechaza es la FK compuesta.
      const pedidoAjeno = await expectRejectedByDatabase(
        tx,
        () => rawInsertEvidence(tx, evidenceOf(f, { orderId: f.b.orderId, path: pathOf(f.a.companyId, f.b.orderId) })),
        'pedido de la empresa B',
      );
      expect(pedidoAjeno).toBe(FOREIGN_KEY_VIOLATION);

      const personaAjena = await expectRejectedByDatabase(
        tx,
        () => rawInsertEvidence(tx, evidenceOf(f, { uploadedBy: f.b.userId })),
        'persona de la empresa B',
      );
      expect(personaAjena).toBe(FOREIGN_KEY_VIOLATION);

      const empresaInexistente = randomUUID();
      const sinEmpresa = await expectRejectedByDatabase(
        tx,
        () =>
          rawInsertEvidence(
            tx,
            evidenceOf(f, { companyId: empresaInexistente, path: pathOf(empresaInexistente, f.a.orderId) }),
          ),
        'empresa inexistente',
      );
      expect(sinEmpresa).toBe(FOREIGN_KEY_VIOLATION);

      expect(await countEvidence(tx, f.a.orderId)).toBe(0);
      expect(await countEvidence(tx, f.b.orderId)).toBe(0);
    });
  });

  it('R39: acepta la fila de cada empresa con su pedido y su persona', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seedFixtures(tx);
      expect(await rawInsertEvidence(tx, evidenceOf(f))).toBe(1);
      expect(
        await rawInsertEvidence(tx, {
          ...evidenceOf(f),
          companyId: f.b.companyId,
          orderId: f.b.orderId,
          uploadedBy: f.b.userId,
          path: pathOf(f.b.companyId, f.b.orderId),
        }),
      ).toBe(1);
      expect(await countEvidence(tx, f.a.orderId)).toBe(1);
      expect(await countEvidence(tx, f.b.orderId)).toBe(1);
    });
  });
});

describe('order_step_evidence — tipo y tamano (R32)', () => {
  it('R32: rechaza un content_type que no es JPEG, PNG ni WebP (23514)', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seedFixtures(tx);
      for (const contentType of ['image/gif', 'application/pdf', 'IMAGE/JPEG', 'image/jpg', '']) {
        const estado = await expectRejectedByDatabase(
          tx,
          () => rawInsertEvidence(tx, evidenceOf(f, { contentType })),
          `content_type ${contentType}`,
        );
        expect(estado, contentType).toBe(CHECK_VIOLATION);
      }
      let slot = 0;
      for (const contentType of ['image/jpeg', 'image/png', 'image/webp']) {
        slot += 1;
        expect(await rawInsertEvidence(tx, evidenceOf(f, { contentType, slot }))).toBe(1);
      }
      expect(await countEvidence(tx, f.a.orderId)).toBe(3);
    });
  });

  it('R32: rechaza size_bytes 0, negativo o mayor de 5 MB (23514) y acepta 1 y 5 MB justos', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seedFixtures(tx);
      for (const sizeBytes of [0, -1, MAX_BYTES + 1]) {
        const estado = await expectRejectedByDatabase(
          tx,
          () => rawInsertEvidence(tx, evidenceOf(f, { sizeBytes })),
          `size_bytes ${String(sizeBytes)}`,
        );
        expect(estado, String(sizeBytes)).toBe(CHECK_VIOLATION);
      }
      expect(await rawInsertEvidence(tx, evidenceOf(f, { sizeBytes: 1, slot: 1 }))).toBe(1);
      expect(await rawInsertEvidence(tx, evidenceOf(f, { sizeBytes: MAX_BYTES, slot: 2 }))).toBe(1);
      expect(await countEvidence(tx, f.a.orderId)).toBe(2);
    });
  });
});

describe('order_step_evidence — RLS (R39)', () => {
  it('R39: la RLS esta activada y forzada, sin policies', async () => {
    await inRolledBackTransaction(async (tx) => {
      const rls = await tx.$queryRaw<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
        SELECT relrowsecurity, relforcerowsecurity FROM pg_class
        WHERE relname = 'order_step_evidence' AND relkind = 'r'`;
      expect(rls).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }]);

      const policies = await tx.$queryRaw<{ n: number }[]>`
        SELECT COUNT(*)::int AS n FROM pg_policies WHERE tablename = 'order_step_evidence'`;
      expect(policies).toEqual([{ n: 0 }]);
    });
  });
});

// ---------------------------------------------------------------------------
// La migracion, leida de sus archivos y aplicada dentro de una transaccion revertida
// ---------------------------------------------------------------------------

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

function statementsOf(sql: string): readonly string[] {
  return sql
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

const migrationDir = join(
  findRepoRoot(dirname(fileURLToPath(import.meta.url))),
  'db',
  'migrations',
  '20261013120000_order_step_evidence',
);
const UP_STATEMENTS = statementsOf(readFileSync(join(migrationDir, 'migration.sql'), 'utf8'));
const DOWN_STATEMENTS = statementsOf(readFileSync(join(migrationDir, 'down.sql'), 'utf8'));

async function applyStatements(tx: Prisma.TransactionClient, statements: readonly string[]): Promise<void> {
  for (const statement of statements) {
    await tx.$executeRawUnsafe(statement);
  }
}

async function schemaSnapshot(tx: Prisma.TransactionClient) {
  const tables = await tx.$queryRaw<{ name: string }[]>`
    SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'i', 'S', 'v') ORDER BY c.relname`;
  const types = await tx.$queryRaw<{ name: string }[]>`
    SELECT t.typname AS name FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e' ORDER BY t.typname`;
  const constraints = await tx.$queryRaw<{ name: string; owner: string; def: string }[]>`
    SELECT con.conname AS name, cls.relname AS owner, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = cls.relnamespace
    WHERE n.nspname = 'public' ORDER BY cls.relname, con.conname`;
  const rows = await tx.$queryRaw<{ orders: string | null; users: string | null }[]>`
    SELECT
      (SELECT md5(string_agg(o::text, ',' ORDER BY o.id)) FROM "orders" o) AS orders,
      (SELECT md5(string_agg(u::text, ',' ORDER BY u.id)) FROM "users" u) AS users`;
  return { tables, types, constraints, rows };
}

async function tableExists(tx: Prisma.TransactionClient): Promise<boolean> {
  const rows = await tx.$queryRaw<{ found: boolean }[]>`
    SELECT to_regclass('public.order_step_evidence') IS NOT NULL AS found`;
  return rows[0]?.found ?? false;
}

describe('migracion order_step_evidence — UP sin tocar filas, DOWN limpio (R39)', () => {
  it('R39: el DOWN, leido del archivo, borra la tabla y el tipo y deja la base como antes del UP', async () => {
    await inRolledBackTransaction(async (tx) => {
      await applyStatements(tx, DOWN_STATEMENTS);
      expect(await tableExists(tx)).toBe(false);
      const antesDelUp = await schemaSnapshot(tx);
      expect(antesDelUp.types.map((t) => t.name)).not.toContain('evidence_phase');

      await applyStatements(tx, UP_STATEMENTS);
      expect(await tableExists(tx)).toBe(true);
      const tras = await schemaSnapshot(tx);
      expect(tras.rows).toEqual(antesDelUp.rows);
      expect(tras.constraints.filter((c) => c.owner !== TABLE)).toEqual(antesDelUp.constraints);
      expect(tras.types.map((t) => t.name)).toContain('evidence_phase');

      await applyStatements(tx, DOWN_STATEMENTS);
      expect(await tableExists(tx)).toBe(false);
      expect(await schemaSnapshot(tx)).toEqual(antesDelUp);
    }, Prisma.TransactionIsolationLevel.RepeatableRead);
  });

  it('R39: control: el DOWN sin CASCADE falla si algo posterior depende de la tabla', async () => {
    await inRolledBackTransaction(async (tx) => {
      await tx.$executeRawUnsafe(`CREATE VIEW "qc_probe_evidence_view" AS SELECT "order_id" FROM "order_step_evidence"`);
      const estado = await expectRejectedByDatabase(
        tx,
        () => applyStatements(tx, DOWN_STATEMENTS),
        'DROP TABLE con una vista que depende',
      );
      expect(estado).toBe(DEPENDENT_OBJECTS_STILL_EXIST);
      expect(await tableExists(tx)).toBe(true);
    });
  });
});
