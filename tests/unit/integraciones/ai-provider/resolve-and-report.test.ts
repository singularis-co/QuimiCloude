import { describe, expect, it } from 'vitest'

import type { AiProviderConnectionRecord } from '@/lib/modules/integraciones/domain/ai-provider'
import type { AiProviderFailure } from '@/lib/modules/integraciones/domain/ai-provider-failure'
import { createReportAiProviderOutcome } from '@/lib/modules/integraciones/domain/report-ai-provider-outcome'
import {
  createGetAiProviderStatus,
  createResolveAiProviderForReading,
} from '@/lib/modules/integraciones/domain/resolve-ai-provider-for-reading'

import {
  COMPANY_ID,
  CONNECTION_ID,
  EARLIER,
  NOW,
  OLD_API_KEY,
  OTHER_COMPANY_ID,
  makeCatalog,
  makeCipher,
  makeRepository,
  storedConnection,
} from './ai-provider-doubles'

function setup(record: Partial<AiProviderConnectionRecord> | null = {}) {
  const cipher = makeCipher()
  const repo = makeRepository(record === null ? [] : [storedConnection(cipher.seed, record)])
  const catalog = makeCatalog()
  const deps = { connections: repo.connections, catalog: catalog.catalog, cipher: cipher.cipher, now: () => NOW }
  return {
    repo,
    cipher,
    catalog,
    resolve: createResolveAiProviderForReading(deps),
    status: createGetAiProviderStatus(deps),
    report: createReportAiProviderOutcome(deps),
  }
}

const REJECTED: AiProviderFailure = { kind: 'rejected_key', httpStatus: 401, model: null }
const QUOTA: AiProviderFailure = { kind: 'quota', httpStatus: 429, model: null }

describe('resolver el proveedor para leer un PDF', () => {
  it('R21: el uso receta toma el modelo de receta y el uso catalogo el de catalogo, con la key descifrada', async () => {
    const { resolve } = setup()

    expect(await resolve(COMPANY_ID, 'recipe')).toEqual({
      status: 'ready',
      provider: 'GOOGLE',
      model: 'modelo-receta-g',
      apiKey: OLD_API_KEY,
      connectionStatus: 'ACTIVE',
    })
    expect(await resolve(COMPANY_ID, 'catalog')).toMatchObject({ status: 'ready', model: 'modelo-catalogo-g' })
  })

  it('R6: el modelo se lee del catalogo en cada llamada: un cambio llega a la siguiente lectura', async () => {
    const { resolve, catalog } = setup()
    expect(await resolve(COMPANY_ID, 'recipe')).toMatchObject({ model: 'modelo-receta-g' })

    const index = catalog.entries.findIndex((entry) => entry.code === 'GOOGLE')
    const current = catalog.entries[index]
    if (current === undefined) throw new Error('falta GOOGLE en el catalogo de prueba')
    catalog.entries[index] = { ...current, recipeModel: 'modelo-receta-nuevo' }

    expect(await resolve(COMPANY_ID, 'recipe')).toMatchObject({ model: 'modelo-receta-nuevo' })
    expect(catalog.get).toHaveBeenCalledTimes(2)
  })

  it('R2: descifra con el contexto de la empresa del archivo y solo lee la conexion de esa empresa', async () => {
    const { resolve, cipher, repo } = setup()
    await resolve(COMPANY_ID, 'recipe')
    expect(repo.find).toHaveBeenCalledWith({ companyId: COMPANY_ID })
    expect(cipher.decrypt).toHaveBeenCalledWith(expect.any(String), {
      companyId: COMPANY_ID,
      recordId: CONNECTION_ID,
      field: 'api_key',
    })
    expect(await resolve(OTHER_COMPANY_ID, 'recipe')).toEqual({ status: 'missing' })
  })

  it('R28: una conexion en ERROR se resuelve igual, con su estado', async () => {
    const { resolve } = setup({ status: 'ERROR', lastError: 'antes', lastErrorAt: EARLIER })
    expect(await resolve(COMPANY_ID, 'catalog')).toMatchObject({ status: 'ready', connectionStatus: 'ERROR' })
  })

  it('R24: sin conexion devuelve missing sin descifrar ni escribir', async () => {
    const { resolve, cipher, repo } = setup(null)
    expect(await resolve(COMPANY_ID, 'recipe')).toEqual({ status: 'missing' })
    expect(cipher.decrypt).not.toHaveBeenCalled()
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('R9: key ilegible deja la conexion en ERROR con el texto fijo y devuelve unreadable sin key', async () => {
    const { resolve, repo } = setup({ apiKeyEnc: 'v1:no-descifra' })
    const result = await resolve(COMPANY_ID, 'recipe')

    expect(result).toEqual({ status: 'unreadable' })
    expect(repo.row(CONNECTION_ID)).toMatchObject({
      status: 'ERROR',
      lastError: 'No se pudo leer la key guardada. Vuelve a escribirla.',
      lastErrorAt: NOW,
    })
  })

  it('R9: un fallo que no es de key ilegible se propaga sin marcar la conexion', async () => {
    const { resolve, cipher, repo } = setup()
    cipher.decrypt.mockRejectedValueOnce(new Error('kms caido'))
    await expect(resolve(COMPANY_ID, 'recipe')).rejects.toThrow('kms caido')
    expect(repo.update).not.toHaveBeenCalled()
  })
})

describe('estado de la conexion sin descifrar', () => {
  it('R23: con conexion da proveedor y estado; sin ella, null; nunca descifra', async () => {
    const { status, cipher } = setup({ status: 'ERROR' })
    expect(await status(COMPANY_ID)).toEqual({ provider: 'GOOGLE', connectionStatus: 'ERROR' })
    expect(await status(OTHER_COMPANY_ID)).toBeNull()
    expect(cipher.decrypt).not.toHaveBeenCalled()
  })
})

describe('informar el desenlace de una lectura', () => {
  it('R25: key rechazada deja ERROR con el motivo compuesto, el nombre del proveedor y el codigo', async () => {
    const { report, repo } = setup()
    await report(COMPANY_ID, { kind: 'account_failure', failure: REJECTED })

    expect(repo.row(CONNECTION_ID)).toMatchObject({
      status: 'ERROR',
      lastError: 'La última lectura falló: Gemini rechazó la key (401).',
      lastErrorAt: NOW,
    })
  })

  it('R25: sin cuota deja ERROR con su motivo', async () => {
    const { report, repo } = setup()
    await report(COMPANY_ID, { kind: 'account_failure', failure: QUOTA })
    expect(repo.row(CONNECTION_ID)?.lastError).toBe(
      'La última lectura falló: Gemini indicó que tu cuenta no tiene cuota o saldo (429).',
    )
  })

  it('R26: un fallo que no es de cuenta no cambia la conexion', async () => {
    for (const failure of [
      { kind: 'unreachable', httpStatus: null, model: null },
      { kind: 'unexpected', httpStatus: 500, model: null },
      { kind: 'model_unavailable', httpStatus: 404, model: 'modelo-receta-g' },
    ] satisfies AiProviderFailure[]) {
      const { report, repo } = setup()
      await report(COMPANY_ID, { kind: 'account_failure', failure })
      expect(repo.update).not.toHaveBeenCalled()
    }
  })

  it('R27: una lectura buena con la conexion en ERROR la deja ACTIVE y vacia los errores', async () => {
    const { report, repo } = setup({ status: 'ERROR', lastError: 'antes', lastErrorAt: EARLIER })
    await report(COMPANY_ID, { kind: 'recovered' })

    expect(repo.row(CONNECTION_ID)).toMatchObject({
      status: 'ACTIVE',
      lastError: null,
      lastErrorAt: null,
      lastCheckedAt: EARLIER,
    })
  })

  it('R27: una lectura buena con la conexion ya ACTIVE no escribe', async () => {
    const { report, repo } = setup()
    await report(COMPANY_ID, { kind: 'recovered' })
    expect(repo.update).not.toHaveBeenCalled()
  })

  it('R24: sin conexion (desconectada a mitad de la lectura) no escribe nada', async () => {
    const { report, repo } = setup(null)
    await report(COMPANY_ID, { kind: 'account_failure', failure: REJECTED })
    await report(COMPANY_ID, { kind: 'recovered' })
    expect(repo.update).not.toHaveBeenCalled()
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('R2: solo marca la conexion de la empresa del archivo', async () => {
    const { report, repo } = setup()
    await report(OTHER_COMPANY_ID, { kind: 'account_failure', failure: REJECTED })
    expect(repo.row(CONNECTION_ID)?.status).toBe('ACTIVE')
  })
})
