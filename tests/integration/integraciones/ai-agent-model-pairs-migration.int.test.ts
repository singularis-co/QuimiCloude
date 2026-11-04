// La migracion `db/migrations/*_ai_agent_model_pairs/` contra Postgres REAL.
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

async function inRolledBackTransaction(body: (tx: Prisma.TransactionClient) => Promise<void>): Promise<void> {
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
const carpetas = readdirSync(migrationsDir).filter((name) => /_ai_agent_model_pairs$/.test(name))
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

async function applyStatements(tx: Prisma.TransactionClient, statements: readonly string[]): Promise<void> {
  for (const statement of statements) {
    await tx.$executeRawUnsafe(statement)
  }
}

const PAIRS = 'ai_agent_model_pairs'
const MODELS = 'ai_models'
const CONNECTIONS = 'ai_provider_connections'

type Column = {
  column_name: string
  data_type: string
  udt_name: string
  is_nullable: string
  column_default: string | null
}

async function tableSnapshot(tx: Prisma.TransactionClient, table: string) {
  const columns = await tx.$queryRaw<Column[]>`
    SELECT column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
    ORDER BY column_name`
  const indexes = await tx.$queryRaw<{ indexname: string; indexdef: string }[]>`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = ${table}
    ORDER BY indexname`
  // Sin las filas `contype = 'n'` que Postgres 18 crea por cada NOT NULL (docs/verification.md).
  const constraints = await tx.$queryRaw<{ conname: string; def: string }[]>`
    SELECT c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = ${table} AND t.relnamespace = 'public'::regnamespace AND c.contype <> 'n'
    ORDER BY c.conname`
  const rls = await tx.$queryRaw<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
    SELECT relrowsecurity, relforcerowsecurity FROM pg_class
    WHERE relname = ${table} AND relnamespace = 'public'::regnamespace`
  const policies = await tx.$queryRaw<{ policyname: string }[]>`
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = ${table}`
  return { columns, indexes, constraints, rls, policies }
}

async function roleType(tx: Prisma.TransactionClient): Promise<readonly string[]> {
  const rows = await tx.$queryRaw<{ label: string }[]>`
    SELECT e.enumlabel AS label FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'ai_model_role' ORDER BY e.enumsortorder`
  return rows.map((row) => row.label)
}

async function schemaSnapshot(tx: Prisma.TransactionClient) {
  return {
    pairs: await tableSnapshot(tx, PAIRS),
    models: await tableSnapshot(tx, MODELS),
    connections: await tableSnapshot(tx, CONNECTIONS),
    roleType: await roleType(tx),
  }
}

type MarkRow = { provider: string; model_id: string; supports_tools: boolean; is_economic: boolean }

async function markRows(tx: Prisma.TransactionClient): Promise<readonly MarkRow[]> {
  return tx.$queryRawUnsafe<MarkRow[]>(
    `SELECT provider::text AS provider, model_id, supports_tools, is_economic
     FROM "${MODELS}" ORDER BY provider, sort_order`,
  )
}

/** Los datos del catalogo que esta migracion no debe tocar. */
async function catalogRows(tx: Prisma.TransactionClient) {
  return tx.$queryRawUnsafe<unknown[]>(
    `SELECT provider::text AS provider, model_id, is_default, sort_order FROM "${MODELS}" ORDER BY provider, model_id`,
  )
}

async function connectionRows(tx: Prisma.TransactionClient) {
  return tx.$queryRawUnsafe<unknown[]>(
    `SELECT id::text AS id, company_id::text AS company_id, provider::text AS provider, api_key_enc, status::text AS status,
            model_id, unavailable_model, updated_at FROM "${CONNECTIONS}" ORDER BY id`,
  )
}

type PairRow = { provider: string; role: string; primary_model_id: string; fallback_model_id: string; updated_by: string | null }

async function pairRows(tx: Prisma.TransactionClient): Promise<readonly PairRow[]> {
  return tx.$queryRawUnsafe<PairRow[]>(
    `SELECT provider::text AS provider, role::text AS role, primary_model_id, fallback_model_id,
            updated_by::text AS updated_by
     FROM "${PAIRS}" ORDER BY provider, role`,
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

// Las marcas aprobadas, en el orden de `markRows` (proveedor y orden del catalogo).
const MARKS: readonly MarkRow[] = [
  { provider: 'ANTHROPIC', model_id: 'claude-opus-5-5', supports_tools: true, is_economic: false },
  { provider: 'ANTHROPIC', model_id: 'claude-sonnet-5-5', supports_tools: true, is_economic: false },
  { provider: 'ANTHROPIC', model_id: 'claude-opus-5', supports_tools: true, is_economic: false },
  { provider: 'ANTHROPIC', model_id: 'claude-sonnet-5', supports_tools: true, is_economic: false },
  { provider: 'ANTHROPIC', model_id: 'claude-haiku-5-5', supports_tools: true, is_economic: true },
  { provider: 'GOOGLE', model_id: 'gemini-4-argon', supports_tools: true, is_economic: false },
  { provider: 'GOOGLE', model_id: 'gemini-3.8-flash', supports_tools: true, is_economic: true },
  { provider: 'GOOGLE', model_id: 'gemini-3.7-flash', supports_tools: true, is_economic: true },
  { provider: 'GOOGLE', model_id: 'gemini-3.5-flash-lite', supports_tools: true, is_economic: true },
  { provider: 'GOOGLE', model_id: 'gemini-3.1-flash-lite', supports_tools: true, is_economic: false },
  { provider: 'OPENAI', model_id: 'gpt-6.1-sol', supports_tools: true, is_economic: false },
  { provider: 'OPENAI', model_id: 'gpt-6-sol', supports_tools: true, is_economic: false },
  { provider: 'OPENAI', model_id: 'gpt-6-luna-pro', supports_tools: true, is_economic: false },
  { provider: 'OPENAI', model_id: 'gpt-6-luna', supports_tools: true, is_economic: true },
  { provider: 'OPENAI', model_id: 'gpt-5.6-luna', supports_tools: true, is_economic: true },
  { provider: 'OPENROUTER', model_id: 'anthropic/claude-sonnet-5.5', supports_tools: true, is_economic: false },
  { provider: 'OPENROUTER', model_id: 'openai/gpt-6.1-sol', supports_tools: true, is_economic: false },
  { provider: 'OPENROUTER', model_id: 'google/gemini-3.8-flash', supports_tools: true, is_economic: true },
  { provider: 'OPENROUTER', model_id: 'anthropic/claude-haiku-5.5', supports_tools: true, is_economic: true },
  { provider: 'OPENROUTER', model_id: 'openai/gpt-6-luna', supports_tools: true, is_economic: true },
]

// Los pares aprobados, en el orden de `pairRows` (proveedor y rol).
const PAIRS_SEEDED: readonly PairRow[] = [
  { provider: 'ANTHROPIC', role: 'AGENT', primary_model_id: 'claude-sonnet-5-5', fallback_model_id: 'claude-sonnet-5', updated_by: null },
  { provider: 'ANTHROPIC', role: 'ROUTER', primary_model_id: 'claude-haiku-5-5', fallback_model_id: 'claude-sonnet-5-5', updated_by: null },
  { provider: 'GOOGLE', role: 'AGENT', primary_model_id: 'gemini-4-argon', fallback_model_id: 'gemini-3.8-flash', updated_by: null },
  { provider: 'GOOGLE', role: 'ROUTER', primary_model_id: 'gemini-3.8-flash', fallback_model_id: 'gemini-3.5-flash-lite', updated_by: null },
  { provider: 'OPENAI', role: 'AGENT', primary_model_id: 'gpt-6.1-sol', fallback_model_id: 'gpt-6-sol', updated_by: null },
  { provider: 'OPENAI', role: 'ROUTER', primary_model_id: 'gpt-6-luna', fallback_model_id: 'gpt-5.6-luna', updated_by: null },
  {
    provider: 'OPENROUTER',
    role: 'AGENT',
    primary_model_id: 'anthropic/claude-sonnet-5.5',
    fallback_model_id: 'openai/gpt-6.1-sol',
    updated_by: null,
  },
  {
    provider: 'OPENROUTER',
    role: 'ROUTER',
    primary_model_id: 'anthropic/claude-haiku-5.5',
    fallback_model_id: 'google/gemini-3.8-flash',
    updated_by: null,
  },
]

const INSERT_PAIR =
  `INSERT INTO "${PAIRS}" ("provider", "role", "primary_model_id", "fallback_model_id") ` +
  `VALUES ($1::"ai_provider_code", $2::"ai_model_role", $3, $4)`

afterAll(async () => {
  await prisma.$disconnect()
})

describe('migracion ai_agent_model_pairs contra Postgres real', () => {
  it('existe exactamente una carpeta de la migracion, con su down.sql', () => {
    expect(carpetas).toHaveLength(1)
    expect(existsSync(join(migrationDir, 'down.sql'))).toBe(true)
  })

  it('R1: ai_models gana supports_tools e is_economic, booleanas obligatorias con false por defecto', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { models } = await schemaSnapshot(tx)
      expect(models.columns.filter((column) => ['is_economic', 'supports_tools'].includes(column.column_name))).toEqual([
        { column_name: 'is_economic', data_type: 'boolean', udt_name: 'bool', is_nullable: 'NO', column_default: 'false' },
        { column_name: 'supports_tools', data_type: 'boolean', udt_name: 'bool', is_nullable: 'NO', column_default: 'false' },
      ])
      expect(
        await failureOf(tx, `UPDATE "${MODELS}" SET "supports_tools" = NULL WHERE "model_id" = 'gpt-6-luna'`),
      ).toMatch(/23502/)
      expect(await failureOf(tx, `UPDATE "${MODELS}" SET "is_economic" = NULL WHERE "model_id" = 'gpt-6-luna'`)).toMatch(
        /23502/,
      )
      await tx.$executeRawUnsafe(
        `INSERT INTO "${MODELS}" ("provider", "model_id", "sort_order") VALUES ('OPENAI', 'modelo-nuevo', 9)`,
      )
      expect(
        await tx.$queryRawUnsafe(
          `SELECT supports_tools, is_economic FROM "${MODELS}" WHERE "model_id" = 'modelo-nuevo'`,
        ),
      ).toEqual([{ supports_tools: false, is_economic: false }])
    })
  })

  it('R2: cada modelo sembrado queda con las marcas aprobadas', async () => {
    await inRolledBackTransaction(async (tx) => {
      const rows = await markRows(tx)
      expect(rows).toHaveLength(20)
      expect(rows).toEqual(MARKS)
    })
  })

  it('R2: el UP no cambia ningun otro dato del catalogo ni de las conexiones', async () => {
    await inRolledBackTransaction(async (tx) => {
      await applyStatements(tx, DOWN_STATEMENTS)
      const userId = await someUserId(tx)
      const company = await newCompanyId(tx, 'qt304_mig_pares_r2')
      await tx.$executeRawUnsafe(
        `INSERT INTO "${CONNECTIONS}" ("id", "company_id", "provider", "api_key_enc", "key_updated_at", "created_by", ` +
          `"updated_by", "updated_at", "model_id") VALUES (gen_random_uuid(), $1::uuid, 'GOOGLE', 'v1:cifrado', ` +
          `CURRENT_TIMESTAMP, $2::uuid, $2::uuid, CURRENT_TIMESTAMP, 'gemini-3.7-flash')`,
        company,
        userId,
      )
      const catalogoAntes = await catalogRows(tx)
      const conexionesAntes = await connectionRows(tx)

      await applyStatements(tx, UP_STATEMENTS)

      expect(await catalogRows(tx)).toEqual(catalogoAntes)
      expect(await connectionRows(tx)).toEqual(conexionesAntes)
    })
  })

  it('R5: la tabla de pares no lleva empresa, tiene PK por proveedor y rol, FK, CHECK, indice y RLS forzada sin policies', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { pairs, roleType: roles } = await schemaSnapshot(tx)
      expect(roles).toEqual(['AGENT', 'ROUTER'])
      expect(pairs.columns).toEqual([
        { column_name: 'fallback_model_id', data_type: 'text', udt_name: 'text', is_nullable: 'NO', column_default: null },
        { column_name: 'primary_model_id', data_type: 'text', udt_name: 'text', is_nullable: 'NO', column_default: null },
        { column_name: 'provider', data_type: 'USER-DEFINED', udt_name: 'ai_provider_code', is_nullable: 'NO', column_default: null },
        { column_name: 'role', data_type: 'USER-DEFINED', udt_name: 'ai_model_role', is_nullable: 'NO', column_default: null },
        {
          column_name: 'updated_at',
          data_type: 'timestamp with time zone',
          udt_name: 'timestamptz',
          is_nullable: 'NO',
          column_default: 'CURRENT_TIMESTAMP',
        },
        { column_name: 'updated_by', data_type: 'uuid', udt_name: 'uuid', is_nullable: 'YES', column_default: null },
      ])
      expect(pairs.constraints).toEqual([
        { conname: 'ai_agent_model_pairs_distinct_models', def: 'CHECK ((primary_model_id <> fallback_model_id))' },
        {
          conname: 'ai_agent_model_pairs_fallback_model_fkey',
          def:
            'FOREIGN KEY (provider, fallback_model_id) REFERENCES ai_models(provider, model_id) ' +
            'ON UPDATE CASCADE ON DELETE RESTRICT',
        },
        { conname: 'ai_agent_model_pairs_pkey', def: 'PRIMARY KEY (provider, role)' },
        {
          conname: 'ai_agent_model_pairs_primary_model_fkey',
          def:
            'FOREIGN KEY (provider, primary_model_id) REFERENCES ai_models(provider, model_id) ' +
            'ON UPDATE CASCADE ON DELETE RESTRICT',
        },
        {
          conname: 'ai_agent_model_pairs_provider_fkey',
          def: 'FOREIGN KEY (provider) REFERENCES ai_providers(code) ON UPDATE CASCADE ON DELETE RESTRICT',
        },
        {
          conname: 'ai_agent_model_pairs_updated_by_fkey',
          def: 'FOREIGN KEY (updated_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT',
        },
      ])
      expect(pairs.indexes.map((index) => index.indexname)).toEqual([
        'ai_agent_model_pairs_pkey',
        'ai_agent_model_pairs_updated_by_idx',
      ])
      expect(pairs.rls).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }])
      expect(pairs.policies).toEqual([])
    })
  })

  it('R5: como mucho un par por proveedor y rol, con principal y respaldo obligatorios', async () => {
    await inRolledBackTransaction(async (tx) => {
      expect(await failureOf(tx, INSERT_PAIR, 'OPENAI', 'AGENT', 'gpt-6-luna', 'gpt-5.6-luna')).toMatch(/23505/)
      expect(
        await failureOf(
          tx,
          `UPDATE "${PAIRS}" SET "fallback_model_id" = NULL WHERE "provider" = 'OPENAI' AND "role" = 'AGENT'`,
        ),
      ).toMatch(/23502/)
      expect(
        await failureOf(
          tx,
          `UPDATE "${PAIRS}" SET "primary_model_id" = NULL WHERE "provider" = 'OPENAI' AND "role" = 'AGENT'`,
        ),
      ).toMatch(/23502/)
      expect(await failureOf(tx, INSERT_PAIR, 'OPENAI', 'OTRO', 'gpt-6-luna', 'gpt-5.6-luna')).toMatch(/22P02/)

      // Sin el par, el mismo proveedor y rol vuelve a admitir uno.
      await tx.$executeRawUnsafe(`DELETE FROM "${PAIRS}" WHERE "provider" = 'OPENAI' AND "role" = 'AGENT'`)
      expect(await failureOf(tx, INSERT_PAIR, 'OPENAI', 'AGENT', 'gpt-6-luna', 'gpt-5.6-luna')).toBeNull()
    })
  })

  it('R6: la base rechaza un modelo de otro proveedor o fuera del catalogo, en el principal y en el respaldo', async () => {
    await inRolledBackTransaction(async (tx) => {
      const update = (columna: string, valor: string) =>
        failureOf(
          tx,
          `UPDATE "${PAIRS}" SET "${columna}" = $1 WHERE "provider" = 'GOOGLE' AND "role" = 'AGENT'`,
          valor,
        )
      expect(await update('primary_model_id', 'gpt-6-luna')).toMatch(/23503/)
      expect(await update('fallback_model_id', 'claude-sonnet-5')).toMatch(/23503/)
      expect(await update('primary_model_id', 'no-existe')).toMatch(/23503/)
      expect(await update('fallback_model_id', 'no-existe')).toMatch(/23503/)
      expect(await update('primary_model_id', 'gemini-3.7-flash')).toBeNull()

      // Cambiar el proveedor del par sin cambiar sus modelos tambien choca con la FK compuesta.
      expect(
        await failureOf(tx, `UPDATE "${PAIRS}" SET "provider" = 'OPENAI' WHERE "provider" = 'GOOGLE' AND "role" = 'AGENT'`),
      ).toMatch(/23503|23505/)
      // El autor, si lo hay, es un usuario existente.
      expect(
        await failureOf(
          tx,
          `UPDATE "${PAIRS}" SET "updated_by" = gen_random_uuid() WHERE "provider" = 'GOOGLE' AND "role" = 'AGENT'`,
        ),
      ).toMatch(/23503/)
      const userId = await someUserId(tx)
      expect(
        await failureOf(
          tx,
          `UPDATE "${PAIRS}" SET "updated_by" = $1::uuid WHERE "provider" = 'GOOGLE' AND "role" = 'AGENT'`,
          userId,
        ),
      ).toBeNull()
    })
  })

  it('R7: la base rechaza un par cuyo principal y respaldo son el mismo modelo', async () => {
    await inRolledBackTransaction(async (tx) => {
      expect(
        await failureOf(
          tx,
          `UPDATE "${PAIRS}" SET "fallback_model_id" = "primary_model_id" WHERE "provider" = 'ANTHROPIC' AND "role" = 'AGENT'`,
        ),
      ).toMatch(/23514/)
      await tx.$executeRawUnsafe(`DELETE FROM "${PAIRS}" WHERE "provider" = 'OPENAI' AND "role" = 'ROUTER'`)
      expect(await failureOf(tx, INSERT_PAIR, 'OPENAI', 'ROUTER', 'gpt-6-luna', 'gpt-6-luna')).toMatch(/23514/)
    })
  })

  it('R8: la migracion siembra exactamente los ocho pares aprobados, sin autor', async () => {
    await inRolledBackTransaction(async (tx) => {
      const rows = await pairRows(tx)
      expect(rows).toHaveLength(8)
      expect(rows).toEqual(PAIRS_SEEDED)
    })
  })

  it('R8: el respaldo del enrutador de ANTHROPIC no es economico, a proposito; los cuatro principales del enrutador si', async () => {
    await inRolledBackTransaction(async (tx) => {
      const marcas = await markRows(tx)
      const marca = (provider: string, modelId: string) =>
        marcas.find((row) => row.provider === provider && row.model_id === modelId)
      const pares = await pairRows(tx)

      const anthropicRouter = pares.find((row) => row.provider === 'ANTHROPIC' && row.role === 'ROUTER')
      expect(anthropicRouter?.fallback_model_id).toBe('claude-sonnet-5-5')
      expect(marca('ANTHROPIC', 'claude-sonnet-5-5')?.is_economic).toBe(false)

      for (const par of pares) {
        expect(marca(par.provider, par.primary_model_id)?.supports_tools, par.primary_model_id).toBe(true)
        expect(marca(par.provider, par.fallback_model_id)?.supports_tools, par.fallback_model_id).toBe(true)
        if (par.role === 'ROUTER') {
          expect(marca(par.provider, par.primary_model_id)?.is_economic, par.primary_model_id).toBe(true)
        }
      }
    })
  })

  it('R9: un modelo que es principal o respaldo de un par no se puede borrar del catalogo; uno sin uso, si', async () => {
    await inRolledBackTransaction(async (tx) => {
      const borrar = (provider: string, modelId: string) =>
        failureOf(tx, `DELETE FROM "${MODELS}" WHERE "provider" = $1::"ai_provider_code" AND "model_id" = $2`, provider, modelId)
      // 23503 en Postgres 17; 23001 en 18 (docs/verification.md).
      expect(await borrar('OPENAI', 'gpt-6.1-sol')).toMatch(/23503|23001/)
      expect(await borrar('OPENAI', 'gpt-5.6-luna')).toMatch(/23503|23001/)
      expect(await borrar('OPENROUTER', 'google/gemini-3.8-flash')).toMatch(/23503|23001/)
      expect(await borrar('OPENAI', 'gpt-6-luna-pro')).toBeNull()
      expect(await borrar('GOOGLE', 'gemini-3.1-flash-lite')).toBeNull()
    })
  })

  it('R3: el DOWN quita la tabla de pares, el tipo de rol y las dos marcas, y deja catalogo y conexiones con sus datos', async () => {
    await inRolledBackTransaction(async (tx) => {
      const catalogoAntes = await catalogRows(tx)
      const conexionesAntes = await connectionRows(tx)
      const antes = await schemaSnapshot(tx)

      await applyStatements(tx, DOWN_STATEMENTS)

      const despues = await schemaSnapshot(tx)
      expect(despues.pairs.columns).toEqual([])
      expect(despues.pairs.constraints).toEqual([])
      expect(despues.roleType).toEqual([])
      expect(despues.models.columns).toEqual(
        antes.models.columns.filter((column) => !['is_economic', 'supports_tools'].includes(column.column_name)),
      )
      expect(despues.models.columns.map((column) => column.column_name)).toEqual([
        'is_default',
        'model_id',
        'provider',
        'sort_order',
      ])
      expect(despues.models.constraints).toEqual(antes.models.constraints)
      expect(despues.models.indexes).toEqual(antes.models.indexes)
      expect(despues.models.rls).toEqual(antes.models.rls)
      expect(despues.connections).toEqual(antes.connections)
      expect(await catalogRows(tx)).toEqual(catalogoAntes)
      expect(await connectionRows(tx)).toEqual(conexionesAntes)
    })
  })

  it('R3: vuelta e ida dejan el mismo esquema, las mismas marcas y los mismos pares', async () => {
    await inRolledBackTransaction(async (tx) => {
      const antes = await schemaSnapshot(tx)
      const marcasAntes = await markRows(tx)
      const paresAntes = await pairRows(tx)

      await applyStatements(tx, DOWN_STATEMENTS)
      await applyStatements(tx, UP_STATEMENTS)

      expect(await schemaSnapshot(tx)).toEqual(antes)
      expect(await markRows(tx)).toEqual(marcasAntes)
      expect(await pairRows(tx)).toEqual(paresAntes)
    })
  })

  it('R5 (sensibilidad): un UP sin el FORCE deja la RLS sin forzar y el snapshot lo detecta', async () => {
    const upSinForce = UP_STATEMENTS.filter((statement) => !/FORCE ROW LEVEL SECURITY/i.test(statement))
    expect(upSinForce, 'la mutacion no quito la sentencia').toHaveLength(UP_STATEMENTS.length - 1)

    await inRolledBackTransaction(async (tx) => {
      await applyStatements(tx, DOWN_STATEMENTS)
      await applyStatements(tx, upSinForce)
      const { pairs } = await schemaSnapshot(tx)
      expect(pairs.rls).toEqual([{ relrowsecurity: true, relforcerowsecurity: false }])
    })
  })
})
