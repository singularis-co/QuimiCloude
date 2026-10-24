// El archivo de un medio, las reacciones y el contexto del chat de WhatsApp de punta a punta contra
// Postgres REAL: la ruta GET del archivo (la de `app/api`, con la sesion doblada en `identity`), el
// chat y el contexto por la fachada real de `lib/composition`, con el doble `canned` de Graph que la
// composicion elige porque el test enciende `INTEGRATIONS_E2E_DOUBLES`. Sobre ese doble se pone un
// espia que cuenta las descargas de Meta. Nunca hay red.
//
// Los entrantes llegan por el webhook real firmado; los pedidos, por la siembra de entregas y una
// entrega parcial real (`pedidos.deliverOrder`).
//
// Aislamiento: `commit`. `clientes.createCustomer`, `clientes.deleteCustomer`, `pedidos.deliverOrder`
// y `receiveWhatsappWebhook` escriben con el cliente Prisma GLOBAL (los dos ultimos en su propia
// transaccion), asi que una transaccion del test con ROLLBACK no los envolveria. Cada caso fabrica su
// empresa efimera (`tests/helpers/order-delivery-seed.ts`) y `afterAll` borra por `company_id`
// mensajes -> variables -> contactos -> conexiones -> vinculos -> numeros, afirma contando que no
// queda ninguno y despues `borrarEmpresaDeEntrega` limpia pedidos, entregas, lotes, clientes,
// usuarios y empresa.

import { createHmac, randomBytes, randomUUID } from 'node:crypto'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import { GET } from '@/app/api/integraciones/whatsapp/media/[mensajeId]/route'
import { clientes, identity, integraciones, pedidos } from '@/lib/composition'
import {
  cannedMediaBytes,
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
import { formatOrderNumber, type OrderStatus } from '@/lib/modules/pedidos'
import { prisma } from '@/lib/shared/db/prisma'
import { whatsappMediaPath } from '@/lib/shared/routes'

import {
  borrarEmpresaDeEntrega,
  crearEmpresaDeEntrega,
  crearLote,
  crearPedido,
  crearPresentacion,
  crearTerminado,
  type EmpresaDeEntrega,
} from '../../helpers/order-delivery-seed'
import { contact, message, messagesNotification } from '../../unit/integraciones/whatsapp/whatsapp-webhook-fixtures'

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
const PULGAR = '\u{1F44D}'

let descargas: MockInstance<typeof whatsappGraphClientCanned.downloadMedia>

beforeAll(() => {
  for (const name of VARS) savedEnv[name] = process.env[name]
  process.env.INTEGRATIONS_ENCRYPTION_KEYS = CLAVE_DE_LA_CORRIDA
  process.env.INTEGRATIONS_ENCRYPTION_ACTIVE = 'v1'
  process.env.INTEGRATIONS_E2E_DOUBLES = '1'
})

beforeEach(() => {
  descargas = vi.spyOn(whatsappGraphClientCanned, 'downloadMedia')
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

type Empresa = {
  readonly entrega: EmpresaDeEntrega
  readonly companyId: string
  readonly userId: string
  readonly connectionId: string
  readonly phoneNumberId: string
  readonly appSecret: string
  /** Solo `whatsapp.consultar`, sin ningun permiso de Pedidos (R63). */
  readonly lector: Actor
}

const empresas: Empresa[] = []

async function crearEmpresa(): Promise<Empresa> {
  const entrega = await crearEmpresaDeEntrega('chat whatsapp')
  const { companyId } = entrega
  const userId = entrega.actor.id
  await prisma.companyAddonOverride.create({ data: { companyId, addonKey: 'integraciones', enabled: true } })
  const scope: IntegracionesScope = { companyId }
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
      createdById: userId,
    },
    scope,
  )
  const empresa: Empresa = {
    entrega,
    companyId,
    userId,
    connectionId,
    phoneNumberId,
    appSecret,
    lector: { id: userId, companyId, permissions: ['whatsapp.consultar'] },
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
  await prisma.whatsappMessage.deleteMany(enEmpresas)
  await prisma.whatsappVariableKey.deleteMany(enEmpresas)
  await prisma.whatsappContact.deleteMany(enEmpresas)
  await prisma.whatsappConnection.deleteMany(enEmpresas)
  await prisma.customerPhoneNumber.deleteMany(enEmpresas)
  await prisma.phoneNumber.deleteMany(enEmpresas)
  expect(await prisma.whatsappMessage.count(enEmpresas)).toBe(0)
  expect(await prisma.whatsappVariableKey.count(enEmpresas)).toBe(0)
  expect(await prisma.whatsappContact.count(enEmpresas)).toBe(0)
  expect(await prisma.whatsappConnection.count(enEmpresas)).toBe(0)
  expect(await prisma.customerPhoneNumber.count(enEmpresas)).toBe(0)
  expect(await prisma.phoneNumber.count(enEmpresas)).toBe(0)
  for (const empresa of empresas) await borrarEmpresaDeEntrega(empresa.entrega)
  await prisma.$disconnect()
})

// --- Siembra ------------------------------------------------------------------------------------

type Cliente = { readonly id: string; readonly numero: string; readonly nombre: string }

/** El alta va por la fachada de `clientes`: deja el telefono principal como lo deja la pantalla. */
async function alta(empresa: Empresa): Promise<Cliente> {
  const numero = numeroColombiano()
  const firstNames = `Nombre ${token().slice(0, 8)}`
  const lastNames = `Apellido ${token().slice(0, 8)}`
  const { id } = await clientes.createCustomer(
    {
      firstNames,
      lastNames,
      city: 'Bogota',
      phoneCountry: 'CO',
      phoneNumber: numero.slice(2),
      email: null,
      address: null,
    },
    { id: empresa.userId, companyId: empresa.companyId, permissions: ['clientes.modificar'] },
  )
  return { id, numero, nombre: `${firstNames} ${lastNames}` }
}

function baja(empresa: Empresa, customerId: string): Promise<void> {
  return clientes.deleteCustomer(customerId, {
    id: empresa.userId,
    companyId: empresa.companyId,
    permissions: ['clientes.modificar'],
  })
}

/** El webhook real firmado con el App Secret de la conexion: un mensaje entrante de `waId`. */
async function recibe(empresa: Empresa, waId: string, entrante: unknown): Promise<void> {
  const cuerpo = messagesNotification([entrante as never], [contact(waId, 'Quien escribe')])
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

/** Un entrante de `tipo` por el webhook; devuelve el id interno del mensaje guardado. */
async function entra(empresa: Empresa, waId: string, tipo: string, contenido: object, wamid = `wamid.ctx-${token()}`): Promise<string> {
  await recibe(empresa, waId, message(tipo, contenido as never, { from: waId, id: wamid }))
  const guardado = await prisma.whatsappMessage.findUniqueOrThrow({ where: { wamid }, select: { id: true } })
  return guardado.id
}

const imagen = () => ({ image: { id: `media-${token()}`, mime_type: 'image/jpeg' } })
const audio = () => ({ audio: { id: `media-${token()}`, mime_type: 'audio/ogg' } })
const texto = (body: string) => ({ text: { body } })

async function contactoDe(empresa: Empresa, waId: string): Promise<string> {
  const fila = await prisma.whatsappContact.findFirstOrThrow({
    where: { companyId: empresa.companyId, waId },
    select: { id: true },
  })
  return fila.id
}

const ANO = new Date().getUTCFullYear()

/** `created_at` explicito: fija el orden de `orders` y la fecha que ve el cliente (mismo ano: CHECK). */
async function fechar(orderId: string, at: Date): Promise<void> {
  await prisma.order.update({ where: { id: orderId }, data: { createdAt: at } })
}

async function cancelado(empresa: Empresa, customerId: string, presentationId: string, at: Date): Promise<string> {
  const { orderId } = await crearPedido(empresa.entrega, 'PENDIENTE', customerId, [{ presentationId, packages: 1 }])
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'CANCELADO', cancellationReason: 'Cancelado en la prueba' },
  })
  await fechar(orderId, at)
  return orderId
}

async function pedido(
  empresa: Empresa,
  status: OrderStatus,
  customerId: string,
  lineas: readonly { readonly presentationId: string; readonly packages: number }[],
  at: Date,
): Promise<{ readonly orderId: string; readonly lineIds: readonly string[] }> {
  const creado = await crearPedido(empresa.entrega, status, customerId, lineas)
  await fechar(creado.orderId, at)
  return creado
}

async function numeroDe(orderId: string): Promise<string> {
  const fila = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { orderYear: true, orderSequence: true } })
  return formatOrderNumber({ year: fila.orderYear, sequence: fila.orderSequence })
}

async function nombreDePresentacion(presentationId: string): Promise<string> {
  return (await prisma.presentation.findUniqueOrThrow({ where: { id: presentationId }, select: { name: true } })).name
}

type Escenario = {
  readonly A: Empresa
  readonly cliente: Cliente
  readonly contactId: string
  readonly bidon: { readonly id: string; readonly nombre: string }
  readonly garrafa: { readonly id: string; readonly nombre: string }
  /** TERMINADO, 5 bidones (2 entregados) y 3 garrafas; solicitado el 10/01 a las 23:30 UTC. */
  readonly terminado: string
  /** PENDIENTE, 1 garrafa; el abierto mas reciente (12/01). */
  readonly pendiente: string
  /** Mas recientes que los abiertos: nunca deben salir. */
  readonly entregado: string
  readonly cancelado: string
  readonly variableKey: string
}

/** Un cliente con conversacion, dos pedidos abiertos (uno con entrega parcial real), uno entregado,
 *  uno cancelado y una variable propia de la empresa. */
async function escenarioDePedidos(): Promise<Escenario> {
  const A = await crearEmpresa()
  const cliente = await alta(A)
  await entra(A, cliente.numero, 'text', texto('hola'))
  const contactId = await contactoDe(A, cliente.numero)
  const bidonId = await crearPresentacion(A.entrega, '2.0000')
  const garrafaId = await crearPresentacion(A.entrega, '1.0000')
  const terminado = await pedido(
    A,
    'TERMINADO',
    cliente.id,
    [
      { presentationId: bidonId, packages: 5 },
      { presentationId: garrafaId, packages: 3 },
    ],
    new Date(Date.UTC(ANO, 0, 10, 23, 30)),
  )
  const pendiente = await pedido(
    A,
    'PENDIENTE',
    cliente.id,
    [{ presentationId: garrafaId, packages: 1 }],
    new Date(Date.UTC(ANO, 0, 12, 8, 0)),
  )
  const entregado = await pedido(
    A,
    'ENTREGADO',
    cliente.id,
    [{ presentationId: bidonId, packages: 1 }],
    new Date(Date.UTC(ANO, 0, 14, 8, 0)),
  )
  const anulado = await cancelado(A, cliente.id, garrafaId, new Date(Date.UTC(ANO, 0, 15, 8, 0)))

  // Entrega parcial real: 2 de los 5 bidones del pedido TERMINADO.
  const productId = await crearTerminado(A.entrega, bidonId)
  const batchId = await crearLote(A.entrega, productId, bidonId, '8.0000', '2.0000')
  const entrega = await pedidos.deliverOrder(
    {
      orderId: terminado.orderId,
      deliveryKey: randomUUID(),
      customers: [
        {
          customerId: cliente.id,
          allocations: [{ presentationLineId: terminado.lineIds[0] as string, batchId, packages: 2 }],
        },
      ],
    },
    A.entrega.actor,
  )
  expect(entrega).toEqual({ status: 'delivered', orderStatus: 'TERMINADO' })

  const variableKey = `cuenta_${token().slice(0, 10)}`
  await prisma.whatsappVariableKey.create({
    data: { companyId: A.companyId, key: variableKey, label: 'Numero de cuenta', value: 'ACC-001' },
  })
  return {
    A,
    cliente,
    contactId,
    bidon: { id: bidonId, nombre: await nombreDePresentacion(bidonId) },
    garrafa: { id: garrafaId, nombre: await nombreDePresentacion(garrafaId) },
    terminado: terminado.orderId,
    pendiente: pendiente.orderId,
    entregado: entregado.orderId,
    cancelado: anulado,
    variableKey,
  }
}

// --- Lecturas -----------------------------------------------------------------------------------

/** La sesion de la ruta, doblada en `identity`: la ruta la lee ella misma (`/api/**` no pasa por el
 *  middleware). */
function sesion(actor: Actor): void {
  vi.spyOn(identity, 'getSessionUser').mockResolvedValue({
    id: actor.id,
    username: 'ana.perez',
    displayName: 'Ana Perez',
    roleName: 'Administrador',
    permissions: [...actor.permissions],
  })
  vi.spyOn(identity, 'getSessionContext').mockResolvedValue({
    userId: actor.id,
    companyId: actor.companyId,
    roleName: 'Administrador',
  })
}

function pideArchivo(messageId: string): Promise<Response> {
  return GET(new Request(`http://localhost${whatsappMediaPath(messageId)}`), {
    params: Promise.resolve({ mensajeId: messageId }),
  })
}

async function esNoEncontrado(respuesta: Response): Promise<void> {
  expect(respuesta.status).toBe(404)
  expect(await respuesta.text()).toBe('')
}

async function rechazo(operacion: () => Promise<unknown>): Promise<unknown> {
  return operacion().then(
    () => null,
    (error: unknown) => error,
  )
}

async function nombreDeEmpresa(companyId: string): Promise<string> {
  return (await prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { name: true } })).name
}

async function nombreDeReceta(recipeId: string): Promise<string> {
  return (await prisma.recipe.findUniqueOrThrow({ where: { id: recipeId }, select: { name: true } })).name
}

const PEDIDO_NULO = {
  'pedido.numero': null,
  'pedido.estado': null,
  'pedido.fecha_solicitud': null,
  'pedido.total': null,
  'pedido.detalle': null,
}

// --- Casos ----------------------------------------------------------------------------------------

describe('Archivo de un medio por la ruta GET', () => {
  it('R44, R45, R47, R48: la imagen entrante de un cliente vivo se sirve por la ruta real con el PNG del doble de Graph', async () => {
    const A = await crearEmpresa()
    const cliente = await alta(A)
    const imageId = await entra(A, cliente.numero, 'image', imagen())
    const contactId = await contactoDe(A, cliente.numero)

    const chat = await integraciones.getWhatsappChat({ target: { contactId } }, A.lector)
    const mensaje = chat.messages.find((m) => m.id === imageId)
    expect(mensaje).toMatchObject({ type: 'IMAGE', attachment: { kind: 'media', mediaUrl: whatsappMediaPath(imageId) } })
    expect(JSON.stringify(chat)).not.toContain('media-')

    sesion(A.lector)
    const respuesta = await pideArchivo(imageId)

    expect(respuesta.status).toBe(200)
    expect(respuesta.headers.get('content-type')).toBe('image/png')
    expect(respuesta.headers.get('cache-control')).toBe('private, max-age=3600')
    expect(respuesta.headers.get('x-content-type-options')).toBe('nosniff')
    expect(new Uint8Array(await respuesta.arrayBuffer())).toEqual(cannedMediaBytes())
    expect(descargas).toHaveBeenCalledTimes(1)
  })

  it('R44: la imagen pedida desde otra empresa, el audio y la imagen de un cliente dado de baja dan 404 sin cuerpo y sin llamar a Meta', async () => {
    const A = await crearEmpresa()
    const B = await crearEmpresa()
    const cliente = await alta(A)
    const imageId = await entra(A, cliente.numero, 'image', imagen())
    const audioId = await entra(A, cliente.numero, 'audio', audio())

    // Otra empresa: la sesion de B no ve el mensaje de A.
    sesion(B.lector)
    await esNoEncontrado(await pideArchivo(imageId))

    // Audio: no es un medio visible.
    sesion(A.lector)
    await esNoEncontrado(await pideArchivo(audioId))

    // Cliente dado de baja: su imagen deja de servirse.
    await baja(A, cliente.id)
    await esNoEncontrado(await pideArchivo(imageId))

    expect(descargas).not.toHaveBeenCalled()
  })
})

describe('Reacciones', () => {
  it('R49: la reaccion se casa con el id interno del mensaje reaccionado del mismo contacto, y una a un mensaje no guardado da null, sin ningun wamid', async () => {
    const A = await crearEmpresa()
    const cliente = await alta(A)
    const wamidTexto = `wamid.ctx-${token()}`
    const wamidAjeno = `wamid.ctx-${token()}`
    const textoId = await entra(A, cliente.numero, 'text', texto('mi pedido'), wamidTexto)
    const reaccionId = await entra(A, cliente.numero, 'reaction', { reaction: { message_id: wamidTexto, emoji: PULGAR } })
    const huerfanaId = await entra(A, cliente.numero, 'reaction', { reaction: { message_id: wamidAjeno, emoji: PULGAR } })
    const contactId = await contactoDe(A, cliente.numero)

    const chat = await integraciones.getWhatsappChat({ target: { contactId } }, A.lector)

    expect(chat.messages.find((m) => m.id === reaccionId)?.attachment).toEqual({
      kind: 'reaction',
      emoji: PULGAR,
      messageId: textoId,
    })
    expect(chat.messages.find((m) => m.id === huerfanaId)?.attachment).toEqual({
      kind: 'reaction',
      emoji: PULGAR,
      messageId: null,
    })
    const serializado = JSON.stringify(chat)
    expect(serializado).not.toContain(wamidTexto)
    expect(serializado).not.toContain(wamidAjeno)
  })
})

describe('Contexto del chat', () => {
  it('R51, R52, R53, R55, R56, R60, R61, R62, R63: el contexto trae los pedidos abiertos con sus envases, el numero y las siete constantes del pedido elegido', async () => {
    const e = await escenarioDePedidos()
    const recipeName = await nombreDeReceta(e.A.entrega.recipeId)
    const empresaNombre = await nombreDeEmpresa(e.A.companyId)

    // Sin `orderId`: el elegido es el abierto mas reciente (el PENDIENTE).
    const porDefecto = await integraciones.getWhatsappChatContext({ target: { contactId: e.contactId } }, e.A.lector)

    expect(porDefecto.customer).toEqual({ id: e.cliente.id, name: e.cliente.nombre })
    expect(porDefecto.selectedOrderId).toBe(e.pendiente)
    expect(porDefecto.values).toEqual({
      'cliente.nombre': e.cliente.nombre,
      'empresa.nombre': empresaNombre,
      'pedido.numero': await numeroDe(e.pendiente),
      'pedido.estado': 'recibido',
      'pedido.fecha_solicitud': `12/01/${ANO}`,
      'pedido.total': null,
      'pedido.detalle': `1 × ${e.garrafa.nombre} (entregado 0, falta 1)`,
      [e.variableKey]: 'ACC-001',
    })

    // Con `orderId` y por cliente: el TERMINADO con la entrega parcial.
    const elegido = await integraciones.getWhatsappChatContext(
      { target: { customerId: e.cliente.id }, orderId: e.terminado },
      e.A.lector,
    )

    expect(elegido.selectedOrderId).toBe(e.terminado)
    expect(elegido.orders.map((o) => o.id)).toEqual([e.pendiente, e.terminado])
    expect(elegido.orders[1]).toEqual({
      id: e.terminado,
      number: await numeroDe(e.terminado),
      status: 'TERMINADO',
      requestedAt: new Date(Date.UTC(ANO, 0, 10, 23, 30)).toISOString(),
      total: null,
      productName: recipeName,
      lines: [
        { presentationId: e.bidon.id, presentationName: e.bidon.nombre, ordered: 5, delivered: 2, pending: 3 },
        { presentationId: e.garrafa.id, presentationName: e.garrafa.nombre, ordered: 3, delivered: 0, pending: 3 },
      ],
    })
    expect(elegido.values).toEqual({
      'cliente.nombre': e.cliente.nombre,
      'empresa.nombre': empresaNombre,
      'pedido.numero': await numeroDe(e.terminado),
      'pedido.estado': 'en preparación',
      'pedido.fecha_solicitud': `10/01/${ANO}`,
      'pedido.total': null,
      'pedido.detalle': `5 × ${e.bidon.nombre} (entregado 2, faltan 3); 3 × ${e.garrafa.nombre} (entregado 0, faltan 3)`,
      [e.variableKey]: 'ACC-001',
    })
    expect(elegido.values['pedido.detalle']).not.toMatch(/[\n\t]/u)
  })

  it('R54, D12: un pedido entregado y uno cancelado, aunque sean los mas recientes, no salen en orders', async () => {
    const e = await escenarioDePedidos()

    const contexto = await integraciones.getWhatsappChatContext({ target: { contactId: e.contactId } }, e.A.lector)

    const ids = contexto.orders.map((o) => o.id)
    expect(ids).toEqual([e.pendiente, e.terminado])
    expect(ids).not.toContain(e.entregado)
    expect(ids).not.toContain(e.cancelado)
    expect(contexto.selectedOrderId).toBe(e.pendiente)
  })

  it('R54, R55, R56: un cliente con solo pedidos cerrados da orders vacio, ningun elegido y todas las pedido.* nulas', async () => {
    const A = await crearEmpresa()
    const cliente = await alta(A)
    await entra(A, cliente.numero, 'text', texto('hola'))
    const contactId = await contactoDe(A, cliente.numero)
    const presentationId = await crearPresentacion(A.entrega, '2.0000')
    await pedido(A, 'ENTREGADO', cliente.id, [{ presentationId, packages: 2 }], new Date(Date.UTC(ANO, 0, 5, 8, 0)))
    await cancelado(A, cliente.id, presentationId, new Date(Date.UTC(ANO, 0, 6, 8, 0)))

    const contexto = await integraciones.getWhatsappChatContext({ target: { contactId } }, A.lector)

    expect(contexto.orders).toEqual([])
    expect(contexto.selectedOrderId).toBeNull()
    expect(contexto.values).toEqual({
      'cliente.nombre': cliente.nombre,
      'empresa.nombre': await nombreDeEmpresa(A.companyId),
      ...PEDIDO_NULO,
    })
  })

  it('R54, R57: un orderId de otra empresa, de otro cliente o entregado se rechaza con order_not_found', async () => {
    const e = await escenarioDePedidos()
    const B = await crearEmpresa()
    const deB = await alta(B)
    const presentacionB = await crearPresentacion(B.entrega, '2.0000')
    const ajenoDeEmpresa = await pedido(B, 'PENDIENTE', deB.id, [{ presentationId: presentacionB, packages: 1 }], new Date(Date.UTC(ANO, 0, 11, 8, 0)))
    const otroCliente = await alta(e.A)
    const ajenoDeCliente = await pedido(e.A, 'PENDIENTE', otroCliente.id, [{ presentationId: e.bidon.id, packages: 1 }], new Date(Date.UTC(ANO, 0, 11, 8, 0)))

    for (const orderId of [ajenoDeEmpresa.orderId, ajenoDeCliente.orderId, e.entregado, e.cancelado]) {
      expect(
        await rechazo(() =>
          integraciones.getWhatsappChatContext({ target: { contactId: e.contactId }, orderId }, e.A.lector),
        ),
      ).toMatchObject({ code: 'order_not_found' })
    }
  })

  it('R57: pedir el contexto no mueve la marca de lectura ni escribe nada', async () => {
    const e = await escenarioDePedidos()
    // Sin marca: pedir el contexto no marca leido.
    await integraciones.getWhatsappChatContext({ target: { contactId: e.contactId } }, e.A.lector)
    expect((await prisma.whatsappContact.findUniqueOrThrow({ where: { id: e.contactId } })).lastReadAt).toBeNull()
    expect((await integraciones.getWhatsappChat({ target: { contactId: e.contactId } }, e.A.lector)).contact).toMatchObject({
      unreadCount: 1,
    })

    // Con marca: queda exactamente como estaba.
    expect(await integraciones.markWhatsappChatRead({ contactId: e.contactId }, e.A.lector)).toEqual({ unreadCount: 0 })
    const contactoAntes = await prisma.whatsappContact.findUniqueOrThrow({ where: { id: e.contactId } })
    const mensajesAntes = await prisma.whatsappMessage.findMany({ where: { companyId: e.A.companyId }, orderBy: { id: 'asc' } })
    const pedidosAntes = await prisma.order.findMany({ where: { companyId: e.A.companyId }, orderBy: { id: 'asc' } })
    expect(contactoAntes.lastReadAt).not.toBeNull()

    await integraciones.getWhatsappChatContext({ target: { contactId: e.contactId } }, e.A.lector)
    await integraciones.getWhatsappChatContext({ target: { customerId: e.cliente.id }, orderId: e.terminado }, e.A.lector)

    expect(await prisma.whatsappContact.findUniqueOrThrow({ where: { id: e.contactId } })).toEqual(contactoAntes)
    expect(await prisma.whatsappMessage.findMany({ where: { companyId: e.A.companyId }, orderBy: { id: 'asc' } })).toEqual(mensajesAntes)
    expect(await prisma.order.findMany({ where: { companyId: e.A.companyId }, orderBy: { id: 'asc' } })).toEqual(pedidosAntes)
    const chat = await integraciones.getWhatsappChat({ target: { contactId: e.contactId } }, e.A.lector)
    expect(chat.contact).toMatchObject({ id: e.contactId, unreadCount: 0 })
  })
})
