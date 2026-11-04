import type { z } from 'zod';

import type { AiProviderCode } from '../domain/ai-provider';
import type { AiProviderFailure } from '../domain/ai-provider-failure';

export type ConversationTurn = { readonly role: 'user' | 'assistant'; readonly text: string };

/** El contexto (empresa, cliente) lo cierra quien construye la herramienta; el modelo solo da `input`. */
export type ConversationalTool<I = unknown> = {
  readonly name: string;
  readonly description: string;
  readonly input: z.ZodType<I>;
  /** El resultado tiene que poder serializarse a JSON: vuelve al modelo. */
  execute(input: I): Promise<unknown>;
};

export type ModelTarget = {
  readonly provider: AiProviderCode;
  readonly model: string;
  readonly apiKey: string;
};

/**
 * Sin entrada ni salida, para que quien registra el turno no guarde datos del cliente. `executed`
 * distingue una herramienta que corrió de una que el modelo pidió y no llegó a correr.
 */
export type ToolCallRecord = { readonly name: string; readonly ok: boolean; readonly executed: boolean };

/** `null`: el proveedor no dio el dato. */
export type TokenUsage = { readonly inputTokens: number | null; readonly outputTokens: number | null };

type Trace = {
  readonly toolCalls: readonly ToolCallRecord[];
  readonly usage: TokenUsage;
  readonly steps: number;
};

export type TextGeneration =
  | ({ readonly status: 'ok'; readonly text: string } & Trace)
  | ({ readonly status: 'step_limit' } & Trace)
  | ({ readonly status: 'empty_reply' } & Trace)
  | {
      readonly status: 'failed';
      readonly failure: AiProviderFailure;
      /** Las que el modelo pidió antes del fallo: con una ya ejecutada no se cambia de modelo. */
      readonly toolCalls: readonly ToolCallRecord[];
    };

export type ObjectGeneration<T> =
  | { readonly status: 'ok'; readonly value: T; readonly usage: TokenUsage }
  | { readonly status: 'invalid_output'; readonly usage: TokenUsage | null }
  | { readonly status: 'failed'; readonly failure: AiProviderFailure };

export type TextGenerationInput = ModelTarget & {
  readonly system: string;
  readonly turns: readonly ConversationTurn[];
  readonly tools: readonly ConversationalTool[];
  readonly maxSteps: number;
  readonly timeoutMs: number;
};

export type ObjectGenerationInput<T> = ModelTarget & {
  readonly system: string;
  readonly turns: readonly ConversationTurn[];
  readonly schema: z.ZodType<T>;
  readonly timeoutMs: number;
};

/**
 * Una llamada a un modelo, sin reintentos: el cambio al respaldo lo decide el dominio. Un fallo del
 * proveedor o de la red es un resultado, no una excepción.
 */
export interface ConversationalModel {
  generateText(input: TextGenerationInput): Promise<TextGeneration>;
  generateObject<T>(input: ObjectGenerationInput<T>): Promise<ObjectGeneration<T>>;
}
