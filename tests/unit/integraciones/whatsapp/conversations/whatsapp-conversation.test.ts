import { describe, expect, it } from 'vitest'

import {
  attachmentOf,
  customerNameOf,
  failureReasonOf,
  previewOf,
  windowOf,
  type FailureSource,
} from '@/lib/modules/integraciones/domain/whatsapp-conversation'
import type { WhatsappMessageStatus, WhatsappMessageType } from '@/lib/modules/integraciones/domain/whatsapp-message'

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

describe('attachmentOf', () => {
  it.each<WhatsappMessageType>(['IMAGE', 'AUDIO', 'VIDEO', 'STICKER'])(
    'R25: %s da tipo MIME y pie, sin el identificador del archivo en Meta',
    (type) => {
      const payload = { from: '5215512345678', media_id: MEDIA_ID, mime_type: 'image/jpeg', caption: 'mira' }
      const attachment = attachmentOf(type, payload)
      expect(attachment).toEqual({ kind: 'media', mimeType: 'image/jpeg', filename: null, caption: 'mira' })
      expect(JSON.stringify(attachment)).not.toContain(MEDIA_ID)
    },
  )

  it('R25: un documento da tipo MIME, nombre de archivo y pie', () => {
    const payload = { media_id: MEDIA_ID, mime_type: 'application/pdf', filename: 'factura.pdf', caption: 'la factura' }
    expect(attachmentOf('DOCUMENT', payload)).toEqual({
      kind: 'media',
      mimeType: 'application/pdf',
      filename: 'factura.pdf',
      caption: 'la factura',
    })
  })

  it('R25: un medio sin pie ni nombre deja ambos nulos', () => {
    expect(attachmentOf('AUDIO', { media_id: MEDIA_ID, mime_type: 'audio/ogg' })).toEqual({
      kind: 'media',
      mimeType: 'audio/ogg',
      filename: null,
      caption: null,
    })
  })

  it('R25: una ubicación da latitud, longitud, nombre y dirección', () => {
    const payload = { from: '5215512345678', latitude: 19.43, longitude: -99.13, name: 'Oficina', address: 'Reforma 1' }
    expect(attachmentOf('LOCATION', payload)).toEqual({
      kind: 'location',
      latitude: 19.43,
      longitude: -99.13,
      name: 'Oficina',
      address: 'Reforma 1',
    })
  })

  it('R25: una ubicación sin nombre ni dirección los deja nulos', () => {
    expect(attachmentOf('LOCATION', { latitude: 1, longitude: 2 })).toEqual({
      kind: 'location',
      latitude: 1,
      longitude: 2,
      name: null,
      address: null,
    })
  })

  it('R25: una reacción da su emoji y nunca el wamid del mensaje reaccionado', () => {
    const attachment = attachmentOf('REACTION', { from: '5215512345678', message_id: WAMID, emoji: '👍' })
    expect(attachment).toEqual({ kind: 'reaction', emoji: '👍' })
    expect(JSON.stringify(attachment)).not.toContain(WAMID)
  })

  it.each([null, undefined, ''])('R25: una reacción quitada (emoji %s) da emoji nulo', (emoji) => {
    expect(attachmentOf('REACTION', { message_id: WAMID, emoji })).toEqual({ kind: 'reaction', emoji: null })
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
    expect(attachmentOf(type, payload)).toBeNull()
  })

  it.each<WhatsappMessageType>(['TEXT', 'CONTACTS', 'BUTTON', 'INTERACTIVE', 'TEMPLATE', 'UNSUPPORTED'])(
    'R25: %s no tiene adjunto',
    (type) => {
      expect(attachmentOf(type, { mime_type: 'image/jpeg', latitude: 1, longitude: 2, emoji: '👍' })).toBeNull()
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
