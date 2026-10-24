import { describe, expect, it } from 'vitest'

import type { GraphFailure } from '@/lib/modules/integraciones/domain/graph-failure'
import { sendFailureOf, sendFailureReasonOf, TOKEN_INVALID_MESSAGE } from '@/lib/modules/integraciones/domain/whatsapp-send-failure'

const META_TEXT = 'Recipient +5215512345678 said: hola secreto'

function rejected(code: number | null | undefined, subcode: number | null = null): GraphFailure {
  return { kind: 'rejected', message: META_TEXT, code, subcode }
}

describe('sendFailureOf', () => {
  it('R33: el código 190 pide revisar el token y marca la conexión como token inválido', () => {
    expect(TOKEN_INVALID_MESSAGE).toBe('Revisa el token en Integraciones')
    expect(sendFailureOf(rejected(190, 463))).toEqual({
      errorCode: '190',
      errorReason: 'Revisa el token en Integraciones',
      effect: 'token_invalid',
    })
  })

  it('R34: el código 131047 pide usar una plantilla', () => {
    expect(sendFailureOf(rejected(131047))).toEqual({
      errorCode: '131047',
      errorReason: 'Pasaron más de 24 horas desde el último mensaje del cliente: usa una plantilla.',
      effect: null,
    })
  })

  it.each([130429, 131056])('R35: el código %i dice que hay demasiados mensajes', (code) => {
    expect(sendFailureOf(rejected(code))).toEqual({
      errorCode: String(code),
      errorReason: 'Demasiados mensajes, intenta en un momento',
      effect: null,
    })
  })

  it('R36: otro código da el texto genérico con el código', () => {
    expect(sendFailureOf(rejected(131026))).toEqual({
      errorCode: '131026',
      errorReason: 'Meta no aceptó el mensaje (código 131026). Intenta de nuevo o revisa la conexión.',
      effect: null,
    })
  })

  it.each([null, undefined])('R36: un rechazo sin código (%s) da el texto genérico sin código', (code) => {
    expect(sendFailureOf(rejected(code))).toEqual({
      errorCode: null,
      errorReason: 'Meta no aceptó el mensaje. Intenta de nuevo o revisa la conexión.',
      effect: null,
    })
  })

  it('R36: sin respuesta de Meta (red, tiempo, 5xx o sin wamid) da el texto de no contactar, sin código', () => {
    const failure: GraphFailure = { kind: 'unreachable', message: META_TEXT, code: 500 }
    expect(sendFailureOf(failure)).toEqual({
      errorCode: null,
      errorReason: 'No se pudo contactar con Meta. Intenta de nuevo en unos minutos.',
      effect: null,
    })
  })

  it('R36: el texto original de Meta no aparece en el resultado', () => {
    const failures: GraphFailure[] = [
      rejected(190),
      rejected(131047),
      rejected(130429),
      rejected(999),
      rejected(null),
      { kind: 'unreachable', message: META_TEXT },
    ]
    for (const failure of failures) {
      expect(JSON.stringify(sendFailureOf(failure))).not.toContain('5215512345678')
      expect(JSON.stringify(sendFailureOf(failure))).not.toContain('secreto')
    }
  })

  it('R36: todo errorReason cabe en el recorte de 500 caracteres', () => {
    const reason = sendFailureOf(rejected(Number.MAX_SAFE_INTEGER)).errorReason
    expect([...reason].length).toBeLessThanOrEqual(500)
  })
})

describe('sendFailureReasonOf', () => {
  it.each([
    [190, 'Revisa el token en Integraciones'],
    [131047, 'Pasaron más de 24 horas desde el último mensaje del cliente: usa una plantilla.'],
    [130429, 'Demasiados mensajes, intenta en un momento'],
    [131056, 'Demasiados mensajes, intenta en un momento'],
    [131026, 'Meta no aceptó el mensaje (código 131026). Intenta de nuevo o revisa la conexión.'],
  ])('R26: el código %i da el mismo texto que el envío guarda', (code, reason) => {
    expect(sendFailureReasonOf(code)).toBe(reason)
    expect(sendFailureOf(rejected(code)).errorReason).toBe(sendFailureReasonOf(code))
  })
})
