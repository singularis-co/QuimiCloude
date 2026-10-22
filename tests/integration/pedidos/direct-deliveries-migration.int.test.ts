/**
 * `*_inventory_movement_kind_direct_delivery` y `*_direct_deliveries` contra Postgres real, con su
 * SQL leido de los archivos.
 *
 * AISLAMIENTO: cada caso copia a un esquema de usar y tirar las seis tablas que las migraciones
 * leen, escriben o tienen que dejar intactas (`product_batches`, `order_deliveries`,
 * `order_delivery_lines`, `order_delivery_voids`, `order_delivery_void_lines` e
 * `inventory_movements`) con `LIKE ... INCLUDING ...`, mas una tabla `products` minima con la clave
 * `(company_id, id)` que pide la FK nueva y una copia propia del tipo `InventoryMovementKind`: la
 * columna `kind` de la copia pasa a ese tipo, asi el `down.sql` que recrea el enum no toca el de
 * `public`. Trabaja con `search_path` solo en ese esquema y lo borra con `DROP SCHEMA CASCADE` en
 * `finally`. `LIKE` no conserva nombres de indices, FK ni disparadores: los indices se renombran a
 * los reales, se reponen las FK entre esas tablas (y la del producto) y se recrean los dos
 * disparadores de la migracion con su definicion real. Antes de cada caso se comprueba que la copia
 * tiene las mismas columnas, restricciones e indices que la real. Las FK hacia tablas que no se
 * copian (pedidos, clientes, usuarios, empresas) no estan, asi que esos ids pueden ser inventados.
 *
 * Va por `pg` y no por Prisma: solo su protocolo simple ejecuta de una vez un `.sql` con bloques
 * `$$`, y su error trae `code` como campo.
 */
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

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
const carpetasEnum = readdirSync(migrationsDir).filter((name) => name.endsWith('_inventory_movement_kind_direct_delivery'));
const carpetasEntregas = readdirSync(migrationsDir).filter((name) => name.endsWith('_direct_deliveries'));
const read = (carpeta: string | undefined, file: string): string =>
  readFileSync(join(migrationsDir, carpeta ?? '__no_existe__', file), 'utf8');
const ENUM_UP_SQL = read(carpetasEnum[0], 'migration.sql');
const ENUM_DOWN_SQL = read(carpetasEnum[0], 'down.sql');
const UP_SQL = read(carpetasEntregas[0], 'migration.sql');
const DOWN_SQL = read(carpetasEntregas[0], 'down.sql');

const RAISE_EXCEPTION = 'P0001';
const CHECK_VIOLATION = '23514';

const TABLES = [
  'product_batches',
  'order_deliveries',
  'order_delivery_lines',
  'order_delivery_voids',
  'order_delivery_void_lines',
  'inventory_movements',
] as const;

const NEW_TRIGGERS = [
  ['order_delivery_lines', 'order_delivery_lines_check_origin'],
  ['inventory_movements', 'inventory_movements_check_delivery_origin'],
] as const;

function connectionString(): string {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (url === undefined || url.trim() === '') {
    throw new Error('falta DATABASE_URL (o DIRECT_URL) en el entorno de la corrida de integracion');
  }
  return url;
}

type PgFailure = { readonly code: string; readonly message: string };

async function expectPgRejection(run: () => Promise<unknown>, what: string): Promise<PgFailure> {
  try {
    await run();
  } catch (error) {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      throw new Error(`se esperaba un error de Postgres y llego: ${String(error)}`);
    }
    const campos = error as { code: unknown; message?: unknown };
    return { code: String(campos.code), message: typeof campos.message === 'string' ? campos.message : '' };
  }
  throw new Error(`se esperaba que la base rechazara la operacion, pero la acepto: ${what}`);
}

async function runInTransaction(client: Client, sql: string): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

// --- Catalogo ----------------------------------------------------------------------------------

/** Definicion de un indice sin su nombre ni su esquema: lo que `LIKE` copia. */
function indexShape(indexdef: string): string {
  return indexdef.replace(/^CREATE (UNIQUE )?INDEX \S+ ON \S+ /u, 'CREATE $1INDEX ON _ ');
}

type Catalog = Readonly<Record<string, readonly string[]>>;

/**
 * Columnas, restricciones (sin las FK hacia tablas que no estan en el esquema) e indices de las
 * seis tablas de `schema`. Se lee con `search_path` en ese esquema: las FK y el tipo salen sin
 * prefijo.
 */
async function catalog(client: Client, schema: string): Promise<Catalog> {
  const out: Record<string, string[]> = {};
  for (const table of TABLES) {
    const columns = await client.query<{ line: string }>(
      `SELECT a.attname || ' ' || format_type(a.atttypid, a.atttypmod) || CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END
              || COALESCE(' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid), '') AS line
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE n.nspname = $1 AND c.relname = $2 AND a.attnum > 0 AND NOT a.attisdropped`,
      [schema, table],
    );
    const constraints = await client.query<{ line: string }>(
      `SELECT k.contype::text || ' ' || k.conname || ' ' || pg_get_constraintdef(k.oid) AS line
         FROM pg_constraint k
         JOIN pg_class c ON c.oid = k.conrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_class r ON r.oid = k.confrelid
         LEFT JOIN pg_namespace rn ON rn.oid = r.relnamespace
        WHERE n.nspname = $1 AND c.relname = $2 AND k.contype IN ('p', 'u', 'f', 'c', 'x')
          AND (k.contype <> 'f' OR (rn.nspname = $1 AND r.relname = ANY($3)))`,
      [schema, table, [...TABLES]],
    );
    const indexes = await client.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = $1 AND tablename = $2`,
      [schema, table],
    );
    out[table] = [
      ...columns.rows.map((r) => `col ${r.line}`),
      ...constraints.rows.map((r) => `con ${r.line}`),
      ...indexes.rows.map((r) => `idx ${r.indexname} ${indexShape(r.indexdef)}`),
    ]
      .map((entry) => entry.replaceAll(`"${schema}".`, '').replaceAll(`${schema}.`, '').replaceAll('public.', ''))
      .sort();
  }
  return out;
}

const NEW_OBJECTS = [
  'order_deliveries_order_xor_product',
  'order_deliveries_note_only_direct',
  'order_deliveries_product_id_fkey',
  'order_deliveries_product_id_idx',
] as const;

const REWRITTEN_CHECKS = [
  'inventory_movements_delivery_quantity_negative',
  'inventory_movements_delivery_void_quantity_positive',
  'inventory_movements_order_delivery_id_matches_kind',
  'inventory_movements_order_delivery_void_id_matches_kind',
  'inventory_movements_order_id_matches_kind',
  'inventory_movements_reason_matches_kind',
] as const;

type Shape = {
  readonly kinds: readonly string[];
  readonly nullable: Readonly<Record<string, string>>;
  readonly deliveryColumns: readonly string[];
  readonly objects: readonly string[];
  readonly triggers: readonly string[];
  readonly functions: readonly string[];
  readonly checks: Readonly<Record<string, string>>;
};

/** Lo que distingue el antes y el despues de las dos migraciones en el esquema `schema`. */
async function shape(client: Client, schema: string): Promise<Shape> {
  const kinds = await client.query<{ v: string }>(
    `SELECT e.enumlabel AS v FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = $1 AND t.typname = 'InventoryMovementKind' ORDER BY e.enumsortorder`,
    [schema],
  );
  const nullable = await client.query<{ k: string; is_nullable: string }>(
    `SELECT table_name || '.' || column_name AS k, is_nullable FROM information_schema.columns
      WHERE table_schema = $1 AND ((table_name = 'order_deliveries' AND column_name = 'order_id')
         OR (table_name = 'order_delivery_lines' AND column_name = 'order_presentation_line_id'))`,
    [schema],
  );
  const deliveryColumns = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'order_deliveries' AND column_name IN ('product_id', 'note')`,
    [schema],
  );
  const objects = await client.query<{ name: string }>(
    `SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relname = ANY($2)
     UNION
     SELECT k.conname AS name FROM pg_constraint k JOIN pg_namespace n ON n.oid = k.connamespace
      WHERE n.nspname = $1 AND k.conname = ANY($2)`,
    [schema, [...NEW_OBJECTS]],
  );
  const triggers = await client.query<{ name: string }>(
    `SELECT c.relname || '.' || t.tgname AS name FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND NOT t.tgisinternal`,
    [schema],
  );
  const functions = await client.query<{ name: string }>(
    `SELECT p.proname AS name FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = $1`,
    [schema],
  );
  const checks = await client.query<{ conname: string; def: string }>(
    `SELECT k.conname, pg_get_constraintdef(k.oid) AS def FROM pg_constraint k
       JOIN pg_namespace n ON n.oid = k.connamespace WHERE n.nspname = $1 AND k.conname = ANY($2)`,
    [schema, [...REWRITTEN_CHECKS]],
  );
  return {
    kinds: kinds.rows.map((r) => r.v),
    nullable: Object.fromEntries(nullable.rows.map((r) => [r.k, r.is_nullable])),
    deliveryColumns: deliveryColumns.rows.map((r) => r.column_name).sort(),
    objects: objects.rows.map((r) => r.name).sort(),
    triggers: triggers.rows.map((r) => r.name).sort(),
    functions: functions.rows.map((r) => r.name).sort(),
    checks: Object.fromEntries(checks.rows.map((r) => [r.conname, r.def])),
  };
}

const PREVIOUS_KINDS = ['opening', 'adjustment', 'consumption', 'production', 'delivery', 'delivery_void'];

/** El texto que Postgres imprime de los CHECK antes de la migracion (leido de la base de test). */
const PREVIOUS_CHECKS = {
  inventory_movements_delivery_quantity_negative: `CHECK ((((kind)::text <> 'delivery'::text) OR (quantity < (0)::numeric)))`,
  inventory_movements_delivery_void_quantity_positive: `CHECK ((((kind)::text <> 'delivery_void'::text) OR (quantity > (0)::numeric)))`,
  inventory_movements_order_delivery_id_matches_kind: `CHECK ((((kind)::text = 'delivery'::text) = (order_delivery_id IS NOT NULL)))`,
  inventory_movements_order_delivery_void_id_matches_kind: `CHECK ((((kind)::text = 'delivery_void'::text) = (order_delivery_void_id IS NOT NULL)))`,
  inventory_movements_order_id_matches_kind: `CHECK ((((kind)::text = ANY (ARRAY['consumption'::text, 'production'::text, 'delivery'::text, 'delivery_void'::text])) = (order_id IS NOT NULL)))`,
  inventory_movements_reason_matches_kind: `CHECK (((((kind)::text = 'adjustment'::text) AND (reason IS NOT NULL)) OR (((kind)::text = ANY (ARRAY['opening'::text, 'consumption'::text, 'production'::text, 'delivery'::text, 'delivery_void'::text])) AND (reason IS NULL))))`,
} as const;

const MIGRATED_CHECKS = {
  inventory_movements_delivery_quantity_negative: `CHECK ((((kind)::text <> ALL (ARRAY['delivery'::text, 'direct_delivery'::text])) OR (quantity < (0)::numeric)))`,
  inventory_movements_delivery_void_quantity_positive: `CHECK ((((kind)::text <> ALL (ARRAY['delivery_void'::text, 'direct_delivery_void'::text])) OR (quantity > (0)::numeric)))`,
  inventory_movements_order_delivery_id_matches_kind: `CHECK ((((kind)::text = ANY (ARRAY['delivery'::text, 'direct_delivery'::text])) = (order_delivery_id IS NOT NULL)))`,
  inventory_movements_order_delivery_void_id_matches_kind: `CHECK ((((kind)::text = ANY (ARRAY['delivery_void'::text, 'direct_delivery_void'::text])) = (order_delivery_void_id IS NOT NULL)))`,
  inventory_movements_order_id_matches_kind: PREVIOUS_CHECKS.inventory_movements_order_id_matches_kind,
  inventory_movements_reason_matches_kind: `CHECK (((((kind)::text = 'adjustment'::text) AND (reason IS NOT NULL)) OR (((kind)::text = ANY (ARRAY['opening'::text, 'consumption'::text, 'production'::text, 'delivery'::text, 'delivery_void'::text, 'direct_delivery'::text, 'direct_delivery_void'::text])) AND (reason IS NULL))))`,
} as const;

const MIGRADO: Shape = {
  kinds: [...PREVIOUS_KINDS, 'direct_delivery', 'direct_delivery_void'],
  nullable: { 'order_deliveries.order_id': 'YES', 'order_delivery_lines.order_presentation_line_id': 'YES' },
  deliveryColumns: ['note', 'product_id'],
  objects: [...NEW_OBJECTS].sort(),
  triggers: NEW_TRIGGERS.map(([table, name]) => `${table}.${name}`).sort(),
  functions: NEW_TRIGGERS.map(([, name]) => name).sort(),
  checks: MIGRATED_CHECKS,
};
const PREVIO: Shape = {
  kinds: PREVIOUS_KINDS,
  nullable: { 'order_deliveries.order_id': 'NO', 'order_delivery_lines.order_presentation_line_id': 'NO' },
  deliveryColumns: [],
  objects: [],
  triggers: [],
  functions: [],
  checks: PREVIOUS_CHECKS,
};

// --- Esquema de usar y tirar ----------------------------------------------------------------

/**
 * La copia sale en el estado MIGRADO (las tablas reales ya tienen las dos migraciones). `state:
 * 'previo'` aplica antes los dos DOWN reales, en el orden de un rollback.
 */
async function withSandbox(
  state: 'migrado' | 'previo',
  body: (client: Client, schema: string, migrado: Catalog) => Promise<void>,
): Promise<void> {
  const schema = `qc288_${randomUUID().replace(/-/gu, '').slice(0, 16)}`;
  const client = new Client({ connectionString: connectionString() });
  await client.connect();
  try {
    await client.query('SET search_path TO public');
    const real = await catalog(client, 'public');
    const realIndexes = await client.query<{ tablename: string; indexname: string; indexdef: string }>(
      `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = ANY($1)`,
      [[...TABLES]],
    );
    const realForeignKeys = await client.query<{ tablename: string; conname: string; def: string }>(
      `SELECT c.relname AS tablename, k.conname, pg_get_constraintdef(k.oid) AS def
         FROM pg_constraint k
         JOIN pg_class c ON c.oid = k.conrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_class r ON r.oid = k.confrelid
         JOIN pg_namespace rn ON rn.oid = r.relnamespace
        WHERE k.contype = 'f' AND n.nspname = 'public' AND rn.nspname = 'public' AND c.relname = ANY($1)
          AND (r.relname = ANY($1) OR k.conname = 'order_deliveries_product_id_fkey')`,
      [[...TABLES]],
    );
    const realTriggers: Array<{ functiondef: string; triggerdef: string }> = [];
    for (const [table, name] of NEW_TRIGGERS) {
      const found = await client.query<{ functiondef: string; triggerdef: string }>(
        `SELECT pg_get_functiondef(t.tgfoid) AS functiondef, pg_get_triggerdef(t.oid) AS triggerdef
           FROM pg_trigger t WHERE t.tgrelid = $1::regclass AND t.tgname = $2`,
        [`public.${table}`, name],
      );
      expect(found.rows, `el disparador ${name} existe en public`).toHaveLength(1);
      realTriggers.push(found.rows[0] as { functiondef: string; triggerdef: string });
    }
    const realKinds = await client.query<{ v: string }>(
      `SELECT unnest(enum_range(NULL::"InventoryMovementKind"))::text AS v`,
    );

    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(
      `CREATE TYPE "${schema}"."InventoryMovementKind" AS ENUM (${realKinds.rows.map((r) => `'${r.v}'`).join(', ')})`,
    );
    await client.query(
      `CREATE TABLE "${schema}"."products" ("id" UUID NOT NULL PRIMARY KEY, "company_id" UUID NOT NULL,
         CONSTRAINT "products_company_id_id_key" UNIQUE ("company_id", "id"))`,
    );
    for (const table of TABLES) {
      await client.query(
        `CREATE TABLE "${schema}"."${table}"
           (LIKE public."${table}" INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`,
      );
    }

    // Dos pasadas: un nombre generado por `LIKE` puede coincidir con el nombre real de otro indice.
    const copias = await client.query<{ tablename: string; indexname: string; indexdef: string }>(
      `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = $1 AND tablename = ANY($2)`,
      [schema, [...TABLES]],
    );
    const renames: Array<readonly [string, string]> = [];
    for (const [i, copia] of copias.rows.entries()) {
      const candidatos = realIndexes.rows.filter(
        (r) => r.tablename === copia.tablename && indexShape(r.indexdef) === indexShape(copia.indexdef),
      );
      if (candidatos.length !== 1 || candidatos[0] === undefined) {
        throw new Error(`no se puede emparejar el indice copiado ${copia.indexname}: ${String(candidatos.length)} candidatos`);
      }
      const temporal = `qc288_tmp_${String(i)}`;
      await client.query(`ALTER INDEX "${schema}"."${copia.indexname}" RENAME TO "${temporal}"`);
      renames.push([temporal, candidatos[0].indexname]);
    }
    for (const [temporal, nombre] of renames) {
      await client.query(`ALTER INDEX "${schema}"."${temporal}" RENAME TO "${nombre}"`);
    }

    await client.query(`SET search_path TO "${schema}"`);

    // `kind` pasa al tipo de la copia: los CHECK y el indice que comparan con un literal del tipo
    // se sueltan y se reponen con el mismo texto.
    const typedChecks = await client.query<{ conname: string; def: string }>(
      `SELECT k.conname, pg_get_constraintdef(k.oid) AS def FROM pg_constraint k
        WHERE k.conrelid = '"inventory_movements"'::regclass AND pg_get_constraintdef(k.oid) LIKE '%InventoryMovementKind%'`,
    );
    const typedIndexes = await client.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
        WHERE schemaname = $1 AND tablename = 'inventory_movements' AND indexdef LIKE '%InventoryMovementKind%'`,
      [schema],
    );
    const ownType = (sql: string): string => sql.replaceAll('public."InventoryMovementKind"', '"InventoryMovementKind"');
    for (const check of typedChecks.rows) {
      await client.query(`ALTER TABLE "inventory_movements" DROP CONSTRAINT "${check.conname}"`);
    }
    for (const index of typedIndexes.rows) {
      await client.query(`DROP INDEX "${index.indexname}"`);
    }
    await client.query(
      `ALTER TABLE "inventory_movements" ALTER COLUMN "kind" TYPE "InventoryMovementKind" USING "kind"::text::"InventoryMovementKind"`,
    );
    for (const check of typedChecks.rows) {
      await client.query(`ALTER TABLE "inventory_movements" ADD CONSTRAINT "${check.conname}" ${ownType(check.def)}`);
    }
    for (const index of typedIndexes.rows) {
      await client.query(ownType(index.indexdef.replace(/ ON \S+\.inventory_movements /u, ' ON "inventory_movements" ')));
    }

    for (const fk of realForeignKeys.rows) {
      await client.query(`ALTER TABLE "${fk.tablename}" ADD CONSTRAINT "${fk.conname}" ${fk.def}`);
    }
    for (const trigger of realTriggers) {
      await client.query(trigger.functiondef.replace('FUNCTION public.', 'FUNCTION '));
      await client.query(trigger.triggerdef.replace(/ ON public\./u, ' ON '));
    }
    for (const table of TABLES) {
      await client.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await client.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
    }

    // Si la copia no fuera fiel, el SQL podria funcionar sobre tablas distintas de las reales.
    const migrado = await catalog(client, schema);
    expect(migrado).toEqual(real);
    expect(await shape(client, schema)).toEqual(MIGRADO);

    if (state === 'previo') {
      await runInTransaction(client, DOWN_SQL);
      await runInTransaction(client, ENUM_DOWN_SQL);
      expect(await shape(client, schema)).toEqual(PREVIO);
    }
    await body(client, schema, migrado);
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.query('RESET search_path').catch(() => undefined);
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
    await client.end();
  }
}

// --- Filas ----------------------------------------------------------------------------------

async function product(client: Client, companyId: string): Promise<string> {
  const id = randomUUID();
  await client.query(`INSERT INTO "products" ("id", "company_id") VALUES ($1::uuid, $2::uuid)`, [id, companyId]);
  return id;
}

async function batch(client: Client, companyId: string, productId: string, stock: string): Promise<string> {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "product_batches"
       ("id", "product_id", "presentation_id", "stock", "unit_cost", "lot", "purchase_date", "company_id", "updated_at")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::numeric, 1.0000, $5, DATE '2026-10-01', $6::uuid, now())`,
    [id, productId, randomUUID(), stock, `L-${id.slice(0, 8)}`, companyId],
  );
  return id;
}

async function orderDelivery(client: Client, companyId: string): Promise<{ id: string; orderId: string }> {
  const id = randomUUID();
  const orderId = randomUUID();
  await client.query(
    `INSERT INTO "order_deliveries" ("id", "company_id", "order_id", "delivery_key", "created_by")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid)`,
    [id, companyId, orderId, randomUUID(), randomUUID()],
  );
  return { id, orderId };
}

/** Solo en el estado migrado: la entrega sin pedido no existe antes. */
async function directDelivery(client: Client, companyId: string, productId: string): Promise<string> {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "order_deliveries" ("id", "company_id", "product_id", "note", "delivery_key", "created_by")
     VALUES ($1::uuid, $2::uuid, $3::uuid, 'Venta de mostrador', $4::uuid, $5::uuid)`,
    [id, companyId, productId, randomUUID(), randomUUID()],
  );
  return id;
}

async function line(
  client: Client,
  row: { companyId: string; deliveryId: string; batchId: string; packages: number; presentationLineId: string | null },
): Promise<string> {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "order_delivery_lines"
       ("id", "company_id", "delivery_id", "customer_id", "order_presentation_line_id", "batch_id", "packages", "quantity")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, $7::int, $8::numeric)`,
    [id, row.companyId, row.deliveryId, randomUUID(), row.presentationLineId, row.batchId, row.packages, (row.packages * 1.25).toFixed(4)],
  );
  return id;
}

async function movement(
  client: Client,
  row: {
    companyId: string;
    batchId: string;
    kind: string;
    quantity: string;
    orderId: string | null;
    orderDeliveryId?: string;
    orderDeliveryVoidId?: string;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO "inventory_movements" ("id", "batch_id", "kind", "quantity", "company_id", "order_id", "order_delivery_id", "order_delivery_void_id")
     VALUES ($1::uuid, $2::uuid, $3::text::"InventoryMovementKind", $4::numeric, $5::uuid, $6::uuid, $7::uuid, $8::uuid)`,
    [
      randomUUID(),
      row.batchId,
      row.kind,
      row.quantity,
      row.companyId,
      row.orderId,
      row.orderDeliveryId ?? null,
      row.orderDeliveryVoidId ?? null,
    ],
  );
}

async function voidLines(
  client: Client,
  row: { companyId: string; deliveryId: string; deliveryLineIds: readonly string[] },
): Promise<string> {
  const voidId = randomUUID();
  await client.query(
    `INSERT INTO "order_delivery_voids" ("id", "company_id", "delivery_id", "void_key", "reason", "created_by")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'Devuelto por el cliente', $5::uuid)`,
    [voidId, row.companyId, row.deliveryId, randomUUID(), randomUUID()],
  );
  for (const deliveryLineId of row.deliveryLineIds) {
    await client.query(
      `INSERT INTO "order_delivery_void_lines" ("id", "company_id", "void_id", "delivery_id", "delivery_line_id")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid)`,
      [randomUUID(), row.companyId, voidId, row.deliveryId, deliveryLineId],
    );
  }
  return voidId;
}

/**
 * Entregas de pedido de dos empresas, con lineas, asientos de salida, una anulacion con su asiento
 * de devolucion y asientos de apertura: lo que ya existe cuando se aplica la migracion.
 */
async function seedOrderDeliveries(client: Client): Promise<void> {
  const empresaA = randomUUID();
  const empresaB = randomUUID();
  const productoA = await product(client, empresaA);
  const productoB = await product(client, empresaB);
  const loteA1 = await batch(client, empresaA, productoA, '6.2500');
  const loteA2 = await batch(client, empresaA, productoA, '4.0000');
  const loteB = await batch(client, empresaB, productoB, '9.0000');
  for (const [companyId, batchId, quantity] of [
    [empresaA, loteA1, '10.0000'],
    [empresaA, loteA2, '5.2500'],
    [empresaB, loteB, '10.2500'],
  ] as const) {
    await movement(client, { companyId, batchId, kind: 'opening', quantity, orderId: null });
  }

  const entrega1 = await orderDelivery(client, empresaA);
  const l1 = await line(client, { companyId: empresaA, deliveryId: entrega1.id, batchId: loteA1, packages: 2, presentationLineId: randomUUID() });
  const l2 = await line(client, { companyId: empresaA, deliveryId: entrega1.id, batchId: loteA2, packages: 1, presentationLineId: randomUUID() });
  await movement(client, { companyId: empresaA, batchId: loteA1, kind: 'delivery', quantity: '-2.5000', orderId: entrega1.orderId, orderDeliveryId: entrega1.id });
  await movement(client, { companyId: empresaA, batchId: loteA2, kind: 'delivery', quantity: '-1.2500', orderId: entrega1.orderId, orderDeliveryId: entrega1.id });
  const anulacion = await voidLines(client, { companyId: empresaA, deliveryId: entrega1.id, deliveryLineIds: [l2] });
  await movement(client, { companyId: empresaA, batchId: loteA2, kind: 'delivery_void', quantity: '1.2500', orderId: entrega1.orderId, orderDeliveryVoidId: anulacion });
  expect(l1).not.toBe(l2);

  const entrega2 = await orderDelivery(client, empresaA);
  await line(client, { companyId: empresaA, deliveryId: entrega2.id, batchId: loteA1, packages: 1, presentationLineId: randomUUID() });
  await movement(client, { companyId: empresaA, batchId: loteA1, kind: 'delivery', quantity: '-1.2500', orderId: entrega2.orderId, orderDeliveryId: entrega2.id });

  const entrega3 = await orderDelivery(client, empresaB);
  await line(client, { companyId: empresaB, deliveryId: entrega3.id, batchId: loteB, packages: 1, presentationLineId: randomUUID() });
  await movement(client, { companyId: empresaB, batchId: loteB, kind: 'delivery', quantity: '-1.2500', orderId: entrega3.orderId, orderDeliveryId: entrega3.id });
}

/** Todas las filas de las tablas de la copia, sin las dos columnas que anade la migracion. */
async function snapshot(client: Client): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const table of [...TABLES, 'products']) {
    const rows = await client.query<{ r: unknown }>(
      `SELECT to_jsonb(t) - 'product_id' - 'note' AS r FROM "${table}" AS t ORDER BY t."id"`,
    );
    out[table] = rows.rows.map((row) => row.r);
  }
  return out;
}

async function deliveriesWithProductOrNote(client: Client): Promise<number> {
  const rows = await client.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM "order_deliveries" WHERE "product_id" IS NOT NULL OR "note" IS NOT NULL`,
  );
  return Number(rows.rows[0]?.n);
}

// --- Casos ----------------------------------------------------------------------------------

describe('QC-288 — migraciones de la entrega sin pedido contra Postgres real', () => {
  it('R42: existe exactamente una carpeta de cada migracion y la del tipo va antes', () => {
    expect(carpetasEnum).toHaveLength(1);
    expect(carpetasEntregas).toHaveLength(1);
    expect((carpetasEnum[0] ?? '') < (carpetasEntregas[0] ?? '')).toBe(true);
  });

  it('R42: el UP de las dos sobre entregas de pedido con anulaciones no cambia entregas, lineas, anulaciones, asientos ni existencias', async () => {
    await withSandbox('previo', async (client, schema, migrado) => {
      await seedOrderDeliveries(client);
      const antes = await snapshot(client);

      await runInTransaction(client, ENUM_UP_SQL);
      await runInTransaction(client, UP_SQL);

      expect(await shape(client, schema)).toEqual(MIGRADO);
      expect(await snapshot(client)).toEqual(antes);
      expect(await deliveriesWithProductOrNote(client)).toBe(0);
      expect(await catalog(client, schema)).toEqual(migrado);
    });
  });

  it('R42: sin entregas sin pedido, el DOWN de las dos deja el esquema previo sin tocar filas, y el UP lo vuelve a dejar igual', async () => {
    await withSandbox('migrado', async (client, schema, migrado) => {
      await seedOrderDeliveries(client);
      const antes = await snapshot(client);

      await runInTransaction(client, DOWN_SQL);
      await runInTransaction(client, ENUM_DOWN_SQL);

      expect(await shape(client, schema)).toEqual(PREVIO);
      expect(await snapshot(client)).toEqual(antes);

      await runInTransaction(client, ENUM_UP_SQL);
      await runInTransaction(client, UP_SQL);

      expect(await shape(client, schema)).toEqual(MIGRADO);
      expect(await snapshot(client)).toEqual(antes);
      expect(await catalog(client, schema)).toEqual(migrado);
    });
  });

  it('R42: con una entrega sin pedido, el DOWN aborta entero con su mensaje y no cambia nada', async () => {
    await withSandbox('migrado', async (client, schema) => {
      await seedOrderDeliveries(client);
      const empresa = randomUUID();
      const producto = await product(client, empresa);
      const lote = await batch(client, empresa, producto, '3.0000');
      await directDelivery(client, empresa, producto);
      expect(lote).toBeTruthy();
      const antes = await snapshot(client);

      const rechazo = await expectPgRejection(() => runInTransaction(client, DOWN_SQL), 'DOWN con una entrega sin pedido');

      expect(rechazo.code).toBe(RAISE_EXCEPTION);
      expect(rechazo.message).toContain('ROLLBACK ABORTADO: hay 1 entrega(s) sin pedido');
      expect(await shape(client, schema)).toEqual(MIGRADO);
      expect(await snapshot(client)).toEqual(antes);
      expect(await deliveriesWithProductOrNote(client)).toBe(1);
    });
  });

  it('R42: con asientos de entrega sin pedido y de su anulacion, el DOWN de las dos migraciones aborta y no cambia nada', async () => {
    await withSandbox('migrado', async (client, schema) => {
      await seedOrderDeliveries(client);
      const empresa = randomUUID();
      const producto = await product(client, empresa);
      const lote = await batch(client, empresa, producto, '3.7500');
      await movement(client, { companyId: empresa, batchId: lote, kind: 'opening', quantity: '5.0000', orderId: null });
      const entrega = await directDelivery(client, empresa, producto);
      const linea = await line(client, { companyId: empresa, deliveryId: entrega, batchId: lote, packages: 2, presentationLineId: null });
      await movement(client, { companyId: empresa, batchId: lote, kind: 'direct_delivery', quantity: '-2.5000', orderId: null, orderDeliveryId: entrega });
      const anulacion = await voidLines(client, { companyId: empresa, deliveryId: entrega, deliveryLineIds: [linea] });
      await movement(client, { companyId: empresa, batchId: lote, kind: 'direct_delivery_void', quantity: '2.5000', orderId: null, orderDeliveryVoidId: anulacion });
      const antes = await snapshot(client);

      const rechazo = await expectPgRejection(() => runInTransaction(client, DOWN_SQL), 'DOWN con asientos de tipo nuevo');
      expect(rechazo.code).toBe(RAISE_EXCEPTION);
      expect(rechazo.message).toContain('ROLLBACK ABORTADO');
      expect(await shape(client, schema)).toEqual(MIGRADO);
      expect(await snapshot(client)).toEqual(antes);

      // El DOWN del tipo tambien se niega solo: borrar el valor dejaria esos asientos sin representar.
      const rechazoTipo = await expectPgRejection(() => runInTransaction(client, ENUM_DOWN_SQL), 'DOWN del tipo con asientos de tipo nuevo');
      expect(rechazoTipo.code).toBe(CHECK_VIOLATION);
      expect(rechazoTipo.message).toContain('inventory_movement_kind_direct_delivery_in_use');
      expect(await shape(client, schema)).toEqual(MIGRADO);
      expect(await snapshot(client)).toEqual(antes);
    });
  });
});
