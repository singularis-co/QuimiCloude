// La migracion `db/migrations/*_ai_providers/` contra Postgres REAL.
//
// La migracion posterior `*_ai_models/` borra `recipe_model` y `catalog_model` y cuelga FK de estas
// tablas. Los casos que miran esas columnas o bajan esta migracion aplican antes el DOWN de aquella
// (`withoutAiModels`), para ver el esquema tal como lo dejo esta.
//
// Aislamiento: cada `it` corre dentro de `prisma.$transaction` interactiva y termina lanzando
// `RollbackSignal`, asi que ninguna fila ni ningun DDL sobrevive. El SQL se lee del archivo.
// Las violaciones esperadas van dentro de un SAVEPOINT para no abortar la transaccion. El mensaje
// de Postgres sale en el idioma del servidor: se reconoce por SQLSTATE.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Prisma } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'

import { prisma } from '@/lib/shared/db/prisma'

class RollbackSignal extends Error {
  constructor() {
    super('rollback de aislamiento del test')
    this.name = 'RollbackSignal'
  }
}

async function inRolledBackTransaction(
  body: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await body(tx)
        throw new RollbackSignal()
      },
      { maxWait: 10_000, timeout: 30_000 },
    )
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error
  }
}

function findRepoRoot(startDir: string): string {
  let dir = startDir
  for (;;) {
    if (existsSync(join(dir, 'package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no se encontro package.json subiendo desde ${startDir}`)
    dir = parent
  }
}

const migrationsDir = join(findRepoRoot(dirname(fileURLToPath(import.meta.url))), 'db', 'migrations')
const carpetas = readdirSync(migrationsDir).filter((name) => /_ai_providers$/.test(name))
const migrationDir = join(migrationsDir, carpetas[0] ?? '__falta__')

function statementsOf(sql: string): readonly string[] {
  return sql
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
}

const UP_STATEMENTS = statementsOf(readFileSync(join(migrationDir, 'migration.sql'), 'utf8'))
const DOWN_STATEMENTS = statementsOf(readFileSync(join(migrationDir, 'down.sql'), 'utf8'))

const carpetasModelos = readdirSync(migrationsDir).filter((name) => /_ai_models$/.test(name))
const AI_MODELS_DOWN = statementsOf(
  readFileSync(join(migrationsDir, carpetasModelos[0] ?? '__falta__', 'down.sql'), 'utf8'),
)

async function applyStatements(tx: Prisma.TransactionClient, statements: readonly string[]): Promise<void> {
  for (const statement of statements) {
    await tx.$executeRawUnsafe(statement)
  }
}

async function withoutAiModels(tx: Prisma.TransactionClient): Promise<void> {
  await applyStatements(tx, AI_MODELS_DOWN)
}

const CATALOG = 'ai_providers'
const CONNECTIONS = 'ai_provider_connections'
const TABLES = [CATALOG, CONNECTIONS] as const

async function tableSnapshot(tx: Prisma.TransactionClient, table: string) {
  // Por nombre y no por posicion: el DOWN de `*_ai_models/` vuelve a anadir columnas al final.
  const columns = await tx.$queryRaw<
    {
      column_name: string
      data_type: string
      udt_name: string
      is_nullable: string
      column_default: string | null
    }[]
  >`
    SELECT column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
    ORDER BY column_name`
  const indexes = await tx.$queryRaw<{ indexname: string; indexdef: string }[]>`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = ${table}
    ORDER BY indexname`
  const constraints = await tx.$queryRaw<{ conname: string; def: string }[]>`
    SELECT c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = ${table} AND t.relnamespace = 'public'::regnamespace
    ORDER BY c.conname`
  const rls = await tx.$queryRaw<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
    SELECT relrowsecurity, relforcerowsecurity FROM pg_class
    WHERE relname = ${table} AND relnamespace = 'public'::regnamespace`
  return { columns, indexes, constraints, rls }
}

async function schemaSnapshot(tx: Prisma.TransactionClient) {
  const enums = await tx.$queryRaw<{ typname: string; labels: string[] }[]>`
    SELECT t.typname, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname IN ('ai_provider_code', 'ai_provider_connection_status')
    GROUP BY t.typname
    ORDER BY t.typname`
  return {
    enums,
    catalog: await tableSnapshot(tx, CATALOG),
    connections: await tableSnapshot(tx, CONNECTIONS),
  }
}

type CatalogRow = {
  code: string
  name: string
  recipe_model: string
  catalog_model: string
  sort_order: number
}

async function catalogRows(tx: Prisma.TransactionClient): Promise<readonly CatalogRow[]> {
  return tx.$queryRawUnsafe<CatalogRow[]>(
    `SELECT code::text AS code, name, recipe_model, catalog_model, sort_order
     FROM "${CATALOG}" ORDER BY sort_order`,
  )
}

async function publicTables(tx: Prisma.TransactionClient): Promise<readonly string[]> {
  const rows = await tx.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  return rows.map((row) => row.tablename)
}

/** Corre `statement` en un SAVEPOINT y devuelve el error de Postgres, o null si no fallo. */
async function failureOf(tx: Prisma.TransactionClient, statement: string, ...values: unknown[]) {
  await tx.$executeRawUnsafe('SAVEPOINT intento')
  try {
    await tx.$executeRawUnsafe(statement, ...values)
    await tx.$executeRawUnsafe('RELEASE SAVEPOINT intento')
    return null
  } catch (error) {
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT intento')
    return String(error instanceof Error ? error.message : error)
  }
}

const INSERT_CONNECTION =
  `INSERT INTO "${CONNECTIONS}" ("id", "company_id", "provider", "api_key_enc", "key_updated_at", ` +
  `"created_by", "updated_by", "updated_at") VALUES (gen_random_uuid(), $1::uuid, ` +
  `$2::"ai_provider_code", 'v1:cifrado', CURRENT_TIMESTAMP, $3::uuid, $3::uuid, CURRENT_TIMESTAMP)`

async function someUserId(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id::text AS id FROM users LIMIT 1`
  expect(rows, 'la base efimera deberia tener al menos un usuario sembrado').toHaveLength(1)
  return (rows[0] as { id: string }).id
}

async function newCompanyId(tx: Prisma.TransactionClient, name: string): Promise<string> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO companies (name, name_normalized, updated_at)
    VALUES (${name}, ${name.toLowerCase()}, CURRENT_TIMESTAMP)
    RETURNING id::text AS id`
  return (rows[0] as { id: string }).id
}

const SEEDED: readonly CatalogRow[] = [
  { code: 'ANTHROPIC', name: 'Claude', recipe_model: 'claude-haiku-5-5', catalog_model: 'claude-haiku-5-5', sort_order: 1 },
  { code: 'GOOGLE', name: 'Gemini', recipe_model: 'gemini-3.8-flash', catalog_model: 'gemini-3.5-flash-lite', sort_order: 2 },
  { code: 'OPENAI', name: 'OpenAI', recipe_model: 'gpt-6-luna', catalog_model: 'gpt-6-luna', sort_order: 3 },
  {
    code: 'OPENROUTER',
    name: 'OpenRouter',
    recipe_model: 'anthropic/claude-haiku-5.5',
    catalog_model: 'anthropic/claude-haiku-5.5',
    sort_order: 4,
  },
]

afterAll(async () => {
  await prisma.$disconnect()
})

describe('migracion ai_providers contra Postgres real', () => {
  it('existe exactamente una carpeta de la migracion, con su down.sql', () => {
    expect(carpetas).toHaveLength(1)
    expect(existsSync(join(migrationDir, 'down.sql'))).toBe(true)
    expect(carpetasModelos).toHaveLength(1)
  })

  it('R4: el catalogo trae exactamente los cuatro proveedores, en orden, con sus modelos no vacios', async () => {
    await inRolledBackTransaction(async (tx) => {
      await withoutAiModels(tx)
      const rows = await catalogRows(tx)
      expect(rows).toEqual(SEEDED)
      for (const row of rows) {
        expect(row.recipe_model.trim(), row.code).not.toBe('')
        expect(row.catalog_model.trim(), row.code).not.toBe('')
      }
    })
  })

  it('R4: el CHECK rechaza un modelo vacio', async () => {
    await inRolledBackTransaction(async (tx) => {
      await withoutAiModels(tx)
      expect(
        await failureOf(tx, `UPDATE "${CATALOG}" SET "recipe_model" = '' WHERE "code" = 'OPENAI'`),
      ).toMatch(/23514/)
      expect(
        await failureOf(tx, `UPDATE "${CATALOG}" SET "catalog_model" = '' WHERE "code" = 'GOOGLE'`),
      ).toMatch(/23514/)
    })
  })

  it('R5: la conexion tiene company_id obligatorio, sus FK y RLS activada y forzada en las dos tablas', async () => {
    await inRolledBackTransaction(async (tx) => {
      const snapshot = await schemaSnapshot(tx)
      const companyId = snapshot.connections.columns.find((column) => column.column_name === 'company_id')
      expect(companyId).toMatchObject({ udt_name: 'uuid', is_nullable: 'NO' })
      expect(snapshot.connections.columns.find((column) => column.column_name === 'id')?.column_default).toBeNull()
      expect(snapshot.catalog.rls).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }])
      expect(snapshot.connections.rls).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }])
      expect(snapshot.connections.constraints.map((c) => c.def)).toEqual(
        expect.arrayContaining([
          'FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE ON DELETE RESTRICT',
          'FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT',
          'FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT',
          'FOREIGN KEY (provider) REFERENCES ai_providers(code) ON UPDATE CASCADE ON DELETE RESTRICT',
        ]),
      )
      expect(snapshot.enums).toEqual([
        { typname: 'ai_provider_code', labels: ['ANTHROPIC', 'GOOGLE', 'OPENAI', 'OPENROUTER'] },
        { typname: 'ai_provider_connection_status', labels: ['ACTIVE', 'ERROR'] },
      ])
    })
  })

  it('R5: el indice unico de empresa es total, no parcial', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { connections } = await schemaSnapshot(tx)
      expect(
        connections.indexes.find((index) => index.indexname === 'ai_provider_connections_company_id_key')
          ?.indexdef,
      ).toBe(
        'CREATE UNIQUE INDEX ai_provider_connections_company_id_key ON public.ai_provider_connections ' +
          'USING btree (company_id)',
      )
    })
  })

  it('R5: una segunda conexion en la misma empresa choca; en otra empresa entra', async () => {
    await inRolledBackTransaction(async (tx) => {
      const userId = await someUserId(tx)
      const companyA = await newCompanyId(tx, 'qc_mig_ai_a')
      const companyB = await newCompanyId(tx, 'qc_mig_ai_b')

      expect(await failureOf(tx, INSERT_CONNECTION, companyA, 'ANTHROPIC', userId)).toBeNull()
      expect(await failureOf(tx, INSERT_CONNECTION, companyA, 'GOOGLE', userId)).toMatch(
        /23505[\s\S]*\(company_id\)=/,
      )
      expect(await failureOf(tx, INSERT_CONNECTION, companyB, 'GOOGLE', userId)).toBeNull()
    })
  })

  it('R5: un proveedor con conexiones no se puede borrar del catalogo; sin conexiones, si', async () => {
    await inRolledBackTransaction(async (tx) => {
      const userId = await someUserId(tx)
      await withoutAiModels(tx)
      const companyId = await newCompanyId(tx, 'qc_mig_ai_c')
      expect(await failureOf(tx, INSERT_CONNECTION, companyId, 'OPENAI', userId)).toBeNull()

      // 23503 en Postgres 17; 23001 en 18 (docs/verification.md).
      expect(await failureOf(tx, `DELETE FROM "${CATALOG}" WHERE "code" = 'OPENAI'`)).toMatch(/23503|23001/)
      expect(await failureOf(tx, `DELETE FROM "${CATALOG}" WHERE "code" = 'OPENROUTER'`)).toBeNull()
    })
  })

  it('R4, R5: el DOWN quita las dos tablas y los dos tipos, y el resto de tablas queda igual', async () => {
    await inRolledBackTransaction(async (tx) => {
      await withoutAiModels(tx)
      const tablasAntes = await publicTables(tx)
      expect(tablasAntes).toEqual(expect.arrayContaining([...TABLES]))

      await applyStatements(tx, DOWN_STATEMENTS)

      const snapshot = await schemaSnapshot(tx)
      expect(snapshot.catalog.columns).toEqual([])
      expect(snapshot.connections.columns).toEqual([])
      expect(snapshot.enums).toEqual([])
      expect(await publicTables(tx)).toEqual(
        tablasAntes.filter((name) => !(TABLES as readonly string[]).includes(name)),
      )
    })
  })

  it('R4, R5: ida, vuelta e ida dejan el mismo esquema y las mismas cuatro filas', async () => {
    await inRolledBackTransaction(async (tx) => {
      await withoutAiModels(tx)
      const antes = await schemaSnapshot(tx)
      const filasAntes = await catalogRows(tx)
      expect(antes.connections.columns.length).toBeGreaterThan(0)

      await applyStatements(tx, DOWN_STATEMENTS)
      await applyStatements(tx, UP_STATEMENTS)

      expect(await schemaSnapshot(tx)).toEqual(antes)
      expect(await catalogRows(tx)).toEqual(filasAntes)
    })
  })

  it('R5 (sensibilidad): un UP sin los FORCE deja la RLS sin forzar y el snapshot lo detecta', async () => {
    const upSinForce = UP_STATEMENTS.filter((statement) => !/FORCE ROW LEVEL SECURITY/i.test(statement))
    expect(upSinForce, 'la mutacion no quito las dos sentencias').toHaveLength(UP_STATEMENTS.length - 2)

    await inRolledBackTransaction(async (tx) => {
      await withoutAiModels(tx)
      await applyStatements(tx, DOWN_STATEMENTS)
      await applyStatements(tx, upSinForce)
      const snapshot = await schemaSnapshot(tx)
      expect(snapshot.catalog.rls).toEqual([{ relrowsecurity: true, relforcerowsecurity: false }])
      expect(snapshot.connections.rls).toEqual([{ relrowsecurity: true, relforcerowsecurity: false }])
    })
  })
})
