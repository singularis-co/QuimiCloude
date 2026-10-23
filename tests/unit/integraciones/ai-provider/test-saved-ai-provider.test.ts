import { describe, expect, it } from 'vitest'

import type { AiProviderConnectionRecord } from '@/lib/modules/integraciones/domain/ai-provider'
import type { AiProviderProbeResult } from '@/lib/modules/integraciones/domain/ai-provider-failure'
import { SecretUnreadableError } from '@/lib/modules/integraciones/domain/errors'
import { createTestSavedAiProvider } from '@/lib/modules/integraciones/domain/test-saved-ai-provider'

import {
  CONNECTION_ID,
  EARLIER,
  NOW,
  OLD_API_KEY,
  REJECTED_PROBE,
  admin,
  makeCatalog,
  makeCipher,
  makeProbe,
  makeRepository,
  storedConnection,
} from './ai-provider-doubles'

function setup(options: { probe?: AiProviderProbeResult; record?: Partial<AiProviderConnectionRecord> } = {}) {
  const cipher = makeCipher()
  const repo = makeRepository([storedConnection(cipher.seed, options.record)])
  const probe = makeProbe(options.probe)
  const test = createTestSavedAiProvider({
    connections: repo.connections,
    catalog: makeCatalog().catalog,
    probe: probe.probe,
    cipher: cipher.cipher,
    now: () => NOW,
  })
  return { repo, cipher, probe, test }
}

describe('probar la conexion guardada', () => {
  for (const status of ['ACTIVE', 'ERROR'] as const) {
    it(`R14: desde ${status}, prueba buena con la key guardada deja ACTIVE, lastCheckedAt y lastError vacio`, async () => {
      const { repo, probe, test } = setup({
        record: { status, lastError: status === 'ERROR' ? 'antes' : null, lastErrorAt: status === 'ERROR' ? EARLIER : null },
      })
      const result = await test(admin())

      expect(probe.call).toHaveBeenCalledWith({
        provider: 'GOOGLE',
        apiKey: OLD_API_KEY,
        models: ['modelo-recomendado-g'],
      })
      expect(result).toEqual({ status: 'tested', ok: true, elapsedMs: 1234 })
      expect(repo.row(CONNECTION_ID)).toMatchObject({
        status: 'ACTIVE',
        lastCheckedAt: NOW,
        lastError: null,
        lastErrorAt: null,
        keyUpdatedAt: EARLIER,
      })
    })

    it(`R14: desde ${status}, prueba fallida deja ERROR con el mensaje del proveedor y lastErrorAt`, async () => {
      const { repo, test } = setup({ probe: REJECTED_PROBE, record: { status } })
      const result = await test(admin())

      const message = 'Error con tu proveedor: la key fue rechazada. Revísala y vuelve a probar.'
      expect(result).toEqual({ status: 'tested', ok: false, message })
      expect(repo.row(CONNECTION_ID)).toMatchObject({
        status: 'ERROR',
        lastError: message,
        lastErrorAt: NOW,
        lastCheckedAt: EARLIER,
        keyUpdatedAt: EARLIER,
      })
      expect(JSON.stringify(result)).not.toContain(OLD_API_KEY)
    })
  }

  it('R14: descifra con el contexto de su propia fila y su empresa', async () => {
    const { cipher, test } = setup()
    await test(admin())
    expect(cipher.decrypt).toHaveBeenCalledWith(expect.any(String), {
      companyId: admin().companyId,
      recordId: CONNECTION_ID,
      field: 'api_key',
    })
  })

  it('R9: key guardada ilegible no llama al proveedor, deja ERROR con el texto fijo y relanza integration_secret_unreadable', async () => {
    const { repo, probe, test } = setup({ record: { apiKeyEnc: 'v1:valor-que-no-descifra' } })

    await expect(test(admin())).rejects.toBeInstanceOf(SecretUnreadableError)
    expect(probe.call).not.toHaveBeenCalled()
    expect(repo.row(CONNECTION_ID)).toMatchObject({
      status: 'ERROR',
      lastError: 'No se pudo leer la key guardada. Vuelve a escribirla.',
      lastErrorAt: NOW,
    })
  })

  it('R14: sin conexion (desconectada en otra pestana) devuelve not_connected sin probar ni escribir', async () => {
    const repo = makeRepository()
    const probe = makeProbe()
    const test = createTestSavedAiProvider({
      connections: repo.connections,
      catalog: makeCatalog().catalog,
      probe: probe.probe,
      cipher: makeCipher().cipher,
    })
    expect(await test(admin())).toEqual({ status: 'not_connected' })
    expect(probe.call).not.toHaveBeenCalled()
    expect(repo.update).not.toHaveBeenCalled()
  })
})

describe('probar la conexion guardada: el modelo en uso', () => {
  it('QT-291 R18: con eleccion, consulta solo la eleccion', async () => {
    const { probe, test } = setup({ record: { model: 'modelo-alto-g' } })
    await test(admin())
    expect(probe.call).toHaveBeenCalledTimes(1)
    expect(probe.call).toHaveBeenCalledWith({ provider: 'GOOGLE', apiKey: OLD_API_KEY, models: ['modelo-alto-g'] })
  })

  it('QT-291 R17, R18: sin eleccion, consulta el predeterminado leido del catalogo en ese momento', async () => {
    const cipher = makeCipher()
    const repo = makeRepository([storedConnection(cipher.seed)])
    const catalog = makeCatalog()
    const probe = makeProbe()
    const test = createTestSavedAiProvider({
      connections: repo.connections,
      catalog: catalog.catalog,
      probe: probe.probe,
      cipher: cipher.cipher,
      now: () => NOW,
    })
    await test(admin())
    const index = catalog.entries.findIndex((entry) => entry.code === 'GOOGLE')
    const current = catalog.entries[index]
    if (current === undefined) throw new Error('falta GOOGLE en el catalogo de prueba')
    catalog.entries[index] = {
      ...current,
      models: current.models.map((option) => ({ ...option, isDefault: option.modelId === 'modelo-bajo-g' })),
      defaultModel: 'modelo-bajo-g',
    }
    await test(admin())

    expect(probe.call.mock.calls.map((call) => call[0].models)).toEqual([['modelo-recomendado-g'], ['modelo-bajo-g']])
  })

  it('QT-291 R20: con el modelo no disponible devuelve «el modelo <modelo> ya no está disponible.»', async () => {
    const { test } = setup({
      record: { model: 'modelo-alto-g' },
      probe: { ok: false, failure: { kind: 'model_unavailable', httpStatus: 404, model: 'modelo-alto-g' } },
    })
    expect(await test(admin())).toEqual({
      status: 'tested',
      ok: false,
      message: 'Error con tu proveedor: el modelo modelo-alto-g ya no está disponible.',
    })
  })

  it('QT-291 R21: la eleccion no disponible deja ERROR, el modelo marcado y el aviso con «que elegiste»', async () => {
    const { repo, test } = setup({
      record: { model: 'modelo-alto-g' },
      probe: { ok: false, failure: { kind: 'model_unavailable', httpStatus: 404, model: 'modelo-alto-g' } },
    })
    await test(admin())
    expect(repo.row(CONNECTION_ID)).toMatchObject({
      status: 'ERROR',
      model: 'modelo-alto-g',
      unavailableModel: 'modelo-alto-g',
      lastError:
        'El modelo modelo-alto-g que elegiste ya no está disponible en Gemini. Elige otro modelo para volver a leer fórmulas y catálogos en PDF.',
      lastErrorAt: NOW,
      lastCheckedAt: EARLIER,
    })
  })

  it('QT-291 R21: el predeterminado no disponible deja el aviso sin «que elegiste»', async () => {
    const { repo, test } = setup({
      probe: { ok: false, failure: { kind: 'model_unavailable', httpStatus: 404, model: 'modelo-recomendado-g' } },
    })
    await test(admin())
    expect(repo.row(CONNECTION_ID)).toMatchObject({
      status: 'ERROR',
      model: null,
      unavailableModel: 'modelo-recomendado-g',
      lastError:
        'El modelo modelo-recomendado-g ya no está disponible en Gemini. Elige otro modelo para volver a leer fórmulas y catálogos en PDF.',
      lastErrorAt: NOW,
    })
  })

  it('QT-291 R21: otro fallo no marca ningun modelo', async () => {
    const { repo, test } = setup({ probe: REJECTED_PROBE })
    await test(admin())
    expect(repo.row(CONNECTION_ID)?.unavailableModel).toBeNull()
    expect(repo.update.mock.calls[0]?.[1]).not.toHaveProperty('unavailableModel')
  })

  it('QT-291 R22: la prueba buena vacia el modelo marcado', async () => {
    const { repo, test } = setup({
      record: { status: 'ERROR', unavailableModel: 'modelo-bajo-g', lastError: 'antes', lastErrorAt: EARLIER },
    })
    await test(admin())
    expect(repo.row(CONNECTION_ID)).toMatchObject({
      status: 'ACTIVE',
      unavailableModel: null,
      lastError: null,
      lastErrorAt: null,
      lastCheckedAt: NOW,
    })
  })
})
