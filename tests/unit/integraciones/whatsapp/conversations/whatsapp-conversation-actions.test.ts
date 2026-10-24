// Las Server Actions de la consulta de conversaciones contra dobles de `@/lib/composition`: se prueba
// el borde (actor, argumentos, forma exacta de `data`, traduccion de errores y logs), nunca el
// dominio ni la sesion reales.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as conversationActions from '@/lib/modules/integraciones/adapters/driving/whatsapp-conversation-actions'
import {
  getWhatsappChatAction,
  listSendableWhatsappTemplatesAction,
  listWhatsappConversationsAction,
  markWhatsappChatReadAction,
} from '@/lib/modules/integraciones/adapters/driving/whatsapp-conversation-actions'
import { errorMessage } from '@/lib/modules/errores'
import {
  LinkedCustomerNotFoundError,
  UnauthorizedError,
  ValidationError,
  WhatsappContactNotFoundError,
  type WhatsappChat,
  type WhatsappConversationList,
  type WhatsappSendableTemplate,
} from '@/lib/modules/integraciones'
import { WhatsappMessageNotFoundError } from '@/lib/modules/integraciones/domain/errors'

const { listMock, chatMock, markMock, templatesMock, getSessionUserMock, getSessionContextMock, readRequestIdHeaderMock } =
  vi.hoisted(() => ({
    listMock: vi.fn(),
    chatMock: vi.fn(),
    markMock: vi.fn(),
    templatesMock: vi.fn(),
    getSessionUserMock: vi.fn(),
    getSessionContextMock: vi.fn(),
    readRequestIdHeaderMock: vi.fn(async () => '7c9e6679-7425-40de-944b-e07fc1f90ae7'),
  }))

vi.mock('@/lib/composition', () => ({
  observabilidad: { readRequestIdHeader: readRequestIdHeaderMock },
  identity: { getSessionUser: getSessionUserMock, getSessionContext: getSessionContextMock },
  integraciones: {
    listWhatsappConversations: listMock,
    getWhatsappChat: chatMock,
    markWhatsappChatRead: markMock,
    listSendableWhatsappTemplates: templatesMock,
  },
}))

const REQUEST_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const COMPANY_ID = '22222222-2222-4222-8222-222222222222'
const CONTACT_ID = '33333333-3333-4333-8333-333333333333'
const CUSTOMER_ID = '44444444-4444-4444-8444-444444444444'
const MESSAGE_ID = '55555555-5555-4555-8555-555555555555'
const TEMPLATE_ID = '66666666-6666-4666-8666-666666666666'

const SECRET_BODY = 'Su saldo pendiente es de 1520 pesos'
const SECRET_PHONE = '+52 1 55 1234 5678'
const SECRET_NAME = 'Ana Secreta Perez'
const SECRET_WA_ID = '5215512345678'
const ACCESS_TOKEN = 'EAAG-token-de-prueba-que-no-debe-salir'

const SESSION_USER = {
  id: 'user-admin-1',
  username: 'ana.perez',
  displayName: 'Ana Perez',
  roleName: 'Administrador',
  permissions: ['whatsapp.consultar'],
}

const ACTOR = { id: SESSION_USER.id, companyId: COMPANY_ID, permissions: SESSION_USER.permissions }

const LIST: WhatsappConversationList = {
  connectionStatus: 'ACTIVE',
  page: {
    items: [
      {
        contactId: CONTACT_ID,
        customerId: CUSTOMER_ID,
        customerName: SECRET_NAME,
        phone: SECRET_PHONE,
        isBlocked: false,
        unreadCount: 2,
        lastMessage: { direction: 'IN', type: 'TEXT', preview: SECRET_BODY, status: 'RECEIVED', at: '2026-10-23T12:00:00.000Z' },
      },
    ],
    total: 1,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  },
}

const CHAT: WhatsappChat = {
  connectionStatus: 'ACTIVE',
  contact: { id: CONTACT_ID, phone: SECRET_PHONE, isBlocked: false, unreadCount: 1 },
  customer: { id: CUSTOMER_ID, name: SECRET_NAME },
  window: { open: true, closesAt: '2026-10-24T12:00:00.000Z' },
  messages: [
    {
      id: MESSAGE_ID,
      direction: 'IN',
      type: 'IMAGE',
      body: null,
      attachment: { kind: 'media', mimeType: 'image/jpeg', filename: null, caption: 'foto' },
      status: 'RECEIVED',
      errorReason: null,
      origin: null,
      sentBy: null,
      templateName: null,
      at: '2026-10-23T11:00:00.000Z',
    },
    {
      id: '77777777-7777-4777-8777-777777777777',
      direction: 'IN',
      type: 'LOCATION',
      body: null,
      attachment: { kind: 'location', latitude: 19.4, longitude: -99.1, name: 'Oficina', address: null },
      status: 'RECEIVED',
      errorReason: null,
      origin: null,
      sentBy: null,
      templateName: null,
      at: '2026-10-23T11:01:00.000Z',
    },
    {
      id: '88888888-8888-4888-8888-888888888888',
      direction: 'IN',
      type: 'REACTION',
      body: null,
      attachment: { kind: 'reaction', emoji: null },
      status: 'RECEIVED',
      errorReason: null,
      origin: null,
      sentBy: null,
      templateName: null,
      at: '2026-10-23T11:02:00.000Z',
    },
    {
      id: '99999999-9999-4999-8999-999999999999',
      direction: 'OUT',
      type: 'TEXT',
      body: SECRET_BODY,
      attachment: null,
      status: 'FAILED',
      errorReason: 'Meta no acepto el mensaje.',
      origin: 'USER',
      sentBy: { id: 'user-admin-1', displayName: 'Ana Perez' },
      templateName: null,
      at: '2026-10-23T12:00:00.000Z',
    },
  ],
  hasMore: true,
  nextCursor: MESSAGE_ID,
}

const EMPTY_CHAT: WhatsappChat = {
  connectionStatus: null,
  contact: null,
  customer: { id: CUSTOMER_ID, name: SECRET_NAME },
  window: { open: false, closesAt: null },
  messages: [],
  hasMore: false,
  nextCursor: null,
}

const TEMPLATE: WhatsappSendableTemplate = {
  id: TEMPLATE_ID,
  name: 'aviso_saldo',
  language: 'es_MX',
  category: 'UTILITY',
  content: {
    header: { text: 'Hola {{cliente.nombre}}', example: null },
    body: { text: 'Tu codigo es {{codigo}}', examples: ['1234'] },
    footer: 'Gracias',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Si' },
      { type: 'URL', text: 'Ver', url: 'https://x.test/{{1}}', example: 'https://x.test/a' },
      { type: 'PHONE_NUMBER', text: 'Llamar', phoneNumber: '+525512345678' },
    ],
  },
  variables: [
    { slot: 'header', position: 1, kind: 'system', key: 'cliente.nombre', label: null, value: null },
    { slot: 'body.1', position: 1, kind: 'company', key: 'codigo', label: 'Codigo', value: '1234' },
  ],
}

const LIST_INPUT = { search: 'ana', blocked: 'all' as const, page: 1, pageSize: 10 }
const CHAT_INPUT = { target: { contactId: CONTACT_ID }, before: MESSAGE_ID, pageSize: 30 }
const MARK_INPUT = { contactId: CONTACT_ID, upToMessageId: MESSAGE_ID }

const ACTIONS = {
  list: () => listWhatsappConversationsAction(LIST_INPUT),
  chat: () => getWhatsappChatAction(CHAT_INPUT),
  read: () => markWhatsappChatReadAction(MARK_INPUT),
  tpl: () => listSendableWhatsappTemplatesAction(),
} as const

const USE_CASE_OF = { list: listMock, chat: chatMock, read: markMock, tpl: templatesMock } as const

const SOURCE = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '..', '..', '..', '..', '..',
    'lib', 'modules', 'integraciones', 'adapters', 'driving', 'whatsapp-conversation-actions.ts',
  ),
  'utf8',
)

let warnSpy: ReturnType<typeof vi.spyOn>
let errorSpy: ReturnType<typeof vi.spyOn>
let infoSpy: ReturnType<typeof vi.spyOn>
let logSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  getSessionUserMock.mockResolvedValue(SESSION_USER)
  getSessionContextMock.mockResolvedValue({ companyId: COMPANY_ID })
  listMock.mockResolvedValue(LIST)
  chatMock.mockResolvedValue(CHAT)
  markMock.mockResolvedValue({ unreadCount: 0 })
  templatesMock.mockResolvedValue({ templates: [TEMPLATE] })
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

function withLeaks<T extends object>(value: T): T {
  return { ...value, waId: SECRET_WA_ID, accessToken: ACCESS_TOKEN }
}

describe('R40: las cuatro consultas como Server Actions', () => {
  it('R40: el archivo exporta exactamente las cuatro acciones de consulta y ninguna de envio', () => {
    expect(Object.keys(conversationActions).sort()).toEqual([
      'getWhatsappChatAction',
      'listSendableWhatsappTemplatesAction',
      'listWhatsappConversationsAction',
      'markWhatsappChatReadAction',
    ])
  })

  it('R40: listar pasa la entrada tal cual y el actor de la sesion, y devuelve success con el listado', async () => {
    expect(await ACTIONS.list()).toEqual({ status: 'success', data: LIST })
    expect(listMock).toHaveBeenCalledWith(LIST_INPUT, ACTOR)
  })

  it('R40: el chat pasa la entrada tal cual y el actor, y devuelve success con el chat', async () => {
    expect(await ACTIONS.chat()).toEqual({ status: 'success', data: CHAT })
    expect(chatMock).toHaveBeenCalledWith(CHAT_INPUT, ACTOR)
  })

  it('R40: el chat vacio por cliente sale con contacto nulo y ventana cerrada', async () => {
    chatMock.mockResolvedValueOnce(EMPTY_CHAT)
    expect(await getWhatsappChatAction({ target: { customerId: CUSTOMER_ID } })).toEqual({
      status: 'success',
      data: EMPTY_CHAT,
    })
  })

  it('R40: marcar leido pasa la entrada tal cual y el actor, y devuelve success con los no leidos', async () => {
    expect(await ACTIONS.read()).toEqual({ status: 'success', data: { unreadCount: 0 } })
    expect(markMock).toHaveBeenCalledWith(MARK_INPUT, ACTOR)
  })

  it('R40: las plantillas enviables pasan solo el actor y devuelven success con la lista', async () => {
    expect(await ACTIONS.tpl()).toEqual({ status: 'success', data: { templates: [TEMPLATE] } })
    expect(templatesMock).toHaveBeenCalledWith(ACTOR)
  })

  it('R40: sin sesion o sin empresa pasan actor null, y el unauthorized del caso de uso sale con su codigo', async () => {
    for (const [name, action] of Object.entries(ACTIONS)) {
      for (const sinSesion of ['usuario', 'empresa'] as const) {
        vi.clearAllMocks()
        getSessionUserMock.mockResolvedValue(sinSesion === 'usuario' ? null : SESSION_USER)
        getSessionContextMock.mockResolvedValue(sinSesion === 'empresa' ? null : { companyId: COMPANY_ID })
        const useCase = USE_CASE_OF[name as keyof typeof ACTIONS]
        useCase.mockRejectedValueOnce(new UnauthorizedError())
        const result = await action()
        expect(useCase.mock.calls[0]?.at(-1), `${name} / ${sinSesion}`).toBeNull()
        expect(result, `${name} / ${sinSesion}`).toEqual({
          status: 'error',
          code: 'unauthorized',
          message: errorMessage('unauthorized'),
        })
      }
    }
  })

  it('R40: cada error del catalogo de su accion sale como ErrorState con el texto del catalogo y sin diagnostico', async () => {
    const byAction = {
      list: [new ValidationError()],
      chat: [
        new ValidationError('cursor raro'),
        new WhatsappContactNotFoundError(),
        new LinkedCustomerNotFoundError(),
        new WhatsappMessageNotFoundError(),
      ],
      read: [new ValidationError('x'), new WhatsappContactNotFoundError(), new WhatsappMessageNotFoundError()],
      tpl: [new UnauthorizedError()],
    }
    for (const [name, errors] of Object.entries(byAction)) {
      for (const error of errors) {
        USE_CASE_OF[name as keyof typeof ACTIONS].mockRejectedValueOnce(error)
        const result = await ACTIONS[name as keyof typeof ACTIONS]()
        expect(result, `${name} / ${error.code}`).toEqual({
          status: 'error',
          code: error.code,
          message: errorMessage(error.code),
        })
      }
    }
  })

  it('R40: el cliente dado de baja abierto por cliente sale como customer_not_found', async () => {
    chatMock.mockRejectedValueOnce(new LinkedCustomerNotFoundError())
    expect(await getWhatsappChatAction({ target: { customerId: CUSTOMER_ID } })).toMatchObject({
      status: 'error',
      code: 'customer_not_found',
    })
  })

  it('R40: un error ajeno al dominio sale como `unexpected` con referencia y sin su texto', async () => {
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

  it('R40: el borde no decide: use server, sin permiso, esquema, ORM, adaptadores driven ni revalidacion', () => {
    expect(SOURCE.startsWith("'use server';")).toBe(true)
    expect(SOURCE).not.toMatch(/requirePermission|requireReadPermission|whatsapp\.consultar|Administrador/)
    expect(SOURCE).not.toMatch(/Schema\b|from 'zod'/)
    expect(SOURCE).not.toMatch(/@prisma\/client|prisma\./)
    expect(SOURCE).not.toMatch(/adapters\/driven|\.\.\/driven/)
    expect(SOURCE).not.toMatch(/revalidatePath|next\/cache/)
  })
})

describe('R40: la vista se copia campo a campo', () => {
  it('R40: el listado no deja salir claves de mas del caso de uso, ni en la pagina ni en cada fila', async () => {
    const item = LIST.page.items[0] as WhatsappConversationList['page']['items'][number]
    listMock.mockResolvedValueOnce(
      withLeaks({
        ...LIST,
        page: withLeaks({
          ...LIST.page,
          items: [withLeaks({ ...item, lastMessage: withLeaks(item.lastMessage) })],
        }),
      }),
    )
    const result = await ACTIONS.list()
    expect(result).toEqual({ status: 'success', data: LIST })
    expect(JSON.stringify(result)).not.toContain(SECRET_WA_ID)
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN)
  })

  it('R40: el chat no deja salir claves de mas del contacto, del cliente, de la ventana, de cada mensaje ni de su adjunto', async () => {
    chatMock.mockResolvedValueOnce(
      withLeaks({
        ...CHAT,
        contact: withLeaks(CHAT.contact as NonNullable<WhatsappChat['contact']>),
        customer: withLeaks(CHAT.customer),
        window: withLeaks(CHAT.window),
        messages: CHAT.messages.map((message) =>
          withLeaks({
            ...message,
            attachment:
              message.attachment === null
                ? null
                : withLeaks({ ...message.attachment, media_id: 'media-123', wamid: 'wamid.X' }),
            sentBy: message.sentBy === null ? null : withLeaks(message.sentBy),
          }),
        ),
      }),
    )
    const result = await ACTIONS.chat()
    expect(result).toEqual({ status: 'success', data: CHAT })
    const json = JSON.stringify(result)
    for (const leak of [SECRET_WA_ID, ACCESS_TOKEN, 'media-123', 'wamid.X']) expect(json).not.toContain(leak)
  })

  it('R40: marcar leido devuelve solo unreadCount', async () => {
    markMock.mockResolvedValueOnce(withLeaks({ unreadCount: 3 }))
    expect(await ACTIONS.read()).toEqual({ status: 'success', data: { unreadCount: 3 } })
  })

  it('R40: las plantillas no dejan salir claves de mas de la plantilla, su contenido, sus botones ni sus variables', async () => {
    templatesMock.mockResolvedValueOnce(
      withLeaks({
        templates: [
          withLeaks({
            ...TEMPLATE,
            content: withLeaks({
              ...TEMPLATE.content,
              header: withLeaks(TEMPLATE.content.header as NonNullable<WhatsappSendableTemplate['content']['header']>),
              body: withLeaks(TEMPLATE.content.body),
              buttons: TEMPLATE.content.buttons.map((button) => withLeaks(button)),
            }),
            variables: TEMPLATE.variables.map((variable) => withLeaks(variable)),
          }),
        ],
      }),
    )
    const result = await ACTIONS.tpl()
    expect(result).toEqual({ status: 'success', data: { templates: [TEMPLATE] } })
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN)
  })
})

describe('R41: los logs no llevan el cuerpo, el numero ni el nombre', () => {
  it('R41: la accion no lee el diagnostico ni escribe en la consola', () => {
    expect(SOURCE).not.toMatch(/diagnostic/)
    expect(SOURCE).not.toMatch(/console\./)
  })

  it('R41: una consulta correcta no escribe nada en el log', async () => {
    for (const action of Object.values(ACTIONS)) await action()
    expect(everythingLogged()).toBe('[]')
  })

  it('R41: con el cuerpo, el numero y el nombre en la entrada y en la vista, ni el exito, ni un error del catalogo ni uno ajeno los llevan al log', async () => {
    const withSecrets = {
      list: () => listWhatsappConversationsAction({ search: SECRET_NAME }),
      chat: () => getWhatsappChatAction(CHAT_INPUT),
      read: () => markWhatsappChatReadAction(MARK_INPUT),
      tpl: () => listSendableWhatsappTemplatesAction(),
    } as const
    for (const [name, action] of Object.entries(withSecrets)) {
      const useCase = USE_CASE_OF[name as keyof typeof ACTIONS]
      await action()
      useCase.mockRejectedValueOnce(new WhatsappContactNotFoundError())
      await action()
      useCase.mockRejectedValueOnce(new Error('fallo de red'))
      await action()
    }
    const logged = everythingLogged()
    expect(logged).toContain('fallo de red')
    expect(logged).not.toContain(SECRET_BODY)
    expect(logged).not.toContain(SECRET_PHONE)
    expect(logged).not.toContain(SECRET_NAME)
  })
})
