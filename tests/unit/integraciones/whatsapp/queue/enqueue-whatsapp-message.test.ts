import { describe, expect, it } from 'vitest'

import {
  createWhatsappNotifier,
  type EnqueueWhatsappMessageDeps,
} from '@/lib/modules/integraciones/domain/enqueue-whatsapp-message'
import type { WhatsappConnectionRecord } from '@/lib/modules/integraciones/domain/whatsapp-connection'
import type { WhatsappTemplateRecord } from '@/lib/modules/integraciones/domain/whatsapp-template'

import {
  COMPANY_ID,
  CONNECTION_ID,
  CONTACT_ID,
  CUSTOMER_ID,
  NOW,
  OTHER_COMPANY_ID,
  OTHER_CONTACT_ID,
  OTHER_CUSTOMER_ID,
  QUEUED_MESSAGE_ID,
  makeCipher,
  makeCustomerPhoneLinks,
  makeIntegrationsSwitch,
  makeOutbox,
  makeQueueLog,
  makeRepository,
  makeSendQueue,
  makeSendQueueRepository,
  makeTemplateRepository,
  makeVariableKeyRepository,
  outboxContact,
  storedConnection,
  storedTemplate,
  storedVariableKey,
  type OutboxContactRow,
} from '../whatsapp-doubles'

const ACCOUNT_KEY = storedVariableKey()
const MAIN_PHONE = { e164: '525512345678' }
const QUEUED_ID = QUEUED_MESSAGE_ID
const QUEUE_MESSAGE_ID = 'msg_cola_1'
const CUSTOMER_NAME = 'Ana Torres'
const TEMPLATE = { name: 'aviso_cuenta', language: 'es_MX' }
const VALUES = { 'cliente.nombre': CUSTOMER_NAME }

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
  addonOn?: boolean
  connection?: Partial<WhatsappConnectionRecord> | null
  contacts?: readonly OutboxContactRow[]
  templates?: WhatsappTemplateRecord[]
  mainPhone?: Awaited<ReturnType<EnqueueWhatsappMessageDeps['customerPhones']['mainPhoneOf']>>
}

function setup(options: SetupOptions = {}) {
  const cipherDouble = makeCipher()
  const connection =
    options.connection === null ? [] : [storedConnection(cipherDouble.seed, { status: 'ACTIVE', ...options.connection })]
  const repository = makeRepository(connection)
  const switchDouble = makeIntegrationsSwitch(options.addonOn ?? true)
  const outboxDouble = makeOutbox({ contacts: options.contacts ?? [outboxContact({ waId: '525512345678', lastInboundAt: null })] })
  const templateDouble = makeTemplateRepository(options.templates ?? [mappedTemplate()])
  const keyDouble = makeVariableKeyRepository([ACCOUNT_KEY])
  const phones = makeCustomerPhoneLinks({ mainPhone: options.mainPhone ?? MAIN_PHONE })
  const { insertQueued, recordPublished } = makeSendQueueRepository()
  const { publish } = makeSendQueue()
  publish.mockImplementation(async () => QUEUE_MESSAGE_ID)
  const { log } = makeQueueLog()
  const deps: EnqueueWhatsappMessageDeps = {
    integrations: switchDouble.integrations,
    connections: repository.connections,
    templates: templateDouble.templates,
    variableKeys: keyDouble.variableKeys,
    outbox: outboxDouble.outbox,
    customerPhones: phones.customerPhones,
    queueStore: { insertQueued, recordPublished },
    queue: { publish },
    log,
    now: () => NOW,
  }
  const writes = [
    outboxDouble.ensureContact,
    outboxDouble.linkContact,
    outboxDouble.touchContact,
    insertQueued,
    recordPublished,
    publish,
  ]
  return {
    notifier: createWhatsappNotifier(deps),
    repository,
    outbox: outboxDouble,
    templates: templateDouble,
    phones,
    insertQueued,
    recordPublished,
    publish,
    log,
    expectNoWrites: () => {
      for (const spy of writes) expect(spy).not.toHaveBeenCalled()
    },
  }
}

function enqueue(s: ReturnType<typeof setup>, values: Record<string, string> = VALUES, template = TEMPLATE) {
  return s.notifier.enqueue(COMPANY_ID, CUSTOMER_ID, template, values)
}

function loggedText(s: ReturnType<typeof setup>): string {
  return JSON.stringify([...s.log.info.mock.calls, ...s.log.warn.mock.calls, ...s.log.error.mock.calls])
}

describe('enqueue: el aviso del sistema por WhatsApp', () => {
  it('R1: el puerto WhatsappNotifier encola sin depender de Graph y devuelve queued con el id del mensaje', async () => {
    const s = setup()
    const outcome = await enqueue(s)

    expect(outcome).toEqual({ status: 'queued', messageId: QUEUED_ID, published: true })
    expect(s.log.warn).not.toHaveBeenCalled()
    expect(s.log.error).not.toHaveBeenCalled()
  })

  it('R2: con el anadido apagado no escribe ni publica y deja una linea con el motivo', async () => {
    const s = setup({ addonOn: false })

    expect(await enqueue(s)).toEqual({ status: 'skipped', reason: 'addon_off' })
    s.expectNoWrites()
    expect(s.repository.findLive).not.toHaveBeenCalled()
    expect(s.log.warn).toHaveBeenCalledWith('whatsapp_enqueue_skipped', {
      companyId: COMPANY_ID,
      customerId: CUSTOMER_ID,
      reason: 'addon_off',
    })
  })

  it.each([
    ['sin conexion viva', null],
    ['con la conexion PENDING', { status: 'PENDING' as const }],
    ['con la conexion en ERROR', { status: 'ERROR' as const }],
    ['con la conexion DISABLED', { status: 'DISABLED' as const }],
  ])('R3: %s no escribe ni publica y deja una linea con el motivo', async (_caso, connection) => {
    const s = setup({ connection })

    expect(await enqueue(s)).toEqual({ status: 'skipped', reason: 'no_active_connection' })
    s.expectNoWrites()
    expect(s.log.warn).toHaveBeenCalledWith(
      'whatsapp_enqueue_skipped',
      expect.objectContaining({ reason: 'no_active_connection' }),
    )
  })

  it('R3: la conexion de otra empresa no cuenta', async () => {
    const s = setup({ connection: { companyId: OTHER_COMPANY_ID } })

    expect(await enqueue(s)).toEqual({ status: 'skipped', reason: 'no_active_connection' })
    s.expectNoWrites()
  })

  it.each([
    ['el cliente no existe vivo', 'customer_not_found' as const, 'customer_not_found' as const],
    ['el cliente no tiene telefono principal valido', 'no_phone' as const, 'no_phone' as const],
  ])('R4: si %s no escribe ni publica y deja una linea con el motivo', async (_caso, mainPhone, reason) => {
    const s = setup({ mainPhone })

    expect(await enqueue(s)).toEqual({ status: 'skipped', reason })
    s.expectNoWrites()
    expect(s.phones.mainPhoneOf).toHaveBeenCalledWith(CUSTOMER_ID, COMPANY_ID)
    expect(s.log.warn).toHaveBeenCalledWith('whatsapp_enqueue_skipped', expect.objectContaining({ reason }))
  })

  it('R5: si el numero solo corresponde a contactos vinculados a otro cliente no escribe ni publica', async () => {
    const s = setup({ contacts: [outboxContact({ waId: '525512345678', customerId: OTHER_CUSTOMER_ID })] })

    expect(await enqueue(s)).toEqual({ status: 'skipped', reason: 'contact_linked_elsewhere' })
    s.expectNoWrites()
    expect(s.log.warn).toHaveBeenCalledWith(
      'whatsapp_enqueue_skipped',
      expect.objectContaining({ reason: 'contact_linked_elsewhere' }),
    )
  })

  it('R5: si el contacto elegido esta bloqueado no escribe ni publica', async () => {
    const s = setup({
      contacts: [outboxContact({ waId: '525512345678', customerId: CUSTOMER_ID, blockedAt: new Date('2026-10-01') })],
    })

    expect(await enqueue(s)).toEqual({ status: 'skipped', reason: 'contact_blocked' })
    s.expectNoWrites()
    expect(s.log.warn).toHaveBeenCalledWith('whatsapp_enqueue_skipped', expect.objectContaining({ reason: 'contact_blocked' }))
  })

  it.each([
    ['otro idioma', { name: 'aviso_cuenta', language: 'en_US' }],
    ['otro nombre', { name: 'otra', language: 'es_MX' }],
  ])('R6: una plantilla que no existe viva con ese nombre e idioma (%s) se omite sin escribir, tampoco el contacto', async (_caso, ref) => {
    const s = setup({ contacts: [] })

    expect(await enqueue(s, VALUES, ref)).toEqual({ status: 'skipped', reason: 'template_not_found' })
    s.expectNoWrites()
    expect(s.templates.findLiveByNameAndLanguage).toHaveBeenCalledWith(CONNECTION_ID, ref.name, ref.language, {
      companyId: COMPANY_ID,
    })
  })

  it('R6: una plantilla borrada se trata como inexistente', async () => {
    const s = setup({ templates: [mappedTemplate({ deletedAt: new Date('2026-10-02') })] })

    expect(await enqueue(s)).toEqual({ status: 'skipped', reason: 'template_not_found' })
    s.expectNoWrites()
  })

  it.each([
    ['deshabilitada', { enabled: false }],
    ['no aprobada', { status: 'PENDING' as const }],
  ])('R6: una plantilla %s no es enviable y se omite sin escribir', async (_caso, overrides) => {
    const s = setup({ contacts: [], templates: [mappedTemplate(overrides)] })

    expect(await enqueue(s)).toEqual({ status: 'skipped', reason: 'template_not_sendable' })
    s.expectNoWrites()
  })

  it('R6: una plantilla con un hueco sin relacionar no es enviable y se omite sin escribir', async () => {
    const s = setup({ templates: [mappedTemplate({ variables: [{ slot: 'body.1', kind: 'system', systemKey: 'cliente.nombre' }] })] })

    expect(await enqueue(s)).toEqual({ status: 'skipped', reason: 'template_not_sendable' })
    s.expectNoWrites()
  })

  it.each([
    ['falta la clave', {}],
    ['llega vacia', { 'cliente.nombre': '   ' }],
  ])('R6: si el valor de un hueco %s se omite sin escribir y el log lleva solo las claves que faltan', async (_caso, values) => {
    const s = setup({ contacts: [] })

    expect(await enqueue(s, values)).toEqual({ status: 'skipped', reason: 'template_values_missing' })
    s.expectNoWrites()
    expect(s.log.warn).toHaveBeenCalledWith('whatsapp_enqueue_skipped', {
      companyId: COMPANY_ID,
      customerId: CUSTOMER_ID,
      reason: 'template_values_missing',
      missing: 'cliente.nombre',
    })
  })

  it('R7: si la base falla al leer la conexion no rechaza: devuelve skipped/error y registra el nombre del error', async () => {
    const s = setup()
    s.repository.findLive.mockRejectedValueOnce(new TypeError('conexion caida con datos sensibles'))

    await expect(enqueue(s)).resolves.toEqual({ status: 'skipped', reason: 'error' })
    s.expectNoWrites()
    expect(s.log.error).toHaveBeenCalledWith('whatsapp_enqueue_failed', {
      companyId: COMPANY_ID,
      customerId: CUSTOMER_ID,
      error: 'TypeError',
    })
    expect(loggedText(s)).not.toContain('datos sensibles')
  })

  it('R7: si el alta del mensaje falla no rechaza y no publica', async () => {
    const s = setup()
    s.insertQueued.mockRejectedValueOnce(new Error('unique violation'))

    await expect(enqueue(s)).resolves.toEqual({ status: 'skipped', reason: 'error' })
    expect(s.publish).not.toHaveBeenCalled()
    expect(s.log.error).toHaveBeenCalledWith('whatsapp_enqueue_failed', expect.objectContaining({ error: 'Error' }))
  })

  it('R7: si el interruptor del anadido lanza algo que no es un Error tampoco rechaza', async () => {
    const s = setup()
    const switchDouble = makeIntegrationsSwitch()
    switchDouble.isOn.mockRejectedValueOnce('texto')
    const notifier = createWhatsappNotifier({
      integrations: switchDouble.integrations,
      connections: s.repository.connections,
      templates: s.templates.templates,
      variableKeys: makeVariableKeyRepository([ACCOUNT_KEY]).variableKeys,
      outbox: s.outbox.outbox,
      customerPhones: s.phones.customerPhones,
      queueStore: { insertQueued: s.insertQueued, recordPublished: s.recordPublished },
      queue: { publish: s.publish },
      log: s.log,
    })

    await expect(notifier.enqueue(COMPANY_ID, CUSTOMER_ID, TEMPLATE, VALUES)).resolves.toEqual({
      status: 'skipped',
      reason: 'error',
    })
    expect(s.log.error).toHaveBeenCalledWith('whatsapp_enqueue_failed', expect.objectContaining({ error: 'string' }))
  })

  it('R8: crea el mensaje en QUEUED de la empresa y la conexion viva con el texto final, nombre, idioma, valores y parametros de Meta', async () => {
    const s = setup()
    await enqueue(s)

    expect(s.insertQueued).toHaveBeenCalledTimes(1)
    expect(s.insertQueued).toHaveBeenCalledWith(
      {
        connectionId: CONNECTION_ID,
        contactId: CONTACT_ID,
        body: `Hola ${CUSTOMER_NAME}, su cuenta 123-456 esta lista.\n\nCobranza`,
        templateName: 'aviso_cuenta',
        templateLanguage: 'es_MX',
        payload: { 'cliente.nombre': CUSTOMER_NAME, cuenta_numero: '123-456' },
        templateComponents: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: CUSTOMER_NAME },
              { type: 'text', text: '123-456' },
            ],
          },
        ],
      },
      { companyId: COMPANY_ID },
    )
  })

  it('R9: sin contacto para el numero lo crea con waId = telefono principal y lo vincula como sistema (linkedBy null)', async () => {
    const s = setup({ contacts: [] })
    const outcome = await enqueue(s)

    expect(s.outbox.ensureContact).toHaveBeenCalledWith(CONNECTION_ID, '525512345678', { companyId: COMPANY_ID })
    const [created] = s.outbox.allContacts()
    expect(created).toMatchObject({ waId: '525512345678', customerId: CUSTOMER_ID, customerLinkedBy: null })
    expect(s.outbox.linkContact).toHaveBeenCalledWith(
      created?.id,
      { customerId: CUSTOMER_ID, linkedBy: null },
      { companyId: COMPANY_ID },
    )
    expect(s.insertQueued).toHaveBeenCalledWith(expect.objectContaining({ contactId: created?.id }), {
      companyId: COMPANY_ID,
    })
    expect(outcome).toMatchObject({ status: 'queued' })
  })

  it('R9: un contacto sin cliente con ese numero se vincula al cliente como sistema, sin crear otro', async () => {
    const s = setup({ contacts: [outboxContact({ waId: '5215512345678', customerId: null })] })
    await enqueue(s)

    expect(s.outbox.ensureContact).not.toHaveBeenCalled()
    expect(s.outbox.linkContact).toHaveBeenCalledWith(
      CONTACT_ID,
      { customerId: CUSTOMER_ID, linkedBy: null },
      { companyId: COMPANY_ID },
    )
  })

  it('R9: el contacto ya vinculado a ese cliente se usa sin reescribir el vinculo', async () => {
    const free = outboxContact({ id: OTHER_CONTACT_ID, waId: '525512345678', customerId: null })
    const own = outboxContact({ waId: '5215512345678', customerId: CUSTOMER_ID })
    const s = setup({ contacts: [free, own] })
    await enqueue(s)

    expect(s.outbox.linkContact).not.toHaveBeenCalled()
    expect(s.insertQueued).toHaveBeenCalledWith(expect.objectContaining({ contactId: CONTACT_ID }), {
      companyId: COMPANY_ID,
    })
  })

  it('R10: publica el trabajo con el id del mensaje y su empresa y guarda el id que devuelve la cola', async () => {
    const s = setup()
    await enqueue(s)

    expect(s.publish).toHaveBeenCalledWith({ kind: 'send_message', messageId: QUEUED_ID, companyId: COMPANY_ID })
    expect(s.recordPublished).toHaveBeenCalledWith(QUEUED_ID, QUEUE_MESSAGE_ID, { companyId: COMPANY_ID })
    expect(s.insertQueued.mock.invocationCallOrder[0]).toBeLessThan(s.publish.mock.invocationCallOrder[0] ?? 0)
  })

  it('R11: si publicar falla el mensaje queda en cola, se registra y enqueue no lanza', async () => {
    const s = setup()
    s.publish.mockRejectedValueOnce(new Error('QStash 503 con token qstash_secreto'))

    await expect(enqueue(s)).resolves.toEqual({ status: 'queued', messageId: QUEUED_ID, published: false })
    expect(s.recordPublished).not.toHaveBeenCalled()
    expect(s.log.error).toHaveBeenCalledWith('whatsapp_enqueue_publish_failed', { messageId: QUEUED_ID })
    expect(loggedText(s)).not.toContain('qstash_secreto')
  })

  it('R12: encola siempre como plantilla aunque la ventana de 24 h del contacto este cerrada', async () => {
    const s = setup({ contacts: [outboxContact({ waId: '525512345678', lastInboundAt: new Date(NOW.getTime() - 72 * 60 * 60 * 1000) })] })

    expect(await enqueue(s)).toMatchObject({ status: 'queued' })
    expect(s.insertQueued).toHaveBeenCalledWith(
      expect.objectContaining({ templateName: 'aviso_cuenta', templateLanguage: 'es_MX' }),
      { companyId: COMPANY_ID },
    )
  })

  it('R13: mueve la fecha del ultimo mensaje del contacto con la hora del encolado', async () => {
    const s = setup()
    await enqueue(s)

    expect(s.outbox.touchContact).toHaveBeenCalledWith(CONTACT_ID, NOW, { companyId: COMPANY_ID })
    expect(s.outbox.contact(CONTACT_ID)?.lastMessageAt).toEqual(NOW)
  })

  it('R2-R7: ninguna linea de log lleva valores de la plantilla, el numero ni el texto', async () => {
    const casos: SetupOptions[] = [
      {},
      { addonOn: false },
      { mainPhone: 'no_phone' },
      { contacts: [outboxContact({ waId: '525512345678', customerId: OTHER_CUSTOMER_ID })] },
    ]
    for (const caso of casos) {
      const s = setup(caso)
      s.publish.mockRejectedValueOnce(new Error('fallo'))
      await enqueue(s)
      await enqueue(s, {})
      const texto = loggedText(s)
      expect(texto).not.toContain(CUSTOMER_NAME)
      expect(texto).not.toContain('123-456')
      expect(texto).not.toContain('5512345678')
      expect(texto).not.toContain('esta lista')
    }
  })
})
