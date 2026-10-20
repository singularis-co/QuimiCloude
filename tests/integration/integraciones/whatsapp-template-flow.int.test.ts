// El recorrido de las plantillas de WhatsApp contra Postgres REAL (QC-242, T20, design §14.1): los
// casos de uso de la fachada `integraciones` y el `POST` de la ruta del webhook, con la composicion
// real (Prisma, cifrado AES-GCM con una clave generada aqui, HMAC de Meta) y el doble `canned` de
// Graph, que la composicion elige porque el test enciende `INTEGRATIONS_E2E_DOUBLES`. La firma se
// calcula en el test con `node:crypto`. `after` de `next/server` se sustituye por una cola que el
// test vacia: asi la resincronizacion que pide el webhook corre aqui, a la vista.
//
// Aislamiento: `commit`. Los casos de uso y la ruta escriben con el cliente Prisma GLOBAL (y la
// ruta abre su PROPIA `prisma.$transaction`), asi que una transaccion del test con ROLLBACK no los
// envolveria. Cada caso fabrica su empresa efimera (tipo de documento, rol, empresa con el anadido
// `integraciones`, usuario y conexion) y `afterAll` borra plantillas -> mensajes -> contactos ->
// conexiones por `company_id`, afirma contando que no queda nada y despues borra usuario -> rol ->
// tipo de documento -> empresa (sus anadidos caen en cascada).

import { createHmac, randomBytes, randomUUID } from 'node:crypto'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { integraciones } from '@/lib/composition'
import {
  resetCannedTemplates,
  whatsappGraphClientCanned,
} from '@/lib/modules/integraciones/adapters/driven/graph/whatsapp-graph-client-canned'
import { insertWhatsappConnection } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-connection-prisma'
import { POST } from '@/lib/modules/integraciones/adapters/driving/whatsapp-webhook-route'
import { secretCipherAesGcm } from '@/lib/modules/integraciones/adapters/driven/security/secret-cipher-aes-gcm'
import { digestOfSecret } from '@/lib/modules/integraciones/adapters/driven/security/secret-digest-sha256'
import {
  ACCESS_TOKEN_FIELD,
  APP_SECRET_FIELD,
  connectionSecretContext,
} from '@/lib/modules/integraciones/domain/connection-secrets'
import { normalizeCompanyName } from '@/lib/modules/identity'
import { prisma } from '@/lib/shared/db/prisma'

import type { Actor } from '@/lib/modules/integraciones/domain/actor'
import type { IntegracionesScope } from '@/lib/modules/integraciones/domain/integraciones-scope'

// `after` encola en vez de esperar al final de la peticion: el test decide cuando corre.
const cola = vi.hoisted(() => [] as Array<() => Promise<unknown> | unknown>)

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (tarea: () => Promise<unknown> | unknown) => {
    cola.push(tarea)
  },
}))

async function vaciarCola(): Promise<number> {
  let corridas = 0
  for (let tarea = cola.shift(); tarea !== undefined; tarea = cola.shift()) {
    await tarea()
    corridas += 1
  }
  return corridas
}

function token(): string {
  return randomUUID().replace(/-/gu, '')
}

const VARS = ['INTEGRATIONS_ENCRYPTION_KEYS', 'INTEGRATIONS_ENCRYPTION_ACTIVE', 'INTEGRATIONS_E2E_DOUBLES'] as const
const savedEnv: Record<string, string | undefined> = {}
const CLAVE_DE_LA_CORRIDA = `v1:${randomBytes(32).toString('base64')}`

beforeAll(() => {
  for (const name of VARS) savedEnv[name] = process.env[name]
  process.env.INTEGRATIONS_ENCRYPTION_KEYS = CLAVE_DE_LA_CORRIDA
  process.env.INTEGRATIONS_ENCRYPTION_ACTIVE = 'v1'
  // La composicion elige el doble `canned` de Graph en cada llamada: sin red.
  process.env.INTEGRATIONS_E2E_DOUBLES = '1'
})

beforeEach(() => {
  cola.length = 0
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

type Conexion = {
  readonly companyId: string
  readonly userId: string
  readonly roleId: string
  readonly documentTypeCode: string
  readonly id: string
  readonly wabaId: string
  readonly appSecret: string
  readonly scope: IntegracionesScope
  readonly actor: Actor
}

const conexiones: Conexion[] = []

async function crearConexion(): Promise<Conexion> {
  const marker = token()
  const documentType = await prisma.documentType.create({
    data: { code: `DOC${marker.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  })
  const role = await prisma.role.create({
    data: { name: `rol-${marker}`, description: 'Rol de prueba' },
    select: { id: true },
  })
  const companyName = `Empresa recorrido plantillas ${marker}`
  const company = await prisma.company.create({
    data: {
      name: companyName,
      nameNormalized: normalizeCompanyName(companyName),
      addonOverrides: { create: [{ addonKey: 'integraciones', enabled: true }] },
    },
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
  const id = randomUUID()
  const wabaId = `9${String(Date.now())}${String(conexiones.length).padStart(3, '0')}`
  const appSecret = `app-secret-${token()}`
  await insertWhatsappConnection(
    {
      id,
      origin: 'MANUAL',
      displayName: 'Ventas',
      wabaId,
      phoneNumberId: `phone-${token()}`,
      displayPhoneNumber: '+57 300 1234567',
      verifiedName: 'Empresa Verificada',
      accessTokenEnc: await secretCipherAesGcm.encrypt(
        `access-${token()}`,
        connectionSecretContext(id, ACCESS_TOKEN_FIELD, scope),
      ),
      appSecretEnc: await secretCipherAesGcm.encrypt(appSecret, connectionSecretContext(id, APP_SECRET_FIELD, scope)),
      verifyTokenHash: digestOfSecret(`verify-${token()}`),
      status: 'ACTIVE',
      lastError: null,
      lastCheckedAt: new Date('2026-10-20T12:00:00.000Z'),
      createdById: user.id,
    },
    scope,
  )
  const conexion: Conexion = {
    companyId: company.id,
    userId: user.id,
    roleId: role.id,
    documentTypeCode: documentType.code,
    id,
    wabaId,
    appSecret,
    scope,
    actor: { id: user.id, companyId: company.id, permissions: ['integraciones.modificar'] },
  }
  conexiones.push(conexion)
  return conexion
}

afterAll(async () => {
  for (const name of VARS) {
    if (savedEnv[name] === undefined) delete process.env[name]
    else process.env[name] = savedEnv[name]
  }
  resetCannedTemplates()
  const ids = conexiones.map((conexion) => conexion.companyId)
  const enEmpresas = { where: { companyId: { in: ids } } }
  await prisma.whatsappTemplate.deleteMany(enEmpresas)
  await prisma.whatsappMessage.deleteMany(enEmpresas)
  await prisma.whatsappContact.deleteMany(enEmpresas)
  await prisma.whatsappConnection.deleteMany(enEmpresas)
  expect(await prisma.whatsappTemplate.count(enEmpresas)).toBe(0)
  expect(await prisma.whatsappMessage.count(enEmpresas)).toBe(0)
  expect(await prisma.whatsappContact.count(enEmpresas)).toBe(0)
  expect(await prisma.whatsappConnection.count(enEmpresas)).toBe(0)
  for (const conexion of conexiones) {
    await prisma.user.delete({ where: { id: conexion.userId } })
    await prisma.role.delete({ where: { id: conexion.roleId } })
    await prisma.documentType.delete({ where: { code: conexion.documentTypeCode } })
    await prisma.company.delete({ where: { id: conexion.companyId } })
  }
  await prisma.$disconnect()
})

// --- El borrador y la peticion de Meta -----------------------------------------------------------

function nombreUnico(): string {
  return `pedido_${token().slice(0, 12)}`
}

function borrador(name: string, language = 'es') {
  return {
    name,
    language,
    category: 'UTILITY',
    body: { text: 'Hola, su pedido ya esta listo para recoger.' },
  }
}

const BASE = 'https://app.quimicloude.test/api/integraciones/whatsapp/webhook'

/** Un aviso de plantillas: en estos cambios `entry.id` es la WABA de la conexion. */
function avisoDePlantilla(conexion: Conexion, field: string, value: Record<string, unknown>) {
  return { object: 'whatsapp_business_account', entry: [{ id: conexion.wabaId, changes: [{ field, value }] }] }
}

function cambioDeEstado(conexion: Conexion, metaTemplateId: string, event: string, reason: string | null = 'NONE') {
  return avisoDePlantilla(conexion, 'message_template_status_update', {
    event,
    message_template_id: Number(metaTemplateId),
    message_template_name: 'pedido_listo',
    message_template_language: 'es',
    reason,
  })
}

function cambioDeCategoria(conexion: Conexion, metaTemplateId: string, newCategory: string) {
  return avisoDePlantilla(conexion, 'template_category_update', {
    message_template_id: Number(metaTemplateId),
    message_template_name: 'pedido_listo',
    message_template_language: 'es',
    previous_category: 'UTILITY',
    new_category: newCategory,
  })
}

function bytesDe(cuerpo: unknown): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(JSON.stringify(cuerpo))
}

function firmaDe(rawBody: Uint8Array, appSecret: string): string {
  return `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`
}

/** El `POST` real de la ruta, firmado con el App Secret de la conexion. */
function entrega(conexion: Conexion, cuerpo: unknown): Promise<Response> {
  const rawBody = bytesDe(cuerpo)
  const headers = new Headers({
    'content-type': 'application/json',
    'x-hub-signature-256': firmaDe(rawBody, conexion.appSecret),
  })
  return POST(new Request(`${BASE}/${conexion.id}`, { method: 'POST', headers, body: rawBody }), {
    params: Promise.resolve({ conexionId: conexion.id }),
  })
}

function filaDe(id: string) {
  return prisma.whatsappTemplate.findUniqueOrThrow({ where: { id } })
}

async function crearPlantilla(conexion: Conexion, name = nombreUnico(), language = 'es') {
  const vista = await integraciones.createWhatsappTemplate(borrador(name, language), conexion.actor)
  return filaDe(vista.id)
}

/** Una plantilla que Meta tiene y la base no: se crea solo en el doble `canned`. */
async function plantillaSoloEnMeta(conexion: Conexion, name: string): Promise<string> {
  const creada = await whatsappGraphClientCanned.createTemplate({
    wabaId: conexion.wabaId,
    accessToken: 'no-se-usa-en-el-doble',
    name,
    language: 'es',
    category: 'MARKETING',
    components: [{ type: 'BODY', text: 'Creada en el Administrador de WhatsApp' }],
  })
  if (!creada.ok) throw new Error('el doble canned rechazo la plantilla')
  return creada.id
}

// --- El recorrido --------------------------------------------------------------------------------

describe('crear una plantilla', () => {
  it('R14 R17: crear con el doble canned deja una fila PENDING con el id de Meta, el creador y la conexion', async () => {
    const conexion = await crearConexion()
    const name = nombreUnico()

    const fila = await crearPlantilla(conexion, name)

    expect(fila).toMatchObject({
      companyId: conexion.companyId,
      connectionId: conexion.id,
      name,
      language: 'es',
      category: 'UTILITY',
      status: 'PENDING',
      rejectedReason: null,
      createdById: conexion.userId,
      deletedAt: null,
    })
    expect(fila.metaTemplateId).toMatch(/^[1-9]\d*$/u)
    expect(fila.lastSyncedAt).not.toBeNull()
  })
})

describe('el webhook de plantillas por la ruta firmada', () => {
  it('R36: message_template_status_update APPROVED pone la fila en APPROVED', async () => {
    const conexion = await crearConexion()
    const fila = await crearPlantilla(conexion)

    const respuesta = await entrega(conexion, cambioDeEstado(conexion, fila.metaTemplateId, 'APPROVED'))

    expect(respuesta.status).toBe(200)
    expect(await filaDe(fila.id)).toMatchObject({ status: 'APPROVED', statusRaw: null, rejectedReason: null })
    expect(cola).toHaveLength(0)
  })

  it('R36: message_template_status_update REJECTED pone REJECTED y guarda el motivo', async () => {
    const conexion = await crearConexion()
    const fila = await crearPlantilla(conexion)

    const respuesta = await entrega(
      conexion,
      cambioDeEstado(conexion, fila.metaTemplateId, 'REJECTED', 'INVALID_FORMAT'),
    )

    expect(respuesta.status).toBe(200)
    expect(await filaDe(fila.id)).toMatchObject({ status: 'REJECTED', rejectedReason: 'INVALID_FORMAT' })
    expect(cola).toHaveLength(0)
  })

  it('R37: template_category_update cambia la categoria de la fila', async () => {
    const conexion = await crearConexion()
    const fila = await crearPlantilla(conexion)
    expect(fila.category).toBe('UTILITY')

    const respuesta = await entrega(conexion, cambioDeCategoria(conexion, fila.metaTemplateId, 'MARKETING'))

    expect(respuesta.status).toBe(200)
    expect(await filaDe(fila.id)).toMatchObject({ category: 'MARKETING', status: 'PENDING' })
    expect(cola).toHaveLength(0)
  })
})

describe('un message_template_id desconocido', () => {
  it('R38: el resultado pide resincronizar y la resincronizacion importa la plantilla', async () => {
    const conexion = await crearConexion()
    const name = nombreUnico()
    const metaTemplateId = await plantillaSoloEnMeta(conexion, name)
    const rawBody = bytesDe(cambioDeEstado(conexion, metaTemplateId, 'APPROVED'))

    const resultado = await integraciones.receiveWhatsappWebhook({
      connectionId: conexion.id,
      rawBody,
      signature: firmaDe(rawBody, conexion.appSecret),
    })

    expect(resultado).toMatchObject({ kind: 'stored', followUp: 'resync_templates' })
    expect(await prisma.whatsappTemplate.count({ where: { connectionId: conexion.id, metaTemplateId } })).toBe(0)

    const resync = await integraciones.resyncWhatsappTemplates(conexion.id)

    expect(resync.kind).toBe('synced')
    const importada = await prisma.whatsappTemplate.findFirstOrThrow({
      where: { connectionId: conexion.id, metaTemplateId, deletedAt: null },
    })
    expect(importada).toMatchObject({ companyId: conexion.companyId, name, language: 'es', category: 'MARKETING' })
  })

  it('R38: por la ruta responde 200, encola una sola resincronizacion y al vaciar la cola la fila existe', async () => {
    const conexion = await crearConexion()
    const name = nombreUnico()
    const metaTemplateId = await plantillaSoloEnMeta(conexion, name)

    const respuesta = await entrega(conexion, cambioDeEstado(conexion, metaTemplateId, 'APPROVED'))

    expect(respuesta.status).toBe(200)
    expect(cola).toHaveLength(1)
    expect(await prisma.whatsappTemplate.count({ where: { connectionId: conexion.id, metaTemplateId } })).toBe(0)

    expect(await vaciarCola()).toBe(1)

    const importada = await prisma.whatsappTemplate.findFirstOrThrow({
      where: { connectionId: conexion.id, metaTemplateId, deletedAt: null },
    })
    expect(importada).toMatchObject({ companyId: conexion.companyId, name, language: 'es' })
  })
})

describe('eliminar una plantilla', () => {
  it('R42: eliminar el idioma es no toca el idioma en del mismo nombre', async () => {
    const conexion = await crearConexion()
    const name = nombreUnico()
    const enEspanol = await crearPlantilla(conexion, name, 'es')
    const enIngles = await crearPlantilla(conexion, name, 'en')
    expect(enEspanol.metaTemplateId).not.toBe(enIngles.metaTemplateId)

    const borrada = await integraciones.deleteWhatsappTemplate(enEspanol.id, conexion.actor)

    expect(borrada).toEqual({ id: enEspanol.id })
    expect((await filaDe(enEspanol.id)).deletedAt).not.toBeNull()
    expect(await filaDe(enIngles.id)).toMatchObject({ deletedAt: null, status: 'PENDING', language: 'en', name })

    // Meta (el doble) tampoco perdio el otro idioma: una resincronizacion no lo borra.
    const resync = await integraciones.resyncWhatsappTemplates(conexion.id)
    expect(resync.kind).toBe('synced')
    expect((await filaDe(enIngles.id)).deletedAt).toBeNull()
  })
})
