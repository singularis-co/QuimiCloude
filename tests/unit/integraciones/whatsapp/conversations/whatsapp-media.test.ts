import { describe, expect, it } from 'vitest'

import type { WhatsappMessageType } from '@/lib/modules/integraciones/domain/whatsapp-message'
import {
  isAllowedMediaContentType,
  isViewableMedia,
  isViewableMediaType,
  mediaIdOf,
  VIEWABLE_MEDIA_TYPES,
  WHATSAPP_MEDIA_CONTENT_TYPES,
  WHATSAPP_MEDIA_MAX_BYTES,
} from '@/lib/modules/integraciones/domain/whatsapp-media'
import { WHATSAPP_MEDIA_ROUTE_BASE, whatsappMediaPath } from '@/lib/shared/routes'

const MESSAGE_ID = '6f1c2b8e-3d4a-4c5b-9e6f-7a8b9c0d1e2f'
const MEDIA_ID = 'meta-media-id-123'

describe('whatsappMediaPath', () => {
  it('R48: la dirección es relativa a la aplicación y usa el id interno del mensaje', () => {
    expect(WHATSAPP_MEDIA_ROUTE_BASE).toBe('/api/integraciones/whatsapp/media')
    expect(whatsappMediaPath(MESSAGE_ID)).toBe(`/api/integraciones/whatsapp/media/${MESSAGE_ID}`)
  })
})

describe('mediaIdOf', () => {
  it('R48: lee el media_id del payload guardado', () => {
    expect(mediaIdOf({ media_id: MEDIA_ID, mime_type: 'image/jpeg' })).toBe(MEDIA_ID)
  })

  it.each<unknown>([null, undefined, 'texto', {}, { media_id: '' }, { media_id: 7 }])(
    'R48: sin un media_id de texto no vacío (%j) da nulo',
    (payload) => {
      expect(mediaIdOf(payload)).toBeNull()
    },
  )
})

describe('isViewableMedia', () => {
  it('R48: solo imagen y sticker son medios visibles', () => {
    expect([...VIEWABLE_MEDIA_TYPES]).toEqual(['IMAGE', 'STICKER'])
  })

  it.each<WhatsappMessageType>(['IMAGE', 'STICKER'])('R48: %s entrante con media_id es visible', (type) => {
    expect(isViewableMediaType(type)).toBe(true)
    expect(isViewableMedia('IN', type, { media_id: MEDIA_ID })).toBe(true)
  })

  it.each<WhatsappMessageType>(['AUDIO', 'VIDEO', 'DOCUMENT', 'LOCATION', 'REACTION', 'TEXT', 'TEMPLATE'])(
    'R48: %s no es visible aunque traiga media_id',
    (type) => {
      expect(isViewableMediaType(type)).toBe(false)
      expect(isViewableMedia('IN', type, { media_id: MEDIA_ID })).toBe(false)
    },
  )

  it('R48: una imagen saliente no es visible', () => {
    expect(isViewableMedia('OUT', 'IMAGE', { media_id: MEDIA_ID })).toBe(false)
  })

  it('R48: una imagen entrante sin media_id no es visible', () => {
    expect(isViewableMedia('IN', 'IMAGE', { mime_type: 'image/jpeg' })).toBe(false)
  })
})

describe('límites del archivo', () => {
  it('R46: el tope es de 5 MB', () => {
    expect(WHATSAPP_MEDIA_MAX_BYTES).toBe(5 * 1024 * 1024)
  })

  it('R46: solo se admiten image/jpeg, image/png e image/webp', () => {
    expect([...WHATSAPP_MEDIA_CONTENT_TYPES]).toEqual(['image/jpeg', 'image/png', 'image/webp'])
    for (const type of WHATSAPP_MEDIA_CONTENT_TYPES) expect(isAllowedMediaContentType(type)).toBe(true)
    expect(isAllowedMediaContentType('IMAGE/PNG')).toBe(true)
    for (const type of ['image/gif', 'image/svg+xml', 'text/html', 'audio/ogg', '']) {
      expect(isAllowedMediaContentType(type)).toBe(false)
    }
  })
})
