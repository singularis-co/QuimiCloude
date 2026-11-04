// QT-304 R13-R15: leer los pares de modelos de la plataforma, por proveedor del catalogo.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it, vi } from 'vitest'

import { UnauthorizedError } from '@/lib/modules/identity'
import {
  createGetAiModelPairs,
  type GetAiModelPairsDeps,
} from '@/lib/modules/integraciones/domain/get-ai-model-pairs'

import { CATALOG, makeCatalog } from '../ai-provider/ai-provider-doubles'
import { maestro, makePairs, pair } from './ai-model-pair-doubles'

function prohibido(nombre: string) {
  return vi.fn(() => {
    throw new Error(`${nombre} no debe llamarse`)
  })
}

const GOOGLE_AGENT = pair('GOOGLE', 'AGENT', 'modelo-alto-g', 'modelo-recomendado-g')
const GOOGLE_ROUTER = pair('GOOGLE', 'ROUTER', 'modelo-recomendado-g', 'modelo-alto-g')
const ANTHROPIC_ROUTER = pair('ANTHROPIC', 'ROUTER', 'modelo-recomendado-a', 'modelo-alto-a')

function setup() {
  const catalog = makeCatalog()
  const pairs = makePairs([GOOGLE_ROUTER, ANTHROPIC_ROUTER, GOOGLE_AGENT])
  const forbidden = {
    probe: { probe: prohibido('probe.probe') },
    cipher: { encrypt: prohibido('cipher.encrypt'), decrypt: prohibido('cipher.decrypt') },
    connections: { find: prohibido('connections.find') },
  }
  const deps = { catalog: catalog.catalog, pairs: pairs.pairs, ...forbidden } as GetAiModelPairsDeps
  return { catalog, pairs, forbidden, get: createGetAiModelPairs(deps) }
}

describe('getAiModelPairs', () => {
  it.each([
    ['actor nulo', null],
    ['actor indefinido', undefined],
    ['sin permisos', maestro([])],
    ['con un permiso de empresa', maestro(['integraciones.modificar', 'agente_ia.consultar'])],
  ])('R13: %s se rechaza como no autorizado sin tocar puertos', async (_caso, actor) => {
    const ctx = setup()
    await expect(ctx.get(actor)).rejects.toBeInstanceOf(UnauthorizedError)
    expect(ctx.catalog.list).not.toHaveBeenCalled()
    expect(ctx.pairs.list).not.toHaveBeenCalled()
  })

  it('R13: basta con el permiso de consulta y no exige empresa', async () => {
    const ctx = setup()
    await expect(ctx.get(maestro(['modelos_ia.consultar']))).resolves.toHaveProperty('providers')
  })

  it('R14: devuelve cada proveedor del catalogo, en su orden, con sus dos pares o «sin par» y sus modelos con las marcas', async () => {
    const ctx = setup()
    const { providers } = await ctx.get(maestro())

    expect(providers.map((provider) => provider.code)).toEqual(['ANTHROPIC', 'GOOGLE', 'OPENAI', 'OPENROUTER'])
    const [anthropic, google, openai] = providers
    expect(google).toEqual({
      code: 'GOOGLE',
      name: 'Gemini',
      models: CATALOG[1]?.models,
      agent: GOOGLE_AGENT,
      router: GOOGLE_ROUTER,
    })
    expect(anthropic?.agent).toBeNull()
    expect(anthropic?.router).toEqual(ANTHROPIC_ROUTER)
    expect(openai?.agent).toBeNull()
    expect(openai?.router).toBeNull()
    for (const model of google?.models ?? []) {
      expect(Object.keys(model).sort()).toEqual(['isDefault', 'isEconomic', 'modelId', 'supportsTools'])
    }
  })

  it('R14: un par de un proveedor que el catalogo no trae no sale', async () => {
    const ctx = setup()
    ctx.catalog.entries.splice(1, 1) // sin GOOGLE
    const { providers } = await ctx.get(maestro())
    expect(providers.map((provider) => provider.code)).toEqual(['ANTHROPIC', 'OPENAI', 'OPENROUTER'])
  })

  it('R15: no consulta a ningun proveedor, no descifra ninguna key y no lee conexiones', async () => {
    const ctx = setup()
    await ctx.get(maestro())
    expect(ctx.forbidden.probe.probe).not.toHaveBeenCalled()
    expect(ctx.forbidden.cipher.decrypt).not.toHaveBeenCalled()
    expect(ctx.forbidden.connections.find).not.toHaveBeenCalled()
  })

  it('R15: el caso de uso no conoce la sonda, el cifrador ni las conexiones', () => {
    const fuente = readFileSync(
      fileURLToPath(new URL('../../../../lib/modules/integraciones/domain/get-ai-model-pairs.ts', import.meta.url)),
      'utf8',
    )
    expect(fuente).not.toMatch(/ai-provider-probe|secret-cipher|ai-provider-connection-repository|\bdecrypt\b/)
  })
})
