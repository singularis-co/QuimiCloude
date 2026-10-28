import { describe, expect, it } from 'vitest'

import { formatPhoneInternational } from '@/lib/modules/clientes'
import { WHATSAPP_READ_PERMISSION, type Actor } from '@/lib/modules/integraciones/domain/actor'
import {
  LinkedCustomerNotFoundError,
  UnauthorizedError,
  ValidationError,
  WhatsappContactNotFoundError,
  WhatsappMessageNotFoundError,
} from '@/lib/modules/integraciones/domain/errors'
import { createGetWhatsappChat } from '@/lib/modules/integraciones/domain/get-whatsapp-chat'
import { whatsappMediaPath } from '@/lib/shared/routes'

import {
  ACTOR_ID,
  COMPANY_ID,
  CONTACT_ID,
  CUSTOMER_ID,
  NEW_CONNECTION_ID,
  NOW,
  OTHER_COMPANY_ID,
  OTHER_CONTACT_ID,
  OTHER_CUSTOMER_ID,
  admin,
  conversationContact,
  conversationMessage,
  customerRef,
  makeConversationRepository,
  makeCustomerCatalog,
  makePeopleDirectory,
  makeRepository,
  storedConnection,
  type ConversationDoubleContact,
  type ConversationDoubleMessage,
} from '../whatsapp-doubles'

const MEDIA_ID = 'meta-media-id-123'
const FORMER_ID = '00000000-0000-4000-8000-0000000000c9'
const UNKNOWN_AUTHOR_ID = '00000000-0000-4000-8000-0000000000c8'

function reader(overrides: Partial<Actor> = {}): Actor {
  return admin({ permissions: [WHATSAPP_READ_PERMISSION], ...overrides })
}

function messageId(n: number): string {
  return `00000000-0000-4000-8000-${String(400 + n).padStart(12, '0')}`
}

/** `count` entrantes del contacto por defecto, uno por minuto: el último es el más reciente. */
function messagesOf(count: number): ConversationDoubleMessage[] {
  return Array.from({ length: count }, (_, i) =>
    conversationMessage({ id: messageId(i + 1), body: `m${i + 1}`, at: new Date(Date.UTC(2026, 9, 9, 8, i)) }),
  )
}

function setup(
  options: {
    contacts?: readonly ConversationDoubleContact[]
    messages?: readonly ConversationDoubleMessage[]
    connected?: boolean
    refs?: Parameters<typeof makeCustomerCatalog>[0]
    people?: Record<string, string>
  } = {},
) {
  const connection = storedConnection(() => 'cifrado', { status: 'ACTIVE' })
  const repo = makeRepository(options.connected === false ? [] : [connection])
  const conv = makeConversationRepository(
    options.contacts ?? [conversationContact()],
    options.messages ?? messagesOf(1),
  )
  const catalog = makeCustomerCatalog(options.refs)
  const directory = makePeopleDirectory(options.people)
  const getChat = createGetWhatsappChat({
    connections: repo.connections,
    conversations: conv.conversations,
    customers: catalog.customers,
    people: directory.people,
    mediaUrlOf: whatsappMediaPath,
    now: () => NOW,
  })
  return { getChat, repo, conv, catalog, directory }
}

describe('getWhatsappChat', () => {
  it.each<[string, Actor | null]>([
    ['sin whatsapp.consultar', reader({ permissions: ['whatsapp.enviar'] })],
    ['sin empresa', reader({ companyId: '' })],
    ['sin actor', null],
  ])('R4: %s responde unauthorized sin validar ni tocar un puerto', async (_, actor) => {
    const { getChat, repo, conv, catalog, directory } = setup()
    await expect(getChat({ target: 'x' }, actor)).rejects.toBeInstanceOf(UnauthorizedError)
    expect(repo.findLive).not.toHaveBeenCalled()
    for (const spy of conv.allSpies()) expect(spy).not.toHaveBeenCalled()
    expect(catalog.findAliveRefById).not.toHaveBeenCalled()
    expect(directory.findRefsIncludingDeletedInCompany).not.toHaveBeenCalled()
  })

  it('R4: una entrada inválida con permiso da invalid_input sin tocar un puerto', async () => {
    const { getChat, repo } = setup()
    await expect(getChat({ target: { contactId: 'no-uuid' } }, reader())).rejects.toBeInstanceOf(ValidationError)
    expect(repo.findLive).not.toHaveBeenCalled()
  })

  describe('por contacto', () => {
    it.each<[string, Parameters<typeof setup>[0]]>([
      ['inexistente', { contacts: [] }],
      ['de otra empresa', { contacts: [conversationContact({ companyId: OTHER_COMPANY_ID })] }],
      ['de otra conexión', { contacts: [conversationContact({ connectionId: NEW_CONNECTION_ID })] }],
      ['sin cliente', { contacts: [conversationContact({ customerId: null })] }],
      ['con el cliente dado de baja', { refs: { [COMPANY_ID]: [customerRef({ isDeleted: true })] } }],
      ['sin conexión viva', { connected: false }],
    ])('R21: un contacto %s da whatsapp_contact_not_found sin leer mensajes', async (_, options) => {
      const { getChat, conv } = setup(options)
      await expect(getChat({ target: { contactId: CONTACT_ID } }, reader())).rejects.toBeInstanceOf(
        WhatsappContactNotFoundError,
      )
      expect(conv.listMessages).not.toHaveBeenCalled()
    })

    it('R24, R29: devuelve la cabecera del contacto y cada mensaje con todos sus campos', async () => {
      const { getChat } = setup({
        contacts: [conversationContact({ blockedAt: new Date('2026-10-01T00:00:00.000Z') })],
        messages: [
          conversationMessage({
            id: messageId(1),
            type: 'IMAGE',
            body: 'mira',
            payload: { media_id: MEDIA_ID, mime_type: 'image/jpeg', caption: 'mira' },
            at: new Date('2026-10-09T08:00:00.000Z'),
          }),
          conversationMessage({
            id: messageId(2),
            direction: 'OUT',
            type: 'TEMPLATE',
            body: 'Hola Laura',
            status: 'FAILED',
            errorCode: '131047',
            errorReason: 'Re-engagement message',
            origin: 'USER',
            sentById: ACTOR_ID,
            templateName: 'bienvenida',
            at: new Date('2026-10-09T09:00:00.000Z'),
          }),
        ],
        people: { [ACTOR_ID]: 'Carla Ruiz' },
      })
      const chat = await getChat({ target: { contactId: CONTACT_ID } }, reader())

      expect(chat.connectionStatus).toBe('ACTIVE')
      expect(chat.contact).toEqual({
        id: CONTACT_ID,
        phone: formatPhoneInternational('5215512345678'),
        isBlocked: true,
        unreadCount: 1,
      })
      expect(chat.customer).toEqual({ id: CUSTOMER_ID, name: 'Laura Gómez' })
      expect(chat.messages[0]).toEqual({
        id: messageId(1),
        direction: 'IN',
        type: 'IMAGE',
        body: 'mira',
        attachment: {
          kind: 'media',
          mimeType: 'image/jpeg',
          filename: null,
          caption: 'mira',
          mediaUrl: `/api/integraciones/whatsapp/media/${messageId(1)}`,
        },
        status: 'RECEIVED',
        errorReason: null,
        origin: null,
        sentBy: null,
        templateName: null,
        at: '2026-10-09T08:00:00.000Z',
      })
      expect(JSON.stringify(chat)).not.toContain(MEDIA_ID)
      const failed = chat.messages[1]
      expect(failed).toMatchObject({
        id: messageId(2),
        direction: 'OUT',
        type: 'TEMPLATE',
        body: 'Hola Laura',
        attachment: null,
        status: 'FAILED',
        origin: 'USER',
        sentBy: { id: ACTOR_ID, displayName: 'Carla Ruiz' },
        templateName: 'bienvenida',
        at: '2026-10-09T09:00:00.000Z',
      })
      expect(failed.errorReason).not.toBe('Re-engagement message')
      expect(failed.errorReason).toEqual(expect.any(String))
    })
  })

  describe('paginación', () => {
    it('R22, R31: sin before trae los 30 más recientes, de más antiguo a más reciente, y pide uno de más', async () => {
      const { getChat, conv } = setup({ messages: messagesOf(35) })
      const chat = await getChat({ target: { contactId: CONTACT_ID } }, reader())
      expect(chat.messages.map((m) => m.body)).toEqual(Array.from({ length: 30 }, (_, i) => `m${i + 6}`))
      expect(conv.listMessages.mock.calls[0][2]).toEqual({ before: null, limit: 31 })
    })

    it('R23: indica que quedan anteriores y el cursor es el más antiguo devuelto; la página siguiente trae los anteriores', async () => {
      const { getChat, conv } = setup({ messages: messagesOf(35) })
      const first = await getChat({ target: { contactId: CONTACT_ID } }, reader())
      expect(first.hasMore).toBe(true)
      expect(first.nextCursor).toBe(messageId(6))

      const second = await getChat({ target: { contactId: CONTACT_ID }, before: first.nextCursor ?? undefined }, reader())
      expect(conv.listMessages.mock.calls[1][2]).toEqual({ before: messageId(6), limit: 31 })
      expect(second.messages.map((m) => m.body)).toEqual(['m1', 'm2', 'm3', 'm4', 'm5'])
      expect(second.hasMore).toBe(false)
      expect(second.nextCursor).toBeNull()
    })

    it('R31: el tamaño de página se acota a 50', async () => {
      const { getChat, conv } = setup({ messages: messagesOf(60) })
      const chat = await getChat({ target: { contactId: CONTACT_ID }, pageSize: 80 }, reader())
      expect(chat.messages).toHaveLength(50)
      expect(conv.listMessages.mock.calls[0][2]).toEqual({ before: null, limit: 51 })
    })

    it('R23: un cursor que no es un mensaje del contacto da whatsapp_message_not_found', async () => {
      const { getChat } = setup({
        contacts: [conversationContact(), conversationContact({ id: OTHER_CONTACT_ID, waId: '5215598765432' })],
        messages: [...messagesOf(2), conversationMessage({ id: messageId(9), contactId: OTHER_CONTACT_ID })],
      })
      await expect(
        getChat({ target: { contactId: CONTACT_ID }, before: messageId(9) }, reader()),
      ).rejects.toBeInstanceOf(WhatsappMessageNotFoundError)
    })
  })

  it('R27: el autor dado de baja sale con su nombre; el que el directorio no devuelve, con nombre nulo', async () => {
    const { getChat, directory } = setup({
      messages: [
        conversationMessage({ id: messageId(1), direction: 'OUT', status: 'SENT', origin: 'USER', sentById: FORMER_ID }),
        conversationMessage({
          id: messageId(2),
          direction: 'OUT',
          status: 'SENT',
          origin: 'USER',
          sentById: UNKNOWN_AUTHOR_ID,
          at: new Date('2026-10-09T11:00:00.000Z'),
        }),
        conversationMessage({
          id: messageId(3),
          direction: 'OUT',
          status: 'SENT',
          origin: 'USER',
          sentById: FORMER_ID,
          at: new Date('2026-10-09T11:30:00.000Z'),
        }),
      ],
      people: { [FORMER_ID]: 'Persona de Baja' },
    })
    const chat = await getChat({ target: { contactId: CONTACT_ID } }, reader())
    expect(chat.messages.map((m) => m.sentBy)).toEqual([
      { id: FORMER_ID, displayName: 'Persona de Baja' },
      { id: UNKNOWN_AUTHOR_ID, displayName: null },
      { id: FORMER_ID, displayName: 'Persona de Baja' },
    ])
    expect(directory.findRefsIncludingDeletedInCompany).toHaveBeenCalledTimes(1)
    expect(directory.findRefsIncludingDeletedInCompany).toHaveBeenCalledWith(COMPANY_ID, [FORMER_ID, UNKNOWN_AUTHOR_ID], NOW)
  })

  it('R27: sin autores no consulta el directorio de personas', async () => {
    const { getChat, directory } = setup()
    await getChat({ target: { contactId: CONTACT_ID } }, reader())
    expect(directory.findRefsIncludingDeletedInCompany).not.toHaveBeenCalled()
  })

  it.each<[string, Date | null, { open: boolean; closesAt: string | null }]>([
    ['abierta con la hora de cierre', new Date('2026-10-09T02:00:00.000Z'), { open: true, closesAt: '2026-10-10T02:00:00.000Z' }],
    ['cerrada pasadas 24 h', new Date('2026-10-08T11:00:00.000Z'), { open: false, closesAt: null }],
    ['cerrada sin entrantes', null, { open: false, closesAt: null }],
  ])('R28: la ventana sale %s', async (_, lastInboundAt, expected) => {
    const { getChat } = setup({ contacts: [conversationContact({ lastInboundAt })] })
    const chat = await getChat({ target: { contactId: CONTACT_ID } }, reader())
    expect(chat.window).toEqual(expected)
  })

  describe('por cliente', () => {
    it('R30: un cliente dado de baja, inexistente o de otra empresa da customer_not_found', async () => {
      const { getChat, conv } = setup({
        refs: { [COMPANY_ID]: [customerRef({ isDeleted: true })], [OTHER_COMPANY_ID]: [customerRef({ id: OTHER_CUSTOMER_ID })] },
      })
      for (const customerId of [CUSTOMER_ID, OTHER_CUSTOMER_ID]) {
        await expect(getChat({ target: { customerId } }, reader())).rejects.toBeInstanceOf(LinkedCustomerNotFoundError)
      }
      expect(conv.findLatestContactOfCustomer).not.toHaveBeenCalled()
    })

    it('R30: con conversaciones devuelve la de último mensaje más reciente', async () => {
      const { getChat } = setup({
        contacts: [conversationContact(), conversationContact({ id: OTHER_CONTACT_ID, waId: '5215598765432' })],
        messages: [
          conversationMessage({ id: messageId(1), body: 'viejo', at: new Date('2026-10-09T08:00:00.000Z') }),
          conversationMessage({
            id: messageId(2),
            contactId: OTHER_CONTACT_ID,
            body: 'nuevo',
            at: new Date('2026-10-09T09:00:00.000Z'),
          }),
        ],
      })
      const chat = await getChat({ target: { customerId: CUSTOMER_ID } }, reader())
      expect(chat.contact?.id).toBe(OTHER_CONTACT_ID)
      expect(chat.messages.map((m) => m.body)).toEqual(['nuevo'])
    })

    it.each<[string, Parameters<typeof setup>[0], 'ACTIVE' | null]>([
      ['sin conversación', { contacts: [], messages: [] }, 'ACTIVE'],
      ['sin conexión viva', { connected: false }, null],
    ])('R30: %s devuelve un chat vacío con la ventana cerrada y los datos del cliente', async (_, options, status) => {
      const { getChat, conv } = setup(options)
      const chat = await getChat({ target: { customerId: CUSTOMER_ID } }, reader())
      expect(chat).toEqual({
        connectionStatus: status,
        contact: null,
        customer: { id: CUSTOMER_ID, name: 'Laura Gómez' },
        window: { open: false, closesAt: null },
        messages: [],
        hasMore: false,
        nextCursor: null,
      })
      expect(conv.listMessages).not.toHaveBeenCalled()
    })
  })

  it('R20: leer el chat no mueve la marca de lectura', async () => {
    const { getChat, conv } = setup({ messages: messagesOf(3) })
    const chat = await getChat({ target: { contactId: CONTACT_ID } }, reader())
    expect(chat.contact?.unreadCount).toBe(3)
    expect(conv.advanceLastRead).not.toHaveBeenCalled()
    expect(conv.contact(CONTACT_ID)?.lastReadAt).toBeNull()
  })
})
