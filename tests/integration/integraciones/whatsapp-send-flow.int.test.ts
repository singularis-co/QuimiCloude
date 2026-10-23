// El envio de WhatsApp de un usuario de punta a punta contra Postgres REAL (QC-240, T10, A6, R48):
// `sendWhatsappMessage` y `retryWhatsappMessage` de la fachada `integraciones` con la composicion
// real (Prisma, cifrado AES-GCM con una clave generada aqui, telefonos de `clientes`) y el doble
// `canned` de Graph, que la composicion elige porque el test enciende `INTEGRATIONS_E2E_DOUBLES`.
// Sobre ese doble se pone un espia: cuenta las llamadas a Meta, guarda lo que se le mando y, en los
// casos de fallo, contesta lo que el caso necesita. Nunca hay red.
//
// Aislamiento: `commit`. Los casos de uso escriben con el cliente Prisma GLOBAL, asi que una
// transaccion del test con ROLLBACK no los envolveria; y dos envios a la vez al mismo cliente sin
// contacto necesitan confirmar de verdad contra el unico `(connection_id, wa_id)`. Cada empresa es
// efimera (tipo de documento, rol, empresa con el anadido `integraciones`, usuario y conexion) y
// `afterAll` borra por `company_id` mensajes -> relaciones -> plantillas -> variables -> contactos ->
// conexiones -> vinculos -> numeros -> clientes, afirma contando que no queda nada y despues borra
// usuario -> rol -> tipo de documento -> empresa.

import { randomBytes, randomUUID } from 'node:crypto'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import { clientes, integraciones } from '@/lib/composition'
import {
  CANNED_SEND_FAIL_PREFIX,
  CANNED_WAMID_PREFIX,
  whatsappGraphClientCanned,
} from '@/lib/modules/integraciones/adapters/driven/graph/whatsapp-graph-client-canned'
import { insertWhatsappConnection } from '@/lib/modules/integraciones/adapters/driven/persistence/whatsapp-connection-prisma'
import { secretCipherAesGcm } from '@/lib/modules/integraciones/adapters/driven/security/secret-cipher-aes-gcm'
import { digestOfSecret } from '@/lib/modules/integraciones/adapters/driven/security/secret-digest-sha256'
import {
  ACCESS_TOKEN_FIELD,
  APP_SECRET_FIELD,
  connectionSecretContext,
} from '@/lib/modules/integraciones/domain/connection-secrets'
import {
  rejectedWithCodeReason,
  TOKEN_INVALID_MESSAGE,
} from '@/lib/modules/integraciones/domain/whatsapp-send-failure'
import { normalizeCompanyName } from '@/lib/modules/identity'
import { prisma } from '@/lib/shared/db/prisma'

import type { Actor } from '@/lib/modules/integraciones/domain/actor'
import type { IntegracionesScope } from '@/lib/modules/integraciones/domain/integraciones-scope'
import type { GraphMessageSent } from '@/lib/modules/integraciones/ports/whatsapp-graph-client'

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

const HORA = 60 * 60 * 1000

// El original del doble, antes de que el espia lo envuelva: los casos que fallan a proposito lo
// sustituyen una vez y los demas pasan por el.
const enviarDelDoble = whatsappGraphClientCanned.sendMessage.bind(whatsappGraphClientCanned)
type EntradaDeGraph = Parameters<typeof whatsappGraphClientCanned.sendMessage>[0]
let meta: MockInstance<typeof whatsappGraphClientCanned.sendMessage>

beforeAll(() => {
  for (const name of VARS) savedEnv[name] = process.env[name]
  process.env.INTEGRATIONS_ENCRYPTION_KEYS = CLAVE_DE_LA_CORRIDA
  process.env.INTEGRATIONS_ENCRYPTION_ACTIVE = 'v1'
  process.env.INTEGRATIONS_E2E_DOUBLES = '1'
})

beforeEach(() => {
  meta = vi.spyOn(whatsappGraphClientCanned, 'sendMessage')
  // El puerto de log escribe el diagnostico de cada fallo con `console.warn`.
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
  readonly scope: IntegracionesScope
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
  const companyName = `Empresa envio whatsapp ${marker}`
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
        `app-secret-${token()}`,
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
    scope,
    actor: { id: user.id, companyId: company.id, permissions: ['whatsapp.enviar'] },
  }
  empresas.push(empresa)
  return empresa
}

// A: los envios felices y los rechazos. B: la otra empresa (R43). C: la conexion que cambia de
// estado (R13). D: la conexion que el error 190 deja en ERROR (R33).
let A: Empresa
let B: Empresa
let C: Empresa
let D: Empresa

beforeAll(async () => {
  A = await crearEmpresa()
  B = await crearEmpresa()
  C = await crearEmpresa()
  D = await crearEmpresa()
})

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

type ContactoNuevo = {
  readonly waId?: string
  readonly customerId?: string | null
  readonly lastInboundAt?: Date | null
  readonly lastMessageAt?: Date | null
}

async function contacto(empresa: Empresa, datos: ContactoNuevo = {}): Promise<string> {
  const { id } = await prisma.whatsappContact.create({
    data: {
      companyId: empresa.companyId,
      connectionId: empresa.connectionId,
      waId: datos.waId ?? numeroColombiano(),
      customerId: datos.customerId ?? null,
      lastInboundAt: datos.lastInboundAt ?? null,
      lastMessageAt: datos.lastMessageAt ?? null,
    },
    select: { id: true },
  })
  return id
}

/** Un contacto de un cliente de la empresa que escribio hace una hora: la ventana esta abierta. */
async function contactoConVentana(empresa: Empresa, datos: ContactoNuevo = {}): Promise<string> {
  return contacto(empresa, {
    customerId: await alta(empresa),
    lastInboundAt: new Date(Date.now() - HORA),
    ...datos,
  })
}

type Plantilla = { readonly id: string; readonly name: string; readonly variableKeyId: string; readonly key: string }

type PlantillaNueva = {
  readonly enabled?: boolean
  readonly mappingStatus?: 'MAPPED' | 'UNMAPPED'
  readonly status?: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED'
  readonly valor?: string
}

/**
 * «Hola {{1}}, su cuenta {{2}} esta lista.»: `{{1}}` es la constante `cliente.nombre` y `{{2}}` una
 * variable propia irrepetible de la empresa, para que un caso que cambia su valor no toque a otro.
 */
async function plantilla(empresa: Empresa, datos: PlantillaNueva = {}): Promise<Plantilla> {
  const key = `cuenta_${token().slice(0, 10)}`
  const variable = await prisma.whatsappVariableKey.create({
    data: { companyId: empresa.companyId, key, label: 'Numero de cuenta', value: datos.valor ?? 'ACC-001' },
    select: { id: true },
  })
  const name = `aviso_${token().slice(0, 12)}`
  const mappingStatus = datos.mappingStatus ?? 'MAPPED'
  const template = await prisma.whatsappTemplate.create({
    data: {
      companyId: empresa.companyId,
      connectionId: empresa.connectionId,
      metaTemplateId: digitos(12),
      name,
      language: 'es_MX',
      category: 'UTILITY',
      components: [
        { type: 'BODY', text: 'Hola {{1}}, su cuenta {{2}} esta lista.' },
        { type: 'FOOTER', text: 'Cobranza' },
      ],
      status: datos.status ?? 'APPROVED',
      mappingStatus,
      enabled: datos.enabled ?? mappingStatus === 'MAPPED',
    },
    select: { id: true },
  })
  if (mappingStatus === 'MAPPED') {
    await prisma.whatsappTemplateVariable.createMany({
      data: [
        { companyId: empresa.companyId, templateId: template.id, slot: 'body.1', systemKey: 'cliente.nombre' },
        { companyId: empresa.companyId, templateId: template.id, slot: 'body.2', variableKeyId: variable.id },
      ],
    })
  }
  return { id: template.id, name, variableKeyId: variable.id, key }
}

const CONSTANTES = {
  constants: { 'cliente.nombre': 'Luis Rojas' },
  constantLabels: { 'cliente.nombre': 'Nombre del cliente' },
}

// --- Lecturas -----------------------------------------------------------------------------------

function mensajesDe(empresa: Empresa) {
  return prisma.whatsappMessage.findMany({ where: { companyId: empresa.companyId }, orderBy: { createdAt: 'asc' } })
}

function mensajesDelContacto(contactId: string) {
  return prisma.whatsappMessage.findMany({ where: { contactId }, orderBy: { createdAt: 'asc' } })
}

function mensaje(id: string) {
  return prisma.whatsappMessage.findUniqueOrThrow({ where: { id } })
}

function contactoGuardado(id: string) {
  return prisma.whatsappContact.findUniqueOrThrow({ where: { id } })
}

/** Un rechazo previo: el error del catalogo, ningun mensaje nuevo y ninguna llamada a Meta. */
async function esRechazoPrevio(empresa: Empresa, envio: () => Promise<unknown>, code: string): Promise<unknown> {
  const antes = (await mensajesDe(empresa)).length
  const error: unknown = await envio().then(
    () => null,
    (rechazo: unknown) => rechazo,
  )
  expect(error).toMatchObject({ code })
  expect((await mensajesDe(empresa)).length).toBe(antes)
  expect(meta).not.toHaveBeenCalled()
  return error
}

function rechazoDeMeta(code: number): GraphMessageSent {
  return { ok: false, kind: 'rejected', message: `(#${String(code)}) Texto original de Meta`, code, subcode: null }
}

function enviarTexto(empresa: Empresa, contactId: string, text = 'Hola, tu pedido esta listo') {
  return integraciones.sendWhatsappMessage({ kind: 'text', recipient: { contactId }, text }, empresa.actor)
}

function enviarPlantilla(
  empresa: Empresa,
  recipient: { readonly contactId: string } | { readonly customerId: string },
  templateId: string,
  valores: { readonly constants: Record<string, string>; readonly constantLabels: Record<string, string> } = CONSTANTES,
) {
  return integraciones.sendWhatsappMessage({ kind: 'template', recipient, templateId, ...valores }, empresa.actor)
}

// --- Casos ----------------------------------------------------------------------------------------

describe('Envio de texto', () => {
  it('R48, R15, R26, R27, R29, R30, R32, R37: dentro de la ventana, un texto se envia y queda SENT con su wamid', async () => {
    const inbound = new Date(Date.now() - HORA)
    const contactId = await contactoConVentana(A, { lastInboundAt: inbound, lastMessageAt: inbound })
    const { waId } = await contactoGuardado(contactId)
    // R26: el mensaje ya esta escrito en SENDING cuando se llama a Meta.
    let filasAlLlamar: Awaited<ReturnType<typeof mensajesDelContacto>> = []
    meta.mockImplementationOnce(async (entrada: EntradaDeGraph) => {
      filasAlLlamar = await mensajesDelContacto(contactId)
      return enviarDelDoble(entrada)
    })
    const antes = new Date()

    const { message } = await enviarTexto(A, contactId)

    expect(filasAlLlamar).toHaveLength(1)
    expect(filasAlLlamar[0]).toMatchObject({ status: 'SENDING', wamid: null })
    expect(meta).toHaveBeenCalledTimes(1)
    expect(meta.mock.calls[0]?.[0]).toMatchObject({
      phoneNumberId: A.phoneNumberId,
      to: waId,
      message: { type: 'text', body: 'Hola, tu pedido esta listo' },
    })
    expect(meta.mock.calls[0]?.[0].accessToken).toMatch(/^access-/u)
    const fila = await mensaje(message.id)
    expect(fila).toMatchObject({
      companyId: A.companyId,
      connectionId: A.connectionId,
      contactId,
      direction: 'OUT',
      origin: 'USER',
      sentById: A.userId,
      attempts: 1,
      type: 'TEXT',
      body: 'Hola, tu pedido esta listo',
      payload: {},
      templateName: null,
      templateLanguage: null,
      status: 'SENT',
      errorCode: null,
      errorReason: null,
    })
    expect(fila.wamid).toMatch(new RegExp(`^${CANNED_WAMID_PREFIX.replaceAll('.', '\\.')}`, 'u'))
    expect(message).toMatchObject({ id: fila.id, type: 'TEXT', status: 'SENT', body: fila.body, errorCode: null })
    const guardado = await contactoGuardado(contactId)
    expect(guardado.lastMessageAt?.getTime()).toBeGreaterThanOrEqual(antes.getTime())
    expect(guardado.lastInboundAt).toEqual(inbound)
  })

  it('R16, R48: fuera de la ventana, un texto se rechaza antes de llamar a Meta', async () => {
    const contactId = await contactoConVentana(A, { lastInboundAt: new Date(Date.now() - 25 * HORA) })
    await esRechazoPrevio(A, () => enviarTexto(A, contactId), 'whatsapp_window_closed')
  })
})

describe('Envio de plantilla', () => {
  it('R18, R21, R22, R23, R25, R28: fuera de la ventana, una plantilla habilitada y aprobada se envia con sus parametros armados desde el mapeo y guarda texto final, templateName, idioma y valores por clave', async () => {
    const contactId = await contactoConVentana(A, { lastInboundAt: null })
    const aviso = await plantilla(A, { valor: 'ACC-001' })

    // R22: el valor que mande el front para la variable propia se ignora.
    const { message } = await enviarPlantilla(A, { contactId }, aviso.id, {
      constants: { ...CONSTANTES.constants, [aviso.key]: 'NO-USAR' },
      constantLabels: CONSTANTES.constantLabels,
    })

    expect(meta).toHaveBeenCalledTimes(1)
    expect(meta.mock.calls[0]?.[0].message).toEqual({
      type: 'template',
      name: aviso.name,
      language: 'es_MX',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Luis Rojas' },
            { type: 'text', text: 'ACC-001' },
          ],
        },
      ],
    })
    expect(await mensaje(message.id)).toMatchObject({
      direction: 'OUT',
      origin: 'USER',
      sentById: A.userId,
      attempts: 1,
      type: 'TEMPLATE',
      status: 'SENT',
      body: 'Hola Luis Rojas, su cuenta ACC-001 esta lista.\n\nCobranza',
      templateName: aviso.name,
      templateLanguage: 'es_MX',
      payload: { 'cliente.nombre': 'Luis Rojas', [aviso.key]: 'ACC-001' },
    })
  })

  it.each([
    ['deshabilitada', { enabled: false }],
    ['sin relacionar', { mappingStatus: 'UNMAPPED' }],
    ['no APPROVED', { status: 'PENDING' }],
  ] as const)('R20: una plantilla %s se rechaza antes de llamar a Meta', async (_caso, datos) => {
    const contactId = await contactoConVentana(A)
    const aviso = await plantilla(A, datos)
    await esRechazoPrevio(A, () => enviarPlantilla(A, { contactId }, aviso.id), 'whatsapp_template_not_sendable')
  })

  it('R24: si falta el valor de una constante, se rechaza nombrando su etiqueta y sin llamar a Meta', async () => {
    const contactId = await contactoConVentana(A)
    const aviso = await plantilla(A)
    const envio = () =>
      enviarPlantilla(A, { contactId }, aviso.id, {
        constants: { 'cliente.nombre': '   ' },
        constantLabels: CONSTANTES.constantLabels,
      })
    const error = await esRechazoPrevio(A, envio, 'whatsapp_template_values_missing')
    expect(error).toMatchObject({ missing: [{ key: 'cliente.nombre', label: 'Nombre del cliente' }] })
  })
})

describe('Destinatario', () => {
  it('R7: a un cliente sin telefono valido se rechaza antes de llamar a Meta', async () => {
    const customerId = await alta(A)
    const aviso = await plantilla(A)
    await esRechazoPrevio(A, () => enviarPlantilla(A, { customerId }, aviso.id), 'whatsapp_customer_without_phone')
  })

  it('R5: a un numero que no es cliente se rechaza antes de llamar a Meta', async () => {
    const contactId = await contacto(A, { lastInboundAt: new Date(Date.now() - HORA) })
    await esRechazoPrevio(A, () => enviarTexto(A, contactId), 'whatsapp_recipient_not_customer')
  })

  it('R8: a un cliente sin contacto se le crea el contacto con waId = phone_e164, vinculado por el actor', async () => {
    const numero = numeroColombiano()
    const customerId = await alta(A, numero)
    const aviso = await plantilla(A)

    const { message } = await enviarPlantilla(A, { customerId }, aviso.id)

    const contactos = await prisma.whatsappContact.findMany({ where: { connectionId: A.connectionId, waId: numero } })
    expect(contactos).toHaveLength(1)
    expect(contactos[0]).toMatchObject({ customerId, customerLinkedBy: A.userId })
    expect(await mensaje(message.id)).toMatchObject({ contactId: contactos[0]?.id, status: 'SENT' })
    expect(meta.mock.calls[0]?.[0].to).toBe(numero)
  })

  it('R8: el contacto sin cliente que ya tenia ese numero se usa y queda vinculado por el actor', async () => {
    const numero = numeroColombiano()
    const customerId = await alta(A, numero)
    // Despues del alta: el alta habria vinculado un contacto previo por su cuenta.
    const libre = await contacto(A, { waId: numero })
    const aviso = await plantilla(A)

    const { message } = await enviarPlantilla(A, { customerId }, aviso.id)

    expect(await contactoGuardado(libre)).toMatchObject({ customerId, customerLinkedBy: A.userId })
    expect(await mensaje(message.id)).toMatchObject({ contactId: libre })
    expect(await prisma.whatsappContact.count({ where: { connectionId: A.connectionId, waId: numero } })).toBe(1)
  })

  it('R11: dos envios a la vez a un cliente sin contacto dejan un solo contacto y lo usan los dos', async () => {
    const numero = numeroColombiano()
    const customerId = await alta(A, numero)
    const aviso = await plantilla(A)

    const [uno, dos] = await Promise.all([
      enviarPlantilla(A, { customerId }, aviso.id),
      enviarPlantilla(A, { customerId }, aviso.id),
    ])

    const contactos = await prisma.whatsappContact.findMany({ where: { connectionId: A.connectionId, waId: numero } })
    expect(contactos).toHaveLength(1)
    expect(contactos[0]).toMatchObject({ customerId, customerLinkedBy: A.userId })
    const filas = await Promise.all([mensaje(uno.message.id), mensaje(dos.message.id)])
    expect(filas.map((fila) => fila.contactId)).toEqual([contactos[0]?.id, contactos[0]?.id])
    expect(filas.map((fila) => fila.status)).toEqual(['SENT', 'SENT'])
  })
})

describe('Fallos de Meta y reintento', () => {
  it('R31, R36, R39, R41: si Meta falla queda FAILED con un mensaje en espanol; reintentar crea un mensaje nuevo y el fallido queda igual', async () => {
    const contactId = await contactoConVentana(A)
    meta.mockResolvedValueOnce(rechazoDeMeta(131026))

    const fallido = await enviarTexto(A, contactId, 'Tu pedido sale hoy')

    expect(fallido.message).toMatchObject({
      status: 'FAILED',
      errorCode: '131026',
      errorReason: rejectedWithCodeReason(131026),
    })
    const filaFallida = await mensaje(fallido.message.id)
    expect(filaFallida).toMatchObject({
      status: 'FAILED',
      wamid: null,
      errorCode: '131026',
      errorReason: rejectedWithCodeReason(131026),
    })
    expect(JSON.stringify(filaFallida)).not.toContain('Texto original de Meta')

    const reintento = await integraciones.retryWhatsappMessage({ messageId: fallido.message.id }, A.actor)

    expect(reintento.message.id).not.toBe(fallido.message.id)
    expect(meta).toHaveBeenCalledTimes(2)
    expect(meta.mock.calls[1]?.[0].message).toEqual({ type: 'text', body: 'Tu pedido sale hoy' })
    const filas = await mensajesDelContacto(contactId)
    expect(filas).toHaveLength(2)
    expect(filas[1]).toMatchObject({ id: reintento.message.id, status: 'SENT', body: 'Tu pedido sale hoy', attempts: 1 })
    expect(await mensaje(fallido.message.id)).toEqual(filaFallida)
  })

  it('R39, R42: reintentar una plantilla recalcula con el valor vigente de la variable propia', async () => {
    const contactId = await contactoConVentana(A, { lastInboundAt: null })
    const aviso = await plantilla(A, { valor: 'ACC-001' })
    meta.mockResolvedValueOnce(rechazoDeMeta(130429))
    const fallido = await enviarPlantilla(A, { contactId }, aviso.id)
    const filaFallida = await mensaje(fallido.message.id)
    expect(filaFallida).toMatchObject({ status: 'FAILED', payload: { [aviso.key]: 'ACC-001' } })

    await prisma.whatsappVariableKey.update({ where: { id: aviso.variableKeyId }, data: { value: 'ACC-002' } })
    const reintento = await integraciones.retryWhatsappMessage(
      { messageId: fallido.message.id, constants: { 'cliente.nombre': 'Luis R.' }, constantLabels: {} },
      A.actor,
    )

    expect(meta.mock.calls[1]?.[0].message).toMatchObject({
      type: 'template',
      name: aviso.name,
      components: [{ type: 'body', parameters: [{ type: 'text', text: 'Luis R.' }, { type: 'text', text: 'ACC-002' }] }],
    })
    expect(await mensaje(reintento.message.id)).toMatchObject({
      status: 'SENT',
      body: 'Hola Luis R., su cuenta ACC-002 esta lista.\n\nCobranza',
      payload: { 'cliente.nombre': 'Luis R.', [aviso.key]: 'ACC-002' },
    })
    expect(await mensajesDelContacto(contactId)).toHaveLength(2)
    expect(await mensaje(fallido.message.id)).toEqual(filaFallida)
  })

  it('R33: un error 190 deja el mensaje FAILED y la conexion en ERROR con «Revisa el token en Integraciones»', async () => {
    // El doble `canned` contesta 190 a un destino con este prefijo: aqui no se sustituye nada.
    const contactId = await contactoConVentana(D, { waId: `${CANNED_SEND_FAIL_PREFIX}${digitos(8)}` })

    const { message } = await enviarTexto(D, contactId)

    expect(await mensaje(message.id)).toMatchObject({
      status: 'FAILED',
      errorCode: '190',
      errorReason: TOKEN_INVALID_MESSAGE,
    })
    expect(
      await prisma.whatsappConnection.findUniqueOrThrow({
        where: { id: D.connectionId },
        select: { status: true, lastError: true },
      }),
    ).toEqual({ status: 'ERROR', lastError: TOKEN_INVALID_MESSAGE })
  })
})

describe('Permiso y conexion', () => {
  it('R4: sin whatsapp.enviar se rechaza antes de llamar a Meta', async () => {
    const contactId = await contactoConVentana(A)
    const sinPermiso: Actor = { ...A.actor, permissions: ['integraciones.modificar'] }
    await esRechazoPrevio(
      A,
      () => integraciones.sendWhatsappMessage({ kind: 'text', recipient: { contactId }, text: 'Hola' }, sinPermiso),
      'unauthorized',
    )
  })

  it.each(['PENDING', 'DISABLED'] as const)('R13: con la conexion %s se rechaza antes de llamar a Meta', async (status) => {
    const contactId = await contactoConVentana(C)
    await prisma.whatsappConnection.update({ where: { id: C.connectionId }, data: { status } })
    try {
      await esRechazoPrevio(C, () => enviarTexto(C, contactId), 'whatsapp_connection_not_active')
    } finally {
      await prisma.whatsappConnection.update({ where: { id: C.connectionId }, data: { status: 'ACTIVE' } })
    }
  })
})

describe('Ambito por empresa', () => {
  it('R43: un contacto, un cliente, una plantilla o un mensaje de otra empresa se tratan como inexistentes', async () => {
    const ajeno = await contactoConVentana(B)
    const clienteAjeno = await alta(B, numeroColombiano())
    const plantillaAjena = await plantilla(B)
    meta.mockResolvedValueOnce(rechazoDeMeta(131026))
    const fallidoAjeno = await enviarTexto(B, ajeno)
    expect(fallidoAjeno.message.status).toBe('FAILED')
    meta.mockClear()
    const propio = await contactoConVentana(A)

    await esRechazoPrevio(A, () => enviarTexto(A, ajeno), 'whatsapp_contact_not_found')
    await esRechazoPrevio(A, () => enviarPlantilla(A, { customerId: clienteAjeno }, plantillaAjena.id), 'customer_not_found')
    await esRechazoPrevio(A, () => enviarPlantilla(A, { contactId: propio }, plantillaAjena.id), 'whatsapp_template_not_found')
    await esRechazoPrevio(
      A,
      () => integraciones.retryWhatsappMessage({ messageId: fallidoAjeno.message.id }, A.actor),
      'whatsapp_message_not_found',
    )
    expect(await mensajesDelContacto(ajeno)).toHaveLength(1)
  })
})
