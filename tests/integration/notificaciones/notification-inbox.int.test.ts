/**
 * `createNotificationInboxPrisma` contra Postgres real.
 *
 * AISLAMIENTO — `transaccion`: cada caso corre en una `prisma.$transaction` interactiva que termina
 * lanzando `RollbackSignal`, y el adaptador se construye sobre esa `tx`.
 *
 * Los avisos se siembran con SQL crudo y un `created_at` explícito: dentro de una transacción
 * `now()` es constante, y el orden y el corte por cursor necesitan instantes distintos (o iguales a
 * propósito).
 */
import { randomUUID } from 'node:crypto'

import { Prisma } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'

import { normalizeCompanyName } from '@/lib/modules/identity'
import { NO_CREDENTIAL_SENTINEL } from '@/lib/modules/identity/domain/credential-setup-link'
import { DOCUMENT_TYPE_CC } from '@/lib/modules/identity/domain/document-type'
import { ROLE_ADMINISTRADOR, ROLE_OPERADOR } from '@/lib/modules/identity/domain/roles'
import {
  createNotificationInboxPrisma,
  NOTIFICATION_BATCH_SIZE,
} from '@/lib/modules/notificaciones/adapters/driven/persistence/notification-inbox-prisma'
import type {
  InboxCursor,
  InboxItem,
  InboxScope,
  NotificationInbox,
} from '@/lib/modules/notificaciones/ports/notification-inbox'
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

function tag(): string {
  return randomUUID().replaceAll('-', '')
}

const DAY_MS = 86_400_000

async function createCompany(tx: Tx): Promise<string> {
  const name = `Bandeja ${tag()}`
  const company = await tx.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name) },
    select: { id: true },
  })
  return company.id
}

async function createUser(tx: Tx, companyId: string, roleName: string): Promise<string> {
  const marca = tag()
  const role = await tx.role.findUniqueOrThrow({ where: { name: roleName }, select: { id: true } })
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

/** Fija para todo el archivo: el mismo `instant(...)` da siempre el mismo texto. */
const BASE_MS = Date.now()

/** Un instante en texto con microsegundos: `msAgo` milisegundos antes de `BASE_MS` y `micros` (0-999) dentro del ms. */
function instant(msAgo: number, micros = 0): string {
  const iso = new Date(BASE_MS - msAgo).toISOString()
  return `${iso.slice(0, -1)}${String(micros).padStart(3, '0')}Z`
}

type Seed = {
  readonly companyId: string
  readonly createdAt: string
  readonly userId?: string
  readonly role?: string
}

async function seed(tx: Tx, row: Seed): Promise<string> {
  const id = randomUUID()
  await tx.$executeRaw`
    INSERT INTO notifications
      (id, company_id, event_key, tone, title, body, link_label, target_kind,
       recipient_user_id, recipient_role, dedupe_key, created_at)
    VALUES (
      ${id}::uuid, ${row.companyId}::uuid, 'pruebas.aviso', 'success', 'Aviso', 'Cuerpo', 'Ver',
      'formulas', ${row.userId ?? null}::uuid, ${row.role ?? null}, ${tag()},
      ${row.createdAt}::timestamptz
    )`
  return id
}

function scopeFor(companyId: string, userId: string, roleName: string | null): InboxScope {
  return { companyId, userId, roleName, cutoff: new Date(Date.now() - 90 * DAY_MS) }
}

/** Todos los lotes, siguiendo el cursor, con un tope para que un bucle no cuelgue la corrida. */
async function allBatches(inbox: NotificationInbox, scope: InboxScope): Promise<InboxItem[][]> {
  const batches: InboxItem[][] = []
  let after: InboxCursor | null = null
  for (let guard = 0; guard < 20; guard += 1) {
    const batch = await inbox.listBatch(scope, after)
    batches.push([...batch.items])
    if (batch.next === null) return batches
    after = batch.next
  }
  throw new Error('demasiados lotes')
}

async function readsOf(tx: Tx, notificationId: string): Promise<number> {
  return tx.notificationRead.count({ where: { notificationId } })
}

afterAll(async () => {
  await prisma.$disconnect()
})

describe('bandeja de avisos sobre Postgres', () => {
  it('QC-137 R13: avisos de otra empresa, de otro rol y de otro usuario no salen en el resumen, en ningún lote ni en el conteo, tampoco con un cursor fabricado', async () => {
    await inRolledBackTransaction(async (tx) => {
      const inbox = createNotificationInboxPrisma(tx)
      const companyA = await createCompany(tx)
      const companyB = await createCompany(tx)
      const ana = await createUser(tx, companyA, ROLE_OPERADOR)
      const otherUser = await createUser(tx, companyA, ROLE_OPERADOR)
      const userB = await createUser(tx, companyB, ROLE_OPERADOR)

      const mine = await seed(tx, { companyId: companyA, userId: ana, createdAt: instant(60_000) })
      const myRole = await seed(tx, { companyId: companyA, role: ROLE_OPERADOR, createdAt: instant(120_000) })
      // Más recientes que los propios: si se colaran, serían el `newest`.
      const otherCompany = await seed(tx, { companyId: companyB, userId: userB, createdAt: instant(1_000) })
      const otherCompanyRole = await seed(tx, { companyId: companyB, role: ROLE_OPERADOR, createdAt: instant(2_000) })
      const otherRole = await seed(tx, { companyId: companyA, role: ROLE_ADMINISTRADOR, createdAt: instant(3_000) })
      const otherPerson = await seed(tx, { companyId: companyA, userId: otherUser, createdAt: instant(4_000) })
      const foreign = [otherCompany, otherCompanyRole, otherRole, otherPerson]

      const scope = scopeFor(companyA, ana, ROLE_OPERADOR)
      const summary = await inbox.summary(scope)
      expect(summary.unreadCount).toBe(2)
      expect(summary.newest?.id).toBe(mine)

      const ids = (await allBatches(inbox, scope)).flat().map((item) => item.id)
      expect(ids).toEqual([mine, myRole])

      // Un cursor con el id y el instante de un aviso ajeno solo fija el corte.
      const forged: InboxCursor = { t: instant(0, 999), i: otherCompany }
      const afterForged = await inbox.listBatch(scope, forged)
      expect(afterForged.items.map((item) => item.id)).toEqual([mine, myRole])
      for (const id of foreign) {
        expect(afterForged.items.map((item) => item.id)).not.toContain(id)
      }

      // Sin rol solo ve lo suyo.
      const withoutRole = await inbox.summary(scopeFor(companyA, ana, null))
      expect(withoutRole.unreadCount).toBe(1)
    })
  })

  it('QC-137 R14: marcar un aviso que no le corresponde responde como inexistente y no escribe lectura', async () => {
    await inRolledBackTransaction(async (tx) => {
      const inbox = createNotificationInboxPrisma(tx)
      const companyA = await createCompany(tx)
      const companyB = await createCompany(tx)
      const ana = await createUser(tx, companyA, ROLE_OPERADOR)
      const userB = await createUser(tx, companyB, ROLE_OPERADOR)
      const foreign = await seed(tx, { companyId: companyB, userId: userB, createdAt: instant(1_000) })
      const otherRole = await seed(tx, { companyId: companyA, role: ROLE_ADMINISTRADOR, createdAt: instant(1_000) })
      const scope = scopeFor(companyA, ana, ROLE_OPERADOR)

      expect(await inbox.markRead(scope, foreign)).toBe(false)
      expect(await inbox.markRead(scope, otherRole)).toBe(false)
      expect(await inbox.markRead(scope, randomUUID())).toBe(false)
      expect(await readsOf(tx, foreign)).toBe(0)
      expect(await readsOf(tx, otherRole)).toBe(0)
    })
  })

  it('QC-137 R16: marcar uno dirigido a un rol lo deja leído solo para quien lo marca', async () => {
    await inRolledBackTransaction(async (tx) => {
      const inbox = createNotificationInboxPrisma(tx)
      const companyId = await createCompany(tx)
      const ana = await createUser(tx, companyId, ROLE_OPERADOR)
      const luis = await createUser(tx, companyId, ROLE_OPERADOR)
      const roleNotice = await seed(tx, { companyId, role: ROLE_OPERADOR, createdAt: instant(1_000) })
      const anaScope = scopeFor(companyId, ana, ROLE_OPERADOR)
      const luisScope = scopeFor(companyId, luis, ROLE_OPERADOR)

      expect(await inbox.markRead(anaScope, roleNotice)).toBe(true)
      // Marcar dos veces no duplica y sigue respondiendo que existe.
      expect(await inbox.markRead(anaScope, roleNotice)).toBe(true)

      expect((await inbox.summary(anaScope)).unreadCount).toBe(0)
      expect((await inbox.summary(luisScope)).unreadCount).toBe(1)
      expect((await inbox.listBatch(anaScope, null)).items[0]?.read).toBe(true)
      expect((await inbox.listBatch(luisScope, null)).items[0]?.read).toBe(false)
      expect(await readsOf(tx, roleNotice)).toBe(1)
    })
  })

  it('QC-137 R17: uno de 91 días no sale, y el borrado se lo lleva con sus lecturas sin tocar otra empresa', async () => {
    await inRolledBackTransaction(async (tx) => {
      const inbox = createNotificationInboxPrisma(tx)
      const companyA = await createCompany(tx)
      const companyB = await createCompany(tx)
      const ana = await createUser(tx, companyA, ROLE_OPERADOR)
      const userB = await createUser(tx, companyB, ROLE_OPERADOR)
      const old = await seed(tx, { companyId: companyA, userId: ana, createdAt: instant(91 * DAY_MS) })
      const recent = await seed(tx, { companyId: companyA, userId: ana, createdAt: instant(89 * DAY_MS) })
      const oldB = await seed(tx, { companyId: companyB, userId: userB, createdAt: instant(91 * DAY_MS) })
      await tx.$executeRaw`
        INSERT INTO notification_reads (notification_id, user_id, company_id)
        VALUES (${old}::uuid, ${ana}::uuid, ${companyA}::uuid)`
      const scope = scopeFor(companyA, ana, ROLE_OPERADOR)

      expect((await inbox.summary(scope)).unreadCount).toBe(1)
      expect((await inbox.listBatch(scope, null)).items.map((item) => item.id)).toEqual([recent])
      expect(await inbox.markRead(scope, old)).toBe(false)

      expect(await inbox.deleteExpired(companyA, scope.cutoff)).toBe(1)

      expect(await tx.notification.count({ where: { id: old } })).toBe(0)
      expect(await readsOf(tx, old)).toBe(0)
      expect(await tx.notification.count({ where: { id: recent } })).toBe(1)
      expect(await tx.notification.count({ where: { id: oldB } })).toBe(1)
    })
  })

  it('QC-137 R23, R25, R27: con 23 avisos salen tres lotes de 10, 10 y 3, del más reciente al más antiguo, y el último sin cursor', async () => {
    await inRolledBackTransaction(async (tx) => {
      const inbox = createNotificationInboxPrisma(tx)
      const companyId = await createCompany(tx)
      const ana = await createUser(tx, companyId, ROLE_OPERADOR)
      const newestFirst: string[] = []
      for (let k = 0; k < 23; k += 1) {
        newestFirst.push(await seed(tx, { companyId, userId: ana, createdAt: instant((k + 1) * 60_000) }))
      }
      const scope = scopeFor(companyId, ana, ROLE_OPERADOR)

      const first = await inbox.listBatch(scope, null)
      expect(NOTIFICATION_BATCH_SIZE).toBe(10)
      expect(first.next).not.toBeNull()
      expect(first.next?.t).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/)
      expect(first.next?.i).toBe(newestFirst[9])

      const batches = await allBatches(inbox, scope)
      expect(batches.map((batch) => batch.length)).toEqual([10, 10, 3])
      expect(batches.flat().map((item) => item.id)).toEqual(newestFirst)
      const third = await inbox.listBatch(scope, { t: instant(20 * 60_000), i: newestFirst[19]! })
      expect(third.items).toHaveLength(3)
      expect(third.next).toBeNull()
    })
  })

  it('QC-137 R28: avisos del mismo milisegundo o del mismo instante salen una vez cada uno a través del corte, y uno nuevo entre lotes no repite ni salta', async () => {
    await inRolledBackTransaction(async (tx) => {
      const inbox = createNotificationInboxPrisma(tx)
      const companyId = await createCompany(tx)
      const ana = await createUser(tx, companyId, ROLE_OPERADOR)
      const add = (createdAt: string) => seed(tx, { companyId, userId: ana, createdAt })
      // Nueve por delante: el corte cae justo entre el décimo y el undécimo.
      for (let k = 0; k < 9; k += 1) await add(instant(60_000 + k * 1_000))
      const sameMsLate = await add(instant(200_000, 700))
      const sameMsEarly = await add(instant(200_000, 300))
      const sameInstantA = await add(instant(300_000, 500))
      const sameInstantB = await add(instant(300_000, 500))
      for (let k = 0; k < 8; k += 1) await add(instant(400_000 + k * 1_000))
      const scope = scopeFor(companyId, ana, ROLE_OPERADOR)

      const first = await inbox.listBatch(scope, null)
      expect(first.items.at(-1)?.id).toBe(sameMsLate)
      // El cursor conserva el microsegundo: con milisegundos, `sameMsEarly` se saltaría.
      expect(first.next).toEqual({ t: instant(200_000, 700), i: sameMsLate })

      // Entra uno nuevo arriba entre el primer y el segundo lote.
      await add(instant(0))

      const second = await inbox.listBatch(scope, first.next)
      expect(second.items[0]?.id).toBe(sameMsEarly)
      const pair = [sameInstantA, sameInstantB].sort().reverse()
      expect(second.items.slice(1, 3).map((item) => item.id)).toEqual(pair)

      const seen = [...first.items, ...second.items]
      let after = second.next
      while (after !== null) {
        const batch = await inbox.listBatch(scope, after)
        seen.push(...batch.items)
        after = batch.next
      }
      const ids = seen.map((item) => item.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids).toHaveLength(21)
    })
  })

  it('QC-137 R28: con dos avisos del mismo created_at justo en el corte, el segundo sale en el lote siguiente', async () => {
    await inRolledBackTransaction(async (tx) => {
      const inbox = createNotificationInboxPrisma(tx)
      const companyId = await createCompany(tx)
      const ana = await createUser(tx, companyId, ROLE_OPERADOR)
      for (let k = 0; k < 9; k += 1) {
        await seed(tx, { companyId, userId: ana, createdAt: instant(60_000 + k * 1_000) })
      }
      const tieA = await seed(tx, { companyId, userId: ana, createdAt: instant(200_000, 250) })
      const tieB = await seed(tx, { companyId, userId: ana, createdAt: instant(200_000, 250) })
      const [higher, lower] = [tieA, tieB].sort().reverse()
      const scope = scopeFor(companyId, ana, ROLE_OPERADOR)

      const first = await inbox.listBatch(scope, null)
      expect(first.items.at(-1)?.id).toBe(higher)
      const second = await inbox.listBatch(scope, first.next)
      expect(second.items.map((item) => item.id)).toEqual([lower])
      expect(second.next).toBeNull()
    })
  })

  it('QC-137 R32: marcar todas toca los visibles no leídos, también los que no están en el primer lote, y nada ajeno', async () => {
    await inRolledBackTransaction(async (tx) => {
      const inbox = createNotificationInboxPrisma(tx)
      const companyId = await createCompany(tx)
      const ana = await createUser(tx, companyId, ROLE_OPERADOR)
      const luis = await createUser(tx, companyId, ROLE_OPERADOR)
      const own: string[] = []
      for (let k = 0; k < 14; k += 1) {
        own.push(await seed(tx, { companyId, userId: ana, createdAt: instant((k + 1) * 60_000) }))
      }
      const roleNotice = await seed(tx, { companyId, role: ROLE_OPERADOR, createdAt: instant(30 * 60_000) })
      const luisOwn = await seed(tx, { companyId, userId: luis, createdAt: instant(1_000) })
      const anaScope = scopeFor(companyId, ana, ROLE_OPERADOR)
      expect(await inbox.markRead(anaScope, own[0]!)).toBe(true)

      expect(await inbox.markAllRead(anaScope)).toBe(14)

      expect((await inbox.summary(anaScope)).unreadCount).toBe(0)
      expect(await readsOf(tx, own[13]!)).toBe(1)
      const luisScope = scopeFor(companyId, luis, ROLE_OPERADOR)
      expect((await inbox.summary(luisScope)).unreadCount).toBe(2)
      expect(await readsOf(tx, luisOwn)).toBe(0)
      expect(await tx.notificationRead.count({ where: { notificationId: roleNotice, userId: luis } })).toBe(0)
      expect(await inbox.markAllRead(anaScope)).toBe(0)
    })
  })

  it('QC-137 R3: insertIfAbsent devuelve el aviso guardado y null con la misma clave en la misma empresa', async () => {
    await inRolledBackTransaction(async (tx) => {
      const inbox = createNotificationInboxPrisma(tx)
      const companyId = await createCompany(tx)
      const ana = await createUser(tx, companyId, ROLE_OPERADOR)
      const notification = {
        companyId,
        eventKey: 'pruebas.aviso',
        tone: 'warning' as const,
        title: 'Tanda procesada con errores',
        body: 'Subida a las {hora}.',
        bodyTime: new Date('2026-10-19T09:12:00.000Z'),
        linkLabel: 'Ver proveedores',
        target: { kind: 'suppliers' as const },
        recipient: { kind: 'user' as const, userId: ana },
        dedupeKey: `pruebas.aviso:${tag()}`,
      }

      const stored = await inbox.insertIfAbsent(notification)
      expect(stored).toMatchObject({ ...notification, id: expect.any(String) })
      expect(stored?.createdAt).toBeInstanceOf(Date)
      expect(await inbox.insertIfAbsent({ ...notification, title: 'otro' })).toBeNull()

      const [item] = (await inbox.listBatch(scopeFor(companyId, ana, null), null)).items
      expect(item).toMatchObject({
        id: stored?.id,
        tone: 'warning',
        body: 'Subida a las {hora}.',
        bodyTime: notification.bodyTime,
        target: { kind: 'suppliers' },
        read: false,
      })
    })
  })
})
