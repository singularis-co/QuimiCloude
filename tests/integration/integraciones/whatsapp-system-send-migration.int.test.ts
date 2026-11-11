// La migracion `db/migrations/*_whatsapp_system_send/` contra Postgres REAL.
//
// Aislamiento: cada `it` corre dentro de `prisma.$transaction` interactiva y termina lanzando
// `RollbackSignal`, asi que ninguna fila ni ningun DDL sobrevive. El SQL se lee del archivo.
import { randomUUID } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Prisma } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'

import { normalizeCompanyName } from '@/lib/modules/identity'
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
const carpetas = readdirSync(migrationsDir).filter((name) => /_whatsapp_system_send$/.test(name))
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

const COLUMN = 'template_components'
const INDEX = 'whatsapp_messages_system_pending_idx'

async function applyStatements(tx: Prisma.TransactionClient, statements: readonly string[]): Promise<void> {
  for (const statement of statements) {
    await tx.$executeRawUnsafe(statement)
  }
}

/** Columnas, indices, restricciones y RLS de `whatsapp_messages`, leidos del catalogo y en orden estable. */
async function schemaSnapshot(tx: Prisma.TransactionClient) {
  const columns = await tx.$queryRaw<
    { column_name: string; data_type: string; udt_name: string; is_nullable: string; column_default: string | null }[]
  >`
    SELECT column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'whatsapp_messages'
    ORDER BY column_name`
  const indexes = await tx.$queryRaw<{ indexname: string; indexdef: string }[]>`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'whatsapp_messages'
    ORDER BY indexname`
  const constraints = await tx.$queryRaw<{ conname: string; def: string }[]>`
    SELECT c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'whatsapp_messages' AND t.relnamespace = 'public'::regnamespace
    ORDER BY c.conname`
  const rls = await tx.$queryRaw<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
    SELECT relrowsecurity, relforcerowsecurity FROM pg_class
    WHERE relname = 'whatsapp_messages' AND relnamespace = 'public'::regnamespace`
  return { columns, indexes, constraints, rls }
}

function token(): string {
  return randomUUID().replace(/-/gu, '')
}

type Fixture = { readonly companyId: string; readonly connectionId: string; readonly contactId: string }

/** Empresa, usuario, conexion y un contacto propios, dentro de la transaccion del caso. */
async function seed(tx: Prisma.TransactionClient): Promise<Fixture> {
  const marker = token()
  const documentType = await tx.documentType.create({
    data: { code: `DOC${marker.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  })
  const role = await tx.role.create({
    data: { name: `rol-${marker}`, description: 'Rol de prueba' },
    select: { id: true },
  })
  const companyName = `Empresa envios del sistema ${marker}`
  const company = await tx.company.create({
    data: { name: companyName, nameNormalized: normalizeCompanyName(companyName) },
    select: { id: true },
  })
  const user = await tx.user.create({
    data: {
      firstNames: 'Ana Maria',
      lastNames: 'Perez Gomez',
      birthDate: new Date('1990-05-17T00:00:00.000Z'),
      email: `ana.${marker}@quimicloude.test`,
      phone: '+57 300 111 2233',
      documentTypeCode: documentType.code,
      documentNumber: marker.slice(0, 12),
      username: `ana.${marker}`,
      passwordHash: 'hash-de-prueba-no-es-un-algoritmo-real',
      roleId: role.id,
      companyId: company.id,
    },
    select: { id: true },
  })
  const connection = await tx.whatsappConnection.create({
    data: {
      id: randomUUID(),
      companyId: company.id,
      displayName: 'Ventas',
      wabaId: `waba-${marker}`,
      phoneNumberId: `phone-${marker}`,
      accessTokenEnc: 'v1:valor-cifrado-de-prueba',
      appSecretEnc: 'v1:otro-valor-cifrado',
      verifyTokenHash: 'a'.repeat(64),
      createdById: user.id,
    },
    select: { id: true },
  })
  const contact = await tx.whatsappContact.create({
    data: { companyId: company.id, connectionId: connection.id, waId: '573001234567' },
    select: { id: true },
  })
  return { companyId: company.id, connectionId: connection.id, contactId: contact.id }
}

afterAll(async () => {
  await prisma.$disconnect()
})

describe('migracion whatsapp_system_send contra Postgres real', () => {
  it('R40: existe exactamente una carpeta de la migracion, con su down.sql y dos sentencias en cada sentido', () => {
    expect(carpetas).toHaveLength(1)
    expect(existsSync(join(migrationDir, 'down.sql'))).toBe(true)
    expect(UP_STATEMENTS).toHaveLength(2)
    expect(DOWN_STATEMENTS).toHaveLength(2)
  })

  it('R40: la columna template_components es jsonb opcional y sin valor por defecto', async () => {
    await inRolledBackTransaction(async (tx) => {
      const snapshot = await schemaSnapshot(tx)
      expect(snapshot.columns.find((c) => c.column_name === COLUMN)).toEqual({
        column_name: COLUMN,
        data_type: 'jsonb',
        udt_name: 'jsonb',
        is_nullable: 'YES',
        column_default: null,
      })
    })
  })

  it('R40: el indice parcial existe sobre empresa, estado y ultimo cambio, solo para mensajes del sistema QUEUED o SENDING', async () => {
    await inRolledBackTransaction(async (tx) => {
      const snapshot = await schemaSnapshot(tx)
      const def = snapshot.indexes.find((i) => i.indexname === INDEX)?.indexdef ?? ''
      expect(def).toMatch(/^CREATE INDEX whatsapp_messages_system_pending_idx ON public\.whatsapp_messages USING btree \(company_id, status, updated_at\) WHERE /)
      expect(def).toMatch(/origin = 'SYSTEM'::whatsapp_message_origin/)
      expect(def).toMatch(/'QUEUED'::whatsapp_message_status/)
      expect(def).toMatch(/'SENDING'::whatsapp_message_status/)
      expect(def).not.toMatch(/'SENT'|'FAILED'|'USER'|'AGENT'/)
    })
  })

  it('R40: un mensaje del sistema guarda los parametros de Meta y un mensaje sin ellos nace con la columna nula', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await seed(tx)
      const components = [{ type: 'body', parameters: [{ type: 'text', text: 'Ana' }] }]
      const base = {
        companyId: fixture.companyId,
        connectionId: fixture.connectionId,
        contactId: fixture.contactId,
        direction: 'OUT' as const,
        type: 'TEMPLATE' as const,
        status: 'QUEUED' as const,
        origin: 'SYSTEM' as const,
        templateName: 'pedido_entregado',
        templateLanguage: 'es_CO',
      }
      const conComponentes = await tx.whatsappMessage.create({
        data: { ...base, templateComponents: components },
        select: { templateComponents: true },
      })
      const sinComponentes = await tx.whatsappMessage.create({ data: base, select: { templateComponents: true } })

      expect(conComponentes.templateComponents).toEqual(components)
      expect(sinComponentes.templateComponents).toBeNull()
    })
  })

  it('R40: el DOWN quita exactamente la columna y el indice, y el resto de la tabla queda igual', async () => {
    await inRolledBackTransaction(async (tx) => {
      const antes = await schemaSnapshot(tx)

      await applyStatements(tx, DOWN_STATEMENTS)

      const despues = await schemaSnapshot(tx)
      expect(despues.columns).toEqual(antes.columns.filter((c) => c.column_name !== COLUMN))
      expect(despues.indexes).toEqual(antes.indexes.filter((i) => i.indexname !== INDEX))
      expect(despues.constraints).toEqual(antes.constraints)
      expect(despues.rls).toEqual(antes.rls)
    })
  })

  it('R40: ida, vuelta e ida dejan exactamente el mismo esquema', async () => {
    await inRolledBackTransaction(async (tx) => {
      const antes = await schemaSnapshot(tx)

      await applyStatements(tx, DOWN_STATEMENTS)
      await applyStatements(tx, UP_STATEMENTS)

      expect(await schemaSnapshot(tx)).toEqual(antes)
    })
  })

  it('R40 (sensibilidad): un DOWN sin el DROP INDEX deja el indice y el snapshot lo detecta', async () => {
    const downSinIndice = DOWN_STATEMENTS.filter((statement) => !/DROP INDEX/i.test(statement))
    expect(downSinIndice, 'la mutacion no quito ninguna sentencia').toHaveLength(DOWN_STATEMENTS.length - 1)

    await inRolledBackTransaction(async (tx) => {
      const antes = await schemaSnapshot(tx)
      await applyStatements(tx, downSinIndice)
      const despues = await schemaSnapshot(tx)
      expect(despues.indexes.map((i) => i.indexname)).toContain(INDEX)
      expect(despues.indexes).not.toEqual(antes.indexes.filter((i) => i.indexname !== INDEX))
    })
  })
})
