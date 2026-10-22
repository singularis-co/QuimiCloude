// La migracion `db/migrations/*_whatsapp_templates/` contra Postgres REAL.
//
// Aislamiento: cada `it` corre dentro de `prisma.$transaction` interactiva y termina lanzando
// `RollbackSignal`, asi que ninguna fila ni ningun DDL sobrevive. El SQL se lee del archivo.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
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
const carpetas = readdirSync(migrationsDir).filter((name) => /_whatsapp_templates$/.test(name))
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

const TABLE = 'whatsapp_templates'
const ENUMS = ['whatsapp_template_category', 'whatsapp_template_status'] as const
// `company_id_id_key` lo pone la migracion del diccionario de variables, destino de su FK compuesta.
const INDEXES = [
  'whatsapp_templates_company_id_id_key',
  'whatsapp_templates_connection_meta_id_key',
  'whatsapp_templates_created_by_idx',
  'whatsapp_templates_name_language_live_key',
  'whatsapp_templates_pkey',
] as const

/**
 * Las migraciones POSTERIORES con una FK hacia esta tabla, con el mismo recorrido transitivo que
 * `whatsapp-messages-migration.int.test.ts`: sus DOWN van antes que el de esta y sus UP despues.
 */
const timestampDe = (nombre: string): string => nombre.split('_')[0] as string
const TABLAS_DEPENDIENTES = new Set<string>([TABLE])
const TABLAS_DE_DEPENDIENTES = new Set<string>()
const DEPENDIENTES_POSTERIORES = readdirSync(migrationsDir)
  .filter((nombre) => timestampDe(nombre) > timestampDe(basename(migrationDir)))
  .filter((nombre) => existsSync(join(migrationsDir, nombre, 'migration.sql')))
  .sort()
  .filter((nombre) => {
    const sql = readFileSync(join(migrationsDir, nombre, 'migration.sql'), 'utf8')
    const referenciadas = [...sql.matchAll(/REFERENCES\s+"(\w+)"/g)].map((m) => m[1] as string)
    if (!referenciadas.some((tabla) => TABLAS_DEPENDIENTES.has(tabla))) return false
    for (const m of sql.matchAll(/CREATE\s+TABLE\s+"(\w+)"/g)) {
      TABLAS_DEPENDIENTES.add(m[1] as string)
      TABLAS_DE_DEPENDIENTES.add(m[1] as string)
    }
    return true
  })
const DOWN_DE_DEPENDIENTES = [...DEPENDIENTES_POSTERIORES]
  .reverse()
  .flatMap((nombre) => statementsOf(readFileSync(join(migrationsDir, nombre, 'down.sql'), 'utf8')))
const UP_DE_DEPENDIENTES = DEPENDIENTES_POSTERIORES.flatMap((nombre) =>
  statementsOf(readFileSync(join(migrationsDir, nombre, 'migration.sql'), 'utf8')),
)

async function applyStatements(tx: Prisma.TransactionClient, statements: readonly string[]): Promise<void> {
  for (const statement of statements) {
    await tx.$executeRawUnsafe(statement)
  }
}

/** Todo lo que la migracion define, leido del catalogo y en orden estable. */
async function schemaSnapshot(tx: Prisma.TransactionClient) {
  const columns = await tx.$queryRaw<
    {
      table_name: string
      column_name: string
      data_type: string
      udt_name: string
      is_nullable: string
      column_default: string | null
    }[]
  >`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (table_name = ${TABLE} OR (table_name = 'whatsapp_connections' AND column_name = 'templates_synced_at'))
    ORDER BY table_name, ordinal_position`
  const indexes = await tx.$queryRaw<{ indexname: string; indexdef: string }[]>`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = ${TABLE}
    ORDER BY indexname`
  const constraints = await tx.$queryRaw<{ conname: string; def: string }[]>`
    SELECT c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = ${TABLE} AND t.relnamespace = 'public'::regnamespace
    ORDER BY c.conname`
  const rls = await tx.$queryRaw<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
    SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
    WHERE relname = ${TABLE} AND relnamespace = 'public'::regnamespace`
  const policies = await tx.$queryRaw<{ policyname: string }[]>`
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = ${TABLE}`
  const enums = await tx.$queryRaw<{ typname: string; labels: string[] }[]>`
    SELECT t.typname, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = ANY(${[...ENUMS]})
    GROUP BY t.typname
    ORDER BY t.typname`
  return { columns, indexes, constraints, rls, policies, enums }
}

async function publicTables(tx: Prisma.TransactionClient): Promise<readonly string[]> {
  const rows = await tx.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  return rows.map((row) => row.tablename)
}

afterAll(async () => {
  await prisma.$disconnect()
})

describe('migracion whatsapp_templates contra Postgres real', () => {
  it('existe exactamente una carpeta de la migracion, con su down.sql', () => {
    expect(carpetas).toHaveLength(1)
    expect(existsSync(join(migrationDir, 'down.sql'))).toBe(true)
  })

  it('R50: RLS activada y forzada sin policies, los dos enums, los indices por nombre y la columna de la conexion', async () => {
    await inRolledBackTransaction(async (tx) => {
      const snapshot = await schemaSnapshot(tx)
      expect(snapshot.rls).toEqual([{ relname: TABLE, relrowsecurity: true, relforcerowsecurity: true }])
      expect(snapshot.policies).toEqual([])
      expect(snapshot.enums).toEqual([
        { typname: 'whatsapp_template_category', labels: ['MARKETING', 'UTILITY', 'AUTHENTICATION'] },
        {
          typname: 'whatsapp_template_status',
          labels: ['PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED', 'OTHER'],
        },
      ])
      expect(snapshot.indexes.map((index) => index.indexname)).toEqual([...INDEXES])
      const parcial = snapshot.indexes.find((index) => index.indexname === 'whatsapp_templates_name_language_live_key')
      expect(parcial?.indexdef).toMatch(/UNIQUE INDEX .*\(connection_id, name, language\) WHERE \(deleted_at IS NULL\)/)
      const porMeta = snapshot.indexes.find((index) => index.indexname === 'whatsapp_templates_connection_meta_id_key')
      expect(porMeta?.indexdef).toMatch(/UNIQUE INDEX .*\(connection_id, meta_template_id\)$/)
      expect(snapshot.columns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            table_name: 'whatsapp_connections',
            column_name: 'templates_synced_at',
            udt_name: 'timestamptz',
            is_nullable: 'YES',
          }),
        ]),
      )
    })
  })

  it('R1 R50: la FK compuesta de empresa a la conexion, la de empresa, la del autor y los CHECK', async () => {
    await inRolledBackTransaction(async (tx) => {
      const defs = (await schemaSnapshot(tx)).constraints.map((c) => c.def)
      expect(defs).toEqual(
        expect.arrayContaining([
          'FOREIGN KEY (company_id, connection_id) REFERENCES whatsapp_connections(company_id, id) ON UPDATE CASCADE ON DELETE RESTRICT',
          'FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE ON DELETE RESTRICT',
          'FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT',
        ]),
      )
      const checks = (await schemaSnapshot(tx)).constraints.filter((c) => c.def.startsWith('CHECK')).map((c) => c.conname)
      expect(checks.sort()).toEqual([
        'whatsapp_templates_enabled_requires_mapped',
        'whatsapp_templates_language_not_empty',
        'whatsapp_templates_meta_template_id_not_empty',
        'whatsapp_templates_name_not_empty',
        'whatsapp_templates_status_raw_only_other',
      ])
    })
  })

  it('R50: el DOWN quita la tabla, los dos tipos y la columna de la conexion, y el resto de tablas queda igual', async () => {
    await inRolledBackTransaction(async (tx) => {
      const tablasAntes = await publicTables(tx)
      expect(tablasAntes).toContain(TABLE)

      await applyStatements(tx, DOWN_DE_DEPENDIENTES)
      await applyStatements(tx, DOWN_STATEMENTS)

      const snapshot = await schemaSnapshot(tx)
      expect(snapshot.columns).toEqual([])
      expect(snapshot.enums).toEqual([])
      expect(await publicTables(tx)).toEqual(
        tablasAntes.filter((name) => name !== TABLE && !TABLAS_DE_DEPENDIENTES.has(name)),
      )
    })
  })

  it('R50: ida, vuelta e ida dejan exactamente el mismo esquema', async () => {
    await inRolledBackTransaction(async (tx) => {
      const antes = await schemaSnapshot(tx)
      expect(antes.columns.length).toBeGreaterThan(0)

      await applyStatements(tx, DOWN_DE_DEPENDIENTES)
      await applyStatements(tx, DOWN_STATEMENTS)
      await applyStatements(tx, UP_STATEMENTS)
      await applyStatements(tx, UP_DE_DEPENDIENTES)

      expect(await schemaSnapshot(tx)).toEqual(antes)
    })
  })

  it('R50 (sensibilidad): un UP sin el FORCE deja la RLS sin forzar y el snapshot lo detecta', async () => {
    const upSinForce = UP_STATEMENTS.filter((statement) => !/"whatsapp_templates"\s+FORCE ROW LEVEL SECURITY/i.test(statement))
    expect(upSinForce, 'la mutacion no quito ninguna sentencia').toHaveLength(UP_STATEMENTS.length - 1)

    await inRolledBackTransaction(async (tx) => {
      await applyStatements(tx, DOWN_DE_DEPENDIENTES)
      await applyStatements(tx, DOWN_STATEMENTS)
      await applyStatements(tx, upSinForce)
      await applyStatements(tx, UP_DE_DEPENDIENTES)
      expect((await schemaSnapshot(tx)).rls).toEqual([
        { relname: TABLE, relrowsecurity: true, relforcerowsecurity: false },
      ])
    })
  })
})
