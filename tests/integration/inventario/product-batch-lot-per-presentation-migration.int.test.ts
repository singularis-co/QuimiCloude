/**
 * `*_product_batches_lot_per_presentation` contra Postgres real, con su SQL leido del archivo.
 *
 * AISLAMIENTO: cada caso copia `public.product_batches` a un esquema de usar y tirar (`LIKE ...
 * INCLUDING ALL`), trabaja ahi con `search_path` solo en ese esquema y lo borra con `DROP SCHEMA
 * CASCADE` en `finally`. Asi el `DROP INDEX` del UP y del DOWN no bloquea la tabla real que usan los
 * demas archivos. `LIKE` no conserva los nombres de los indices: se renombran a los reales para que
 * el SQL los encuentre. La copia no trae FK ni disparadores, asi que los ids de producto y
 * presentacion pueden ser inventados.
 *
 * Va por `pg` y no por Prisma: solo su protocolo simple ejecuta de una vez un `.sql` con un bloque
 * `DO $$`, y su error trae `code` y `constraint` como campos.
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
const carpetas = readdirSync(migrationsDir).filter((name) => name.endsWith('_product_batches_lot_per_presentation'));
const migrationDir = join(migrationsDir, carpetas[0] ?? '__no_existe__');
const UP_SQL = readFileSync(join(migrationDir, 'migration.sql'), 'utf8');
const DOWN_SQL = readFileSync(join(migrationDir, 'down.sql'), 'utf8');

/** Sentencias del UP en orden, sin comentarios. El UP no tiene bloques `DO`. */
const UP_STATEMENTS = UP_SQL.replace(/\r\n/g, '\n')
  .split('\n')
  .map((line) => line.replace(/--.*$/, ''))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter((statement) => statement.length > 0);

const UNIQUE_VIOLATION = '23505';
const RAISE_EXCEPTION = 'P0001';
const IDX_WITH_PRESENTATION = 'product_batches_product_presentation_lot_unique';
const IDX_WITHOUT_PRESENTATION = 'product_batches_product_lot_unique';
const IDX_OLD = 'product_batches_company_lot_unique';

function connectionString(): string {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (url === undefined || url.trim() === '') {
    throw new Error('falta DATABASE_URL (o DIRECT_URL) en el entorno de la corrida de integracion');
  }
  return url;
}

type PgFailure = { readonly code: string; readonly constraint: string | null; readonly message: string };

async function expectPgRejection(run: () => Promise<unknown>, what: string): Promise<PgFailure> {
  try {
    await run();
  } catch (error) {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      throw new Error(`se esperaba un error de Postgres y llego: ${String(error)}`);
    }
    const campos = error as { code: unknown; constraint?: unknown; message?: unknown };
    return {
      code: String(campos.code),
      constraint: typeof campos.constraint === 'string' ? campos.constraint : null,
      message: typeof campos.message === 'string' ? campos.message : '',
    };
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

type IndexState = Readonly<Record<string, string | null>>;

/** La definicion de los tres indices de lote en la copia, sin el prefijo del esquema. */
async function lotIndexes(client: Client, schema: string): Promise<IndexState> {
  const rows = await client.query<{ indexname: string; indexdef: string }>(
    `SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = $1 AND tablename = 'product_batches' AND indexname = ANY($2)`,
    [schema, [IDX_WITH_PRESENTATION, IDX_WITHOUT_PRESENTATION, IDX_OLD]],
  );
  const byName = new Map(rows.rows.map((r) => [r.indexname, r.indexdef.replace(`"${schema}".`, '').replace(`${schema}.`, '')]));
  return {
    [IDX_WITH_PRESENTATION]: byName.get(IDX_WITH_PRESENTATION) ?? null,
    [IDX_WITHOUT_PRESENTATION]: byName.get(IDX_WITHOUT_PRESENTATION) ?? null,
    [IDX_OLD]: byName.get(IDX_OLD) ?? null,
  };
}

const DEF_WITH_PRESENTATION =
  'CREATE UNIQUE INDEX product_batches_product_presentation_lot_unique ON product_batches USING btree (company_id, product_id, presentation_id, lot) WHERE (presentation_id IS NOT NULL)';
const DEF_WITHOUT_PRESENTATION =
  'CREATE UNIQUE INDEX product_batches_product_lot_unique ON product_batches USING btree (company_id, product_id, lot) WHERE (presentation_id IS NULL)';
const DEF_OLD = 'CREATE UNIQUE INDEX product_batches_company_lot_unique ON product_batches USING btree (company_id, lot)';

const MIGRADO: IndexState = {
  [IDX_WITH_PRESENTATION]: DEF_WITH_PRESENTATION,
  [IDX_WITHOUT_PRESENTATION]: DEF_WITHOUT_PRESENTATION,
  [IDX_OLD]: null,
};
const PREVIO: IndexState = {
  [IDX_WITH_PRESENTATION]: null,
  [IDX_WITHOUT_PRESENTATION]: null,
  [IDX_OLD]: DEF_OLD,
};

async function rlsForced(client: Client, schema: string): Promise<boolean> {
  const rows = await client.query<{ forced: boolean }>(
    `SELECT t.relforcerowsecurity AS forced FROM pg_class t
       JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = $1 AND t.relname = 'product_batches'`,
    [schema],
  );
  return rows.rows[0]?.forced === true;
}

/**
 * La copia sale en el estado MIGRADO (la tabla real ya tiene esta migracion). `state: 'previo'`
 * aplica antes el DOWN real para dejarla como estaba antes de migrar.
 */
async function withSandbox(
  state: 'migrado' | 'previo',
  body: (client: Client, schema: string) => Promise<void>,
): Promise<void> {
  const schema = `qc284_${randomUUID().replace(/-/gu, '').slice(0, 16)}`;
  const client = new Client({ connectionString: connectionString() });
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(
      `CREATE TABLE "${schema}"."product_batches"
         (LIKE public.product_batches INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`,
    );
    const copias = await client.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
        WHERE schemaname = $1 AND tablename = 'product_batches' AND indexdef LIKE 'CREATE UNIQUE INDEX %lot)%'`,
      [schema],
    );
    const conPresentacion = copias.rows.find((r) => r.indexdef.includes('presentation_id IS NOT NULL'));
    const sinPresentacion = copias.rows.find((r) => r.indexdef.includes('presentation_id IS NULL'));
    if (copias.rows.length !== 2 || conPresentacion === undefined || sinPresentacion === undefined) {
      throw new Error(`la copia no trae los dos indices parciales del lote: ${JSON.stringify(copias.rows)}`);
    }
    await client.query(`ALTER INDEX "${schema}"."${conPresentacion.indexname}" RENAME TO "${IDX_WITH_PRESENTATION}"`);
    await client.query(`ALTER INDEX "${schema}"."${sinPresentacion.indexname}" RENAME TO "${IDX_WITHOUT_PRESENTATION}"`);
    // Si la copia no fuera fiel, el SQL podria funcionar sobre una tabla distinta de la real.
    expect(await lotIndexes(client, schema)).toEqual(MIGRADO);

    await client.query(`SET search_path TO "${schema}"`);
    if (state === 'previo') {
      await runInTransaction(client, DOWN_SQL);
      expect(await lotIndexes(client, schema)).toEqual(PREVIO);
    }
    await body(client, schema);
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.query('RESET search_path').catch(() => undefined);
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
    await client.end();
  }
}

type Row = {
  readonly id: string;
  readonly companyId: string;
  readonly productId: string;
  readonly presentationId: string | null;
  readonly lot: string;
};

function row(companyId: string, productId: string, presentationId: string | null, lot: string): Row {
  return { id: randomUUID(), companyId, productId, presentationId, lot };
}

async function insert(client: Client, r: Row): Promise<unknown> {
  return client.query(
    `INSERT INTO "product_batches"
       ("id", "product_id", "presentation_id", "stock", "unit_cost", "lot", "purchase_date", "company_id", "updated_at")
     VALUES ($1::uuid, $2::uuid, $3::uuid, 1, 1.0000, $4, DATE '2026-10-01', $5::uuid, now())`,
    [r.id, r.productId, r.presentationId, r.lot, r.companyId],
  );
}

async function snapshot(client: Client): Promise<unknown[]> {
  const rows = await client.query(
    `SELECT "id"::text, "product_id"::text, "presentation_id"::text, "stock"::text, "unit_cost"::text, "lot",
            "purchase_date"::text, "expiry_date"::text, "production_date"::text, "company_id"::text,
            "created_at"::text, "updated_at"::text, "package_content"::text
       FROM "product_batches" ORDER BY "id"`,
  );
  return rows.rows;
}

describe('QC-284 — migracion product_batches_lot_per_presentation contra Postgres real', () => {
  it('R28: existe exactamente una carpeta de la migracion', () => {
    expect(carpetas).toHaveLength(1);
    expect(UP_STATEMENTS).toHaveLength(3);
  });

  it('R28: el UP, sentencia a sentencia, nunca deja la tabla sin unicidad de lote y no cambia ninguna fila', async () => {
    await withSandbox('previo', async (client, schema) => {
      const empresa = randomUUID();
      const producto = randomUUID();
      await insert(client, row(empresa, producto, randomUUID(), 'A-1'));
      await insert(client, row(empresa, randomUUID(), null, 'A-2'));
      await insert(client, row(randomUUID(), producto, null, 'A-1'));
      const antes = await snapshot(client);

      await client.query('BEGIN');
      const vivosTrasCadaPaso: number[] = [];
      for (const statement of UP_STATEMENTS) {
        await client.query(statement);
        const vivos = await client.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM pg_indexes
            WHERE schemaname = current_schema() AND tablename = 'product_batches' AND indexname = ANY($1)`,
          [[IDX_WITH_PRESENTATION, IDX_WITHOUT_PRESENTATION, IDX_OLD]],
        );
        vivosTrasCadaPaso.push(Number(vivos.rows[0]?.n));
      }
      await client.query('COMMIT');

      // Crear, crear, quitar: el viejo solo cae cuando los dos nuevos ya estan.
      expect(vivosTrasCadaPaso).toEqual([2, 3, 2]);
      expect(await lotIndexes(client, schema)).toEqual(MIGRADO);
      expect(await snapshot(client)).toEqual(antes);
    });
  });

  it('R1, R2, R3, R4: tras el UP la copia rechaza la misma clave en cada indice y admite el mismo codigo con otra clave', async () => {
    await withSandbox('previo', async (client) => {
      await runInTransaction(client, UP_SQL);
      const empresa = randomUUID();
      const producto = randomUUID();
      const presentacion = randomUUID();
      await insert(client, row(empresa, producto, presentacion, 'CR-2610'));
      await insert(client, row(empresa, producto, null, 'CR-2610'));

      const conPresentacion = await expectPgRejection(
        () => insert(client, row(empresa, producto, presentacion, 'CR-2610')),
        'la misma clave con presentacion',
      );
      expect(conPresentacion.code).toBe(UNIQUE_VIOLATION);
      expect(conPresentacion.constraint).toBe(IDX_WITH_PRESENTATION);

      const sinPresentacion = await expectPgRejection(
        () => insert(client, row(empresa, producto, null, 'CR-2610')),
        'la misma clave sin presentacion',
      );
      expect(sinPresentacion.code).toBe(UNIQUE_VIOLATION);
      expect(sinPresentacion.constraint).toBe(IDX_WITHOUT_PRESENTATION);

      await insert(client, row(empresa, producto, randomUUID(), 'CR-2610'));
      await insert(client, row(empresa, randomUUID(), presentacion, 'CR-2610'));
      await insert(client, row(empresa, randomUUID(), null, 'CR-2610'));
      await insert(client, row(empresa, producto, presentacion, 'cr-2610'));
      await insert(client, row(randomUUID(), producto, presentacion, 'CR-2610'));
      const total = await client.query<{ n: string }>(`SELECT count(*)::text AS n FROM "product_batches"`);
      expect(Number(total.rows[0]?.n)).toBe(7);
    });
  });

  it('R29: con dos lotes de una empresa con el mismo codigo en productos distintos, el DOWN aborta entero con su mensaje', async () => {
    await withSandbox('migrado', async (client, schema) => {
      const empresa = randomUUID();
      await insert(client, row(empresa, randomUUID(), randomUUID(), '2401'));
      await insert(client, row(empresa, randomUUID(), null, '2401'));
      await insert(client, row(empresa, randomUUID(), null, 'GL-1'));
      await insert(client, row(empresa, randomUUID(), null, 'GL-1'));
      await insert(client, row(empresa, randomUUID(), null, 'GL-1'));
      await insert(client, row(randomUUID(), randomUUID(), null, '2401'));
      const antes = await snapshot(client);
      const rlsAntes = await rlsForced(client, schema);

      const rechazo = await expectPgRejection(() => runInTransaction(client, DOWN_SQL), 'DOWN con codigos repetidos');

      expect(rechazo.code).toBe(RAISE_EXCEPTION);
      expect(rechazo.message).toContain('ROLLBACK ABORTADO');
      // Dos codigos repetidos ('2401' y 'GL-1') en cinco filas; el '2401' de otra empresa no cuenta.
      expect(rechazo.message).toContain('hay 2 codigo(s) de lote repetido(s)');
      expect(rechazo.message).toContain('en 5 fila(s)');
      expect(rechazo.message).toContain('renombra esos lotes antes de revertir');
      // Nada a medias: los dos indices nuevos siguen, el viejo no aparece, la RLS como estaba.
      expect(await lotIndexes(client, schema)).toEqual(MIGRADO);
      expect(await rlsForced(client, schema)).toBe(rlsAntes);
      expect(await snapshot(client)).toEqual(antes);
    });
  });

  it('R29: sin codigos repetidos en una empresa, el DOWN deja la unicidad (empresa, codigo), sin los dos indices y con la RLS forzada', async () => {
    await withSandbox('migrado', async (client, schema) => {
      const empresa = randomUUID();
      const producto = randomUUID();
      await insert(client, row(empresa, producto, randomUUID(), 'L-1'));
      await insert(client, row(empresa, producto, null, 'L-2'));
      await insert(client, row(randomUUID(), producto, null, 'L-1'));
      const antes = await snapshot(client);

      await runInTransaction(client, DOWN_SQL);

      expect(await lotIndexes(client, schema)).toEqual(PREVIO);
      expect(await rlsForced(client, schema)).toBe(true);
      expect(await snapshot(client)).toEqual(antes);

      const viejo = await expectPgRejection(
        () => insert(client, row(empresa, randomUUID(), null, 'L-1')),
        'el mismo codigo en otro producto tras revertir',
      );
      expect(viejo.code).toBe(UNIQUE_VIOLATION);
      expect(viejo.constraint).toBe(IDX_OLD);

      // Y el UP vuelve a aplicarse sobre lo que dejo el DOWN.
      await runInTransaction(client, UP_SQL);
      expect(await lotIndexes(client, schema)).toEqual(MIGRADO);
    });
  });
});
