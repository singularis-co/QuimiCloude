/**
 * Las restricciones de `notifications` y `notification_reads` contra Postgres real.
 *
 * AISLAMIENTO — `transaccion`: cada caso corre dentro de `prisma.$transaction` interactiva y
 * termina lanzando `RollbackSignal`. Un rechazo de la base aborta la transaccion entera, asi que
 * cada intento que se espera que falle va dentro de su propio SAVEPOINT.
 *
 * Las escrituras van en SQL crudo: la API tipada traduce el SQLSTATE a su propio codigo y aqui
 * se afirma sobre el real.
 */
import { randomUUID } from 'node:crypto'

import { Prisma } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { normalizeCompanyName } from '@/lib/modules/identity'
import { NO_CREDENTIAL_SENTINEL } from '@/lib/modules/identity/domain/credential-setup-link'
import { DOCUMENT_TYPE_CC } from '@/lib/modules/identity/domain/document-type'
import { ROLE_OPERADOR } from '@/lib/modules/identity/domain/roles'
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
      { maxWait: 10_000, timeout: 30_000 },
    )
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error
  }
}

const CHECK_VIOLATION = '23514'
const FOREIGN_KEY_VIOLATION = '23503'
const UNIQUE_VIOLATION = '23505'

function sqlStateOf(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta: unknown = error.meta
    if (typeof meta === 'object' && meta !== null && 'code' in meta) {
      const code: unknown = (meta as { code: unknown }).code
      if (typeof code === 'string') return code
    }
    return error.code
  }
  return error instanceof Error ? error.message : String(error)
}

let savepointSeq = 0

async function rejectedByDatabase(tx: Tx, run: () => Promise<unknown>, what: string): Promise<string> {
  savepointSeq += 1
  const savepoint = `sp_notifications_${String(savepointSeq)}`
  await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`)
  try {
    await run()
  } catch (error) {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`)
    return sqlStateOf(error)
  }
  await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`)
  throw new Error(`se esperaba que la base rechazara la operacion, pero la acepto: ${what}`)
}

function tag(): string {
  return randomUUID().replaceAll('-', '')
}

async function createCompany(tx: Tx): Promise<string> {
  const name = `Avisos ${tag()}`
  const company = await tx.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name) },
    select: { id: true },
  })
  return company.id
}

async function createUser(tx: Tx, companyId: string): Promise<string> {
  const marca = tag()
  const role = await tx.role.findUniqueOrThrow({ where: { name: ROLE_OPERADOR }, select: { id: true } })
  const user = await tx.user.create({
    data: {
      firstNames: 'Ana',
      lastNames: 'Prueba',
      birthDate: new Date('1990-01-01T00:00:00.000Z'),
      email: `qc137.${marca}@example.test`,
      phone: '000000000',
      documentTypeCode: DOCUMENT_TYPE_CC,
      documentNumber: marca.slice(0, 20),
      username: `qc137.${marca}`,
      passwordHash: NO_CREDENTIAL_SENTINEL,
      roleId: role.id,
      companyId,
      accountStatus: 'active',
    },
    select: { id: true },
  })
  return user.id
}

type NotificationColumns = {
  readonly companyId: string
  readonly dedupeKey?: string
  readonly recipientUserId?: string | null
  readonly recipientRole?: string | null
  readonly body?: string
  readonly bodyTime?: Date | null
}

async function insertNotification(tx: Tx, columns: NotificationColumns): Promise<string> {
  const id = randomUUID()
  await tx.$executeRaw`
    INSERT INTO "notifications"
      ("id", "company_id", "event_key", "tone", "title", "body", "body_time", "link_label",
       "recipient_user_id", "recipient_role", "dedupe_key")
    VALUES (
      CAST(${id} AS uuid), CAST(${columns.companyId} AS uuid), 'documentos.tanda_procesada', 'success',
      'Tanda de PDFs procesada', ${columns.body ?? 'Se leyó el archivo de la tanda.'},
      ${columns.bodyTime ?? null}::timestamptz, 'Ver fórmulas',
      CAST(${columns.recipientUserId ?? null} AS uuid), ${columns.recipientRole ?? null},
      ${columns.dedupeKey ?? tag()}
    )`
  return id
}

function insertRead(tx: Tx, notificationId: string, userId: string, companyId: string): Promise<number> {
  return tx.$executeRaw`
    INSERT INTO "notification_reads" ("notification_id", "user_id", "company_id")
    VALUES (CAST(${notificationId} AS uuid), CAST(${userId} AS uuid), CAST(${companyId} AS uuid))`
}

function readsOf(tx: Tx, notificationId: string) {
  return tx.notificationRead.findMany({ where: { notificationId }, select: { userId: true } })
}

beforeAll(async () => {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename IN ('notifications', 'notification_reads')`
  if (tables.length !== 2) {
    throw new Error('la base de pruebas no tiene las tablas de avisos. Corre `pnpm run db:migrate`.')
  }
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('notifications: destinatario', () => {
  it('QC-137 R12: rechaza un aviso sin destinatario y uno dirigido a un rol y a un usuario a la vez', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await createCompany(tx)
      const userId = await createUser(tx, companyId)

      expect(
        await rejectedByDatabase(tx, () => insertNotification(tx, { companyId }), 'sin destinatario'),
      ).toBe(CHECK_VIOLATION)
      expect(
        await rejectedByDatabase(
          tx,
          () => insertNotification(tx, { companyId, recipientUserId: userId, recipientRole: ROLE_OPERADOR }),
          'con los dos destinatarios',
        ),
      ).toBe(CHECK_VIOLATION)
      expect(await tx.notification.count({ where: { companyId } })).toBe(0)
    })
  })

  it('QC-137 R12: admite un aviso dirigido solo a un rol y otro solo a un usuario', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await createCompany(tx)
      const userId = await createUser(tx, companyId)

      await insertNotification(tx, { companyId, recipientRole: ROLE_OPERADOR })
      await insertNotification(tx, { companyId, recipientUserId: userId })

      expect(await tx.notification.count({ where: { companyId } })).toBe(2)
    })
  })

  it('QC-137 R12: un rol que no existe lo rechaza la FK a roles(name)', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await createCompany(tx)

      expect(
        await rejectedByDatabase(
          tx,
          () => insertNotification(tx, { companyId, recipientRole: `Inexistente ${tag()}` }),
          'rol inexistente',
        ),
      ).toBe(FOREIGN_KEY_VIOLATION)
    })
  })
})

describe('notifications: idempotencia', () => {
  it('QC-137 R3: rechaza un dedupe_key repetido en la misma empresa y lo admite en otra', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyA = await createCompany(tx)
      const companyB = await createCompany(tx)
      const dedupeKey = `tanda:${tag()}`

      await insertNotification(tx, { companyId: companyA, recipientRole: ROLE_OPERADOR, dedupeKey })

      expect(
        await rejectedByDatabase(
          tx,
          () => insertNotification(tx, { companyId: companyA, recipientRole: ROLE_OPERADOR, dedupeKey }),
          'clave repetida en la misma empresa',
        ),
      ).toBe(UNIQUE_VIOLATION)

      await insertNotification(tx, { companyId: companyB, recipientRole: ROLE_OPERADOR, dedupeKey })

      expect(await tx.notification.count({ where: { dedupeKey } })).toBe(2)
      expect(await tx.notification.count({ where: { companyId: companyA, dedupeKey } })).toBe(1)
    })
  })
})

describe('notification_reads: empresa', () => {
  it('QC-137 R14: rechaza una lectura con una empresa distinta a la del aviso', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyA = await createCompany(tx)
      const companyB = await createCompany(tx)
      const userA = await createUser(tx, companyA)
      const notificationId = await insertNotification(tx, { companyId: companyA, recipientRole: ROLE_OPERADOR })

      expect(
        await rejectedByDatabase(
          tx,
          () => insertRead(tx, notificationId, userA, companyB),
          'lectura con otra empresa',
        ),
      ).toBe(FOREIGN_KEY_VIOLATION)
      expect(await readsOf(tx, notificationId)).toEqual([])

      await insertRead(tx, notificationId, userA, companyA)
      expect(await readsOf(tx, notificationId)).toEqual([{ userId: userA }])
    })
  })

  it('QC-137 R14: una segunda lectura del mismo usuario sobre el mismo aviso la rechaza la PK', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await createCompany(tx)
      const userId = await createUser(tx, companyId)
      const notificationId = await insertNotification(tx, { companyId, recipientRole: ROLE_OPERADOR })
      await insertRead(tx, notificationId, userId, companyId)

      expect(
        await rejectedByDatabase(tx, () => insertRead(tx, notificationId, userId, companyId), 'lectura repetida'),
      ).toBe(UNIQUE_VIOLATION)
    })
  })
})

describe('notifications: la marca {hora}', () => {
  const SUBIDA = new Date('2026-10-19T14:05:00.000Z')

  it('QC-137 R47: rechaza un body con {hora} sin body_time y un body_time sin {hora} en el body', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await createCompany(tx)

      expect(
        await rejectedByDatabase(
          tx,
          () =>
            insertNotification(tx, {
              companyId,
              recipientRole: ROLE_OPERADOR,
              body: 'Se leyó el archivo de la tanda que subiste a las {hora}.',
              bodyTime: null,
            }),
          '{hora} sin body_time',
        ),
      ).toBe(CHECK_VIOLATION)
      expect(
        await rejectedByDatabase(
          tx,
          () =>
            insertNotification(tx, {
              companyId,
              recipientRole: ROLE_OPERADOR,
              body: 'Se leyeron 2 de 3 archivos.',
              bodyTime: SUBIDA,
            }),
          'body_time sin {hora}',
        ),
      ).toBe(CHECK_VIOLATION)
      expect(await tx.notification.count({ where: { companyId } })).toBe(0)
    })
  })

  it('QC-137 R47: admite {hora} con body_time y un texto sin marca ni instante', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await createCompany(tx)

      const conHora = await insertNotification(tx, {
        companyId,
        recipientRole: ROLE_OPERADOR,
        body: 'Se leyeron los 3 archivos de la tanda que subiste a las {hora}.',
        bodyTime: SUBIDA,
      })
      await insertNotification(tx, { companyId, recipientRole: ROLE_OPERADOR, body: 'Se leyeron 2 de 3 archivos.' })

      expect(await tx.notification.count({ where: { companyId } })).toBe(2)
      const fila = await tx.notification.findUniqueOrThrow({ where: { id: conHora }, select: { bodyTime: true } })
      expect(fila.bodyTime).toEqual(SUBIDA)
    })
  })
})

describe('borrado en cascada', () => {
  it('QC-137 R17: borrar un aviso borra sus lecturas, y no las de otro aviso', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await createCompany(tx)
      const userA = await createUser(tx, companyId)
      const userB = await createUser(tx, companyId)
      const borrado = await insertNotification(tx, { companyId, recipientRole: ROLE_OPERADOR })
      const otro = await insertNotification(tx, { companyId, recipientRole: ROLE_OPERADOR })
      await insertRead(tx, borrado, userA, companyId)
      await insertRead(tx, borrado, userB, companyId)
      await insertRead(tx, otro, userA, companyId)

      await tx.$executeRaw`DELETE FROM "notifications" WHERE "id" = CAST(${borrado} AS uuid)`

      expect(await readsOf(tx, borrado)).toEqual([])
      expect(await readsOf(tx, otro)).toEqual([{ userId: userA }])
    })
  })
})

describe('RLS', () => {
  it('QC-137: las dos tablas tienen RLS activada y forzada', async () => {
    const filas = await prisma.$queryRaw<{ relname: string; enabled: boolean; forced: boolean }[]>`
      SELECT relname, relrowsecurity AS enabled, relforcerowsecurity AS forced
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relname IN ('notifications', 'notification_reads')
      ORDER BY relname`
    expect(filas).toEqual([
      { relname: 'notification_reads', enabled: true, forced: true },
      { relname: 'notifications', enabled: true, forced: true },
    ])
  })
})
