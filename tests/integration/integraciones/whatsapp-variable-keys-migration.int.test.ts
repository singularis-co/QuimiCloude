// La migracion `db/migrations/*_whatsapp_variable_keys/` contra Postgres REAL.
//
// Aislamiento: cada `it` corre dentro de `prisma.$transaction` interactiva y termina lanzando
// `RollbackSignal`, asi que ninguna fila ni ningun DDL sobrevive. El SQL se lee del archivo. Lo que
// se espera rechazado va en un SAVEPOINT para que la transaccion siga usable.
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
const carpetas = readdirSync(migrationsDir).filter((name) => /_whatsapp_variable_keys$/.test(name))
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

const NEW_TABLES = ['whatsapp_template_variables', 'whatsapp_variable_keys'] as const
const TABLES = ['whatsapp_template_variables', 'whatsapp_templates', 'whatsapp_variable_keys'] as const
const ENUM = 'whatsapp_template_mapping_status'

async function applyStatements(tx: Prisma.TransactionClient, statements: readonly string[]): Promise<void> {
  for (const statement of statements) {
    await tx.$executeRawUnsafe(statement)
  }
}

/** Todo lo que la migracion define o toca, leido del catalogo y en orden estable. */
async function schemaSnapshot(tx: Prisma.TransactionClient) {
  const columns = await tx.$queryRaw<
    { table_name: string; column_name: string; udt_name: string; is_nullable: string; column_default: string | null }[]
  >`
    SELECT table_name, column_name, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ANY(${[...TABLES]})
    ORDER BY table_name, ordinal_position`
  const indexes = await tx.$queryRaw<{ tablename: string; indexname: string; indexdef: string }[]>`
    SELECT tablename, indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = ANY(${[...TABLES]})
    ORDER BY tablename, indexname`
  const constraints = await tx.$queryRaw<{ relname: string; conname: string; def: string }[]>`
    SELECT t.relname, c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = ANY(${[...TABLES]}) AND t.relnamespace = 'public'::regnamespace
    ORDER BY t.relname, c.conname`
  const rls = await tx.$queryRaw<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
    SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
    WHERE relname = ANY(${[...NEW_TABLES]}) AND relnamespace = 'public'::regnamespace
    ORDER BY relname`
  const policies = await tx.$queryRaw<{ policyname: string }[]>`
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = ANY(${[...NEW_TABLES]})`
  const enums = await tx.$queryRaw<{ typname: string; labels: string[] }[]>`
    SELECT t.typname, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = ${ENUM}
    GROUP BY t.typname`
  return { columns, indexes, constraints, rls, policies, enums }
}

async function publicTables(tx: Prisma.TransactionClient): Promise<readonly string[]> {
  const rows = await tx.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  return rows.map((row) => row.tablename)
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

async function newConnectionId(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
  const userId = await someUserId(tx)
  const rows = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO "whatsapp_connections" ("id", "company_id", "display_name", "waba_id", "phone_number_id",
      "access_token_enc", "app_secret_enc", "verify_token_hash", "created_by", "updated_at")
    VALUES (gen_random_uuid(), ${companyId}::uuid, 'Conexion', 'waba', ${`phone-${companyId}`}, 'v1:a', 'v1:b',
      'hash', ${userId}::uuid, CURRENT_TIMESTAMP)
    RETURNING id::text AS id`
  return (rows[0] as { id: string }).id
}

async function insertTemplate(
  tx: Prisma.TransactionClient,
  ids: { companyId: string; connectionId: string },
  name: string,
  components: unknown,
  deleted = false,
): Promise<string> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO "whatsapp_templates" ("company_id", "connection_id", "meta_template_id", "name", "language",
      "category", "components", "status", "updated_at", "deleted_at")
    VALUES (${ids.companyId}::uuid, ${ids.connectionId}::uuid, ${`meta-${name}`}, ${name}, 'es', 'UTILITY',
      ${JSON.stringify(components)}::jsonb, 'APPROVED', CURRENT_TIMESTAMP,
      ${deleted ? new Date() : null}::timestamptz)
    RETURNING id::text AS id`
  return (rows[0] as { id: string }).id
}

/** Ejecuta `statement` en un SAVEPOINT y devuelve el SQLSTATE con que la base lo rechaza, o null. */
async function rejectionOf(tx: Prisma.TransactionClient, statement: () => Promise<unknown>): Promise<string | null> {
  await tx.$executeRawUnsafe('SAVEPOINT sp_variable_keys_test')
  try {
    await statement()
    await tx.$executeRawUnsafe('RELEASE SAVEPOINT sp_variable_keys_test')
    return null
  } catch (error) {
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT sp_variable_keys_test')
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const code: unknown = (error.meta as { code?: unknown } | undefined)?.code
      return typeof code === 'string' ? code : error.code
    }
    return error instanceof Error ? error.message : String(error)
  }
}

afterAll(async () => {
  await prisma.$disconnect()
})

describe('migracion whatsapp_variable_keys contra Postgres real', () => {
  it('existe exactamente una carpeta de la migracion, con su down.sql', () => {
    expect(carpetas).toHaveLength(1)
    expect(existsSync(join(migrationDir, 'down.sql'))).toBe(true)
  })

  it('R84: las dos tablas nuevas tienen empresa, RLS activada y forzada sin policies, y los indices y CHECK por nombre', async () => {
    await inRolledBackTransaction(async (tx) => {
      const snapshot = await schemaSnapshot(tx)
      expect(snapshot.rls).toEqual([
        { relname: 'whatsapp_template_variables', relrowsecurity: true, relforcerowsecurity: true },
        { relname: 'whatsapp_variable_keys', relrowsecurity: true, relforcerowsecurity: true },
      ])
      expect(snapshot.policies).toEqual([])
      expect(snapshot.enums).toEqual([{ typname: ENUM, labels: ['UNMAPPED', 'MAPPED'] }])
      for (const table of NEW_TABLES) {
        expect(snapshot.columns, table).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ table_name: table, column_name: 'company_id', udt_name: 'uuid', is_nullable: 'NO' }),
          ]),
        )
      }
      const indexesOf = (table: string) =>
        snapshot.indexes.filter((index) => index.tablename === table).map((index) => index.indexname)
      expect(indexesOf('whatsapp_variable_keys')).toEqual([
        'whatsapp_variable_keys_company_id_id_key',
        'whatsapp_variable_keys_company_key_key',
        'whatsapp_variable_keys_pkey',
      ])
      expect(indexesOf('whatsapp_template_variables')).toEqual([
        'whatsapp_template_variables_pkey',
        'whatsapp_template_variables_template_slot_key',
        'whatsapp_template_variables_variable_key_idx',
      ])
      expect(indexesOf('whatsapp_templates')).toContain('whatsapp_templates_company_id_id_key')
      const checksOf = (table: string) =>
        snapshot.constraints
          .filter((c) => c.relname === table && c.def.startsWith('CHECK'))
          .map((c) => c.conname)
          .sort()
      expect(checksOf('whatsapp_variable_keys')).toEqual([
        'whatsapp_variable_keys_key_format',
        'whatsapp_variable_keys_label_length',
        'whatsapp_variable_keys_value_length',
        'whatsapp_variable_keys_value_no_markers',
      ])
      expect(checksOf('whatsapp_template_variables')).toEqual([
        'whatsapp_template_variables_one_target',
        'whatsapp_template_variables_slot_format',
        'whatsapp_template_variables_system_key_format',
      ])
      expect(checksOf('whatsapp_templates')).toContain('whatsapp_templates_enabled_requires_mapped')
    })
  })

  it('R84 R88: el CHECK de la clave de constante admite entidad.campo y rechaza lo demas', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await newCompanyId(tx, `Empresa variables ${Date.now()}`)
      const connectionId = await newConnectionId(tx, companyId)
      const templateId = await insertTemplate(tx, { companyId, connectionId }, 'constante', [
        { type: 'BODY', text: 'Hola {{1}}' },
      ])
      const insertBinding = (systemKey: string) => () =>
        tx.$executeRaw`
          INSERT INTO "whatsapp_template_variables" ("company_id", "template_id", "slot", "system_key")
          VALUES (${companyId}::uuid, ${templateId}::uuid, 'body.1', ${systemKey})`
      const casos: readonly [string, string | null][] = [
        ['nombre', '23514'],
        ['cliente.nombre.corto', '23514'],
        [`cliente.${'a'.repeat(41)}`, '23514'],
        ['Cliente.nombre', '23514'],
        ['cliente.nombre', null],
      ]
      for (const [systemKey, expected] of casos) {
        expect(await rejectionOf(tx, insertBinding(systemKey)), systemKey).toBe(expected)
      }
    })
  })

  it('R84: el DOWN quita las dos tablas, el tipo, las dos columnas, el CHECK y el indice, y el resto de tablas queda igual', async () => {
    await inRolledBackTransaction(async (tx) => {
      const tablasAntes = await publicTables(tx)
      await applyStatements(tx, DOWN_STATEMENTS)

      const snapshot = await schemaSnapshot(tx)
      expect(snapshot.enums).toEqual([])
      expect(snapshot.rls).toEqual([])
      expect(snapshot.columns.filter((c) => c.table_name !== 'whatsapp_templates')).toEqual([])
      expect(snapshot.columns.map((c) => c.column_name)).not.toEqual(expect.arrayContaining(['mapping_status']))
      expect(snapshot.columns.map((c) => c.column_name)).not.toEqual(expect.arrayContaining(['enabled']))
      expect(snapshot.indexes.map((i) => i.indexname)).not.toContain('whatsapp_templates_company_id_id_key')
      expect(snapshot.constraints.map((c) => c.conname)).not.toContain('whatsapp_templates_enabled_requires_mapped')
      expect(await publicTables(tx)).toEqual(tablasAntes.filter((name) => !(NEW_TABLES as readonly string[]).includes(name)))
    })
  })

  it('R84: ida, vuelta e ida dejan exactamente el mismo esquema', async () => {
    await inRolledBackTransaction(async (tx) => {
      const antes = await schemaSnapshot(tx)
      expect(antes.columns.length).toBeGreaterThan(0)

      await applyStatements(tx, DOWN_STATEMENTS)
      await applyStatements(tx, UP_STATEMENTS)

      expect(await schemaSnapshot(tx)).toEqual(antes)
    })
  })

  it('R86 R95: el relleno habilita solo las vivas sin variables con contenido editable; el resto queda sin relacionar', async () => {
    await inRolledBackTransaction(async (tx) => {
      await applyStatements(tx, DOWN_STATEMENTS)
      const companyId = await newCompanyId(tx, `Empresa relleno ${Date.now()}`)
      const ids = { companyId, connectionId: await newConnectionId(tx, companyId) }
      const body = { type: 'BODY', text: 'Hola' }
      const casos: readonly { name: string; components: unknown; deleted?: boolean; mapped: boolean }[] = [
        { name: 'sin_variables', components: [body], mapped: true },
        { name: 'con_numero', components: [{ type: 'BODY', text: 'Hola {{1}}', example: { body_text: [['Ana']] } }], mapped: false },
        { name: 'con_nombre', components: [{ type: 'BODY', text: 'Hola {{first_name}}' }], mapped: false },
        { name: 'header_imagen', components: [{ type: 'HEADER', format: 'IMAGE' }, body], mapped: false },
        {
          name: 'boton_otp',
          components: [body, { type: 'BUTTONS', buttons: [{ type: 'OTP', text: 'Copiar' }] }],
          mapped: false,
        },
        { name: 'eliminada', components: [body], deleted: true, mapped: false },
      ]
      for (const caso of casos) {
        await insertTemplate(tx, ids, caso.name, caso.components, caso.deleted ?? false)
      }

      await applyStatements(tx, UP_STATEMENTS)

      const rows = await tx.$queryRaw<{ name: string; mapping_status: string; enabled: boolean }[]>`
        SELECT name, mapping_status::text AS mapping_status, enabled FROM "whatsapp_templates"
        WHERE company_id = ${companyId}::uuid`
      const byName = (a: { name: string }, b: { name: string }) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
      const esperado = casos
        .map((caso) => ({
          name: caso.name,
          mapping_status: caso.mapped ? 'MAPPED' : 'UNMAPPED',
          enabled: caso.mapped,
        }))
        .sort(byName)
      expect([...rows].sort(byName)).toEqual(esperado)
      const relaciones = await tx.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS n FROM "whatsapp_template_variables" WHERE company_id = ${companyId}::uuid`
      expect(Number(relaciones[0]?.n)).toBe(0)
    })
  })
})
