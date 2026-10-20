import { describe, expect, it } from 'vitest'

import {
  STATUS_ERROR_REASON_MAX_LENGTH,
  parseWhatsappWebhook,
  type InboundBatch,
} from '@/lib/modules/integraciones/domain/whatsapp-webhook-payload'

import {
  FOREIGN_PHONE_NUMBER_ID,
  OTHER_SENDER,
  PHONE_NUMBER_ID,
  SENDER,
  SENDER_USER_ID,
  TIMESTAMP,
  change,
  contact,
  imageMessage,
  message,
  messagesNotification,
  notification,
  status,
  textMessage,
  value,
  wamid,
} from './whatsapp-webhook-fixtures'

function parse(json: unknown): InboundBatch {
  const batch = parseWhatsappWebhook(json, PHONE_NUMBER_ID)
  if (batch === null) throw new Error('se esperaba un lote')
  return batch
}

function onlyMessage(raw: Record<string, unknown>) {
  const batch = parse(messagesNotification([raw]))
  expect(batch.messages).toHaveLength(1)
  return batch.messages[0]
}

const NO_SKIPS = { changes: 0, messages: 0, statuses: 0 }

describe('parseWhatsappWebhook: forma de la notificación', () => {
  it.each([
    ['null', null],
    ['un texto', 'hola'],
    ['un arreglo', []],
    ['sin object', { entry: [] }],
    ['sin entry', { object: 'whatsapp_business_account' }],
    ['entry que no es arreglo', { object: 'whatsapp_business_account', entry: {} }],
    ['entry sin changes', { object: 'whatsapp_business_account', entry: [{ id: '1' }] }],
    ['un change sin field', { object: 'whatsapp_business_account', entry: [{ changes: [{ value: {} }] }] }],
  ])('R13: %s ⇒ null', (_caso, json) => {
    expect(parseWhatsappWebhook(json, PHONE_NUMBER_ID)).toBeNull()
  })

  it('R13: una notificación sin cambios es un lote vacío', () => {
    expect(parse(notification())).toEqual({ contacts: [], messages: [], statuses: [], skipped: NO_SKIPS })
  })

  it('R14: un change de otro field se salta sin error y los demás se procesan', () => {
    const text = textMessage()
    const batch = parse(
      notification(
        change({ event: 'APPROVED', message_template_id: 1 }, 'message_template_status_update'),
        change(value({ contacts: [contact()], messages: [text] })),
      ),
    )

    expect(batch.messages.map((m) => m.wamid)).toEqual([text.id])
    expect(batch.skipped).toEqual(NO_SKIPS)
  })

  it('R15: un change de otro phone_number_id se salta con conteo y los demás se procesan', () => {
    const own = textMessage()
    const batch = parse(
      notification(
        change(value({ phoneNumberId: FOREIGN_PHONE_NUMBER_ID, contacts: [contact(OTHER_SENDER)], messages: [textMessage()] })),
        change(value({ contacts: [contact()], messages: [own] })),
      ),
    )

    expect(batch.messages.map((m) => m.wamid)).toEqual([own.id])
    expect(batch.contacts.map((c) => c.waId)).toEqual([SENDER])
    expect(batch.skipped).toEqual({ changes: 1, messages: 0, statuses: 0 })
  })

  it('R14: un value de messages sin metadata se salta con conteo y no tumba el resto', () => {
    const own = textMessage()
    const batch = parse(
      notification(change({ messages: [textMessage()] }), change(value({ contacts: [contact()], messages: [own] }))),
    )

    expect(batch.messages.map((m) => m.wamid)).toEqual([own.id])
    expect(batch.skipped.changes).toBe(1)
  })

  it('R14: recorre todos los entry y todos sus changes', () => {
    const first = textMessage()
    const second = textMessage()
    const json = {
      object: 'whatsapp_business_account',
      entry: [
        { id: 'a', changes: [change(value({ contacts: [contact()], messages: [first] }))] },
        { id: 'b', changes: [change(value({ contacts: [contact()], messages: [second] }))] },
      ],
    }

    expect(parse(json).messages.map((m) => m.wamid)).toEqual([first.id, second.id])
  })
})

describe('parseWhatsappWebhook: cada tipo de mensaje', () => {
  it('R17/R19: text ⇒ TEXT, body el texto, payload solo con from, wamid y metaTimestamp de Meta', () => {
    const raw = textMessage('texto de prueba')

    expect(onlyMessage(raw)).toEqual({
      wamid: raw.id,
      waId: SENDER,
      type: 'TEXT',
      body: 'texto de prueba',
      payload: { from: SENDER },
      metaTimestamp: new Date(Number(TIMESTAMP) * 1000),
    })
  })

  it.each([
    ['image', 'IMAGE'],
    ['video', 'VIDEO'],
    ['audio', 'AUDIO'],
    ['sticker', 'STICKER'],
  ] as const)('R19: %s sin caption ⇒ %s, body null, solo media_id y mime_type', (metaType, type) => {
    const raw = message(metaType, {
      [metaType]: { id: 'media-1', mime_type: 'application/octet-stream', sha256: 'abc', url: 'https://x.invalid/m' },
    })

    expect(onlyMessage(raw)).toMatchObject({
      type,
      body: null,
      payload: { from: SENDER, media_id: 'media-1', mime_type: 'application/octet-stream' },
    })
    expect(Object.keys(onlyMessage(message(metaType, { [metaType]: { id: 'm', mime_type: 'x' } })).payload).sort()).toEqual(
      ['from', 'media_id', 'mime_type'],
    )
  })

  it.each(['image', 'video', 'audio', 'sticker'])('R19: %s con caption ⇒ body el caption y caption en el payload', (metaType) => {
    const raw = message(metaType, { [metaType]: { id: 'media-2', mime_type: 'x/y', caption: 'pie de prueba' } })

    expect(onlyMessage(raw)).toMatchObject({
      body: 'pie de prueba',
      payload: { from: SENDER, media_id: 'media-2', mime_type: 'x/y', caption: 'pie de prueba' },
    })
  })

  it('R19: document ⇒ DOCUMENT con media_id, mime_type, caption y filename', () => {
    const raw = message('document', {
      document: { id: 'doc-1', mime_type: 'application/pdf', caption: 'factura', filename: 'f.pdf', sha256: 'z' },
    })

    expect(onlyMessage(raw)).toMatchObject({
      type: 'DOCUMENT',
      body: 'factura',
      payload: { from: SENDER, media_id: 'doc-1', mime_type: 'application/pdf', caption: 'factura', filename: 'f.pdf' },
    })
    expect(Object.keys(onlyMessage(raw).payload)).not.toContain('sha256')
  })

  it('R19: document sin caption ni filename ⇒ body null y payload sin esas claves', () => {
    const raw = message('document', { document: { id: 'doc-2', mime_type: 'application/pdf' } })

    expect(onlyMessage(raw)).toMatchObject({
      type: 'DOCUMENT',
      body: null,
      payload: { from: SENDER, media_id: 'doc-2', mime_type: 'application/pdf' },
    })
    expect(Object.keys(onlyMessage(raw).payload).sort()).toEqual(['from', 'media_id', 'mime_type'])
  })

  it('R19: location con name ⇒ body el name', () => {
    const raw = message('location', { location: { latitude: 4.6, longitude: -74.1, name: 'Sitio', address: 'Calle 1' } })

    expect(onlyMessage(raw)).toMatchObject({
      type: 'LOCATION',
      body: 'Sitio',
      payload: { from: SENDER, latitude: 4.6, longitude: -74.1, name: 'Sitio', address: 'Calle 1' },
    })
  })

  it('R19: location solo con address ⇒ body el address; sin ninguno ⇒ null', () => {
    expect(onlyMessage(message('location', { location: { latitude: 1, longitude: 2, address: 'Calle 1' } })).body).toBe(
      'Calle 1',
    )
    const bare = onlyMessage(message('location', { location: { latitude: 1, longitude: 2 } }))
    expect(bare).toMatchObject({ type: 'LOCATION', body: null, payload: { from: SENDER, latitude: 1, longitude: 2 } })
  })

  it('R19: contacts ⇒ CONTACTS, body null y el arreglo tal como llegó', () => {
    const shared = [{ name: { formatted_name: 'Persona Ficticia', first_name: 'Persona' }, phones: [{ phone: '+1 555 000' }] }]

    expect(onlyMessage(message('contacts', { contacts: shared }))).toMatchObject({
      type: 'CONTACTS',
      body: null,
      payload: { from: SENDER, contacts: shared },
    })
  })

  it('R19: reaction con emoji ⇒ REACTION, body el emoji', () => {
    const raw = message('reaction', { reaction: { message_id: 'wamid.original', emoji: '\u{1F44D}' } })

    expect(onlyMessage(raw)).toMatchObject({
      type: 'REACTION',
      body: '\u{1F44D}',
      payload: { from: SENDER, message_id: 'wamid.original', emoji: '\u{1F44D}' },
    })
  })

  it.each([
    ['sin emoji', { message_id: 'wamid.original' }],
    ['con emoji vacío', { message_id: 'wamid.original', emoji: '' }],
  ])('R19/R20: reaction %s ⇒ REACTION (reacción quitada), body null y emoji null', (_caso, reaction) => {
    expect(onlyMessage(message('reaction', { reaction }))).toEqual(
      expect.objectContaining({
        type: 'REACTION',
        body: null,
        payload: { from: SENDER, message_id: 'wamid.original', emoji: null },
      }),
    )
  })

  it('R19: button ⇒ BUTTON, body el texto y payload con text y payload', () => {
    const raw = message('button', { button: { text: 'Sí', payload: 'CONFIRMAR' }, context: { id: 'wamid.x' } })

    expect(onlyMessage(raw)).toMatchObject({
      type: 'BUTTON',
      body: 'Sí',
      payload: { from: SENDER, text: 'Sí', payload: 'CONFIRMAR' },
    })
    expect(Object.keys(onlyMessage(message('button', { button: { text: 'No' } })).payload).sort()).toEqual(['from', 'text'])
  })

  it('R19: interactive button_reply ⇒ INTERACTIVE, body el title', () => {
    const raw = message('interactive', { interactive: { type: 'button_reply', button_reply: { id: 'b1', title: 'Opción' } } })

    expect(onlyMessage(raw)).toMatchObject({
      type: 'INTERACTIVE',
      body: 'Opción',
      payload: { from: SENDER, reply_type: 'button_reply', id: 'b1', title: 'Opción' },
    })
    expect(Object.keys(onlyMessage(raw).payload)).not.toContain('description')
  })

  it('R19: interactive list_reply ⇒ INTERACTIVE con description', () => {
    const raw = message('interactive', {
      interactive: { type: 'list_reply', list_reply: { id: 'l1', title: 'Fila', description: 'Detalle' } },
    })

    expect(onlyMessage(raw)).toMatchObject({
      type: 'INTERACTIVE',
      body: 'Fila',
      payload: { from: SENDER, reply_type: 'list_reply', id: 'l1', title: 'Fila', description: 'Detalle' },
    })
  })

  it.each([
    ['tipo desconocido', message('order', { order: { catalog_id: 'c1', product_items: [] } })],
    ['tipo unsupported de Meta', message('unsupported', { unsupported: { type: 'edit' }, errors: [{ code: 131051 }] })],
    ['interactive de otro subtipo', message('interactive', { interactive: { type: 'nfm_reply', nfm_reply: { body: 'x' } } })],
    ['image sin id', message('image', { image: { mime_type: 'image/jpeg' } })],
    ['image sin su objeto', message('image')],
    ['text sin body', message('text', { text: {} })],
    ['location sin latitud', message('location', { location: { longitude: 2 } })],
    ['reaction sin message_id', message('reaction', { reaction: { emoji: 'x' } })],
    ['contacts que no es arreglo', message('contacts', { contacts: {} })],
  ])('R20: %s ⇒ UNSUPPORTED, body null y el mensaje entero tal como llegó', (_caso, raw) => {
    expect(onlyMessage(raw)).toMatchObject({ wamid: raw.id, waId: SENDER, type: 'UNSUPPORTED', body: null, payload: raw })
    expect(onlyMessage(raw).payload).toEqual(raw)
  })

  it.each([
    ['sin id', { id: undefined }],
    ['con id vacío', { id: '' }],
    ['sin from', { from: undefined }],
    ['con timestamp que no son dígitos', { timestamp: '2026-10-19' }],
    ['con timestamp numérico', { timestamp: 1760875200 }],
    ['sin type', { type: undefined }],
  ])('R20: un mensaje %s (cabecera rota) se salta con conteo y no tumba el resto', (_caso, overrides) => {
    const good = textMessage()
    const broken = JSON.parse(JSON.stringify(textMessage('roto', overrides))) as Record<string, unknown>

    const batch = parse(messagesNotification([broken, good]))

    expect(batch.messages.map((m) => m.wamid)).toEqual([good.id])
    expect(batch.skipped).toEqual({ changes: 0, messages: 1, statuses: 0 })
  })

  it('R18: un mismo wamid dos veces en el lote ⇒ se queda el primero', () => {
    const first = textMessage('primero')
    const repeated = { ...textMessage('segundo'), id: first.id }

    const batch = parse(messagesNotification([first, repeated]))

    expect(batch.messages).toHaveLength(1)
    expect(batch.messages[0].body).toBe('primero')
  })

  it('R19: ningún medio trae una URL ni el sha256 al payload (no se descarga nada)', () => {
    const payload = onlyMessage(imageMessage()).payload

    expect(payload).toEqual({ from: SENDER, media_id: 'media-1', mime_type: 'image/jpeg' })
  })
})

describe('parseWhatsappWebhook: remitente y contactos', () => {
  it('R16: un solo contacto con wa_id distinto de from ⇒ manda el wa_id del contacto y from queda en el payload', () => {
    const raw = textMessage('hola', { from: SENDER })
    const batch = parse(messagesNotification([raw], [contact(SENDER_USER_ID, 'Nombre Perfil')]))

    expect(batch.messages[0]).toMatchObject({ waId: SENDER_USER_ID, payload: { from: SENDER } })
    expect(batch.contacts).toEqual([
      { waId: SENDER_USER_ID, profileName: 'Nombre Perfil', latestAt: new Date(Number(TIMESTAMP) * 1000) },
    ])
  })

  it('R16: un solo contacto sin profile ⇒ profileName null', () => {
    const batch = parse(messagesNotification([textMessage()], [contact(SENDER, null)]))

    expect(batch.contacts).toEqual([{ waId: SENDER, profileName: null, latestAt: expect.any(Date) }])
  })

  it('R16: sin contacts ⇒ manda from y profileName null', () => {
    const batch = parse(notification(change(value({ messages: [textMessage()] }))))

    expect(batch.messages[0].waId).toBe(SENDER)
    expect(batch.contacts).toEqual([{ waId: SENDER, profileName: null, latestAt: expect.any(Date) }])
  })

  it('R16: contacts vacío ⇒ manda from', () => {
    const batch = parse(messagesNotification([textMessage()], []))

    expect(batch.messages[0].waId).toBe(SENDER)
    expect(batch.contacts[0]).toMatchObject({ waId: SENDER, profileName: null })
  })

  it('R16: varios contactos ⇒ manda from de cada mensaje y el nombre del contacto cuyo wa_id es from', () => {
    const fromSender = textMessage('a', { from: SENDER })
    const fromOther = textMessage('b', { from: OTHER_SENDER })
    const batch = parse(
      messagesNotification([fromSender, fromOther], [contact(OTHER_SENDER, 'Otro'), contact(SENDER, 'Primero')]),
    )

    expect(batch.messages.map((m) => m.waId)).toEqual([SENDER, OTHER_SENDER])
    expect(batch.contacts.map((c) => [c.waId, c.profileName])).toEqual([
      [SENDER, 'Primero'],
      [OTHER_SENDER, 'Otro'],
    ])
  })

  it('R16: varios contactos y ninguno con wa_id igual a from ⇒ manda from y profileName null', () => {
    const batch = parse(
      messagesNotification([textMessage()], [contact(SENDER_USER_ID, 'Uno'), contact(OTHER_SENDER, 'Dos')]),
    )

    expect(batch.messages[0].waId).toBe(SENDER)
    expect(batch.contacts).toEqual([{ waId: SENDER, profileName: null, latestAt: expect.any(Date) }])
  })

  it('R16: from queda en el payload de todos los tipos interpretados', () => {
    const raws = [
      textMessage(),
      imageMessage(),
      message('document', { document: { id: 'd', mime_type: 'x' } }),
      message('location', { location: { latitude: 1, longitude: 2 } }),
      message('contacts', { contacts: [] }),
      message('reaction', { reaction: { message_id: 'wamid.o' } }),
      message('button', { button: { text: 't' } }),
      message('interactive', { interactive: { type: 'button_reply', button_reply: { id: 'i', title: 't' } } }),
      message('desconocido'),
    ]

    const batch = parse(messagesNotification(raws, [contact(SENDER_USER_ID)]))

    expect(batch.messages).toHaveLength(raws.length)
    for (const inbound of batch.messages) expect(inbound.payload.from).toBe(SENDER)
  })

  it('R16: varios mensajes del mismo remitente ⇒ un contacto con el mayor metaTimestamp del lote', () => {
    const batch = parse(
      messagesNotification([
        textMessage('a', { timestamp: '1760875300' }),
        textMessage('b', { timestamp: '1760875900' }),
        textMessage('c', { timestamp: '1760875200' }),
      ]),
    )

    expect(batch.contacts).toEqual([
      { waId: SENDER, profileName: 'Cliente de Prueba', latestAt: new Date(1760875900 * 1000) },
    ])
  })

  it('R16: el nombre del contacto lo pone el mensaje más reciente que lo trae', () => {
    const json = notification(
      change(value({ contacts: [contact(SENDER, 'Nuevo')], messages: [textMessage('n', { timestamp: '1760875900' })] })),
      change(value({ contacts: [contact(SENDER, 'Viejo')], messages: [textMessage('v', { timestamp: '1760875200' })] })),
      change(value({ contacts: [contact(SENDER, null)], messages: [textMessage('s', { timestamp: '1760876000' })] })),
    )

    expect(parse(json).contacts).toEqual([{ waId: SENDER, profileName: 'Nuevo', latestAt: new Date(1760876000 * 1000) }])
  })

  it('R16: un status no crea contacto (recipient_id no es un remitente)', () => {
    const batch = parse(notification(change(value({ statuses: [status(wamid(), 'delivered')] }))))

    expect(batch.contacts).toEqual([])
    expect(batch.messages).toEqual([])
  })
})

describe('parseWhatsappWebhook: statuses', () => {
  it.each([
    ['sent', 'SENT'],
    ['delivered', 'DELIVERED'],
    ['read', 'READ'],
  ])('R21: %s ⇒ %s sin error', (metaStatus, expected) => {
    const id = wamid()

    expect(parse(notification(change(value({ statuses: [status(id, metaStatus)] })))).statuses).toEqual([
      { wamid: id, status: expected, errorCode: null, errorReason: null },
    ])
  })

  it('R21: failed ⇒ FAILED con el código y el detalle del primer error', () => {
    const id = wamid()
    const errors = [
      { code: 131047, title: 'Re-engagement message', message: 'Mensaje', error_data: { details: 'Detalle del error' } },
      { code: 1, title: 'segundo' },
    ]

    expect(parse(notification(change(value({ statuses: [status(id, 'failed', { errors })] })))).statuses).toEqual([
      { wamid: id, status: 'FAILED', errorCode: '131047', errorReason: 'Detalle del error' },
    ])
  })

  it('R21: failed sin details usa message y, sin message, title', () => {
    const withMessage = parse(
      notification(change(value({ statuses: [status(wamid(), 'failed', { errors: [{ code: 2, message: 'M', title: 'T' }] })] }))),
    )
    const withTitle = parse(
      notification(change(value({ statuses: [status(wamid(), 'failed', { errors: [{ code: 3, title: 'T' }] })] }))),
    )

    expect(withMessage.statuses[0]).toMatchObject({ errorCode: '2', errorReason: 'M' })
    expect(withTitle.statuses[0]).toMatchObject({ errorCode: '3', errorReason: 'T' })
  })

  it('R21: el motivo del error se recorta a 500 caracteres', () => {
    const long = 'x'.repeat(STATUS_ERROR_REASON_MAX_LENGTH + 50)
    const batch = parse(
      notification(change(value({ statuses: [status(wamid(), 'failed', { errors: [{ code: 4, message: long }] })] }))),
    )

    expect(STATUS_ERROR_REASON_MAX_LENGTH).toBe(500)
    expect(batch.statuses[0].errorReason).toHaveLength(500)
  })

  it('R21: failed sin errors ⇒ código y motivo null; los de un status que no es failed no se leen', () => {
    const failed = parse(notification(change(value({ statuses: [status(wamid(), 'failed')] }))))
    const sent = parse(notification(change(value({ statuses: [status(wamid(), 'sent', { errors: [{ code: 9, title: 'x' }] })] }))))

    expect(failed.statuses[0]).toMatchObject({ status: 'FAILED', errorCode: null, errorReason: null })
    expect(sent.statuses[0]).toMatchObject({ status: 'SENT', errorCode: null, errorReason: null })
  })

  it.each(['played', 'deleted', 'warning', 'SENT', 'Read', ''])('R22: status desconocido %j ⇒ se salta con conteo', (metaStatus) => {
    const known = wamid()
    const batch = parse(
      notification(change(value({ statuses: [status(wamid(), metaStatus), status(known, 'read')] }))),
    )

    expect(batch.statuses.map((s) => s.wamid)).toEqual([known])
    expect(batch.skipped).toEqual({ changes: 0, messages: 0, statuses: 1 })
  })

  it('R22: un status sin id se salta con conteo', () => {
    const batch = parse(notification(change(value({ statuses: [{ status: 'read' }] }))))

    expect(batch.statuses).toEqual([])
    expect(batch.skipped.statuses).toBe(1)
  })

  it('R14: un value con mensajes y statuses devuelve los dos', () => {
    const text = textMessage()
    const id = wamid()
    const batch = parse(notification(change(value({ contacts: [contact()], messages: [text], statuses: [status(id, 'read')] }))))

    expect(batch.messages.map((m) => m.wamid)).toEqual([text.id])
    expect(batch.statuses.map((s) => s.wamid)).toEqual([id])
  })
})
