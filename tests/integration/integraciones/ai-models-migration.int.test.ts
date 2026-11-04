// La migracion `db/migrations/*_ai_models/` contra Postgres REAL.
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
        await applyStatements(tx, AI_AGENT_MODEL_PAIRS_DOWN)
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
const carpetas = readdirSync(migrationsDir).filter((name) => /_ai_models$/.test(name))
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

// La migracion posterior `*_ai_agent_model_pairs/` anade columnas a `ai_models` y cuelga de ella
// FK de los pares. Cada caso aplica antes su DOWN para ver el esquema tal como lo dejo esta.
const carpetasPares = readdirSync(migrationsDir).filter((name) => /_ai_agent_model_pairs$/.test(name))
const AI_AGENT_MODEL_PAIRS_DOWN = statementsOf(
  readFileSync(join(migrationsDir, carpetasPares[0] ?? '__falta__', 'down.sql'), 'utf8'),
)

async function applyStatements(tx: Prisma.TransactionClient, statements: readonly string[]): Promise<void> {
  for (const statement of statements) {
    await tx.$executeRawUnsafe(statement)
  }
}

const MODELS = 'ai_models'
const PROVIDERS = 'ai_providers'
const CONNECTIONS = 'ai_provider_connections'

type Column = {
  column_name: string
  data_type: string
  udt_name: string
  is_nullable: string
  column_default: string | null
}

async function tableSnapshot(tx: Prisma.TransactionClient, table: string) {
  // Por nombre y no por posicion: el DOWN vuelve a anadir columnas al final de `ai_providers`.
  const columns = await tx.$queryRaw<Column[]>`
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
  return {
    models: await tableSnapshot(tx, MODELS),
    providers: await tableSnapshot(tx, PROVIDERS),
    connections: await tableSnapshot(tx, CONNECTIONS),
  }
}

type ModelRow = { provider: string; model_id: string; is_default: boolean; sort_order: number }

async function modelRows(tx: Prisma.TransactionClient): Promise<readonly ModelRow[]> {
  return tx.$queryRawUnsafe<ModelRow[]>(
    `SELECT provider::text AS provider, model_id, is_default, sort_order
     FROM "${MODELS}" ORDER BY provider, sort_order`,
  )
}

type ProviderRow = { code: string; name: string; sort_order: number }

async function providerRows(tx: Prisma.TransactionClient): Promise<readonly ProviderRow[]> {
  return tx.$queryRawUnsafe<ProviderRow[]>(
    `SELECT code::text AS code, name, sort_order FROM "${PROVIDERS}" ORDER BY sort_order`,
  )
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
  `"created_by", "updated_by", "updated_at", "model_id", "unavailable_model") VALUES (gen_random_uuid(), ` +
  `$1::uuid, $2::"ai_provider_code", 'v1:cifrado', CURRENT_TIMESTAMP, $3::uuid, $3::uuid, ` +
  `CURRENT_TIMESTAMP, $4, $5)`

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

// La lista aprobada (veinte modelos), ordenada como la devuelve `modelRows` (proveedor y orden).
const SEEDED: readonly ModelRow[] = [
  { provider: 'ANTHROPIC', model_id: 'claude-opus-5-5', is_default: false, sort_order: 1 },
  { provider: 'ANTHROPIC', model_id: 'claude-sonnet-5-5', is_default: false, sort_order: 2 },
  { provider: 'ANTHROPIC', model_id: 'claude-opus-5', is_default: false, sort_order: 3 },
  { provider: 'ANTHROPIC', model_id: 'claude-sonnet-5', is_default: false, sort_order: 4 },
  { provider: 'ANTHROPIC', model_id: 'claude-haiku-5-5', is_default: true, sort_order: 5 },
  { provider: 'GOOGLE', model_id: 'gemini-4-argon', is_default: false, sort_order: 1 },
  { provider: 'GOOGLE', model_id: 'gemini-3.8-flash', is_default: true, sort_order: 2 },
  { provider: 'GOOGLE', model_id: 'gemini-3.7-flash', is_default: false, sort_order: 3 },
  { provider: 'GOOGLE', model_id: 'gemini-3.5-flash-lite', is_default: false, sort_order: 4 },
  { provider: 'GOOGLE', model_id: 'gemini-3.1-flash-lite', is_default: false, sort_order: 5 },
  { provider: 'OPENAI', model_id: 'gpt-6.1-sol', is_default: false, sort_order: 1 },
  { provider: 'OPENAI', model_id: 'gpt-6-sol', is_default: false, sort_order: 2 },
  { provider: 'OPENAI', model_id: 'gpt-6-luna-pro', is_default: false, sort_order: 3 },
  { provider: 'OPENAI', model_id: 'gpt-6-luna', is_default: true, sort_order: 4 },
  { provider: 'OPENAI', model_id: 'gpt-5.6-luna', is_default: false, sort_order: 5 },
  { provider: 'OPENROUTER', model_id: 'anthropic/claude-sonnet-5.5', is_default: false, sort_order: 1 },
  { provider: 'OPENROUTER', model_id: 'openai/gpt-6.1-sol', is_default: false, sort_order: 2 },
  { provider: 'OPENROUTER', model_id: 'google/gemini-3.8-flash', is_default: false, sort_order: 3 },
  { provider: 'OPENROUTER', model_id: 'anthropic/claude-haiku-5.5', is_default: true, sort_order: 4 },
  { provider: 'OPENROUTER', model_id: 'openai/gpt-6-luna', is_default: false, sort_order: 5 },
]

// El predeterminado aprobado de cada proveedor.
const DEFAULTS: Readonly<Record<string, string>> = {
  ANTHROPIC: 'claude-haiku-5-5',
  GOOGLE: 'gemini-3.8-flash',
  OPENAI: 'gpt-6-luna',
  OPENROUTER: 'anthropic/claude-haiku-5.5',
}

// Los valores que sembro la migracion de `ai_providers` y que el DOWN debe devolver.
const PROVIDER_MODELS_BEFORE = [
  { code: 'ANTHROPIC', recipe_model: 'claude-haiku-5-5', catalog_model: 'claude-haiku-5-5' },
  { code: 'GOOGLE', recipe_model: 'gemini-3.8-flash', catalog_model: 'gemini-3.5-flash-lite' },
  { code: 'OPENAI', recipe_model: 'gpt-6-luna', catalog_model: 'gpt-6-luna' },
  { code: 'OPENROUTER', recipe_model: 'anthropic/claude-haiku-5.5', catalog_model: 'anthropic/claude-haiku-5.5' },
]

afterAll(async () => {
  await prisma.$disconnect()
})

describe('migracion ai_models contra Postgres real', () => {
  it('existe exactamente una carpeta de la migracion, con su down.sql', () => {
    expect(carpetas).toHaveLength(1)
    expect(carpetasPares).toHaveLength(1)
    expect(existsSync(join(migrationDir, 'down.sql'))).toBe(true)
  })

  it('R1: el catalogo de modelos no tiene columna de empresa, lleva PK por proveedor y modelo, CHECK, FK y RLS forzada', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { models } = await schemaSnapshot(tx)
      expect(models.columns).toEqual([
        { column_name: 'is_default', data_type: 'boolean', udt_name: 'bool', is_nullable: 'NO', column_default: 'false' },
        { column_name: 'model_id', data_type: 'text', udt_name: 'text', is_nullable: 'NO', column_default: null },
        {
          column_name: 'provider',
          data_type: 'USER-DEFINED',
          udt_name: 'ai_provider_code',
          is_nullable: 'NO',
          column_default: null,
        },
        { column_name: 'sort_order', data_type: 'integer', udt_name: 'int4', is_nullable: 'NO', column_default: null },
      ])
      expect(models.constraints).toEqual([
        { conname: 'ai_models_model_id_not_empty', def: "CHECK ((model_id <> ''::text))" },
        { conname: 'ai_models_pkey', def: 'PRIMARY KEY (provider, model_id)' },
        {
          conname: 'ai_models_provider_fkey',
          def: 'FOREIGN KEY (provider) REFERENCES ai_providers(code) ON UPDATE CASCADE ON DELETE RESTRICT',
        },
      ])
      expect(models.rls).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }])
    })
  })

  it('R1: el CHECK rechaza un id vacio y el id es unico solo dentro de su proveedor', async () => {
    await inRolledBackTransaction(async (tx) => {
      const insert = `INSERT INTO "${MODELS}" ("provider", "model_id", "sort_order") VALUES ($1::"ai_provider_code", $2, 9)`
      expect(await failureOf(tx, insert, 'OPENAI', '')).toMatch(/23514/)
      expect(await failureOf(tx, insert, 'GOOGLE', 'gemini-3.8-flash')).toMatch(/23505/)
      expect(await failureOf(tx, insert, 'OPENAI', 'gemini-3.8-flash')).toBeNull()
      expect(
        await failureOf(
          tx,
          `INSERT INTO "${MODELS}" ("provider", "model_id", "sort_order") VALUES ('NADIE'::"ai_provider_code", 'x', 1)`,
        ),
      ).toMatch(/22P02/)
    })
  })

  it('R1: un proveedor con modelos no se puede borrar del catalogo de proveedores', async () => {
    await inRolledBackTransaction(async (tx) => {
      // 23503 en Postgres 17; 23001 en 18 (docs/verification.md).
      expect(await failureOf(tx, `DELETE FROM "${PROVIDERS}" WHERE "code" = 'OPENROUTER'`)).toMatch(/23503|23001/)
    })
  })

  it('R2: la migracion siembra exactamente la lista aprobada, cinco por proveedor con orden 1 a 5', async () => {
    await inRolledBackTransaction(async (tx) => {
      const rows = await modelRows(tx)
      expect(rows).toHaveLength(20)
      expect(rows).toEqual(SEEDED)
      for (const code of ['ANTHROPIC', 'GOOGLE', 'OPENAI', 'OPENROUTER']) {
        expect(
          rows.filter((row) => row.provider === code).map((row) => row.sort_order),
          code,
        ).toEqual([1, 2, 3, 4, 5])
      }
    })
  })

  it('R3: cada proveedor tiene exactamente un predeterminado y es el aprobado', async () => {
    await inRolledBackTransaction(async (tx) => {
      const providers = await providerRows(tx)
      expect(providers.map((row) => row.code)).toEqual(['ANTHROPIC', 'GOOGLE', 'OPENAI', 'OPENROUTER'])
      const rows = await modelRows(tx)
      for (const { code } of providers) {
        const defaults = rows.filter((row) => row.provider === code && row.is_default)
        expect(defaults.map((row) => row.model_id), code).toEqual([DEFAULTS[code]])
      }
    })
  })

  it('R3: la base rechaza un segundo predeterminado del mismo proveedor y admite el de otro', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { models } = await schemaSnapshot(tx)
      expect(models.indexes.find((index) => index.indexname === 'ai_models_one_default_per_provider')?.indexdef).toBe(
        'CREATE UNIQUE INDEX ai_models_one_default_per_provider ON public.ai_models USING btree (provider) ' +
          'WHERE is_default',
      )
      expect(
        await failureOf(
          tx,
          `UPDATE "${MODELS}" SET "is_default" = true WHERE "provider" = 'GOOGLE' AND "model_id" = 'gemini-3.5-flash-lite'`,
        ),
      ).toMatch(/23505/)
      expect(
        await failureOf(
          tx,
          `INSERT INTO "${MODELS}" ("provider", "model_id", "is_default", "sort_order") VALUES ('OPENAI', 'otro', true, 2)`,
        ),
      ).toMatch(/23505/)
      expect(
        await failureOf(
          tx,
          `INSERT INTO "${MODELS}" ("provider", "model_id", "is_default", "sort_order") VALUES ('OPENAI', 'otro', false, 2)`,
        ),
      ).toBeNull()
    })
  })

  it('R4: ai_providers ya no guarda modelos por uso', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { providers } = await schemaSnapshot(tx)
      expect(providers.columns.map((column) => column.column_name)).toEqual(['code', 'name', 'sort_order'])
      expect(providers.constraints.map((constraint) => constraint.conname)).not.toContain(
        'ai_providers_models_not_empty',
      )
      expect(await providerRows(tx)).toEqual([
        { code: 'ANTHROPIC', name: 'Claude', sort_order: 1 },
        { code: 'GOOGLE', name: 'Gemini', sort_order: 2 },
        { code: 'OPENAI', name: 'OpenAI', sort_order: 3 },
        { code: 'OPENROUTER', name: 'OpenRouter', sort_order: 4 },
      ])
    })
  })

  it('R7: la conexion guarda una sola eleccion opcional y un modelo marcado opcional sin FK', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { connections } = await schemaSnapshot(tx)
      const columnas = connections.columns.filter((column) =>
        ['model_id', 'unavailable_model'].includes(column.column_name),
      )
      expect(columnas).toEqual([
        { column_name: 'model_id', data_type: 'text', udt_name: 'text', is_nullable: 'YES', column_default: null },
        {
          column_name: 'unavailable_model',
          data_type: 'text',
          udt_name: 'text',
          is_nullable: 'YES',
          column_default: null,
        },
      ])
      expect(connections.constraints).toEqual(
        expect.arrayContaining([
          {
            conname: 'ai_provider_connections_model_fkey',
            def:
              'FOREIGN KEY (provider, model_id) REFERENCES ai_models(provider, model_id) ' +
              'ON UPDATE CASCADE ON DELETE RESTRICT',
          },
        ]),
      )
      expect(connections.constraints.filter((constraint) => /unavailable_model/.test(constraint.def))).toEqual([])
    })
  })

  it('R7: la base rechaza una eleccion de otro proveedor o fuera del catalogo, y admite la del mismo o ninguna', async () => {
    await inRolledBackTransaction(async (tx) => {
      const userId = await someUserId(tx)
      const companyA = await newCompanyId(tx, 'qt_mig_models_a')
      const companyB = await newCompanyId(tx, 'qt_mig_models_b')
      const companyC = await newCompanyId(tx, 'qt_mig_models_c')
      const companyD = await newCompanyId(tx, 'qt_mig_models_d')

      expect(await failureOf(tx, INSERT_CONNECTION, companyA, 'GOOGLE', userId, 'gpt-6-luna', null)).toMatch(/23503/)
      expect(await failureOf(tx, INSERT_CONNECTION, companyA, 'GOOGLE', userId, 'no-existe', null)).toMatch(/23503/)
      expect(
        await failureOf(tx, INSERT_CONNECTION, companyA, 'GOOGLE', userId, 'gemini-3.5-flash-lite', null),
      ).toBeNull()
      expect(await failureOf(tx, INSERT_CONNECTION, companyB, 'OPENAI', userId, null, null)).toBeNull()
      expect(
        await failureOf(tx, INSERT_CONNECTION, companyC, 'ANTHROPIC', userId, null, 'id-que-no-esta-en-el-catalogo'),
      ).toBeNull()

      // Cambiar de proveedor sin vaciar la eleccion tambien choca con la FK compuesta.
      expect(
        await failureOf(tx, `UPDATE "${CONNECTIONS}" SET "provider" = 'OPENAI' WHERE "company_id" = $1::uuid`, companyA),
      ).toMatch(/23503/)

      // Un modelo elegido no se puede borrar del catalogo; uno sin elegir, si.
      expect(
        await failureOf(
          tx,
          `DELETE FROM "${MODELS}" WHERE "provider" = 'GOOGLE' AND "model_id" = 'gemini-3.5-flash-lite'`,
        ),
      ).toMatch(/23503|23001/)
      expect(await failureOf(tx, INSERT_CONNECTION, companyD, 'OPENROUTER', userId, null, null)).toBeNull()
      expect(
        await failureOf(tx, `DELETE FROM "${MODELS}" WHERE "provider" = 'OPENAI' AND "model_id" = 'gpt-6-luna'`),
      ).toBeNull()
    })
  })

  it('R1, R4, R7: el DOWN quita el catalogo de modelos y las dos columnas, y devuelve los modelos de ai_providers', async () => {
    await inRolledBackTransaction(async (tx) => {
      await applyStatements(tx, DOWN_STATEMENTS)

      const snapshot = await schemaSnapshot(tx)
      expect(snapshot.models.columns).toEqual([])
      const columnasConexion = snapshot.connections.columns.map((column) => column.column_name)
      expect(columnasConexion).not.toContain('model_id')
      expect(columnasConexion).not.toContain('unavailable_model')
      expect(columnasConexion).toContain('company_id')
      expect(snapshot.connections.constraints.map((constraint) => constraint.conname)).not.toContain(
        'ai_provider_connections_model_fkey',
      )
      expect(snapshot.providers.columns.filter((column) => /_model$/.test(column.column_name))).toEqual([
        { column_name: 'catalog_model', data_type: 'text', udt_name: 'text', is_nullable: 'NO', column_default: null },
        { column_name: 'recipe_model', data_type: 'text', udt_name: 'text', is_nullable: 'NO', column_default: null },
      ])
      expect(snapshot.providers.constraints).toEqual(
        expect.arrayContaining([
          {
            conname: 'ai_providers_models_not_empty',
            def: "CHECK (((recipe_model <> ''::text) AND (catalog_model <> ''::text)))",
          },
        ]),
      )
      expect(
        await tx.$queryRawUnsafe(
          `SELECT code::text AS code, recipe_model, catalog_model FROM "${PROVIDERS}" ORDER BY sort_order`,
        ),
      ).toEqual(PROVIDER_MODELS_BEFORE)
    })
  })

  it('R1, R2, R4: ida, vuelta e ida dejan el mismo esquema y las mismas filas', async () => {
    await inRolledBackTransaction(async (tx) => {
      const antes = await schemaSnapshot(tx)
      const modelosAntes = await modelRows(tx)
      const proveedoresAntes = await providerRows(tx)

      await applyStatements(tx, DOWN_STATEMENTS)
      await applyStatements(tx, UP_STATEMENTS)

      expect(await schemaSnapshot(tx)).toEqual(antes)
      expect(await modelRows(tx)).toEqual(modelosAntes)
      expect(await providerRows(tx)).toEqual(proveedoresAntes)
    })
  })

  it('R1 (sensibilidad): un UP sin el FORCE deja la RLS sin forzar y el snapshot lo detecta', async () => {
    const upSinForce = UP_STATEMENTS.filter((statement) => !/FORCE ROW LEVEL SECURITY/i.test(statement))
    expect(upSinForce, 'la mutacion no quito la sentencia').toHaveLength(UP_STATEMENTS.length - 1)

    await inRolledBackTransaction(async (tx) => {
      await applyStatements(tx, DOWN_STATEMENTS)
      await applyStatements(tx, upSinForce)
      const { models } = await schemaSnapshot(tx)
      expect(models.rls).toEqual([{ relrowsecurity: true, relforcerowsecurity: false }])
    })
  })
})
