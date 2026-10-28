// La ruta del archivo de un medio contra dobles de `@/lib/composition`: se prueba el borde (actor,
// argumentos, estados, cabeceras, cuerpo y logs). El caso de "sin permiso" usa la fabrica real del
// caso de uso para comprobar que ni la base ni Meta se tocan.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { GET } from '@/lib/modules/integraciones/adapters/driving/whatsapp-media-route'
import {
  createGetWhatsappMedia,
  SecretUnreadableError,
  UnauthorizedError,
  ValidationError,
  type WhatsappMediaResult,
} from '@/lib/modules/integraciones'
import { WhatsappMessageNotFoundError } from '@/lib/modules/integraciones/domain/errors'

const { mediaMock, getSessionUserMock, getSessionContextMock } = vi.hoisted(() => ({
  mediaMock: vi.fn(),
  getSessionUserMock: vi.fn(),
  getSessionContextMock: vi.fn(),
}))

vi.mock('@/lib/composition', () => ({
  identity: { getSessionUser: getSessionUserMock, getSessionContext: getSessionContextMock },
  integraciones: { getWhatsappMedia: mediaMock },
}))

const COMPANY_ID = '22222222-2222-4222-8222-222222222222'
const MESSAGE_ID = '55555555-5555-4555-8555-555555555555'
const MEDIA_ID = '1234567890123456'
const META_URL = 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1234567890123456'
const ACCESS_TOKEN = 'EAAG-token-de-prueba-que-no-debe-salir'
const SECRET_BODY = 'Su saldo pendiente es de 1520 pesos'
const SECRET_PHONE = '+52 1 55 1234 5678'
const SECRET_NAME = 'Ana Secreta Perez'
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const SESSION_USER = {
  id: 'user-admin-1',
  username: 'ana.perez',
  displayName: 'Ana Perez',
  roleName: 'Administrador',
  permissions: ['whatsapp.consultar'],
}
const ACTOR = { id: SESSION_USER.id, companyId: COMPANY_ID, permissions: SESSION_USER.permissions }

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..')
const ADAPTER_SOURCE = readFileSync(
  join(ROOT, 'lib', 'modules', 'integraciones', 'adapters', 'driving', 'whatsapp-media-route.ts'),
  'utf8',
)
const ROUTE_SOURCE = readFileSync(
  join(ROOT, 'app', 'api', 'integraciones', 'whatsapp', 'media', '[mensajeId]', 'route.ts'),
  'utf8',
)

function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

function file(contentLength: number | null = PNG.byteLength, contentType = 'image/png'): WhatsappMediaResult {
  return { kind: 'file', contentType, contentLength, body: streamOf(PNG) }
}

function request(messageId: string = MESSAGE_ID): Promise<Response> {
  return GET(new Request(`http://localhost/api/media/${messageId}`), {
    params: Promise.resolve({ mensajeId: messageId }),
  })
}

let errorSpy: ReturnType<typeof vi.spyOn>
let warnSpy: ReturnType<typeof vi.spyOn>
let infoSpy: ReturnType<typeof vi.spyOn>
let logSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  getSessionUserMock.mockResolvedValue(SESSION_USER)
  getSessionContextMock.mockResolvedValue({ companyId: COMPANY_ID })
  mediaMock.mockImplementation(async () => file())
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function everythingLogged(): string {
  return JSON.stringify([...errorSpy.mock.calls, ...warnSpy.mock.calls, ...infoSpy.mock.calls, ...logSpy.mock.calls])
}

function headersOf(response: Response): string {
  return JSON.stringify([...response.headers.entries()])
}

async function expectNoBody(response: Response, status: number, label: string): Promise<void> {
  expect(response.status, label).toBe(status)
  expect(response.body, label).toBeNull()
  expect(await response.text(), label).toBe('')
  expect(response.headers.get('content-type'), label).toBeNull()
}

describe('R58: la ruta GET lee la sesion y pasa el id del mensaje al caso de uso', () => {
  it('R58: pasa { messageId } y el actor de la sesion', async () => {
    await request()
    expect(mediaMock).toHaveBeenCalledWith({ messageId: MESSAGE_ID }, ACTOR)
  })

  it('R44, R58: sin usuario o sin empresa en la sesion pasa actor null y responde 404 sin cuerpo', async () => {
    for (const sinSesion of ['usuario', 'empresa'] as const) {
      vi.clearAllMocks()
      getSessionUserMock.mockResolvedValue(sinSesion === 'usuario' ? null : SESSION_USER)
      getSessionContextMock.mockResolvedValue(sinSesion === 'empresa' ? null : { companyId: COMPANY_ID })
      mediaMock.mockRejectedValueOnce(new UnauthorizedError())
      const response = await request()
      expect(mediaMock.mock.calls[0]?.[1], sinSesion).toBeNull()
      await expectNoBody(response, 404, sinSesion)
    }
  })

  it('R58: el archivo de ruta reexporta GET del adaptador y fija runtime nodejs con un literal', () => {
    expect(ROUTE_SOURCE).toContain(
      "export { GET } from '@/lib/modules/integraciones/adapters/driving/whatsapp-media-route';",
    )
    expect(ROUTE_SOURCE).toMatch(/export const runtime = 'nodejs';/)
  })

  it('R58: el adaptador no decide: sin permiso, esquema, ORM ni adaptadores driven', () => {
    expect(ADAPTER_SOURCE).not.toMatch(/requireReadPermission|whatsapp\.consultar/)
    expect(ADAPTER_SOURCE).not.toMatch(/from 'zod'/)
    expect(ADAPTER_SOURCE).not.toMatch(/@prisma\/client|prisma\./)
    expect(ADAPTER_SOURCE).not.toMatch(/adapters\/driven|\.\.\/driven/)
  })
})

describe('R44: todo lo que no se puede ver da el mismo 404 sin cuerpo', () => {
  it('R44: sin el permiso whatsapp.consultar, el caso de uso real responde 404 sin tocar la base ni Meta', async () => {
    const untouchable = (): never => {
      throw new Error('no deberia llamarse')
    }
    const findLive = vi.fn(untouchable)
    const findMediaMessage = vi.fn(untouchable)
    const findAliveRefById = vi.fn(untouchable)
    const downloadMedia = vi.fn(untouchable)
    const decrypt = vi.fn(untouchable)
    const real = createGetWhatsappMedia({
      connections: { findLive, update: vi.fn(untouchable) },
      conversations: { findMediaMessage },
      customers: { findAliveRefById },
      graph: { downloadMedia },
      cipher: { decrypt, encrypt: vi.fn(untouchable) },
    } as unknown as Parameters<typeof createGetWhatsappMedia>[0])
    mediaMock.mockImplementation(real)
    getSessionUserMock.mockResolvedValue({ ...SESSION_USER, permissions: ['clientes.consultar'] })

    await expectNoBody(await request(), 404, 'sin permiso')
    for (const spy of [findLive, findMediaMessage, findAliveRefById, downloadMedia, decrypt]) {
      expect(spy).not.toHaveBeenCalled()
    }
  })

  it('R44: unauthorized, invalid_input y whatsapp_message_not_found responden igual: 404 sin cuerpo', async () => {
    for (const error of [new UnauthorizedError(), new ValidationError('x'), new WhatsappMessageNotFoundError()]) {
      mediaMock.mockRejectedValueOnce(error)
      await expectNoBody(await request(), 404, error.code)
    }
  })

  it('R44: un id que no es un uuid llega al caso de uso, que lo rechaza: 404 y nada en el log', async () => {
    mediaMock.mockRejectedValueOnce(new ValidationError())
    await expectNoBody(await request('no-es-un-uuid'), 404, 'id raro')
    expect(everythingLogged()).toBe('[]')
  })
})

describe('R46: Meta no lo sirve: 502 sin cuerpo', () => {
  it('R46: el resultado unavailable responde 502 sin cuerpo y sin log', async () => {
    mediaMock.mockResolvedValueOnce({ kind: 'unavailable' })
    await expectNoBody(await request(), 502, 'unavailable')
    expect(everythingLogged()).toBe('[]')
  })

  it('R46: un error de dominio fuera de los de 404 responde 500 sin cuerpo', async () => {
    mediaMock.mockRejectedValueOnce(new SecretUnreadableError('version desconocida'))
    await expectNoBody(await request(), 500, 'secreto')
  })

  it('R46: un error ajeno responde 500 sin cuerpo y deja una linea en el log', async () => {
    mediaMock.mockRejectedValueOnce(new Error('fallo de red'))
    await expectNoBody(await request(), 500, 'ajeno')
    expect(everythingLogged()).toContain('fallo de red')
  })
})

describe('R47: la respuesta con el archivo', () => {
  it('R45, R47: 200 con el cuerpo, su tipo, su largo, privado para la cache, nosniff e inline', async () => {
    const response = await request()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('content-length')).toBe(String(PNG.byteLength))
    expect(response.headers.get('cache-control')).toBe('private, max-age=3600')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('content-disposition')).toBe('inline')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG)
  })

  it('R47: sin largo conocido no manda Content-Length y mantiene el resto de cabeceras', async () => {
    mediaMock.mockResolvedValueOnce(file(null, 'image/webp'))
    const response = await request()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/webp')
    expect(response.headers.has('content-length')).toBe(false)
    expect(response.headers.get('cache-control')).toBe('private, max-age=3600')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('R47: ninguna respuesta lleva el id del archivo en Meta, su URL ni el token', async () => {
    const responses: Response[] = []
    responses.push(await request())
    mediaMock.mockResolvedValueOnce({ kind: 'unavailable' })
    responses.push(await request())
    mediaMock.mockRejectedValueOnce(new WhatsappMessageNotFoundError(`media ${MEDIA_ID}`))
    responses.push(await request())
    mediaMock.mockRejectedValueOnce(new Error(`fallo con ${ACCESS_TOKEN}`))
    responses.push(await request())
    for (const response of responses) {
      const visible = headersOf(response) + (await response.text())
      for (const leak of [MEDIA_ID, META_URL, ACCESS_TOKEN]) expect(visible).not.toContain(leak)
    }
  })
})

describe('R58: los logs no llevan el id del mensaje, el del archivo, el cuerpo, el numero ni el nombre', () => {
  it('R58: el exito, el 404 y el 502 no escriben nada', async () => {
    await request()
    mediaMock.mockRejectedValueOnce(new WhatsappMessageNotFoundError())
    await request()
    mediaMock.mockResolvedValueOnce({ kind: 'unavailable' })
    await request()
    expect(everythingLogged()).toBe('[]')
  })

  it('R58: el log de un 500 no lleva el id del mensaje, aunque viaje en la ruta', async () => {
    mediaMock.mockRejectedValueOnce(new SecretUnreadableError('version desconocida'))
    await request()
    mediaMock.mockRejectedValueOnce(new Error('fallo de red'))
    await request()
    const logged = everythingLogged()
    expect(logged).toContain('integration_secret_unreadable')
    expect(logged).not.toContain('version desconocida')
    for (const leak of [MESSAGE_ID, MEDIA_ID, META_URL, ACCESS_TOKEN, SECRET_BODY, SECRET_PHONE, SECRET_NAME]) {
      expect(logged).not.toContain(leak)
    }
  })

  it('R58: el adaptador solo escribe en la consola desde el registro del 500', () => {
    expect(ADAPTER_SOURCE.match(/console\.\w+/g)).toEqual(['console.error', 'console.error'])
  })
})
