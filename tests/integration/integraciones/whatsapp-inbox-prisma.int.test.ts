// El guardado del lote de un webhook de WhatsApp contra Postgres REAL.
//
// Aislamiento: `commit`. `recordWhatsappInbound` abre su PROPIA `prisma.$transaction` sobre el
// cliente GLOBAL, y el caso de dos `record` concurrentes del mismo numero necesita dos conexiones
// que confirmen de verdad. Cada caso fabrica su empresa efimera (tipo de documento, rol, empresa,
// usuario y conexion) y `afterAll` borra mensajes -> contactos -> conexiones por `company_id`,
// afirma contando que no queda nada y despues borra usuario -> rol -> tipo de documento -> empresa.

import { randomUUID } from 'node:crypto'

import { afterAll, describe, expect, it } from 'vitest'

import { insertWhatsappConnection } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-connection-prisma'
import { recordWhatsappInbound } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-inbox-prisma'
import { normalizeCompanyName } from '@/lib/modules/identity'
import { prisma } from '@/lib/shared/db/prisma'

import type { IntegracionesScope } from '@/lib/modules/integraciones/domain/integraciones-scope'
import type {
  InboundBatch,
  InboundContact,
  InboundMessage,
  InboundStatus,
} from '@/lib/modules/integraciones/domain/whatsapp-webhook-payload'
import type { WhatsappMessageStatus } from '@/lib/modules/integraciones/domain/whatsapp-message'

function token(): string {
  return randomUUID().replace(/-/gu, '')
}

type Empresa = {
  readonly companyId: string
  readonly userId: string
  readonly roleId: string
  readonly documentTypeCode: string
  readonly connectionId: string
  readonly scope: IntegracionesScope
}

const empresas: Empresa[] = []

async function crearEmpresa(): Promise<Empresa> {
  const marker = token()
  const documentType = await prisma.documentType.create({
    data: { code: `DOC${marker.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  })
  const role = await prisma.role.create({
    data: { name: `rol-${marker}`, description: 'Rol de prueba' },
    select: { id: true },
  })
  const companyName = `Empresa inbox ${marker}`
  const company = await prisma.company.create({
    data: { name: companyName, nameNormalized: normalizeCompanyName(companyName) },
    select: { id: true },
  })
  const user = await prisma.user.create({
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
  const scope: IntegracionesScope = { companyId: company.id }
  const connectionId = randomUUID()
  await insertWhatsappConnection(
    {
      id: connectionId,
      origin: 'MANUAL',
      displayName: 'Ventas',
      wabaId: `waba-${token()}`,
      phoneNumberId: `phone-${token()}`,
      displayPhoneNumber: '+57 300 1234567',
      verifiedName: 'Empresa Verificada',
      accessTokenEnc: 'v1:valor-cifrado-de-prueba',
      appSecretEnc: 'v1:otro-valor-cifrado',
      verifyTokenHash: 'a'.repeat(64),
      status: 'ACTIVE',
      lastError: null,
      lastCheckedAt: new Date('2026-10-09T12:00:00.000Z'),
      createdById: user.id,
    },
    scope,
  )
  const empresa: Empresa = {
    companyId: company.id,
    userId: user.id,
    roleId: role.id,
    documentTypeCode: documentType.code,
    connectionId,
    scope,
  }
  empresas.push(empresa)
  return empresa
}

afterAll(async () => {
  const ids = empresas.map((empresa) => empresa.companyId)
  const enEmpresas = { where: { companyId: { in: ids } } }
  await prisma.whatsappMessage.deleteMany(enEmpresas)
  await prisma.whatsappContact.deleteMany(enEmpresas)
  await prisma.whatsappConnection.deleteMany(enEmpresas)
  expect(await prisma.whatsappMessage.count(enEmpresas)).toBe(0)
  expect(await prisma.whatsappContact.count(enEmpresas)).toBe(0)
  expect(await prisma.whatsappConnection.count(enEmpresas)).toBe(0)
  for (const empresa of empresas) {
    await prisma.user.delete({ where: { id: empresa.userId } })
    await prisma.role.delete({ where: { id: empresa.roleId } })
    await prisma.documentType.delete({ where: { code: empresa.documentTypeCode } })
    await prisma.company.delete({ where: { id: empresa.companyId } })
  }
  await prisma.$disconnect()
})

const T0 = new Date('2026-10-19T10:00:00.000Z')
const T1 = new Date('2026-10-19T11:00:00.000Z')
const T2 = new Date('2026-10-19T12:00:00.000Z')

function waId(): string {
  return `5730000${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`
}

function wamid(): string {
  return `wamid.${token()}`
}

function contacto(id: string, profileName: string | null, latestAt: Date): InboundContact {
  return { waId: id, profileName, latestAt }
}

function texto(id: string, remitente: string, body: string, metaTimestamp: Date): InboundMessage {
  return { wamid: id, waId: remitente, type: 'TEXT', body, payload: { from: remitente }, metaTimestamp }
}

function lote(partial: Partial<InboundBatch>): InboundBatch {
  return {
    contacts: [],
    messages: [],
    statuses: [],
    skipped: { changes: 0, messages: 0, statuses: 0 },
    ...partial,
  }
}

function status(id: string, value: InboundStatus['status'], error?: [string, string]): InboundStatus {
  return { wamid: id, status: value, errorCode: error?.[0] ?? null, errorReason: error?.[1] ?? null }
}

/** Un saliente sembrado a mano: los statuses de Meta solo se aplican a mensajes `OUT`. */
async function sembrarSaliente(empresa: Empresa, id: string, estado: WhatsappMessageStatus): Promise<void> {
  const numero = waId()
  await recordWhatsappInbound(
    lote({ contacts: [contacto(numero, null, T0)], messages: [] }),
    empresa.connectionId,
    T0,
    empresa.scope,
  )
  const contact = await prisma.whatsappContact.findUniqueOrThrow({
    where: { connectionId_waId: { connectionId: empresa.connectionId, waId: numero } },
    select: { id: true },
  })
  await prisma.whatsappMessage.create({
    data: {
      companyId: empresa.companyId,
      connectionId: empresa.connectionId,
      contactId: contact.id,
      direction: 'OUT',
      wamid: id,
      type: 'TEXT',
      body: 'saliente de prueba',
      status: estado,
    },
  })
}

async function estadoDe(id: string) {
  return prisma.whatsappMessage.findUniqueOrThrow({
    where: { wamid: id },
    select: { status: true, errorCode: true, errorReason: true },
  })
}

describe('recordWhatsappInbound — contactos y mensajes', () => {
  it('R16 R17 R24: crea el contacto y el mensaje entrante con sus campos, y solo toca lastWebhookAt de la conexion', async () => {
    const empresa = await crearEmpresa()
    const numero = waId()
    const id = wamid()
    const recibido = new Date('2026-10-19T12:30:00.000Z')

    await recordWhatsappInbound(
      lote({ contacts: [contacto(numero, 'Cliente Uno', T1)], messages: [texto(id, numero, 'hola', T1)] }),
      empresa.connectionId,
      recibido,
      empresa.scope,
    )

    const contact = await prisma.whatsappContact.findUniqueOrThrow({
      where: { connectionId_waId: { connectionId: empresa.connectionId, waId: numero } },
    })
    expect(contact).toMatchObject({
      companyId: empresa.companyId,
      profileName: 'Cliente Uno',
      customerId: null,
      lastInboundAt: T1,
      lastMessageAt: T1,
    })

    const message = await prisma.whatsappMessage.findUniqueOrThrow({ where: { wamid: id } })
    expect(message).toMatchObject({
      companyId: empresa.companyId,
      connectionId: empresa.connectionId,
      contactId: contact.id,
      direction: 'IN',
      status: 'RECEIVED',
      type: 'TEXT',
      body: 'hola',
      payload: { from: numero },
      metaTimestamp: T1,
      origin: null,
      sentById: null,
      templateName: null,
      attempts: 0,
      queueMessageId: null,
      errorCode: null,
      errorReason: null,
    })

    const connection = await prisma.whatsappConnection.findUniqueOrThrow({ where: { id: empresa.connectionId } })
    expect(connection.lastWebhookAt).toEqual(recibido)
    expect(connection.status).toBe('ACTIVE')
  })

  it('R24: un lote vacio solo deja lastWebhookAt', async () => {
    const empresa = await crearEmpresa()

    await recordWhatsappInbound(lote({}), empresa.connectionId, T2, empresa.scope)

    const connection = await prisma.whatsappConnection.findUniqueOrThrow({ where: { id: empresa.connectionId } })
    expect(connection.lastWebhookAt).toEqual(T2)
    expect(connection.status).toBe('ACTIVE')
    expect(await prisma.whatsappContact.count({ where: { companyId: empresa.companyId } })).toBe(0)
  })

  it('R16: un lote mas viejo no retrocede las fechas ni el nombre; uno mas nuevo los avanza', async () => {
    const empresa = await crearEmpresa()
    const numero = waId()
    const leer = () =>
      prisma.whatsappContact.findUniqueOrThrow({
        where: { connectionId_waId: { connectionId: empresa.connectionId, waId: numero } },
        select: { profileName: true, lastInboundAt: true, lastMessageAt: true },
      })

    await recordWhatsappInbound(
      lote({ contacts: [contacto(numero, 'Nombre Nuevo', T1)], messages: [texto(wamid(), numero, 'b', T1)] }),
      empresa.connectionId,
      T2,
      empresa.scope,
    )
    await recordWhatsappInbound(
      lote({ contacts: [contacto(numero, 'Nombre Viejo', T0)], messages: [texto(wamid(), numero, 'a', T0)] }),
      empresa.connectionId,
      T2,
      empresa.scope,
    )
    expect(await leer()).toEqual({ profileName: 'Nombre Nuevo', lastInboundAt: T1, lastMessageAt: T1 })

    await recordWhatsappInbound(
      lote({ contacts: [contacto(numero, 'Nombre Ultimo', T2)], messages: [texto(wamid(), numero, 'c', T2)] }),
      empresa.connectionId,
      T2,
      empresa.scope,
    )
    expect(await leer()).toEqual({ profileName: 'Nombre Ultimo', lastInboundAt: T2, lastMessageAt: T2 })
    expect(await prisma.whatsappContact.count({ where: { companyId: empresa.companyId } })).toBe(1)
  })

  it('R18 R25: un wamid ya guardado no crea otra fila ni modifica la existente, y el record termina bien', async () => {
    const empresa = await crearEmpresa()
    const numero = waId()
    const id = wamid()
    const batch = lote({ contacts: [contacto(numero, 'Cliente', T1)], messages: [texto(id, numero, 'original', T1)] })

    await recordWhatsappInbound(batch, empresa.connectionId, T1, empresa.scope)
    await recordWhatsappInbound(batch, empresa.connectionId, T2, empresa.scope)
    await expect(
      recordWhatsappInbound(
        lote({ contacts: [contacto(numero, 'Cliente', T1)], messages: [texto(id, numero, 'reescrito', T2)] }),
        empresa.connectionId,
        T2,
        empresa.scope,
      ),
    ).resolves.toBeUndefined()

    const filas = await prisma.whatsappMessage.findMany({ where: { companyId: empresa.companyId } })
    expect(filas).toHaveLength(1)
    expect(filas[0]).toMatchObject({ wamid: id, body: 'original', metaTimestamp: T1 })
    expect(await prisma.whatsappContact.count({ where: { companyId: empresa.companyId } })).toBe(1)
  })

  it('R16 R25: dos record concurrentes del mismo numero dejan un solo contacto con la fecha mas reciente', async () => {
    const empresa = await crearEmpresa()
    const numero = waId()

    await Promise.all([
      recordWhatsappInbound(
        lote({ contacts: [contacto(numero, 'Uno', T0)], messages: [texto(wamid(), numero, 'uno', T0)] }),
        empresa.connectionId,
        T2,
        empresa.scope,
      ),
      recordWhatsappInbound(
        lote({ contacts: [contacto(numero, 'Dos', T1)], messages: [texto(wamid(), numero, 'dos', T1)] }),
        empresa.connectionId,
        T2,
        empresa.scope,
      ),
    ])

    const contactos = await prisma.whatsappContact.findMany({ where: { companyId: empresa.companyId } })
    expect(contactos).toHaveLength(1)
    expect(contactos[0]).toMatchObject({ waId: numero, profileName: 'Dos', lastInboundAt: T1, lastMessageAt: T1 })
    const mensajes = await prisma.whatsappMessage.findMany({ where: { companyId: empresa.companyId } })
    expect(mensajes).toHaveLength(2)
    expect(new Set(mensajes.map((m) => m.contactId))).toEqual(new Set([contactos[0]?.id]))
  })

  it('R23: si un paso falla no queda nada escrito del lote, ni el contacto ni lastWebhookAt', async () => {
    const empresa = await crearEmpresa()
    const numero = waId()
    const huerfano = waId()

    await expect(
      recordWhatsappInbound(
        lote({ contacts: [contacto(numero, 'Cliente', T1)], messages: [texto(wamid(), huerfano, 'x', T1)] }),
        empresa.connectionId,
        T2,
        empresa.scope,
      ),
    ).rejects.toThrow()

    expect(await prisma.whatsappContact.count({ where: { companyId: empresa.companyId } })).toBe(0)
    expect(await prisma.whatsappMessage.count({ where: { companyId: empresa.companyId } })).toBe(0)
    const connection = await prisma.whatsappConnection.findUniqueOrThrow({ where: { id: empresa.connectionId } })
    expect(connection.lastWebhookAt).toBeNull()
  })
})

describe('recordWhatsappInbound — statuses', () => {
  it('R21: avanza SENT -> READ, no retrocede con DELIVERED ni pasa a FAILED despues', async () => {
    const empresa = await crearEmpresa()
    const id = wamid()
    await sembrarSaliente(empresa, id, 'SENT')

    await recordWhatsappInbound(lote({ statuses: [status(id, 'READ')] }), empresa.connectionId, T1, empresa.scope)
    expect(await estadoDe(id)).toEqual({ status: 'READ', errorCode: null, errorReason: null })

    await recordWhatsappInbound(lote({ statuses: [status(id, 'DELIVERED')] }), empresa.connectionId, T1, empresa.scope)
    await recordWhatsappInbound(
      lote({ statuses: [status(id, 'FAILED', ['131026', 'Mensaje no entregable'])] }),
      empresa.connectionId,
      T1,
      empresa.scope,
    )
    expect(await estadoDe(id)).toEqual({ status: 'READ', errorCode: null, errorReason: null })
  })

  it('R21: FAILED desde SENT guarda errorCode y errorReason, y nada sale de FAILED', async () => {
    const empresa = await crearEmpresa()
    const id = wamid()
    await sembrarSaliente(empresa, id, 'SENT')

    await recordWhatsappInbound(
      lote({ statuses: [status(id, 'FAILED', ['131026', 'Mensaje no entregable'])] }),
      empresa.connectionId,
      T1,
      empresa.scope,
    )
    await recordWhatsappInbound(lote({ statuses: [status(id, 'READ')] }), empresa.connectionId, T1, empresa.scope)

    expect(await estadoDe(id)).toEqual({ status: 'FAILED', errorCode: '131026', errorReason: 'Mensaje no entregable' })
  })

  it('R21: un status nunca toca un entrante RECEIVED', async () => {
    const empresa = await crearEmpresa()
    const numero = waId()
    const id = wamid()
    await recordWhatsappInbound(
      lote({ contacts: [contacto(numero, null, T0)], messages: [texto(id, numero, 'hola', T0)] }),
      empresa.connectionId,
      T0,
      empresa.scope,
    )

    await recordWhatsappInbound(lote({ statuses: [status(id, 'READ')] }), empresa.connectionId, T1, empresa.scope)

    expect(await estadoDe(id)).toEqual({ status: 'RECEIVED', errorCode: null, errorReason: null })
  })

  it('R22: un status de un wamid desconocido se ignora sin error', async () => {
    const empresa = await crearEmpresa()

    await expect(
      recordWhatsappInbound(lote({ statuses: [status(wamid(), 'DELIVERED')] }), empresa.connectionId, T1, empresa.scope),
    ).resolves.toBeUndefined()

    const connection = await prisma.whatsappConnection.findUniqueOrThrow({ where: { id: empresa.connectionId } })
    expect(connection.lastWebhookAt).toEqual(T1)
  })

  it('R2: un status de la empresa B con el wamid de un mensaje de A no lo toca', async () => {
    const a = await crearEmpresa()
    const b = await crearEmpresa()
    const id = wamid()
    await sembrarSaliente(a, id, 'SENT')

    // Con la conexion de B y su ambito, y con la conexion de A pero el ambito de B.
    await recordWhatsappInbound(lote({ statuses: [status(id, 'READ')] }), b.connectionId, T1, b.scope)
    await recordWhatsappInbound(lote({ statuses: [status(id, 'DELIVERED')] }), a.connectionId, T1, b.scope)

    expect(await estadoDe(id)).toEqual({ status: 'SENT', errorCode: null, errorReason: null })
    const conexionA = await prisma.whatsappConnection.findUniqueOrThrow({ where: { id: a.connectionId } })
    expect(conexionA.lastWebhookAt).toEqual(T0)
  })
})
