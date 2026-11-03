/**
 * Ejecutar los `migration.sql` y `down.sql` reales dentro de una transaccion de test que termina
 * en ROLLBACK. Postgres deshace tambien el DDL, asi que la base efimera de la corrida queda como
 * estaba.
 */
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Prisma } from '@prisma/client';

import { normalizeCompanyName } from '@/lib/modules/identity';
import { prisma } from '@/lib/shared/db/prisma';

class RollbackSignal extends Error {
  constructor() {
    super('rollback de aislamiento del test');
    this.name = 'RollbackSignal';
  }
}

export async function inRolledBackTransaction(
  body: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await body(tx);
        throw new RollbackSignal();
      },
      { maxWait: 20_000, timeout: 120_000 },
    );
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error;
  }
}

const MIGRATIONS_DIR = join(process.cwd(), 'db', 'migrations');

/** La carpeta de la unica migracion cuyo nombre termina en `suffix`. */
export function migrationDir(suffix: string): string {
  const carpetas = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(suffix));
  if (carpetas.length !== 1) {
    throw new Error(`se esperaba una sola migracion *${suffix} y hay ${String(carpetas.length)}`);
  }
  return join(MIGRATIONS_DIR, carpetas[0] as string);
}

export function migrationExists(suffix: string): boolean {
  return readdirSync(MIGRATIONS_DIR).some((name) => name.endsWith(suffix));
}

export function readMigration(suffix: string, file: 'migration.sql' | 'down.sql'): string {
  return readFileSync(join(migrationDir(suffix), file), 'utf8');
}

/** Trocea por `;` respetando el cuerpo `$$ ... $$` de los bloques `DO`. */
export function statementsOf(sql: string): readonly string[] {
  const withoutComments = sql
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');

  const statements: string[] = [];
  let current = '';
  let inDollarBlock = false;
  let i = 0;
  while (i < withoutComments.length) {
    if (withoutComments.slice(i, i + 2) === '$$') {
      inDollarBlock = !inDollarBlock;
      current += '$$';
      i += 2;
      continue;
    }
    const char = withoutComments[i];
    if (char === ';' && !inDollarBlock) {
      const trimmed = current.trim();
      if (trimmed.length > 0) statements.push(trimmed);
      current = '';
      i += 1;
      continue;
    }
    current += char;
    i += 1;
  }
  const trimmed = current.trim();
  if (trimmed.length > 0) statements.push(trimmed);
  return statements;
}

export async function runScript(tx: Prisma.TransactionClient, sql: string): Promise<void> {
  for (const statement of statementsOf(sql)) {
    await tx.$executeRawUnsafe(statement);
  }
}

/** Los DOWN de esas migraciones, en el orden dado, saltando las que todavia no existen. */
export async function runDowns(tx: Prisma.TransactionClient, suffixes: readonly string[]): Promise<void> {
  for (const suffix of suffixes) {
    if (migrationExists(suffix)) await runScript(tx, readMigration(suffix, 'down.sql'));
  }
}

let savepointSeq = 0;

/** Corre `run` esperando que la base lo rechace; el SAVEPOINT deja el `tx` utilizable. */
export async function expectRejectedByDatabase(
  tx: Prisma.TransactionClient,
  run: () => Promise<unknown>,
  what: string,
): Promise<string> {
  savepointSeq += 1;
  const savepoint = `migration_script_sp_${String(savepointSeq)}`;
  await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
  try {
    await run();
  } catch (error) {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    return error instanceof Error ? error.message : String(error);
  }
  await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
  throw new Error(`se esperaba que la base rechazara la operacion, pero la acepto: ${what}`);
}

export function token(): string {
  return randomUUID().replace(/-/gu, '');
}

export async function seedCompany(tx: Prisma.TransactionClient): Promise<string> {
  const name = `Empresa migracion ${token()}`;
  const company = await tx.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name) },
    select: { id: true },
  });
  return company.id;
}

export async function seedRecipe(
  tx: Prisma.TransactionClient,
  companyId: string,
  parentRecipeId: string | null = null,
): Promise<string> {
  const marca = token();
  const recipe = await tx.recipe.create({
    data: { name: `Receta ${marca}`, nameNormalized: `receta${marca}`, companyId, parentRecipeId },
    select: { id: true },
  });
  return recipe.id;
}

let nextSequence = 950_000;

export function freshSequence(): number {
  nextSequence += 1;
  return nextSequence;
}

export async function enumValues(tx: Prisma.TransactionClient, typeName: string): Promise<readonly string[]> {
  const rows = await tx.$queryRaw<ReadonlyArray<{ value: string }>>(Prisma.sql`
    SELECT e.enumlabel AS value
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = ${typeName}
     ORDER BY e.enumsortorder
  `);
  return rows.map((row) => row.value);
}

export async function tableExists(tx: Prisma.TransactionClient, table: string): Promise<boolean> {
  const rows = await tx.$queryRaw<ReadonlyArray<{ exists: boolean }>>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${table}
    ) AS "exists"
  `);
  return rows[0]?.exists === true;
}

/** Restricciones, indices y columnas de una tabla, ordenados: dos fotos iguales son el mismo esquema. */
export async function schemaSnapshot(tx: Prisma.TransactionClient, table: string): Promise<readonly string[]> {
  const constraints = await tx.$queryRaw<ReadonlyArray<{ line: string }>>(Prisma.sql`
    SELECT 'C ' || c.conname || ' ' || pg_get_constraintdef(c.oid) AS line
      FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid
     WHERE r.relname = ${table} AND r.relnamespace = 'public'::regnamespace
  `);
  const indexes = await tx.$queryRaw<ReadonlyArray<{ line: string }>>(Prisma.sql`
    SELECT 'I ' || indexdef AS line FROM pg_indexes WHERE schemaname = 'public' AND tablename = ${table}
  `);
  const columns = await tx.$queryRaw<ReadonlyArray<{ line: string }>>(Prisma.sql`
    SELECT 'K ' || column_name || ' ' || udt_name || ' ' || is_nullable || ' ' || coalesce(column_default, '') AS line
      FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${table}
  `);
  return [...constraints, ...indexes, ...columns].map((row) => row.line).sort();
}

/** Un usuario de esa empresa: lo que admiten las FK compuestas de quien empaca o acondiciona. */
export async function seedUser(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
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
