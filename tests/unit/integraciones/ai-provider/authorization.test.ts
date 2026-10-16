import { describe, expect, it } from 'vitest'

import { hasConfigurePermission, type Actor } from '@/lib/modules/integraciones/domain/actor'
import { createDisconnectAiProvider } from '@/lib/modules/integraciones/domain/disconnect-ai-provider'
import { UnauthorizedError } from '@/lib/modules/integraciones/domain/errors'
import { createGetAiProviderConnection } from '@/lib/modules/integraciones/domain/get-ai-provider-connection'
import { createGetAiProviderReadiness } from '@/lib/modules/integraciones/domain/get-ai-provider-readiness'
import { createSaveAiProviderConnection } from '@/lib/modules/integraciones/domain/save-ai-provider-connection'
import { createTestAiProviderKey } from '@/lib/modules/integraciones/domain/test-ai-provider-key'
import { createTestSavedAiProvider } from '@/lib/modules/integraciones/domain/test-saved-ai-provider'

import {
  API_KEY,
  OTHER_COMPANY_ID,
  admin,
  makeCatalog,
  makeCipher,
  makeProbe,
  makeRandom,
  makeRepository,
  storedConnection,
} from './ai-provider-doubles'

const COMPANY_ID = '00000000-0000-4000-8000-0000000000aa'

function actor(permissions: readonly string[]): Actor {
  return { id: '00000000-0000-4000-8000-000000000001', companyId: COMPANY_ID, permissions }
}

describe('hasConfigurePermission', () => {
  it('R37: es verdadero con integraciones.modificar', () => {
    expect(hasConfigurePermission(actor(['documentos.modificar', 'integraciones.modificar']))).toBe(true)
  })

  it('R37: es falso sin el permiso, con otro permiso o sin actor, y no lanza', () => {
    expect(hasConfigurePermission(actor([]))).toBe(false)
    expect(hasConfigurePermission(actor(['documentos.modificar']))).toBe(false)
    expect(hasConfigurePermission(null)).toBe(false)
    expect(hasConfigurePermission(undefined)).toBe(false)
  })
})

function setup() {
  const cipher = makeCipher()
  const repo = makeRepository([storedConnection(cipher.seed)])
  const catalog = makeCatalog()
  const probe = makeProbe()
  const random = makeRandom()
  const deps = {
    connections: repo.connections,
    catalog: catalog.catalog,
    probe: probe.probe,
    cipher: cipher.cipher,
    random,
  }
  const input = { provider: 'GOOGLE', apiKey: API_KEY }
  const operations: Record<string, (actor: Actor | null | undefined) => Promise<unknown>> = {
    getAiProviderConnection: (actor) => createGetAiProviderConnection(deps)(actor),
    testAiProviderKey: (actor) => createTestAiProviderKey(deps)(input, actor),
    testSavedAiProvider: (actor) => createTestSavedAiProvider(deps)(actor),
    saveAiProviderConnection: (actor) => createSaveAiProviderConnection(deps)(input, actor),
    disconnectAiProvider: (actor) => createDisconnectAiProvider(deps)(actor),
  }
  const touched = () =>
    [
      repo.find,
      repo.create,
      repo.update,
      repo.remove,
      catalog.list,
      catalog.get,
      probe.call,
      cipher.encrypt,
      cipher.decrypt,
      random.newId,
    ].some((fn) => fn.mock.calls.length > 0)
  return { repo, operations, touched, deps }
}

const REJECTED_ACTORS: Record<string, Actor | null | undefined> = {
  'sin actor (null)': null,
  'sin actor (undefined)': undefined,
  'sin empresa': admin({ companyId: '' }),
  'sin permisos': admin({ permissions: [] }),
  'con otro permiso': admin({ permissions: ['documentos.modificar'] }),
}

describe('cada operacion de la conexion exige integraciones.modificar', () => {
  for (const name of [
    'getAiProviderConnection',
    'testAiProviderKey',
    'testSavedAiProvider',
    'saveAiProviderConnection',
    'disconnectAiProvider',
  ]) {
    for (const [label, actor] of Object.entries(REJECTED_ACTORS)) {
      it(`R1: ${name} rechaza ${label} con unauthorized sin tocar ningun puerto ni el proveedor`, async () => {
        const { operations, touched } = setup()
        const operation = operations[name]
        expect(operation).toBeDefined()
        await expect(operation?.(actor)).rejects.toBeInstanceOf(UnauthorizedError)
        expect(touched()).toBe(false)
      })
    }
  }

  it('R1: el rechazo llega antes de validar la entrada (entrada invalida y actor sin permiso da unauthorized)', async () => {
    const { deps, touched } = setup()
    await expect(
      createSaveAiProviderConnection(deps)({ provider: 'NO_EXISTE', apiKey: '' }, admin({ permissions: [] })),
    ).rejects.toBeInstanceOf(UnauthorizedError)
    await expect(
      createTestAiProviderKey(deps)({ provider: 'NO_EXISTE' }, null),
    ).rejects.toBeInstanceOf(UnauthorizedError)
    expect(touched()).toBe(false)
  })
})

describe('el ambito de la conexion es la empresa del actor', () => {
  it('R2: guardar con un companyId en la entrada escribe en la empresa del actor y el ambito de cada puerto es el suyo', async () => {
    const { deps, repo } = setup()
    const result = await createSaveAiProviderConnection(deps)(
      { provider: 'OPENAI', apiKey: API_KEY, companyId: OTHER_COMPANY_ID },
      admin(),
    )

    expect(result.status).toBe('saved')
    for (const call of [...repo.find.mock.calls, ...repo.update.mock.calls, ...repo.create.mock.calls]) {
      expect(call.at(-1)).toEqual({ companyId: admin().companyId })
    }
    expect(repo.rows().every((row) => row.companyId === admin().companyId)).toBe(true)
  })

  it('R2: la conexion de otra empresa no se ve, no se prueba y no se borra', async () => {
    const cipher = makeCipher()
    const repo = makeRepository([storedConnection(cipher.seed, { companyId: OTHER_COMPANY_ID })])
    const deps = {
      connections: repo.connections,
      catalog: makeCatalog().catalog,
      probe: makeProbe().probe,
      cipher: cipher.cipher,
    }

    expect((await createGetAiProviderConnection(deps)(admin())).connection).toBeNull()
    expect(await createTestSavedAiProvider(deps)(admin())).toEqual({ status: 'not_connected' })
    await createDisconnectAiProvider(deps)(admin())
    expect(repo.rows()).toHaveLength(1)
  })
})

describe('getAiProviderReadiness solo exige un actor con empresa', () => {
  it('R37: sin integraciones.modificar responde, con canConfigure falso', async () => {
    const { deps } = setup()
    const readiness = await createGetAiProviderReadiness(deps)(admin({ permissions: ['documentos.modificar'] }))
    expect(readiness).toEqual({ configured: true, canConfigure: false })
  })

  it('R37: con integraciones.modificar y sin conexion, configured falso y canConfigure verdadero', async () => {
    const repo = makeRepository()
    const readiness = await createGetAiProviderReadiness({ connections: repo.connections })(admin())
    expect(readiness).toEqual({ configured: false, canConfigure: true })
  })

  it('R2: sin actor o sin empresa da unauthorized sin leer la conexion', async () => {
    const repo = makeRepository()
    const readiness = createGetAiProviderReadiness({ connections: repo.connections })
    await expect(readiness(null)).rejects.toBeInstanceOf(UnauthorizedError)
    await expect(readiness(undefined)).rejects.toBeInstanceOf(UnauthorizedError)
    await expect(readiness(admin({ companyId: '' }))).rejects.toBeInstanceOf(UnauthorizedError)
    expect(repo.find).not.toHaveBeenCalled()
  })

  it('R2: solo mira la conexion de la empresa del actor', async () => {
    const cipher = makeCipher()
    const repo = makeRepository([storedConnection(cipher.seed, { companyId: OTHER_COMPANY_ID })])
    const readiness = await createGetAiProviderReadiness({ connections: repo.connections })(admin())
    expect(readiness.configured).toBe(false)
    expect(repo.find).toHaveBeenCalledWith({ companyId: admin().companyId })
  })
})
