import { describe, expect, it } from 'vitest'

import type { AiProviderConnectionRecord } from '@/lib/modules/integraciones/domain/ai-provider'
import type { AiProviderProbeResult } from '@/lib/modules/integraciones/domain/ai-provider-failure'
import { ValidationError } from '@/lib/modules/integraciones/domain/errors'
import { createTestAiProviderKey } from '@/lib/modules/integraciones/domain/test-ai-provider-key'

import {
  API_KEY,
  CATALOG,
  REJECTED_PROBE,
  admin,
  makeCatalog,
  makeCipher,
  makeProbe,
  makeRepository,
  storedConnection,
} from './ai-provider-doubles'

function setup(
  result?: AiProviderProbeResult,
  entries = [...CATALOG],
  record: Partial<AiProviderConnectionRecord> | null = {},
) {
  const cipher = makeCipher()
  const repo = makeRepository(record === null ? [] : [storedConnection(cipher.seed, record)])
  const catalog = makeCatalog(entries)
  const probe = makeProbe(result)
  const test = createTestAiProviderKey({ connections: repo.connections, catalog: catalog.catalog, probe: probe.probe })
  return { repo, cipher, catalog, probe, test }
}

describe('probar una key escrita', () => {
  it('R10, QT-291 R19: prueba una sola vez con la key dada y el predeterminado del proveedor escrito', async () => {
    const { probe, test } = setup()
    await test({ provider: 'OPENROUTER', apiKey: API_KEY }, admin())

    expect(probe.call).toHaveBeenCalledTimes(1)
    expect(probe.call).toHaveBeenCalledWith({
      provider: 'OPENROUTER',
      apiKey: API_KEY,
      models: ['modelo-recomendado-r'],
    })
  })

  it('QT-291 R19: con el proveedor conectado y una eleccion, prueba la eleccion', async () => {
    const { probe, test } = setup(undefined, [...CATALOG], { provider: 'GOOGLE', model: 'modelo-bajo-g' })
    await test({ provider: 'GOOGLE', apiKey: API_KEY }, admin())
    expect(probe.call).toHaveBeenCalledWith({ provider: 'GOOGLE', apiKey: API_KEY, models: ['modelo-bajo-g'] })
  })

  it('QT-291 R19: con el proveedor conectado sin eleccion, prueba el predeterminado', async () => {
    const { probe, test } = setup(undefined, [...CATALOG], { provider: 'GOOGLE', model: null })
    await test({ provider: 'GOOGLE', apiKey: API_KEY }, admin())
    expect(probe.call).toHaveBeenCalledWith({ provider: 'GOOGLE', apiKey: API_KEY, models: ['modelo-recomendado-g'] })
  })

  it('QT-291 R19: con otro proveedor que el conectado, prueba su predeterminado aunque haya eleccion', async () => {
    const { probe, test } = setup(undefined, [...CATALOG], { provider: 'GOOGLE', model: 'modelo-bajo-g' })
    await test({ provider: 'ANTHROPIC', apiKey: API_KEY }, admin())
    expect(probe.call).toHaveBeenCalledWith({ provider: 'ANTHROPIC', apiKey: API_KEY, models: ['modelo-recomendado-a'] })
  })

  it('QT-291 R19: sin conexion, prueba el predeterminado del proveedor escrito', async () => {
    const { probe, test, repo } = setup(undefined, [...CATALOG], null)
    await test({ provider: 'GOOGLE', apiKey: API_KEY }, admin())
    expect(probe.call).toHaveBeenCalledWith({ provider: 'GOOGLE', apiKey: API_KEY, models: ['modelo-recomendado-g'] })
    expect(repo.find).toHaveBeenCalledWith({ companyId: admin().companyId })
  })

  it('R10: la key se recorta antes de probar', async () => {
    const { probe, test } = setup()
    await test({ provider: 'GOOGLE', apiKey: `  ${API_KEY}\n` }, admin())
    expect(probe.call.mock.calls[0]?.[0].apiKey).toBe(API_KEY)
  })

  it('R12: prueba buena devuelve cuanto tardo', async () => {
    const { test } = setup({ ok: true, elapsedMs: 2345 })
    expect(await test({ provider: 'ANTHROPIC', apiKey: API_KEY }, admin())).toEqual({
      status: 'tested',
      ok: true,
      elapsedMs: 2345,
    })
  })

  it('R11: prueba fallida devuelve el mensaje compuesto por tipo, con el prefijo y sin la key', async () => {
    const { test } = setup(REJECTED_PROBE)
    const result = await test({ provider: 'ANTHROPIC', apiKey: API_KEY }, admin())

    expect(result).toEqual({
      status: 'tested',
      ok: false,
      message: 'Error con tu proveedor: la key fue rechazada. Revísala y vuelve a probar.',
    })
    expect(JSON.stringify(result)).not.toContain(API_KEY)
  })

  it('QT-291 R20: un modelo no disponible da «el modelo <modelo> ya no está disponible.»', async () => {
    const { test } = setup({
      ok: false,
      failure: { kind: 'model_unavailable', httpStatus: 404, model: 'modelo-recomendado-o' },
    })
    const result = await test({ provider: 'OPENAI', apiKey: API_KEY }, admin())
    expect(result).toEqual({
      status: 'tested',
      ok: false,
      message: 'Error con tu proveedor: el modelo modelo-recomendado-o ya no está disponible.',
    })
  })

  it('R13: ni con prueba buena ni con prueba fallida escribe ni cifra nada', async () => {
    for (const result of [undefined, REJECTED_PROBE]) {
      const { repo, cipher, test } = setup(result)
      await test({ provider: 'GOOGLE', apiKey: API_KEY }, admin())
      expect(repo.create).not.toHaveBeenCalled()
      expect(repo.update).not.toHaveBeenCalled()
      expect(repo.remove).not.toHaveBeenCalled()
      expect(cipher.encrypt).not.toHaveBeenCalled()
      expect(cipher.decrypt).not.toHaveBeenCalled()
    }
  })

  const INVALID: Record<string, unknown> = {
    'proveedor fuera de la lista': { provider: 'MISTRAL', apiKey: API_KEY },
    'sin proveedor': { apiKey: API_KEY },
    'key vacia': { provider: 'GOOGLE', apiKey: '' },
    'key solo espacios': { provider: 'GOOGLE', apiKey: '   \t ' },
    'key de 1025 caracteres': { provider: 'GOOGLE', apiKey: 'k'.repeat(1025) },
    'key que no es texto': { provider: 'GOOGLE', apiKey: 12345 },
    'entrada nula': null,
  }
  for (const [label, input] of Object.entries(INVALID)) {
    it(`R18: ${label} da invalid_input sin llamar al proveedor`, async () => {
      const { probe, test } = setup()
      await expect(test(input, admin())).rejects.toBeInstanceOf(ValidationError)
      expect(probe.call).not.toHaveBeenCalled()
    })
  }

  it('R18: una key de 1024 caracteres es valida', async () => {
    const { probe, test } = setup()
    await test({ provider: 'GOOGLE', apiKey: 'k'.repeat(1024) }, admin())
    expect(probe.call).toHaveBeenCalledTimes(1)
  })

  it('R18: un codigo del dominio que la base no trae se trata como fuera del catalogo', async () => {
    const { probe, test } = setup(undefined, CATALOG.filter((entry) => entry.code !== 'OPENROUTER'))
    await expect(test({ provider: 'OPENROUTER', apiKey: API_KEY }, admin())).rejects.toBeInstanceOf(
      ValidationError,
    )
    expect(probe.call).not.toHaveBeenCalled()
  })
})
