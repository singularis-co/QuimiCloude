// QT-304 R18-R28, R34, R37, R46: generar texto con herramientas para una empresa, con el par de
// plataforma de su proveedor y el respaldo de D9, sobre un puerto de modelo simulado.

import { describe, expect, it } from 'vitest'

import type { AiProviderFailure } from '@/lib/modules/integraciones/domain/ai-provider-failure'
import {
  createGenerateAgentText,
  type AgentTextRequest,
} from '@/lib/modules/integraciones/domain/generate-agent-text'
import type { TextGeneration } from '@/lib/modules/integraciones/ports/conversational-model'

import { COMPANY_ID } from '../ai-provider/ai-provider-doubles'
import { pair } from './ai-model-pair-doubles'
import {
  COMPANY_KEY,
  USAGE,
  failure,
  makeCompany,
  makeModel,
  textFailed,
  textOk,
  tool,
} from './conversational-model-doubles'

function request(overrides: Partial<AgentTextRequest> = {}): AgentTextRequest {
  return {
    role: 'AGENT',
    system: 'Eres el asistente de la empresa.',
    turns: [{ role: 'user', text: 'Donde esta mi pedido 123?' }],
    tools: [tool()],
    maxSteps: 4,
    timeoutMs: 20_000,
    ...overrides,
  }
}

function setup(
  results: readonly TextGeneration[] = [textOk()],
  company: Parameters<typeof makeCompany>[0] = {},
) {
  const ctx = makeCompany(company)
  const port = makeModel(results)
  const generate = createGenerateAgentText({ ...ctx.deps, model: port.model })
  return { ...ctx, ...port, generate }
}

describe('generateAgentText: resolucion del modelo', () => {
  it('R18: usa el par del rol del proveedor de la conexion y su key; el modelo de la conexion no influye', async () => {
    const ctx = setup([textOk(), textOk()])
    const req = request()

    await ctx.generate(ctx.companyId, req)
    await ctx.generate(ctx.companyId, request({ role: 'ROUTER' }))

    expect(ctx.generateText).toHaveBeenNthCalledWith(1, {
      provider: 'GOOGLE',
      model: 'modelo-alto-g',
      apiKey: COMPANY_KEY,
      system: req.system,
      turns: req.turns,
      tools: req.tools,
      maxSteps: req.maxSteps,
      timeoutMs: req.timeoutMs,
    })
    expect(ctx.generateText.mock.calls[1]?.[0]).toMatchObject({ provider: 'GOOGLE', model: 'modelo-recomendado-g' })
    expect(ctx.pairs.get.mock.calls).toEqual([
      ['GOOGLE', 'AGENT'],
      ['GOOGLE', 'ROUTER'],
    ])
    expect(ctx.generateText.mock.calls.map(([input]) => input.model)).not.toContain('modelo-bajo-g')
  })

  it('R18: con una conexion de otro proveedor usa el par de ese proveedor', async () => {
    const ctx = setup([textOk()], { connection: { provider: 'ANTHROPIC', model: null } })
    await ctx.generate(ctx.companyId, request())
    expect(ctx.generateText.mock.calls[0]?.[0]).toMatchObject({ provider: 'ANTHROPIC', model: 'modelo-alto-a' })
  })

  it('R19: sin par para el proveedor y el rol devuelve «sin par de modelos» sin llamar al proveedor', async () => {
    const ctx = setup([], { pairs: [pair('GOOGLE', 'ROUTER', 'modelo-recomendado-g', 'modelo-alto-g')] })
    await expect(ctx.generate(ctx.companyId, request())).resolves.toEqual({ status: 'no_model_pair' })
    expect(ctx.generateText).not.toHaveBeenCalled()
  })

  it('R20: sin conexion devuelve «sin conexion» sin llamar al proveedor', async () => {
    const ctx = setup([], { connection: null })
    await expect(ctx.generate(ctx.companyId, request())).resolves.toEqual({ status: 'missing' })
    expect(ctx.generateText).not.toHaveBeenCalled()
  })

  it('R20, R46: con la key ilegible devuelve «key ilegible» sin llamar al proveedor ni marcar la conexion', async () => {
    const ctx = setup([], { connection: { apiKeyEnc: 'v1:no-autentica' } })
    await expect(ctx.generate(ctx.companyId, request())).resolves.toEqual({ status: 'unreadable' })
    expect(ctx.generateText).not.toHaveBeenCalled()
    expect(ctx.repository.update).not.toHaveBeenCalled()
    expect(ctx.repository.rows()[0]?.status).toBe('ACTIVE')
  })

  it('R21: con herramientas y un principal sin herramientas devuelve «modelo sin herramientas» sin llamar', async () => {
    const ctx = setup([], { pairs: [pair('GOOGLE', 'AGENT', 'modelo-bajo-g', 'modelo-alto-g')] })
    await expect(ctx.generate(ctx.companyId, request())).resolves.toEqual({ status: 'model_without_tools' })
    expect(ctx.generateText).not.toHaveBeenCalled()
  })

  it('R21: sin herramientas el principal sin herramientas si genera', async () => {
    const ctx = setup([textOk()], { pairs: [pair('GOOGLE', 'AGENT', 'modelo-bajo-g', 'modelo-alto-g')] })
    await expect(ctx.generate(ctx.companyId, request({ tools: [] }))).resolves.toMatchObject({
      status: 'ok',
      model: 'modelo-bajo-g',
    })
  })

  it('R22: la key en claro no aparece en ningun resultado', async () => {
    const outcomes = [
      await setup([textOk()]).generate(COMPANY_ID, request()),
      await setup([textFailed(failure('rejected_key', 401))]).generate(COMPANY_ID, request()),
      await setup([textFailed(failure('unreachable', null)), textFailed(failure('quota', 429))]).generate(
        COMPANY_ID,
        request(),
      ),
      await setup([], { pairs: [] }).generate(COMPANY_ID, request()),
      await setup([], { pairs: [pair('GOOGLE', 'AGENT', 'modelo-bajo-g', 'modelo-alto-g')] }).generate(
        COMPANY_ID,
        request(),
      ),
    ]
    for (const outcome of outcomes) expect(JSON.stringify(outcome)).not.toContain(COMPANY_KEY)
  })

  it('R22: la key en claro no aparece en el error de una peticion mal formada', async () => {
    const ctx = setup()
    const error = await ctx.generate(ctx.companyId, request({ maxSteps: 0 })).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(Error)
    expect(String((error as Error).message)).not.toContain(COMPANY_KEY)
  })

  it('R46: generar, con exito o con fallo, no cambia la conexion', async () => {
    const ctx = setup([textFailed(failure('rejected_key', 401)), textOk()])
    await ctx.generate(ctx.companyId, request())
    await ctx.generate(ctx.companyId, request())
    expect(ctx.repository.update).not.toHaveBeenCalled()
    expect(ctx.repository.create).not.toHaveBeenCalled()
    expect(ctx.repository.remove).not.toHaveBeenCalled()
  })
})

describe('generateAgentText: respaldo', () => {
  it.each<[string, AiProviderFailure]>([
    ['modelo no disponible', failure('model_unavailable', 404)],
    ['sin respuesta o plazo', failure('unreachable', null)],
    ['sobrecarga 503', failure('unexpected', 503)],
    ['sobrecarga 529', failure('unexpected', 529)],
  ])('R23, R28: %s repite una vez con el respaldo, misma entrada, y dice de donde salio', async (_caso, cause) => {
    const ctx = setup([textFailed(cause), textOk('Respuesta del respaldo')])
    const result = await ctx.generate(ctx.companyId, request())

    expect(ctx.generateText).toHaveBeenCalledTimes(2)
    const [first, second] = ctx.generateText.mock.calls.map(([input]) => input)
    expect(second).toEqual({ ...first, model: 'modelo-recomendado-g' })
    expect(result).toEqual({
      ...textOk('Respuesta del respaldo'),
      model: 'modelo-recomendado-g',
      fallbackFrom: cause,
    })
  })

  it.each<[string, TextGeneration]>([
    ['key rechazada 401', textFailed(failure('rejected_key', 401))],
    ['key rechazada 403', textFailed(failure('rejected_key', 403))],
    ['cuota 402', textFailed(failure('quota', 402))],
    ['cuota 429', textFailed(failure('quota', 429))],
    ['inesperado 500', textFailed(failure('unexpected', 500))],
    ['inesperado 502', textFailed(failure('unexpected', 502))],
    ['inesperado 504', textFailed(failure('unexpected', 504))],
    ['inesperado sin codigo', textFailed(failure('unexpected', null))],
    ['tope de pasos', { status: 'step_limit', toolCalls: [], usage: USAGE, steps: 4 }],
    ['respuesta vacia', { status: 'empty_reply', toolCalls: [], usage: USAGE, steps: 1 }],
  ])('R24: %s no llama al respaldo y devuelve lo del principal', async (_caso, outcome) => {
    const ctx = setup([outcome])
    const result = await ctx.generate(ctx.companyId, request())
    expect(ctx.generateText).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ ...outcome, model: 'modelo-alto-g', fallbackFrom: null })
  })

  it('R25: si el respaldo tambien falla devuelve su fallo, sin tercer intento', async () => {
    const primaryFailure = failure('unreachable', null)
    const fallbackFailure = failure('model_unavailable', 404, 'modelo-recomendado-g')
    const ctx = setup([textFailed(primaryFailure), textFailed(fallbackFailure)])

    const result = await ctx.generate(ctx.companyId, request())

    expect(ctx.generateText).toHaveBeenCalledTimes(2)
    expect(result).toEqual({
      status: 'failed',
      failure: fallbackFailure,
      toolCalls: [],
      model: 'modelo-recomendado-g',
      fallbackFrom: primaryFailure,
    })
  })

  it('R26: si el principal ya ejecuto una herramienta no llama al respaldo y devuelve su fallo', async () => {
    const executed = [
      { name: 'buscar_pedido', ok: true, executed: true },
      { name: 'buscar_pedido', ok: false, executed: false },
    ]
    const ctx = setup([textFailed(failure('unreachable', null), executed)])

    const result = await ctx.generate(ctx.companyId, request())

    expect(ctx.generateText).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      status: 'failed',
      failure: failure('unreachable', null),
      toolCalls: executed,
      model: 'modelo-alto-g',
      fallbackFrom: null,
    })
  })

  it('R26: una herramienta ejecutada que fallo tambien bloquea el respaldo', async () => {
    const ctx = setup([textFailed(failure('unexpected', 503), [{ name: 'buscar_pedido', ok: false, executed: true }])])
    await ctx.generate(ctx.companyId, request())
    expect(ctx.generateText).toHaveBeenCalledTimes(1)
  })

  it('R26: llamadas pedidas pero no ejecutadas no bloquean el respaldo', async () => {
    const ctx = setup([
      textFailed(failure('unreachable', null), [{ name: 'buscar_pedido', ok: false, executed: false }]),
      textOk(),
    ])
    await expect(ctx.generate(ctx.companyId, request())).resolves.toMatchObject({ model: 'modelo-recomendado-g' })
    expect(ctx.generateText).toHaveBeenCalledTimes(2)
  })

  it('R27: con herramientas y un respaldo sin herramientas no lo llama y devuelve el fallo del principal', async () => {
    const ctx = setup([textFailed(failure('unreachable', null))], {
      pairs: [pair('GOOGLE', 'AGENT', 'modelo-alto-g', 'modelo-bajo-g')],
    })
    const result = await ctx.generate(ctx.companyId, request())
    expect(ctx.generateText).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ status: 'failed', model: 'modelo-alto-g', fallbackFrom: null })
  })

  it('R27: sin herramientas pedidas el respaldo sin herramientas si se llama', async () => {
    const ctx = setup([textFailed(failure('unreachable', null)), textOk()], {
      pairs: [pair('GOOGLE', 'AGENT', 'modelo-alto-g', 'modelo-bajo-g')],
    })
    await expect(ctx.generate(ctx.companyId, request({ tools: [] }))).resolves.toMatchObject({
      status: 'ok',
      model: 'modelo-bajo-g',
    })
  })

  it('R28: un resultado del principal lleva su modelo y ningun fallo previo', async () => {
    const ctx = setup([textOk('Hola', [{ name: 'buscar_pedido', ok: true, executed: true }])])
    await expect(ctx.generate(ctx.companyId, request())).resolves.toEqual({
      ...textOk('Hola', [{ name: 'buscar_pedido', ok: true, executed: true }]),
      model: 'modelo-alto-g',
      fallbackFrom: null,
    })
  })
})

describe('generateAgentText: validaciones antes del proveedor', () => {
  it.each([1, 8])('R34: el tope de pasos %i se acepta y llega al puerto', async (maxSteps) => {
    const ctx = setup()
    await ctx.generate(ctx.companyId, request({ maxSteps }))
    expect(ctx.generateText.mock.calls[0]?.[0].maxSteps).toBe(maxSteps)
  })

  it('R34: «tope de pasos» del puerto sale tal cual', async () => {
    const stepLimit: TextGeneration = { status: 'step_limit', toolCalls: [{ name: 'buscar_pedido', ok: true, executed: true }], usage: USAGE, steps: 2 }
    const ctx = setup([stepLimit])
    await expect(ctx.generate(ctx.companyId, request({ maxSteps: 2 }))).resolves.toMatchObject({ status: 'step_limit', steps: 2 })
  })

  it.each([
    ['tope 0', { maxSteps: 0 }],
    ['tope 9', { maxSteps: 9 }],
    ['tope no entero', { maxSteps: 2.5 }],
    ['tope NaN', { maxSteps: Number.NaN }],
    ['plazo 0', { timeoutMs: 0 }],
    ['plazo negativo', { timeoutMs: -1 }],
    ['plazo no entero', { timeoutMs: 1.5 }],
    ['herramientas con el mismo nombre', { tools: [tool('buscar_pedido'), tool('buscar_pedido')] }],
    ['nombre con espacios', { tools: [tool('buscar pedido')] }],
    ['nombre vacio', { tools: [tool('')] }],
    ['nombre de 65 caracteres', { tools: [tool('a'.repeat(65))] }],
    ['nombre con punto', { tools: [tool('pedidos.buscar')] }],
    ['sin turnos', { turns: [] }],
    ['ultimo turno del asistente', { turns: [{ role: 'user' as const, text: 'hola' }, { role: 'assistant' as const, text: 'hola' }] }],
    ['rol desconocido', { role: 'OTRO' as AgentTextRequest['role'] }],
  ])('R34, R37: %s lanza un error de programacion sin leer la conexion ni llamar', async (_caso, overrides) => {
    const ctx = setup()
    await expect(ctx.generate(ctx.companyId, request(overrides))).rejects.toThrow(Error)
    expect(ctx.repository.find).not.toHaveBeenCalled()
    expect(ctx.generateText).not.toHaveBeenCalled()
  })

  it('R37: nombres validos de 1 y 64 caracteres con guion y guion bajo se aceptan', async () => {
    const ctx = setup()
    await ctx.generate(ctx.companyId, request({ tools: [tool('a'), tool(`b-${'x'.repeat(60)}_9`)] }))
    expect(ctx.generateText).toHaveBeenCalledTimes(1)
  })
})
