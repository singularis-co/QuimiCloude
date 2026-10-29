// La migración `db/migrations/*_plans/` contra Postgres real: su `down.sql` y su `migration.sql`,
// leídos de los archivos y no copiados.
//
// AISLAMIENTO — `transaccion`: cada `it` corre dentro de una `prisma.$transaction` interactiva que
// termina lanzando `RollbackSignal`, así que ni el DDL ni ninguna fila sobreviven al caso. La base
// de la corrida ya tiene la migración aplicada: el caso aplica el DOWN, mira, y vuelve a aplicar el UP.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Prisma } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'

import { prisma } from '@/lib/shared/db/prisma'

type Tx = Prisma.TransactionClient

class RollbackSignal extends Error {
  constructor() {
    super('rollback de aislamiento del test')
    this.name = 'RollbackSignal'
  }
}

async function inRolledBackTransaction(body: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await body(tx)
        throw new RollbackSignal()
      },
      { maxWait: 10_000, timeout: 60_000 },
    )
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error
  }
}

afterAll(async () => {
  await prisma.$disconnect()
})

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
const carpetas = readdirSync(migrationsDir).filter((name) => /^\d{14}_plans$/.test(name))
expect(carpetas, 'debe existir exactamente una migracion *_plans').toHaveLength(1)
const migrationDir = join(migrationsDir, carpetas[0] as string)

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

// Ninguna migración posterior cuelga de estas tablas: si alguna lo hiciera, el DOWN aplicado solo
// fallaría con 2BP01 y este caso tendría que revertirla antes, como hacen las de WhatsApp.
const POSTERIORES_QUE_LAS_REFERENCIAN = readdirSync(migrationsDir)
  .filter((nombre) => nombre > (carpetas[0] as string))
  .filter((nombre) => existsSync(join(migrationsDir, nombre, 'migration.sql')))
  .filter((nombre) =>
    /REFERENCES\s+"(plans|plan_addons)"/.test(readFileSync(join(migrationsDir, nombre, 'migration.sql'), 'utf8')),
  )
expect(POSTERIORES_QUE_LAS_REFERENCIAN).toEqual([])

async function apply(tx: Tx, statements: readonly string[]): Promise<void> {
  for (const statement of statements) await tx.$executeRawUnsafe(statement)
}

const TABLAS = ['plans', 'plan_addons'] as const
const SON_DE_LA_MIGRACION = new Set<string>(TABLAS)

/** Columnas, índices, restricciones y RLS de una tabla, leídos del catálogo y en orden estable. */
async function tableSnapshot(tx: Tx, table: string) {
  const columns = await tx.$queryRaw<
    {
      column_name: string
      data_type: string
      is_nullable: string
      column_default: string | null
      numeric_precision: number | null
      numeric_scale: number | null
      character_maximum_length: number | null
    }[]
  >`
    SELECT column_name, data_type, is_nullable, column_default, numeric_precision, numeric_scale,
           character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
    ORDER BY ordinal_position`
  const indexes = await tx.$queryRaw<{ indexname: string; indexdef: string }[]>`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = ${table}
    ORDER BY indexname`
  const constraints = await tx.$queryRaw<{ conname: string; def: string }[]>`
    SELECT c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = ${table} AND t.relnamespace = 'public'::regnamespace AND c.contype <> 'n'
    ORDER BY c.conname`
  const rls = await rlsOf(tx, table)
  const policies = await tx.$queryRaw<{ policyname: string }[]>`
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = ${table}
    ORDER BY policyname`
  return { columns, indexes, constraints, rls, policies }
}

async function rlsOf(tx: Tx, table: string) {
  return tx.$queryRaw<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
    SELECT relrowsecurity, relforcerowsecurity FROM pg_class
    WHERE relname = ${table} AND relnamespace = 'public'::regnamespace`
}

async function publicTables(tx: Tx): Promise<readonly string[]> {
  const rows = await tx.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  return rows.map((row) => row.tablename)
}

/** Lo que la migración no debe tocar: el catálogo de añadidos y las excepciones de las empresas. */
async function untouched(tx: Tx) {
  return {
    addons: await tx.addon.findMany({ orderBy: { key: 'asc' } }),
    overrides: await tx.companyAddonOverride.findMany({ orderBy: [{ companyId: 'asc' }, { addonKey: 'asc' }] }),
    addonsSnapshot: await tableSnapshot(tx, 'addons'),
    overridesSnapshot: await tableSnapshot(tx, 'company_addon_overrides'),
  }
}

describe('migracion plans contra Postgres real', () => {
  it('R26: plans y plan_addons tienen RLS activada y forzada, sin policies', async () => {
    await inRolledBackTransaction(async (tx) => {
      for (const table of TABLAS) {
        expect(await rlsOf(tx, table), table).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }])
        const snapshot = await tableSnapshot(tx, table)
        expect(snapshot.policies, table).toEqual([])
      }
    })
  })

  it('R33: el DOWN quita las dos tablas y deja el resto intacto; el UP las devuelve igual', async () => {
    await inRolledBackTransaction(async (tx) => {
      const tablasAntes = await publicTables(tx)
      expect(tablasAntes).toEqual(expect.arrayContaining([...TABLAS]))
      const antes = {
        plans: await tableSnapshot(tx, 'plans'),
        planAddons: await tableSnapshot(tx, 'plan_addons'),
      }
      const restoAntes = await untouched(tx)

      await apply(tx, DOWN_STATEMENTS)

      expect(await publicTables(tx)).toEqual(tablasAntes.filter((table) => !SON_DE_LA_MIGRACION.has(table)))
      for (const table of TABLAS) {
        expect(await rlsOf(tx, table), table).toEqual([])
      }
      expect(await untouched(tx)).toEqual(restoAntes)

      await apply(tx, UP_STATEMENTS)

      expect(await publicTables(tx)).toEqual(tablasAntes)
      expect({
        plans: await tableSnapshot(tx, 'plans'),
        planAddons: await tableSnapshot(tx, 'plan_addons'),
      }).toEqual(antes)
      expect(await untouched(tx)).toEqual(restoAntes)
    })
  })

  it('R33: tras el DOWN y el UP, las restricciones vuelven a morder', async () => {
    await inRolledBackTransaction(async (tx) => {
      await apply(tx, DOWN_STATEMENTS)
      await apply(tx, UP_STATEMENTS)

      const nombres = (await tableSnapshot(tx, 'plans')).constraints.map((fila) => fila.conname)
      expect(nombres).toEqual([
        'plans_annual_price_non_negative',
        'plans_currency_allowed',
        'plans_has_price',
        'plans_monthly_price_non_negative',
        'plans_name_not_blank',
        'plans_pkey',
      ])
      const indices = (await tableSnapshot(tx, 'plans')).indexes.map((fila) => fila.indexname)
      expect(indices).toEqual(['plans_name_unique', 'plans_pkey'])
      const deModulos = (await tableSnapshot(tx, 'plan_addons')).constraints.map((fila) => fila.conname)
      expect(deModulos).toEqual(['plan_addons_addon_key_fkey', 'plan_addons_pkey', 'plan_addons_plan_id_fkey'])
      for (const table of TABLAS) {
        expect(await rlsOf(tx, table), table).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }])
      }
    })
  })
})
