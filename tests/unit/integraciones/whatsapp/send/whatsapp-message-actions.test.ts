// Las Server Actions del envio contra dobles de `@/lib/composition`: se prueba el borde (actor,
// argumentos, forma exacta de `data`, rama `missing_values`, traduccion de errores y logs), nunca el
// dominio ni la sesion reales.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  retryWhatsappMessageAction,
  sendWhatsappMessageAction,
} from '@/lib/modules/integraciones/adapters/driving/whatsapp-message-actions'
import { errorMessage } from '@/lib/modules/errores'
import {
  UnauthorizedError,
  ValidationError,
  WhatsappConnectionNotFoundError,
  WhatsappTemplateNotFoundError,
  WhatsappTemplateValuesMissingError,
  type WhatsappOutboundMessageView,
} from '@/lib/modules/integraciones'
import {
  WhatsappConnectionNotActiveError,
  WhatsappContactBlockedError,
  WhatsappMessageNotRetryableError,
  WhatsappWindowClosedError,
} from '@/lib/modules/integraciones/domain/errors'

const { sendMock, retryMock, getSessionUserMock, getSessionContextMock, readRequestIdHeaderMock } = vi.hoisted(
  () => ({
    sendMock: vi.fn(),
    retryMock: vi.fn(),
    getSessionUserMock: vi.fn(),
    getSessionContextMock: vi.fn(),
    readRequestIdHeaderMock: vi.fn(async () => '7c9e6679-7425-40de-944b-e07fc1f90ae7'),
  }),
)

vi.mock('@/lib/composition', () => ({
  observabilidad: { readRequestIdHeader: readRequestIdHeaderMock },
  identity: { getSessionUser: getSessionUserMock, getSessionContext: getSessionContextMock },
  integraciones: { sendWhatsappMessage: sendMock, retryWhatsappMessage: retryMock },
}))

const REQUEST_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const COMPANY_ID = '22222222-2222-4222-8222-222222222222'
const CONTACT_ID = '33333333-3333-4333-8333-333333333333'
const TEMPLATE_ID = '44444444-4444-4444-8444-444444444444'
const MESSAGE_ID = '55555555-5555-4555-8555-555555555555'
const FAILED_ID = '66666666-6666-4666-8666-666666666666'

const SECRET_TEXT = 'Su saldo pendiente es de 1520 pesos'
const SECRET_VALUE = 'Ana Secreta Perez'
const SECRET_WA_ID = '5215512345678'
const ACCESS_TOKEN = 'EAAG-token-de-prueba-que-no-debe-salir'

const SESSION_USER = {
  id: 'user-admin-1',
  username: 'ana.perez',
  displayName: 'Ana Perez',
  roleName: 'Administrador',
  permissions: ['whatsapp.enviar'],
}

const ACTOR = { id: SESSION_USER.id, companyId: COMPANY_ID, permissions: SESSION_USER.permissions }

const VIEW: WhatsappOutboundMessageView = {
  id: MESSAGE_ID,
  type: 'TEXT',
  status: 'SENT',
  body: SECRET_TEXT,
  templateName: null,
  templateLanguage: null,
  errorCode: null,
  errorReason: null,
  createdAt: '2026-10-23T12:00:00.000Z',
}

const FAILED_VIEW: WhatsappOutboundMessageView = {
  ...VIEW,
  status: 'FAILED',
  errorCode: '131000',
  errorReason: 'Meta no acepto el mensaje (codigo 131000). Intenta de nuevo o revisa la conexion.',
}

const DIAGNOSTIC = 'Graph enviar mensaje: rejected; code=131000; subcode=-'

const SEND_INPUT = { kind: 'text', recipient: { contactId: CONTACT_ID }, text: SECRET_TEXT }
const TEMPLATE_INPUT = {
  kind: 'template',
  recipient: { contactId: CONTACT_ID },
  templateId: TEMPLATE_ID,
  constants: { 'cliente.nombre': SECRET_VALUE },
  constantLabels: { 'cliente.nombre': 'Nombre del cliente' },
}
const RETRY_INPUT = { messageId: FAILED_ID, constants: { 'cliente.nombre': SECRET_VALUE } }

const ACTIONS = {
  send: () => sendWhatsappMessageAction(SEND_INPUT),
  retry: () => retryWhatsappMessageAction(RETRY_INPUT),
} as const

const USE_CASE_OF = { send: sendMock, retry: retryMock } as const

const VIEW_KEYS = [
  'body',
  'createdAt',
  'errorCode',
  'errorReason',
  'id',
  'status',
  'templateLanguage',
  'templateName',
  'type',
]

let warnSpy: ReturnType<typeof vi.spyOn>
let errorSpy: ReturnType<typeof vi.spyOn>
let infoSpy: ReturnType<typeof vi.spyOn>
let logSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  getSessionUserMock.mockResolvedValue(SESSION_USER)
  getSessionContextMock.mockResolvedValue({ companyId: COMPANY_ID })
  sendMock.mockResolvedValue({ message: VIEW, diagnostic: null })
  retryMock.mockResolvedValue({ message: VIEW, diagnostic: null })
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function everythingLogged(): string {
  return JSON.stringify([
    ...warnSpy.mock.calls,
    ...errorSpy.mock.calls,
    ...infoSpy.mock.calls,
    ...logSpy.mock.calls,
  ])
}

describe('R45: el envio y el reintento como Server Actions', () => {
  it('R45: enviar pasa la entrada tal cual y el actor de la sesion, y devuelve success con la vista', async () => {
    const result = await sendWhatsappMessageAction(TEMPLATE_INPUT)
    expect(result).toEqual({ status: 'success', data: VIEW })
    expect(sendMock).toHaveBeenCalledWith(TEMPLATE_INPUT, ACTOR)
  })

  it('R45: reintentar pasa la entrada tal cual y el actor de la sesion, y devuelve success con la vista', async () => {
    const result = await ACTIONS.retry()
    expect(result).toEqual({ status: 'success', data: VIEW })
    expect(retryMock).toHaveBeenCalledWith(RETRY_INPUT, ACTOR)
  })

  it('R45: sin sesion o sin empresa pasan actor null, y el unauthorized del caso de uso sale con su codigo', async () => {
    for (const [name, action] of Object.entries(ACTIONS)) {
      for (const sinSesion of ['usuario', 'empresa'] as const) {
        vi.clearAllMocks()
        getSessionUserMock.mockResolvedValue(sinSesion === 'usuario' ? null : SESSION_USER)
        getSessionContextMock.mockResolvedValue(sinSesion === 'empresa' ? null : { companyId: COMPANY_ID })
        USE_CASE_OF[name as keyof typeof ACTIONS].mockRejectedValueOnce(new UnauthorizedError())
        const result = await action()
        expect(USE_CASE_OF[name as keyof typeof ACTIONS], `${name} / ${sinSesion}`).toHaveBeenCalledWith(
          expect.anything(),
          null,
        )
        expect(result, `${name} / ${sinSesion}`).toEqual({
          status: 'error',
          code: 'unauthorized',
          message: errorMessage('unauthorized'),
        })
      }
    }
  })

  it('R45: cada error del catalogo sale como ErrorState con el texto del catalogo y sin diagnostico', async () => {
    const errors = [
      new ValidationError('entrada rara'),
      new WhatsappConnectionNotFoundError(),
      new WhatsappConnectionNotActiveError(),
      new WhatsappContactBlockedError(),
      new WhatsappWindowClosedError(),
      new WhatsappTemplateNotFoundError(),
      new WhatsappMessageNotRetryableError(`Mensaje ${FAILED_ID}: sin contenido que reenviar`),
    ]
    for (const [name, action] of Object.entries(ACTIONS)) {
      for (const error of errors) {
        USE_CASE_OF[name as keyof typeof ACTIONS].mockRejectedValueOnce(error)
        const result = await action()
        expect(result, `${name} / ${error.code}`).toEqual({
          status: 'error',
          code: error.code,
          message: errorMessage(error.code),
        })
      }
    }
  })

  it('R45: un error ajeno al dominio sale como `unexpected` con referencia y sin su texto', async () => {
    const foreign = new Error(`fallo con ${ACCESS_TOKEN} dentro`)
    for (const [name, action] of Object.entries(ACTIONS)) {
      USE_CASE_OF[name as keyof typeof ACTIONS].mockRejectedValueOnce(foreign)
      const result = await action()
      expect(result, name).toEqual({
        status: 'error',
        code: 'unexpected',
        message: errorMessage('unexpected'),
        reference: REQUEST_ID,
      })
      expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN)
    }
  })

  it('R45: el borde no decide: use server, sin permiso, esquema, ORM, adaptadores driven ni revalidacion', () => {
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '..', '..', '..', '..', '..',
        'lib', 'modules', 'integraciones', 'adapters', 'driving', 'whatsapp-message-actions.ts',
      ),
      'utf8',
    )
    expect(source.startsWith("'use server';")).toBe(true)
    expect(source).not.toMatch(/requirePermission|requireSendPermission|whatsapp\.enviar|Administrador/)
    expect(source).not.toMatch(/Schema\b|from 'zod'/)
    expect(source).not.toMatch(/@prisma\/client|prisma\./)
    expect(source).not.toMatch(/adapters\/driven|\.\.\/driven/)
    expect(source).not.toMatch(/revalidatePath|next\/cache/)
  })
})

describe('R37: el mensaje escrito es un resultado correcto, tambien si Meta lo rechazo', () => {
  it('R37: un mensaje SENT sale como success con exactamente las claves de la vista', async () => {
    for (const [name, action] of Object.entries(ACTIONS)) {
      const result = await action()
      expect(result, name).toEqual({ status: 'success', data: VIEW })
      if (result.status !== 'success') throw new Error(name)
      expect(Object.keys(result.data).sort(), name).toEqual(VIEW_KEYS)
    }
  })

  it('R37: un mensaje FAILED por Meta sale como success con su errorCode y errorReason, no como error', async () => {
    for (const [name, action] of Object.entries(ACTIONS)) {
      USE_CASE_OF[name as keyof typeof ACTIONS].mockResolvedValueOnce({ message: FAILED_VIEW, diagnostic: DIAGNOSTIC })
      const result = await action()
      expect(result, name).toEqual({ status: 'success', data: FAILED_VIEW })
    }
  })

  it('R37: si el caso de uso devolviera claves de mas, no salen de la accion', async () => {
    const leaky = { ...VIEW, waId: SECRET_WA_ID, accessToken: ACCESS_TOKEN, payload: { x: SECRET_VALUE } }
    for (const [name, action] of Object.entries(ACTIONS)) {
      USE_CASE_OF[name as keyof typeof ACTIONS].mockResolvedValueOnce({ message: leaky, diagnostic: null })
      const result = await action()
      expect(result, name).toEqual({ status: 'success', data: VIEW })
      expect(JSON.stringify(result)).not.toContain(SECRET_WA_ID)
      expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN)
    }
  })
})

describe('R24: la constante faltante sale por la rama missing_values', () => {
  it('R24: una constante faltante sale con su etiqueta en el texto y su clave en la lista', async () => {
    for (const [name, action] of Object.entries(ACTIONS)) {
      USE_CASE_OF[name as keyof typeof ACTIONS].mockRejectedValueOnce(
        new WhatsappTemplateValuesMissingError([{ key: 'cliente.nombre', label: 'Nombre del cliente' }]),
      )
      const result = await action()
      expect(result, name).toEqual({
        status: 'missing_values',
        message: 'Falta el valor de Nombre del cliente',
        missing: [{ key: 'cliente.nombre', label: 'Nombre del cliente' }],
      })
    }
  })

  it('R24: varias faltantes se nombran todas, en orden, con «, » y «y»', async () => {
    const missing = [
      { key: 'cliente.nombre', label: 'Nombre del cliente' },
      { key: 'cliente.ciudad', label: 'Ciudad' },
      { key: 'pedido.numero', label: 'pedido.numero' },
    ]
    sendMock.mockRejectedValueOnce(new WhatsappTemplateValuesMissingError(missing))
    expect(await ACTIONS.send()).toEqual({
      status: 'missing_values',
      message: 'Falta el valor de Nombre del cliente, Ciudad y pedido.numero',
      missing,
    })

    sendMock.mockRejectedValueOnce(new WhatsappTemplateValuesMissingError(missing.slice(0, 2)))
    expect(await ACTIONS.send()).toMatchObject({ message: 'Falta el valor de Nombre del cliente y Ciudad' })
  })

  it('R24: la rama missing_values no lleva diagnostico, referencia ni campos de ErrorState', async () => {
    sendMock.mockRejectedValueOnce(
      new WhatsappTemplateValuesMissingError([{ key: 'cliente.nombre', label: 'Nombre del cliente' }], 'interno'),
    )
    const result = await ACTIONS.send()
    expect(Object.keys(result).sort()).toEqual(['message', 'missing', 'status'])
    expect(JSON.stringify(result)).not.toContain('interno')
  })
})

describe('R46: los logs no llevan el texto, los valores, el numero ni el token', () => {
  it('R46: un fallo de Meta se avisa con el id del mensaje y el diagnostico, y nada mas', async () => {
    sendMock.mockResolvedValueOnce({ message: FAILED_VIEW, diagnostic: DIAGNOSTIC })
    await ACTIONS.send()
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith('whatsapp_send_failed', { messageId: MESSAGE_ID, diagnostic: DIAGNOSTIC })
  })

  it('R46: un envio correcto no escribe nada en el log', async () => {
    for (const action of Object.values(ACTIONS)) await action()
    expect(everythingLogged()).toBe('[]')
  })

  it('R46: en exito, fallo de Meta, rechazo previo, faltantes o error ajeno, ningun log lleva texto, valores, numero ni token', async () => {
    const outcomes = [
      () => sendMock.mockResolvedValueOnce({ message: VIEW, diagnostic: null }),
      () => sendMock.mockResolvedValueOnce({ message: FAILED_VIEW, diagnostic: DIAGNOSTIC }),
      () => sendMock.mockRejectedValueOnce(new WhatsappWindowClosedError()),
      () =>
        sendMock.mockRejectedValueOnce(
          new WhatsappTemplateValuesMissingError([{ key: 'cliente.nombre', label: 'Nombre del cliente' }]),
        ),
      () => sendMock.mockRejectedValueOnce(new Error('fallo de red')),
    ]
    for (const prepare of outcomes) {
      prepare()
      await sendWhatsappMessageAction(TEMPLATE_INPUT)
      await sendWhatsappMessageAction(SEND_INPUT)
    }
    const logged = everythingLogged()
    expect(logged).not.toContain(SECRET_TEXT)
    expect(logged).not.toContain(SECRET_VALUE)
    expect(logged).not.toContain(SECRET_WA_ID)
    expect(logged).not.toContain(ACCESS_TOKEN)
  })
})
