import { afterEach, describe, expect, it, vi } from 'vitest'
import { AI_PROVIDER_CODES, type AiProviderCode } from '@/lib/modules/integraciones/domain/ai-provider'
import {
  AI_SDK_MODELS,
  OPENROUTER_BASE_URL,
  aiSdkModel,
} from '@/lib/modules/integraciones/adapters/driven/ai/ai-sdk-models'

type Captured = { url: string; headers: Record<string, string> }

function headersOf(init: RequestInit | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  new Headers(init?.headers).forEach((value, key) => {
    out[key] = value
  })
  return out
}

/** Una sola llamada al proveedor con `fetch` simulado: devuelve la URL y las cabeceras que salieron. */
async function firstRequest(provider: AiProviderCode, model: string, apiKey: string): Promise<Captured> {
  // Los proveedores leen su URL del entorno si existe; aqui se mira la URL por defecto.
  vi.stubEnv('ANTHROPIC_BASE_URL', undefined)
  vi.stubEnv('OPENAI_BASE_URL', undefined)
  const captured: Captured[] = []
  vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
    captured.push({ url: String(url), headers: headersOf(init) })
    return new Response(JSON.stringify({ error: { message: 'no' } }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  })
  const languageModel = aiSdkModel({ provider, model, apiKey })
  if (typeof languageModel === 'string') throw new Error('se esperaba un modelo, no un id global')
  await Promise.resolve(
    languageModel.doGenerate({ prompt: [{ role: 'user', content: [{ type: 'text', text: 'hola' }] }] }),
  ).catch(() => undefined)
  expect(captured).toHaveLength(1)
  return captured[0] as Captured
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('ai-sdk-models', () => {
  it('R41: hay exactamente un constructor por codigo de proveedor del catalogo', () => {
    expect(Object.keys(AI_SDK_MODELS).sort()).toEqual([...AI_PROVIDER_CODES].sort())
  })

  it('R41: cada proveedor devuelve un modelo con el id del par', () => {
    for (const provider of AI_PROVIDER_CODES) {
      const languageModel = aiSdkModel({ provider, model: 'modelo-x', apiKey: 'k' })
      if (typeof languageModel === 'string') throw new Error('se esperaba un modelo')
      expect(languageModel.modelId).toBe('modelo-x')
    }
  })

  it('R41: Anthropic llama a su API con la key de la empresa', async () => {
    const request = await firstRequest('ANTHROPIC', 'claude-x', 'sk-ant-empresa')
    expect(request.url, request.url).toMatch(/^https:\/\/api\.anthropic\.com\//)
    expect(request.headers['x-api-key']).toBe('sk-ant-empresa')
  })

  it('R41: Google llama a la API de Gemini con la key de la empresa y el modelo en la ruta', async () => {
    const request = await firstRequest('GOOGLE', 'gemini-x', 'AIza-empresa')
    expect(request.url.startsWith('https://generativelanguage.googleapis.com/')).toBe(true)
    expect(request.url).toContain('gemini-x')
    expect(request.headers['x-goog-api-key']).toBe('AIza-empresa')
  })

  it('R41: OpenAI llama a su API con la key de la empresa', async () => {
    const request = await firstRequest('OPENAI', 'gpt-x', 'sk-empresa')
    expect(request.url.startsWith('https://api.openai.com/v1/')).toBe(true)
    expect(request.headers.authorization).toBe('Bearer sk-empresa')
  })

  it('R41: OpenRouter va por la API de chat compatible con OpenAI en la URL de OpenRouter', async () => {
    expect(OPENROUTER_BASE_URL).toBe('https://openrouter.ai/api/v1')
    const request = await firstRequest('OPENROUTER', 'openai/gpt-x', 'sk-or-empresa')
    expect(request.url).toBe(`${OPENROUTER_BASE_URL}/chat/completions`)
    expect(request.headers.authorization).toBe('Bearer sk-or-empresa')
  })

  it('R41: el mapa es un Record por codigo, asi que un proveedor sin constructor no compila', async () => {
    const { readFileSync } = await import('node:fs')
    const source = readFileSync('lib/modules/integraciones/adapters/driven/ai/ai-sdk-models.ts', 'utf8')
    expect(source).toMatch(/AI_SDK_MODELS:\s*Record<AiProviderCode,/)
  })
})
