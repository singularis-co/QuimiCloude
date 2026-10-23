// El repositorio de salida de WhatsApp (contactos y mensajes de un envio) contra Postgres REAL.
//
// Aislamiento: `commit`. El repositorio se construye sobre el cliente Prisma GLOBAL, como en
// lib/composition, y el caso de varios `ensureContact` a la vez necesita conexiones que confirmen de
// verdad contra el unico `(connection_id, wa_id)`. Cada caso fabrica su empresa efimera (tipo de
// documento, rol, empresa, usuario y conexion) y `afterAll` borra mensajes -> contactos -> conexiones
// -> clientes por `company_id`, afirma contando que no queda nada y despues borra usuario -> rol ->
// tipo de documento -> empresa.

import { randomUUID } from 'node:crypto'

import { afterAll, describe, expect, it } from 'vitest'

import { insertWhatsappConnection } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-connection-prisma'
import { createWhatsappOutboxRepository } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-outbox-prisma'
import { normalizeCompanyName } from '@/lib/modules/identity'
import { prisma } from '@/lib/shared/db/prisma'

import type { IntegracionesScope } from '@/lib/modules/integraciones/domain/integraciones-scope'
import type { NewOutboundMessage } from '@/lib/modules/integraciones/domain/whatsapp-outbound-message'

const outbox = createWhatsappOutboxRepository()

function token(): string {
  return randomUUID().replace(/-/gu, '')
}

function waId(): string {
  return `5730000${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`
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
  const companyName = `Empresa outbox ${marker}`
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

async function crearCliente(empresa: Empresa): Promise<string> {
  const customer = await prisma.customer.create({
    data: {
      firstNames: 'Luis',
      lastNames: 'Rojas',
      city: 'Bogota',
      firstNamesNormalized: 'luis',
      lastNamesNormalized: 'rojas',
      cityNormalized: 'bogota',
      companyId: empresa.companyId,
    },
    select: { id: true },
  })
  return customer.id
}

function texto(empresa: Empresa, contactId: string, body = 'Hola, tu pedido esta listo'): NewOutboundMessage {
  return {
    connectionId: empresa.connectionId,
    contactId,
    sentById: empresa.userId,
    type: 'TEXT',
    body,
    templateName: null,
    templateLanguage: null,
    payload: {},
  }
}

async function contactoNuevo(empresa: Empresa): Promise<string> {
  return (await outbox.ensureContact(empresa.connectionId, waId(), empresa.scope)).id
}

async function filaDelMensaje(id: string) {
  return prisma.whatsappMessage.findUniqueOrThrow({ where: { id } })
}

async function filaDelContacto(id: string) {
  return prisma.whatsappContact.findUniqueOrThrow({ where: { id } })
}

afterAll(async () => {
  const ids = empresas.map((empresa) => empresa.companyId)
  const enEmpresas = { where: { companyId: { in: ids } } }
  await prisma.whatsappMessage.deleteMany(enEmpresas)
  await prisma.whatsappContact.deleteMany(enEmpresas)
  await prisma.whatsappConnection.deleteMany(enEmpresas)
  await prisma.customer.deleteMany(enEmpresas)
  expect(await prisma.whatsappMessage.count(enEmpresas)).toBe(0)
  expect(await prisma.whatsappContact.count(enEmpresas)).toBe(0)
  expect(await prisma.whatsappConnection.count(enEmpresas)).toBe(0)
  expect(await prisma.customer.count(enEmpresas)).toBe(0)
  for (const empresa of empresas) {
    await prisma.user.delete({ where: { id: empresa.userId } })
    await prisma.role.delete({ where: { id: empresa.roleId } })
    await prisma.documentType.delete({ where: { code: empresa.documentTypeCode } })
    await prisma.company.delete({ where: { id: empresa.companyId } })
  }
  await prisma.$disconnect()
})

const T0 = new Date('2026-10-23T10:00:00.000Z')
const T1 = new Date('2026-10-23T11:00:00.000Z')
const T2 = new Date('2026-10-23T12:00:00.000Z')

describe('whatsapp-outbox-prisma — contactos del envio', () => {
  it('R8 — ensureContact crea el contacto con el numero, sin cliente y con la ventana cerrada, y linkContact lo vincula a mano', async () => {
    const empresa = await crearEmpresa()
    const numero = waId()
    const customerId = await crearCliente(empresa)

    const creado = await outbox.ensureContact(empresa.connectionId, numero, empresa.scope)
    expect(creado).toEqual({
      id: expect.any(String),
      waId: numero,
      customerId: null,
      customerLinkedBy: null,
      blockedAt: null,
      lastInboundAt: null,
    })

    await outbox.linkContact(creado.id, { customerId, linkedBy: empresa.userId }, empresa.scope)
    const vinculado = await outbox.findContact(creado.id, empresa.connectionId, empresa.scope)
    expect(vinculado).toMatchObject({ id: creado.id, customerId, customerLinkedBy: empresa.userId })
    expect((await filaDelContacto(creado.id)).companyId).toBe(empresa.companyId)
  })

  it('R8 — ensureContact de un numero que ya tiene contacto devuelve ese contacto y no crea otro', async () => {
    const empresa = await crearEmpresa()
    const numero = waId()
    const primero = await outbox.ensureContact(empresa.connectionId, numero, empresa.scope)
    const segundo = await outbox.ensureContact(empresa.connectionId, numero, empresa.scope)
    expect(segundo.id).toBe(primero.id)
    expect(await prisma.whatsappContact.count({ where: { connectionId: empresa.connectionId, waId: numero } })).toBe(1)
  })

  it('R8 — findContactsByWaIds devuelve los contactos de la conexion con esos numeros, y nada con una lista vacia', async () => {
    const empresa = await crearEmpresa()
    const a = waId()
    const b = waId()
    const contactoA = await outbox.ensureContact(empresa.connectionId, a, empresa.scope)
    const contactoB = await outbox.ensureContact(empresa.connectionId, b, empresa.scope)
    await outbox.ensureContact(empresa.connectionId, waId(), empresa.scope)

    const encontrados = await outbox.findContactsByWaIds(empresa.connectionId, [a, b, '5700000000000'], empresa.scope)
    expect(encontrados.map((c) => c.id).sort()).toEqual([contactoA.id, contactoB.id].sort())
    expect(await outbox.findContactsByWaIds(empresa.connectionId, [], empresa.scope)).toEqual([])
  })

  it('R11 — varios ensureContact a la vez del mismo numero nuevo dejan un solo contacto y todos devuelven ese', async () => {
    const empresa = await crearEmpresa()
    const numero = waId()

    const resultados = await Promise.all(
      Array.from({ length: 6 }, () => outbox.ensureContact(empresa.connectionId, numero, empresa.scope)),
    )

    expect(new Set(resultados.map((c) => c.id)).size).toBe(1)
    expect(await prisma.whatsappContact.count({ where: { connectionId: empresa.connectionId, waId: numero } })).toBe(1)
  })

  it('R32 — touchContact mueve lastMessageAt solo hacia delante y no toca lastInboundAt', async () => {
    const empresa = await crearEmpresa()
    const contactId = await contactoNuevo(empresa)

    await outbox.touchContact(contactId, T1, empresa.scope)
    expect((await filaDelContacto(contactId)).lastMessageAt).toEqual(T1)

    await outbox.touchContact(contactId, T0, empresa.scope)
    expect((await filaDelContacto(contactId)).lastMessageAt).toEqual(T1)

    await outbox.touchContact(contactId, T2, empresa.scope)
    const fila = await filaDelContacto(contactId)
    expect(fila.lastMessageAt).toEqual(T2)
    expect(fila.lastInboundAt).toBeNull()
  })

  it('R32 — touchContact conserva el lastInboundAt que ya tenia el contacto', async () => {
    const empresa = await crearEmpresa()
    const contactId = await contactoNuevo(empresa)
    await prisma.whatsappContact.update({ where: { id: contactId }, data: { lastInboundAt: T0, lastMessageAt: T0 } })

    await outbox.touchContact(contactId, T1, empresa.scope)
    const fila = await filaDelContacto(contactId)
    expect(fila.lastInboundAt).toEqual(T0)
    expect(fila.lastMessageAt).toEqual(T1)
  })
})

describe('whatsapp-outbox-prisma — el mensaje saliente', () => {
  it('R26, R27 — insertSending de un texto guarda OUT, SENDING, USER, el actor, un intento, el contacto y la conexion, sin hora de Meta y con payload vacio', async () => {
    const empresa = await crearEmpresa()
    const contactId = await contactoNuevo(empresa)

    const record = await outbox.insertSending(texto(empresa, contactId), empresa.scope)
    expect(record).toEqual({
      id: expect.any(String),
      connectionId: empresa.connectionId,
      contactId,
      sentById: empresa.userId,
      type: 'TEXT',
      body: 'Hola, tu pedido esta listo',
      templateName: null,
      templateLanguage: null,
      payload: {},
      status: 'SENDING',
      direction: 'OUT',
      origin: 'USER',
      errorCode: null,
      errorReason: null,
      createdAt: expect.any(Date),
    })

    const fila = await filaDelMensaje(record.id)
    expect(fila).toMatchObject({
      companyId: empresa.companyId,
      direction: 'OUT',
      status: 'SENDING',
      origin: 'USER',
      attempts: 1,
      metaTimestamp: null,
      wamid: null,
      payload: {},
    })
  })

  it('R28 — insertSending de una plantilla guarda el texto final, el nombre, el idioma y los valores por clave', async () => {
    const empresa = await crearEmpresa()
    const contactId = await contactoNuevo(empresa)
    const payload = { 'cliente.nombre': 'Luis', numero_de_guia: 'G-123' }

    const record = await outbox.insertSending(
      {
        ...texto(empresa, contactId, 'Hola Luis, tu guia es G-123'),
        type: 'TEMPLATE',
        templateName: 'aviso_envio',
        templateLanguage: 'es_MX',
        payload,
      },
      empresa.scope,
    )

    expect(record).toMatchObject({
      type: 'TEMPLATE',
      body: 'Hola Luis, tu guia es G-123',
      templateName: 'aviso_envio',
      templateLanguage: 'es_MX',
      payload,
    })
    const fila = await filaDelMensaje(record.id)
    expect(fila).toMatchObject({ type: 'TEMPLATE', templateName: 'aviso_envio', templateLanguage: 'es_MX', payload })
  })

  it('R30 — markSent guarda el wamid y pasa a SENT desde SENDING; un segundo markSent ya no cambia nada', async () => {
    const empresa = await crearEmpresa()
    const contactId = await contactoNuevo(empresa)
    const { id } = await outbox.insertSending(texto(empresa, contactId), empresa.scope)
    const wamid = `wamid.${token()}`

    const enviado = await outbox.markSent(id, wamid, empresa.scope)
    expect(enviado).toMatchObject({ id, status: 'SENT', errorCode: null, errorReason: null })
    expect(await filaDelMensaje(id)).toMatchObject({ status: 'SENT', wamid })

    expect(await outbox.markSent(id, `wamid.${token()}`, empresa.scope)).toBeNull()
    expect(await filaDelMensaje(id)).toMatchObject({ status: 'SENT', wamid })
  })

  it('R30 — markSent no hace retroceder un mensaje que ya movio un status de Meta', async () => {
    const empresa = await crearEmpresa()
    const contactId = await contactoNuevo(empresa)
    const { id } = await outbox.insertSending(texto(empresa, contactId), empresa.scope)
    await prisma.whatsappMessage.update({ where: { id }, data: { status: 'DELIVERED' } })

    expect(await outbox.markSent(id, `wamid.${token()}`, empresa.scope)).toBeNull()
    expect(await filaDelMensaje(id)).toMatchObject({ status: 'DELIVERED', wamid: null })
  })

  it('R31 — markFailed pasa a FAILED con el codigo y el motivo desde SENDING, y admite el codigo nulo', async () => {
    const empresa = await crearEmpresa()
    const contactId = await contactoNuevo(empresa)
    const conCodigo = await outbox.insertSending(texto(empresa, contactId), empresa.scope)
    const sinCodigo = await outbox.insertSending(texto(empresa, contactId), empresa.scope)

    const fallido = await outbox.markFailed(conCodigo.id, '131047', 'Pasaron mas de 24 horas', empresa.scope)
    expect(fallido).toMatchObject({ id: conCodigo.id, status: 'FAILED', errorCode: '131047', errorReason: 'Pasaron mas de 24 horas' })

    const sinRespuesta = await outbox.markFailed(sinCodigo.id, null, 'No se pudo contactar con Meta', empresa.scope)
    expect(sinRespuesta).toMatchObject({ status: 'FAILED', errorCode: null, errorReason: 'No se pudo contactar con Meta' })
    expect(await filaDelMensaje(sinCodigo.id)).toMatchObject({ status: 'FAILED', errorCode: null })
  })

  it('R31 — markFailed no toca un mensaje que ya no esta en SENDING', async () => {
    const empresa = await crearEmpresa()
    const contactId = await contactoNuevo(empresa)
    const { id } = await outbox.insertSending(texto(empresa, contactId), empresa.scope)
    const wamid = `wamid.${token()}`
    await outbox.markSent(id, wamid, empresa.scope)

    expect(await outbox.markFailed(id, '131026', 'No se entrego', empresa.scope)).toBeNull()
    expect(await filaDelMensaje(id)).toMatchObject({ status: 'SENT', wamid, errorCode: null, errorReason: null })
  })

  it('R31, R40 — findOutbound relee el saliente, y tambien devuelve un entrante de la empresa con su direccion', async () => {
    const empresa = await crearEmpresa()
    const contactId = await contactoNuevo(empresa)
    const { id } = await outbox.insertSending(texto(empresa, contactId), empresa.scope)
    await outbox.markFailed(id, '190', 'Revisa el token', empresa.scope)

    expect(await outbox.findOutbound(id, empresa.scope)).toMatchObject({ id, status: 'FAILED', direction: 'OUT', origin: 'USER' })

    const entrante = await prisma.whatsappMessage.create({
      data: {
        companyId: empresa.companyId,
        connectionId: empresa.connectionId,
        contactId,
        direction: 'IN',
        status: 'RECEIVED',
        type: 'TEXT',
        body: 'Hola',
        wamid: `wamid.${token()}`,
      },
      select: { id: true },
    })
    expect(await outbox.findOutbound(entrante.id, empresa.scope)).toMatchObject({
      id: entrante.id,
      direction: 'IN',
      status: 'RECEIVED',
      origin: null,
      sentById: null,
    })
  })
})

describe('whatsapp-outbox-prisma — ambito de empresa', () => {
  it('R43 — un contacto de otra empresa, o de otra conexion, no existe para findContact ni findContactsByWaIds', async () => {
    const duena = await crearEmpresa()
    const otra = await crearEmpresa()
    const numero = waId()
    const contacto = await outbox.ensureContact(duena.connectionId, numero, duena.scope)

    expect(await outbox.findContact(contacto.id, duena.connectionId, otra.scope)).toBeNull()
    expect(await outbox.findContact(contacto.id, otra.connectionId, otra.scope)).toBeNull()
    expect(await outbox.findContact(contacto.id, otra.connectionId, duena.scope)).toBeNull()
    expect(await outbox.findContactsByWaIds(duena.connectionId, [numero], otra.scope)).toEqual([])
    expect(await outbox.findContactsByWaIds(otra.connectionId, [numero], duena.scope)).toEqual([])
  })

  it('R43 — linkContact y touchContact con el ambito de otra empresa no cambian el contacto', async () => {
    const duena = await crearEmpresa()
    const otra = await crearEmpresa()
    const contactId = await contactoNuevo(duena)
    const clienteDeOtra = await crearCliente(otra)

    await outbox.linkContact(contactId, { customerId: clienteDeOtra, linkedBy: otra.userId }, otra.scope)
    await outbox.touchContact(contactId, T2, otra.scope)

    const fila = await filaDelContacto(contactId)
    expect(fila).toMatchObject({ customerId: null, customerLinkedBy: null, lastMessageAt: null })
  })

  it('R43 — un mensaje de otra empresa no existe para findOutbound, markSent ni markFailed', async () => {
    const duena = await crearEmpresa()
    const otra = await crearEmpresa()
    const contactId = await contactoNuevo(duena)
    const { id } = await outbox.insertSending(texto(duena, contactId), duena.scope)

    expect(await outbox.findOutbound(id, otra.scope)).toBeNull()
    expect(await outbox.markSent(id, `wamid.${token()}`, otra.scope)).toBeNull()
    expect(await outbox.markFailed(id, '190', 'Revisa el token', otra.scope)).toBeNull()
    expect(await filaDelMensaje(id)).toMatchObject({ status: 'SENDING', wamid: null, errorCode: null })
  })

  it('R43 — la base rechaza insertSending sobre el contacto o la conexion de otra empresa, y ensureContact sobre su conexion', async () => {
    const duena = await crearEmpresa()
    const otra = await crearEmpresa()
    const contactId = await contactoNuevo(duena)

    await expect(outbox.insertSending({ ...texto(otra, contactId) }, otra.scope)).rejects.toThrow()
    await expect(outbox.insertSending(texto(duena, contactId), otra.scope)).rejects.toThrow()
    await expect(outbox.ensureContact(duena.connectionId, waId(), otra.scope)).rejects.toThrow()

    expect(await prisma.whatsappMessage.count({ where: { companyId: otra.companyId } })).toBe(0)
    expect(await prisma.whatsappContact.count({ where: { companyId: otra.companyId } })).toBe(0)
  })
})
