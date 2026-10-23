import { describe, expect, it } from 'vitest'

import type { Actor } from '@/lib/modules/integraciones/domain/actor'
import { WhatsappTemplateValuesMissingError } from '@/lib/modules/integraciones/domain/errors'
import {
  createRetryWhatsappMessage,
  type RetryWhatsappMessageDeps,
} from '@/lib/modules/integraciones/domain/retry-whatsapp-message'
import type { WhatsappConnectionRecord } from '@/lib/modules/integraciones/domain/whatsapp-connection'
import { TOKEN_INVALID_MESSAGE } from '@/lib/modules/integraciones/domain/whatsapp-send-failure'
import type { WhatsappTemplateRecord } from '@/lib/modules/integraciones/domain/whatsapp-template'
import type { WhatsappVariableKeyRecord } from '@/lib/modules/integraciones/domain/whatsapp-variable-key'
import type { GraphMessageSent } from '@/lib/modules/integraciones/ports/whatsapp-graph-client'

import {
  ACCESS_TOKEN,
  ACTOR_ID,
  COMPANY_ID,
  CONNECTION_ID,
  CONTACT_ID,
  FAILED_MESSAGE_ID,
  NEW_CONNECTION_ID,
  NOW,
  OTHER_COMPANY_ID,
  SENT_WAMID,
  makeCipher,
  makeCustomerPhoneLinks,
  makeGraph,
  makeOutbox,
  makeRepository,
  makeSendLog,
  makeTemplateRepository,
  makeVariableKeyRepository,
  outboxContact,
  outboxMessage,
  storedConnection,
  storedTemplate,
  storedVariableKey,
  type OutboxContactRow,
  type OutboxMessageRow,
} from '../whatsapp-doubles'

const ACCOUNT_KEY = storedVariableKey()

function sender(overrides: Partial<Actor> = {}): Actor {
  return { id: ACTOR_ID, companyId: COMPANY_ID, permissions: ['whatsapp.enviar'], ...overrides }
}

function mappedTemplate(overrides: Partial<WhatsappTemplateRecord> = {}): WhatsappTemplateRecord {
  return storedTemplate({
    name: 'aviso_cuenta',
    language: 'es_MX',
    components: [{ type: 'BODY', text: 'Hola {{1}}, su cuenta {{2}} esta lista.' }],
    variables: [
      { slot: 'body.1', kind: 'system', systemKey: 'cliente.nombre' },
      { slot: 'body.2', kind: 'company', variableKeyId: ACCOUNT_KEY.id },
    ],
    ...overrides,
  })
}

const FAILED_TEMPLATE = outboxMessage({
  type: 'TEMPLATE',
  body: 'Hola Ana, su cuenta 000-000 esta lista.',
  templateName: 'aviso_cuenta',
  templateLanguage: 'es_MX',
  payload: { 'cliente.nombre': 'Ana', cuenta_numero: '000-000' },
})

type SetupOptions = {
  connection?: Partial<WhatsappConnectionRecord>
  contacts?: readonly OutboxContactRow[]
  messages?: readonly OutboxMessageRow[]
  templates?: WhatsappTemplateRecord[]
  variableKeys?: WhatsappVariableKeyRecord[]
  alive?: boolean
  sent?: GraphMessageSent
}

function setup(options: SetupOptions = {}) {
  const cipherDouble = makeCipher()
  const repository = makeRepository([storedConnection(cipherDouble.seed, { status: 'ACTIVE', ...options.connection })])
  const outboxDouble = makeOutbox({
    contacts: options.contacts ?? [outboxContact()],
    messages: options.messages ?? [outboxMessage()],
  })
  const templateDouble = makeTemplateRepository(options.templates ?? [mappedTemplate()])
  const keyDouble = makeVariableKeyRepository(options.variableKeys ?? [ACCOUNT_KEY])
  const phones = makeCustomerPhoneLinks({ alive: options.alive })
  const graphDouble = makeGraph()
  const logDouble = makeSendLog()
  if (options.sent !== undefined) {
    const sent = options.sent
    graphDouble.sendMessage.mockImplementation(async () => sent)
  }
  const deps: RetryWhatsappMessageDeps = {
    connections: repository.connections,
    cipher: cipherDouble.cipher,
    outbox: outboxDouble.outbox,
    customerPhones: phones.customerPhones,
    templates: templateDouble.templates,
    variableKeys: keyDouble.variableKeys,
    graph: graphDouble.graph,
    sendLog: logDouble.sendLog,
    now: () => NOW,
  }
  const portSpies = [
    repository.findLive,
    repository.update,
    cipherDouble.decrypt,
    outboxDouble.findContact,
    outboxDouble.findContactsByWaIds,
    outboxDouble.ensureContact,
    outboxDouble.linkContact,
    outboxDouble.insertSending,
    outboxDouble.markSent,
    outboxDouble.markFailed,
    outboxDouble.findOutbound,
    outboxDouble.touchContact,
    phones.mainPhoneOf,
    phones.isCustomerAlive,
    templateDouble.findLiveById,
    templateDouble.findLiveByNameAndLanguage,
    keyDouble.listAll,
    graphDouble.sendMessage,
  ]
  return {
    retry: createRetryWhatsappMessage(deps),
    repository,
    outbox: outboxDouble,
    templates: templateDouble,
    keys: keyDouble,
    graph: graphDouble,
    log: logDouble,
    portSpies,
  }
}

type Setup = ReturnType<typeof setup>

function retryOf(extra: Record<string, unknown> = {}) {
  return { messageId: FAILED_MESSAGE_ID, ...extra }
}

const TEMPLATE_VALUES = {
  constants: { 'cliente.nombre': 'Ana Maria' },
  constantLabels: { 'cliente.nombre': 'Nombre del cliente' },
}

async function expectPriorRejection(s: Setup, run: Promise<unknown>, code: string) {
  await expect(run).rejects.toMatchObject({ code })
  expect(s.outbox.insertSending).not.toHaveBeenCalled()
  expect(s.graph.sendMessage).not.toHaveBeenCalled()
  expect(s.outbox.markSent).not.toHaveBeenCalled()
  expect(s.outbox.markFailed).not.toHaveBeenCalled()
  expect(s.outbox.touchContact).not.toHaveBeenCalled()
}

describe('retryWhatsappMessage — permiso y entrada', () => {
  it.each([
    ['sin whatsapp.enviar', sender({ permissions: ['integraciones.modificar'] })],
    ['sin empresa', sender({ companyId: '' })],
    ['sin actor', null],
  ])('R4: %s responde unauthorized sin tocar ningun puerto', async (_caso, actor) => {
    const s = setup()
    await expect(s.retry(retryOf(), actor)).rejects.toMatchObject({ code: 'unauthorized' })
    await expect(s.retry({ messageId: 'no-es-uuid' }, actor)).rejects.toMatchObject({ code: 'unauthorized' })
    for (const spy of s.portSpies) expect(spy).not.toHaveBeenCalled()
  })

  it('R17: un messageId sin forma de uuid responde invalid_input sin tocar ningun puerto', async () => {
    const s = setup()
    await expect(s.retry({ messageId: 'no-es-uuid' }, sender())).rejects.toMatchObject({ code: 'invalid_input' })
    for (const spy of s.portSpies) expect(spy).not.toHaveBeenCalled()
  })
})

describe('retryWhatsappMessage — que se puede reintentar', () => {
  it.each([
    ['no existe', []],
    ['es de otra empresa', [outboxMessage({ companyId: OTHER_COMPANY_ID })]],
  ])('R40: un mensaje que %s responde whatsapp_message_not_found como rechazo previo', async (_caso, messages) => {
    const s = setup({ messages })
    await expectPriorRejection(s, s.retry(retryOf(), sender()), 'whatsapp_message_not_found')
    expect(s.outbox.findOutbound).toHaveBeenCalledWith(FAILED_MESSAGE_ID, { companyId: COMPANY_ID })
  })

  it.each([
    ['enviado', outboxMessage({ status: 'SENT', errorCode: null, errorReason: null })],
    ['todavia enviandose', outboxMessage({ status: 'SENDING', errorCode: null, errorReason: null })],
    ['entregado', outboxMessage({ status: 'DELIVERED', errorCode: null, errorReason: null })],
    ['entrante', outboxMessage({ direction: 'IN', status: 'RECEIVED', origin: null, sentById: null })],
    ['entrante fallido', outboxMessage({ direction: 'IN', origin: null, sentById: null })],
    ['fallido del sistema', outboxMessage({ origin: 'SYSTEM', sentById: null })],
  ])('R40: un mensaje %s responde whatsapp_message_not_retryable como rechazo previo', async (_caso, message) => {
    const s = setup({ messages: [message] })
    await expectPriorRejection(s, s.retry(retryOf(), sender()), 'whatsapp_message_not_retryable')
    expect(s.repository.findLive).not.toHaveBeenCalled()
  })

  it('R40: un fallido sin contenido que reenviar responde whatsapp_message_not_retryable', async () => {
    const s = setup({ messages: [outboxMessage({ type: 'TEMPLATE', templateName: null, templateLanguage: null })] })
    await expectPriorRejection(s, s.retry(retryOf(), sender()), 'whatsapp_message_not_retryable')
  })
})

describe('retryWhatsappMessage — mensaje nuevo sobre el contacto del fallido', () => {
  it('R39: crea un mensaje nuevo SENT y no modifica el fallido', async () => {
    const s = setup()
    const before = s.outbox.message(FAILED_MESSAGE_ID)
    const result = await s.retry(retryOf(), sender())

    expect(result.message.id).not.toBe(FAILED_MESSAGE_ID)
    expect(result.message).toMatchObject({ type: 'TEXT', status: 'SENT', body: 'Hola, su pedido salio hoy' })
    expect(s.outbox.message(FAILED_MESSAGE_ID)).toEqual(before)
    expect(s.outbox.allMessages()).toHaveLength(2)
    expect(s.outbox.markSent).toHaveBeenCalledWith(result.message.id, SENT_WAMID, { companyId: COMPANY_ID })
    for (const [id] of [...s.outbox.markSent.mock.calls, ...s.outbox.markFailed.mock.calls]) {
      expect(id).not.toBe(FAILED_MESSAGE_ID)
    }
  })

  it('R39: el nuevo va al contacto del fallido, con el actor como autor y por la conexion viva', async () => {
    const s = setup()
    await s.retry(retryOf(), sender())
    expect(s.outbox.findContact).toHaveBeenCalledWith(CONTACT_ID, CONNECTION_ID, { companyId: COMPANY_ID })
    expect(s.outbox.insertSending).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: CONTACT_ID, connectionId: CONNECTION_ID, sentById: ACTOR_ID }),
      { companyId: COMPANY_ID },
    )
    expect(s.graph.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: ACCESS_TOKEN, to: '573001234567' }),
    )
  })

  it('R39: si Meta vuelve a fallar, el nuevo queda FAILED y el fallido sigue igual', async () => {
    const s = setup({ sent: { ok: false, kind: 'rejected', message: null, code: 190 } })
    const before = s.outbox.message(FAILED_MESSAGE_ID)
    const result = await s.retry(retryOf(), sender())

    expect(result.message).toMatchObject({ status: 'FAILED', errorCode: '190', errorReason: TOKEN_INVALID_MESSAGE })
    expect(s.outbox.message(FAILED_MESSAGE_ID)).toEqual(before)
    expect(s.repository.row(CONNECTION_ID)).toMatchObject({ status: 'ERROR', lastError: TOKEN_INVALID_MESSAGE })
  })

  it('R39: aplica las reglas de R5 — un contacto que ya no tiene cliente responde whatsapp_recipient_not_customer', async () => {
    const s = setup({ contacts: [outboxContact({ customerId: null })] })
    await expectPriorRejection(s, s.retry(retryOf(), sender()), 'whatsapp_recipient_not_customer')
  })

  it('R39: aplica las reglas de R5 — un cliente dado de baja responde whatsapp_recipient_not_customer', async () => {
    const s = setup({ alive: false })
    await expectPriorRejection(s, s.retry(retryOf(), sender()), 'whatsapp_recipient_not_customer')
  })

  it('R39: un fallido de una conexion anterior responde whatsapp_contact_not_found: su contacto no es de la conexion viva', async () => {
    const s = setup({
      contacts: [outboxContact({ connectionId: NEW_CONNECTION_ID })],
      messages: [outboxMessage({ connectionId: NEW_CONNECTION_ID })],
    })
    await expectPriorRejection(s, s.retry(retryOf(), sender()), 'whatsapp_contact_not_found')
  })

  it('R39: aplica R10 — un contacto bloqueado responde whatsapp_contact_blocked', async () => {
    const s = setup({ contacts: [outboxContact({ blockedAt: new Date('2026-10-05T00:00:00.000Z') })] })
    await expectPriorRejection(s, s.retry(retryOf(), sender()), 'whatsapp_contact_blocked')
  })

  it('R39: aplica R13 — con la conexion deshabilitada responde whatsapp_connection_not_active', async () => {
    const s = setup({ connection: { status: 'DISABLED' } })
    await expectPriorRejection(s, s.retry(retryOf(), sender()), 'whatsapp_connection_not_active')
  })
})

describe('retryWhatsappMessage — texto', () => {
  it('R41: reenvia el mismo body del fallido con la ventana abierta', async () => {
    const s = setup()
    await s.retry(retryOf({ constants: { 'cliente.nombre': 'ignorado' } }), sender())
    expect(s.graph.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: { type: 'text', body: 'Hola, su pedido salio hoy' } }),
    )
    expect(s.outbox.insertSending).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TEXT', body: 'Hola, su pedido salio hoy', payload: {} }),
      { companyId: COMPANY_ID },
    )
  })

  it('R41: valida la ventana en el momento del reintento: cerrada hoy responde whatsapp_window_closed', async () => {
    const s = setup({ contacts: [outboxContact({ lastInboundAt: new Date(NOW.getTime() - 25 * 60 * 60 * 1000) })] })
    await expectPriorRejection(s, s.retry(retryOf(), sender()), 'whatsapp_window_closed')
  })
})

describe('retryWhatsappMessage — plantilla', () => {
  it('R42: busca la plantilla viva de la conexion por templateName e idioma y recalcula con los valores de hoy', async () => {
    const s = setup({
      messages: [FAILED_TEMPLATE],
      variableKeys: [storedVariableKey({ value: '999-111' })],
      contacts: [outboxContact({ lastInboundAt: null })],
    })
    const result = await s.retry(retryOf(TEMPLATE_VALUES), sender())

    expect(s.templates.findLiveByNameAndLanguage).toHaveBeenCalledWith(CONNECTION_ID, 'aviso_cuenta', 'es_MX', {
      companyId: COMPANY_ID,
    })
    expect(s.outbox.insertSending).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'TEMPLATE',
        body: 'Hola Ana Maria, su cuenta 999-111 esta lista.',
        templateName: 'aviso_cuenta',
        templateLanguage: 'es_MX',
        payload: { 'cliente.nombre': 'Ana Maria', cuenta_numero: '999-111' },
      }),
      { companyId: COMPANY_ID },
    )
    expect(result.message).toMatchObject({ type: 'TEMPLATE', status: 'SENT' })
    expect(s.outbox.message(FAILED_MESSAGE_ID)).toEqual(FAILED_TEMPLATE)
  })

  it('R42: la variable propia toma su value vigente aunque el front mande otro para esa clave', async () => {
    const s = setup({ messages: [FAILED_TEMPLATE] })
    await s.retry(retryOf({ ...TEMPLATE_VALUES, constants: { 'cliente.nombre': 'Ana', cuenta_numero: 'del front' } }), sender())
    expect(s.outbox.insertSending).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { 'cliente.nombre': 'Ana', cuenta_numero: '123-456' } }),
      { companyId: COMPANY_ID },
    )
  })

  it.each([
    ['ya no existe', []],
    ['esta eliminada', [mappedTemplate({ deletedAt: new Date('2026-10-08T13:00:00.000Z') })]],
    ['tiene otro idioma', [mappedTemplate({ language: 'en_US' })]],
    ['es de otra conexion', [mappedTemplate({ connectionId: NEW_CONNECTION_ID })]],
  ])('R42: una plantilla que %s responde whatsapp_template_not_found como rechazo previo', async (_caso, templates) => {
    const s = setup({ messages: [FAILED_TEMPLATE], templates })
    await expectPriorRejection(s, s.retry(retryOf(TEMPLATE_VALUES), sender()), 'whatsapp_template_not_found')
  })

  it.each([
    ['se deshabilito', { enabled: false }],
    ['dejo de estar aprobada', { status: 'PAUSED' as const }],
  ])('R42: una plantilla que %s responde whatsapp_template_not_sendable como rechazo previo', async (_caso, overrides) => {
    const s = setup({ messages: [FAILED_TEMPLATE], templates: [mappedTemplate(overrides)] })
    await expectPriorRejection(s, s.retry(retryOf(TEMPLATE_VALUES), sender()), 'whatsapp_template_not_sendable')
  })

  it('R42: sin el valor de una constante en el reintento responde whatsapp_template_values_missing con su etiqueta', async () => {
    const s = setup({ messages: [FAILED_TEMPLATE] })
    const error = await s.retry(retryOf(), sender()).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(WhatsappTemplateValuesMissingError)
    expect((error as WhatsappTemplateValuesMissingError).missing).toEqual([{ key: 'cliente.nombre', label: 'cliente.nombre' }])
    await expectPriorRejection(s, s.retry(retryOf(), sender()), 'whatsapp_template_values_missing')
  })
})

describe('retryWhatsappMessage — log (R46)', () => {
  it('R46: un fallo de Meta entrega al puerto de log el id del mensaje y el diagnostico, sin texto de Meta, texto, valores, numero ni token', async () => {
    const metaText = 'Recipient 573001234567 said: Hola, su pedido salio hoy'
    const s = setup({ sent: { ok: false, kind: 'rejected', message: metaText, code: 131026, subcode: 7 } })
    const result = await s.retry(retryOf(), sender())

    expect(result.message).toMatchObject({ status: 'FAILED' })
    expect(result.message.id).not.toBe(FAILED_MESSAGE_ID)
    expect(s.log.sendFailed).toHaveBeenCalledTimes(1)
    expect(s.log.sendFailed).toHaveBeenCalledWith({
      messageId: result.message.id,
      diagnostic: 'Graph enviar mensaje: rejected; code=131026; subcode=7',
    })
    const logged = JSON.stringify(s.log.sendFailed.mock.calls)
    for (const leak of ['Recipient', 'Hola, su pedido salio hoy', outboxContact().waId, ACCESS_TOKEN]) {
      expect(logged).not.toContain(leak)
    }
    expect(result).not.toHaveProperty('diagnostic')

    const template = setup({ messages: [FAILED_TEMPLATE], sent: { ok: false, kind: 'unreachable', message: null } })
    const templated = await template.retry(retryOf(TEMPLATE_VALUES), sender())
    expect(template.log.sendFailed).toHaveBeenCalledWith({
      messageId: templated.message.id,
      diagnostic: 'Graph enviar mensaje: unreachable; code=-; subcode=-',
    })
    const loggedTemplate = JSON.stringify(template.log.sendFailed.mock.calls)
    for (const leak of ['Ana', '123-456', outboxContact().waId, ACCESS_TOKEN]) expect(loggedTemplate).not.toContain(leak)
  })

  it('R46: un envio correcto no llama al puerto de log', async () => {
    const s = setup()
    await s.retry(retryOf(), sender())
    expect(s.log.sendFailed).not.toHaveBeenCalled()
  })
})
