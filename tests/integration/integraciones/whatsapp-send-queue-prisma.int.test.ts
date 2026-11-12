// La cola de envíos del sistema (mensajes `SYSTEM` en `QUEUED`/`SENDING`) contra Postgres REAL.
//
// Aislamiento: `commit`. El repositorio se construye sobre el cliente Prisma GLOBAL, como en
// lib/composition, y el reclamo concurrente necesita conexiones que confirmen de verdad. Cada caso
// fabrica su empresa efímera y `afterAll` borra mensajes -> contactos -> conexiones por `company_id`,
// afirma contando que no queda nada y después borra usuario -> rol -> tipo de documento -> empresa.

import { randomUUID } from 'node:crypto'

import { afterAll, describe, expect, it } from 'vitest'

import { insertWhatsappConnection } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-connection-prisma'
import { createWhatsappOutboxRepository } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-outbox-prisma'
import { createWhatsappSendQueueRepository } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-send-queue-prisma'
import { normalizeCompanyName } from '@/lib/modules/identity'
import { prisma } from '@/lib/shared/db/prisma'

import type { IntegracionesScope } from '@/lib/modules/integraciones/domain/integraciones-scope'
import type { NewQueuedMessage } from '@/lib/modules/integraciones/domain/whatsapp-outbound-message'

const queue = createWhatsappSendQueueRepository()
const outbox = createWhatsappOutboxRepository()

const MAX_ATTEMPTS = 4
const REASON = 'Motivo de prueba en español.'
const HACE_UNA_HORA = () => new Date(Date.now() - 60 * 60 * 1000)

function token(): string {
  return randomUUID().replace(/-/gu, '')
}

function waId(): string {
  return `5731000${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`
}

type Empresa = {
  readonly companyId: string
  readonly userId: string
  readonly roleId: string
  readonly documentTypeCode: string
  readonly connectionId: string
  readonly contactId: string
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
  const companyName = `Empresa cola ${marker}`
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
  const parcial = {
    companyId: company.id,
    userId: user.id,
    roleId: role.id,
    documentTypeCode: documentType.code,
    connectionId,
    scope,
  }
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
      lastCheckedAt: new Date('2026-11-11T12:00:00.000Z'),
      createdById: user.id,
    },
    scope,
  )
  const contact = await outbox.ensureContact(connectionId, waId(), scope)
  const empresa: Empresa = { ...parcial, contactId: contact.id }
  empresas.push(empresa)
  return empresa
}

const COMPONENTS = [{ type: 'body', parameters: [{ type: 'text', text: 'Luis' }] }] as const

function aviso(empresa: Empresa): NewQueuedMessage {
  return {
    connectionId: empresa.connectionId,
    contactId: empresa.contactId,
    body: 'Hola Luis, tu pedido salió.',
    templateName: 'pedido_despachado',
    templateLanguage: 'es',
    payload: { 'cliente.nombre': 'Luis' },
    templateComponents: COMPONENTS,
  }
}

async function encolar(empresa: Empresa): Promise<string> {
  return (await queue.insertQueued(aviso(empresa), empresa.scope)).id
}

/** Un mensaje de otro origen en el estado dado, escrito directo: la cola no puede crearlos. */
async function mensajeDeOtroOrigen(
  empresa: Empresa,
  origin: 'USER' | 'AGENT',
  status: 'QUEUED' | 'SENDING',
  attempts = 0,
): Promise<string> {
  const row = await prisma.whatsappMessage.create({
    data: {
      companyId: empresa.companyId,
      connectionId: empresa.connectionId,
      contactId: empresa.contactId,
      direction: 'OUT',
      status,
      origin,
      sentById: origin === 'USER' ? empresa.userId : null,
      attempts,
      type: 'TEXT',
      body: 'Texto de prueba',
    },
    select: { id: true },
  })
  return row.id
}

async function fila(id: string) {
  return prisma.whatsappMessage.findUniqueOrThrow({ where: { id } })
}

async function envejecer(id: string, at: Date, attempts?: number): Promise<void> {
  if (attempts === undefined) {
    await prisma.$executeRaw`UPDATE "whatsapp_messages" SET "updated_at" = ${at}::timestamptz WHERE "id" = ${id}::uuid`
  } else {
    await prisma.$executeRaw`UPDATE "whatsapp_messages" SET "updated_at" = ${at}::timestamptz, "attempts" = ${attempts}::int WHERE "id" = ${id}::uuid`
  }
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

describe('whatsapp-send-queue-prisma — alta y publicación', () => {
  it('R8 — insertQueued crea un saliente QUEUED, SYSTEM, sin autor, de plantilla, con sus componentes y en su empresa', async () => {
    const empresa = await crearEmpresa()
    const id = await encolar(empresa)

    const row = await fila(id)
    expect(row).toMatchObject({
      companyId: empresa.companyId,
      connectionId: empresa.connectionId,
      contactId: empresa.contactId,
      direction: 'OUT',
      status: 'QUEUED',
      origin: 'SYSTEM',
      sentById: null,
      attempts: 0,
      type: 'TEMPLATE',
      body: 'Hola Luis, tu pedido salió.',
      templateName: 'pedido_despachado',
      templateLanguage: 'es',
      payload: { 'cliente.nombre': 'Luis' },
      templateComponents: COMPONENTS,
      metaTimestamp: null,
      queueMessageId: null,
      wamid: null,
    })
  })

  it('R10, R29 — recordPublished guarda el id de la cola y renueva updated_at, solo en QUEUED y en su empresa', async () => {
    const empresa = await crearEmpresa()
    const otra = await crearEmpresa()
    const id = await encolar(empresa)
    const viejo = HACE_UNA_HORA()
    await envejecer(id, viejo)

    await queue.recordPublished(id, 'msg-otra', otra.scope)
    expect((await fila(id)).queueMessageId).toBeNull()

    await queue.recordPublished(id, 'msg-1', empresa.scope)
    const publicado = await fila(id)
    expect(publicado.queueMessageId).toBe('msg-1')
    expect(publicado.updatedAt.getTime()).toBeGreaterThan(viejo.getTime())

    await queue.claim(id, MAX_ATTEMPTS, empresa.scope)
    await queue.recordPublished(id, 'msg-2', empresa.scope)
    expect((await fila(id)).queueMessageId).toBe('msg-1')
  })
})

describe('whatsapp-send-queue-prisma — reclamo y liberación', () => {
  it('R17 — claim pasa QUEUED a SENDING sumando un intento, renueva updated_at y devuelve lo guardado', async () => {
    const empresa = await crearEmpresa()
    const id = await encolar(empresa)
    const viejo = HACE_UNA_HORA()
    await envejecer(id, viejo)

    const claimed = await queue.claim(id, MAX_ATTEMPTS, empresa.scope)

    expect(claimed).toEqual({
      id,
      connectionId: empresa.connectionId,
      contactId: empresa.contactId,
      templateName: 'pedido_despachado',
      templateLanguage: 'es',
      templateComponents: COMPONENTS,
      attempts: 1,
    })
    const row = await fila(id)
    expect(row.status).toBe('SENDING')
    expect(row.attempts).toBe(1)
    expect(row.updatedAt.getTime()).toBeGreaterThan(viejo.getTime())
  })

  it('R18 — un segundo reclamo del mismo mensaje no gana: ya no está en QUEUED', async () => {
    const empresa = await crearEmpresa()
    const id = await encolar(empresa)

    expect(await queue.claim(id, MAX_ATTEMPTS, empresa.scope)).not.toBeNull()
    expect(await queue.claim(id, MAX_ATTEMPTS, empresa.scope)).toBeNull()
    expect((await fila(id)).attempts).toBe(1)
  })

  it('R18 — cinco reclamos simultáneos del mismo mensaje: exactamente uno gana y attempts sube una vez', async () => {
    const empresa = await crearEmpresa()
    const id = await encolar(empresa)

    const results = await Promise.all(Array.from({ length: 5 }, () => queue.claim(id, MAX_ATTEMPTS, empresa.scope)))

    expect(results.filter((result) => result !== null)).toHaveLength(1)
    const row = await fila(id)
    expect(row.status).toBe('SENDING')
    expect(row.attempts).toBe(1)
  })

  it('R17, R18 — con los intentos agotados no se reclama y el mensaje sigue QUEUED', async () => {
    const empresa = await crearEmpresa()
    const id = await encolar(empresa)
    await envejecer(id, new Date(), MAX_ATTEMPTS)

    expect(await queue.claim(id, MAX_ATTEMPTS, empresa.scope)).toBeNull()
    const row = await fila(id)
    expect(row.status).toBe('QUEUED')
    expect(row.attempts).toBe(MAX_ATTEMPTS)
  })

  it('R36 — un trabajo con otra empresa no reclama, no libera ni modifica el mensaje', async () => {
    const empresa = await crearEmpresa()
    const otra = await crearEmpresa()
    const id = await encolar(empresa)

    expect(await queue.claim(id, MAX_ATTEMPTS, otra.scope)).toBeNull()
    expect(await fila(id)).toMatchObject({ status: 'QUEUED', attempts: 0 })

    await queue.claim(id, MAX_ATTEMPTS, empresa.scope)
    await queue.release(id, otra.scope)
    expect((await fila(id)).status).toBe('SENDING')
  })

  it('R33 — claim no toma un mensaje QUEUED de origen USER ni AGENT', async () => {
    const empresa = await crearEmpresa()
    const user = await mensajeDeOtroOrigen(empresa, 'USER', 'QUEUED')
    const agent = await mensajeDeOtroOrigen(empresa, 'AGENT', 'QUEUED')

    expect(await queue.claim(user, MAX_ATTEMPTS, empresa.scope)).toBeNull()
    expect(await queue.claim(agent, MAX_ATTEMPTS, empresa.scope)).toBeNull()
    expect((await fila(user)).status).toBe('QUEUED')
    expect((await fila(agent)).status).toBe('QUEUED')
  })

  it('R22 — release devuelve SENDING a QUEUED conservando attempts y renueva updated_at; no toca otro estado', async () => {
    const empresa = await crearEmpresa()
    const id = await encolar(empresa)
    await queue.claim(id, MAX_ATTEMPTS, empresa.scope)
    const viejo = HACE_UNA_HORA()
    await envejecer(id, viejo)

    await queue.release(id, empresa.scope)

    const row = await fila(id)
    expect(row.status).toBe('QUEUED')
    expect(row.attempts).toBe(1)
    expect(row.updatedAt.getTime()).toBeGreaterThan(viejo.getTime())

    await queue.release(id, empresa.scope)
    expect((await fila(id)).status).toBe('QUEUED')
  })

  it('R33 — release no toca un SENDING de origen USER', async () => {
    const empresa = await crearEmpresa()
    const user = await mensajeDeOtroOrigen(empresa, 'USER', 'SENDING', 1)

    await queue.release(user, empresa.scope)
    expect((await fila(user)).status).toBe('SENDING')
  })
})

describe('whatsapp-send-queue-prisma — consultas del barrido', () => {
  it('R29, R33, R36 — listStaleQueued solo devuelve SYSTEM QUEUED de la empresa, viejos y con intentos, hasta el límite', async () => {
    const empresa = await crearEmpresa()
    const otra = await crearEmpresa()
    const corte = new Date(Date.now() - 5 * 60 * 1000)
    const viejo = HACE_UNA_HORA()

    const primero = await encolar(empresa)
    await envejecer(primero, new Date(viejo.getTime() - 1000))
    const segundo = await encolar(empresa)
    await envejecer(segundo, viejo)
    const reciente = await encolar(empresa)
    const agotado = await encolar(empresa)
    await envejecer(agotado, viejo, MAX_ATTEMPTS)
    const enviando = await encolar(empresa)
    await queue.claim(enviando, MAX_ATTEMPTS, empresa.scope)
    await envejecer(enviando, viejo)
    const deUsuario = await mensajeDeOtroOrigen(empresa, 'USER', 'QUEUED')
    await envejecer(deUsuario, viejo)
    const deOtra = await encolar(otra)
    await envejecer(deOtra, viejo)

    const ids = await queue.listStaleQueued(corte, MAX_ATTEMPTS, 10, empresa.scope)
    expect(ids).toEqual([primero, segundo])
    expect(ids).not.toContain(reciente)

    expect(await queue.listStaleQueued(corte, MAX_ATTEMPTS, 1, empresa.scope)).toEqual([primero])
  })

  it('R31, R33, R36 — failExhausted pasa a FAILED solo los SYSTEM QUEUED que alcanzaron el tope, en su empresa', async () => {
    const empresa = await crearEmpresa()
    const otra = await crearEmpresa()
    const agotado = await encolar(empresa)
    await envejecer(agotado, new Date(), MAX_ATTEMPTS)
    const conIntentos = await encolar(empresa)
    await envejecer(conIntentos, new Date(), MAX_ATTEMPTS - 1)
    const deUsuario = await mensajeDeOtroOrigen(empresa, 'USER', 'QUEUED', MAX_ATTEMPTS)
    const delAgente = await mensajeDeOtroOrigen(empresa, 'AGENT', 'QUEUED', MAX_ATTEMPTS)
    const deOtra = await encolar(otra)
    await envejecer(deOtra, new Date(), MAX_ATTEMPTS)

    expect(await queue.failExhausted(MAX_ATTEMPTS, REASON, empresa.scope)).toBe(1)

    expect(await fila(agotado)).toMatchObject({ status: 'FAILED', errorCode: null, errorReason: REASON })
    expect((await fila(conIntentos)).status).toBe('QUEUED')
    expect((await fila(deUsuario)).status).toBe('QUEUED')
    expect((await fila(delAgente)).status).toBe('QUEUED')
    expect((await fila(deOtra)).status).toBe('QUEUED')
  })

  it('R33, R34, R36 — failStaleQueued pasa a FAILED solo los SYSTEM QUEUED viejos de su empresa', async () => {
    const empresa = await crearEmpresa()
    const otra = await crearEmpresa()
    const corte = new Date(Date.now() - 5 * 60 * 1000)
    const viejo = await encolar(empresa)
    await envejecer(viejo, HACE_UNA_HORA())
    const reciente = await encolar(empresa)
    const deUsuario = await mensajeDeOtroOrigen(empresa, 'USER', 'QUEUED')
    await envejecer(deUsuario, HACE_UNA_HORA())
    const deOtra = await encolar(otra)
    await envejecer(deOtra, HACE_UNA_HORA())

    expect(await queue.failStaleQueued(corte, REASON, empresa.scope)).toBe(1)

    expect(await fila(viejo)).toMatchObject({ status: 'FAILED', errorCode: null, errorReason: REASON })
    expect((await fila(reciente)).status).toBe('QUEUED')
    expect((await fila(deUsuario)).status).toBe('QUEUED')
    expect((await fila(deOtra)).status).toBe('QUEUED')
  })

  it('R32, R33, R36 — failStuckSending pasa a FAILED solo los SYSTEM SENDING colgados de su empresa', async () => {
    const empresa = await crearEmpresa()
    const otra = await crearEmpresa()
    const corte = new Date(Date.now() - 10 * 60 * 1000)
    const colgado = await encolar(empresa)
    await queue.claim(colgado, MAX_ATTEMPTS, empresa.scope)
    await envejecer(colgado, HACE_UNA_HORA())
    const enCurso = await encolar(empresa)
    await queue.claim(enCurso, MAX_ATTEMPTS, empresa.scope)
    const enCola = await encolar(empresa)
    await envejecer(enCola, HACE_UNA_HORA())
    const deUsuario = await mensajeDeOtroOrigen(empresa, 'USER', 'SENDING', 1)
    await envejecer(deUsuario, HACE_UNA_HORA())
    const delAgente = await mensajeDeOtroOrigen(empresa, 'AGENT', 'SENDING', 1)
    await envejecer(delAgente, HACE_UNA_HORA())
    const deOtra = await encolar(otra)
    await queue.claim(deOtra, MAX_ATTEMPTS, otra.scope)
    await envejecer(deOtra, HACE_UNA_HORA())

    expect(await queue.failStuckSending(corte, REASON, empresa.scope)).toBe(1)

    expect(await fila(colgado)).toMatchObject({ status: 'FAILED', errorCode: null, errorReason: REASON })
    expect((await fila(enCurso)).status).toBe('SENDING')
    expect((await fila(enCola)).status).toBe('QUEUED')
    expect((await fila(deUsuario)).status).toBe('SENDING')
    expect((await fila(delAgente)).status).toBe('SENDING')
    expect((await fila(deOtra)).status).toBe('SENDING')
  })
})
