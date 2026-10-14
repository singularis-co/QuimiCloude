// Doble de la prueba del proveedor IA para el E2E: respuestas fijas y ninguna llamada de red.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  aiProviderProbeCanned,
  CANNED_ELAPSED_MS,
  CANNED_INVALID_KEY_PREFIX,
} from '@/lib/modules/integraciones/adapters/driven/ai/ai-provider-probe-canned'

const MODELS = ['modelo-receta', 'modelo-catalogo'] as const

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('aiProviderProbeCanned', () => {
  it('R40: una key cualquiera da prueba buena con 800 ms, para cada proveedor', async () => {
    expect(CANNED_ELAPSED_MS).toBe(800)
    for (const provider of ['ANTHROPIC', 'GOOGLE', 'OPENAI', 'OPENROUTER'] as const) {
      await expect(
        aiProviderProbeCanned.probe({ provider, apiKey: 'sk-cualquiera', models: MODELS }),
      ).resolves.toEqual({ ok: true, elapsedMs: 800 })
    }
  })

  it('R40: una key que empieza por E2E_INVALID da key rechazada con 401', async () => {
    expect(CANNED_INVALID_KEY_PREFIX).toBe('E2E_INVALID')
    await expect(
      aiProviderProbeCanned.probe({ provider: 'GOOGLE', apiKey: 'E2E_INVALID-key', models: MODELS }),
    ).resolves.toEqual({ ok: false, failure: { kind: 'rejected_key', httpStatus: 401, model: null } })
  })

  it('R40: el prefijo solo cuenta al principio de la key', async () => {
    await expect(
      aiProviderProbeCanned.probe({ provider: 'OPENAI', apiKey: 'sk-E2E_INVALID', models: MODELS }),
    ).resolves.toEqual({ ok: true, elapsedMs: 800 })
  })

  it('R40: no llama a la red', async () => {
    await aiProviderProbeCanned.probe({ provider: 'ANTHROPIC', apiKey: 'sk-1', models: MODELS })
    await aiProviderProbeCanned.probe({ provider: 'ANTHROPIC', apiKey: 'E2E_INVALID', models: MODELS })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
