import { APICallError } from 'ai'
import { describe, expect, it } from 'vitest'
import { classifyAiSdkError } from '@/lib/modules/integraciones/adapters/driven/ai/conversational-model-ai-sdk'
import { AI_PROVIDER_CODES, type AiProviderCode } from '@/lib/modules/integraciones/domain/ai-provider'
import type { AiProviderFailure } from '@/lib/modules/integraciones/domain/ai-provider-failure'

const MODEL = 'modelo-del-par'
const SECRET = 'sk-secreta-de-la-empresa'

function apiError(statusCode: number | undefined, responseBody?: string, data?: unknown): APICallError {
  return new APICallError({
    message: `El proveedor dijo algo con ${SECRET}`,
    url: 'https://proveedor.test/v1',
    requestBodyValues: { apiKey: SECRET },
    statusCode,
    responseBody,
    data,
  })
}

function classify(error: unknown, provider: AiProviderCode): AiProviderFailure {
  return classifyAiSdkError(error, provider, MODEL)
}

function abortError(name: 'AbortError' | 'TimeoutError'): Error {
  const error = new Error('aborted')
  error.name = name
  return error
}

describe('classifyAiSdkError: la tabla por proveedor', () => {
  for (const provider of AI_PROVIDER_CODES) {
    it(`R44: ${provider} 401 y 403 son key rechazada`, () => {
      expect(classify(apiError(401), provider)).toEqual({ kind: 'rejected_key', httpStatus: 401, model: null })
      expect(classify(apiError(403), provider)).toEqual({ kind: 'rejected_key', httpStatus: 403, model: null })
    })

    it(`R44: ${provider} 429 es cuota`, () => {
      expect(classify(apiError(429), provider)).toEqual({ kind: 'quota', httpStatus: 429, model: null })
    })

    it(`R44: ${provider} 404 es modelo no disponible con el id del modelo usado`, () => {
      expect(classify(apiError(404), provider)).toEqual({ kind: 'model_unavailable', httpStatus: 404, model: MODEL })
    })

    it(`R44, R43: ${provider} sin respuesta, aborto o plazo es unreachable`, () => {
      const unreachable = { kind: 'unreachable', httpStatus: null, model: null }
      expect(classify(apiError(undefined), provider)).toEqual(unreachable)
      expect(classify(abortError('AbortError'), provider)).toEqual(unreachable)
      expect(classify(abortError('TimeoutError'), provider)).toEqual(unreachable)
      expect(classify(new DOMException('plazo', 'TimeoutError'), provider)).toEqual(unreachable)
    })

    it(`R44: ${provider} cualquier otro codigo, incluidos 5xx y la sobrecarga 503/529, es inesperado con su codigo`, () => {
      for (const status of [400, 409, 500, 502, 503, 504, 529]) {
        expect(classify(apiError(status), provider)).toEqual({ kind: 'unexpected', httpStatus: status, model: null })
      }
    })

    it(`R44: ${provider} un error que no es del proveedor es inesperado sin codigo`, () => {
      expect(classify(new Error('otro'), provider)).toEqual({ kind: 'unexpected', httpStatus: null, model: null })
      expect(classify('texto', provider)).toEqual({ kind: 'unexpected', httpStatus: null, model: null })
    })
  }

  it('R44: 402 es inesperado en Anthropic y cuota en Google, OpenAI y OpenRouter', () => {
    expect(classify(apiError(402), 'ANTHROPIC')).toEqual({ kind: 'unexpected', httpStatus: 402, model: null })
    for (const provider of ['GOOGLE', 'OPENAI', 'OPENROUTER'] as const) {
      expect(classify(apiError(402), provider)).toEqual({ kind: 'quota', httpStatus: 402, model: null })
    }
  })

  it('R44: 400 con API_KEY_INVALID en el cuerpo es key rechazada solo en Google', () => {
    const body = JSON.stringify({ error: { status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } })
    expect(classify(apiError(400, body), 'GOOGLE')).toEqual({ kind: 'rejected_key', httpStatus: 400, model: null })
    for (const provider of ['ANTHROPIC', 'OPENAI', 'OPENROUTER'] as const) {
      expect(classify(apiError(400, body), provider)).toEqual({ kind: 'unexpected', httpStatus: 400, model: null })
    }
  })

  it('R44: 400 con el mensaje exacto de modelo invalido es modelo no disponible solo en OpenRouter', () => {
    const message = `${MODEL} is not a valid model ID`
    const body = JSON.stringify({ error: { message, code: 400 } })
    const expected = { kind: 'model_unavailable', httpStatus: 400, model: MODEL }
    expect(classify(apiError(400, body), 'OPENROUTER')).toEqual(expected)
    expect(classify(apiError(400, undefined, { error: { message } }), 'OPENROUTER')).toEqual(expected)
    expect(classify(apiError(400, body), 'OPENAI')).toEqual({ kind: 'unexpected', httpStatus: 400, model: null })
  })

  it('R44: en OpenRouter otro 400, otro modelo o un cuerpo que no es JSON siguen siendo inesperados', () => {
    const unexpected = { kind: 'unexpected', httpStatus: 400, model: null }
    const other = JSON.stringify({ error: { message: 'otro-modelo is not a valid model ID' } })
    expect(classify(apiError(400, other), 'OPENROUTER')).toEqual(unexpected)
    expect(classify(apiError(400, `${MODEL} is not a valid model ID`), 'OPENROUTER')).toEqual(unexpected)
    expect(classify(apiError(400, JSON.stringify({ error: { message: 'bad request' } })), 'OPENROUTER')).toEqual(
      unexpected,
    )
  })
})

describe('classifyAiSdkError: el fallo no arrastra texto del proveedor', () => {
  it('R45: el fallo solo trae tipo, codigo y modelo, nunca el mensaje, el cuerpo ni la key', () => {
    const body = JSON.stringify({ error: { message: `key ${SECRET} invalida` } })
    for (const provider of AI_PROVIDER_CODES) {
      for (const status of [400, 401, 402, 404, 429, 500, undefined]) {
        const failure = classify(apiError(status, body), provider)
        expect(Object.keys(failure).sort()).toEqual(['httpStatus', 'kind', 'model'])
        expect(JSON.stringify(failure)).not.toContain(SECRET)
        expect(JSON.stringify(failure)).not.toContain('invalida')
      }
    }
  })

  it('R45: el tipo es el mismo AiProviderFailure de reportAiProviderOutcome', () => {
    const kinds = new Set(
      AI_PROVIDER_CODES.flatMap((provider) =>
        [401, 402, 404, 429, 500, undefined].map((status) => classify(apiError(status), provider).kind),
      ),
    )
    expect([...kinds].sort()).toEqual(['model_unavailable', 'quota', 'rejected_key', 'unexpected', 'unreachable'])
  })
})
