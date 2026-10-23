import { describe, expect, it, vi } from 'vitest'

import type { Actor } from '@/lib/modules/integraciones/domain/actor'
import { UNREADABLE_SECRET_MESSAGE } from '@/lib/modules/integraciones/domain/connection-secrets'
import { WhatsappTemplateValuesMissingError } from '@/lib/modules/integraciones/domain/errors'
import {
  createSendWhatsappMessage,
  type SendWhatsappMessageDeps,
} from '@/lib/modules/integraciones/domain/send-whatsapp-message'
import type { WhatsappConnectionRecord } from '@/lib/modules/integraciones/domain/whatsapp-connection'
import {
  RATE_LIMITED_REASON,
  TOKEN_INVALID_MESSAGE,
  UNREACHABLE_REASON,
  WINDOW_CLOSED_REASON,
  rejectedWithCodeReason,
} from '@/lib/modules/integraciones/domain/whatsapp-send-failure'
import { WHATSAPP_TEXT_MAX_LENGTH } from '@/lib/modules/integraciones/domain/whatsapp-send-input'
import type { WhatsappTemplateRecord } from '@/lib/modules/integraciones/domain/whatsapp-template'
import type { WhatsappVariableKeyRecord } from '@/lib/modules/integraciones/domain/whatsapp-variable-key'
import type { GraphMessageSent } from '@/lib/modules/integraciones/ports/whatsapp-graph-client'

import {
  ACCESS_TOKEN,
  ACTOR_ID,
  COMPANY_ID,
  CONNECTION_ID,
  CONTACT_ID,
  CUSTOMER_ID,
  NEW_CONNECTION_ID,
  NOW,
  OTHER_COMPANY_ID,
  OTHER_CONTACT_ID,
  OTHER_CUSTOMER_ID,
  SENT_WAMID,
  TEMPLATE_ID,
  makeCipher,
  makeCustomerPhoneLinks,
  makeGraph,
  makeOutbox,
  makeRepository,
  makeSendLog,
  makeTemplateRepository,
  makeVariableKeyRepository,
  outboxContact,
  storedConnection,
  storedTemplate,
  storedVariableKey,
  type OutboxContactRow,
} from '../whatsapp-doubles'

const ACCOUNT_KEY = storedVariableKey()
const HOUR = 60 * 60 * 1000

function sender(overrides: Partial<Actor> = {}): Actor {
  return { id: ACTOR_ID, companyId: COMPANY_ID, permissions: ['whatsapp.enviar'], ...overrides }
}

function mappedTemplate(overrides: Partial<WhatsappTemplateRecord> = {}): WhatsappTemplateRecord {
  return storedTemplate({
    name: 'aviso_cuenta',
    language: 'es_MX',
    components: [
      { type: 'BODY', text: 'Hola {{1}}, su cuenta {{2}} esta lista.' },
      { type: 'FOOTER', text: 'Cobranza' },
    ],
    variables: [
      { slot: 'body.1', kind: 'system', systemKey: 'cliente.nombre' },
      { slot: 'body.2', kind: 'company', variableKeyId: ACCOUNT_KEY.id },
    ],
    ...overrides,
  })
}

type SetupOptions = {
  connection?: Partial<WhatsappConnectionRecord> | null
  contacts?: readonly OutboxContactRow[]
  templates?: WhatsappTemplateRecord[]
  variableKeys?: WhatsappVariableKeyRecord[]
  mainPhone?: Awaited<ReturnType<SendWhatsappMessageDeps['customerPhones']['mainPhoneOf']>>
  alive?: boolean
  sent?: GraphMessageSent
}

function setup(options: SetupOptions = {}) {
  const cipherDouble = makeCipher()
  const connection =
    options.connection === null ? [] : [storedConnection(cipherDouble.seed, { status: 'ACTIVE', ...options.connection })]
  const repository = makeRepository(connection)
  const outboxDouble = makeOutbox({ contacts: options.contacts ?? [outboxContact()] })
  const templateDouble = makeTemplateRepository(options.templates ?? [mappedTemplate()])
  const keyDouble = makeVariableKeyRepository(options.variableKeys ?? [ACCOUNT_KEY])
  const phones = makeCustomerPhoneLinks({ mainPhone: options.mainPhone, alive: options.alive })
  const graphDouble = makeGraph()
  const logDouble = makeSendLog()
  if (options.sent !== undefined) {
    const sent = options.sent
    graphDouble.sendMessage.mockImplementation(async () => sent)
  }
  const deps: SendWhatsappMessageDeps = {
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
    repository.findLiveById,
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
    send: createSendWhatsappMessage(deps),
    repository,
    cipher: cipherDouble,
    outbox: outboxDouble,
    templates: templateDouble,
    keys: keyDouble,
    phones,
    graph: graphDouble,
    log: logDouble,
    portSpies,
  }
}

type Setup = ReturnType<typeof setup>

function textTo(recipient: Record<string, string> = { contactId: CONTACT_ID }, text = 'Hola, su pedido salio hoy') {
  return { kind: 'text', recipient, text }
}

function templateTo(
  recipient: Record<string, string> = { contactId: CONTACT_ID },
  extra: Record<string, unknown> = {},
) {
  return {
    kind: 'template',
    recipient,
    templateId: TEMPLATE_ID,
    constants: { 'cliente.nombre': 'Ana' },
    constantLabels: { 'cliente.nombre': 'Nombre del cliente' },
    ...extra,
  }
}

async function expectPriorRejection(s: Setup, run: Promise<unknown>, code: string) {
  await expect(run).rejects.toMatchObject({ code })
  expect(s.outbox.insertSending).not.toHaveBeenCalled()
  expect(s.graph.sendMessage).not.toHaveBeenCalled()
  expect(s.outbox.markSent).not.toHaveBeenCalled()
  expect(s.outbox.markFailed).not.toHaveBeenCalled()
  expect(s.outbox.touchContact).not.toHaveBeenCalled()
}

describe('sendWhatsappMessage — permiso', () => {
  it.each([
    ['sin whatsapp.enviar', sender({ permissions: ['integraciones.modificar'] })],
    ['sin empresa', sender({ companyId: '' })],
    ['sin actor', null],
  ])('R4: %s responde unauthorized antes de validar la entrada y sin tocar ningun puerto', async (_caso, actor) => {
    const s = setup()
    await expect(s.send({ kind: 'nada' }, actor)).rejects.toMatchObject({ code: 'unauthorized' })
    await expect(s.send(textTo(), actor)).rejects.toMatchObject({ code: 'unauthorized' })
    for (const spy of s.portSpies) expect(spy).not.toHaveBeenCalled()
  })
})

describe('sendWhatsappMessage — destinatario por contacto', () => {
  it.each([
    ['no existe', OTHER_CONTACT_ID, [outboxContact()]],
    ['es de otra empresa', CONTACT_ID, [outboxContact({ companyId: OTHER_COMPANY_ID })]],
    ['es de otra conexion', CONTACT_ID, [outboxContact({ connectionId: NEW_CONNECTION_ID })]],
  ])('R5: un contacto que %s responde whatsapp_contact_not_found como rechazo previo', async (_caso, contactId, contacts) => {
    const s = setup({ contacts })
    await expectPriorRejection(s, s.send(textTo({ contactId }), sender()), 'whatsapp_contact_not_found')
    expect(s.outbox.findContact).toHaveBeenCalledWith(contactId, CONNECTION_ID, { companyId: COMPANY_ID })
  })

  it('R5: un contacto sin cliente responde whatsapp_recipient_not_customer como rechazo previo', async () => {
    const s = setup({ contacts: [outboxContact({ customerId: null })] })
    await expectPriorRejection(s, s.send(textTo(), sender()), 'whatsapp_recipient_not_customer')
  })

  it('R5: un contacto cuyo cliente esta dado de baja responde whatsapp_recipient_not_customer', async () => {
    const s = setup({ alive: false })
    await expectPriorRejection(s, s.send(textTo(), sender()), 'whatsapp_recipient_not_customer')
    expect(s.phones.isCustomerAlive).toHaveBeenCalledWith(CUSTOMER_ID, COMPANY_ID)
  })

  it('R10: un contacto bloqueado responde whatsapp_contact_blocked como rechazo previo', async () => {
    const s = setup({ contacts: [outboxContact({ blockedAt: new Date('2026-10-01T00:00:00.000Z') })] })
    await expectPriorRejection(s, s.send(textTo(), sender()), 'whatsapp_contact_blocked')
  })
})

describe('sendWhatsappMessage — destinatario por cliente', () => {
  const MAIN_PHONE = { e164: '525512345678' }

  it('R6: un cliente que no esta vivo en la empresa responde customer_not_found como rechazo previo', async () => {
    const s = setup({ mainPhone: 'customer_not_found' })
    await expectPriorRejection(s, s.send(textTo({ customerId: CUSTOMER_ID }), sender()), 'customer_not_found')
    expect(s.phones.mainPhoneOf).toHaveBeenCalledWith(CUSTOMER_ID, COMPANY_ID)
    expect(s.outbox.ensureContact).not.toHaveBeenCalled()
  })

  it('R7: un cliente sin phone_e164 responde whatsapp_customer_without_phone como rechazo previo', async () => {
    const s = setup({ mainPhone: 'no_phone' })
    await expectPriorRejection(s, s.send(textTo({ customerId: CUSTOMER_ID }), sender()), 'whatsapp_customer_without_phone')
    expect(s.outbox.ensureContact).not.toHaveBeenCalled()
    expect(s.outbox.linkContact).not.toHaveBeenCalled()
  })

  it('R8: usa el contacto sin cliente cuyo waId coincide con una variante del numero y lo vincula como manual del actor', async () => {
    const contact = outboxContact({ waId: '5215512345678', customerId: null })
    const s = setup({ mainPhone: MAIN_PHONE, contacts: [contact] })
    const result = await s.send(templateTo({ customerId: CUSTOMER_ID }), sender())

    expect(s.outbox.findContactsByWaIds).toHaveBeenCalledWith(
      CONNECTION_ID,
      expect.arrayContaining(['525512345678', '5215512345678']),
      { companyId: COMPANY_ID },
    )
    expect(s.outbox.ensureContact).not.toHaveBeenCalled()
    expect(s.outbox.linkContact).toHaveBeenCalledWith(
      CONTACT_ID,
      { customerId: CUSTOMER_ID, linkedBy: ACTOR_ID },
      { companyId: COMPANY_ID },
    )
    expect(s.outbox.contact(CONTACT_ID)).toMatchObject({ customerId: CUSTOMER_ID, customerLinkedBy: ACTOR_ID })
    expect(s.graph.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ to: '5215512345678' }))
    expect(result.message.status).toBe('SENT')
  })

  it('R8: prefiere el contacto ya vinculado a ese cliente y no reescribe el vinculo', async () => {
    const free = outboxContact({ id: OTHER_CONTACT_ID, waId: '525512345678', customerId: null })
    const own = outboxContact({ waId: '5215512345678', customerId: CUSTOMER_ID })
    const s = setup({ mainPhone: MAIN_PHONE, contacts: [free, own] })
    await s.send(textTo({ customerId: CUSTOMER_ID }), sender())

    expect(s.outbox.linkContact).not.toHaveBeenCalled()
    expect(s.outbox.insertSending).toHaveBeenCalledWith(expect.objectContaining({ contactId: CONTACT_ID }), {
      companyId: COMPANY_ID,
    })
  })

  it('R8, R11: sin contacto para el numero lo crea con waId = phone_e164 por ensureContact y lo vincula como manual', async () => {
    const s = setup({ mainPhone: MAIN_PHONE, contacts: [] })
    const result = await s.send(templateTo({ customerId: CUSTOMER_ID }), sender())

    expect(s.outbox.ensureContact).toHaveBeenCalledWith(CONNECTION_ID, '525512345678', { companyId: COMPANY_ID })
    const [created] = s.outbox.allContacts()
    expect(created).toMatchObject({ waId: '525512345678', customerId: CUSTOMER_ID, customerLinkedBy: ACTOR_ID })
    expect(s.outbox.linkContact).toHaveBeenCalledWith(
      created?.id,
      { customerId: CUSTOMER_ID, linkedBy: ACTOR_ID },
      { companyId: COMPANY_ID },
    )
    expect(result.message.status).toBe('SENT')
  })

  it('R11: si ensureContact devuelve el contacto que otro envio acaba de crear, se usa ese y no se crea otro', async () => {
    const s = setup({ mainPhone: MAIN_PHONE, contacts: [] })
    await s.send(templateTo({ customerId: CUSTOMER_ID }), sender())
    s.outbox.findContactsByWaIds.mockImplementationOnce(async () => [])
    await s.send(templateTo({ customerId: CUSTOMER_ID }), sender())

    expect(s.outbox.ensureContact).toHaveBeenCalledTimes(2)
    expect(s.outbox.allContacts()).toHaveLength(1)
    const contactIds = s.outbox.insertSending.mock.calls.map(([row]) => row.contactId)
    expect(new Set(contactIds).size).toBe(1)
  })

  it('R9: el contacto del numero vinculado a otro cliente responde whatsapp_contact_linked_elsewhere sin tocar el vinculo', async () => {
    const s = setup({ mainPhone: MAIN_PHONE, contacts: [outboxContact({ waId: '525512345678', customerId: OTHER_CUSTOMER_ID })] })
    await expectPriorRejection(s, s.send(textTo({ customerId: CUSTOMER_ID }), sender()), 'whatsapp_contact_linked_elsewhere')
    expect(s.outbox.linkContact).not.toHaveBeenCalled()
    expect(s.outbox.ensureContact).not.toHaveBeenCalled()
    expect(s.outbox.contact(CONTACT_ID)?.customerId).toBe(OTHER_CUSTOMER_ID)
  })

  it('R10: el contacto bloqueado del numero del cliente responde whatsapp_contact_blocked sin vincularlo', async () => {
    const s = setup({
      mainPhone: MAIN_PHONE,
      contacts: [outboxContact({ waId: '525512345678', customerId: null, blockedAt: new Date('2026-10-01T00:00:00.000Z') })],
    })
    await expectPriorRejection(s, s.send(textTo({ customerId: CUSTOMER_ID }), sender()), 'whatsapp_contact_blocked')
    expect(s.outbox.linkContact).not.toHaveBeenCalled()
  })
})

describe('sendWhatsappMessage — conexion', () => {
  it('R12: sin conexion viva responde whatsapp_connection_not_found como rechazo previo', async () => {
    const s = setup({ connection: null })
    await expectPriorRejection(s, s.send(textTo(), sender()), 'whatsapp_connection_not_found')
  })

  it('R12: la conexion de otra empresa no cuenta', async () => {
    const s = setup({ connection: { companyId: OTHER_COMPANY_ID } })
    await expectPriorRejection(s, s.send(textTo(), sender()), 'whatsapp_connection_not_found')
  })

  it.each(['PENDING', 'ERROR', 'DISABLED'] as const)(
    'R13: con la conexion en %s responde whatsapp_connection_not_active como rechazo previo',
    async (status) => {
      const s = setup({ connection: { status } })
      await expectPriorRejection(s, s.send(textTo(), sender()), 'whatsapp_connection_not_active')
      expect(s.outbox.findContact).not.toHaveBeenCalled()
      expect(s.cipher.decrypt).not.toHaveBeenCalled()
    },
  )

  it('R14: un token que no se descifra responde integration_secret_unreadable, deja la conexion en ERROR y no escribe ni llama a Meta', async () => {
    const s = setup({ connection: { accessTokenEnc: 'v1:ilegible' } })
    await expectPriorRejection(s, s.send(textTo(), sender()), 'integration_secret_unreadable')
    expect(s.repository.row(CONNECTION_ID)).toMatchObject({ status: 'ERROR', lastError: UNREADABLE_SECRET_MESSAGE })
  })
})

describe('sendWhatsappMessage — ventana y texto libre', () => {
  it('R15: con la ventana abierta se envia el texto libre', async () => {
    const s = setup({ contacts: [outboxContact({ lastInboundAt: new Date(NOW.getTime() - 23 * HOUR) })] })
    const result = await s.send(textTo(), sender())
    expect(result.message).toMatchObject({ type: 'TEXT', status: 'SENT', body: 'Hola, su pedido salio hoy' })
  })

  it.each([
    ['sin mensajes del cliente', null],
    ['con el ultimo mensaje de hace 24 h exactas', new Date(NOW.getTime() - 24 * HOUR)],
  ])('R16: %s el texto libre responde whatsapp_window_closed como rechazo previo', async (_caso, lastInboundAt) => {
    const s = setup({ contacts: [outboxContact({ lastInboundAt })] })
    await expectPriorRejection(s, s.send(textTo(), sender()), 'whatsapp_window_closed')
  })

  it.each([
    ['vacio', ''],
    ['solo espacios', '   \n '],
    ['mas largo que el maximo de Meta', 'a'.repeat(WHATSAPP_TEXT_MAX_LENGTH + 1)],
  ])('R17: un texto %s responde invalid_input sin tocar ningun puerto', async (_caso, text) => {
    const s = setup()
    await expect(s.send(textTo(undefined, text), sender())).rejects.toMatchObject({ code: 'invalid_input' })
    for (const spy of s.portSpies) expect(spy).not.toHaveBeenCalled()
  })

  it('R17: un texto justo en el maximo se acepta', async () => {
    const s = setup()
    const result = await s.send(textTo(undefined, 'a'.repeat(WHATSAPP_TEXT_MAX_LENGTH)), sender())
    expect(result.message.status).toBe('SENT')
  })

  it.each([
    ['abierta', new Date(NOW.getTime() - HOUR)],
    ['cerrada', null],
  ])('R18: una plantilla enviable se envia con la ventana %s', async (_caso, lastInboundAt) => {
    const s = setup({ contacts: [outboxContact({ lastInboundAt })] })
    const result = await s.send(templateTo(), sender())
    expect(result.message).toMatchObject({ type: 'TEMPLATE', status: 'SENT' })
  })
})

describe('sendWhatsappMessage — plantilla', () => {
  it.each([
    ['no existe', []],
    ['esta eliminada', [mappedTemplate({ deletedAt: new Date('2026-10-02T00:00:00.000Z') })]],
    ['es de otra empresa', [mappedTemplate({ companyId: OTHER_COMPANY_ID })]],
    ['es de otra conexion', [mappedTemplate({ connectionId: NEW_CONNECTION_ID })]],
  ])('R19: una plantilla que %s responde whatsapp_template_not_found como rechazo previo', async (_caso, templates) => {
    const s = setup({ templates })
    await expectPriorRejection(s, s.send(templateTo(), sender()), 'whatsapp_template_not_found')
  })

  it.each([
    ['deshabilitada', { enabled: false }],
    ['sin relacionar', { mappingStatus: 'UNMAPPED' as const }],
    ['pendiente en Meta', { status: 'PENDING' as const }],
    ['rechazada por Meta', { status: 'REJECTED' as const }],
  ])('R20: una plantilla %s responde whatsapp_template_not_sendable como rechazo previo', async (_caso, overrides) => {
    const s = setup({ templates: [mappedTemplate(overrides)] })
    await expectPriorRejection(s, s.send(templateTo(), sender()), 'whatsapp_template_not_sendable')
  })

  it('R20: un hueco sin relacion responde whatsapp_template_not_sendable como rechazo previo', async () => {
    const s = setup({ templates: [mappedTemplate({ variables: [{ slot: 'body.1', kind: 'system', systemKey: 'cliente.nombre' }] })] })
    await expectPriorRejection(s, s.send(templateTo(), sender()), 'whatsapp_template_not_sendable')
  })

  it('R20, R24: una constante sin valor responde whatsapp_template_values_missing con su etiqueta y clave, como rechazo previo', async () => {
    const s = setup()
    const run = s.send(templateTo(undefined, { constants: { 'cliente.nombre': '  ' } }), sender())
    await expectPriorRejection(s, run, 'whatsapp_template_values_missing')
    const error = await s.send(templateTo(undefined, { constants: {} }), sender()).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(WhatsappTemplateValuesMissingError)
    expect((error as WhatsappTemplateValuesMissingError).missing).toEqual([
      { key: 'cliente.nombre', label: 'Nombre del cliente' },
    ])
  })
})

describe('sendWhatsappMessage — el mensaje y la llamada a Meta', () => {
  it('R26, R27: un texto inserta el mensaje SENDING del actor con TEXT, body y payload vacio antes de llamar a Meta', async () => {
    const s = setup()
    const order: string[] = []
    s.outbox.insertSending.mockImplementationOnce(async (row, scope) => {
      order.push('insertSending')
      expect(s.graph.sendMessage).not.toHaveBeenCalled()
      return makeOutbox().outbox.insertSending(row, scope)
    })
    s.graph.sendMessage.mockImplementationOnce(async () => {
      order.push('sendMessage')
      return { ok: true, wamid: SENT_WAMID }
    })
    await s.send(textTo(), sender())

    expect(order).toEqual(['insertSending', 'sendMessage'])
    expect(s.outbox.insertSending).toHaveBeenCalledWith(
      {
        connectionId: CONNECTION_ID,
        contactId: CONTACT_ID,
        sentById: ACTOR_ID,
        type: 'TEXT',
        body: 'Hola, su pedido salio hoy',
        templateName: null,
        templateLanguage: null,
        payload: {},
      },
      { companyId: COMPANY_ID },
    )
  })

  it('R26: el mensaje insertado queda OUT, USER, con attempts 1 en el doble del adaptador', async () => {
    const s = setup()
    await s.send(textTo(), sender())
    const [row] = s.outbox.allMessages()
    expect(row).toMatchObject({ direction: 'OUT', origin: 'USER', attempts: 1, sentById: ACTOR_ID, companyId: COMPANY_ID })
  })

  it('R28: una plantilla guarda TEMPLATE, el texto final, templateName, idioma y los valores por clave en payload', async () => {
    const s = setup()
    await s.send(templateTo(undefined, { constants: { 'cliente.nombre': 'Ana', cuenta_numero: 'del front' } }), sender())

    expect(s.outbox.insertSending).toHaveBeenCalledWith(
      {
        connectionId: CONNECTION_ID,
        contactId: CONTACT_ID,
        sentById: ACTOR_ID,
        type: 'TEMPLATE',
        body: 'Hola Ana, su cuenta 123-456 esta lista.\n\nCobranza',
        templateName: 'aviso_cuenta',
        templateLanguage: 'es_MX',
        payload: { 'cliente.nombre': 'Ana', cuenta_numero: '123-456' },
      },
      { companyId: COMPANY_ID },
    )
  })

  it('R29: llama a Graph con el phone_number_id, el token descifrado, el waId del contacto y el texto', async () => {
    const s = setup()
    await s.send(textTo(), sender())
    expect(s.graph.sendMessage).toHaveBeenCalledWith({
      phoneNumberId: '3456789012',
      accessToken: ACCESS_TOKEN,
      to: '573001234567',
      message: { type: 'text', body: 'Hola, su pedido salio hoy' },
    })
  })

  it('R29: una plantilla viaja con su nombre, idioma y los parametros armados desde el mapeo', async () => {
    const s = setup()
    await s.send(templateTo(), sender())
    expect(s.graph.sendMessage).toHaveBeenCalledWith({
      phoneNumberId: '3456789012',
      accessToken: ACCESS_TOKEN,
      to: '573001234567',
      message: {
        type: 'template',
        name: 'aviso_cuenta',
        language: 'es_MX',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'Ana' },
              { type: 'text', text: '123-456' },
            ],
          },
        ],
      },
    })
  })

  it('R30: si Meta acepta, guarda el wamid y deja el mensaje SENT', async () => {
    const s = setup()
    const result = await s.send(textTo(), sender())
    expect(s.outbox.markSent).toHaveBeenCalledWith(result.message.id, SENT_WAMID, { companyId: COMPANY_ID })
    expect(s.outbox.message(result.message.id)).toMatchObject({ status: 'SENT', wamid: SENT_WAMID })
    expect(s.outbox.markFailed).not.toHaveBeenCalled()
  })

  it('R30: si el mensaje ya no esta en SENDING, markSent no cambia nada y el envio igual responde con su resultado', async () => {
    const s = setup()
    s.outbox.markSent.mockImplementationOnce(async () => null)
    const result = await s.send(textTo(), sender())
    expect(result.message.status).toBe('SENT')
    expect(s.outbox.message(result.message.id)?.status).toBe('SENDING')
  })

  it.each([
    ['un rechazo con codigo', { ok: false, kind: 'rejected', message: 'x', code: 131026, subcode: null } as const, '131026', rejectedWithCodeReason(131026)],
    ['la falta de respuesta', { ok: false, kind: 'unreachable', message: null } as const, null, UNREACHABLE_REASON],
  ])('R31: con %s el mensaje queda FAILED con errorCode y errorReason traducidos', async (_caso, sent, errorCode, errorReason) => {
    const s = setup({ sent })
    const result = await s.send(textTo(), sender())
    expect(s.outbox.markFailed).toHaveBeenCalledWith(result.message.id, errorCode, errorReason, { companyId: COMPANY_ID })
    expect(s.outbox.message(result.message.id)).toMatchObject({ status: 'FAILED', errorCode, errorReason })
    expect(s.outbox.markSent).not.toHaveBeenCalled()
  })

  it('R32: al terminar actualiza lastMessageAt del contacto con la hora del envio, tambien si Meta falla', async () => {
    const ok = setup()
    await ok.send(textTo(), sender())
    expect(ok.outbox.touchContact).toHaveBeenCalledWith(CONTACT_ID, NOW, { companyId: COMPANY_ID })
    expect(ok.outbox.contact(CONTACT_ID)?.lastMessageAt).toEqual(NOW)

    const failed = setup({ sent: { ok: false, kind: 'unreachable', message: null } })
    await failed.send(textTo(), sender())
    expect(failed.outbox.touchContact).toHaveBeenCalledWith(CONTACT_ID, NOW, { companyId: COMPANY_ID })
    expect(failed.outbox.contact(CONTACT_ID)?.lastInboundAt).toEqual(outboxContact().lastInboundAt)
  })

  it('R33: el codigo 190 deja el mensaje FAILED y la conexion en ERROR con «Revisa el token en Integraciones»', async () => {
    const s = setup({ sent: { ok: false, kind: 'rejected', message: 'Error validating access token', code: 190, subcode: 463 } })
    const result = await s.send(textTo(), sender())
    expect(result.message).toMatchObject({ status: 'FAILED', errorCode: '190', errorReason: TOKEN_INVALID_MESSAGE })
    expect(s.repository.update).toHaveBeenCalledWith(
      CONNECTION_ID,
      { status: 'ERROR', lastError: TOKEN_INVALID_MESSAGE },
      { companyId: COMPANY_ID },
    )
    expect(s.repository.row(CONNECTION_ID)).toMatchObject({ status: 'ERROR', lastError: TOKEN_INVALID_MESSAGE })
  })

  it.each([
    ['R34', 131047, WINDOW_CLOSED_REASON],
    ['R35', 130429, RATE_LIMITED_REASON],
    ['R35', 131056, RATE_LIMITED_REASON],
  ])('%s: el codigo %s deja el mensaje FAILED con su texto y la conexion igual', async (_r, code, reason) => {
    const s = setup({ sent: { ok: false, kind: 'rejected', message: 'texto de Meta', code, subcode: null } })
    const result = await s.send(textTo(), sender())
    expect(result.message).toMatchObject({ status: 'FAILED', errorCode: String(code), errorReason: reason })
    expect(s.repository.update).not.toHaveBeenCalled()
  })

  it('R36: otro codigo da el texto generico con el codigo, y el texto de Meta no se guarda ni se devuelve', async () => {
    const metaText = 'Recipient 573001234567 said: Hola, su pedido salio hoy'
    const s = setup({ sent: { ok: false, kind: 'rejected', message: metaText, code: 131026, subcode: 7 } })
    const result = await s.send(textTo(), sender())

    expect(result.message).toMatchObject({ errorCode: '131026', errorReason: rejectedWithCodeReason(131026) })
    expect(JSON.stringify(result)).not.toContain('Recipient')
    expect(JSON.stringify(s.outbox.message(result.message.id))).not.toContain('Recipient')
    expect(s.log.sendFailed).toHaveBeenCalledWith({
      messageId: result.message.id,
      diagnostic: 'Graph enviar mensaje: rejected; code=131026; subcode=7',
    })
  })

  it('R36: la falta de respuesta deja errorCode nulo y el texto de «No se pudo contactar con Meta»', async () => {
    const s = setup({ sent: { ok: false, kind: 'unreachable', message: null } })
    const result = await s.send(textTo(), sender())
    expect(result.message).toMatchObject({ status: 'FAILED', errorCode: null, errorReason: UNREACHABLE_REASON })
    expect(s.log.sendFailed).toHaveBeenCalledWith({
      messageId: result.message.id,
      diagnostic: 'Graph enviar mensaje: unreachable; code=-; subcode=-',
    })
  })

  it('R37: devuelve el mensaje resultante como resultado correcto, SENT o FAILED', async () => {
    const ok = setup()
    const sent = await ok.send(templateTo(), sender())
    expect(sent).toEqual({
      message: {
        id: expect.any(String),
        type: 'TEMPLATE',
        status: 'SENT',
        body: 'Hola Ana, su cuenta 123-456 esta lista.\n\nCobranza',
        templateName: 'aviso_cuenta',
        templateLanguage: 'es_MX',
        errorCode: null,
        errorReason: null,
        createdAt: NOW.toISOString(),
      },
    })

    const failed = setup({ sent: { ok: false, kind: 'rejected', message: null, code: 131047 } })
    await expect(failed.send(textTo(), sender())).resolves.toMatchObject({
      message: { type: 'TEXT', status: 'FAILED', errorCode: '131047', errorReason: WINDOW_CLOSED_REASON },
    })
  })

  it('R46: un fallo de Meta entrega al puerto de log el id del mensaje y el diagnostico, sin texto de Meta, texto, valores, numero ni token', async () => {
    const text = 'Hola, su pedido salio hoy'
    const metaText = 'Recipient 573001234567 said: Hola, su pedido salio hoy'
    const s = setup({ sent: { ok: false, kind: 'rejected', message: metaText, code: 131026, subcode: 7 } })
    const result = await s.send(textTo({ contactId: CONTACT_ID }, text), sender())

    expect(s.log.sendFailed).toHaveBeenCalledTimes(1)
    expect(s.log.sendFailed).toHaveBeenCalledWith({
      messageId: result.message.id,
      diagnostic: 'Graph enviar mensaje: rejected; code=131026; subcode=7',
    })
    const logged = JSON.stringify(s.log.sendFailed.mock.calls)
    for (const leak of ['Recipient', text, outboxContact().waId, ACCESS_TOKEN]) expect(logged).not.toContain(leak)
    expect(result).not.toHaveProperty('diagnostic')

    const template = setup({ sent: { ok: false, kind: 'rejected', message: metaText, code: 131026, subcode: 7 } })
    await template.send(templateTo(), sender())
    const loggedTemplate = JSON.stringify(template.log.sendFailed.mock.calls)
    for (const leak of ['Ana', '123-456', outboxContact().waId, ACCESS_TOKEN]) expect(loggedTemplate).not.toContain(leak)
  })

  it('R46: un envio correcto no llama al puerto de log', async () => {
    const s = setup()
    await s.send(textTo(), sender())
    await s.send(templateTo(), sender())
    expect(s.log.sendFailed).not.toHaveBeenCalled()
  })

  it('R37: un rechazo previo se devuelve como error del catalogo y no como resultado', async () => {
    const s = setup({ connection: { status: 'DISABLED' } })
    await expect(s.send(textTo(), sender())).rejects.toMatchObject({ code: 'whatsapp_connection_not_active' })
  })

  it('R38: si falla la escritura del mensaje, el error se propaga y no se llama a Meta', async () => {
    const s = setup()
    const failure = new Error('la base no responde')
    s.outbox.insertSending.mockImplementationOnce(async () => {
      throw failure
    })
    await expect(s.send(textTo(), sender())).rejects.toBe(failure)
    expect(s.graph.sendMessage).not.toHaveBeenCalled()
    expect(s.outbox.touchContact).not.toHaveBeenCalled()
  })

  it('R4, R26: el permiso es lo primero y la escritura va despues de todas las validaciones', async () => {
    const s = setup()
    const calls: string[] = []
    for (const [name, spy] of [
      ['findLive', s.repository.findLive],
      ['findContact', s.outbox.findContact],
      ['findLiveById', s.templates.findLiveById],
      ['decrypt', s.cipher.decrypt],
      ['insertSending', s.outbox.insertSending],
      ['sendMessage', s.graph.sendMessage],
      ['markSent', s.outbox.markSent],
      ['touchContact', s.outbox.touchContact],
    ] as const) {
      const original = spy.getMockImplementation()
      ;(spy as ReturnType<typeof vi.fn>).mockImplementation((...args: unknown[]) => {
        calls.push(name)
        return (original as (...a: unknown[]) => unknown)(...args)
      })
    }
    await s.send(templateTo(), sender())
    expect(calls).toEqual([
      'findLive',
      'findContact',
      'findLiveById',
      'decrypt',
      'insertSending',
      'sendMessage',
      'markSent',
      'touchContact',
    ])
  })
})
