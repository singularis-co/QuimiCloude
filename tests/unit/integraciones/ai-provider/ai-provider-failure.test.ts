import { describe, expect, it } from 'vitest'

import {
  isAccountFailure,
  isAccountFailureNotice,
  isModelUnavailableNotice,
  marksConnection,
  modelUnavailableNotice,
  probeFailureMessage,
  READING_FAILURE_PREFIX,
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
  it('R11, R20: un texto por tipo de fallo, exactamente los aprobados', () => {
    expect(FAILURES.map((failure) => probeFailureMessage(failure))).toEqual([
      'Error con tu proveedor: la key fue rechazada. Revísala y vuelve a probar.',
      'Error con tu proveedor: tu cuenta no tiene cuota o saldo disponible.',
      'Error con tu proveedor: el modelo modelo-x ya no está disponible.',
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

describe('marksConnection', () => {
  it('R21, R23: la key rechazada, la falta de cuota y el modelo no disponible marcan la conexion; la red y lo inesperado no', () => {
    expect(FAILURES.filter(marksConnection).map((failure) => failure.kind)).toEqual([
      'rejected_key',
      'quota',
      'model_unavailable',
    ])
  })
})

describe('modelUnavailableNotice', () => {
  it('R21: con un modelo elegido dice «que elegiste» y nombra al proveedor', () => {
    expect(modelUnavailableNotice('gemini-4-argon', 'Gemini', true)).toBe(
      'El modelo gemini-4-argon que elegiste ya no está disponible en Gemini. ' +
        'Elige otro modelo para volver a leer fórmulas y catálogos en PDF.',
    )
  })

  it('R21, R23: con el predeterminado no dice «que elegiste»', () => {
    expect(modelUnavailableNotice('gemini-3.8-flash', 'Gemini', false)).toBe(
      'El modelo gemini-3.8-flash ya no está disponible en Gemini. ' +
        'Elige otro modelo para volver a leer fórmulas y catálogos en PDF.',
    )
  })
})

describe('isModelUnavailableNotice', () => {
  it('R12: reconoce el aviso de la prueba y el de la lectura, elegido o predeterminado', () => {
    expect(isModelUnavailableNotice(modelUnavailableNotice('m', 'Claude', true))).toBe(true)
    expect(isModelUnavailableNotice(modelUnavailableNotice('m', 'Claude', false))).toBe(true)
    expect(isModelUnavailableNotice(READING_FAILURE_PREFIX + modelUnavailableNotice('m', 'Claude', true))).toBe(true)
  })

  it('R12: no reconoce otros errores ni la ausencia de error', () => {
    for (const failure of FAILURES) expect(isModelUnavailableNotice(probeFailureMessage(failure)), failure.kind).toBe(false)
    expect(isModelUnavailableNotice(UNREADABLE_KEY_MESSAGE)).toBe(false)
    expect(isModelUnavailableNotice(READING_FAILURE_PREFIX + 'Claude rechazó la key (401).')).toBe(false)
    expect(isModelUnavailableNotice(null)).toBe(false)
  })
})

describe('isAccountFailureNotice', () => {
  it('R12: reconoce la key rechazada y la falta de cuota tal como las escribe «Probar conexion»', () => {
    expect(isAccountFailureNotice(probeFailureMessage({ kind: 'rejected_key', httpStatus: 401, model: null }), 'Claude')).toBe(true)
    expect(isAccountFailureNotice(probeFailureMessage({ kind: 'quota', httpStatus: 429, model: null }), 'Claude')).toBe(true)
  })

  it('R12: reconoce la key rechazada y la falta de cuota tal como las escribe la lectura, con o sin codigo', () => {
    const lectura = (failure: Parameters<typeof readingFailureMessage>[0]) =>
      READING_FAILURE_PREFIX + readingFailureMessage(failure, 'OpenRouter')
    expect(isAccountFailureNotice(lectura({ kind: 'rejected_key', httpStatus: 403, model: null }), 'OpenRouter')).toBe(true)
    expect(isAccountFailureNotice(lectura({ kind: 'quota', httpStatus: 402, model: null }), 'OpenRouter')).toBe(true)
    expect(isAccountFailureNotice(lectura({ kind: 'quota', httpStatus: null, model: null }), 'OpenRouter')).toBe(true)
  })

  it('R12: no reconoce sin respuesta, inesperado, modelo no disponible ni key ilegible', () => {
    for (const failure of FAILURES.filter((f) => !isAccountFailure(f))) {
      expect(isAccountFailureNotice(probeFailureMessage(failure), 'Gemini'), failure.kind).toBe(false)
    }
    expect(isAccountFailureNotice(UNREADABLE_KEY_MESSAGE, 'Gemini')).toBe(false)
    expect(isAccountFailureNotice(READING_FAILURE_PREFIX + modelUnavailableNotice('m', 'Gemini', true), 'Gemini')).toBe(false)
    expect(isAccountFailureNotice(null, 'Gemini')).toBe(false)
  })

  it('R12: la comparacion es exacta: ni otro proveedor, ni texto anadido, ni un codigo que no es numero', () => {
    const rechazo = READING_FAILURE_PREFIX + 'Gemini rechazó la key (401).'
    expect(isAccountFailureNotice(rechazo, 'Gemini')).toBe(true)
    expect(isAccountFailureNotice(rechazo, 'Claude')).toBe(false)
    expect(isAccountFailureNotice(rechazo + ' extra', 'Gemini')).toBe(false)
    expect(isAccountFailureNotice('x' + rechazo, 'Gemini')).toBe(false)
    expect(isAccountFailureNotice(READING_FAILURE_PREFIX + 'Gemini rechazó la key (abc).', 'Gemini')).toBe(false)
    expect(
      isAccountFailureNotice(probeFailureMessage({ kind: 'quota', httpStatus: 429, model: null }) + ' ', 'Gemini'),
    ).toBe(false)
  })
})
