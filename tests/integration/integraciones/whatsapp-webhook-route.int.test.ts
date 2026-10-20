// El webhook de WhatsApp de punta a punta contra Postgres REAL: los `GET`/`POST` exportados por la
// ruta, con la composicion real (Prisma, cifrado AES-GCM con una clave generada aqui, resumen del
// verify token y HMAC de Meta). Sin dobles: la firma se calcula en el test con `node:crypto`.
//
// Aislamiento: `commit`. La ruta guarda en su PROPIA `prisma.$transaction` sobre el cliente GLOBAL,
// asi que una transaccion del test con ROLLBACK no la envolveria. Cada caso fabrica su empresa
// efimera (tipo de documento, rol, empresa con o sin el anadido `integraciones`, usuario y conexion)
// y `afterAll` borra mensajes -> contactos -> conexiones por `company_id`, afirma contando que no
// queda nada y despues borra usuario -> rol -> tipo de documento -> empresa (sus anadidos caen en
// cascada).

import { createHmac, randomBytes, randomUUID } from 'node:crypto'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { GET, POST } from '@/lib/modules/integraciones/adapters/driving/whatsapp-webhook-route'
import { insertWhatsappConnection } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-connection-prisma'
import { secretCipherAesGcm } from '@/lib/modules/integraciones/adapters/driven/security/secret-cipher-aes-gcm'
import { digestOfSecret } from '@/lib/modules/integraciones/adapters/driven/security/secret-digest-sha256'
import {
  ACCESS_TOKEN_FIELD,
  APP_SECRET_FIELD,
  connectionSecretContext,
  UNREADABLE_SECRET_MESSAGE,
} from '@/lib/modules/integraciones/domain/connection-secrets'
import { normalizeCompanyName } from '@/lib/modules/identity'
import { prisma } from '@/lib/shared/db/prisma'
import {
  change,
  contact,
  message,
  notification,
  OTHER_SENDER,
  SENDER,
  SENDER_USER_ID,
  status,
  TIMESTAMP,
  value,
} from '../../unit/integraciones/whatsapp/whatsapp-webhook-fixtures'

import type { WhatsappConnectionStatus } from '@/lib/modules/integraciones/domain/whatsapp-connection'
import type { IntegracionesScope } from '@/lib/modules/integraciones/domain/integraciones-scope'

function token(): string {
  return randomUUID().replace(/-/gu, '')
}

const ENCRYPTION_VARS = ['INTEGRATIONS_ENCRYPTION_KEYS', 'INTEGRATIONS_ENCRYPTION_ACTIVE'] as const
const savedEnv: Record<string, string | undefined> = {}
const CLAVE_DE_LA_CORRIDA = `v1:${randomBytes(32).toString('base64')}`

beforeAll(() => {
  for (const name of ENCRYPTION_VARS) savedEnv[name] = process.env[name]
  process.env.INTEGRATIONS_ENCRYPTION_KEYS = CLAVE_DE_LA_CORRIDA
  process.env.INTEGRATIONS_ENCRYPTION_ACTIVE = 'v1'
})

beforeEach(() => {
  // La ruta registra cada rechazo; aqui solo importa la respuesta y la base.
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

type Empresa = {
  readonly companyId: string
  readonly userId: string
  readonly roleId: string
  readonly documentTypeCode: string
}

type Conexion = {
  readonly empresa: Empresa
  readonly id: string
  readonly phoneNumberId: string
  readonly appSecret: string
  readonly verifyToken: string
  readonly scope: IntegracionesScope
}

const empresas: Empresa[] = []

async function crearEmpresa(conIntegraciones: boolean): Promise<Empresa> {
  const marker = token()
  const documentType = await prisma.documentType.create({
    data: { code: `DOC${marker.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  })
  const role = await prisma.role.create({
    data: { name: `rol-${marker}`, description: 'Rol de prueba' },
    select: { id: true },
  })
  const companyName = `Empresa webhook ${marker}`
  const company = await prisma.company.create({
    data: {
      name: companyName,
      nameNormalized: normalizeCompanyName(companyName),
      addonOverrides: { create: [{ addonKey: 'integraciones', enabled: conIntegraciones }] },
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
  const empresa: Empresa = {
    companyId: company.id,
    userId: user.id,
    roleId: role.id,
    documentTypeCode: documentType.code,
  }
  empresas.push(empresa)
  return empresa
}

/** Cifra con la clave `v1` dada y devuelve el entorno a la clave de la corrida. */
async function cifrar(plaintext: string, context: ReturnType<typeof connectionSecretContext>, clave: string) {
  process.env.INTEGRATIONS_ENCRYPTION_KEYS = clave
  try {
    return await secretCipherAesGcm.encrypt(plaintext, context)
  } finally {
    process.env.INTEGRATIONS_ENCRYPTION_KEYS = CLAVE_DE_LA_CORRIDA
  }
}

type OpcionesDeConexion = {
  readonly estado?: WhatsappConnectionStatus
  readonly conIntegraciones?: boolean
  /** Cifra el App Secret con otra clave `v1`: la de la corrida no lo puede leer. */
  readonly secretoIlegible?: boolean
}

async function crearConexion(opciones: OpcionesDeConexion = {}): Promise<Conexion> {
  const empresa = await crearEmpresa(opciones.conIntegraciones ?? true)
  const scope: IntegracionesScope = { companyId: empresa.companyId }
  const id = randomUUID()
  const phoneNumberId = `phone-${token()}`
  const appSecret = `app-secret-${token()}`
  const verifyToken = `verify-${token()}`
  const claveDelSecreto =
    opciones.secretoIlegible === true ? `v1:${randomBytes(32).toString('base64')}` : CLAVE_DE_LA_CORRIDA
  await insertWhatsappConnection(
    {
      id,
      origin: 'MANUAL',
      displayName: 'Ventas',
      wabaId: `waba-${token()}`,
      phoneNumberId,
      displayPhoneNumber: '+57 300 1234567',
      verifiedName: 'Empresa Verificada',
      accessTokenEnc: await cifrar(
        `access-${token()}`,
        connectionSecretContext(id, ACCESS_TOKEN_FIELD, scope),
        CLAVE_DE_LA_CORRIDA,
      ),
      appSecretEnc: await cifrar(appSecret, connectionSecretContext(id, APP_SECRET_FIELD, scope), claveDelSecreto),
      verifyTokenHash: digestOfSecret(verifyToken),
      status: opciones.estado ?? 'ACTIVE',
      lastError: null,
      lastCheckedAt: new Date('2026-10-09T12:00:00.000Z'),
      createdById: empresa.userId,
    },
    scope,
  )
  return { empresa, id, phoneNumberId, appSecret, verifyToken, scope }
}

afterAll(async () => {
  for (const name of ENCRYPTION_VARS) {
    if (savedEnv[name] === undefined) delete process.env[name]
    else process.env[name] = savedEnv[name]
  }
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

// --- La peticion de Meta -------------------------------------------------------------------------

const BASE = 'https://app.quimicloude.test/api/integraciones/whatsapp/webhook'

function contexto(conexionId: string) {
  return { params: Promise.resolve({ conexionId }) }
}

function handshake(conexionId: string, query: Record<string, string>): Promise<Response> {
  const url = new URL(`${BASE}/${conexionId}`)
  for (const [name, val] of Object.entries(query)) url.searchParams.set(name, val)
  return GET(new Request(url, { method: 'GET' }), contexto(conexionId))
}

function firmaDe(rawBody: Uint8Array, appSecret: string): string {
  return `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`
}

/** `firma` ausente ⇒ se firma con el App Secret de la conexion; `null` ⇒ sin cabecera. */
function entrega(conexion: Conexion, cuerpo: unknown, firma?: string | null): Promise<Response> {
  const rawBody = new TextEncoder().encode(JSON.stringify(cuerpo))
  const headers = new Headers({ 'content-type': 'application/json' })
  const signature = firma === undefined ? firmaDe(rawBody, conexion.appSecret) : firma
  if (signature !== null) headers.set('x-hub-signature-256', signature)
  return POST(
    new Request(`${BASE}/${conexion.id}`, { method: 'POST', headers, body: rawBody }),
    contexto(conexion.id),
  )
}

function wamidUnico(): string {
  return `wamid.ruta-${token()}`
}

function texto(body: string, overrides: Record<string, unknown> = {}) {
  return message('text', { text: { body } }, { id: wamidUnico(), ...overrides })
}

/** Un `value` de mensajes dirigido al numero de la conexion. */
function mensajes(conexion: Conexion, messages: unknown[], contacts: unknown[] = [contact()]) {
  return notification(
    change(value({ phoneNumberId: conexion.phoneNumberId, contacts: contacts as never, messages: messages as never })),
  )
}

const INSTANTE_DE_META = new Date(Number(TIMESTAMP) * 1000)

async function filaDeConexion(id: string) {
  return prisma.whatsappConnection.findUniqueOrThrow({ where: { id } })
}

async function conteos(empresa: Empresa) {
  const where = { where: { companyId: empresa.companyId } }
  return {
    contactos: await prisma.whatsappContact.count(where),
    mensajes: await prisma.whatsappMessage.count(where),
  }
}

async function respuestaVacia(response: Response): Promise<string> {
  return response.text()
}

// --- GET: el handshake ---------------------------------------------------------------------------

describe('GET — verificacion del webhook', () => {
  it('R5 R6: el handshake correcto responde el challenge en text/plain, deja ACTIVE una PENDING y pone lastWebhookAt', async () => {
    const conexion = await crearConexion({ estado: 'PENDING' })
    const challenge = 'challenge-1158201444'
    const antes = new Date()

    const response = await handshake(conexion.id, {
      'hub.mode': 'subscribe',
      'hub.verify_token': conexion.verifyToken,
      'hub.challenge': challenge,
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(await response.text()).toBe(challenge)
    const fila = await filaDeConexion(conexion.id)
    expect(fila.status).toBe('ACTIVE')
    expect(fila.lastWebhookAt).not.toBeNull()
    expect(fila.lastWebhookAt!.getTime()).toBeGreaterThanOrEqual(antes.getTime())
    expect(fila.lastWebhookAt!.getTime()).toBeLessThanOrEqual(Date.now())
  })

  it('R6: una conexion en ERROR sigue en ERROR con lastWebhookAt puesto; una ACTIVE sigue ACTIVE', async () => {
    const enError = await crearConexion({ estado: 'ERROR' })
    const activa = await crearConexion({ estado: 'ACTIVE' })

    for (const conexion of [enError, activa]) {
      const response = await handshake(conexion.id, {
        'hub.mode': 'subscribe',
        'hub.verify_token': conexion.verifyToken,
        'hub.challenge': 'reto',
      })
      expect(response.status).toBe(200)
    }

    const filaError = await filaDeConexion(enError.id)
    expect(filaError.status).toBe('ERROR')
    expect(filaError.lastWebhookAt).not.toBeNull()
    const filaActiva = await filaDeConexion(activa.id)
    expect(filaActiva.status).toBe('ACTIVE')
    expect(filaActiva.lastWebhookAt).not.toBeNull()
  })

  it('R7 R8: token malo, modo distinto, sin challenge o solo las variantes hub_* ⇒ 403 sin cuerpo y la fila no cambia', async () => {
    const conexion = await crearConexion({ estado: 'PENDING' })
    const antes = await filaDeConexion(conexion.id)

    const consultas: Record<string, string>[] = [
      { 'hub.mode': 'subscribe', 'hub.verify_token': 'otro-token', 'hub.challenge': 'reto' },
      { 'hub.mode': 'unsubscribe', 'hub.verify_token': conexion.verifyToken, 'hub.challenge': 'reto' },
      { 'hub.mode': 'subscribe', 'hub.verify_token': conexion.verifyToken },
      { hub_mode: 'subscribe', hub_verify_token: conexion.verifyToken, hub_challenge: 'reto' },
    ]
    for (const query of consultas) {
      const response = await handshake(conexion.id, query)
      expect(response.status, JSON.stringify(Object.keys(query))).toBe(403)
      expect(await respuestaVacia(response)).toBe('')
    }

    expect(await filaDeConexion(conexion.id)).toEqual(antes)
  })

  it('R7: una conexion DISABLED o inexistente ⇒ 403 con el token correcto, y la DISABLED no cambia', async () => {
    const deshabilitada = await crearConexion({ estado: 'DISABLED' })
    const antes = await filaDeConexion(deshabilitada.id)

    const response = await handshake(deshabilitada.id, {
      'hub.mode': 'subscribe',
      'hub.verify_token': deshabilitada.verifyToken,
      'hub.challenge': 'reto',
    })
    expect(response.status).toBe(403)
    expect(await filaDeConexion(deshabilitada.id)).toEqual(antes)

    for (const id of [randomUUID(), 'no-es-un-uuid']) {
      const inexistente = await handshake(id, {
        'hub.mode': 'subscribe',
        'hub.verify_token': deshabilitada.verifyToken,
        'hub.challenge': 'reto',
      })
      expect(inexistente.status).toBe(403)
    }
  })

  it('R4: con el anadido integraciones apagado el handshake correcto responde 403 y la PENDING no se activa', async () => {
    const conexion = await crearConexion({ estado: 'PENDING', conIntegraciones: false })
    const antes = await filaDeConexion(conexion.id)

    const response = await handshake(conexion.id, {
      'hub.mode': 'subscribe',
      'hub.verify_token': conexion.verifyToken,
      'hub.challenge': 'reto',
    })

    expect(response.status).toBe(403)
    expect(await filaDeConexion(conexion.id)).toEqual(antes)
  })
})

// --- POST: entrada -------------------------------------------------------------------------------

describe('POST — entrada', () => {
  it('R9: una conexion inexistente, sin forma de UUID o DISABLED ⇒ 200 sin cuerpo y nada escrito', async () => {
    const deshabilitada = await crearConexion({ estado: 'DISABLED' })
    const antes = await filaDeConexion(deshabilitada.id)
    const cuerpo = mensajes(deshabilitada, [texto('hola')])

    const response = await entrega(deshabilitada, cuerpo)
    expect(response.status).toBe(200)
    expect(await respuestaVacia(response)).toBe('')
    expect(await conteos(deshabilitada.empresa)).toEqual({ contactos: 0, mensajes: 0 })
    expect(await filaDeConexion(deshabilitada.id)).toEqual(antes)

    for (const id of [randomUUID(), 'no-es-un-uuid']) {
      const ajena = { ...deshabilitada, id }
      expect((await entrega(ajena, cuerpo)).status).toBe(200)
    }
  })

  it('R4: con el anadido integraciones apagado un POST firmado responde 200 y no guarda nada', async () => {
    const conexion = await crearConexion({ conIntegraciones: false })
    const antes = await filaDeConexion(conexion.id)

    const response = await entrega(conexion, mensajes(conexion, [texto('hola')]))

    expect(response.status).toBe(200)
    expect(await conteos(conexion.empresa)).toEqual({ contactos: 0, mensajes: 0 })
    expect(await filaDeConexion(conexion.id)).toEqual(antes)
  })

  it('R11: firma mala, firma de otro secreto, cabecera mal formada o ausente ⇒ 401 sin cuerpo, cero filas y lastWebhookAt igual', async () => {
    const conexion = await crearConexion()
    const antes = await filaDeConexion(conexion.id)
    const cuerpo = mensajes(conexion, [texto('hola')])
    const rawBody = new TextEncoder().encode(JSON.stringify(cuerpo))

    const firmas: (string | null)[] = [
      firmaDe(rawBody, 'otro-app-secret'),
      firmaDe(new TextEncoder().encode(JSON.stringify({ ...cuerpo, extra: 1 })), conexion.appSecret),
      firmaDe(rawBody, conexion.appSecret).replace('sha256=', ''),
      `sha256=${'a'.repeat(63)}`,
      null,
    ]
    for (const firma of firmas) {
      const response = await entrega(conexion, cuerpo, firma)
      expect(response.status).toBe(401)
      expect(await respuestaVacia(response)).toBe('')
    }

    expect(await conteos(conexion.empresa)).toEqual({ contactos: 0, mensajes: 0 })
    expect(await filaDeConexion(conexion.id)).toEqual(antes)
  })

  it('R12: un App Secret cifrado con otra clave ⇒ 500, ningun mensaje y la conexion en ERROR pidiendo las credenciales', async () => {
    const conexion = await crearConexion({ secretoIlegible: true })

    const response = await entrega(conexion, mensajes(conexion, [texto('hola')]))

    expect(response.status).toBe(500)
    expect(await respuestaVacia(response)).toBe('')
    expect(await conteos(conexion.empresa)).toEqual({ contactos: 0, mensajes: 0 })
    const fila = await filaDeConexion(conexion.id)
    expect(fila.status).toBe('ERROR')
    expect(fila.lastError).toBe(UNREADABLE_SECRET_MESSAGE)
    expect(fila.lastWebhookAt).toBeNull()
  })
})

// --- POST: lo que se guarda ----------------------------------------------------------------------

describe('POST — guardado', () => {
  it('R16 R17 R24: un texto firmado crea contacto y mensaje IN/RECEIVED, responde 200 vacio y solo toca lastWebhookAt', async () => {
    const conexion = await crearConexion({ estado: 'PENDING' })
    const mensaje = texto('hola, texto de prueba')
    const antes = new Date()

    const response = await entrega(conexion, mensajes(conexion, [mensaje], [contact(SENDER, 'Cliente de Prueba')]))

    expect(response.status).toBe(200)
    expect(await respuestaVacia(response)).toBe('')
    const contacto = await prisma.whatsappContact.findUniqueOrThrow({
      where: { connectionId_waId: { connectionId: conexion.id, waId: SENDER } },
    })
    expect(contacto).toMatchObject({
      companyId: conexion.empresa.companyId,
      profileName: 'Cliente de Prueba',
      customerId: null,
      lastInboundAt: INSTANTE_DE_META,
      lastMessageAt: INSTANTE_DE_META,
    })
    const fila = await prisma.whatsappMessage.findUniqueOrThrow({ where: { wamid: mensaje.id as string } })
    expect(fila).toMatchObject({
      companyId: conexion.empresa.companyId,
      connectionId: conexion.id,
      contactId: contacto.id,
      direction: 'IN',
      status: 'RECEIVED',
      type: 'TEXT',
      body: 'hola, texto de prueba',
      payload: { from: SENDER },
      metaTimestamp: INSTANTE_DE_META,
      origin: null,
      sentById: null,
      templateName: null,
      attempts: 0,
      queueMessageId: null,
      errorCode: null,
      errorReason: null,
    })
    const conexionDespues = await filaDeConexion(conexion.id)
    expect(conexionDespues.status).toBe('PENDING')
    expect(conexionDespues.lastWebhookAt!.getTime()).toBeGreaterThanOrEqual(antes.getTime())
  })

  it('R16: con un solo contacto cuyo wa_id difiere de from manda contacts[].wa_id, y from queda en el payload', async () => {
    const conexion = await crearConexion()
    const mensaje = texto('remitente por wa_id')

    expect((await entrega(conexion, mensajes(conexion, [mensaje], [contact(SENDER_USER_ID, 'Perfil')]))).status).toBe(200)

    const contactos = await prisma.whatsappContact.findMany({ where: { companyId: conexion.empresa.companyId } })
    expect(contactos.map((c) => ({ waId: c.waId, profileName: c.profileName }))).toEqual([
      { waId: SENDER_USER_ID, profileName: 'Perfil' },
    ])
    const fila = await prisma.whatsappMessage.findUniqueOrThrow({ where: { wamid: mensaje.id as string } })
    expect(fila.contactId).toBe(contactos[0]?.id)
    expect(fila.payload).toEqual({ from: SENDER })
  })

  it('R16: con varios contactos o ninguno manda from de cada mensaje', async () => {
    const varios = await crearConexion()
    const deUno = texto('de uno')
    const deOtro = texto('de otro', { from: OTHER_SENDER })
    const cuerpoVarios = mensajes(varios, [deUno, deOtro], [contact(SENDER, 'Uno'), contact(OTHER_SENDER, 'Otro')])
    expect((await entrega(varios, cuerpoVarios)).status).toBe(200)

    const contactosVarios = await prisma.whatsappContact.findMany({
      where: { companyId: varios.empresa.companyId },
      orderBy: { waId: 'asc' },
    })
    expect(contactosVarios.map((c) => ({ waId: c.waId, profileName: c.profileName }))).toEqual([
      { waId: SENDER, profileName: 'Uno' },
      { waId: OTHER_SENDER, profileName: 'Otro' },
    ])

    const ninguno = await crearConexion()
    const sinContactos = texto('sin contacts')
    expect((await entrega(ninguno, mensajes(ninguno, [sinContactos], []))).status).toBe(200)
    const contactosNinguno = await prisma.whatsappContact.findMany({ where: { companyId: ninguno.empresa.companyId } })
    expect(contactosNinguno.map((c) => ({ waId: c.waId, profileName: c.profileName }))).toEqual([
      { waId: SENDER, profileName: null },
    ])
  })

  it('R17: una imagen se guarda como IMAGE con la metadata del adjunto y su caption en body', async () => {
    const conexion = await crearConexion()
    const imagen = message(
      'image',
      { image: { id: 'media-1', mime_type: 'image/jpeg', sha256: 'abc', caption: 'foto de prueba' } },
      { id: wamidUnico() },
    )

    expect((await entrega(conexion, mensajes(conexion, [imagen]))).status).toBe(200)

    const fila = await prisma.whatsappMessage.findUniqueOrThrow({ where: { wamid: imagen.id as string } })
    expect(fila).toMatchObject({
      direction: 'IN',
      status: 'RECEIVED',
      type: 'IMAGE',
      body: 'foto de prueba',
      payload: { from: SENDER, media_id: 'media-1', mime_type: 'image/jpeg', caption: 'foto de prueba' },
    })
  })

  it('R20: un tipo desconocido se guarda UNSUPPORTED, body nulo y el mensaje entero en payload, con 200', async () => {
    const conexion = await crearConexion()
    const raro = message('order_v9', { order_v9: { catalog_id: 'cat-1' } }, { id: wamidUnico() })

    const response = await entrega(conexion, mensajes(conexion, [raro]))

    expect(response.status).toBe(200)
    const fila = await prisma.whatsappMessage.findUniqueOrThrow({ where: { wamid: raro.id as string } })
    expect(fila).toMatchObject({ type: 'UNSUPPORTED', body: null, status: 'RECEIVED', payload: raro })
  })

  it('R18 R25: el mismo POST dos veces deja una sola fila por wamid y un solo contacto, y responde 200 las dos', async () => {
    const conexion = await crearConexion()
    const mensaje = texto('original')
    const cuerpo = mensajes(conexion, [mensaje])

    expect((await entrega(conexion, cuerpo)).status).toBe(200)
    expect((await entrega(conexion, cuerpo)).status).toBe(200)
    const reescrito = mensajes(conexion, [{ ...mensaje, text: { body: 'reescrito' } }])
    expect((await entrega(conexion, reescrito)).status).toBe(200)

    expect(await conteos(conexion.empresa)).toEqual({ contactos: 1, mensajes: 1 })
    const fila = await prisma.whatsappMessage.findUniqueOrThrow({ where: { wamid: mensaje.id as string } })
    expect(fila.body).toBe('original')
  })

  it('R21: un status avanza el saliente, no retrocede, guarda el error de failed y un wamid desconocido se ignora', async () => {
    const conexion = await crearConexion()
    expect((await entrega(conexion, mensajes(conexion, [texto('primero')]))).status).toBe(200)
    const contacto = await prisma.whatsappContact.findFirstOrThrow({ where: { companyId: conexion.empresa.companyId } })
    const sembrar = async (wamid: string) =>
      prisma.whatsappMessage.create({
        data: {
          companyId: conexion.empresa.companyId,
          connectionId: conexion.id,
          contactId: contacto.id,
          direction: 'OUT',
          wamid,
          type: 'TEXT',
          body: 'saliente de prueba',
          status: 'SENT',
        },
      })
    const leido = wamidUnico()
    const fallido = wamidUnico()
    await sembrar(leido)
    await sembrar(fallido)
    const statusesDe = (statuses: unknown[]) =>
      notification(change(value({ phoneNumberId: conexion.phoneNumberId, statuses: statuses as never })))

    const avance = statusesDe([
      status(leido, 'read'),
      status(fallido, 'failed', { errors: [{ code: 131026, title: 'Mensaje no entregable' }] }),
      status(wamidUnico(), 'delivered'),
    ])
    expect((await entrega(conexion, avance)).status).toBe(200)
    expect((await entrega(conexion, statusesDe([status(leido, 'delivered'), status(fallido, 'read')]))).status).toBe(
      200,
    )

    const estados = await prisma.whatsappMessage.findMany({
      where: { wamid: { in: [leido, fallido] } },
      select: { wamid: true, status: true, errorCode: true, errorReason: true },
    })
    expect(new Map(estados.map((e) => [e.wamid, { ...e, wamid: undefined }]))).toEqual(
      new Map([
        [leido, { wamid: undefined, status: 'READ', errorCode: null, errorReason: null }],
        [fallido, { wamid: undefined, status: 'FAILED', errorCode: '131026', errorReason: 'Mensaje no entregable' }],
      ]),
    )
    expect(await conteos(conexion.empresa)).toEqual({ contactos: 1, mensajes: 3 })
  })

  it('R24: un POST firmado sin nada que guardar responde 200, pone lastWebhookAt y no cambia el estado', async () => {
    const conexion = await crearConexion({ estado: 'PENDING' })
    const antes = new Date()

    const cuerpo = notification(change(value({ phoneNumberId: conexion.phoneNumberId })))
    const response = await entrega(conexion, cuerpo)

    expect(response.status).toBe(200)
    expect(await respuestaVacia(response)).toBe('')
    const fila = await filaDeConexion(conexion.id)
    expect(fila.status).toBe('PENDING')
    expect(fila.lastWebhookAt!.getTime()).toBeGreaterThanOrEqual(antes.getTime())
    expect(await conteos(conexion.empresa)).toEqual({ contactos: 0, mensajes: 0 })
  })
})

// --- POST: la transaccion que falla --------------------------------------------------------------

describe('POST — transaccion', () => {
  it('R23 R25: si la transaccion falla despues de escribir responde 500 y no queda nada; el reintento guarda una sola vez', async () => {
    const conexion = await crearConexion()
    const mensaje = texto('reintentado por Meta')
    const cuerpo = mensajes(conexion, [mensaje])
    const original = prisma.$transaction.bind(prisma)
    const escritoDentro: number[] = []

    const spy = vi.spyOn(prisma, '$transaction').mockImplementation(((arg: unknown, options?: unknown) => {
      if (typeof arg !== 'function') return original(arg as never, options as never)
      const callback = arg as (tx: unknown) => Promise<unknown>
      return original(async (tx) => {
        await callback(tx)
        escritoDentro.push(await tx.whatsappMessage.count({ where: { companyId: conexion.empresa.companyId } }))
        throw new Error('fallo forzado despues del guardado')
      }, options as never)
    }) as never)

    const fallida = await entrega(conexion, cuerpo)

    expect(fallida.status).toBe(500)
    expect(await respuestaVacia(fallida)).toBe('')
    expect(escritoDentro, 'el callback real llego a escribir antes del fallo').toEqual([1])
    expect(await conteos(conexion.empresa)).toEqual({ contactos: 0, mensajes: 0 })
    expect((await filaDeConexion(conexion.id)).lastWebhookAt).toBeNull()

    spy.mockRestore()
    expect((await entrega(conexion, cuerpo)).status).toBe(200)
    expect((await entrega(conexion, cuerpo)).status).toBe(200)

    expect(await conteos(conexion.empresa)).toEqual({ contactos: 1, mensajes: 1 })
    expect((await filaDeConexion(conexion.id)).lastWebhookAt).not.toBeNull()
  })
})
