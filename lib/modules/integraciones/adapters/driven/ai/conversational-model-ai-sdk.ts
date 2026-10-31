import {
  APICallError,
  generateText,
  isStepCount,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
  tool,
  type LanguageModel,
  type LanguageModelUsage,
  type ModelMessage,
  type ToolSet,
} from 'ai';
import type { AiProviderCode } from '../../../domain/ai-provider';
import type { AiProviderFailure } from '../../../domain/ai-provider-failure';
import type {
  ConversationalModel,
  ConversationalTool,
  ConversationTurn,
  ModelTarget,
  ObjectGeneration,
  ObjectGenerationInput,
  TextGeneration,
  TextGenerationInput,
  TokenUsage,
  ToolCallRecord,
} from '../../../ports/conversational-model';
import { aiSdkModel } from './ai-sdk-models';

/** Lo único que vuelve al modelo cuando una herramienta lanza: ni el mensaje ni la traza. */
export const TOOL_FAILED_RESULT = { error: 'tool_failed' } as const;

const GOOGLE_INVALID_KEY_REASON = 'API_KEY_INVALID';

function isAbort(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  );
}

function errorMessageOf(body: unknown): unknown {
  if (typeof body !== 'object' || body === null || !('error' in body)) return undefined;
  const inner: unknown = body.error;
  if (typeof inner !== 'object' || inner === null || !('message' in inner)) return undefined;
  return inner.message;
}

/**
 * OpenRouter responde 400, no 404, al generar con un id que no existe; el mensaje es lo único que
 * lo distingue de otro 400 y solo se compara entero contra el id usado.
 */
function isOpenRouterInvalidModel(error: APICallError, model: string): boolean {
  const expected = `${model} is not a valid model ID`;
  if (errorMessageOf(error.data) === expected) return true;
  if (error.responseBody === undefined) return false;
  try {
    return errorMessageOf(JSON.parse(error.responseBody)) === expected;
  } catch {
    return false;
  }
}

/** El tipo del fallo por proveedor y código HTTP; del cuerpo solo se miran las dos marcas de la tabla. */
export function classifyAiSdkError(error: unknown, provider: AiProviderCode, model: string): AiProviderFailure {
  if (APICallError.isInstance(error)) {
    const status = error.statusCode;
    if (status === undefined) return { kind: 'unreachable', httpStatus: null, model: null };
    if (status === 401 || status === 403) return { kind: 'rejected_key', httpStatus: status, model: null };
    if (
      status === 400 &&
      provider === 'GOOGLE' &&
      (error.responseBody ?? '').includes(GOOGLE_INVALID_KEY_REASON)
    ) {
      return { kind: 'rejected_key', httpStatus: status, model: null };
    }
    if (status === 402) {
      return provider === 'ANTHROPIC'
        ? { kind: 'unexpected', httpStatus: status, model: null }
        : { kind: 'quota', httpStatus: status, model: null };
    }
    if (status === 429) return { kind: 'quota', httpStatus: status, model: null };
    if (status === 404) return { kind: 'model_unavailable', httpStatus: status, model };
    if (status === 400 && provider === 'OPENROUTER' && isOpenRouterInvalidModel(error, model)) {
      return { kind: 'model_unavailable', httpStatus: status, model };
    }
    return { kind: 'unexpected', httpStatus: status, model: null };
  }
  if (isAbort(error)) return { kind: 'unreachable', httpStatus: null, model: null };
  return { kind: 'unexpected', httpStatus: null, model: null };
}

function toMessages(turns: readonly ConversationTurn[]): ModelMessage[] {
  return turns.map((turn) => ({ role: turn.role, content: turn.text }));
}

function toUsage(usage: LanguageModelUsage): TokenUsage {
  return { inputTokens: usage.inputTokens ?? null, outputTokens: usage.outputTokens ?? null };
}

type ExecutedCall = { readonly name: string; readonly ok: boolean };

/**
 * El SDK valida la entrada y descarta las herramientas desconocidas antes de llamar a `execute`, así
 * que lo que pasa por aquí es justo lo que se ejecutó.
 */
function toToolSet(tools: readonly ConversationalTool[], executed: Map<string, ExecutedCall>): ToolSet {
  const set: ToolSet = {};
  for (const conversational of tools) {
    set[conversational.name] = tool({
      description: conversational.description,
      inputSchema: conversational.input,
      execute: async (input: unknown, { toolCallId }) => {
        try {
          const output = await conversational.execute(input);
          executed.set(toolCallId, { name: conversational.name, ok: true });
          return output;
        } catch {
          executed.set(toolCallId, { name: conversational.name, ok: false });
          return TOOL_FAILED_RESULT;
        }
      },
    });
  }
  return set;
}

function executedRecords(executed: Map<string, ExecutedCall>): ToolCallRecord[] {
  return [...executed.values()].map((call) => ({ name: call.name, ok: call.ok, executed: true }));
}

type ModelResolver = (target: ModelTarget) => LanguageModel;

async function generateTextWith(resolve: ModelResolver, input: TextGenerationInput): Promise<TextGeneration> {
  const executed = new Map<string, ExecutedCall>();
  try {
    const result = await generateText({
      model: resolve(input),
      instructions: input.system,
      messages: toMessages(input.turns),
      tools: toToolSet(input.tools, executed),
      stopWhen: isStepCount(input.maxSteps),
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(input.timeoutMs),
    });

    const toolCalls: ToolCallRecord[] = result.steps.flatMap((step) =>
      step.toolCalls.map((call) => {
        const done = executed.get(call.toolCallId);
        return done === undefined
          ? { name: call.toolName, ok: false, executed: false }
          : { name: done.name, ok: done.ok, executed: true };
      }),
    );
    const trace = { toolCalls, usage: toUsage(result.usage), steps: result.steps.length };

    // El bucle solo se corta con herramientas pendientes cuando se llega al tope de pasos.
    if (result.finalStep.toolCalls.length > 0) return { status: 'step_limit', ...trace };
    if (result.text.trim() === '') return { status: 'empty_reply', ...trace };
    return { status: 'ok', text: result.text, ...trace };
  } catch (error) {
    return {
      status: 'failed',
      failure: classifyAiSdkError(error, input.provider, input.model),
      toolCalls: executedRecords(executed),
    };
  }
}

async function generateObjectWith<T>(
  resolve: ModelResolver,
  input: ObjectGenerationInput<T>,
): Promise<ObjectGeneration<T>> {
  try {
    const result = await generateText({
      model: resolve(input),
      instructions: input.system,
      messages: toMessages(input.turns),
      output: Output.object({ schema: input.schema }),
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(input.timeoutMs),
    });
    const usage = toUsage(result.usage);
    try {
      return { status: 'ok', value: result.output, usage };
    } catch (error) {
      if (NoOutputGeneratedError.isInstance(error)) return { status: 'invalid_output', usage };
      throw error;
    }
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return { status: 'invalid_output', usage: error.usage === undefined ? null : toUsage(error.usage) };
    }
    if (NoOutputGeneratedError.isInstance(error)) return { status: 'invalid_output', usage: null };
    return { status: 'failed', failure: classifyAiSdkError(error, input.provider, input.model) };
  }
}

/** `resolve` solo se cambia en los tests, para meter el modelo simulado del SDK. */
export function createConversationalModelAiSdk(resolve: ModelResolver = aiSdkModel): ConversationalModel {
  return {
    generateText: (input) => generateTextWith(resolve, input),
    generateObject: (input) => generateObjectWith(resolve, input),
  };
}
