// QT-304 R23, R24: que fallos del principal pasan al respaldo y como se hace el unico intento extra.

import { describe, expect, it, vi } from 'vitest'

import type { AiProviderFailure } from '@/lib/modules/integraciones/domain/ai-provider-failure'
import {
  OVERLOAD_STATUSES,
  shouldFallBack,
  withFallback,
  type CandidateModel,
} from '@/lib/modules/integraciones/domain/model-fallback'
import type { ModelTarget, TextGeneration } from '@/lib/modules/integraciones/ports/conversational-model'

import { failure, textFailed, textOk } from './conversational-model-doubles'

describe('shouldFallBack', () => {
  it.each<[string, AiProviderFailure]>([
    ['404 de modelo no disponible', failure('model_unavailable', 404)],
    ['modelo invalido de OpenRouter (400 clasificado como modelo no disponible)', failure('model_unavailable', 400)],
    ['sin respuesta', failure('unreachable', null)],
    ['sobrecarga 503', failure('unexpected', 503)],
    ['sobrecarga 529', failure('unexpected', 529)],
  ])('R23: %s pasa al respaldo', (_caso, cause) => {
    expect(shouldFallBack(cause)).toBe(true)
  })

  it.each<[string, AiProviderFailure]>([
    ['500', failure('unexpected', 500)],
    ['502', failure('unexpected', 502)],
    ['504', failure('unexpected', 504)],
    ['inesperado sin codigo', failure('unexpected', null)],
    ['401', failure('rejected_key', 401)],
    ['403', failure('rejected_key', 403)],
    ['402', failure('quota', 402)],
    ['429', failure('quota', 429)],
  ])('R24: %s no pasa al respaldo', (_caso, cause) => {
    expect(shouldFallBack(cause)).toBe(false)
  })

  it('R23: la sobrecarga son exactamente 503 y 529', () => {
    expect([...OVERLOAD_STATUSES].sort()).toEqual([503, 529])
  })
})

describe('withFallback', () => {
  const primary: CandidateModel = { provider: 'GOOGLE', model: 'principal', apiKey: 'k', supportsTools: true }
  const fallback: CandidateModel = { provider: 'GOOGLE', model: 'respaldo', apiKey: 'k', supportsTools: true }

  function calls(...results: TextGeneration[]) {
    const queue = [...results]
    return vi.fn<(target: ModelTarget) => Promise<TextGeneration>>(async () => queue.shift() as TextGeneration)
  }

  it('R23: el puerto recibe el modelo sin la marca de herramientas y el respaldo se llama una vez', async () => {
    const call = calls(textFailed(failure('unreachable', null)), textOk())
    const result = await withFallback({ primary, fallback }, false, call)

    expect(call.mock.calls.map(([target]) => target)).toEqual([
      { provider: 'GOOGLE', model: 'principal', apiKey: 'k' },
      { provider: 'GOOGLE', model: 'respaldo', apiKey: 'k' },
    ])
    expect(result).toMatchObject({ status: 'ok', model: 'respaldo', fallbackFrom: failure('unreachable', null) })
  })

  it('R24: un resultado que no es fallo vuelve del principal sin tocar el respaldo', async () => {
    const call = calls(textOk())
    await expect(withFallback({ primary, fallback }, true, call)).resolves.toMatchObject({
      status: 'ok',
      model: 'principal',
      fallbackFrom: null,
    })
    expect(call).toHaveBeenCalledTimes(1)
  })
})
