/**
 * `createWhatsappConversationRepository` contra una base Postgres REAL, construido sobre la `tx` del
 * test: cada `it` corre en una transaccion interactiva que termina en `ROLLBACK`.
 *
 * Las horas con microsegundos se escriben como texto con `::timestamptz`: un `Date` de JS solo
 * llega a milisegundos y no podria fabricar el caso.
 */
import { randomUUID } from 'node:crypto'

import { Prisma } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'

import { createWhatsappConversationRepository } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-conversation-prisma'
import { normalizeCompanyName } from '@/lib/modules/identity'
import { prisma } from '@/lib/shared/db/prisma'

import type { IntegracionesScope } from '@/lib/modules/integraciones/domain/integraciones-scope'
import type { ConversationPageQuery } from '@/lib/modules/integraciones/ports/whatsapp-conversation-repository'

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

afterAll(async () => {
  await prisma.$disconnect()
})

function token(): string {
  return randomUUID().replace(/-/gu, '')
}

function waId(): string {
  return `5939${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`
}

type Empresa = {
  readonly companyId: string
  readonly userId: string
  readonly scope: IntegracionesScope
  readonly connectionId: string
  readonly otherConnectionId: string
}

async function crearConexion(
  tx: Prisma.TransactionClient,
  companyId: string,
  userId: string,
  deletedAt: Date | null,
): Promise<string> {
  const id = randomUUID()
  await tx.whatsappConnection.create({
    data: {
      id,
      companyId,
      displayName: 'Ventas',
      wabaId: `waba-${token()}`,
      phoneNumberId: `phone-${token()}`,
      accessTokenEnc: 'v1:valor-cifrado-de-prueba',
      appSecretEnc: 'v1:otro-valor-cifrado',
      verifyTokenHash: 'a'.repeat(64),
      status: 'ACTIVE',
      createdById: userId,
      deletedAt,
    },
  })
  return id
}

async function crearEmpresa(tx: Prisma.TransactionClient): Promise<Empresa> {
  const marca = token()
  const name = `Empresa conversaciones ${marca}`
  const company = await tx.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name) },
    select: { id: true },
  })
  const documentType = await tx.documentType.create({
    data: { code: `DOC${marca.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  })
  const role = await tx.role.create({
    data: { name: `rol-${marca}`, description: 'Rol de prueba' },
    select: { id: true },
  })
  const user = await tx.user.create({
    data: {
      firstNames: 'Ana',
      lastNames: 'Perez',
      birthDate: new Date('1990-05-17T00:00:00.000Z'),
      email: `ana.${marca}@quimicloude.test`,
      phone: '+57 300 111 2233',
      documentTypeCode: documentType.code,
      documentNumber: marca.slice(0, 12),
      username: `ana.${marca}`,
      passwordHash: 'hash-de-prueba-no-es-un-algoritmo-real',
      roleId: role.id,
      companyId: company.id,
    },
    select: { id: true },
  })
  return {
    companyId: company.id,
    userId: user.id,
    scope: { companyId: company.id },
    connectionId: await crearConexion(tx, company.id, user.id, null),
    otherConnectionId: await crearConexion(tx, company.id, user.id, new Date('2026-09-01T00:00:00Z')),
  }
}

async function crearCliente(tx: Prisma.TransactionClient, empresa: Empresa): Promise<string> {
  const customer = await tx.customer.create({
    data: {
      firstNames: 'Luis',
      lastNames: 'Rojas',
      city: 'Quito',
      firstNamesNormalized: 'luis',
      lastNamesNormalized: 'rojas',
      cityNormalized: 'quito',
      companyId: empresa.companyId,
    },
    select: { id: true },
  })
  return customer.id
}

type ContactoNuevo = {
  readonly id?: string
  readonly connectionId?: string
  readonly customerId?: string | null
  readonly waId?: string
  readonly blockedAt?: Date | null
  readonly lastMessageAt?: Date | null
}

async function crearContacto(tx: Prisma.TransactionClient, empresa: Empresa, datos: ContactoNuevo = {}): Promise<string> {
  const contact = await tx.whatsappContact.create({
    data: {
      id: datos.id ?? randomUUID(),
      companyId: empresa.companyId,
      connectionId: datos.connectionId ?? empresa.connectionId,
      waId: datos.waId ?? waId(),
      customerId: datos.customerId ?? null,
      blockedAt: datos.blockedAt ?? null,
      blockedBy: datos.blockedAt ? empresa.userId : null,
      lastMessageAt: datos.lastMessageAt ?? null,
    },
    select: { id: true },
  })
  return contact.id
}

type MensajeNuevo = {
  readonly id?: string
  readonly direction?: 'IN' | 'OUT'
  /** Hora de Meta como texto de Postgres; `null` deja la hora de guardado como hora del mensaje. */
  readonly meta: string | null
  readonly createdAt?: string
  readonly body?: string | null
  readonly connectionId?: string
}

async function crearMensaje(
  tx: Prisma.TransactionClient,
  empresa: Empresa,
  contactId: string,
  datos: MensajeNuevo,
): Promise<string> {
  const id = datos.id ?? randomUUID()
  const direction = datos.direction ?? 'IN'
  const createdAt = datos.createdAt ?? '2026-10-01T00:00:00Z'
  await tx.$executeRaw`
    INSERT INTO "whatsapp_messages" ("id", "company_id", "connection_id", "contact_id", "direction", "type",
                                     "body", "status", "meta_timestamp", "created_at", "updated_at")
    VALUES (${id}::uuid, ${empresa.companyId}::uuid, ${datos.connectionId ?? empresa.connectionId}::uuid,
            ${contactId}::uuid, ${direction}::whatsapp_message_direction, 'TEXT'::whatsapp_message_type,
            ${datos.body === undefined ? 'hola' : datos.body}, ${direction === 'IN' ? 'RECEIVED' : 'SENT'}::whatsapp_message_status,
            ${datos.meta}::timestamptz, ${createdAt}::timestamptz, now())`
  return id
}

/** La marca de lectura tal como la guarda Postgres, con sus microsegundos. */
async function marcaDe(tx: Prisma.TransactionClient, contactId: string): Promise<string | null> {
  const rows = await tx.$queryRaw<ReadonlyArray<{ readonly mark: string | null }>>`
    SELECT to_char("last_read_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') AS mark
    FROM "whatsapp_contacts" WHERE "id" = ${contactId}::uuid`
  return rows[0]?.mark ?? null
}

function pagina(empresa: Empresa, customerIds: readonly string[], cambios: Partial<ConversationPageQuery> = {}): ConversationPageQuery {
  return {
    connectionId: empresa.connectionId,
    customerIds,
    search: null,
    blocked: 'all',
    offset: 0,
    limit: 20,
    ...cambios,
  }
}

const porId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

describe('whatsapp-conversation-prisma — ambito y que es una conversacion', () => {
  it('R6, R39 — listLinkedCustomerIds devuelve solo clientes de contactos con mensajes de esa conexion y empresa, sin repetir', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createWhatsappConversationRepository(tx)
      const a = await crearEmpresa(tx)
      const b = await crearEmpresa(tx)
      const conMensajes = await crearCliente(tx, a)
      const sinMensajes = await crearCliente(tx, a)
      const deOtraConexion = await crearCliente(tx, a)
      const deOtraEmpresa = await crearCliente(tx, b)

      const c1 = await crearContacto(tx, a, { customerId: conMensajes })
      const c2 = await crearContacto(tx, a, { customerId: conMensajes })
      await crearMensaje(tx, a, c1, { meta: '2026-10-20T10:00:00Z' })
      await crearMensaje(tx, a, c2, { meta: '2026-10-20T11:00:00Z' })
      await crearContacto(tx, a, { customerId: sinMensajes })
      const sinCliente = await crearContacto(tx, a)
      await crearMensaje(tx, a, sinCliente, { meta: '2026-10-20T10:00:00Z' })
      const otraConexion = await crearContacto(tx, a, { connectionId: a.otherConnectionId, customerId: deOtraConexion })
      await crearMensaje(tx, a, otraConexion, { meta: '2026-10-20T10:00:00Z', connectionId: a.otherConnectionId })
      const otraEmpresa = await crearContacto(tx, b, { customerId: deOtraEmpresa })
      await crearMensaje(tx, b, otraEmpresa, { meta: '2026-10-20T10:00:00Z' })

      expect(await repo.listLinkedCustomerIds(a.connectionId, a.scope)).toEqual([conMensajes])
      expect(await repo.listLinkedCustomerIds(b.connectionId, a.scope)).toEqual([])
    })
  })

  it('R6, R39 — listPage no devuelve contactos sin mensajes, de clientes fuera de la lista, de otra conexion ni de otra empresa', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createWhatsappConversationRepository(tx)
      const a = await crearEmpresa(tx)
      const b = await crearEmpresa(tx)
      const vivo = await crearCliente(tx, a)
      const fuera = await crearCliente(tx, a)
      const deB = await crearCliente(tx, b)

      const visible = await crearContacto(tx, a, { customerId: vivo })
      await crearMensaje(tx, a, visible, { meta: '2026-10-20T10:00:00Z' })
      await crearContacto(tx, a, { customerId: vivo })
      const noListado = await crearContacto(tx, a, { customerId: fuera })
      await crearMensaje(tx, a, noListado, { meta: '2026-10-20T10:00:00Z' })
      const otraConexion = await crearContacto(tx, a, { connectionId: a.otherConnectionId, customerId: vivo })
      await crearMensaje(tx, a, otraConexion, { meta: '2026-10-20T10:00:00Z', connectionId: a.otherConnectionId })
      const deOtraEmpresa = await crearContacto(tx, b, { customerId: deB })
      await crearMensaje(tx, b, deOtraEmpresa, { meta: '2026-10-20T10:00:00Z' })

      const resultado = await repo.listPage(pagina(a, [vivo, deB]), a.scope)
      expect(resultado.total).toBe(1)
      expect(resultado.rows.map((row) => row.id)).toEqual([visible])

      const conOtraEmpresa = await repo.listPage({ ...pagina(a, [deB]), connectionId: b.connectionId }, a.scope)
      expect(conOtraEmpresa).toEqual({ rows: [], total: 0 })
      expect(await repo.listPage(pagina(a, []), a.scope)).toEqual({ rows: [], total: 0 })
    })
  })

  it('R39 — findContact y findLatestContactOfCustomer tratan como inexistente un contacto de otra empresa u otra conexion', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createWhatsappConversationRepository(tx)
      const a = await crearEmpresa(tx)
      const b = await crearEmpresa(tx)
      const clienteA = await crearCliente(tx, a)
      const clienteB = await crearCliente(tx, b)
      const contactoA = await crearContacto(tx, a, { customerId: clienteA, blockedAt: new Date('2026-10-01T00:00:00Z') })
      await crearMensaje(tx, a, contactoA, { meta: '2026-10-20T10:00:00Z' })
      const contactoB = await crearContacto(tx, b, { customerId: clienteB })
      await crearMensaje(tx, b, contactoB, { meta: '2026-10-20T10:00:00Z' })

      expect(await repo.findContact(contactoA, a.connectionId, a.scope)).toMatchObject({
        id: contactoA,
        customerId: clienteA,
        blockedAt: new Date('2026-10-01T00:00:00Z'),
        lastInboundAt: null,
      })
      expect(await repo.findContact(contactoB, b.connectionId, a.scope)).toBeNull()
      expect(await repo.findContact(contactoA, a.otherConnectionId, a.scope)).toBeNull()
      expect(await repo.findLatestContactOfCustomer(clienteB, b.connectionId, a.scope)).toBeNull()
      expect(await repo.findLatestContactOfCustomer(clienteA, a.otherConnectionId, a.scope)).toBeNull()
      expect((await repo.findLatestContactOfCustomer(clienteA, a.connectionId, a.scope))?.id).toBe(contactoA)
    })
  })

  it('R39 — findLatestContactOfCustomer elige el contacto con mensajes de ultimo mensaje mas reciente', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createWhatsappConversationRepository(tx)
      const a = await crearEmpresa(tx)
      const cliente = await crearCliente(tx, a)
      const viejo = await crearContacto(tx, a, { customerId: cliente, lastMessageAt: new Date('2026-10-10T00:00:00Z') })
      await crearMensaje(tx, a, viejo, { meta: '2026-10-10T00:00:00Z' })
      const reciente = await crearContacto(tx, a, { customerId: cliente, lastMessageAt: new Date('2026-10-20T00:00:00Z') })
      await crearMensaje(tx, a, reciente, { meta: '2026-10-20T00:00:00Z' })
      await crearContacto(tx, a, { customerId: cliente, lastMessageAt: new Date('2026-10-22T00:00:00Z') })

      expect((await repo.findLatestContactOfCustomer(cliente, a.connectionId, a.scope))?.id).toBe(reciente)
    })
  })
})

describe('whatsapp-conversation-prisma — listado', () => {
  it('R9 — ordena por la hora del ultimo mensaje (Meta o, sin ella, la de guardado), y a igual hora por id de contacto', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createWhatsappConversationRepository(tx)
      const a = await crearEmpresa(tx)
      const cliente = await crearCliente(tx, a)
      const [empate1, empate2] = [randomUUID(), randomUUID()].sort(porId)
      const antiguo = await crearContacto(tx, a, { customerId: cliente })
      await crearMensaje(tx, a, antiguo, { meta: '2026-10-20T09:00:00Z' })
      const e2 = await crearContacto(tx, a, { id: empate2, customerId: cliente })
      await crearMensaje(tx, a, e2, { meta: '2026-10-20T12:00:00Z' })
      const e1 = await crearContacto(tx, a, { id: empate1, customerId: cliente })
      await crearMensaje(tx, a, e1, { meta: null, createdAt: '2026-10-20T12:00:00Z' })
      const medio = await crearContacto(tx, a, { customerId: cliente })
      await crearMensaje(tx, a, medio, { meta: '2026-10-20T11:00:00Z', createdAt: '2026-10-21T00:00:00Z' })

      const { rows } = await repo.listPage(pagina(a, [cliente]), a.scope)
      expect(rows.map((row) => row.id)).toEqual([empate1, empate2, medio, antiguo])
      expect(rows[2]?.lastMessage?.at).toEqual(new Date('2026-10-20T11:00:00Z'))
    })
  })

  it('R9 — el ultimo mensaje es el de hora mayor y, a igual hora, el de id mayor', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createWhatsappConversationRepository(tx)
      const a = await crearEmpresa(tx)
      const cliente = await crearCliente(tx, a)
      const contacto = await crearContacto(tx, a, { customerId: cliente, blockedAt: new Date('2026-10-01T00:00:00Z') })
      const [menor, mayor] = [randomUUID(), randomUUID()].sort(porId)
      await crearMensaje(tx, a, contacto, { id: mayor, direction: 'OUT', meta: '2026-10-20T12:00:00Z', body: 'id mayor' })
      await crearMensaje(tx, a, contacto, { id: menor, meta: '2026-10-20T12:00:00Z', body: 'id menor' })
      await crearMensaje(tx, a, contacto, { meta: '2026-10-20T08:00:00Z', body: 'antes' })

      const { rows } = await repo.listPage(pagina(a, [cliente]), a.scope)
      expect(rows[0]).toMatchObject({
        id: contacto,
        customerId: cliente,
        blockedAt: new Date('2026-10-01T00:00:00Z'),
        lastMessage: { direction: 'OUT', type: 'TEXT', body: 'id mayor', status: 'SENT', at: new Date('2026-10-20T12:00:00Z') },
      })
    })
  })

  it('R10 — la busqueda devuelve los clientes por nombre O los numeros que contienen los digitos', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createWhatsappConversationRepository(tx)
      const a = await crearEmpresa(tx)
      const porNombre = await crearCliente(tx, a)
      const porNumero = await crearCliente(tx, a)
      const ninguno = await crearCliente(tx, a)
      const cNombre = await crearContacto(tx, a, { customerId: porNombre, waId: '593911111111' })
      await crearMensaje(tx, a, cNombre, { meta: '2026-10-20T12:00:00Z' })
      const cNumero = await crearContacto(tx, a, { customerId: porNumero, waId: '593987654321' })
      await crearMensaje(tx, a, cNumero, { meta: '2026-10-20T11:00:00Z' })
      const cNinguno = await crearContacto(tx, a, { customerId: ninguno, waId: '593922222222' })
      await crearMensaje(tx, a, cNinguno, { meta: '2026-10-20T10:00:00Z' })
      const todos = [porNombre, porNumero, ninguno]
      const ids = async (search: ConversationPageQuery['search']) =>
        (await repo.listPage(pagina(a, todos, { search }), a.scope)).rows.map((row) => row.id)

      expect(await ids({ nameMatchIds: [porNombre], digits: '' })).toEqual([cNombre])
      expect(await ids({ nameMatchIds: [], digits: '8765' })).toEqual([cNumero])
      expect(await ids({ nameMatchIds: [porNombre], digits: '8765' })).toEqual([cNombre, cNumero])
      expect(await ids({ nameMatchIds: [], digits: '' })).toEqual([])
      expect(await ids({ nameMatchIds: [], digits: '_' })).toEqual([])
      expect(await ids({ nameMatchIds: [], digits: '%' })).toEqual([])
      const total = (await repo.listPage(pagina(a, todos, { search: { nameMatchIds: [], digits: '8765' } }), a.scope)).total
      expect(total).toBe(1)
    })
  })

  it('R11 — el filtro de bloqueo devuelve todas, solo las bloqueadas o solo las no bloqueadas', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createWhatsappConversationRepository(tx)
      const a = await crearEmpresa(tx)
      const cliente = await crearCliente(tx, a)
      const bloqueado = await crearContacto(tx, a, { customerId: cliente, blockedAt: new Date('2026-10-01T00:00:00Z') })
      await crearMensaje(tx, a, bloqueado, { meta: '2026-10-20T12:00:00Z' })
      const libre = await crearContacto(tx, a, { customerId: cliente })
      await crearMensaje(tx, a, libre, { meta: '2026-10-20T11:00:00Z' })
      const ids = async (blocked: ConversationPageQuery['blocked']) => {
        const { rows, total } = await repo.listPage(pagina(a, [cliente], { blocked }), a.scope)
        return { ids: rows.map((row) => row.id), total }
      }

      expect(await ids('all')).toEqual({ ids: [bloqueado, libre], total: 2 })
      expect(await ids('blocked')).toEqual({ ids: [bloqueado], total: 1 })
      expect(await ids('not_blocked')).toEqual({ ids: [libre], total: 1 })
    })
  })

  it('R12 — pagina con offset y limit y el total cuenta todas las conversaciones del filtro', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createWhatsappConversationRepository(tx)
      const a = await crearEmpresa(tx)
      const cliente = await crearCliente(tx, a)
      const contactos: string[] = []
      for (let hora = 10; hora < 15; hora += 1) {
        const contacto = await crearContacto(tx, a, { customerId: cliente })
        await crearMensaje(tx, a, contacto, { meta: `2026-10-20T${String(hora)}:00:00Z` })
        contactos.unshift(contacto)
      }

      const primera = await repo.listPage(pagina(a, [cliente], { offset: 0, limit: 2 }), a.scope)
      const tercera = await repo.listPage(pagina(a, [cliente], { offset: 4, limit: 2 }), a.scope)
      expect(primera).toMatchObject({ total: 5 })
      expect(primera.rows.map((row) => row.id)).toEqual(contactos.slice(0, 2))
      expect(tercera.rows.map((row) => row.id)).toEqual(contactos.slice(4))
      expect(tercera.total).toBe(5)
    })
  })
})

describe('whatsapp-conversation-prisma — no leidos y marca de lectura', () => {
  it('R15 — sin marca cuenta todos los entrantes y nunca los salientes', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createWhatsappConversationRepository(tx)
      const a = await crearEmpresa(tx)
      const cliente = await crearCliente(tx, a)
      const contacto = await crearContacto(tx, a, { customerId: cliente })
      await crearMensaje(tx, a, contacto, { meta: '2026-10-20T10:00:00Z' })
      await crearMensaje(tx, a, contacto, { meta: null, createdAt: '2026-10-20T11:00:00Z' })
      await crearMensaje(tx, a, contacto, { direction: 'OUT', meta: '2026-10-20T12:00:00Z' })

      expect(await repo.countUnread(contacto, a.scope)).toBe(2)
      expect((await repo.listPage(pagina(a, [cliente]), a.scope)).rows[0]?.unreadCount).toBe(2)
    })
  })

  it('R15 — con la marca en microsegundos, un entrante a la misma hora esta leido y uno un microsegundo despues no', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createWhatsappConversationRepository(tx)
      const a = await crearEmpresa(tx)
      const cliente = await crearCliente(tx, a)
      const contacto = await crearContacto(tx, a, { customerId: cliente })
      const marcado = await crearMensaje(tx, a, contacto, { meta: '2026-10-20T10:00:00.123456Z' })
      await crearMensaje(tx, a, contacto, { meta: '2026-10-20T10:00:00.123456Z' })
      await crearMensaje(tx, a, contacto, { meta: '2026-10-20T10:00:00.123457Z' })

      expect(await repo.advanceLastRead(contacto, marcado, a.scope)).toBe('ok')
      expect(await marcaDe(tx, contacto)).toBe('2026-10-20T10:00:00.123456')
      expect(await repo.countUnread(contacto, a.scope)).toBe(1)
      expect((await repo.listPage(pagina(a, [cliente]), a.scope)).rows[0]?.unreadCount).toBe(1)
    })
  })

  it('R39 — countUnread de un contacto de otra empresa es 0', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createWhatsappConversationRepository(tx)
      const a = await crearEmpresa(tx)
      const b = await crearEmpresa(tx)
      const contactoB = await crearContacto(tx, b)
      await crearMensaje(tx, b, contactoB, { meta: '2026-10-20T10:00:00Z' })

      expect(await repo.countUnread(contactoB, b.scope)).toBe(1)
      expect(await repo.countUnread(contactoB, a.scope)).toBe(0)
    })
  })

  it('R16 — sin mensaje indicado mueve la marca a la hora exacta del ultimo mensaje y deja 0 no leidos', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createWhatsappConversationRepository(tx)
      const a = await crearEmpresa(tx)
      const contacto = await crearContacto(tx, a)
      const [menor, mayor] = [randomUUID(), randomUUID()].sort(porId)
      await crearMensaje(tx, a, contacto, { meta: '2026-10-20T10:00:00.000001Z' })
      await crearMensaje(tx, a, contacto, { id: menor, meta: '2026-10-20T11:00:00.654321Z' })
      await crearMensaje(tx, a, contacto, { id: mayor, direction: 'OUT', meta: '2026-10-20T11:00:00.654321Z' })

      expect(await repo.advanceLastRead(contacto, null, a.scope)).toBe('ok')
      expect(await marcaDe(tx, contacto)).toBe('2026-10-20T11:00:00.654321')
      expect(await repo.countUnread(contacto, a.scope)).toBe(0)
    })
  })

  it('R17 — con mensaje indicado mueve la marca a su hora; uno de otro contacto u otra empresa es `message_not_found` y no cambia nada', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createWhatsappConversationRepository(tx)
      const a = await crearEmpresa(tx)
      const b = await crearEmpresa(tx)
      const contacto = await crearContacto(tx, a)
      const otro = await crearContacto(tx, a)
      const contactoB = await crearContacto(tx, b)
      const primero = await crearMensaje(tx, a, contacto, { meta: '2026-10-20T10:00:00Z' })
      await crearMensaje(tx, a, contacto, { meta: '2026-10-20T11:00:00Z' })
      const ajeno = await crearMensaje(tx, a, otro, { meta: '2026-10-20T12:00:00Z' })
      const deB = await crearMensaje(tx, b, contactoB, { meta: '2026-10-20T13:00:00Z' })

      expect(await repo.advanceLastRead(contacto, primero, a.scope)).toBe('ok')
      expect(await marcaDe(tx, contacto)).toBe('2026-10-20T10:00:00.000000')
      expect(await repo.countUnread(contacto, a.scope)).toBe(1)

      expect(await repo.advanceLastRead(contacto, ajeno, a.scope)).toBe('message_not_found')
      expect(await repo.advanceLastRead(contacto, deB, a.scope)).toBe('message_not_found')
      expect(await repo.advanceLastRead(contacto, randomUUID(), a.scope)).toBe('message_not_found')
      expect(await repo.advanceLastRead(contactoB, deB, a.scope)).toBe('message_not_found')
      expect(await marcaDe(tx, contacto)).toBe('2026-10-20T10:00:00.000000')
      expect(await marcaDe(tx, contactoB)).toBeNull()
    })
  })

  it('R18 — la marca nunca retrocede: marcar un mensaje anterior la deja donde estaba', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createWhatsappConversationRepository(tx)
      const a = await crearEmpresa(tx)
      const contacto = await crearContacto(tx, a)
      const viejo = await crearMensaje(tx, a, contacto, { meta: '2026-10-20T10:00:00Z' })
      const nuevo = await crearMensaje(tx, a, contacto, { meta: '2026-10-20T11:00:00.500000Z' })

      expect(await repo.advanceLastRead(contacto, nuevo, a.scope)).toBe('ok')
      expect(await repo.advanceLastRead(contacto, viejo, a.scope)).toBe('ok')
      expect(await marcaDe(tx, contacto)).toBe('2026-10-20T11:00:00.500000')
    })
  })

  it('R18 — un contacto sin mensajes queda como estaba', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createWhatsappConversationRepository(tx)
      const a = await crearEmpresa(tx)
      const contacto = await crearContacto(tx, a)
      const antes = await tx.whatsappContact.findUniqueOrThrow({ where: { id: contacto } })

      expect(await repo.advanceLastRead(contacto, null, a.scope)).toBe('ok')
      const despues = await tx.whatsappContact.findUniqueOrThrow({ where: { id: contacto } })
      expect(despues.lastReadAt).toBeNull()
      expect(despues.updatedAt).toEqual(antes.updatedAt)
    })
  })
})

describe('whatsapp-conversation-prisma — mensajes del chat', () => {
  it('R22 — devuelve del mas reciente al mas antiguo, con el limite pedido y cada columna del mensaje', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createWhatsappConversationRepository(tx)
      const a = await crearEmpresa(tx)
      const contacto = await crearContacto(tx, a)
      const viejo = await crearMensaje(tx, a, contacto, { meta: '2026-10-20T10:00:00Z' })
      const medio = await crearMensaje(tx, a, contacto, { meta: null, createdAt: '2026-10-20T11:00:00Z' })
      const nuevo = await crearMensaje(tx, a, contacto, { direction: 'OUT', meta: '2026-10-20T12:00:00Z', body: 'listo' })
      await tx.whatsappMessage.update({
        where: { id: nuevo },
        data: {
          status: 'FAILED',
          errorCode: '131047',
          errorReason: 'Re-engagement message',
          origin: 'USER',
          sentById: a.userId,
          templateName: 'aviso_pedido',
          payload: { caption: 'foto' },
        },
      })

      const pagina1 = await repo.listMessages(contacto, a.connectionId, { before: null, limit: 2 }, a.scope)
      expect(pagina1).not.toBe('cursor_not_found')
      if (pagina1 === 'cursor_not_found') return
      expect(pagina1.map((row) => row.id)).toEqual([nuevo, medio])
      expect(pagina1[0]).toEqual({
        id: nuevo,
        direction: 'OUT',
        type: 'TEXT',
        body: 'listo',
        payload: { caption: 'foto' },
        status: 'FAILED',
        errorCode: '131047',
        errorReason: 'Re-engagement message',
        origin: 'USER',
        sentById: a.userId,
        templateName: 'aviso_pedido',
        at: new Date('2026-10-20T12:00:00Z'),
      })
      expect(pagina1[1]).toMatchObject({ direction: 'IN', origin: null, sentById: null, at: new Date('2026-10-20T11:00:00Z') })

      const pagina2 = await repo.listMessages(contacto, a.connectionId, { before: medio, limit: 2 }, a.scope)
      expect(pagina2 === 'cursor_not_found' ? pagina2 : pagina2.map((row) => row.id)).toEqual([viejo])
    })
  })

  it('R22, R23 — el cursor con varios mensajes a la misma hora (en microsegundos) no salta ni repite ninguno', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createWhatsappConversationRepository(tx)
      const a = await crearEmpresa(tx)
      const contacto = await crearContacto(tx, a)
      const empatados = [randomUUID(), randomUUID(), randomUUID()].sort(porId)
      const antes = await crearMensaje(tx, a, contacto, { meta: '2026-10-20T10:00:00.123455Z' })
      for (const id of empatados) {
        await crearMensaje(tx, a, contacto, { id, meta: '2026-10-20T10:00:00.123456Z' })
      }
      const despues = await crearMensaje(tx, a, contacto, { meta: '2026-10-20T10:00:00.123457Z' })
      const esperado = [despues, ...[...empatados].reverse(), antes]

      const vistos: string[] = []
      let before: string | null = null
      for (let vuelta = 0; vuelta < 10; vuelta += 1) {
        const page = await repo.listMessages(contacto, a.connectionId, { before, limit: 2 }, a.scope)
        if (page === 'cursor_not_found') throw new Error('el cursor de la pagina anterior no se encontro')
        vistos.push(...page.map((row) => row.id))
        const ultimo = page.at(-1)
        if (page.length < 2 || ultimo === undefined) break
        before = ultimo.id
      }
      expect(vistos).toEqual(esperado)
    })
  })

  it('R23, R39 — un cursor de otro contacto, de otra empresa o inexistente es `cursor_not_found`; otra conexion no ve mensajes', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createWhatsappConversationRepository(tx)
      const a = await crearEmpresa(tx)
      const b = await crearEmpresa(tx)
      const contacto = await crearContacto(tx, a)
      const otro = await crearContacto(tx, a)
      const contactoB = await crearContacto(tx, b)
      await crearMensaje(tx, a, contacto, { meta: '2026-10-20T10:00:00Z' })
      const ajeno = await crearMensaje(tx, a, otro, { meta: '2026-10-20T11:00:00Z' })
      const deB = await crearMensaje(tx, b, contactoB, { meta: '2026-10-20T12:00:00Z' })

      const pedir = (contactId: string, connectionId: string, before: string | null) =>
        repo.listMessages(contactId, connectionId, { before, limit: 10 }, a.scope)
      expect(await pedir(contacto, a.connectionId, ajeno)).toBe('cursor_not_found')
      expect(await pedir(contacto, a.connectionId, deB)).toBe('cursor_not_found')
      expect(await pedir(contacto, a.connectionId, randomUUID())).toBe('cursor_not_found')
      expect(await pedir(contactoB, b.connectionId, deB)).toBe('cursor_not_found')
      expect(await pedir(contactoB, b.connectionId, null)).toEqual([])
      expect(await pedir(contacto, a.otherConnectionId, null)).toEqual([])
    })
  })
})
