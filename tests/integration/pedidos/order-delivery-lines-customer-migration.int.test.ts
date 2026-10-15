/**
 * `*_order_delivery_lines_customer` contra Postgres real, con su SQL leido del archivo.
 *
 * AISLAMIENTO: cada caso copia a un esquema de usar y tirar las siete tablas que la migracion lee,
 * escribe o referencia, o que tienen que quedar intactas (`customers`, `product_batches`,
 * `order_deliveries`, `order_delivery_lines`, `order_delivery_voids`, `order_delivery_void_lines` e
 * `inventory_movements`), con `LIKE ... INCLUDING ...`; trabaja ahi con `search_path` solo en ese
 * esquema y lo borra con `DROP SCHEMA CASCADE` en `finally`. Asi el DDL del UP y del DOWN no bloquea
 * las tablas reales que usan los demas archivos. `LIKE` no conserva los nombres de los indices ni las
 * FK: los indices se renombran a los reales y se reponen las FK entre esas siete tablas, y antes de
 * cada caso se comprueba que la copia tiene las mismas columnas, restricciones e indices que la
 * real. Las FK hacia tablas que no se copian (pedidos, usuarios, empresas) no estan, asi que esos
 * ids pueden ser inventados.
 *
 * Va por `pg` y no por Prisma: solo su protocolo simple ejecuta de una vez un `.sql` con un bloque
 * `DO $$`, y su error trae `code` como campo.
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
const carpetas = readdirSync(migrationsDir).filter((name) => name.endsWith('_order_delivery_lines_customer'));
const migrationDir = join(migrationsDir, carpetas[0] ?? '__no_existe__');
const UP_SQL = readFileSync(join(migrationDir, 'migration.sql'), 'utf8');
const DOWN_SQL = readFileSync(join(migrationDir, 'down.sql'), 'utf8');

const RAISE_EXCEPTION = 'P0001';

const TABLES = [
  'customers',
  'product_batches',
  'order_deliveries',
  'order_delivery_lines',
  'order_delivery_voids',
  'order_delivery_void_lines',
  'inventory_movements',
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
 * siete tablas de `schema`. Se lee con `search_path` en ese esquema: las FK salen sin prefijo.
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
    // Un nombre de otro esquema sale con prefijo segun el `search_path`; se quita para comparar.
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

const CUSTOMER_OBJECTS = [
  'order_deliveries_customer_id_fkey',
  'order_deliveries_customer_id_idx',
  'order_delivery_lines_customer_id_fkey',
  'order_delivery_lines_customer_id_idx',
  'order_delivery_lines_delivery_batch_unique',
  'order_delivery_lines_delivery_customer_batch_unique',
] as const;

type Shape = {
  readonly deliveriesHaveCustomer: boolean;
  readonly linesHaveCustomer: boolean;
  readonly objects: readonly string[];
  readonly rlsForced: readonly boolean[];
};

/** Lo que distingue el antes y el despues de la migracion en el esquema `schema`. */
async function shape(client: Client, schema: string): Promise<Shape> {
  const cols = await client.query<{ table_name: string; is_nullable: string }>(
    `SELECT table_name, is_nullable FROM information_schema.columns
      WHERE table_schema = $1 AND column_name = 'customer_id' AND table_name IN ('order_deliveries', 'order_delivery_lines')`,
    [schema],
  );
  const byTable = new Map(cols.rows.map((r) => [r.table_name, r.is_nullable]));
  for (const nullable of byTable.values()) expect(nullable).toBe('NO');
  const objects = await client.query<{ name: string }>(
    `SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relname = ANY($2)
     UNION
     SELECT k.conname AS name FROM pg_constraint k JOIN pg_namespace n ON n.oid = k.connamespace
      WHERE n.nspname = $1 AND k.conname = ANY($2)`,
    [schema, [...CUSTOMER_OBJECTS]],
  );
  const rls = await client.query<{ relname: string; forced: boolean }>(
    `SELECT c.relname, c.relforcerowsecurity AS forced FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relname IN ('order_deliveries', 'order_delivery_lines') ORDER BY c.relname`,
    [schema],
  );
  return {
    deliveriesHaveCustomer: byTable.has('order_deliveries'),
    linesHaveCustomer: byTable.has('order_delivery_lines'),
    objects: objects.rows.map((r) => r.name).sort(),
    rlsForced: rls.rows.map((r) => r.forced),
  };
}

const MIGRADO: Shape = {
  deliveriesHaveCustomer: false,
  linesHaveCustomer: true,
  objects: [
    'order_delivery_lines_customer_id_fkey',
    'order_delivery_lines_customer_id_idx',
    'order_delivery_lines_delivery_customer_batch_unique',
  ],
  rlsForced: [true, true],
};
const PREVIO: Shape = {
  deliveriesHaveCustomer: true,
  linesHaveCustomer: false,
  objects: [
    'order_deliveries_customer_id_fkey',
    'order_deliveries_customer_id_idx',
    'order_delivery_lines_delivery_batch_unique',
  ],
  rlsForced: [true, true],
};

// --- Esquema de usar y tirar ----------------------------------------------------------------

/**
 * La copia sale en el estado MIGRADO (las tablas reales ya tienen esta migracion). `state:
 * 'previo'` aplica antes el DOWN real para dejarla como estaba antes de migrar.
 */
async function withSandbox(
  state: 'migrado' | 'previo',
  body: (client: Client, schema: string, migrado: Catalog) => Promise<void>,
): Promise<void> {
  const schema = `qc282_${randomUUID().replace(/-/gu, '').slice(0, 16)}`;
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
        WHERE k.contype = 'f' AND n.nspname = 'public' AND rn.nspname = 'public'
          AND c.relname = ANY($1) AND r.relname = ANY($1)`,
      [[...TABLES]],
    );

    await client.query(`CREATE SCHEMA "${schema}"`);
    for (const table of TABLES) {
      await client.query(
        `CREATE TABLE "${schema}"."${table}"
           (LIKE public."${table}" INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`,
      );
    }

    // Dos pasadas: un nombre generado por `LIKE` puede coincidir con el nombre real de otro indice.
    const copias = await client.query<{ tablename: string; indexname: string; indexdef: string }>(
      `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = $1`,
      [schema],
    );
    const renames: Array<readonly [string, string]> = [];
    for (const [i, copia] of copias.rows.entries()) {
      const candidatos = realIndexes.rows.filter(
        (r) => r.tablename === copia.tablename && indexShape(r.indexdef) === indexShape(copia.indexdef),
      );
      if (candidatos.length !== 1 || candidatos[0] === undefined) {
        throw new Error(`no se puede emparejar el indice copiado ${copia.indexname}: ${String(candidatos.length)} candidatos`);
      }
      const temporal = `qc282_tmp_${String(i)}`;
      await client.query(`ALTER INDEX "${schema}"."${copia.indexname}" RENAME TO "${temporal}"`);
      renames.push([temporal, candidatos[0].indexname]);
    }
    for (const [temporal, nombre] of renames) {
      await client.query(`ALTER INDEX "${schema}"."${temporal}" RENAME TO "${nombre}"`);
    }

    await client.query(`SET search_path TO "${schema}"`);
    for (const fk of realForeignKeys.rows) {
      await client.query(`ALTER TABLE "${fk.tablename}" ADD CONSTRAINT "${fk.conname}" ${fk.def}`);
    }
    for (const table of ['order_deliveries', 'order_delivery_lines']) {
      await client.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await client.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
    }

    // Si la copia no fuera fiel, el SQL podria funcionar sobre tablas distintas de las reales.
    const migrado = await catalog(client, schema);
    expect(migrado).toEqual(real);
    expect(await shape(client, schema)).toEqual(MIGRADO);

    if (state === 'previo') {
      await runInTransaction(client, DOWN_SQL);
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

async function customer(client: Client, companyId: string): Promise<string> {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "customers" ("id", "first_names", "last_names", "city", "company_id", "updated_at",
                              "first_names_normalized", "last_names_normalized", "city_normalized")
     VALUES ($1::uuid, 'Luis', 'Rojas', 'Cali', $2::uuid, now(), 'luis', 'rojas', 'cali')`,
    [id, companyId],
  );
  return id;
}

async function batch(client: Client, companyId: string, stock: string): Promise<string> {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "product_batches"
       ("id", "product_id", "presentation_id", "stock", "unit_cost", "lot", "purchase_date", "company_id", "updated_at")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::numeric, 1.0000, $5, DATE '2026-10-01', $6::uuid, now())`,
    [id, randomUUID(), randomUUID(), stock, `L-${id.slice(0, 8)}`, companyId],
  );
  return id;
}

/** `customerId` solo se escribe en el estado previo, cuando la entrega todavia lo guarda. */
async function delivery(client: Client, companyId: string, customerId: string | null): Promise<string> {
  const id = randomUUID();
  if (customerId === null) {
    await client.query(
      `INSERT INTO "order_deliveries" ("id", "company_id", "order_id", "delivery_key", "created_by")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid)`,
      [id, companyId, randomUUID(), randomUUID(), randomUUID()],
    );
  } else {
    await client.query(
      `INSERT INTO "order_deliveries" ("id", "company_id", "order_id", "customer_id", "delivery_key", "created_by")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid)`,
      [id, companyId, randomUUID(), customerId, randomUUID(), randomUUID()],
    );
  }
  return id;
}

/** `customerId` solo se escribe en el estado migrado, cuando la linea ya lo guarda. */
async function line(
  client: Client,
  row: { companyId: string; deliveryId: string; batchId: string; packages: number; customerId: string | null },
): Promise<string> {
  const id = randomUUID();
  const withCustomer = row.customerId !== null;
  await client.query(
    `INSERT INTO "order_delivery_lines"
       ("id", "company_id", "delivery_id", ${withCustomer ? '"customer_id", ' : ''}"order_presentation_line_id", "batch_id", "packages", "quantity")
     VALUES ($1::uuid, $2::uuid, $3::uuid, ${withCustomer ? '$8::uuid, ' : ''}$4::uuid, $5::uuid, $6::int, $7::numeric)`,
    [
      id,
      row.companyId,
      row.deliveryId,
      randomUUID(),
      row.batchId,
      row.packages,
      (row.packages * 1.25).toFixed(4),
      ...(withCustomer ? [row.customerId] : []),
    ],
  );
  return id;
}

async function deliveryMovement(client: Client, companyId: string, deliveryId: string, batchId: string, quantity: string): Promise<void> {
  await client.query(
    `INSERT INTO "inventory_movements" ("id", "batch_id", "kind", "quantity", "company_id", "order_id", "order_delivery_id")
     VALUES ($1::uuid, $2::uuid, 'delivery', $3::numeric, $4::uuid, $5::uuid, $6::uuid)`,
    [randomUUID(), batchId, quantity, companyId, randomUUID(), deliveryId],
  );
}

/** Una anulacion de `deliveryLineIds` con su asiento de devolucion sobre `batchId`. */
async function voidLines(
  client: Client,
  row: { companyId: string; deliveryId: string; deliveryLineIds: readonly string[]; batchId: string; quantity: string },
): Promise<void> {
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
  await client.query(
    `INSERT INTO "inventory_movements" ("id", "batch_id", "kind", "quantity", "company_id", "order_id", "order_delivery_void_id")
     VALUES ($1::uuid, $2::uuid, 'delivery_void', $3::numeric, $4::uuid, $5::uuid, $6::uuid)`,
    [randomUUID(), row.batchId, row.quantity, row.companyId, randomUUID(), voidId],
  );
}

/** Todas las filas de las siete tablas, sin la columna del cliente de entregas y lineas. */
async function snapshot(client: Client): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    const rows = await client.query<{ r: unknown }>(
      `SELECT to_jsonb(t) - 'customer_id' AS r FROM "${table}" AS t ORDER BY t."id"`,
    );
    out[table] = rows.rows.map((row) => row.r);
  }
  return out;
}

async function customersOf(client: Client, table: 'order_deliveries' | 'order_delivery_lines'): Promise<Record<string, string>> {
  const rows = await client.query<{ id: string; customer_id: string }>(
    `SELECT "id"::text AS id, "customer_id"::text AS customer_id FROM "${table}"`,
  );
  return Object.fromEntries(rows.rows.map((r) => [r.id, r.customer_id]));
}

// --- Casos ----------------------------------------------------------------------------------

describe('QC-282 — migracion order_delivery_lines_customer contra Postgres real', () => {
  it('R31: existe exactamente una carpeta de la migracion', () => {
    expect(carpetas).toHaveLength(1);
  });

  it('R31: el UP da a cada linea el cliente de su entrega, quita el de la entrega y no cambia envases, cantidades, anulaciones, asientos ni existencias', async () => {
    await withSandbox('previo', async (client, schema) => {
      const empresaA = randomUUID();
      const empresaB = randomUUID();
      const garcia = await customer(client, empresaA);
      const lopez = await customer(client, empresaA);
      const otraEmpresa = await customer(client, empresaB);
      const loteA1 = await batch(client, empresaA, '8');
      const loteA2 = await batch(client, empresaA, '4');
      const loteB = await batch(client, empresaB, '9');

      const entrega1 = await delivery(client, empresaA, garcia);
      const l1 = await line(client, { companyId: empresaA, deliveryId: entrega1, batchId: loteA1, packages: 2, customerId: null });
      const l2 = await line(client, { companyId: empresaA, deliveryId: entrega1, batchId: loteA2, packages: 1, customerId: null });
      await deliveryMovement(client, empresaA, entrega1, loteA1, '-2.5000');
      await deliveryMovement(client, empresaA, entrega1, loteA2, '-1.2500');
      const entrega2 = await delivery(client, empresaA, lopez);
      const l3 = await line(client, { companyId: empresaA, deliveryId: entrega2, batchId: loteA1, packages: 3, customerId: null });
      await deliveryMovement(client, empresaA, entrega2, loteA1, '-3.7500');
      const entrega3 = await delivery(client, empresaB, otraEmpresa);
      const l4 = await line(client, { companyId: empresaB, deliveryId: entrega3, batchId: loteB, packages: 1, customerId: null });
      await deliveryMovement(client, empresaB, entrega3, loteB, '-1.2500');
      // Una anulacion previa de la segunda linea de la primera entrega.
      await voidLines(client, { companyId: empresaA, deliveryId: entrega1, deliveryLineIds: [l2], batchId: loteA2, quantity: '1.2500' });

      const antes = await snapshot(client);
      expect(await customersOf(client, 'order_deliveries')).toEqual({
        [entrega1]: garcia,
        [entrega2]: lopez,
        [entrega3]: otraEmpresa,
      });

      await runInTransaction(client, UP_SQL);

      expect(await shape(client, schema)).toEqual(MIGRADO);
      expect(await customersOf(client, 'order_delivery_lines')).toEqual({
        [l1]: garcia,
        [l2]: garcia,
        [l3]: lopez,
        [l4]: otraEmpresa,
      });
      expect(await snapshot(client)).toEqual(antes);
    });
  });

  it('R32: con una entrega sin lineas, el UP aborta entero con su mensaje y no cambia nada', async () => {
    await withSandbox('previo', async (client, schema) => {
      const empresaA = randomUUID();
      const empresaB = randomUUID();
      const garcia = await customer(client, empresaA);
      const otraEmpresa = await customer(client, empresaB);
      const lote = await batch(client, empresaA, '5');
      const conLineas = await delivery(client, empresaA, garcia);
      await line(client, { companyId: empresaA, deliveryId: conLineas, batchId: lote, packages: 1, customerId: null });
      const sinLineasA = await delivery(client, empresaA, garcia);
      const sinLineasB = await delivery(client, empresaB, otraEmpresa);
      const antes = await snapshot(client);

      const rechazo = await expectPgRejection(() => runInTransaction(client, UP_SQL), 'UP con entregas sin lineas');

      expect(rechazo.code).toBe(RAISE_EXCEPTION);
      expect(rechazo.message).toContain('MIGRACION ABORTADA');
      expect(rechazo.message).toContain('hay 2 entrega(s) sin lineas');
      expect(await shape(client, schema)).toEqual(PREVIO);
      expect(await snapshot(client)).toEqual(antes);
      expect(await customersOf(client, 'order_deliveries')).toEqual({
        [conLineas]: garcia,
        [sinLineasA]: garcia,
        [sinLineasB]: otraEmpresa,
      });
    });
  });

  it('R32: con un cliente por entrega, el DOWN se lo devuelve a la entrega, quita el de las lineas y el UP vuelve a dejar la copia igual', async () => {
    await withSandbox('migrado', async (client, schema, migrado) => {
      const empresa = randomUUID();
      const garcia = await customer(client, empresa);
      const lopez = await customer(client, empresa);
      const lote1 = await batch(client, empresa, '6');
      const lote2 = await batch(client, empresa, '6');
      const entrega1 = await delivery(client, empresa, null);
      const l1 = await line(client, { companyId: empresa, deliveryId: entrega1, batchId: lote1, packages: 2, customerId: garcia });
      const l2 = await line(client, { companyId: empresa, deliveryId: entrega1, batchId: lote2, packages: 1, customerId: garcia });
      await deliveryMovement(client, empresa, entrega1, lote1, '-2.5000');
      await deliveryMovement(client, empresa, entrega1, lote2, '-1.2500');
      const entrega2 = await delivery(client, empresa, null);
      const l3 = await line(client, { companyId: empresa, deliveryId: entrega2, batchId: lote1, packages: 1, customerId: lopez });
      await deliveryMovement(client, empresa, entrega2, lote1, '-1.2500');
      await voidLines(client, { companyId: empresa, deliveryId: entrega2, deliveryLineIds: [l3], batchId: lote1, quantity: '1.2500' });
      const antes = await snapshot(client);

      await runInTransaction(client, DOWN_SQL);

      expect(await shape(client, schema)).toEqual(PREVIO);
      expect(await customersOf(client, 'order_deliveries')).toEqual({ [entrega1]: garcia, [entrega2]: lopez });
      expect(await snapshot(client)).toEqual(antes);

      await runInTransaction(client, UP_SQL);

      expect(await shape(client, schema)).toEqual(MIGRADO);
      expect(await customersOf(client, 'order_delivery_lines')).toEqual({ [l1]: garcia, [l2]: garcia, [l3]: lopez });
      expect(await snapshot(client)).toEqual(antes);
      expect(await catalog(client, schema)).toEqual(migrado);
    });
  });

  it('R32: con una entrega de dos clientes, el DOWN aborta entero con su mensaje y no cambia nada', async () => {
    await withSandbox('migrado', async (client, schema) => {
      const empresa = randomUUID();
      const garcia = await customer(client, empresa);
      const lopez = await customer(client, empresa);
      const lote = await batch(client, empresa, '9');
      const compartida = await delivery(client, empresa, null);
      const l1 = await line(client, { companyId: empresa, deliveryId: compartida, batchId: lote, packages: 2, customerId: garcia });
      const l2 = await line(client, { companyId: empresa, deliveryId: compartida, batchId: lote, packages: 3, customerId: lopez });
      await deliveryMovement(client, empresa, compartida, lote, '-6.2500');
      const deUno = await delivery(client, empresa, null);
      const l3 = await line(client, { companyId: empresa, deliveryId: deUno, batchId: lote, packages: 1, customerId: lopez });
      const antes = await snapshot(client);

      const rechazo = await expectPgRejection(() => runInTransaction(client, DOWN_SQL), 'DOWN con dos clientes en una entrega');

      expect(rechazo.code).toBe(RAISE_EXCEPTION);
      expect(rechazo.message).toContain('ROLLBACK ABORTADO');
      expect(rechazo.message).toContain('hay 1 entrega(s) con lineas de mas de un cliente');
      expect(await shape(client, schema)).toEqual(MIGRADO);
      expect(await snapshot(client)).toEqual(antes);
      expect(await customersOf(client, 'order_delivery_lines')).toEqual({ [l1]: garcia, [l2]: lopez, [l3]: lopez });
    });
  });

  it('R32: con una entrega sin lineas, el DOWN aborta entero: su cliente no se puede reconstruir', async () => {
    await withSandbox('migrado', async (client, schema) => {
      const empresa = randomUUID();
      const garcia = await customer(client, empresa);
      const lote = await batch(client, empresa, '3');
      const conLineas = await delivery(client, empresa, null);
      await line(client, { companyId: empresa, deliveryId: conLineas, batchId: lote, packages: 1, customerId: garcia });
      await delivery(client, empresa, null);
      const antes = await snapshot(client);

      const rechazo = await expectPgRejection(() => runInTransaction(client, DOWN_SQL), 'DOWN con una entrega sin lineas');

      expect(rechazo.code).toBe(RAISE_EXCEPTION);
      expect(rechazo.message).toContain('ROLLBACK ABORTADO: hay 1 entrega(s) sin lineas');
      expect(await shape(client, schema)).toEqual(MIGRADO);
      expect(await snapshot(client)).toEqual(antes);
    });
  });
});
