// Dobles para los casos de uso de generacion (QT-304): un puerto de modelo que devuelve, en orden,
// los resultados que el test le pone, y una empresa con conexion, catalogo y pares en memoria.

import { vi } from 'vitest'
import { z } from 'zod'

import type { AiProviderConnectionRecord } from '@/lib/modules/integraciones/domain/ai-provider'
import type { AiProviderFailure } from '@/lib/modules/integraciones/domain/ai-provider-failure'
import type { AiModelPair } from '@/lib/modules/integraciones/domain/ai-model-pair'
import type {
  ConversationalModel,
  ConversationalTool,
  ObjectGeneration,
  ObjectGenerationInput,
  TextGeneration,
  ToolCallRecord,
} from '@/lib/modules/integraciones/ports/conversational-model'

import { COMPANY_ID, OLD_API_KEY, makeCatalog, makeCipher, makeRepository, storedConnection } from '../ai-provider/ai-provider-doubles'
import { makePairs, pair } from './ai-model-pair-doubles'

/** La key que descifra la conexion sembrada por `storedConnection`. */
export const COMPANY_KEY = OLD_API_KEY

export const USAGE = { inputTokens: 120, outputTokens: 40 } as const

/**
 * Pares de GOOGLE y ANTHROPIC sobre el catalogo doble: `modelo-alto-*` y `modelo-recomendado-*`
 * admiten herramientas; `modelo-bajo-*` no.
 */
export const DEFAULT_PAIRS: readonly AiModelPair[] = [
  pair('GOOGLE', 'AGENT', 'modelo-alto-g', 'modelo-recomendado-g'),
  pair('GOOGLE', 'ROUTER', 'modelo-recomendado-g', 'modelo-alto-g'),
  pair('ANTHROPIC', 'AGENT', 'modelo-alto-a', 'modelo-recomendado-a'),
]

export function failure(kind: AiProviderFailure['kind'], httpStatus: number | null, model = 'modelo-alto-g'): AiProviderFailure {
  return kind === 'model_unavailable' ? { kind, httpStatus, model } : { kind, httpStatus, model: null }
}

export function textOk(text = 'Tu pedido sale manana.', toolCalls: readonly ToolCallRecord[] = []): TextGeneration {
  return { status: 'ok', text, toolCalls, usage: USAGE, steps: toolCalls.length + 1 }
}

export function textFailed(cause: AiProviderFailure, toolCalls: readonly ToolCallRecord[] = []): TextGeneration {
  return { status: 'failed', failure: cause, toolCalls }
}

export function tool(name = 'buscar_pedido'): ConversationalTool {
  return {
    name,
    description: 'Busca un pedido del cliente por su numero.',
    input: z.object({ numero: z.string() }) as z.ZodType<unknown>,
    execute: vi.fn(async () => ({ estado: 'en camino' })),
  }
}

/** Puerto que contesta en orden; si se le llama mas veces de las previstas, el test falla. */
export function makeModel(
  textResults: readonly TextGeneration[] = [],
  objectResults: readonly ObjectGeneration<unknown>[] = [],
) {
  const texts = [...textResults]
  const objects = [...objectResults]
  const generateText = vi.fn<ConversationalModel['generateText']>(async () => {
    const next = texts.shift()
    if (next === undefined) throw new Error('doble: generateText llamado de mas')
    return next
  })
  const generateObject = vi.fn<(input: ObjectGenerationInput<unknown>) => Promise<ObjectGeneration<unknown>>>(async () => {
    const next = objects.shift()
    if (next === undefined) throw new Error('doble: generateObject llamado de mas')
    return next
  })
  const model = { generateText, generateObject } as unknown as ConversationalModel
  return { model, generateText, generateObject }
}

/** La empresa con conexion GOOGLE; su `model` (lectura de PDF) apunta a otro modelo a proposito. */
export function makeCompany(
  options: {
    readonly connection?: Partial<AiProviderConnectionRecord> | null
    readonly pairs?: readonly AiModelPair[]
  } = {},
) {
  const cipher = makeCipher()
  const repository = makeRepository(
    options.connection === null
      ? []
      : [storedConnection(cipher.seed, { model: 'modelo-bajo-g', ...options.connection })],
  )
  const catalog = makeCatalog()
  const pairs = makePairs(options.pairs ?? DEFAULT_PAIRS)
  const deps = {
    connections: repository.connections,
    catalog: catalog.catalog,
    pairs: pairs.pairs,
    cipher: cipher.cipher,
  }
  return { deps, cipher, repository, catalog, pairs, companyId: COMPANY_ID }
}
