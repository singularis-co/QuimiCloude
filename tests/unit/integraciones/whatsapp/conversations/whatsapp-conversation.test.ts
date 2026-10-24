import { describe, expect, it } from 'vitest'

import {
  attachmentOf,
  customerNameOf,
  failureReasonOf,
  previewOf,
  windowOf,
  type AttachmentSource,
  type FailureSource,
} from '@/lib/modules/integraciones/domain/whatsapp-conversation'
import type { WhatsappMessageStatus, WhatsappMessageType } from '@/lib/modules/integraciones/domain/whatsapp-message'
import { whatsappMediaPath } from '@/lib/shared/routes'

const MEDIA_ID = 'meta-media-id-123'
const WAMID = 'wamid.HBgMNTIxNTUxMjM0NTY3OBUCABIYFjNFQjA'

describe('previewOf', () => {
  it('R8: un cuerpo de hasta 120 caracteres sale entero', () => {
    const body = 'a'.repeat(120)
    expect(previewOf(body)).toBe(body)
    expect(previewOf('hola')).toBe('hola')
  })

  it('R8: un cuerpo más largo se recorta a 120 caracteres', () => {
    expect(previewOf('b'.repeat(121))).toBe('b'.repeat(120))
  })

  it('R8: el recorte cuenta puntos de código y no parte un emoji', () => {
    const body = '😀'.repeat(130)
    const preview = previewOf(body)
    expect(Array.from(preview ?? '')).toHaveLength(120)
    expect(preview).toBe('😀'.repeat(120))
  })

  it('R8: sin cuerpo la vista previa es nula', () => {
    expect(previewOf(null)).toBeNull()
  })
})

const MESSAGE_ID = '6f1c2b8e-3d4a-4c5b-9e6f-7a8b9c0d1e2f'
const REACTED_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'

function source(
  type: WhatsappMessageType,
  payload: unknown,
  overrides: Partial<Omit<AttachmentSource, 'type' | 'payload'>> = {},
): AttachmentSource {
  return { id: MESSAGE_ID, direction: 'IN', reactedMessageId: null, ...overrides, type, payload }
}

describe('attachmentOf', () => {
  it.each<WhatsappMessageType>(['AUDIO', 'VIDEO'])(
    'R25/R48: %s da tipo MIME y pie, sin el identificador del archivo en Meta ni dirección de archivo',
    (type) => {
      const payload = { from: '5215512345678', media_id: MEDIA_ID, mime_type: 'audio/ogg', caption: 'mira' }
      const attachment = attachmentOf(source(type, payload), whatsappMediaPath)
      expect(attachment).toEqual({ kind: 'media', mimeType: 'audio/ogg', filename: null, caption: 'mira', mediaUrl: null })
      expect(JSON.stringify(attachment)).not.toContain(MEDIA_ID)
    },
  )

  it.each<WhatsappMessageType>(['IMAGE', 'STICKER'])(
    'R25/R48: %s entrante con archivo lleva la dirección de la aplicación y nunca el media_id',
    (type) => {
      const payload = { from: '5215512345678', media_id: MEDIA_ID, mime_type: 'image/webp', caption: 'mira' }
      const attachment = attachmentOf(source(type, payload), whatsappMediaPath)
      expect(attachment).toEqual({
        kind: 'media',
        mimeType: 'image/webp',
        filename: null,
        caption: 'mira',
        mediaUrl: `/api/integraciones/whatsapp/media/${MESSAGE_ID}`,
      })
      expect(JSON.stringify(attachment)).not.toContain(MEDIA_ID)
    },
  )

  it('R48: la dirección sale del constructor inyectado con el id interno del mensaje', () => {
    const payload = { media_id: MEDIA_ID, mime_type: 'image/png' }
    const attachment = attachmentOf(source('IMAGE', payload), (id) => `/otra/${id}`)
    expect(attachment).toMatchObject({ kind: 'media', mediaUrl: `/otra/${MESSAGE_ID}` })
  })

  it('R48: una imagen saliente no lleva dirección de archivo', () => {
    const payload = { media_id: MEDIA_ID, mime_type: 'image/jpeg' }
    expect(attachmentOf(source('IMAGE', payload, { direction: 'OUT' }), whatsappMediaPath)).toMatchObject({ kind: 'media', mediaUrl: null })
  })

  it('R48: una imagen entrante sin media_id no lleva dirección de archivo', () => {
    expect(attachmentOf(source('IMAGE', { mime_type: 'image/jpeg' }), whatsappMediaPath)).toMatchObject({ kind: 'media', mediaUrl: null })
    expect(attachmentOf(source('STICKER', { mime_type: 'image/webp', media_id: '' }), whatsappMediaPath)).toMatchObject({
      kind: 'media',
      mediaUrl: null,
    })
  })

  it('R25/R48: un documento da tipo MIME, nombre de archivo y pie, sin dirección de archivo', () => {
    const payload = { media_id: MEDIA_ID, mime_type: 'application/pdf', filename: 'factura.pdf', caption: 'la factura' }
    expect(attachmentOf(source('DOCUMENT', payload), whatsappMediaPath)).toEqual({
      kind: 'media',
      mimeType: 'application/pdf',
      filename: 'factura.pdf',
      caption: 'la factura',
      mediaUrl: null,
    })
  })

  it('R25: un medio sin pie ni nombre deja ambos nulos', () => {
    expect(attachmentOf(source('AUDIO', { media_id: MEDIA_ID, mime_type: 'audio/ogg' }), whatsappMediaPath)).toEqual({
      kind: 'media',
      mimeType: 'audio/ogg',
      filename: null,
      caption: null,
      mediaUrl: null,
    })
  })

  it('R25: una ubicación da latitud, longitud, nombre y dirección', () => {
    const payload = { from: '5215512345678', latitude: 19.43, longitude: -99.13, name: 'Oficina', address: 'Reforma 1' }
    expect(attachmentOf(source('LOCATION', payload), whatsappMediaPath)).toEqual({
      kind: 'location',
      latitude: 19.43,
      longitude: -99.13,
      name: 'Oficina',
      address: 'Reforma 1',
    })
  })

  it('R25: una ubicación sin nombre ni dirección los deja nulos', () => {
    expect(attachmentOf(source('LOCATION', { latitude: 1, longitude: 2 }), whatsappMediaPath)).toEqual({
      kind: 'location',
      latitude: 1,
      longitude: 2,
      name: null,
      address: null,
    })
  })

  it('R25/R49: una reacción da su emoji y el id interno del mensaje reaccionado, nunca el wamid', () => {
    const payload = { from: '5215512345678', message_id: WAMID, emoji: '👍' }
    const attachment = attachmentOf(source('REACTION', payload, { reactedMessageId: REACTED_ID }), whatsappMediaPath)
    expect(attachment).toEqual({ kind: 'reaction', emoji: '👍', messageId: REACTED_ID })
    expect(JSON.stringify(attachment)).not.toContain(WAMID)
  })

  it('R49: una reacción a un mensaje no guardado en el contacto da messageId nulo', () => {
    const attachment = attachmentOf(source('REACTION', { message_id: WAMID, emoji: '👍' }), whatsappMediaPath)
    expect(attachment).toEqual({ kind: 'reaction', emoji: '👍', messageId: null })
    expect(JSON.stringify(attachment)).not.toContain(WAMID)
  })

  it.each([null, undefined, ''])('R25: una reacción quitada (emoji %s) da emoji nulo', (emoji) => {
    expect(attachmentOf(source('REACTION', { message_id: WAMID, emoji }, { reactedMessageId: REACTED_ID }), whatsappMediaPath)).toEqual({
      kind: 'reaction',
      emoji: null,
      messageId: REACTED_ID,
    })
  })

  it.each<[WhatsappMessageType, unknown]>([
    ['IMAGE', { media_id: MEDIA_ID }],
    ['DOCUMENT', { mime_type: 42 }],
    ['LOCATION', { latitude: '19.43', longitude: -99.13 }],
    ['LOCATION', { latitude: 1 }],
    ['REACTION', { emoji: 7 }],
    ['IMAGE', null],
    ['LOCATION', 'texto'],
  ])('R25: un payload de %s que no casa da adjunto nulo', (type, payload) => {
    expect(attachmentOf(source(type, payload), whatsappMediaPath)).toBeNull()
  })

  it.each<WhatsappMessageType>(['TEXT', 'CONTACTS', 'BUTTON', 'INTERACTIVE', 'TEMPLATE', 'UNSUPPORTED'])(
    'R25: %s no tiene adjunto',
    (type) => {
      const payload = { mime_type: 'image/jpeg', media_id: MEDIA_ID, latitude: 1, longitude: 2, emoji: '👍' }
      expect(attachmentOf(source(type, payload, { reactedMessageId: REACTED_ID }), whatsappMediaPath)).toBeNull()
    },
  )
})

function failed(errorCode: string | null, errorReason: string | null, status: WhatsappMessageStatus = 'FAILED'): FailureSource {
  return { status, errorCode, errorReason }
}

describe('failureReasonOf', () => {
  it.each<WhatsappMessageStatus>(['RECEIVED', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ'])(
    'R26: un mensaje %s no tiene motivo de fallo',
    (status) => {
      expect(failureReasonOf(failed('131047', 'algo', status))).toBeNull()
    },
  )

  it.each([
    ['190', 'Revisa el token en Integraciones'],
    ['131047', 'Pasaron más de 24 horas desde el último mensaje del cliente: usa una plantilla.'],
    ['130429', 'Demasiados mensajes, intenta en un momento'],
    ['131056', 'Demasiados mensajes, intenta en un momento'],
    ['131026', 'Meta no aceptó el mensaje (código 131026). Intenta de nuevo o revisa la conexión.'],
  ])('R26: con el código %s da el texto en español de la tabla, no el de Meta', (code, reason) => {
    const metaText = 'Recipient +5215512345678 said: hola secreto'
    expect(failureReasonOf(failed(code, metaText))).toBe(reason)
  })

  it('R26: sin código da el motivo guardado', () => {
    expect(failureReasonOf(failed(null, 'No se pudo contactar con Meta. Intenta de nuevo en unos minutos.'))).toBe(
      'No se pudo contactar con Meta. Intenta de nuevo en unos minutos.',
    )
  })

  it('R26: sin código ni motivo da «No se pudo enviar el mensaje.»', () => {
    expect(failureReasonOf(failed(null, null))).toBe('No se pudo enviar el mensaje.')
  })

  it.each(['abc', '', '12a', '1.5', ' 190'])('R26: un código no numérico (%j) se trata como sin código', (code) => {
    expect(failureReasonOf(failed(code, 'motivo guardado'))).toBe('motivo guardado')
    expect(failureReasonOf(failed(code, null))).toBe('No se pudo enviar el mensaje.')
  })
})

describe('windowOf', () => {
  const lastInboundAt = new Date('2026-10-22T10:00:00.000Z')

  it('R28: dentro de las 24 h la ventana está abierta y cierra a la última entrada + 24 h', () => {
    expect(windowOf(lastInboundAt, new Date('2026-10-23T09:59:59.999Z'))).toEqual({
      open: true,
      closesAt: '2026-10-23T10:00:00.000Z',
    })
  })

  it('R28: a las 24 h exactas la ventana está cerrada y sin hora', () => {
    expect(windowOf(lastInboundAt, new Date('2026-10-23T10:00:00.000Z'))).toEqual({ open: false, closesAt: null })
  })

  it('R28: sin entrante la ventana está cerrada y sin hora', () => {
    expect(windowOf(null, new Date('2026-10-23T10:00:00.000Z'))).toEqual({ open: false, closesAt: null })
  })
})

describe('customerNameOf', () => {
  it('R7: el nombre del cliente une nombres y apellidos con un espacio', () => {
    expect(customerNameOf({ firstNames: 'Laura', lastNames: 'Gómez Ruiz' })).toBe('Laura Gómez Ruiz')
  })

  it('R7: sin apellidos el nombre no deja espacio al final', () => {
    expect(customerNameOf({ firstNames: 'Laura', lastNames: '' })).toBe('Laura')
  })
})
