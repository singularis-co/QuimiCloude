// La migracion `db/migrations/*_whatsapp_outbound_messages/` contra Postgres REAL.
//
// Aislamiento: cada `it` corre dentro de `prisma.$transaction` interactiva y termina lanzando
// `RollbackSignal`, asi que ninguna fila ni ningun DDL sobrevive. Las escrituras que la base debe
// rechazar van entre `SAVEPOINT` y `ROLLBACK TO SAVEPOINT`. El SQL se lee del archivo.
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
const carpetas = readdirSync(migrationsDir).filter((name) => /_whatsapp_outbound_messages$/.test(name))
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

const FK = 'whatsapp_messages_sent_by_fkey'
const FK_DEF = 'FOREIGN KEY (sent_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT'

async function applyStatements(tx: Prisma.TransactionClient, statements: readonly string[]): Promise<void> {
  for (const statement of statements) {
    await tx.$executeRawUnsafe(statement)
  }
}

/** Columnas, indices y restricciones de `whatsapp_messages`, leidos del catalogo y en orden estable. */
async function schemaSnapshot(tx: Prisma.TransactionClient) {
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

type Fixture = { readonly companyId: string; readonly userId: string; readonly connectionId: string; readonly contactId: string }

/**
 * Empresa, usuario que envia, conexion y contacto propios, dentro de la transaccion del caso. La
 * conexion la crea otro usuario: asi borrar al que envia solo choca con la FK de `sent_by`.
 */
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
  const companyName = `Empresa salientes ${marker}`
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
  const creator = await tx.user.create({
    data: {
      firstNames: 'Luis',
      lastNames: 'Rojas Diaz',
      birthDate: new Date('1985-02-03T00:00:00.000Z'),
      email: `luis.${marker}@quimicloude.test`,
      phone: '+57 300 444 5566',
      documentTypeCode: documentType.code,
      documentNumber: marker.slice(12, 24),
      username: `luis.${marker}`,
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
      createdById: creator.id,
    },
    select: { id: true },
  })
  const contact = await tx.whatsappContact.create({
    data: { companyId: company.id, connectionId: connection.id, waId: '573001234567' },
    select: { id: true },
  })
  return { companyId: company.id, userId: user.id, connectionId: connection.id, contactId: contact.id }
}

function outbound(fixture: Fixture, sentById: string | null) {
  return {
    companyId: fixture.companyId,
    connectionId: fixture.connectionId,
    contactId: fixture.contactId,
    direction: 'OUT' as const,
    type: 'TEMPLATE' as const,
    status: 'SENDING' as const,
    origin: 'USER' as const,
    sentById,
    templateName: 'bienvenida',
    templateLanguage: 'es_CO',
  }
}

/** Corre `write` entre SAVEPOINT y ROLLBACK TO SAVEPOINT y devuelve lo que lanzo, o `null`. */
async function rejectionOf(tx: Prisma.TransactionClient, write: () => Promise<unknown>): Promise<unknown> {
  await tx.$executeRawUnsafe('SAVEPOINT esperado_rechazo')
  try {
    await write()
    return null
  } catch (error) {
    return error
  } finally {
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT esperado_rechazo')
  }
}

function violatesTheSentByFk(error: unknown): boolean {
  return error instanceof Error && error.message.includes(FK)
}

afterAll(async () => {
  await prisma.$disconnect()
})

describe('migracion whatsapp_outbound_messages contra Postgres real', () => {
  it('R47: existe exactamente una carpeta de la migracion, con su down.sql', () => {
    expect(carpetas).toHaveLength(1)
    expect(existsSync(join(migrationDir, 'down.sql'))).toBe(true)
    expect(UP_STATEMENTS).toHaveLength(2)
    expect(DOWN_STATEMENTS).toHaveLength(2)
  })

  it('R44: la columna template_language es texto opcional y sent_by tiene su FK a users con RESTRICT', async () => {
    await inRolledBackTransaction(async (tx) => {
      const snapshot = await schemaSnapshot(tx)
      expect(snapshot.columns.find((c) => c.column_name === 'template_language')).toEqual({
        column_name: 'template_language',
        data_type: 'text',
        udt_name: 'text',
        is_nullable: 'YES',
        column_default: null,
      })
      expect(snapshot.constraints).toContainEqual({ conname: FK, def: FK_DEF })
    })
  })

  it('R44: la base rechaza un saliente cuyo sent_by no es un usuario y acepta uno real o nulo', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await seed(tx)

      const rechazo = await rejectionOf(tx, () =>
        tx.whatsappMessage.create({ data: outbound(fixture, randomUUID()) }),
      )
      expect(violatesTheSentByFk(rechazo), String(rechazo)).toBe(true)

      const guardado = await tx.whatsappMessage.create({
        data: outbound(fixture, fixture.userId),
        select: { sentById: true, templateLanguage: true },
      })
      expect(guardado).toEqual({ sentById: fixture.userId, templateLanguage: 'es_CO' })

      await tx.whatsappMessage.create({
        data: {
          ...outbound(fixture, null),
          direction: 'IN',
          type: 'TEXT',
          status: 'RECEIVED',
          origin: null,
          templateName: null,
          templateLanguage: null,
        },
      })
      expect(await tx.whatsappMessage.count({ where: { companyId: fixture.companyId } })).toBe(2)
    })
  })

  it('R44: borrar el usuario que envio un mensaje falla por la FK', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await seed(tx)
      await tx.whatsappMessage.create({ data: outbound(fixture, fixture.userId) })

      const rechazo = await rejectionOf(tx, () =>
        tx.$executeRawUnsafe(`DELETE FROM "users" WHERE "id" = '${fixture.userId}'::uuid`),
      )
      expect(violatesTheSentByFk(rechazo), String(rechazo)).toBe(true)
    })
  })

  it('R47: el DOWN quita exactamente la columna y la FK, y el resto de la tabla queda igual', async () => {
    await inRolledBackTransaction(async (tx) => {
      const antes = await schemaSnapshot(tx)

      await applyStatements(tx, DOWN_STATEMENTS)

      const despues = await schemaSnapshot(tx)
      expect(despues.columns).toEqual(antes.columns.filter((c) => c.column_name !== 'template_language'))
      expect(despues.constraints).toEqual(antes.constraints.filter((c) => c.conname !== FK))
      expect(despues.indexes).toEqual(antes.indexes)
      expect(despues.rls).toEqual(antes.rls)
    })
  })

  it('R44, R47: tras el DOWN la base vuelve a aceptar un sent_by inexistente', async () => {
    await inRolledBackTransaction(async (tx) => {
      const fixture = await seed(tx)
      await applyStatements(tx, DOWN_STATEMENTS)

      await tx.$executeRawUnsafe(
        `INSERT INTO "whatsapp_messages" ("company_id", "connection_id", "contact_id", "direction", "type", "status", "origin", "sent_by", "updated_at")
         VALUES ($1::uuid, $2::uuid, $3::uuid, 'OUT', 'TEXT', 'SENDING', 'USER', $4::uuid, CURRENT_TIMESTAMP)`,
        fixture.companyId,
        fixture.connectionId,
        fixture.contactId,
        randomUUID(),
      )
      expect(
        await tx.$queryRaw<{ n: number }[]>`
          SELECT count(*)::int AS n FROM "whatsapp_messages" WHERE "company_id" = ${fixture.companyId}::uuid`,
      ).toEqual([{ n: 1 }])
    })
  })

  it('R47: ida, vuelta e ida dejan exactamente el mismo esquema', async () => {
    await inRolledBackTransaction(async (tx) => {
      const antes = await schemaSnapshot(tx)

      await applyStatements(tx, DOWN_STATEMENTS)
      await applyStatements(tx, UP_STATEMENTS)

      expect(await schemaSnapshot(tx)).toEqual(antes)
    })
  })

  it('R47 (sensibilidad): un DOWN sin el DROP COLUMN deja la columna y el snapshot lo detecta', async () => {
    const downSinColumna = DOWN_STATEMENTS.filter((statement) => !/DROP COLUMN/i.test(statement))
    expect(downSinColumna, 'la mutacion no quito ninguna sentencia').toHaveLength(DOWN_STATEMENTS.length - 1)

    await inRolledBackTransaction(async (tx) => {
      const antes = await schemaSnapshot(tx)
      await applyStatements(tx, downSinColumna)
      const despues = await schemaSnapshot(tx)
      expect(despues.columns).toEqual(antes.columns)
      expect(despues.columns.map((c) => c.column_name)).toContain('template_language')
    })
  })
})
