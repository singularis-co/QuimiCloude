// La consulta de conversaciones de WhatsApp de punta a punta contra Postgres REAL: las cuatro
// consultas de la fachada `integraciones` con la composicion real (Prisma, catalogo de clientes,
// directorio de personas, cifrado AES-GCM con una clave generada aqui) y, para los envios y la
// recepcion que la ficha reutiliza, el doble `canned` de Graph, que la composicion elige porque el
// test enciende `INTEGRATIONS_E2E_DOUBLES`. Sobre ese doble se pone un espia que cuenta las llamadas
// a Meta. Nunca hay red.
//
// Aislamiento: `commit`. Los casos de uso escriben con el cliente Prisma GLOBAL (marca de lectura,
// envio, alta y baja de clientes, recepcion del webhook en su propia transaccion), asi que una
// transaccion del test con ROLLBACK no los envolveria. Cada caso fabrica su empresa efimera (tipo de
// documento, rol, empresa con el anadido `integraciones`, usuario y conexion) y `afterAll` borra por
// `company_id` mensajes -> relaciones -> plantillas -> variables -> contactos -> conexiones ->
// vinculos -> numeros -> clientes, afirma contando que no queda nada y despues borra usuario -> rol
// -> tipo de documento -> empresa.

import { createHmac, randomBytes, randomUUID } from 'node:crypto'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import { clientes, integraciones } from '@/lib/composition'
import { whatsappGraphClientCanned } from '@/lib/modules/integraciones/adapters/driven/graph/whatsapp-graph-client-canned'
import { insertWhatsappConnection } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-connection-prisma'
import { secretCipherAesGcm } from '@/lib/modules/integraciones/adapters/driven/security/secret-cipher-aes-gcm'
import { digestOfSecret } from '@/lib/modules/integraciones/adapters/driven/security/secret-digest-sha256'
import {
  ACCESS_TOKEN_FIELD,
  APP_SECRET_FIELD,
  connectionSecretContext,
} from '@/lib/modules/integraciones/domain/connection-secrets'
import { normalizeCompanyName } from '@/lib/modules/identity'
import { prisma } from '@/lib/shared/db/prisma'

import { contact, messagesNotification, textMessage } from '../../unit/integraciones/whatsapp/whatsapp-webhook-fixtures'

import type { Actor } from '@/lib/modules/integraciones/domain/actor'
import type { IntegracionesScope } from '@/lib/modules/integraciones/domain/integraciones-scope'

function token(): string {
  return randomUUID().replace(/-/gu, '')
}

function digitos(n: number): string {
  return String(Math.floor(Math.random() * 10 ** n)).padStart(n, '0')
}

/** Un movil colombiano irrepetible entre corridas: su `wa_id` y su `phone_e164` son el mismo. */
function numeroColombiano(): string {
  return `57300${digitos(7)}`
}

const VARS = ['INTEGRATIONS_ENCRYPTION_KEYS', 'INTEGRATIONS_ENCRYPTION_ACTIVE', 'INTEGRATIONS_E2E_DOUBLES'] as const
const savedEnv: Record<string, string | undefined> = {}
const CLAVE_DE_LA_CORRIDA = `v1:${randomBytes(32).toString('base64')}`

const MINUTO = 60 * 1000
const HORA = 60 * MINUTO

let meta: MockInstance<typeof whatsappGraphClientCanned.sendMessage>

beforeAll(() => {
  for (const name of VARS) savedEnv[name] = process.env[name]
  process.env.INTEGRATIONS_ENCRYPTION_KEYS = CLAVE_DE_LA_CORRIDA
  process.env.INTEGRATIONS_ENCRYPTION_ACTIVE = 'v1'
  process.env.INTEGRATIONS_E2E_DOUBLES = '1'
})

beforeEach(() => {
  meta = vi.spyOn(whatsappGraphClientCanned, 'sendMessage')
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

type Empresa = {
  readonly companyId: string
  readonly userId: string
  readonly roleId: string
  readonly documentTypeCode: string
  readonly connectionId: string
  readonly phoneNumberId: string
  readonly appSecret: string
  readonly scope: IntegracionesScope
  /** Consulta y envia, como el Administrador. */
  readonly actor: Actor
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
  const companyName = `Empresa conversaciones whatsapp ${marker}`
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
  const connectionId = randomUUID()
  const phoneNumberId = `phone-${token()}`
  const appSecret = `app-secret-${token()}`
  await insertWhatsappConnection(
    {
      id: connectionId,
      origin: 'MANUAL',
      displayName: 'Ventas',
      wabaId: `waba-${token()}`,
      phoneNumberId,
      displayPhoneNumber: '+57 300 1234567',
      verifiedName: 'Empresa Verificada',
      accessTokenEnc: await secretCipherAesGcm.encrypt(
        `access-${token()}`,
        connectionSecretContext(connectionId, ACCESS_TOKEN_FIELD, scope),
      ),
      appSecretEnc: await secretCipherAesGcm.encrypt(
        appSecret,
        connectionSecretContext(connectionId, APP_SECRET_FIELD, scope),
      ),
      verifyTokenHash: digestOfSecret(`verify-${token()}`),
      status: 'ACTIVE',
      lastError: null,
      lastCheckedAt: new Date('2026-10-20T12:00:00.000Z'),
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
    phoneNumberId,
    appSecret,
    scope,
    actor: { id: user.id, companyId: company.id, permissions: ['whatsapp.consultar', 'whatsapp.enviar'] },
  }
  empresas.push(empresa)
  return empresa
}

afterAll(async () => {
  for (const name of VARS) {
    if (savedEnv[name] === undefined) delete process.env[name]
    else process.env[name] = savedEnv[name]
  }
  const enEmpresas = { where: { companyId: { in: empresas.map((empresa) => empresa.companyId) } } }
  // Las relaciones antes que plantillas y variables: sus FK son RESTRICT.
  await prisma.whatsappMessage.deleteMany(enEmpresas)
  await prisma.whatsappTemplateVariable.deleteMany(enEmpresas)
  await prisma.whatsappTemplate.deleteMany(enEmpresas)
  await prisma.whatsappVariableKey.deleteMany(enEmpresas)
  await prisma.whatsappContact.deleteMany(enEmpresas)
  await prisma.whatsappConnection.deleteMany(enEmpresas)
  await prisma.customerPhoneNumber.deleteMany(enEmpresas)
  await prisma.phoneNumber.deleteMany(enEmpresas)
  await prisma.customer.deleteMany(enEmpresas)
  expect(await prisma.whatsappMessage.count(enEmpresas)).toBe(0)
  expect(await prisma.whatsappTemplateVariable.count(enEmpresas)).toBe(0)
  expect(await prisma.whatsappTemplate.count(enEmpresas)).toBe(0)
  expect(await prisma.whatsappVariableKey.count(enEmpresas)).toBe(0)
  expect(await prisma.whatsappContact.count(enEmpresas)).toBe(0)
  expect(await prisma.whatsappConnection.count(enEmpresas)).toBe(0)
  expect(await prisma.customerPhoneNumber.count(enEmpresas)).toBe(0)
  expect(await prisma.phoneNumber.count(enEmpresas)).toBe(0)
  expect(await prisma.customer.count(enEmpresas)).toBe(0)
  for (const empresa of empresas) {
    await prisma.user.delete({ where: { id: empresa.userId } })
    await prisma.role.delete({ where: { id: empresa.roleId } })
    await prisma.documentType.delete({ where: { code: empresa.documentTypeCode } })
    await prisma.company.delete({ where: { id: empresa.companyId } })
  }
  await prisma.$disconnect()
})

// --- Siembra ------------------------------------------------------------------------------------

/** El alta va por la fachada de `clientes`: deja el telefono principal como lo deja la pantalla. */
async function alta(empresa: Empresa, numero: string | null = null): Promise<string> {
  const { id } = await clientes.createCustomer(
    {
      firstNames: `Nombre ${token()}`,
      lastNames: `Apellido ${token()}`,
      city: 'Bogota',
      phoneCountry: 'CO',
      phoneNumber: numero === null ? '' : numero.slice(2),
      email: null,
      address: null,
    },
    { id: empresa.userId, companyId: empresa.companyId, permissions: ['clientes.modificar'] },
  )
  return id
}

function baja(empresa: Empresa, customerId: string): Promise<void> {
  return clientes.deleteCustomer(customerId, {
    id: empresa.userId,
    companyId: empresa.companyId,
    permissions: ['clientes.modificar'],
  })
}

type ContactoNuevo = {
  readonly waId?: string
  readonly customerId?: string | null
  readonly lastInboundAt?: Date | null
}

async function contacto(empresa: Empresa, datos: ContactoNuevo = {}): Promise<string> {
  const { id } = await prisma.whatsappContact.create({
    data: {
      companyId: empresa.companyId,
      connectionId: empresa.connectionId,
      waId: datos.waId ?? numeroColombiano(),
      customerId: datos.customerId ?? null,
      lastInboundAt: datos.lastInboundAt ?? null,
      lastMessageAt: datos.lastInboundAt ?? null,
    },
    select: { id: true },
  })
  return id
}

/** Un entrante con su hora de Meta; devuelve su id. */
async function entrante(empresa: Empresa, contactId: string, at: Date, body = 'hola'): Promise<string> {
  const { id } = await prisma.whatsappMessage.create({
    data: {
      companyId: empresa.companyId,
      connectionId: empresa.connectionId,
      contactId,
      direction: 'IN',
      type: 'TEXT',
      body,
      status: 'RECEIVED',
      metaTimestamp: at,
    },
    select: { id: true },
  })
  return id
}

/** Un contacto vinculado a un cliente vivo con `n` entrantes, uno por minuto, el ultimo hace una hora. */
async function conversacion(
  empresa: Empresa,
  n: number,
): Promise<{ readonly contactId: string; readonly customerId: string; readonly messageIds: readonly string[] }> {
  const customerId = await alta(empresa)
  const ultimo = new Date(Date.now() - HORA)
  const contactId = await contacto(empresa, { customerId, lastInboundAt: ultimo })
  const messageIds: string[] = []
  for (let i = n - 1; i >= 0; i -= 1) {
    messageIds.push(await entrante(empresa, contactId, new Date(ultimo.getTime() - i * MINUTO), `mensaje ${n - i}`))
  }
  return { contactId, customerId, messageIds }
}

type Plantilla = { readonly id: string; readonly name: string }

/** «Hola {{1}}, su cuenta {{2}} esta lista.»: `{{1}}` es la constante `cliente.nombre` y `{{2}}` una propia. */
async function plantilla(empresa: Empresa, enabled = true): Promise<Plantilla> {
  const key = `cuenta_${token().slice(0, 10)}`
  const variable = await prisma.whatsappVariableKey.create({
    data: { companyId: empresa.companyId, key, label: 'Numero de cuenta', value: 'ACC-001' },
    select: { id: true },
  })
  const name = `aviso_${token().slice(0, 12)}`
  const template = await prisma.whatsappTemplate.create({
    data: {
      companyId: empresa.companyId,
      connectionId: empresa.connectionId,
      metaTemplateId: digitos(12),
      name,
      language: 'es_MX',
      category: 'UTILITY',
      components: [{ type: 'BODY', text: 'Hola {{1}}, su cuenta {{2}} esta lista.' }],
      status: 'APPROVED',
      mappingStatus: 'MAPPED',
      enabled,
    },
    select: { id: true },
  })
  await prisma.whatsappTemplateVariable.createMany({
    data: [
      { companyId: empresa.companyId, templateId: template.id, slot: 'body.1', systemKey: 'cliente.nombre' },
      { companyId: empresa.companyId, templateId: template.id, slot: 'body.2', variableKeyId: variable.id },
    ],
  })
  return { id: template.id, name }
}

const CONSTANTES = {
  constants: { 'cliente.nombre': 'Luis Rojas' },
  constantLabels: { 'cliente.nombre': 'Nombre del cliente' },
}

/** El webhook real firmado con el App Secret de la conexion: un texto entrante de `waId`. */
async function escribe(empresa: Empresa, waId: string, body: string): Promise<void> {
  const cuerpo = messagesNotification(
    [textMessage(body, { from: waId, id: `wamid.flujo-${token()}` })],
    [contact(waId, 'Quien escribe')],
  )
  const payload = cuerpo as { entry: { changes: { value: { metadata: { phone_number_id: string } } }[] }[] }
  const change = payload.entry[0]?.changes[0]
  if (change === undefined) throw new Error('cuerpo del webhook sin cambio')
  change.value.metadata.phone_number_id = empresa.phoneNumberId
  const rawBody = new TextEncoder().encode(JSON.stringify(cuerpo))
  const resultado = await integraciones.receiveWhatsappWebhook({
    connectionId: empresa.connectionId,
    rawBody,
    signature: `sha256=${createHmac('sha256', empresa.appSecret).update(rawBody).digest('hex')}`,
  })
  expect(resultado).toMatchObject({ kind: 'stored', counts: { messages: 1 } })
}

// --- Lecturas -----------------------------------------------------------------------------------

function mensajesDe(empresa: Empresa) {
  return prisma.whatsappMessage.findMany({ where: { companyId: empresa.companyId }, orderBy: { id: 'asc' } })
}

function contactosDe(empresa: Empresa) {
  return prisma.whatsappContact.findMany({ where: { companyId: empresa.companyId }, orderBy: { id: 'asc' } })
}

function listar(empresa: Empresa, actor: Actor = empresa.actor) {
  return integraciones.listWhatsappConversations({}, actor)
}

async function rechazo(operacion: () => Promise<unknown>): Promise<unknown> {
  return operacion().then(
    () => null,
    (error: unknown) => error,
  )
}

/** Un rechazo previo al envio: el error del catalogo, ningun mensaje nuevo y ninguna llamada a Meta. */
async function esRechazoPrevio(empresa: Empresa, envio: () => Promise<unknown>, code: string): Promise<unknown> {
  const antes = (await mensajesDe(empresa)).length
  const error = await rechazo(envio)
  expect(error).toMatchObject({ code })
  expect((await mensajesDe(empresa)).length).toBe(antes)
  expect(meta).not.toHaveBeenCalled()
  return error
}

// --- Casos ----------------------------------------------------------------------------------------

describe('Listado y no leidos', () => {
  it('R6, R14, R39, R43: el listado trae solo la conversacion con cliente vivo y mensajes, con sus no leidos', async () => {
    const A = await crearEmpresa()
    const B = await crearEmpresa()
    const buena = await conversacion(A, 3)
    // Un numero sin cliente con mensajes.
    await entrante(A, await contacto(A, { lastInboundAt: new Date(Date.now() - HORA) }), new Date(Date.now() - HORA))
    // Un cliente dado de baja con mensajes.
    const deBaja = await conversacion(A, 1)
    await baja(A, deBaja.customerId)
    // Un cliente vivo sin mensajes.
    await contacto(A, { customerId: await alta(A) })
    // Otra empresa.
    await conversacion(B, 2)

    const lista = await listar(A)

    expect(lista.connectionStatus).toBe('ACTIVE')
    expect(lista.page).toMatchObject({ total: 1, page: 1, totalPages: 1 })
    expect(lista.page.items).toHaveLength(1)
    expect(lista.page.items[0]).toMatchObject({
      contactId: buena.contactId,
      customerId: buena.customerId,
      isBlocked: false,
      unreadCount: 3,
      lastMessage: { direction: 'IN', type: 'TEXT', preview: 'mensaje 3', status: 'RECEIVED' },
    })
    expect(lista.page.items[0]?.customerName).toMatch(/^Nombre \w+ Apellido \w+$/u)
  })

  it('R14, R16, R43: marcar leido sin mensaje deja los no leidos en 0, en una sola marca compartida por la empresa', async () => {
    const A = await crearEmpresa()
    const { contactId, customerId } = await conversacion(A, 2)
    const otroUsuario: Actor = { ...A.actor, id: randomUUID() }

    expect(await integraciones.markWhatsappChatRead({ contactId }, A.actor)).toEqual({ unreadCount: 0 })

    const guardado = await prisma.whatsappContact.findUniqueOrThrow({ where: { id: contactId } })
    expect(guardado.lastReadAt).not.toBeNull()
    expect((await listar(A, otroUsuario)).page.items[0]).toMatchObject({ contactId, unreadCount: 0 })
    const chat = await integraciones.getWhatsappChat({ target: { customerId } }, otroUsuario)
    expect(chat.contact).toMatchObject({ id: contactId, unreadCount: 0 })

    // Un entrante posterior vuelve a contar, para todos.
    await entrante(A, contactId, new Date())
    expect((await listar(A)).page.items[0]).toMatchObject({ contactId, unreadCount: 1 })
  })
})

describe('Chat', () => {
  it('R43: el chat se pagina hacia atras con el cursor, de mas antiguo a mas reciente, con la ventana abierta y sin marcar leido', async () => {
    const A = await crearEmpresa()
    const { contactId, customerId, messageIds } = await conversacion(A, 5)
    const { lastInboundAt } = await prisma.whatsappContact.findUniqueOrThrow({ where: { id: contactId } })

    const primera = await integraciones.getWhatsappChat({ target: { contactId }, pageSize: 2 }, A.actor)
    expect(primera.messages.map((m) => m.id)).toEqual(messageIds.slice(3))
    expect(primera).toMatchObject({ hasMore: true, nextCursor: messageIds[3], connectionStatus: 'ACTIVE' })
    expect(primera.customer.id).toBe(customerId)
    expect(primera.window).toEqual({
      open: true,
      closesAt: new Date((lastInboundAt as Date).getTime() + 24 * HORA).toISOString(),
    })

    const segunda = await integraciones.getWhatsappChat(
      { target: { contactId }, before: primera.nextCursor, pageSize: 2 },
      A.actor,
    )
    expect(segunda.messages.map((m) => m.id)).toEqual(messageIds.slice(1, 3))
    expect(segunda.hasMore).toBe(true)

    const ultima = await integraciones.getWhatsappChat(
      { target: { contactId }, before: segunda.nextCursor, pageSize: 2 },
      A.actor,
    )
    expect(ultima.messages.map((m) => m.id)).toEqual(messageIds.slice(0, 1))
    expect(ultima).toMatchObject({ hasMore: false, nextCursor: null })

    const porCliente = await integraciones.getWhatsappChat({ target: { customerId } }, A.actor)
    expect(porCliente.contact).toMatchObject({ id: contactId, unreadCount: 5 })
    expect(porCliente.messages.map((m) => m.id)).toEqual(messageIds)
  })
})

describe('Envio desde Contactos', () => {
  it('R34, R43: el envio de texto de siempre llega al chat como saliente del usuario', async () => {
    const A = await crearEmpresa()
    const { contactId } = await conversacion(A, 1)

    const { message } = await integraciones.sendWhatsappMessage(
      { kind: 'text', recipient: { contactId }, text: 'Su pedido sale hoy' },
      A.actor,
    )

    expect(meta).toHaveBeenCalledTimes(1)
    const chat = await integraciones.getWhatsappChat({ target: { contactId } }, A.actor)
    expect(chat.messages.at(-1)).toMatchObject({
      id: message.id,
      direction: 'OUT',
      type: 'TEXT',
      body: 'Su pedido sale hoy',
      status: 'SENT',
      origin: 'USER',
      sentBy: { id: A.userId },
    })
  })

  it('R35: una plantilla no enviable y una constante faltante se rechazan sin escribir nada y sin llamar a Meta', async () => {
    const A = await crearEmpresa()
    const { contactId } = await conversacion(A, 1)
    const enviable = await plantilla(A)
    const apagada = await plantilla(A, false)

    const { templates } = await integraciones.listSendableWhatsappTemplates(A.actor)
    expect(templates.map((t) => t.id)).toEqual([enviable.id])

    await esRechazoPrevio(
      A,
      () =>
        integraciones.sendWhatsappMessage(
          { kind: 'template', recipient: { contactId }, templateId: apagada.id, ...CONSTANTES },
          A.actor,
        ),
      'whatsapp_template_not_sendable',
    )
    await esRechazoPrevio(
      A,
      () =>
        integraciones.sendWhatsappMessage(
          {
            kind: 'template',
            recipient: { contactId },
            templateId: enviable.id,
            constants: {},
            constantLabels: CONSTANTES.constantLabels,
          },
          A.actor,
        ),
      'whatsapp_template_values_missing',
    )
  })
})

describe('Cliente dado de baja', () => {
  it('R36, R37, R38: la baja oculta la conversacion y bloquea el envio sin tocar contactos ni mensajes; si el numero vuelve a escribir, queda sin cliente y fuera del listado', async () => {
    const A = await crearEmpresa()
    const numero = numeroColombiano()
    const customerId = await alta(A, numero)
    const ultimo = new Date(Date.now() - HORA)
    const contactId = await contacto(A, { waId: numero, customerId, lastInboundAt: ultimo })
    await entrante(A, contactId, new Date(ultimo.getTime() - MINUTO))
    await entrante(A, contactId, ultimo)
    const aviso = await plantilla(A)
    expect((await listar(A)).page.items.map((item) => item.contactId)).toEqual([contactId])
    const contactosAntes = await contactosDe(A)
    const mensajesAntes = await mensajesDe(A)

    await baja(A, customerId)

    // R36: oculta en el listado, inexistente al leer o marcar, y sin cliente al abrir por cliente.
    expect((await listar(A)).page).toMatchObject({ items: [], total: 0 })
    expect(await rechazo(() => integraciones.getWhatsappChat({ target: { contactId } }, A.actor))).toMatchObject({
      code: 'whatsapp_contact_not_found',
    })
    expect(await rechazo(() => integraciones.markWhatsappChatRead({ contactId }, A.actor))).toMatchObject({
      code: 'whatsapp_contact_not_found',
    })
    expect(
      await rechazo(() => integraciones.getWhatsappChat({ target: { customerId } }, A.actor)),
    ).toMatchObject({ code: 'customer_not_found' })
    // R36: el envio al contacto o al cliente se rechaza antes de llamar a Meta.
    await esRechazoPrevio(
      A,
      () => integraciones.sendWhatsappMessage({ kind: 'text', recipient: { contactId }, text: 'Hola' }, A.actor),
      'whatsapp_recipient_not_customer',
    )
    await esRechazoPrevio(
      A,
      () =>
        integraciones.sendWhatsappMessage(
          { kind: 'template', recipient: { customerId }, templateId: aviso.id, ...CONSTANTES },
          A.actor,
        ),
      'customer_not_found',
    )
    // R37: contactos y mensajes quedan exactamente como estaban.
    expect(await contactosDe(A)).toEqual(contactosAntes)
    expect(await mensajesDe(A)).toEqual(mensajesAntes)

    // R38: el numero vuelve a escribir: se guarda, el contacto queda sin cliente y sigue fuera.
    await escribe(A, numero, 'sigo aqui')

    const mensajesDespues = await mensajesDe(A)
    expect(mensajesDespues).toHaveLength(mensajesAntes.length + 1)
    expect(mensajesDespues.find((m) => m.body === 'sigo aqui')).toMatchObject({ contactId, direction: 'IN' })
    expect(await prisma.whatsappContact.findUniqueOrThrow({ where: { id: contactId } })).toMatchObject({
      customerId: null,
    })
    expect((await listar(A)).page).toMatchObject({ items: [], total: 0 })
  })
})

describe('Permisos separados', () => {
  it('R5: whatsapp.enviar sin whatsapp.consultar envia pero no consulta', async () => {
    const A = await crearEmpresa()
    const { contactId } = await conversacion(A, 1)
    const soloEnvia: Actor = { ...A.actor, permissions: ['whatsapp.enviar'] }

    const { message } = await integraciones.sendWhatsappMessage(
      { kind: 'text', recipient: { contactId }, text: 'Hola' },
      soloEnvia,
    )
    expect(message.status).toBe('SENT')
    expect(meta).toHaveBeenCalledTimes(1)

    for (const consulta of [
      () => integraciones.listWhatsappConversations({}, soloEnvia),
      () => integraciones.getWhatsappChat({ target: { contactId } }, soloEnvia),
      () => integraciones.markWhatsappChatRead({ contactId }, soloEnvia),
      () => integraciones.listSendableWhatsappTemplates(soloEnvia),
    ]) {
      expect(await rechazo(consulta)).toMatchObject({ code: 'unauthorized' })
    }
  })

  it('R5: whatsapp.consultar sin whatsapp.enviar consulta pero no envia', async () => {
    const A = await crearEmpresa()
    const { contactId } = await conversacion(A, 1)
    const soloConsulta: Actor = { ...A.actor, permissions: ['whatsapp.consultar'] }

    expect((await listar(A, soloConsulta)).page.items.map((item) => item.contactId)).toEqual([contactId])
    expect((await integraciones.getWhatsappChat({ target: { contactId } }, soloConsulta)).messages).toHaveLength(1)
    expect(await integraciones.markWhatsappChatRead({ contactId }, soloConsulta)).toEqual({ unreadCount: 0 })

    await esRechazoPrevio(
      A,
      () => integraciones.sendWhatsappMessage({ kind: 'text', recipient: { contactId }, text: 'Hola' }, soloConsulta),
      'unauthorized',
    )
  })
})

describe('Ambito por empresa', () => {
  it('R39: un contacto, un cliente o un mensaje de otra empresa se tratan como inexistentes', async () => {
    const A = await crearEmpresa()
    const B = await crearEmpresa()
    const propia = await conversacion(A, 1)
    const ajena = await conversacion(B, 2)

    expect(
      await rechazo(() => integraciones.getWhatsappChat({ target: { contactId: ajena.contactId } }, A.actor)),
    ).toMatchObject({ code: 'whatsapp_contact_not_found' })
    expect(
      await rechazo(() => integraciones.getWhatsappChat({ target: { customerId: ajena.customerId } }, A.actor)),
    ).toMatchObject({ code: 'customer_not_found' })
    expect(
      await rechazo(() => integraciones.markWhatsappChatRead({ contactId: ajena.contactId }, A.actor)),
    ).toMatchObject({ code: 'whatsapp_contact_not_found' })
    expect(
      await rechazo(() =>
        integraciones.markWhatsappChatRead(
          { contactId: propia.contactId, upToMessageId: ajena.messageIds[0] },
          A.actor,
        ),
      ),
    ).toMatchObject({ code: 'whatsapp_message_not_found' })
    expect(
      await rechazo(() =>
        integraciones.getWhatsappChat({ target: { contactId: propia.contactId }, before: ajena.messageIds[1] }, A.actor),
      ),
    ).toMatchObject({ code: 'whatsapp_message_not_found' })
    const marcaAjena = await prisma.whatsappContact.findUniqueOrThrow({ where: { id: ajena.contactId } })
    expect(marcaAjena.lastReadAt).toBeNull()
  })
})
