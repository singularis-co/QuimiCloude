import { describe, expect, it } from 'vitest'

import {
  isAccountFailure,
  probeFailureMessage,
  readingFailureMessage,
  UNREADABLE_KEY_MESSAGE,
  type AiProviderFailure,
} from '@/lib/modules/integraciones/domain/ai-provider-failure'

const FAILURES: readonly AiProviderFailure[] = [
  { kind: 'rejected_key', httpStatus: 401, model: null },
  { kind: 'quota', httpStatus: 429, model: null },
  { kind: 'model_unavailable', httpStatus: 404, model: 'modelo-x' },
  { kind: 'unreachable', httpStatus: null, model: null },
  { kind: 'unexpected', httpStatus: 503, model: null },
]

describe('probeFailureMessage', () => {
  it('R11: un texto por tipo de fallo, exactamente los aprobados', () => {
    expect(FAILURES.map((failure) => probeFailureMessage(failure))).toEqual([
      'Error con tu proveedor: la key fue rechazada. Revísala y vuelve a probar.',
      'Error con tu proveedor: tu cuenta no tiene cuota o saldo disponible.',
      'Error con tu proveedor: tu cuenta no tiene acceso al modelo modelo-x.',
      'Error con tu proveedor: no respondió a tiempo. Vuelve a probar en unos minutos.',
      'Error con tu proveedor: respondió con un error inesperado (503).',
    ])
  })

  it('R11: los cinco textos son distintos y todos empiezan por «Error con tu proveedor:»', () => {
    const textos = FAILURES.map((failure) => probeFailureMessage(failure))
    expect(new Set(textos).size).toBe(FAILURES.length)
    for (const texto of textos) expect(texto.startsWith('Error con tu proveedor:')).toBe(true)
  })

  it('R11: el error inesperado sin codigo HTTP dice «sin código»', () => {
    expect(probeFailureMessage({ kind: 'unexpected', httpStatus: null, model: null })).toBe(
      'Error con tu proveedor: respondió con un error inesperado (sin código).',
    )
  })

  it('R11: ningun texto lleva texto libre del proveedor ni la key, aunque el fallo traiga campos de mas', () => {
    const conRuido = {
      kind: 'rejected_key',
      httpStatus: 401,
      model: null,
      message: 'Incorrect API key provided: sk-secreta-123',
      apiKey: 'sk-secreta-123',
    } as AiProviderFailure
    const texto = probeFailureMessage(conRuido)
    expect(texto).not.toContain('sk-secreta-123')
    expect(texto).not.toContain('Incorrect API key')
  })
})

describe('readingFailureMessage', () => {
  it('R25: la key rechazada nombra al proveedor y el codigo', () => {
    expect(readingFailureMessage({ kind: 'rejected_key', httpStatus: 401, model: null }, 'Claude')).toBe(
      'Claude rechazó la key (401).',
    )
  })

  it('R25: la falta de cuota nombra al proveedor y el codigo', () => {
    expect(readingFailureMessage({ kind: 'quota', httpStatus: 402, model: null }, 'OpenRouter')).toBe(
      'OpenRouter indicó que tu cuenta no tiene cuota o saldo (402).',
    )
  })

  it('R25: sin codigo HTTP dice «sin código»', () => {
    expect(readingFailureMessage({ kind: 'quota', httpStatus: null, model: null }, 'Gemini')).toBe(
      'Gemini indicó que tu cuenta no tiene cuota o saldo (sin código).',
    )
  })
})

describe('isAccountFailure', () => {
  it('R26: solo la key rechazada y la falta de cuota son fallos de la cuenta', () => {
    expect(FAILURES.filter(isAccountFailure).map((failure) => failure.kind)).toEqual(['rejected_key', 'quota'])
  })
})

describe('UNREADABLE_KEY_MESSAGE', () => {
  it('R9: es el texto aprobado', () => {
    expect(UNREADABLE_KEY_MESSAGE).toBe('No se pudo leer la key guardada. Vuelve a escribirla.')
  })
})
