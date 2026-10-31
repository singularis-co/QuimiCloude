import { APICallError } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  TOOL_FAILED_RESULT,
  createConversationalModelAiSdk,
} from '@/lib/modules/integraciones/adapters/driven/ai/conversational-model-ai-sdk'
import type {
  ConversationalTool,
  ObjectGenerationInput,
  TextGenerationInput,
} from '@/lib/modules/integraciones/ports/conversational-model'

type GenerateResult = Awaited<ReturnType<MockLanguageModelV4['doGenerate']>>
type CallOptions = MockLanguageModelV4['doGenerateCalls'][number]

function usage(input: number | undefined, output: number | undefined): GenerateResult['usage'] {
  return {
    inputTokens: { total: input, noCache: input, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: output, text: output, reasoning: undefined },
  }
}

function textReply(text: string, tokens: [number | undefined, number | undefined] = [10, 5]): GenerateResult {
  return {
    content: [{ type: 'text', text }],
    finishReason: { unified: 'stop', raw: undefined },
    usage: usage(...tokens),
    warnings: [],
  }
}

function toolReply(
  calls: readonly { id: string; name: string; input: unknown }[],
  tokens: [number | undefined, number | undefined] = [10, 5],
): GenerateResult {
  return {
    content: calls.map((call) => ({
      type: 'tool-call' as const,
      toolCallId: call.id,
      toolName: call.name,
      input: typeof call.input === 'string' ? call.input : JSON.stringify(call.input),
    })),
    finishReason: { unified: 'tool-calls', raw: undefined },
    usage: usage(...tokens),
    warnings: [],
  }
}

/** Un modelo simulado que contesta en orden lo que se le da; se queda en el último. */
function scripted(replies: readonly GenerateResult[]): MockLanguageModelV4 {
  let index = 0
  return new MockLanguageModelV4({
    doGenerate: async () => {
      const reply = replies[Math.min(index, replies.length - 1)] as GenerateResult
      index += 1
      return reply
    },
  })
}

function failing(error: unknown): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async () => {
      throw error
    },
  })
}

function apiError(statusCode: number, isRetryable = false): APICallError {
  return new APICallError({
    message: 'fallo',
    url: 'https://proveedor.test',
    requestBodyValues: {},
    statusCode,
    isRetryable,
  })
}

const searchExecute = vi.fn(async (input: { q: string }) => ({ found: input.q }))

function searchTool(execute: (input: { q: string }) => Promise<unknown> = searchExecute): ConversationalTool {
  return {
    name: 'buscar_producto',
    description: 'Busca un producto por nombre',
    input: z.object({ q: z.string().trim().min(1) }),
    execute: execute as (input: unknown) => Promise<unknown>,
  }
}

function textInput(overrides: Partial<TextGenerationInput> = {}): TextGenerationInput {
  return {
    provider: 'OPENAI',
    model: 'modelo-principal',
    apiKey: 'sk-empresa',
    system: 'Eres el asistente de la tienda.',
    turns: [
      { role: 'user', text: 'hola' },
      { role: 'assistant', text: 'buenas' },
      { role: 'user', text: 'tienes jabon?' },
    ],
    tools: [searchTool()],
    maxSteps: 4,
    timeoutMs: 5_000,
    ...overrides,
  }
}

const verdict = z.object({ intent: z.enum(['comprar', 'preguntar']), confidence: z.number() })

function objectInput(overrides: Partial<ObjectGenerationInput<z.infer<typeof verdict>>> = {}) {
  return {
    provider: 'ANTHROPIC' as const,
    model: 'modelo-economico',
    apiKey: 'sk-empresa',
    system: 'Clasifica la intencion.',
    turns: [{ role: 'user' as const, text: 'quiero dos jabones' }],
    schema: verdict,
    timeoutMs: 5_000,
    ...overrides,
  }
}

function toolMessages(call: CallOptions | undefined): unknown[] {
  return (call?.prompt ?? []).filter((message) => message.role === 'tool')
}

describe('createConversationalModelAiSdk: texto con herramientas', () => {
  it('R29: ofrece exactamente las herramientas recibidas con nombre, descripcion y esquema, y devuelve el texto final', async () => {
    const model = scripted([textReply('Si, tenemos jabon.')])
    const resolve = vi.fn(() => model)
    const second: ConversationalTool = {
      name: 'ver_pedido',
      description: 'Estado de un pedido',
      input: z.object({ numero: z.number().int() }),
      execute: async () => ({}),
    }

    const result = await createConversationalModelAiSdk(resolve).generateText(
      textInput({ tools: [searchTool(), second] }),
    )

    expect(result).toMatchObject({ status: 'ok', text: 'Si, tenemos jabon.' })
    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({ provider: 'OPENAI', model: 'modelo-principal', apiKey: 'sk-empresa' }))
    const offered = model.doGenerateCalls[0]?.tools ?? []
    expect(offered.map((tool) => tool.name)).toEqual(['buscar_producto', 'ver_pedido'])
    const search = offered[0] as { description?: string; inputSchema: { properties?: Record<string, unknown> } }
    expect(search.description).toBe('Busca un producto por nombre')
    expect(Object.keys(search.inputSchema.properties ?? {})).toEqual(['q'])
  })

  it('R29: el sistema va como instrucciones y los turnos en orden con su rol', async () => {
    const model = scripted([textReply('ok')])
    await createConversationalModelAiSdk(() => model).generateText(textInput())

    const prompt = model.doGenerateCalls[0]?.prompt ?? []
    expect(prompt.map((message) => message.role)).toEqual(['system', 'user', 'assistant', 'user'])
    expect(prompt[0]).toMatchObject({ role: 'system', content: 'Eres el asistente de la tienda.' })
    expect(JSON.stringify(prompt[3])).toContain('tienes jabon?')
  })

  it('R30: ejecuta la herramienta con la entrada ya validada y entrega su resultado al paso siguiente', async () => {
    const execute = vi.fn(async (input: { q: string }) => ({ found: input.q, stock: 3 }))
    const model = scripted([toolReply([{ id: 'c1', name: 'buscar_producto', input: { q: '  jabon  ' } }]), textReply('Hay 3.')])

    const result = await createConversationalModelAiSdk(() => model).generateText(
      textInput({ tools: [searchTool(execute)] }),
    )

    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith({ q: 'jabon' })
    expect(JSON.stringify(toolMessages(model.doGenerateCalls[1]))).toContain('"stock":3')
    expect(result).toMatchObject({
      status: 'ok',
      text: 'Hay 3.',
      toolCalls: [{ name: 'buscar_producto', ok: true, executed: true }],
    })
  })

  it('R31: con una entrada que no cumple el esquema no ejecuta y la llamada consta como fallida', async () => {
    const execute = vi.fn(async () => ({}))
    const model = scripted([toolReply([{ id: 'c1', name: 'buscar_producto', input: { q: 42 } }]), textReply('No pude buscar.')])

    const result = await createConversationalModelAiSdk(() => model).generateText(
      textInput({ tools: [searchTool(execute)] }),
    )

    expect(execute).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      status: 'ok',
      toolCalls: [{ name: 'buscar_producto', ok: false, executed: false }],
    })
  })

  it('R32: una herramienta que no se ofrecio no ejecuta nada y consta como fallida', async () => {
    const execute = vi.fn(async () => ({}))
    const model = scripted([toolReply([{ id: 'c1', name: 'borrar_todo', input: {} }]), textReply('No puedo.')])

    const result = await createConversationalModelAiSdk(() => model).generateText(
      textInput({ tools: [searchTool(execute)] }),
    )

    expect(execute).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      status: 'ok',
      toolCalls: [{ name: 'borrar_todo', ok: false, executed: false }],
    })
  })

  it('R33: si execute lanza, el modelo recibe un error generico sin mensaje ni traza y la llamada consta fallida y ejecutada', async () => {
    const execute = vi.fn(async () => {
      throw new Error('fallo interno con datos del cliente 555-1234')
    })
    const model = scripted([toolReply([{ id: 'c1', name: 'buscar_producto', input: { q: 'jabon' } }]), textReply('Hubo un problema.')])

    const result = await createConversationalModelAiSdk(() => model).generateText(
      textInput({ tools: [searchTool(execute)] }),
    )

    const sent = JSON.stringify(toolMessages(model.doGenerateCalls[1]))
    expect(sent).toContain(JSON.stringify(TOOL_FAILED_RESULT).slice(1, -1))
    expect(sent).not.toContain('555-1234')
    expect(sent).not.toContain('fallo interno')
    expect(sent).not.toContain('at ')
    expect(result).toMatchObject({
      status: 'ok',
      toolCalls: [{ name: 'buscar_producto', ok: false, executed: true }],
    })
  })

  it('R34: limita los pasos al tope y, sin texto final, devuelve tope de pasos', async () => {
    let n = 0
    const loopModel = new MockLanguageModelV4({
      doGenerate: async () => {
        n += 1
        return toolReply([{ id: `c${n}`, name: 'buscar_producto', input: { q: 'a' } }])
      },
    })

    const result = await createConversationalModelAiSdk(() => loopModel).generateText(textInput({ maxSteps: 2 }))

    expect(loopModel.doGenerateCalls).toHaveLength(2)
    expect(result).toMatchObject({ status: 'step_limit', steps: 2 })
    expect(result.status === 'step_limit' && result.toolCalls).toHaveLength(2)
  })

  it('R34: con tope 1 hace una sola llamada al modelo', async () => {
    const model = scripted([toolReply([{ id: 'c1', name: 'buscar_producto', input: { q: 'a' } }]), textReply('nunca')])

    const result = await createConversationalModelAiSdk(() => model).generateText(textInput({ maxSteps: 1 }))

    expect(model.doGenerateCalls).toHaveLength(1)
    expect(result).toMatchObject({ status: 'step_limit', steps: 1 })
  })

  it('R35: un texto final vacio o de solo espacios es respuesta vacia', async () => {
    for (const text of ['', '   \n\t ']) {
      const result = await createConversationalModelAiSdk(() => scripted([textReply(text)])).generateText(textInput())
      expect(result).toMatchObject({ status: 'empty_reply', steps: 1 })
    }
  })

  it('R36: el resultado trae texto, llamadas en orden, tokens sumados de todos los pasos y numero de pasos', async () => {
    const other: ConversationalTool = {
      name: 'ver_pedido',
      description: 'Estado de un pedido',
      input: z.object({ numero: z.number() }),
      execute: async () => ({ estado: 'enviado' }),
    }
    const model = scripted([
      toolReply(
        [
          { id: 'c1', name: 'buscar_producto', input: { q: 'jabon' } },
          { id: 'c2', name: 'ver_pedido', input: { numero: 'x' } },
        ],
        [100, 20],
      ),
      toolReply([{ id: 'c3', name: 'ver_pedido', input: { numero: 7 } }], [150, 10]),
      textReply('Listo.', [200, 30]),
    ])

    const result = await createConversationalModelAiSdk(() => model).generateText(
      textInput({ tools: [searchTool(), other] }),
    )

    expect(result).toEqual({
      status: 'ok',
      text: 'Listo.',
      toolCalls: [
        { name: 'buscar_producto', ok: true, executed: true },
        { name: 'ver_pedido', ok: false, executed: false },
        { name: 'ver_pedido', ok: true, executed: true },
      ],
      usage: { inputTokens: 450, outputTokens: 60 },
      steps: 3,
    })
  })

  it('R36: si el proveedor no da los tokens constan como desconocidos', async () => {
    const result = await createConversationalModelAiSdk(() => scripted([textReply('hola', [undefined, undefined])])).generateText(
      textInput(),
    )
    expect(result).toMatchObject({ status: 'ok', usage: { inputTokens: null, outputTokens: null } })
  })

  it('R42: no reintenta un error que el SDK consideraria reintentable', async () => {
    for (const status of [429, 503, 529]) {
      const model = failing(apiError(status, true))
      const result = await createConversationalModelAiSdk(() => model).generateText(textInput())
      expect(model.doGenerateCalls).toHaveLength(1)
      expect(result.status).toBe('failed')
    }
  })

  it('R42, R44: un error del proveedor sale como resultado failed clasificado, no como excepcion', async () => {
    const result = await createConversationalModelAiSdk(() => failing(apiError(401))).generateText(textInput())
    expect(result).toEqual({
      status: 'failed',
      failure: { kind: 'rejected_key', httpStatus: 401, model: null },
      toolCalls: [],
    })
    const missing = await createConversationalModelAiSdk(() => failing(apiError(404))).generateText(textInput())
    expect(missing).toMatchObject({ failure: { kind: 'model_unavailable', model: 'modelo-principal' } })
  })

  it('R43: si la llamada supera el plazo se aborta y es unreachable', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: (options) =>
        new Promise((_, reject) => {
          options.abortSignal?.addEventListener('abort', () => reject(options.abortSignal?.reason))
        }),
    })
    const started = Date.now()

    const result = await createConversationalModelAiSdk(() => model).generateText(textInput({ timeoutMs: 30 }))

    expect(Date.now() - started).toBeLessThan(2_000)
    expect(result).toEqual({
      status: 'failed',
      failure: { kind: 'unreachable', httpStatus: null, model: null },
      toolCalls: [],
    })
  })

  it('R26: si el proveedor falla despues de ejecutar una herramienta, el fallo trae la llamada ejecutada', async () => {
    let n = 0
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        n += 1
        if (n === 1) return toolReply([{ id: 'c1', name: 'buscar_producto', input: { q: 'jabon' } }])
        throw apiError(503, true)
      },
    })

    const result = await createConversationalModelAiSdk(() => model).generateText(textInput())

    expect(result).toEqual({
      status: 'failed',
      failure: { kind: 'unexpected', httpStatus: 503, model: null },
      toolCalls: [{ name: 'buscar_producto', ok: true, executed: true }],
    })
  })
})

describe('createConversationalModelAiSdk: salida estructurada', () => {
  it('R38: devuelve el valor validado con el esquema y los tokens', async () => {
    const model = scripted([textReply('{"intent":"comprar","confidence":0.9}', [40, 8])])

    const result = await createConversationalModelAiSdk(() => model).generateObject(objectInput())

    expect(result).toEqual({
      status: 'ok',
      value: { intent: 'comprar', confidence: 0.9 },
      usage: { inputTokens: 40, outputTokens: 8 },
    })
  })

  it('R38: el valor es el que sale del esquema (con sus transformaciones), no el texto crudo', async () => {
    const schema = z.object({ name: z.string().trim().toUpperCase() })
    const model = scripted([textReply('{"name":"  jabon  "}')])

    const result = await createConversationalModelAiSdk(() => model).generateObject({ ...objectInput(), schema })

    expect(result).toMatchObject({ status: 'ok', value: { name: 'JABON' } })
  })

  it('R39: una respuesta que no cumple el esquema es salida invalida, sin el texto del modelo', async () => {
    for (const text of ['{"intent":"robar","confidence":1}', 'no es json, dice cosas del cliente']) {
      const result = await createConversationalModelAiSdk(() => scripted([textReply(text)])).generateObject(objectInput())
      expect(result.status).toBe('invalid_output')
      expect(Object.keys(result).sort()).toEqual(['status', 'usage'])
      expect(JSON.stringify(result)).not.toContain('robar')
      expect(JSON.stringify(result)).not.toContain('cliente')
    }
  })

  it('R40: no ofrece herramientas al modelo y pide JSON', async () => {
    const model = scripted([textReply('{"intent":"preguntar","confidence":0.4}')])

    await createConversationalModelAiSdk(() => model).generateObject(objectInput())

    const call = model.doGenerateCalls[0]
    expect(call?.tools ?? []).toEqual([])
    expect(call?.responseFormat).toMatchObject({ type: 'json' })
  })

  it('R42, R44: un error del proveedor es failed clasificado y no se reintenta', async () => {
    const model = failing(apiError(429, true))

    const result = await createConversationalModelAiSdk(() => model).generateObject(objectInput())

    expect(model.doGenerateCalls).toHaveLength(1)
    expect(result).toEqual({ status: 'failed', failure: { kind: 'quota', httpStatus: 429, model: null } })
  })

  it('R43: el plazo tambien corta la salida estructurada como unreachable', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: (options) =>
        new Promise((_, reject) => {
          options.abortSignal?.addEventListener('abort', () => reject(options.abortSignal?.reason))
        }),
    })

    const result = await createConversationalModelAiSdk(() => model).generateObject(objectInput({ timeoutMs: 30 }))

    expect(result).toEqual({ status: 'failed', failure: { kind: 'unreachable', httpStatus: null, model: null } })
  })
})
