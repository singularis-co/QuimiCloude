import { describe, expect, it } from 'vitest'

import { formatPhoneInternational } from '@/lib/modules/clientes'
import { WHATSAPP_READ_PERMISSION, type Actor } from '@/lib/modules/integraciones/domain/actor'
import { UnauthorizedError, ValidationError } from '@/lib/modules/integraciones/domain/errors'
import { createListWhatsappConversations } from '@/lib/modules/integraciones/domain/list-whatsapp-conversations'

import {
  COMPANY_ID,
  CONNECTION_ID,
  CONTACT_ID,
  CUSTOMER_ID,
  NEW_CONNECTION_ID,
  OTHER_COMPANY_ID,
  OTHER_CONTACT_ID,
  OTHER_CUSTOMER_ID,
  THIRD_CUSTOMER_ID,
  admin,
  conversationContact,
  conversationMessage,
  customerRef,
  makeConversationRepository,
  makeCustomerCatalog,
  makeRepository,
  storedConnection,
  type ConversationDoubleContact,
  type ConversationDoubleMessage,
} from '../whatsapp-doubles'

const THIRD_CONTACT_ID = '00000000-0000-4000-8000-0000000000d3'
const FOURTH_CONTACT_ID = '00000000-0000-4000-8000-0000000000d4'

function reader(overrides: Partial<Actor> = {}): Actor {
  return admin({ permissions: [WHATSAPP_READ_PERMISSION], ...overrides })
}

function setup(
  options: {
    contacts?: readonly ConversationDoubleContact[]
    messages?: readonly ConversationDoubleMessage[]
    connected?: boolean
    refs?: Parameters<typeof makeCustomerCatalog>[0]
  } = {},
) {
  const connection = storedConnection(() => 'cifrado', { status: 'ACTIVE' })
  const repo = makeRepository(options.connected === false ? [] : [connection])
  const conv = makeConversationRepository(
    options.contacts ?? [conversationContact()],
    options.messages ?? [conversationMessage()],
  )
  const catalog = makeCustomerCatalog(options.refs)
  const list = createListWhatsappConversations({
    connections: repo.connections,
    conversations: conv.conversations,
    customers: catalog.customers,
  })
  return { list, repo, conv, catalog }
}

describe('listWhatsappConversations', () => {
  it.each<[string, Actor | null]>([
    ['sin whatsapp.consultar', reader({ permissions: ['whatsapp.enviar', 'integraciones.modificar'] })],
    ['sin empresa', reader({ companyId: '' })],
    ['sin actor', null],
  ])('R4: %s responde unauthorized sin validar ni tocar un puerto', async (_, actor) => {
    const { list, repo, conv, catalog } = setup()
    await expect(list({ page: 0 }, actor)).rejects.toBeInstanceOf(UnauthorizedError)
    expect(repo.findLive).not.toHaveBeenCalled()
    for (const spy of conv.allSpies()) expect(spy).not.toHaveBeenCalled()
    expect(catalog.findRefsIncludingDeleted).not.toHaveBeenCalled()
    expect(catalog.findAliveIdsMatchingName).not.toHaveBeenCalled()
  })

  it('R4: una entrada inválida con permiso da invalid_input sin tocar un puerto', async () => {
    const { list, repo } = setup()
    await expect(list({ page: 0 }, reader())).rejects.toBeInstanceOf(ValidationError)
    expect(repo.findLive).not.toHaveBeenCalled()
  })

  it('R7: cada conversación trae contacto, cliente, nombre, número internacional, último mensaje, no leídos y bloqueo', async () => {
    const { list } = setup({
      contacts: [conversationContact({ blockedAt: new Date('2026-10-01T00:00:00.000Z') })],
      messages: [
        conversationMessage({ id: '00000000-0000-4000-8000-000000000401', at: new Date('2026-10-09T09:00:00.000Z') }),
        conversationMessage({
          id: '00000000-0000-4000-8000-000000000402',
          direction: 'OUT',
          type: 'TEXT',
          body: 'x'.repeat(130),
          status: 'DELIVERED',
          at: new Date('2026-10-09T10:00:00.000Z'),
        }),
      ],
    })
    const result = await list({}, reader())
    expect(result.page.items).toEqual([
      {
        contactId: CONTACT_ID,
        customerId: CUSTOMER_ID,
        customerName: 'Laura Gómez',
        phone: formatPhoneInternational('5215512345678'),
        isBlocked: true,
        unreadCount: 1,
        lastMessage: {
          direction: 'OUT',
          type: 'TEXT',
          preview: 'x'.repeat(120),
          status: 'DELIVERED',
          at: '2026-10-09T10:00:00.000Z',
        },
      },
    ])
    expect(result.page.items[0].phone.startsWith('+52')).toBe(true)
  })

  it('R6: contactos sin cliente, con el cliente dado de baja, sin mensajes, de otra conexión o de otra empresa no salen', async () => {
    const contacts = [
      conversationContact(),
      conversationContact({ id: OTHER_CONTACT_ID, customerId: null, waId: '5215500000001' }),
      conversationContact({ id: THIRD_CONTACT_ID, customerId: OTHER_CUSTOMER_ID, waId: '5215500000002' }),
      conversationContact({ id: FOURTH_CONTACT_ID, customerId: THIRD_CUSTOMER_ID, waId: '5215500000003' }),
      conversationContact({
        id: '00000000-0000-4000-8000-0000000000d5',
        connectionId: NEW_CONNECTION_ID,
        waId: '5215500000004',
      }),
      conversationContact({
        id: '00000000-0000-4000-8000-0000000000d6',
        companyId: OTHER_COMPANY_ID,
        waId: '5215500000005',
      }),
    ]
    const messages = contacts
      .filter((contact) => contact.id !== FOURTH_CONTACT_ID)
      .map((contact, index) =>
        conversationMessage({
          id: `00000000-0000-4000-8000-00000000050${index}`,
          contactId: contact.id,
          companyId: contact.companyId,
        }),
      )
    const { list, catalog } = setup({
      contacts,
      messages,
      refs: {
        [COMPANY_ID]: [
          customerRef(),
          customerRef({ id: OTHER_CUSTOMER_ID, firstNames: 'Ana', isDeleted: true }),
          customerRef({ id: THIRD_CUSTOMER_ID, firstNames: 'Pedro' }),
        ],
      },
    })
    const result = await list({}, reader())
    expect(result.page.items.map((item) => item.contactId)).toEqual([CONTACT_ID])
    expect(result.page.total).toBe(1)
    expect(catalog.findRefsIncludingDeleted).toHaveBeenCalledWith([CUSTOMER_ID, OTHER_CUSTOMER_ID], COMPANY_ID)
  })

  it('R6: si todos los clientes vinculados están dados de baja la página sale vacía sin pedir la página', async () => {
    const { list, conv } = setup({ refs: { [COMPANY_ID]: [customerRef({ isDeleted: true })] } })
    const result = await list({}, reader())
    expect(result.page).toEqual({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 })
    expect(result.connectionStatus).toBe('ACTIVE')
    expect(conv.listPage).not.toHaveBeenCalled()
  })

  describe('búsqueda', () => {
    const contacts = [
      conversationContact(),
      conversationContact({ id: OTHER_CONTACT_ID, customerId: OTHER_CUSTOMER_ID, waId: '5215598765432' }),
    ]
    const messages = [
      conversationMessage({ id: '00000000-0000-4000-8000-000000000401' }),
      conversationMessage({ id: '00000000-0000-4000-8000-000000000402', contactId: OTHER_CONTACT_ID }),
    ]
    const refs = { [COMPANY_ID]: [customerRef(), customerRef({ id: OTHER_CUSTOMER_ID, firstNames: 'Ana', lastNames: 'Ruiz' })] }

    it('R10: casa por nombre del cliente', async () => {
      const { list, catalog, conv } = setup({ contacts, messages, refs })
      const result = await list({ search: '  laura ' }, reader())
      expect(result.page.items.map((item) => item.contactId)).toEqual([CONTACT_ID])
      expect(catalog.findAliveIdsMatchingName).toHaveBeenCalledWith('laura', [CUSTOMER_ID, OTHER_CUSTOMER_ID], COMPANY_ID)
      expect(conv.listPage.mock.calls[0][0].search).toEqual({ nameMatchIds: [CUSTOMER_ID], digits: '' })
    })

    it('R10: casa por los dígitos del número, sin lo que no es dígito', async () => {
      const { list, conv } = setup({ contacts, messages, refs })
      const result = await list({ search: '987-654' }, reader())
      expect(result.page.items.map((item) => item.contactId)).toEqual([OTHER_CONTACT_ID])
      expect(conv.listPage.mock.calls[0][0].search).toEqual({ nameMatchIds: [], digits: '987654' })
    })

    it.each(['', '   '])('R10: el texto %j equivale a no buscar', async (search) => {
      const { list, catalog, conv } = setup({ contacts, messages, refs })
      const result = await list({ search }, reader())
      expect(result.page.total).toBe(2)
      expect(catalog.findAliveIdsMatchingName).not.toHaveBeenCalled()
      expect(conv.listPage.mock.calls[0][0].search).toBeNull()
    })
  })

  describe('filtro de bloqueo', () => {
    const contacts = [
      conversationContact({ blockedAt: new Date('2026-10-01T00:00:00.000Z') }),
      conversationContact({ id: OTHER_CONTACT_ID, customerId: OTHER_CUSTOMER_ID, waId: '5215598765432' }),
    ]
    const messages = [
      conversationMessage({ id: '00000000-0000-4000-8000-000000000401' }),
      conversationMessage({ id: '00000000-0000-4000-8000-000000000402', contactId: OTHER_CONTACT_ID }),
    ]
    const refs = { [COMPANY_ID]: [customerRef(), customerRef({ id: OTHER_CUSTOMER_ID })] }

    it.each<[string | undefined, string[]]>([
      [undefined, [CONTACT_ID, OTHER_CONTACT_ID]],
      ['all', [CONTACT_ID, OTHER_CONTACT_ID]],
      ['blocked', [CONTACT_ID]],
      ['not_blocked', [OTHER_CONTACT_ID]],
    ])('R11: blocked=%s', async (blocked, expected) => {
      const { list, conv } = setup({ contacts, messages, refs })
      const result = await list(blocked === undefined ? {} : { blocked }, reader())
      expect(result.page.items.map((item) => item.contactId).sort()).toEqual(expected.sort())
      expect(conv.listPage.mock.calls[0][0].blocked).toBe(blocked ?? 'all')
    })
  })

  it('R13: sin conexión viva da página vacía y estado nulo, sin error ni más lecturas', async () => {
    const { list, conv, catalog } = setup({ connected: false })
    const result = await list({ page: 2, pageSize: 5 }, reader())
    expect(result).toEqual({
      connectionStatus: null,
      page: { items: [], total: 0, page: 2, pageSize: 5, totalPages: 1 },
    })
    for (const spy of conv.allSpies()) expect(spy).not.toHaveBeenCalled()
    expect(catalog.findRefsIncludingDeleted).not.toHaveBeenCalled()
  })

  it.each(['ACTIVE', 'PENDING', 'ERROR', 'DISABLED'] as const)('R13: con conexión devuelve su estado %s', async (status) => {
    const connection = storedConnection(() => 'cifrado', { status })
    const repo = makeRepository([connection])
    const conv = makeConversationRepository([conversationContact()], [conversationMessage()])
    const list = createListWhatsappConversations({
      connections: repo.connections,
      conversations: conv.conversations,
      customers: makeCustomerCatalog().customers,
    })
    const result = await list({}, reader())
    expect(result.connectionStatus).toBe(status)
    expect(conv.listPage.mock.calls[0][0].connectionId).toBe(CONNECTION_ID)
  })

  it('R12: pasa offset y límite de la página y calcula el total de páginas con el tamaño acotado', async () => {
    const { list, conv } = setup()
    const result = await list({ page: 3, pageSize: 100 }, reader())
    expect(conv.listPage.mock.calls[0][0]).toMatchObject({ offset: 50, limit: 25 })
    expect(result.page).toMatchObject({ page: 3, pageSize: 25, total: 1, totalPages: 1 })
  })
})
