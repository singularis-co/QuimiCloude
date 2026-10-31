// QT-304 R23, R24, R38-R40: salida estructurada validada con zod, sin herramientas y con respaldo.

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  createGenerateAgentObject,
  type AgentObjectRequest,
} from '@/lib/modules/integraciones/domain/generate-agent-object'
import type { ObjectGeneration } from '@/lib/modules/integraciones/ports/conversational-model'

import { pair } from './ai-model-pair-doubles'
import { COMPANY_KEY, USAGE, failure, makeCompany, makeModel } from './conversational-model-doubles'

const ROUTE = z.object({ ruta: z.enum(['pedidos', 'catalogo', 'humano']), motivo: z.string().trim() })
type Route = z.infer<typeof ROUTE>

function request(overrides: Partial<AgentObjectRequest<Route>> = {}): AgentObjectRequest<Route> {
  return {
    role: 'ROUTER',
    system: 'Clasifica el mensaje.',
    turns: [{ role: 'user', text: 'Quiero saber de mi pedido' }],
    schema: ROUTE,
    timeoutMs: 8_000,
    ...overrides,
  }
}

function setup(results: readonly ObjectGeneration<unknown>[], company: Parameters<typeof makeCompany>[0] = {}) {
  const ctx = makeCompany(company)
  const port = makeModel([], results)
  const generate = createGenerateAgentObject({ ...ctx.deps, model: port.model })
  return { ...ctx, ...port, generate }
}

const ok = (value: unknown): ObjectGeneration<unknown> => ({ status: 'ok', value, usage: USAGE })

describe('generateAgentObject', () => {
  it('R38: devuelve el valor que resulta de validar con el esquema de quien llama', async () => {
    const ctx = setup([ok({ ruta: 'pedidos', motivo: '  pregunta por su pedido  ' })])
    await expect(ctx.generate(ctx.companyId, request())).resolves.toEqual({
      status: 'ok',
      value: { ruta: 'pedidos', motivo: 'pregunta por su pedido' },
      usage: USAGE,
      model: 'modelo-recomendado-g',
      fallbackFrom: null,
    })
  })

  it('R40: llama al puerto con el par del rol, la key y el esquema, y sin herramientas', async () => {
    const ctx = setup([ok({ ruta: 'humano', motivo: 'x' })])
    const req = request()
    await ctx.generate(ctx.companyId, req)

    const input = ctx.generateObject.mock.calls[0]?.[0]
    expect(input).toEqual({
      provider: 'GOOGLE',
      model: 'modelo-recomendado-g',
      apiKey: COMPANY_KEY,
      system: req.system,
      turns: req.turns,
      schema: ROUTE,
      timeoutMs: req.timeoutMs,
    })
    expect(input).not.toHaveProperty('tools')
    expect(ctx.generateText).not.toHaveBeenCalled()
  })

  it('R39: si el adaptador devuelve algo que no cumple el esquema sale «salida invalida», sin el valor ni respaldo', async () => {
    const ctx = setup([ok({ ruta: 'otra cosa', motivo: 'texto del modelo' })])
    const result = await ctx.generate(ctx.companyId, request())
    expect(result).toEqual({ status: 'invalid_output', usage: USAGE, model: 'modelo-recomendado-g', fallbackFrom: null })
    expect(JSON.stringify(result)).not.toContain('texto del modelo')
    expect(ctx.generateObject).toHaveBeenCalledTimes(1)
  })

  it('R24: «salida invalida» del adaptador no pasa al respaldo', async () => {
    const ctx = setup([{ status: 'invalid_output', usage: null }])
    await expect(ctx.generate(ctx.companyId, request())).resolves.toMatchObject({ status: 'invalid_output', fallbackFrom: null })
    expect(ctx.generateObject).toHaveBeenCalledTimes(1)
  })

  it('R24: una key rechazada no pasa al respaldo', async () => {
    const ctx = setup([{ status: 'failed', failure: failure('rejected_key', 401) }])
    await expect(ctx.generate(ctx.companyId, request())).resolves.toMatchObject({ status: 'failed', model: 'modelo-recomendado-g' })
    expect(ctx.generateObject).toHaveBeenCalledTimes(1)
  })

  it('R23: sin respuesta del principal repite una vez con el respaldo y valida su valor', async () => {
    const ctx = setup([
      { status: 'failed', failure: failure('unreachable', null) },
      ok({ ruta: 'catalogo', motivo: ' busca un producto ' }),
    ])
    const result = await ctx.generate(ctx.companyId, request())
    expect(ctx.generateObject.mock.calls.map(([input]) => input.model)).toEqual([
      'modelo-recomendado-g',
      'modelo-alto-g',
    ])
    expect(result).toEqual({
      status: 'ok',
      value: { ruta: 'catalogo', motivo: 'busca un producto' },
      usage: USAGE,
      model: 'modelo-alto-g',
      fallbackFrom: failure('unreachable', null),
    })
  })

  it('R23, R40: sin herramientas, un respaldo que no las admite tambien se usa', async () => {
    const ctx = setup(
      [{ status: 'failed', failure: failure('unexpected', 529) }, ok({ ruta: 'humano', motivo: 'x' })],
      { pairs: [pair('GOOGLE', 'ROUTER', 'modelo-recomendado-g', 'modelo-bajo-g')] },
    )
    await expect(ctx.generate(ctx.companyId, request())).resolves.toMatchObject({ status: 'ok', model: 'modelo-bajo-g' })
  })

  it.each([
    ['sin conexion', { connection: null }, 'missing'],
    ['key ilegible', { connection: { apiKeyEnc: 'v1:no-autentica' } }, 'unreadable'],
    ['sin par', { pairs: [] }, 'no_model_pair'],
  ] as const)('%s devuelve su estado sin llamar ni tocar la conexion', async (_caso, company, status) => {
    const ctx = setup([], company)
    await expect(ctx.generate(ctx.companyId, request())).resolves.toEqual({ status })
    expect(ctx.generateObject).not.toHaveBeenCalled()
    expect(ctx.repository.update).not.toHaveBeenCalled()
  })

  it.each([
    ['plazo 0', { timeoutMs: 0 }],
    ['sin turnos', { turns: [] }],
  ])('%s lanza un error de programacion sin leer la conexion', async (_caso, overrides) => {
    const ctx = setup([])
    await expect(ctx.generate(ctx.companyId, request(overrides))).rejects.toThrow(Error)
    expect(ctx.repository.find).not.toHaveBeenCalled()
  })
})
