import { createHmac, timingSafeEqual } from 'node:crypto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  webhookSignatureHmac,
  webhookSignatureMatches,
} from '@/lib/modules/integraciones/adapters/driven/security/webhook-signature-hmac'

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>()
  return { ...actual, timingSafeEqual: vi.fn(actual.timingSafeEqual) }
})

const APP_SECRET = 'app-secret-de-prueba'
const BODY = new TextEncoder().encode('{"object":"whatsapp_business_account","entry":[]}')

function signatureOf(body: Uint8Array, secret = APP_SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
}

describe('webhookSignatureHmac', () => {
  beforeEach(() => {
    vi.mocked(timingSafeEqual).mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('R10: la firma HMAC-SHA256 en hex de los bytes del cuerpo con el App Secret casa', () => {
    expect(webhookSignatureMatches(BODY, signatureOf(BODY), APP_SECRET)).toBe(true)
    expect(webhookSignatureHmac.matches(BODY, signatureOf(BODY), APP_SECRET)).toBe(true)
  })

  it('R10: vector conocido de HMAC-SHA256 (RFC 4231, caso 2)', () => {
    const body = new TextEncoder().encode('what do ya want for nothing?')
    const header = 'sha256=5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843'

    expect(webhookSignatureMatches(body, header, 'Jefe')).toBe(true)
  })

  it('R10: el hex de la cabecera en mayúsculas también casa', () => {
    expect(webhookSignatureMatches(BODY, signatureOf(BODY).toUpperCase().replace('SHA256=', 'sha256='), APP_SECRET)).toBe(
      true,
    )
  })

  it('R11: un byte cambiado en el cuerpo ⇒ false', () => {
    const tampered = new Uint8Array(BODY)
    tampered[5] = tampered[5] ^ 0x01

    expect(webhookSignatureMatches(tampered, signatureOf(BODY), APP_SECRET)).toBe(false)
  })

  it('R11: firmado con otro secreto ⇒ false', () => {
    expect(webhookSignatureMatches(BODY, signatureOf(BODY, 'otro-secreto'), APP_SECRET)).toBe(false)
  })

  it('R10: bytes que no son UTF-8 válido firman bien: se firma el binario, no un texto', () => {
    const body = new Uint8Array([0x7b, 0xff, 0xfe, 0xc3, 0x28, 0x7d])
    const decodedAndReencoded = new TextEncoder().encode(new TextDecoder().decode(body))

    expect(webhookSignatureMatches(body, signatureOf(body), APP_SECRET)).toBe(true)
    expect(webhookSignatureMatches(decodedAndReencoded, signatureOf(body), APP_SECRET)).toBe(false)
  })

  it.each([
    ['nula', null],
    ['vacía', ''],
    ['sin sha256=', createHmac('sha256', APP_SECRET).update(BODY).digest('hex')],
    ['con 63 hex', signatureOf(BODY).slice(0, -1)],
    ['con 65 hex', `${signatureOf(BODY)}0`],
    ['con sha1=', signatureOf(BODY).replace('sha256=', 'sha1=')],
    ['con espacios alrededor', ` ${signatureOf(BODY)} `],
    ['con caracteres que no son hex', `${signatureOf(BODY).slice(0, -1)}g`],
  ])('R11: cabecera %s ⇒ false sin lanzar y sin comparar', (_caso, header) => {
    expect(() => webhookSignatureMatches(BODY, header, APP_SECRET)).not.toThrow()
    expect(webhookSignatureMatches(BODY, header, APP_SECRET)).toBe(false)
    expect(timingSafeEqual).not.toHaveBeenCalled()
  })

  it('R10: cada comparación pasa una vez por timingSafeEqual con 32 contra 32 bytes', () => {
    expect(webhookSignatureMatches(BODY, signatureOf(BODY), APP_SECRET)).toBe(true)
    expect(webhookSignatureMatches(BODY, signatureOf(BODY, 'otro'), APP_SECRET)).toBe(false)

    expect(timingSafeEqual).toHaveBeenCalledTimes(2)
    for (const [left, right] of vi.mocked(timingSafeEqual).mock.calls) {
      expect((left as Buffer).length).toBe(32)
      expect((right as Buffer).length).toBe(32)
    }
  })
})
