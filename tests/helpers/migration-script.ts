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

/** Un pedido como lo guardaba `orders` antes de `orders_drop_line_columns`: la cabecera y su receta
 *  en la misma fila. Lo que no se nombra va con el valor por defecto de la columna o NULL. */
export type LegacyOrderSeed = {
  readonly id?: string;
  readonly companyId: string;
  readonly orderYear?: number;
  readonly orderSequence?: number;
  readonly recipeId: string;
  readonly quantity?: LegacyDecimal;
  readonly status?: string;
  readonly priority?: string;
  readonly unitId?: string | null;
  readonly customerId?: string | null;
  readonly cancellationReason?: string | null;
  readonly ingredientsCost?: LegacyDecimal | null;
  readonly packagingCost?: LegacyDecimal | null;
  readonly actualCost?: LegacyDecimal | null;
  readonly salePrice?: LegacyDecimal | null;
  readonly reservedAt?: Date | null;
  readonly finishedAt?: Date | null;
  readonly packedBy?: string | null;
  readonly conditionedBy?: string | null;
  readonly createdBy?: string | null;
  readonly updatedBy?: string | null;
  readonly createdAt?: Date;
  readonly deletedAt?: Date | null;
};

/** Un decimal como cadena, numero o `Prisma.Decimal`: se escribe por su texto. */
type LegacyDecimal = string | number | Prisma.Decimal;

function decimalText(value: LegacyDecimal | null | undefined): string | null {
  return value === null || value === undefined ? null : value.toString();
}

/** INSERT crudo en el esquema de `orders` anterior a `orders_drop_line_columns`, que el cliente de
 *  Prisma ya no conoce: lo usan los tests que bajan esa migracion dentro de su transaccion. */
export async function insertLegacyOrder(tx: Prisma.TransactionClient, seed: LegacyOrderSeed): Promise<string> {
  const id = seed.id ?? randomUUID();
  const createdAt = seed.createdAt ?? new Date();
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "orders" (
      "id", "company_id", "order_year", "order_sequence", "recipe_id", "quantity", "status", "priority",
      "unit_id", "customer_id", "cancellation_reason", "ingredients_cost", "packaging_cost", "actual_cost",
      "sale_price", "reserved_at", "finished_at", "packed_by", "conditioned_by", "created_by", "updated_by",
      "created_at", "updated_at", "deleted_at"
    ) VALUES (
      ${id}::uuid, ${seed.companyId}::uuid, ${seed.orderYear ?? createdAt.getUTCFullYear()}::integer,
      ${seed.orderSequence ?? freshSequence()}::integer, ${seed.recipeId}::uuid, ${decimalText(seed.quantity) ?? '10'}::numeric,
      ${seed.status ?? 'PENDIENTE'}::"OrderStatus", ${seed.priority ?? 'BAJA'}::"OrderPriority",
      ${seed.unitId ?? null}::uuid, ${seed.customerId ?? null}::uuid, ${seed.cancellationReason ?? null}::text,
      ${decimalText(seed.ingredientsCost)}::numeric, ${decimalText(seed.packagingCost)}::numeric,
      ${decimalText(seed.actualCost)}::numeric, ${decimalText(seed.salePrice)}::numeric,
      ${seed.reservedAt ?? null}::timestamptz, ${seed.finishedAt ?? null}::timestamptz,
      ${seed.packedBy ?? null}::uuid, ${seed.conditionedBy ?? null}::uuid,
      ${seed.createdBy ?? null}::uuid, ${seed.updatedBy ?? seed.createdBy ?? null}::uuid,
      ${createdAt}::timestamptz, ${createdAt}::timestamptz, ${seed.deletedAt ?? null}::timestamptz
    )
  `);
  return id;
}

/** Las columnas de receta de un pedido en el esquema anterior a `orders_drop_line_columns`, como
 *  cadenas: los decimales con sus 4 decimales y los instantes en ISO. */
export type LegacyOrderColumns = {
  readonly id: string;
  readonly status: string;
  readonly recipe_id: string;
  readonly quantity: string;
  readonly unit_id: string | null;
  readonly cancellation_reason: string | null;
  readonly ingredients_cost: string | null;
  readonly packaging_cost: string | null;
  readonly actual_cost: string | null;
  readonly sale_price: string | null;
  readonly reserved_at: Date | null;
  readonly finished_at: Date | null;
  readonly packed_by: string | null;
  readonly conditioned_by: string | null;
  readonly company_id: string;
  readonly deleted_at: Date | null;
  readonly updated_at: Date;
};

/** Los pedidos `ids` leidos con SQL crudo en el esquema anterior a `orders_drop_line_columns`, por id. */
export async function readLegacyOrders(
  tx: Prisma.TransactionClient,
  ids: readonly string[],
): Promise<readonly LegacyOrderColumns[]> {
  return tx.$queryRaw<LegacyOrderColumns[]>(Prisma.sql`
    SELECT "id"::text AS "id", "status"::text AS "status", "recipe_id"::text AS "recipe_id",
           "quantity"::text AS "quantity", "unit_id"::text AS "unit_id", "cancellation_reason",
           "ingredients_cost"::text AS "ingredients_cost", "packaging_cost"::text AS "packaging_cost",
           "actual_cost"::text AS "actual_cost", "sale_price"::text AS "sale_price", "reserved_at",
           "finished_at", "packed_by"::text AS "packed_by", "conditioned_by"::text AS "conditioned_by",
           "company_id"::text AS "company_id", "deleted_at", "updated_at"
      FROM "orders"
     WHERE "id" = ANY(${[...ids]}::uuid[])
     ORDER BY "id"
  `);
}

/**
 * La unica linea de un pedido en el esquema anterior a `orders_drop_line_columns`: si no la tiene,
 * la crea copiando sus columnas, como el relleno de `order_lines`, y le cuelga el reparto que aun
 * no tenga linea. Devuelve su id.
 */
export async function ensureLegacyOrderLine(tx: Prisma.TransactionClient, orderId: string): Promise<string> {
  const existing = await tx.$queryRaw<ReadonlyArray<{ id: string }>>(Prisma.sql`
    SELECT "id"::text AS "id" FROM "order_lines" WHERE "order_id" = ${orderId}::uuid AND "deleted_at" IS NULL
  `);
  if (existing.length > 1) throw new Error(`el pedido ${orderId} tiene mas de una linea`);
  const found = existing[0];
  if (found !== undefined) return found.id;
  const rows = await tx.$queryRaw<ReadonlyArray<{ id: string }>>(Prisma.sql`
    INSERT INTO "order_lines" (
      "order_id", "company_id", "position", "recipe_id", "original_recipe_id", "quantity", "unit_id",
      "status", "cancellation_reason", "ingredients_cost", "packaging_cost", "actual_cost",
      "sale_price", "reserved_at", "finished_at", "packed_by", "conditioned_by",
      "created_by", "updated_by", "created_at", "updated_at"
    )
    SELECT o."id", o."company_id", 0, o."recipe_id", COALESCE(r."parent_recipe_id", r."id"), o."quantity",
           o."unit_id", o."status", o."cancellation_reason", o."ingredients_cost", o."packaging_cost",
           o."actual_cost", o."sale_price", o."reserved_at", o."finished_at", o."packed_by",
           o."conditioned_by", o."created_by", o."updated_by", o."created_at", o."updated_at"
      FROM "orders" o
      JOIN "recipes" r ON r."id" = o."recipe_id"
     WHERE o."id" = ${orderId}::uuid
    RETURNING "id"::text AS "id"
  `);
  const line = rows[0];
  if (line === undefined) throw new Error(`el pedido ${orderId} no existe`);
  await tx.$executeRaw(Prisma.sql`
    UPDATE "order_presentation_lines"
       SET "order_line_id" = ${line.id}::uuid
     WHERE "order_id" = ${orderId}::uuid
       AND "order_line_id" IS NULL
  `);
  return line.id;
}

/** Si `orders` todavia tiene las columnas de la linea: la base esta por debajo de `orders_drop_line_columns`. */
export async function ordersHaveLineColumns(tx: Prisma.TransactionClient): Promise<boolean> {
  const rows = await tx.$queryRaw<ReadonlyArray<{ exists: boolean }>>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'recipe_id'
    ) AS "exists"
  `);
  return rows[0]?.exists === true;
}

/**
 * Un pedido en `PENDIENTE` del esquema en que este la base: con su receta en la fila si `orders`
 * aun la guarda, o solo la cabecera si no. Su linea, si hace falta, la escribe quien llama.
 */
export async function insertOrderAnySchema(
  tx: Prisma.TransactionClient,
  seed: Pick<LegacyOrderSeed, 'companyId' | 'recipeId'>,
): Promise<string> {
  if (await ordersHaveLineColumns(tx)) return insertLegacyOrder(tx, seed);
  const order = await tx.order.create({
    data: { companyId: seed.companyId, orderYear: new Date().getUTCFullYear(), orderSequence: freshSequence() },
    select: { id: true },
  });
  return order.id;
}
