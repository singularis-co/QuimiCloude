// QT-304 R10-R13, R15: guardar un par de modelos de la plataforma. Los puertos son dobles en
// memoria; la conexion, la sonda y el cifrador se pasan como espias que fallan si se llaman.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it, vi } from 'vitest'

import { UnauthorizedError } from '@/lib/modules/identity'
import { ValidationError } from '@/lib/modules/integraciones/domain/errors'
import {
  createSaveAiModelPair,
  type SaveAiModelPairDeps,
} from '@/lib/modules/integraciones/domain/save-ai-model-pair'

import { makeCatalog } from '../ai-provider/ai-provider-doubles'
import { MAESTRO_ID, SAVED_AT, SEEDED_AT, maestro, makePairs, pair } from './ai-model-pair-doubles'

const VALID = {
  provider: 'GOOGLE',
  role: 'ROUTER',
  primaryModelId: 'modelo-recomendado-g',
  fallbackModelId: 'modelo-alto-g',
} as const

function prohibido(nombre: string) {
  return vi.fn(() => {
    throw new Error(`${nombre} no debe llamarse`)
  })
}

function setup() {
  const catalog = makeCatalog()
  const pairs = makePairs([
    pair('GOOGLE', 'AGENT', 'modelo-alto-g', 'modelo-recomendado-g'),
    pair('GOOGLE', 'ROUTER', 'modelo-recomendado-g', 'modelo-alto-g'),
    pair('ANTHROPIC', 'ROUTER', 'modelo-recomendado-a', 'modelo-alto-a'),
  ])
  const forbidden = {
    probe: { probe: prohibido('probe.probe') },
    cipher: { encrypt: prohibido('cipher.encrypt'), decrypt: prohibido('cipher.decrypt') },
    connections: { find: prohibido('connections.find') },
  }
  const deps = { catalog: catalog.catalog, pairs: pairs.pairs, ...forbidden } as SaveAiModelPairDeps
  return { catalog, pairs, forbidden, save: createSaveAiModelPair(deps) }
}

function nadaSeToco(ctx: ReturnType<typeof setup>) {
  expect(ctx.catalog.get).not.toHaveBeenCalled()
  expect(ctx.catalog.list).not.toHaveBeenCalled()
  expect(ctx.pairs.save).not.toHaveBeenCalled()
  expect(ctx.pairs.list).not.toHaveBeenCalled()
  expect(ctx.pairs.get).not.toHaveBeenCalled()
}

describe('saveAiModelPair: autorizacion (R13)', () => {
  it.each([
    ['actor nulo', null],
    ['actor indefinido', undefined],
    ['sin permisos', maestro([])],
    ['solo con el permiso de consulta', maestro(['modelos_ia.consultar'])],
    ['con un permiso de empresa', maestro(['integraciones.modificar'])],
  ])('R13: %s se rechaza como no autorizado antes de validar y de tocar un puerto', async (_caso, actor) => {
    const ctx = setup()
    // Entrada invalida a proposito: si la validacion fuera primero, el error seria otro.
    await expect(ctx.save({ provider: 'NADA' }, actor)).rejects.toBeInstanceOf(UnauthorizedError)
    nadaSeToco(ctx)
  })

  it('R13: no exige empresa al actor (el Maestro no tiene)', async () => {
    const ctx = setup()
    const actor = maestro(['modelos_ia.modificar'])
    expect(actor).not.toHaveProperty('companyId')
    await expect(ctx.save(VALID, actor)).resolves.toMatchObject({ status: 'saved' })
  })
})

describe('saveAiModelPair: validacion (R10, R11)', () => {
  it.each([
    ['proveedor desconocido', { ...VALID, provider: 'MISTRAL' }],
    ['rol desconocido', { ...VALID, role: 'EMBEDDINGS' }],
    ['principal vacio tras recortar', { ...VALID, primaryModelId: '   ' }],
    ['respaldo ausente', { provider: 'GOOGLE', role: 'AGENT', primaryModelId: 'modelo-alto-g' }],
    ['no es un objeto', 'GOOGLE'],
  ])('R10: %s es error de validacion sin tocar puertos', async (_caso, input) => {
    const ctx = setup()
    await expect(ctx.save(input, maestro())).rejects.toBeInstanceOf(ValidationError)
    nadaSeToco(ctx)
  })

  it.each([
    ['modelo de otro proveedor', { ...VALID, role: 'AGENT', primaryModelId: 'modelo-alto-a' }],
    ['modelo fuera del catalogo', { ...VALID, fallbackModelId: 'no-existe' }],
    ['principal y respaldo iguales', { ...VALID, fallbackModelId: 'modelo-recomendado-g' }],
    ['principal sin herramientas', { ...VALID, role: 'AGENT', primaryModelId: 'modelo-bajo-g' }],
    ['respaldo sin herramientas', { ...VALID, fallbackModelId: 'modelo-bajo-g' }],
    ['principal del enrutador no economico', { ...VALID, primaryModelId: 'modelo-alto-g', fallbackModelId: 'modelo-recomendado-g' }],
  ])('R10: %s se rechaza con error de validacion y no escribe', async (_caso, input) => {
    const ctx = setup()
    const antes = ctx.pairs.rows()
    await expect(ctx.save(input, maestro())).rejects.toBeInstanceOf(ValidationError)
    expect(ctx.pairs.save).not.toHaveBeenCalled()
    expect(ctx.pairs.rows()).toEqual(antes)
  })

  it('R10: un proveedor que el catalogo no trae es error de validacion y no escribe', async () => {
    const ctx = setup()
    ctx.catalog.entries.splice(0, ctx.catalog.entries.length)
    await expect(ctx.save(VALID, maestro())).rejects.toBeInstanceOf(ValidationError)
    expect(ctx.pairs.save).not.toHaveBeenCalled()
  })

  it('R11: el respaldo del enrutador no economico se acepta', async () => {
    const ctx = setup()
    // `modelo-alto-g` admite herramientas y no es economico.
    await expect(ctx.save(VALID, maestro())).resolves.toMatchObject({ status: 'saved' })
  })

  it('R10: los identificadores llegan recortados al repositorio', async () => {
    const ctx = setup()
    await ctx.save({ ...VALID, primaryModelId: '  modelo-recomendado-g ', fallbackModelId: 'modelo-alto-g  ' }, maestro())
    expect(ctx.pairs.save).toHaveBeenCalledWith(VALID, MAESTRO_ID)
  })
})

describe('saveAiModelPair: guardado (R12, R15)', () => {
  it('R12: reemplaza el par de ese proveedor y rol con autor y hora, y deja los demas igual', async () => {
    const ctx = setup()
    const input = { provider: 'GOOGLE', role: 'AGENT', primaryModelId: 'modelo-recomendado-g', fallbackModelId: 'modelo-alto-g' }
    const result = await ctx.save(input, maestro())

    expect(result).toEqual({
      status: 'saved',
      pair: { ...input, updatedBy: MAESTRO_ID, updatedAt: SAVED_AT },
    })
    expect(ctx.pairs.save).toHaveBeenCalledTimes(1)
    const rows = ctx.pairs.rows()
    expect(rows).toHaveLength(3)
    expect(rows.filter((row) => row.updatedAt === SEEDED_AT).map((row) => `${row.provider}:${row.role}`).sort()).toEqual([
      'ANTHROPIC:ROUTER',
      'GOOGLE:ROUTER',
    ])
  })

  it('R12: guardar un par que aun no existe lo crea', async () => {
    const ctx = setup()
    const input = { provider: 'OPENAI', role: 'AGENT', primaryModelId: 'modelo-alto-o', fallbackModelId: 'modelo-recomendado-o' }
    await ctx.save(input, maestro())
    expect(ctx.pairs.rows()).toHaveLength(4)
  })

  it('R15: no consulta a ningun proveedor, no descifra ninguna key y no lee conexiones', async () => {
    const ctx = setup()
    await ctx.save(VALID, maestro())
    expect(ctx.forbidden.probe.probe).not.toHaveBeenCalled()
    expect(ctx.forbidden.cipher.decrypt).not.toHaveBeenCalled()
    expect(ctx.forbidden.cipher.encrypt).not.toHaveBeenCalled()
    expect(ctx.forbidden.connections.find).not.toHaveBeenCalled()
  })

  it('R15: el caso de uso no conoce la sonda, el cifrador ni las conexiones', () => {
    const fuente = readFileSync(
      fileURLToPath(new URL('../../../../lib/modules/integraciones/domain/save-ai-model-pair.ts', import.meta.url)),
      'utf8',
    )
    expect(fuente).not.toMatch(/ai-provider-probe|secret-cipher|ai-provider-connection-repository|\bdecrypt\b|\bprobe\b/)
  })
})
