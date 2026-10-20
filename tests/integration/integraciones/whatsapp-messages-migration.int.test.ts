// La migracion `db/migrations/*_whatsapp_contacts_and_messages/` contra Postgres REAL.
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
const carpetas = readdirSync(migrationsDir).filter((name) => /_whatsapp_contacts_and_messages$/.test(name))
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

const TABLES = ['whatsapp_contacts', 'whatsapp_messages'] as const
const ENUMS = [
  'whatsapp_message_direction',
  'whatsapp_message_origin',
  'whatsapp_message_status',
  'whatsapp_message_type',
] as const

/**
 * Las migraciones POSTERIORES con una FK hacia estas tablas, con el mismo recorrido transitivo que
 * `whatsapp-connection-migration.int.test.ts`: sus DOWN van antes que el de esta (de la mas reciente
 * a la mas antigua) y sus UP despues. Hoy no hay ninguna.
 */
const timestampDe = (nombre: string): string => nombre.split('_')[0] as string
const TABLAS_DEPENDIENTES = new Set<string>(TABLES)
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
  const tables = [...TABLES]
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
    WHERE table_schema = 'public' AND table_name = ANY(${tables})
    ORDER BY table_name, ordinal_position`
  const indexes = await tx.$queryRaw<{ tablename: string; indexname: string; indexdef: string }[]>`
    SELECT tablename, indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = ANY(${tables})
    ORDER BY tablename, indexname`
  const constraints = await tx.$queryRaw<{ relname: string; conname: string; def: string }[]>`
    SELECT t.relname, c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = ANY(${tables}) AND t.relnamespace = 'public'::regnamespace
    ORDER BY t.relname, c.conname`
  const rls = await tx.$queryRaw<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
    SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
    WHERE relname = ANY(${tables}) AND relnamespace = 'public'::regnamespace
    ORDER BY relname`
  const enums = await tx.$queryRaw<{ typname: string; labels: string[] }[]>`
    SELECT t.typname, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = ANY(${[...ENUMS]})
    GROUP BY t.typname
    ORDER BY t.typname`
  return { columns, indexes, constraints, rls, enums }
}

async function publicTables(tx: Prisma.TransactionClient): Promise<readonly string[]> {
  const rows = await tx.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  return rows.map((row) => row.tablename)
}

afterAll(async () => {
  await prisma.$disconnect()
})

describe('migracion whatsapp_contacts_and_messages contra Postgres real', () => {
  it('existe exactamente una carpeta de la migracion, con su down.sql', () => {
    expect(carpetas).toHaveLength(1)
    expect(existsSync(join(migrationDir, 'down.sql'))).toBe(true)
  })

  it('R28 R29: las dos tablas, los cuatro enums, RLS activada y forzada y las FK compuestas de empresa', async () => {
    await inRolledBackTransaction(async (tx) => {
      const snapshot = await schemaSnapshot(tx)
      expect(snapshot.rls).toEqual([
        { relname: 'whatsapp_contacts', relrowsecurity: true, relforcerowsecurity: true },
        { relname: 'whatsapp_messages', relrowsecurity: true, relforcerowsecurity: true },
      ])
      expect(snapshot.enums.map((e) => e.typname)).toEqual([...ENUMS])
      expect(snapshot.constraints.map((c) => `${c.relname} ${c.def}`)).toEqual(
        expect.arrayContaining([
          'whatsapp_contacts FOREIGN KEY (company_id, connection_id) REFERENCES whatsapp_connections(company_id, id) ON UPDATE CASCADE ON DELETE RESTRICT',
          'whatsapp_messages FOREIGN KEY (company_id, connection_id) REFERENCES whatsapp_connections(company_id, id) ON UPDATE CASCADE ON DELETE RESTRICT',
          'whatsapp_messages FOREIGN KEY (company_id, connection_id, contact_id) REFERENCES whatsapp_contacts(company_id, connection_id, id) ON UPDATE CASCADE ON DELETE RESTRICT',
          'whatsapp_contacts FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE ON DELETE RESTRICT',
          'whatsapp_messages FOREIGN KEY (company_id) REFERENCES companies(id) ON UPDATE CASCADE ON DELETE RESTRICT',
        ]),
      )
    })
  })

  it('R28 R29: el DOWN quita las dos tablas y los cuatro tipos, y el resto de tablas queda igual', async () => {
    await inRolledBackTransaction(async (tx) => {
      const tablasAntes = await publicTables(tx)
      expect(tablasAntes).toEqual(expect.arrayContaining([...TABLES]))

      await applyStatements(tx, DOWN_DE_DEPENDIENTES)
      await applyStatements(tx, DOWN_STATEMENTS)

      const snapshot = await schemaSnapshot(tx)
      expect(snapshot.columns).toEqual([])
      expect(snapshot.enums).toEqual([])
      expect(await publicTables(tx)).toEqual(
        tablasAntes.filter(
          (name) => !(TABLES as readonly string[]).includes(name) && !TABLAS_DE_DEPENDIENTES.has(name),
        ),
      )
    })
  })

  it('R28 R29: ida, vuelta e ida dejan exactamente el mismo esquema', async () => {
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

  it('R28 (sensibilidad): un UP sin el FORCE de contactos deja su RLS sin forzar y el snapshot lo detecta', async () => {
    const upSinForce = UP_STATEMENTS.filter(
      (statement) => !/"whatsapp_contacts"\s+FORCE ROW LEVEL SECURITY/i.test(statement),
    )
    expect(upSinForce, 'la mutacion no quito ninguna sentencia').toHaveLength(UP_STATEMENTS.length - 1)

    await inRolledBackTransaction(async (tx) => {
      await applyStatements(tx, DOWN_DE_DEPENDIENTES)
      await applyStatements(tx, DOWN_STATEMENTS)
      await applyStatements(tx, upSinForce)
      await applyStatements(tx, UP_DE_DEPENDIENTES)
      expect((await schemaSnapshot(tx)).rls).toEqual([
        { relname: 'whatsapp_contacts', relrowsecurity: true, relforcerowsecurity: false },
        { relname: 'whatsapp_messages', relrowsecurity: true, relforcerowsecurity: true },
      ])
    })
  })
})
