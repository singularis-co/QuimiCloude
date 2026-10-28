import { describe, expect, it } from 'vitest'

import { WHATSAPP_READ_PERMISSION, type Actor } from '@/lib/modules/integraciones/domain/actor'
import { UNREADABLE_SECRET_MESSAGE } from '@/lib/modules/integraciones/domain/connection-secrets'
import {
  UnauthorizedError,
  ValidationError,
  WhatsappMessageNotFoundError,
} from '@/lib/modules/integraciones/domain/errors'
import { createGetWhatsappMedia } from '@/lib/modules/integraciones/domain/get-whatsapp-media'
import { WHATSAPP_MEDIA_MAX_BYTES } from '@/lib/modules/integraciones/domain/whatsapp-media'

import {
  ACCESS_TOKEN,
  COMPANY_ID,
  CONNECTION_ID,
  CUSTOMER_ID,
  OTHER_COMPANY_ID,
  OTHER_CONTACT_ID,
  admin,
  conversationContact,
  conversationMessage,
  customerRef,
  makeCipher,
  makeConversationRepository,
  makeCustomerCatalog,
  makeGraph,
  makeRepository,
  storedConnection,
  type ConversationDoubleContact,
  type ConversationDoubleMessage,
} from '../whatsapp-doubles'

const MEDIA_ID = 'meta-media-id-123'
const MESSAGE_ID = '00000000-0000-4000-8000-000000000401'
const UNKNOWN_MESSAGE_ID = '00000000-0000-4000-8000-000000000499'

function reader(overrides: Partial<Actor> = {}): Actor {
  return admin({ permissions: [WHATSAPP_READ_PERMISSION], ...overrides })
}

function imageMessage(overrides: Partial<ConversationDoubleMessage> = {}): ConversationDoubleMessage {
  return conversationMessage({ id: MESSAGE_ID, type: 'IMAGE', body: null, payload: { media_id: MEDIA_ID }, ...overrides })
}

function streamOf(bytes: number[]): ReadableStream<Uint8Array> {
  return new Blob([new Uint8Array(bytes)]).stream()
}

function setup(
  options: {
    contacts?: readonly ConversationDoubleContact[]
    messages?: readonly ConversationDoubleMessage[]
    connected?: boolean
    unreadableToken?: boolean
    refs?: Parameters<typeof makeCustomerCatalog>[0]
  } = {},
) {
  const vault = makeCipher()
  const connection = storedConnection(options.unreadableToken === true ? () => 'v1:ilegible' : vault.seed, {
    status: 'ACTIVE',
  })
  const repo = makeRepository(options.connected === false ? [] : [connection])
  const conv = makeConversationRepository(options.contacts ?? [conversationContact()], options.messages ?? [imageMessage()])
  const catalog = makeCustomerCatalog(options.refs)
  const graph = makeGraph()
  const getMedia = createGetWhatsappMedia({
    connections: repo.connections,
    conversations: conv.conversations,
    customers: catalog.customers,
    graph: graph.graph,
    cipher: vault.cipher,
  })
  const portSpies = [
    repo.findLive,
    repo.update,
    conv.findMediaMessage,
    catalog.findAliveRefById,
    vault.decrypt,
    graph.downloadMedia,
  ]
  return { getMedia, repo, conv, catalog, graph, vault, portSpies }
}

describe('getWhatsappMedia', () => {
  it.each<[string, Actor | null]>([
    ['sin whatsapp.consultar', reader({ permissions: ['whatsapp.enviar'] })],
    ['sin empresa', reader({ companyId: '' })],
    ['sin actor', null],
  ])('R44: %s responde unauthorized sin validar ni tocar un puerto', async (_, actor) => {
    const ctx = setup()

    await expect(ctx.getMedia({ messageId: 'no-es-uuid' }, actor)).rejects.toBeInstanceOf(UnauthorizedError)
    for (const spy of ctx.portSpies) expect(spy).not.toHaveBeenCalled()
  })

  it.each<[string, unknown]>([
    ['id que no es uuid', { messageId: 'abc' }],
    ['sin id', {}],
    ['campo de más', { messageId: MESSAGE_ID, extra: 1 }],
    ['entrada nula', null],
  ])('R44: %s responde invalid_input sin tocar un puerto', async (_, input) => {
    const ctx = setup()

    await expect(ctx.getMedia(input, reader())).rejects.toBeInstanceOf(ValidationError)
    for (const spy of ctx.portSpies) expect(spy).not.toHaveBeenCalled()
  })

  it.each<[string, Parameters<typeof setup>[0], string]>([
    ['sin conexión', { connected: false }, MESSAGE_ID],
    ['mensaje inexistente', {}, UNKNOWN_MESSAGE_ID],
    ['mensaje de otra empresa', { messages: [imageMessage({ companyId: OTHER_COMPANY_ID })] }, MESSAGE_ID],
    [
      'contacto de otra conexión',
      { contacts: [conversationContact({ connectionId: '00000000-0000-4000-8000-000000000009' })] },
      MESSAGE_ID,
    ],
    ['imagen saliente', { messages: [imageMessage({ direction: 'OUT' })] }, MESSAGE_ID],
    ['audio entrante', { messages: [imageMessage({ type: 'AUDIO' })] }, MESSAGE_ID],
    ['video entrante', { messages: [imageMessage({ type: 'VIDEO' })] }, MESSAGE_ID],
    ['documento entrante', { messages: [imageMessage({ type: 'DOCUMENT' })] }, MESSAGE_ID],
    ['texto entrante', { messages: [imageMessage({ type: 'TEXT', payload: { media_id: MEDIA_ID } })] }, MESSAGE_ID],
    ['imagen sin media_id', { messages: [imageMessage({ payload: {} })] }, MESSAGE_ID],
    ['imagen con media_id vacío', { messages: [imageMessage({ payload: { media_id: '' } })] }, MESSAGE_ID],
    ['contacto sin cliente', { contacts: [conversationContact({ customerId: null })] }, MESSAGE_ID],
    ['cliente dado de baja', { refs: { [COMPANY_ID]: [customerRef({ isDeleted: true })] } }, MESSAGE_ID],
    ['cliente de otra empresa', { refs: { [OTHER_COMPANY_ID]: [customerRef()] } }, MESSAGE_ID],
  ])('R44: %s responde whatsapp_message_not_found sin descifrar el token ni llamar a Meta', async (_, options, id) => {
    const ctx = setup(options)

    await expect(ctx.getMedia({ messageId: id }, reader())).rejects.toBeInstanceOf(WhatsappMessageNotFoundError)
    expect(ctx.vault.decrypt).not.toHaveBeenCalled()
    expect(ctx.graph.downloadMedia).not.toHaveBeenCalled()
    expect(ctx.repo.update).not.toHaveBeenCalled()
  })

  it('R44: el mensaje se busca con la conexión y el ámbito del actor', async () => {
    const ctx = setup()

    await ctx.getMedia({ messageId: MESSAGE_ID }, reader())

    expect(ctx.conv.findMediaMessage).toHaveBeenCalledWith(MESSAGE_ID, CONNECTION_ID, { companyId: COMPANY_ID })
    expect(ctx.catalog.findAliveRefById).toHaveBeenCalledWith(CUSTOMER_ID, COMPANY_ID)
  })

  it('R44: un mensaje de otro contacto de la misma conexión vinculado a un cliente activo sí se sirve', async () => {
    const ctx = setup({
      contacts: [conversationContact(), conversationContact({ id: OTHER_CONTACT_ID, waId: '5215500000000' })],
      messages: [imageMessage({ contactId: OTHER_CONTACT_ID })],
    })

    await expect(ctx.getMedia({ messageId: MESSAGE_ID }, reader())).resolves.toMatchObject({ kind: 'file' })
  })

  it('R45: descarga de Meta con el token de la conexión y el tope de 5 MB, y devuelve el stream con su tipo', async () => {
    const ctx = setup()
    const body = streamOf([137, 80, 78, 71])
    ctx.graph.downloadMedia.mockResolvedValueOnce({ ok: true, contentType: 'image/png', contentLength: 4, body })

    const result = await ctx.getMedia({ messageId: MESSAGE_ID }, reader())

    expect(ctx.graph.downloadMedia).toHaveBeenCalledTimes(1)
    expect(ctx.graph.downloadMedia).toHaveBeenCalledWith({
      mediaId: MEDIA_ID,
      accessToken: ACCESS_TOKEN,
      maxBytes: WHATSAPP_MEDIA_MAX_BYTES,
    })
    expect(WHATSAPP_MEDIA_MAX_BYTES).toBe(5 * 1024 * 1024)
    expect(result).toEqual({ kind: 'file', contentType: 'image/png', contentLength: 4, body })
    expect(ctx.repo.update).not.toHaveBeenCalled()
  })

  it.each([
    ['sticker en webp', 'STICKER', 'image/webp'],
    ['imagen en jpeg', 'IMAGE', 'image/jpeg'],
    ['tipo en mayúsculas', 'IMAGE', 'IMAGE/JPEG'],
  ] as const)('R45: %s se sirve', async (_, type, contentType) => {
    const ctx = setup({ messages: [imageMessage({ type })] })
    ctx.graph.downloadMedia.mockResolvedValueOnce({ ok: true, contentType, contentLength: null, body: streamOf([1]) })

    const result = await ctx.getMedia({ messageId: MESSAGE_ID }, reader())

    expect(result).toMatchObject({ kind: 'file', contentType: contentType.toLowerCase(), contentLength: null })
  })

  it('R46: un token ilegible da unavailable sin llamar a Meta, y la conexión queda en error pidiendo credenciales', async () => {
    const ctx = setup({ unreadableToken: true })

    await expect(ctx.getMedia({ messageId: MESSAGE_ID }, reader())).resolves.toEqual({ kind: 'unavailable' })
    expect(ctx.graph.downloadMedia).not.toHaveBeenCalled()
    expect(ctx.repo.update).toHaveBeenCalledTimes(1)
    expect(ctx.repo.row(CONNECTION_ID)).toMatchObject({ status: 'ERROR', lastError: UNREADABLE_SECRET_MESSAGE })
  })

  it.each(['rejected', 'unreachable'] as const)('R46: Meta con fallo %s da unavailable', async (kind) => {
    const ctx = setup()
    ctx.graph.downloadMedia.mockResolvedValueOnce({ ok: false, kind, message: 'doble: medio caducado' })

    await expect(ctx.getMedia({ messageId: MESSAGE_ID }, reader())).resolves.toEqual({ kind: 'unavailable' })
    expect(ctx.repo.update).not.toHaveBeenCalled()
  })

  it.each(['text/html', 'image/gif', 'image/svg+xml', 'application/octet-stream'])(
    'R46: un archivo de tipo %s da unavailable y se suelta su stream sin leerlo',
    async (contentType) => {
      const ctx = setup()
      let cancelled = false
      const body = new ReadableStream<Uint8Array>({
        cancel() {
          cancelled = true
        },
      })
      ctx.graph.downloadMedia.mockResolvedValueOnce({ ok: true, contentType, contentLength: 10, body })

      await expect(ctx.getMedia({ messageId: MESSAGE_ID }, reader())).resolves.toEqual({ kind: 'unavailable' })
      expect(cancelled).toBe(true)
    },
  )

  it('R46: si soltar el stream falla, sigue siendo unavailable', async () => {
    const ctx = setup()
    const body = new ReadableStream<Uint8Array>({
      cancel() {
        throw new Error('doble: la conexión ya se cerró')
      },
    })
    ctx.graph.downloadMedia.mockResolvedValueOnce({ ok: true, contentType: 'text/html', contentLength: null, body })

    await expect(ctx.getMedia({ messageId: MESSAGE_ID }, reader())).resolves.toEqual({ kind: 'unavailable' })
  })
})
