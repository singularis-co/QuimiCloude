import { describe, expect, it } from 'vitest'

import {
  CHAT_DEFAULT_PAGE_SIZE,
  CHAT_MAX_PAGE_SIZE,
  chatPageSizeOf,
  CONVERSATION_SEARCH_MAX_LENGTH,
  CONVERSATIONS_DEFAULT_PAGE_SIZE,
  CONVERSATIONS_MAX_PAGE_SIZE,
  conversationsPageSizeOf,
  getWhatsappChatSchema,
  listWhatsappConversationsSchema,
  markWhatsappChatReadSchema,
} from '@/lib/modules/integraciones/domain/whatsapp-conversation-input'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/shared/pagination'

const UUID = '6f1c2b8e-3d4a-4c5b-9e6f-7a8b9c0d1e2f'
const OTHER_UUID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'

describe('listWhatsappConversationsSchema', () => {
  it('R10/R11/R12: sin campos da búsqueda vacía, todos los bloqueos y la página 1', () => {
    expect(listWhatsappConversationsSchema.parse({})).toEqual({ search: '', blocked: 'all', page: 1 })
  })

  it('R10: admite una búsqueda de 100 caracteres y rechaza una de 101', () => {
    expect(CONVERSATION_SEARCH_MAX_LENGTH).toBe(100)
    expect(listWhatsappConversationsSchema.safeParse({ search: 'x'.repeat(100) }).success).toBe(true)
    expect(listWhatsappConversationsSchema.safeParse({ search: 'x'.repeat(101) }).success).toBe(false)
  })

  it('R10: la búsqueda llega sin recortar; recortarla es del caso de uso', () => {
    expect(listWhatsappConversationsSchema.parse({ search: '  laura  ' }).search).toBe('  laura  ')
  })

  it.each(['blocked', 'not_blocked', 'all'])('R11: acepta el filtro de bloqueo %s', (blocked) => {
    expect(listWhatsappConversationsSchema.parse({ blocked }).blocked).toBe(blocked)
  })

  it.each<Record<string, unknown>>([
    { blocked: 'yes' },
    { page: 0 },
    { page: 1.5 },
    { page: '2' },
    { pageSize: 0 },
    { pageSize: 2.5 },
    { search: 7 },
    { extra: true },
  ])('R12: rechaza la entrada inválida %j', (input) => {
    expect(listWhatsappConversationsSchema.safeParse(input).success).toBe(false)
  })

  it('R12: un tamaño mayor que el tope no se rechaza', () => {
    expect(listWhatsappConversationsSchema.parse({ pageSize: 500 }).pageSize).toBe(500)
  })
})

describe('conversationsPageSizeOf', () => {
  it('R12: usa el mismo defecto y el mismo tope que los listados del repo', () => {
    expect(CONVERSATIONS_DEFAULT_PAGE_SIZE).toBe(DEFAULT_PAGE_SIZE)
    expect(CONVERSATIONS_MAX_PAGE_SIZE).toBe(MAX_PAGE_SIZE)
  })

  it('R12: sin tamaño da el defecto; por encima del tope lo acota', () => {
    expect(conversationsPageSizeOf(undefined)).toBe(DEFAULT_PAGE_SIZE)
    expect(conversationsPageSizeOf(7)).toBe(7)
    expect(conversationsPageSizeOf(MAX_PAGE_SIZE)).toBe(MAX_PAGE_SIZE)
    expect(conversationsPageSizeOf(MAX_PAGE_SIZE + 1)).toBe(MAX_PAGE_SIZE)
    expect(conversationsPageSizeOf(500)).toBe(MAX_PAGE_SIZE)
  })
})

describe('getWhatsappChatSchema', () => {
  it('R21/R30: acepta el chat por contacto o por cliente', () => {
    expect(getWhatsappChatSchema.parse({ target: { contactId: UUID } })).toEqual({ target: { contactId: UUID } })
    expect(getWhatsappChatSchema.parse({ target: { customerId: UUID }, before: OTHER_UUID, pageSize: 10 })).toEqual({
      target: { customerId: UUID },
      before: OTHER_UUID,
      pageSize: 10,
    })
  })

  it.each<Record<string, unknown>>([
    {},
    { target: {} },
    { target: { contactId: UUID, customerId: OTHER_UUID } },
    { target: { contactId: 'no-es-uuid' } },
    { target: { customerId: UUID }, before: 'wamid.abc' },
    { target: { customerId: UUID }, pageSize: 0 },
    { target: { customerId: UUID }, pageSize: 1.5 },
    { target: { customerId: UUID }, extra: 1 },
  ])('R31: rechaza la entrada inválida %j', (input) => {
    expect(getWhatsappChatSchema.safeParse(input).success).toBe(false)
  })

  it('R31: un tamaño mayor que el tope no se rechaza', () => {
    expect(getWhatsappChatSchema.parse({ target: { contactId: UUID }, pageSize: 500 }).pageSize).toBe(500)
  })
})

describe('chatPageSizeOf', () => {
  it('R31: 30 mensajes por defecto y tope de 50', () => {
    expect(CHAT_DEFAULT_PAGE_SIZE).toBe(30)
    expect(CHAT_MAX_PAGE_SIZE).toBe(50)
    expect(chatPageSizeOf(undefined)).toBe(30)
    expect(chatPageSizeOf(1)).toBe(1)
    expect(chatPageSizeOf(50)).toBe(50)
    expect(chatPageSizeOf(51)).toBe(50)
    expect(chatPageSizeOf(1000)).toBe(50)
  })
})

describe('markWhatsappChatReadSchema', () => {
  it('R17: acepta el contacto con o sin el último mensaje mostrado', () => {
    expect(markWhatsappChatReadSchema.parse({ contactId: UUID })).toEqual({ contactId: UUID })
    expect(markWhatsappChatReadSchema.parse({ contactId: UUID, upToMessageId: OTHER_UUID })).toEqual({
      contactId: UUID,
      upToMessageId: OTHER_UUID,
    })
  })

  it.each<Record<string, unknown>>([
    {},
    { contactId: 'x' },
    { contactId: UUID, upToMessageId: 'wamid.abc' },
    { contactId: UUID, extra: true },
  ])('R17: rechaza la entrada inválida %j', (input) => {
    expect(markWhatsappChatReadSchema.safeParse(input).success).toBe(false)
  })
})
