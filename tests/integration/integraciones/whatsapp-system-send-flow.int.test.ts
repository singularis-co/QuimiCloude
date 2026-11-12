// El aviso del sistema por WhatsApp de punta a punta contra Postgres REAL: `whatsappNotifier.enqueue`
// y `processWhatsappSend` de la fachada `integraciones` con la composicion real (Prisma, cifrado
// AES-GCM con una clave generada aqui, telefonos de `clientes`). El test enciende
// `INTEGRATIONS_E2E_DOUBLES`, asi que la composicion elige el doble `canned` de Graph y la
// publicacion sin red (`e2e-<messageId>`). Sobre el doble de Graph se pone un espia que cuenta las
// llamadas a Meta y guarda lo que se le mando. El status posterior entra por `receiveWhatsappWebhook`
// firmado con el App Secret de la conexion. Nunca hay red.
//
// Aislamiento: `commit`. Los casos de uso escriben con el cliente Prisma GLOBAL, asi que una
// transaccion del test con ROLLBACK no los envolveria; y dos `enqueue` a la vez al mismo numero nuevo
// necesitan confirmar de verdad contra el unico `(connection_id, wa_id)`. Cada empresa es efimera
// (tipo de documento, rol, empresa con el anadido `integraciones`, usuario y conexion) y `afterAll`
// borra por `company_id` mensajes -> relaciones -> plantillas -> variables -> contactos -> conexiones
// -> vinculos -> numeros -> clientes, afirma contando que no queda nada y despues borra usuario -> rol
// -> tipo de documento -> empresa.

import { createHmac, randomBytes, randomUUID } from 'node:crypto'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import { clientes, integraciones } from '@/lib/composition'
import {
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
import { normalizeCompanyName } from '@/lib/modules/identity'
import { prisma } from '@/lib/shared/db/prisma'

import { change, notification, status, value } from '../../unit/integraciones/whatsapp/whatsapp-webhook-fixtures'

import type { WhatsappSendJob } from '@/lib/modules/integraciones'
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

const VARS = [
  'INTEGRATIONS_ENCRYPTION_KEYS',
  'INTEGRATIONS_ENCRYPTION_ACTIVE',
  'INTEGRATIONS_E2E_DOUBLES',
  'WHATSAPP_SEND_MAX_RETRIES',
] as const
const savedEnv: Record<string, string | undefined> = {}
const CLAVE_DE_LA_CORRIDA = `v1:${randomBytes(32).toString('base64')}`

let meta: MockInstance<typeof whatsappGraphClientCanned.sendMessage>

beforeAll(() => {
  for (const name of VARS) savedEnv[name] = process.env[name]
  process.env.INTEGRATIONS_ENCRYPTION_KEYS = CLAVE_DE_LA_CORRIDA
  process.env.INTEGRATIONS_ENCRYPTION_ACTIVE = 'v1'
  process.env.INTEGRATIONS_E2E_DOUBLES = '1'
  // Sin la variable rige el tope por defecto: el test no depende del `.env` de quien lo corre.
  delete process.env.WHATSAPP_SEND_MAX_RETRIES
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
  const companyName = `Empresa aviso whatsapp ${marker}`
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
  }
  empresas.push(empresa)
  return empresa
}

// A: los avisos de la empresa. B: la otra empresa, que firma un trabajo con un mensaje de A.
let A: Empresa
let B: Empresa

beforeAll(async () => {
  A = await crearEmpresa()
  B = await crearEmpresa()
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
async function alta(empresa: Empresa, numero: string): Promise<string> {
  const { id } = await clientes.createCustomer(
    {
      firstNames: `Nombre ${token()}`,
      lastNames: `Apellido ${token()}`,
      city: 'Bogota',
      phoneCountry: 'CO',
      phoneNumber: numero.slice(2),
      email: null,
      address: null,
    },
    { id: empresa.userId, companyId: empresa.companyId, permissions: ['clientes.modificar'] },
  )
  return id
}

type Plantilla = { readonly name: string; readonly language: string }

/**
 * «Hola {{1}}, su cuenta {{2}} esta lista.»: `{{1}}` es la constante `cliente.nombre` y `{{2}}` una
 * variable propia irrepetible de la empresa con valor `ACC-001`.
 */
async function plantilla(empresa: Empresa): Promise<Plantilla> {
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
      components: [
        { type: 'BODY', text: 'Hola {{1}}, su cuenta {{2}} esta lista.' },
        { type: 'FOOTER', text: 'Cobranza' },
      ],
      status: 'APPROVED',
      mappingStatus: 'MAPPED',
      enabled: true,
    },
    select: { id: true },
  })
  await prisma.whatsappTemplateVariable.createMany({
    data: [
      { companyId: empresa.companyId, templateId: template.id, slot: 'body.1', systemKey: 'cliente.nombre' },
      { companyId: empresa.companyId, templateId: template.id, slot: 'body.2', variableKeyId: variable.id },
    ],
  })
  return { name, language: 'es_MX' }
}

const VALORES = { 'cliente.nombre': 'Luis Rojas' }
const TEXTO = 'Hola Luis Rojas, su cuenta ACC-001 esta lista.\n\nCobranza'

// --- Operaciones ----------------------------------------------------------------------------------

function avisar(empresa: Empresa, customerId: string, ref: Plantilla) {
  return integraciones.whatsappNotifier.enqueue(empresa.companyId, customerId, ref, VALORES)
}

function trabajo(messageId: string, companyId: string): WhatsappSendJob {
  return { kind: 'send_message', messageId, companyId }
}

function mensaje(id: string) {
  return prisma.whatsappMessage.findUniqueOrThrow({ where: { id } })
}

/** Un status de Meta por el webhook real, firmado con el App Secret de la conexion. */
async function llegaStatus(empresa: Empresa, wamid: string, valor: string): Promise<void> {
  const cuerpo = notification(change(value({ phoneNumberId: empresa.phoneNumberId, statuses: [status(wamid, valor)] })))
  const rawBody = new TextEncoder().encode(JSON.stringify(cuerpo))
  const resultado = await integraciones.receiveWhatsappWebhook({
    connectionId: empresa.connectionId,
    rawBody,
    signature: `sha256=${createHmac('sha256', empresa.appSecret).update(rawBody).digest('hex')}`,
  })
  expect(resultado).toMatchObject({ kind: 'stored', counts: { statuses: 1 } })
}

async function encolado(empresa: Empresa, customerId: string, ref: Plantilla): Promise<string> {
  const resultado = await avisar(empresa, customerId, ref)
  if (resultado.status !== 'queued') throw new Error(`aviso omitido: ${resultado.reason}`)
  return resultado.messageId
}

// --- Casos ----------------------------------------------------------------------------------------

describe('El aviso del sistema por la cola, con la composicion real', () => {
  it('R1, R8, R10: enqueue deja el mensaje QUEUED, SYSTEM, sin autor y publicado, sin llamar a Meta', async () => {
    const numero = numeroColombiano()
    const customerId = await alta(A, numero)
    const ref = await plantilla(A)

    const resultado = await avisar(A, customerId, ref)

    expect(resultado).toMatchObject({ status: 'queued', published: true })
    if (resultado.status !== 'queued') throw new Error('no encolado')
    expect(meta).not.toHaveBeenCalled()
    const fila = await mensaje(resultado.messageId)
    expect(fila).toMatchObject({
      companyId: A.companyId,
      connectionId: A.connectionId,
      direction: 'OUT',
      status: 'QUEUED',
      origin: 'SYSTEM',
      sentById: null,
      type: 'TEMPLATE',
      attempts: 0,
      body: TEXTO,
      templateName: ref.name,
      templateLanguage: 'es_MX',
      wamid: null,
      queueMessageId: `e2e-${resultado.messageId}`,
    })
    expect(fila.payload).toMatchObject({ 'cliente.nombre': 'Luis Rojas' })
    expect(fila.templateComponents).toEqual([
      { type: 'body', parameters: [{ type: 'text', text: 'Luis Rojas' }, { type: 'text', text: 'ACC-001' }] },
    ])
    const contacto = await prisma.whatsappContact.findUniqueOrThrow({ where: { id: fila.contactId } })
    expect(contacto).toMatchObject({ waId: numero, customerId, customerLinkedBy: null })
  })

  it('R21, R37: el consumidor envia lo encolado, deja SENT con el wamid, no repite y el status delivered del webhook se aplica', async () => {
    const numero = numeroColombiano()
    const customerId = await alta(A, numero)
    const ref = await plantilla(A)
    const messageId = await encolado(A, customerId, ref)
    const guardado = await mensaje(messageId)

    await expect(integraciones.processWhatsappSend(trabajo(messageId, A.companyId))).resolves.toBe('done')

    expect(meta).toHaveBeenCalledTimes(1)
    expect(meta.mock.calls[0]?.[0]).toMatchObject({
      phoneNumberId: A.phoneNumberId,
      to: numero,
      message: { type: 'template', name: ref.name, language: 'es_MX', components: guardado.templateComponents },
    })
    const enviado = await mensaje(messageId)
    expect(enviado).toMatchObject({ status: 'SENT', attempts: 1, errorCode: null, errorReason: null, body: TEXTO })
    expect(enviado.wamid).toMatch(new RegExp(`^${CANNED_WAMID_PREFIX.replaceAll('.', '\\.')}`, 'u'))

    // Una segunda entrega del mismo trabajo no reclama nada: no vuelve a llamar a Meta.
    await expect(integraciones.processWhatsappSend(trabajo(messageId, A.companyId))).resolves.toBe('done')
    expect(meta).toHaveBeenCalledTimes(1)
    expect(await mensaje(messageId)).toMatchObject({ status: 'SENT', attempts: 1 })

    await llegaStatus(A, enviado.wamid ?? '', 'delivered')
    expect(await mensaje(messageId)).toMatchObject({ status: 'DELIVERED' })
  })

  it('R9: dos enqueue a la vez al mismo numero nuevo dejan un solo contacto, vinculado al cliente por el sistema', async () => {
    const numero = numeroColombiano()
    const customerId = await alta(A, numero)
    const ref = await plantilla(A)

    const [uno, dos] = await Promise.all([avisar(A, customerId, ref), avisar(A, customerId, ref)])

    expect(uno.status).toBe('queued')
    expect(dos.status).toBe('queued')
    const contactos = await prisma.whatsappContact.findMany({
      where: { companyId: A.companyId, connectionId: A.connectionId, waId: numero },
    })
    expect(contactos).toHaveLength(1)
    expect(contactos[0]).toMatchObject({ customerId, customerLinkedBy: null })
    const mensajes = await prisma.whatsappMessage.findMany({ where: { companyId: A.companyId, contactId: contactos[0]?.id } })
    expect(mensajes).toHaveLength(2)
    expect(mensajes.every((fila) => fila.status === 'QUEUED' && fila.origin === 'SYSTEM')).toBe(true)
  })

  it('R9: un contacto sin cliente con ese numero se vincula al cliente y recibe el aviso', async () => {
    const numero = numeroColombiano()
    const customerId = await alta(A, numero)
    const ref = await plantilla(A)
    const libre = await prisma.whatsappContact.create({
      data: { companyId: A.companyId, connectionId: A.connectionId, waId: numero, customerId: null },
      select: { id: true },
    })

    const messageId = await encolado(A, customerId, ref)

    expect((await mensaje(messageId)).contactId).toBe(libre.id)
    expect(await prisma.whatsappContact.findUniqueOrThrow({ where: { id: libre.id } })).toMatchObject({
      customerId,
      customerLinkedBy: null,
    })
  })

  it('R36: un trabajo firmado con otra empresa no reclama ni modifica el mensaje, y la suya si lo envia', async () => {
    const customerId = await alta(A, numeroColombiano())
    const ref = await plantilla(A)
    const messageId = await encolado(A, customerId, ref)
    const antes = await mensaje(messageId)

    await expect(integraciones.processWhatsappSend(trabajo(messageId, B.companyId))).resolves.toBe('done')

    expect(meta).not.toHaveBeenCalled()
    const despues = await mensaje(messageId)
    expect(despues).toMatchObject({ status: 'QUEUED', attempts: 0, wamid: null, errorReason: null })
    expect(despues.updatedAt).toEqual(antes.updatedAt)

    await expect(integraciones.processWhatsappSend(trabajo(messageId, A.companyId))).resolves.toBe('done')
    expect(await mensaje(messageId)).toMatchObject({ status: 'SENT', attempts: 1 })
  })
})
