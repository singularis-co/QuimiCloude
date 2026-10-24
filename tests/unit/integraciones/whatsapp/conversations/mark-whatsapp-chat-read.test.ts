import { describe, expect, it } from 'vitest'

import { WHATSAPP_READ_PERMISSION, type Actor } from '@/lib/modules/integraciones/domain/actor'
import {
  UnauthorizedError,
  ValidationError,
  WhatsappContactNotFoundError,
  WhatsappMessageNotFoundError,
} from '@/lib/modules/integraciones/domain/errors'
import { createMarkWhatsappChatRead } from '@/lib/modules/integraciones/domain/mark-whatsapp-chat-read'

import {
  COMPANY_ID,
  CONTACT_ID,
  NEW_CONNECTION_ID,
  OTHER_COMPANY_ID,
  OTHER_CONTACT_ID,
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

const FIRST_ID = '00000000-0000-4000-8000-000000000401'
const SECOND_ID = '00000000-0000-4000-8000-000000000402'
const THIRD_ID = '00000000-0000-4000-8000-000000000403'
const FOREIGN_ID = '00000000-0000-4000-8000-000000000409'

function reader(overrides: Partial<Actor> = {}): Actor {
  return admin({ permissions: [WHATSAPP_READ_PERMISSION], ...overrides })
}

const threeInbound: ConversationDoubleMessage[] = [
  conversationMessage({ id: FIRST_ID, at: new Date('2026-10-09T08:00:00.000Z') }),
  conversationMessage({ id: SECOND_ID, at: new Date('2026-10-09T09:00:00.000Z') }),
  conversationMessage({ id: THIRD_ID, at: new Date('2026-10-09T10:00:00.000Z') }),
]

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
  const conv = makeConversationRepository(options.contacts ?? [conversationContact()], options.messages ?? threeInbound)
  const catalog = makeCustomerCatalog(options.refs)
  const markRead = createMarkWhatsappChatRead({
    connections: repo.connections,
    conversations: conv.conversations,
    customers: catalog.customers,
  })
  return { markRead, repo, conv, catalog }
}

describe('markWhatsappChatRead', () => {
  it.each<[string, Actor | null]>([
    ['sin whatsapp.consultar', reader({ permissions: ['whatsapp.enviar'] })],
    ['sin empresa', reader({ companyId: '' })],
    ['sin actor', null],
  ])('R4: %s responde unauthorized sin validar ni tocar un puerto', async (_, actor) => {
    const { markRead, repo, conv, catalog } = setup()
    await expect(markRead({ contactId: 'x' }, actor)).rejects.toBeInstanceOf(UnauthorizedError)
    expect(repo.findLive).not.toHaveBeenCalled()
    for (const spy of conv.allSpies()) expect(spy).not.toHaveBeenCalled()
    expect(catalog.findAliveRefById).not.toHaveBeenCalled()
  })

  it('R4: una entrada inválida con permiso da invalid_input sin tocar un puerto', async () => {
    const { markRead, repo } = setup()
    await expect(markRead({ contactId: 'no-uuid' }, reader())).rejects.toBeInstanceOf(ValidationError)
    expect(repo.findLive).not.toHaveBeenCalled()
  })

  it('R20: sin mensaje indicado marca hasta el último y devuelve los no leídos que quedan', async () => {
    const { markRead, conv } = setup()
    await expect(markRead({ contactId: CONTACT_ID }, reader())).resolves.toEqual({ unreadCount: 0 })
    expect(conv.advanceLastRead).toHaveBeenCalledWith(CONTACT_ID, null, { companyId: COMPANY_ID })
  })

  it('R17, R20: con un mensaje del contacto marca hasta él y quedan los posteriores', async () => {
    const { markRead, conv } = setup()
    await expect(markRead({ contactId: CONTACT_ID, upToMessageId: SECOND_ID }, reader())).resolves.toEqual({
      unreadCount: 1,
    })
    expect(conv.advanceLastRead).toHaveBeenCalledWith(CONTACT_ID, SECOND_ID, { companyId: COMPANY_ID })
    expect(conv.contact(CONTACT_ID)?.lastReadAt).toEqual(new Date('2026-10-09T09:00:00.000Z'))
  })

  it.each([
    ['inexistente', FIRST_ID.replace('401', '499')],
    ['de otro contacto', FOREIGN_ID],
  ])('R17: un mensaje %s da whatsapp_message_not_found sin cambiar la marca', async (_, upToMessageId) => {
    const { markRead, conv } = setup({
      contacts: [conversationContact(), conversationContact({ id: OTHER_CONTACT_ID, waId: '5215598765432' })],
      messages: [...threeInbound, conversationMessage({ id: FOREIGN_ID, contactId: OTHER_CONTACT_ID })],
    })
    await expect(markRead({ contactId: CONTACT_ID, upToMessageId }, reader())).rejects.toBeInstanceOf(
      WhatsappMessageNotFoundError,
    )
    expect(conv.contact(CONTACT_ID)?.lastReadAt).toBeNull()
    expect(conv.countUnread).not.toHaveBeenCalled()
  })

  it.each<[string, Parameters<typeof setup>[0]]>([
    ['inexistente', { contacts: [] }],
    ['de otra empresa', { contacts: [conversationContact({ companyId: OTHER_COMPANY_ID })] }],
    ['de otra conexión', { contacts: [conversationContact({ connectionId: NEW_CONNECTION_ID })] }],
    ['sin cliente', { contacts: [conversationContact({ customerId: null })] }],
    ['con el cliente dado de baja', { refs: { [COMPANY_ID]: [customerRef({ isDeleted: true })] } }],
    ['sin conexión viva', { connected: false }],
  ])('R19: un contacto %s da whatsapp_contact_not_found sin escribir', async (_, options) => {
    const { markRead, conv } = setup(options)
    await expect(markRead({ contactId: CONTACT_ID }, reader())).rejects.toBeInstanceOf(WhatsappContactNotFoundError)
    expect(conv.advanceLastRead).not.toHaveBeenCalled()
  })
})
