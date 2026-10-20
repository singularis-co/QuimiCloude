import { afterEach, describe, expect, it, vi } from 'vitest'

import { UNREADABLE_SECRET_MESSAGE } from '@/lib/modules/integraciones/domain/connection-secrets'
import { createReceiveWhatsappWebhook } from '@/lib/modules/integraciones/domain/receive-whatsapp-webhook'
import type { WhatsappConnectionRecord } from '@/lib/modules/integraciones/domain/whatsapp-connection'
import type { WhatsappTemplateRecord } from '@/lib/modules/integraciones/domain/whatsapp-template'
import { parseWhatsappWebhook } from '@/lib/modules/integraciones/domain/whatsapp-webhook-payload'
import type { WebhookSignature } from '@/lib/modules/integraciones/ports/webhook-signature'
import type { WhatsappInboxRepository } from '@/lib/modules/integraciones/ports/whatsapp-inbox-repository'

import {
  APP_SECRET,
  COMPANY_ID,
  CONNECTION_ID,
  NOW,
  TEMPLATE_ID,
  makeCipher,
  makeIntegrationsSwitch,
  makeRepository,
  makeTemplateRepository,
  makeWebhookDirectory,
  storedConnection,
  storedTemplate,
} from './whatsapp-doubles'
import {
  FOREIGN_PHONE_NUMBER_ID,
  PHONE_NUMBER_ID,
  WABA_ID,
  change,
  contact,
  messagesNotification,
  notification,
  status,
  textMessage,
  value,
} from './whatsapp-webhook-fixtures'

// La lectura real, envuelta en un espía para fijar cuándo se llama.
vi.mock('@/lib/modules/integraciones/domain/whatsapp-webhook-payload', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/modules/integraciones/domain/whatsapp-webhook-payload')>()
  return { ...original, parseWhatsappWebhook: vi.fn(original.parseWhatsappWebhook) }
})

const GOOD_SIGNATURE = 'sha256=firma-buena'
const parseSpy = vi.mocked(parseWhatsappWebhook)

function bytesOf(body: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(body))
}

/** Firma válida solo con la cabecera buena y el App Secret descifrado. */
function makeSignature() {
  const matches = vi.fn<WebhookSignature['matches']>(
    (_rawBody, header, appSecret) => header === GOOD_SIGNATURE && appSecret === APP_SECRET,
  )
  const signature: WebhookSignature = { matches }
  return { signature, matches }
}

function makeInbox() {
  const record = vi.fn<WhatsappInboxRepository['record']>(async () => ({ discardedBlocked: 0 }))
  const inbox: WhatsappInboxRepository = { record }
  return { inbox, record }
}

type SetupOptions = {
  record?: Partial<WhatsappConnectionRecord>
  directoryCompany?: string | null
  addonOn?: boolean
  templates?: WhatsappTemplateRecord[]
}

function setup(options: SetupOptions = {}) {
  const cipher = makeCipher()
  const record = storedConnection(cipher.seed, { status: 'ACTIVE', phoneNumberId: PHONE_NUMBER_ID, ...options.record })
  const repo = makeRepository([record])
  const directoryCompany = options.directoryCompany === undefined ? record.companyId : options.directoryCompany
  const directory = makeWebhookDirectory(directoryCompany === null ? {} : { [CONNECTION_ID]: directoryCompany })
  const integrations = makeIntegrationsSwitch(options.addonOn ?? true)
  const signature = makeSignature()
  const inbox = makeInbox()
  const templates = makeTemplateRepository(options.templates ?? [])
  const receive = createReceiveWhatsappWebhook({
    directory: directory.directory,
    integrations: integrations.integrations,
    connections: repo.connections,
    cipher: cipher.cipher,
    signature: signature.signature,
    inbox: inbox.inbox,
    templates: templates.templates,
    now: () => NOW,
  })
  return { record, repo, cipher, directory, integrations, signature, inbox, templates, receive }
}

afterEach(() => {
  vi.restoreAllMocks()
  parseSpy.mockClear()
})

describe('receiveWhatsappWebhook: POST firmado', () => {
  it('R10, R2: guarda el lote leído con el teléfono de la conexión, con el ámbito de la fila y el instante de la petición', async () => {
    const { receive, inbox } = setup()
    const body = messagesNotification([textMessage(), textMessage()])

    const result = await receive({ connectionId: CONNECTION_ID, rawBody: bytesOf(body), signature: GOOD_SIGNATURE })

    expect(result).toEqual({
      kind: 'stored',
      counts: { messages: 2, statuses: 0 },
      skipped: { changes: 0, messages: 0, statuses: 0, templates: 0 },
      followUp: null,
    })
    expect(parseSpy).toHaveBeenCalledWith(body, PHONE_NUMBER_ID, WABA_ID)
    expect(inbox.record).toHaveBeenCalledTimes(1)
    expect(inbox.record).toHaveBeenCalledWith(parseWhatsappWebhook(body, PHONE_NUMBER_ID, WABA_ID), CONNECTION_ID, NOW, {
      companyId: COMPANY_ID,
    })
  })

  it('R10: el orden es resolver → descifrar → firma → parsear → guardar', async () => {
    const { receive, directory, repo, cipher, signature, inbox } = setup()
    const jsonParse = vi.spyOn(JSON, 'parse')

    await receive({
      connectionId: CONNECTION_ID,
      rawBody: bytesOf(messagesNotification([textMessage()])),
      signature: GOOD_SIGNATURE,
    })

    const order = [
      directory.companyOfConnection.mock.invocationCallOrder[0],
      repo.findLiveById.mock.invocationCallOrder[0],
      cipher.decrypt.mock.invocationCallOrder[0],
      signature.matches.mock.invocationCallOrder[0],
      jsonParse.mock.invocationCallOrder[0],
      parseSpy.mock.invocationCallOrder[0],
      inbox.record.mock.invocationCallOrder[0],
    ]
    expect(order.every((n) => typeof n === 'number')).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => (a as number) - (b as number)))
  })

  it('R10: la firma se comprueba sobre los bytes exactos, con la cabecera recibida y el App Secret descifrado de esa conexión', async () => {
    const { receive, signature, cipher } = setup()
    const rawBody = bytesOf(messagesNotification([textMessage()]))

    await receive({ connectionId: CONNECTION_ID, rawBody, signature: GOOD_SIGNATURE })

    expect(cipher.decrypt).toHaveBeenCalledWith(expect.any(String), {
      companyId: COMPANY_ID,
      recordId: CONNECTION_ID,
      field: 'app_secret',
    })
    expect(signature.matches).toHaveBeenCalledWith(rawBody, GOOD_SIGNATURE, APP_SECRET)
    expect(signature.matches.mock.calls[0]?.[0]).toBe(rawBody)
  })

  it('R24: un POST firmado sin nada que guardar llama igualmente al inbox (que anota lastWebhookAt)', async () => {
    const { receive, inbox } = setup()
    const body = notification(change(value({ statuses: [status('wamid.desconocido', 'delivered')] }), 'otro_campo'))

    const result = await receive({ connectionId: CONNECTION_ID, rawBody: bytesOf(body), signature: GOOD_SIGNATURE })

    expect(result).toEqual({
      kind: 'stored',
      counts: { messages: 0, statuses: 0 },
      skipped: { changes: 0, messages: 0, statuses: 0, templates: 0 },
      followUp: null,
    })
    expect(inbox.record).toHaveBeenCalledTimes(1)
  })
})

describe('receiveWhatsappWebhook: contactos bloqueados', () => {
  it('R39, R41: los mensajes que el inbox descarta por bloqueo no cuentan como guardados, y la respuesta sigue siendo stored', async () => {
    const { receive, inbox } = setup()
    inbox.record.mockResolvedValueOnce({ discardedBlocked: 2 })
    const body = messagesNotification([textMessage(), textMessage(), textMessage()])

    const result = await receive({ connectionId: CONNECTION_ID, rawBody: bytesOf(body), signature: GOOD_SIGNATURE })

    expect(result).toEqual({
      kind: 'stored',
      counts: { messages: 1, statuses: 0 },
      skipped: { changes: 0, messages: 0, statuses: 0, templates: 0 },
      followUp: null,
    })
    expect(inbox.record).toHaveBeenCalledTimes(1)
  })

  it('R40: con todo el lote descartado por bloqueo los statuses se siguen contando', async () => {
    const { receive, inbox } = setup()
    inbox.record.mockResolvedValueOnce({ discardedBlocked: 1 })
    const body = notification(
      change(value({ messages: [textMessage()], statuses: [status('wamid.saliente', 'delivered')] })),
    )

    const result = await receive({ connectionId: CONNECTION_ID, rawBody: bytesOf(body), signature: GOOD_SIGNATURE })

    expect(result).toEqual({
      kind: 'stored',
      counts: { messages: 0, statuses: 1 },
      skipped: { changes: 0, messages: 0, statuses: 0, templates: 0 },
      followUp: null,
    })
  })
})

describe('receiveWhatsappWebhook: cambios saltados', () => {
  it('R15: el resultado stored trae solo los conteos de lo saltado (un cambio de otro número, un mensaje y un status ilegibles) y se guarda el resto', async () => {
    const { receive, inbox } = setup()
    const body = notification(
      change(value({ phoneNumberId: FOREIGN_PHONE_NUMBER_ID, messages: [textMessage()] })),
      change(
        value({
          messages: [textMessage(), { type: 'text' }],
          statuses: [status('wamid.x', 'delivered'), status('wamid.y', 'desconocido')],
        }),
      ),
    )

    const result = await receive({ connectionId: CONNECTION_ID, rawBody: bytesOf(body), signature: GOOD_SIGNATURE })

    expect(result).toEqual({
      kind: 'stored',
      counts: { messages: 1, statuses: 1 },
      skipped: { changes: 1, messages: 1, statuses: 1, templates: 0 },
      followUp: null,
    })
    expect(JSON.stringify(result)).not.toContain(FOREIGN_PHONE_NUMBER_ID)
    expect(inbox.record).toHaveBeenCalledTimes(1)
  })
})

describe('receiveWhatsappWebhook: conexión inexistente o apagada', () => {
  it.each([
    ['inexistente', { directoryCompany: null }, 'missing'],
    ['DISABLED', { record: { status: 'DISABLED' } }, 'disabled'],
    ['con el añadido apagado', { addonOn: false }, 'addon_off'],
  ] as const)('R9, R4: conexión %s ⇒ ignored sin descifrar, sin firma y sin guardar', async (_caso, options, reason) => {
    const { receive, cipher, signature, inbox, repo } = setup(options as SetupOptions)

    const result = await receive({
      connectionId: CONNECTION_ID,
      rawBody: bytesOf(messagesNotification([textMessage()])),
      signature: GOOD_SIGNATURE,
    })

    expect(result).toEqual({ kind: 'ignored', reason })
    expect(cipher.decrypt).not.toHaveBeenCalled()
    expect(signature.matches).not.toHaveBeenCalled()
    expect(parseSpy).not.toHaveBeenCalled()
    expect(inbox.record).not.toHaveBeenCalled()
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('R3, R9: un id sin forma de UUID ⇒ ignored(missing) sin llamar a ningún puerto', async () => {
    const { receive, directory, integrations, repo, cipher, signature, inbox } = setup()

    const result = await receive({ connectionId: 'no-es-uuid', rawBody: bytesOf({}), signature: GOOD_SIGNATURE })

    expect(result).toEqual({ kind: 'ignored', reason: 'missing' })
    for (const spy of [
      directory.companyOfConnection,
      integrations.isOn,
      repo.findLiveById,
      cipher.decrypt,
      signature.matches,
      inbox.record,
    ]) {
      expect(spy).not.toHaveBeenCalled()
    }
  })
})

describe('receiveWhatsappWebhook: firma', () => {
  it.each([
    ['falta la cabecera', null],
    ['cabecera que no coincide', 'sha256=otra-firma'],
  ])('R11: %s ⇒ unauthorized, sin parsear y sin escribir nada', async (_caso, header) => {
    const { receive, inbox, repo } = setup()
    const jsonParse = vi.spyOn(JSON, 'parse')

    const result = await receive({
      connectionId: CONNECTION_ID,
      rawBody: bytesOf(messagesNotification([textMessage()])),
      signature: header,
    })

    expect(result).toEqual({ kind: 'unauthorized' })
    expect(jsonParse).not.toHaveBeenCalled()
    expect(parseSpy).not.toHaveBeenCalled()
    expect(inbox.record).not.toHaveBeenCalled()
    expect(repo.update).not.toHaveBeenCalled()
    expect(repo.recordWebhookHandshake).not.toHaveBeenCalled()
  })

  it('R10: con firma mala, un cuerpo que no es JSON ni UTF-8 no lanza: se rechaza antes de leerlo', async () => {
    const { receive } = setup()

    await expect(
      receive({ connectionId: CONNECTION_ID, rawBody: new Uint8Array([0xff, 0xfe, 0x7b]), signature: 'sha256=mala' }),
    ).resolves.toEqual({ kind: 'unauthorized' })
    expect(parseSpy).not.toHaveBeenCalled()
  })
})

describe('receiveWhatsappWebhook: App Secret ilegible', () => {
  it('R12: SecretUnreadableError ⇒ secret_unreadable, la conexión queda en ERROR con el mensaje de credenciales, sin firma ni guardado', async () => {
    const { receive, repo, signature, inbox } = setup({ record: { appSecretEnc: 'v1:cifrado-con-otra-clave' } })

    const result = await receive({
      connectionId: CONNECTION_ID,
      rawBody: bytesOf(messagesNotification([textMessage()])),
      signature: GOOD_SIGNATURE,
    })

    expect(result).toEqual({ kind: 'secret_unreadable' })
    expect(repo.update).toHaveBeenCalledWith(
      CONNECTION_ID,
      { status: 'ERROR', lastError: UNREADABLE_SECRET_MESSAGE },
      { companyId: COMPANY_ID },
    )
    expect(repo.row(CONNECTION_ID)).toMatchObject({ status: 'ERROR', lastError: UNREADABLE_SECRET_MESSAGE })
    expect(signature.matches).not.toHaveBeenCalled()
    expect(inbox.record).not.toHaveBeenCalled()
  })

  it('R12: un fallo del cifrador que no es SecretUnreadableError se propaga y no cambia la conexión', async () => {
    const { receive, cipher, repo, inbox } = setup()
    const failure = new Error('fallo inesperado del cifrador')
    cipher.decrypt.mockRejectedValueOnce(failure)

    await expect(
      receive({ connectionId: CONNECTION_ID, rawBody: bytesOf({}), signature: GOOD_SIGNATURE }),
    ).rejects.toBe(failure)
    expect(repo.update).not.toHaveBeenCalled()
    expect(inbox.record).not.toHaveBeenCalled()
  })
})

describe('receiveWhatsappWebhook: cuerpo firmado ilegible', () => {
  it.each([
    ['bytes que no son UTF-8', new Uint8Array([0xff, 0xfe, 0x7b, 0x7d])],
    ['texto que no es JSON', new TextEncoder().encode('esto no es json')],
    ['JSON sin forma de notificación', bytesOf({ hola: 'mundo' })],
    ['JSON sin entry', bytesOf({ object: 'whatsapp_business_account' })],
  ])('R13: %s ⇒ ignored(unparseable), sin guardar', async (_caso, rawBody) => {
    const { receive, inbox, repo } = setup()

    expect(await receive({ connectionId: CONNECTION_ID, rawBody, signature: GOOD_SIGNATURE })).toEqual({
      kind: 'ignored',
      reason: 'unparseable',
    })
    expect(inbox.record).not.toHaveBeenCalled()
    expect(repo.update).not.toHaveBeenCalled()
  })
})

describe('receiveWhatsappWebhook: guardado', () => {
  it('R23: una excepción del inbox se propaga tal cual', async () => {
    const { receive, inbox } = setup()
    const failure = new Error('la transacción falló')
    inbox.record.mockRejectedValueOnce(failure)

    await expect(
      receive({
        connectionId: CONNECTION_ID,
        rawBody: bytesOf(messagesNotification([textMessage()])),
        signature: GOOD_SIGNATURE,
      }),
    ).rejects.toBe(failure)
  })

  it('R26: ni recibir ni guardar llaman a un servicio externo: los deps no tienen Graph y fetch no se usa', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { receive } = setup()

    const result = await receive({
      connectionId: CONNECTION_ID,
      rawBody: bytesOf(messagesNotification([textMessage()])),
      signature: GOOD_SIGNATURE,
    })

    expect(result.kind).toBe('stored')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('receiveWhatsappWebhook: cambios de plantillas', () => {
  const templateStatus = (id: number, event = 'APPROVED', reason: string | null = null) =>
    change({ event, message_template_id: id, message_template_name: 'x', message_template_language: 'es', reason }, 'message_template_status_update')

  function setupWithTemplates(rows = [storedTemplate({ metaTemplateId: '9001', status: 'PENDING' })]) {
    const ctx = setup({ templates: rows })
    return ctx
  }

  it('R36: un APPROVED de una plantilla conocida la pone al dia con el ambito de la fila y sin follow-up', async () => {
    const { receive, templates } = setupWithTemplates()
    const body = notification(templateStatus(9001))

    const result = await receive({ connectionId: CONNECTION_ID, rawBody: bytesOf(body), signature: GOOD_SIGNATURE })

    expect(result).toEqual({
      kind: 'stored',
      counts: { messages: 0, statuses: 0 },
      skipped: { changes: 0, messages: 0, statuses: 0, templates: 0 },
      followUp: null,
    })
    expect(templates.applyWebhookUpdates).toHaveBeenCalledWith(
      CONNECTION_ID,
      [{ kind: 'status', metaTemplateId: '9001', status: 'APPROVED', statusRaw: null, rejectedReason: null }],
      { companyId: COMPANY_ID },
    )
    expect(templates.row(TEMPLATE_ID)).toMatchObject({ status: 'APPROVED', rejectedReason: null })
  })

  it('R36: REJECTED guarda el motivo; R37: la categoria nueva se guarda', async () => {
    const { receive, templates } = setupWithTemplates()
    await receive({
      connectionId: CONNECTION_ID,
      rawBody: bytesOf(notification(templateStatus(9001, 'REJECTED', 'INVALID_FORMAT'))),
      signature: GOOD_SIGNATURE,
    })
    expect(templates.row(TEMPLATE_ID)).toMatchObject({ status: 'REJECTED', rejectedReason: 'INVALID_FORMAT' })

    await receive({
      connectionId: CONNECTION_ID,
      rawBody: bytesOf(
        notification(change({ message_template_id: 9001, previous_category: 'UTILITY', new_category: 'MARKETING' }, 'template_category_update')),
      ),
      signature: GOOD_SIGNATURE,
    })
    expect(templates.row(TEMPLATE_ID)).toMatchObject({ category: 'MARKETING' })
  })

  it('R38: un id que no esta en la copia local pide resincronizar, una sola vez aunque haya varios', async () => {
    const { receive } = setupWithTemplates()
    const body = notification(templateStatus(9001), templateStatus(7777), templateStatus(8888))

    const result = await receive({ connectionId: CONNECTION_ID, rawBody: bytesOf(body), signature: GOOD_SIGNATURE })

    expect(result).toMatchObject({ kind: 'stored', followUp: 'resync_templates' })
  })

  it('R38: recibir no sincroniza: ni Graph en los deps ni fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { receive, templates } = setupWithTemplates([])
    await receive({ connectionId: CONNECTION_ID, rawBody: bytesOf(notification(templateStatus(7777))), signature: GOOD_SIGNATURE })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(templates.applySync).not.toHaveBeenCalled()
  })

  it('R40: un POST con mensajes y cambios de plantillas guarda los dos', async () => {
    const { receive, inbox, templates } = setupWithTemplates()
    const body = notification(change(value({ contacts: [contact()], messages: [textMessage()] })), templateStatus(9001))

    const result = await receive({ connectionId: CONNECTION_ID, rawBody: bytesOf(body), signature: GOOD_SIGNATURE })

    expect(result).toMatchObject({ kind: 'stored', counts: { messages: 1, statuses: 0 }, followUp: null })
    expect(inbox.record).toHaveBeenCalledTimes(1)
    expect(templates.applyWebhookUpdates).toHaveBeenCalledTimes(1)
    expect(templates.row(TEMPLATE_ID)).toMatchObject({ status: 'APPROVED' })
  })

  it('R40: si falla guardar los cambios de plantillas la excepcion se propaga', async () => {
    const { receive, inbox, templates } = setupWithTemplates()
    const failure = new Error('la base fallo')
    templates.applyWebhookUpdates.mockRejectedValueOnce(failure)
    const body = notification(change(value({ contacts: [contact()], messages: [textMessage()] })), templateStatus(9001))

    await expect(receive({ connectionId: CONNECTION_ID, rawBody: bytesOf(body), signature: GOOD_SIGNATURE })).rejects.toBe(failure)
    expect(inbox.record).toHaveBeenCalledTimes(1)
  })

  it('R40: sin cambios de plantillas no se llama al repositorio de plantillas', async () => {
    const { receive, templates } = setupWithTemplates()
    await receive({ connectionId: CONNECTION_ID, rawBody: bytesOf(messagesNotification([textMessage()])), signature: GOOD_SIGNATURE })
    expect(templates.applyWebhookUpdates).not.toHaveBeenCalled()
  })

  it('R39 R41: lo saltado de otra WABA o ilegible se cuenta en skipped.templates y lo demas se aplica', async () => {
    const { receive, templates } = setupWithTemplates()
    const json = {
      object: 'whatsapp_business_account',
      entry: [
        { id: '9999999999', changes: [templateStatus(9001, 'DISABLED')] },
        { id: WABA_ID, changes: [templateStatus(0), templateStatus(9001)] },
      ],
    }

    const result = await receive({ connectionId: CONNECTION_ID, rawBody: bytesOf(json), signature: GOOD_SIGNATURE })

    expect(result).toEqual({
      kind: 'stored',
      counts: { messages: 0, statuses: 0 },
      skipped: { changes: 0, messages: 0, statuses: 0, templates: 2 },
      followUp: null,
    })
    expect(templates.row(TEMPLATE_ID)).toMatchObject({ status: 'APPROVED' })
  })

  it('R39: la WABA que se compara es la de la conexion guardada', async () => {
    const { receive, templates } = setup({ record: { wabaId: '5555' }, templates: [storedTemplate({ metaTemplateId: '9001' })] })
    const result = await receive({ connectionId: CONNECTION_ID, rawBody: bytesOf(notification(templateStatus(9001))), signature: GOOD_SIGNATURE })
    expect(parseSpy).toHaveBeenCalledWith(expect.anything(), PHONE_NUMBER_ID, '5555')
    expect(result).toMatchObject({ skipped: { templates: 1 } })
    expect(templates.applyWebhookUpdates).not.toHaveBeenCalled()
  })
})
