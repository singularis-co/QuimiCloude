import { describe, expect, it } from 'vitest'

import type { AiProviderConnectionRecord } from '@/lib/modules/integraciones/domain/ai-provider'
import type { AiProviderProbeResult } from '@/lib/modules/integraciones/domain/ai-provider-failure'
import { ValidationError } from '@/lib/modules/integraciones/domain/errors'
import { createSaveAiProviderConnection } from '@/lib/modules/integraciones/domain/save-ai-provider-connection'
import {
  AiProviderConnectionRaceError,
  type NewAiProviderConnectionRow,
} from '@/lib/modules/integraciones/ports/ai-provider-connection-repository'

import {
  ACTOR_ID,
  API_KEY,
  COMPANY_ID,
  CONNECTION_ID,
  EARLIER,
  NEW_CONNECTION_ID,
  NOW,
  OLD_API_KEY,
  REJECTED_PROBE,
  admin,
  makeCatalog,
  makeCipher,
  makeProbe,
  makeRandom,
  makeRepository,
  storedConnection,
} from './ai-provider-doubles'

function setup(options: { probe?: AiProviderProbeResult; existing?: Partial<AiProviderConnectionRecord> | null } = {}) {
  const cipher = makeCipher()
  const initial = options.existing === null ? [] : [storedConnection(cipher.seed, options.existing ?? {})]
  const repo = makeRepository(initial)
  const probe = makeProbe(options.probe)
  const random = makeRandom()
  const deps = {
    connections: repo.connections,
    catalog: makeCatalog().catalog,
    probe: probe.probe,
    cipher: cipher.cipher,
    random,
    now: () => NOW,
  }
  return { repo, cipher, probe, random, deps, save: createSaveAiProviderConnection(deps) }
}

describe('guardar y conectar', () => {
  it('R15: prueba la key antes de escribir o cifrar nada', async () => {
    const order: string[] = []
    const { repo, probe, cipher, save } = setup({ existing: null })
    probe.call.mockImplementation(async () => {
      order.push('probe')
      return { ok: true, elapsedMs: 10 }
    })
    cipher.encrypt.mockImplementationOnce(async () => {
      order.push('encrypt')
      return 'v1:x'
    })
    repo.create.mockImplementationOnce(async (row: NewAiProviderConnectionRow) => {
      order.push('create')
      return { ...row, companyId: COMPANY_ID }
    })

    await save({ provider: 'OPENAI', apiKey: API_KEY }, admin())
    expect(order).toEqual(['probe', 'encrypt', 'create'])
    expect(probe.call).toHaveBeenCalledWith({
      provider: 'OPENAI',
      apiKey: API_KEY,
      models: ['modelo-receta-o', 'modelo-catalogo-o'],
    })
  })

  it('R16: prueba fallida sin conexion previa no crea nada y devuelve el mensaje del proveedor', async () => {
    const { repo, cipher, save } = setup({ probe: REJECTED_PROBE, existing: null })
    const result = await save({ provider: 'GOOGLE', apiKey: API_KEY }, admin())

    expect(result).toEqual({
      status: 'test_failed',
      message: 'Error con tu proveedor: la key fue rechazada. Revísala y vuelve a probar.',
    })
    expect(repo.create).not.toHaveBeenCalled()
    expect(repo.update).not.toHaveBeenCalled()
    expect(cipher.encrypt).not.toHaveBeenCalled()
    expect(repo.rows()).toEqual([])
  })

  it('R16: prueba fallida con conexion previa la deja intacta: proveedor, key, estado y fechas', async () => {
    const { repo, save } = setup({
      probe: REJECTED_PROBE,
      existing: { status: 'ERROR', lastError: 'antes', lastErrorAt: EARLIER },
    })
    const before = repo.row(CONNECTION_ID)
    await save({ provider: 'OPENAI', apiKey: API_KEY }, admin())

    expect(repo.row(CONNECTION_ID)).toEqual(before)
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('R17: sin conexion previa crea una ACTIVE con lastCheckedAt y keyUpdatedAt de la prueba y errores vacios', async () => {
    const { repo, save } = setup({ existing: null })
    const result = await save({ provider: 'ANTHROPIC', apiKey: API_KEY }, admin())

    expect(repo.create).toHaveBeenCalledTimes(1)
    const row = repo.create.mock.calls[0]?.[0]
    expect(row).toMatchObject({
      id: NEW_CONNECTION_ID,
      provider: 'ANTHROPIC',
      status: 'ACTIVE',
      lastError: null,
      lastErrorAt: null,
      lastCheckedAt: NOW,
      keyUpdatedAt: NOW,
      createdById: ACTOR_ID,
      updatedById: ACTOR_ID,
    })
    expect(result).toEqual({
      status: 'saved',
      connection: {
        provider: 'ANTHROPIC',
        providerName: 'Claude',
        recipeModel: 'modelo-receta-a',
        catalogModel: 'modelo-catalogo-a',
        status: 'ACTIVE',
        lastError: null,
        lastErrorAt: null,
        lastCheckedAt: NOW.toISOString(),
        keyUpdatedAt: NOW.toISOString(),
      },
    })
  })

  it('R17: con conexion previa en ERROR reemplaza proveedor y key en la misma fila y la deja ACTIVE', async () => {
    const { repo, cipher, random, save } = setup({
      existing: { status: 'ERROR', lastError: 'antes', lastErrorAt: EARLIER },
    })
    await save({ provider: 'OPENROUTER', apiKey: API_KEY }, admin())

    expect(repo.create).not.toHaveBeenCalled()
    expect(random.newId).not.toHaveBeenCalled()
    const row = repo.row(CONNECTION_ID)
    expect(row).toMatchObject({
      provider: 'OPENROUTER',
      status: 'ACTIVE',
      lastError: null,
      lastErrorAt: null,
      lastCheckedAt: NOW,
      keyUpdatedAt: NOW,
    })
    expect(cipher.plaintextOf(row?.apiKeyEnc ?? '')).toBe(API_KEY)
    expect(repo.update.mock.calls[0]?.[1]).toMatchObject({ updatedById: ACTOR_ID })
    expect(repo.update.mock.calls[0]?.[1]).not.toHaveProperty('createdById')
    expect(repo.rows()).toHaveLength(1)
  })

  it('R7: cifra la key con el contexto exacto { empresa, id de la conexion, api_key } y solo el cifrado llega al repositorio', async () => {
    const { repo, cipher, save } = setup({ existing: null })
    const result = await save({ provider: 'GOOGLE', apiKey: API_KEY }, admin())

    expect(cipher.encrypt).toHaveBeenCalledWith(API_KEY, {
      companyId: COMPANY_ID,
      recordId: NEW_CONNECTION_ID,
      field: 'api_key',
    })
    const row = repo.create.mock.calls[0]?.[0]
    expect(JSON.stringify(row)).not.toContain(API_KEY)
    expect(row?.apiKeyEnc).toMatch(/^v1:/)
    expect(JSON.stringify(result)).not.toContain(API_KEY)
    expect(JSON.stringify(result)).not.toContain(row?.apiKeyEnc ?? '-')
  })

  it('R7: al reemplazar, cifra con el id de la fila existente', async () => {
    const { cipher, save } = setup()
    await save({ provider: 'GOOGLE', apiKey: API_KEY }, admin())
    expect(cipher.encrypt).toHaveBeenCalledWith(API_KEY, {
      companyId: COMPANY_ID,
      recordId: CONNECTION_ID,
      field: 'api_key',
    })
  })

  it('R18: entrada invalida da invalid_input sin probar ni escribir', async () => {
    for (const input of [
      { provider: 'MISTRAL', apiKey: API_KEY },
      { provider: 'GOOGLE', apiKey: '   ' },
      { provider: 'GOOGLE', apiKey: 'k'.repeat(1025) },
    ]) {
      const { repo, probe, save } = setup({ existing: null })
      await expect(save(input, admin())).rejects.toBeInstanceOf(ValidationError)
      expect(probe.call).not.toHaveBeenCalled()
      expect(repo.find).not.toHaveBeenCalled()
      expect(repo.create).not.toHaveBeenCalled()
    }
  })

  it('R19: si otro guardado gana la carrera al crear, la segunda vuelta reemplaza la fila ganadora y cifra con su id', async () => {
    const { repo, cipher, save } = setup({ existing: null })
    const WINNER_ID = '00000000-0000-4000-8000-0000000000f1'
    repo.create.mockImplementationOnce(async () => {
      repo.insert(storedConnection(cipher.seed, { id: WINNER_ID, provider: 'ANTHROPIC' }))
      throw new AiProviderConnectionRaceError()
    })

    const result = await save({ provider: 'OPENAI', apiKey: API_KEY }, admin())

    expect(result.status).toBe('saved')
    expect(repo.rows()).toHaveLength(1)
    const row = repo.row(WINNER_ID)
    expect(row).toMatchObject({ provider: 'OPENAI', status: 'ACTIVE', keyUpdatedAt: NOW })
    expect(cipher.encrypt).toHaveBeenLastCalledWith(API_KEY, {
      companyId: COMPANY_ID,
      recordId: WINNER_ID,
      field: 'api_key',
    })
    expect(await cipher.cipher.decrypt(row?.apiKeyEnc ?? '', {
      companyId: COMPANY_ID,
      recordId: WINNER_ID,
      field: 'api_key',
    })).toBe(API_KEY)
  })

  it('R19: solo repite una vez; una segunda carrera se propaga', async () => {
    const { repo, save } = setup({ existing: null })
    repo.create.mockRejectedValue(new AiProviderConnectionRaceError())

    await expect(save({ provider: 'OPENAI', apiKey: API_KEY }, admin())).rejects.toBeInstanceOf(
      AiProviderConnectionRaceError,
    )
    expect(repo.create).toHaveBeenCalledTimes(2)
  })

  it('R19: cualquier otro error del alta se propaga sin segunda vuelta', async () => {
    const { repo, save } = setup({ existing: null })
    const boom = new Error('base caida')
    repo.create.mockRejectedValueOnce(boom)

    await expect(save({ provider: 'OPENAI', apiKey: API_KEY }, admin())).rejects.toBe(boom)
    expect(repo.create).toHaveBeenCalledTimes(1)
  })

  it('R17: conserva la key anterior solo si la prueba falla; si es buena la sustituye', async () => {
    const { repo, cipher, save } = setup()
    await save({ provider: 'GOOGLE', apiKey: API_KEY }, admin())
    expect(cipher.plaintextOf(repo.row(CONNECTION_ID)?.apiKeyEnc ?? '')).toBe(API_KEY)
    expect(cipher.plaintextOf(repo.row(CONNECTION_ID)?.apiKeyEnc ?? '')).not.toBe(OLD_API_KEY)
  })
})
