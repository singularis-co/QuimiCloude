import type { z } from 'zod';

import type { AiModelRole } from './ai-model-pair';
import { withFallback, type AttemptOrigin } from './model-fallback';
import {
  assertConversationRequest,
  resolveConversationModel,
  type ConversationModelDeps,
} from './resolve-conversation-model';

import type { ConversationalModel, ConversationTurn, ObjectGeneration } from '../ports/conversational-model';

export type GenerateAgentObjectDeps = ConversationModelDeps & { readonly model: ConversationalModel };

export type AgentObjectRequest<T> = {
  readonly role: AiModelRole;
  readonly system: string;
  readonly turns: readonly ConversationTurn[];
  readonly schema: z.ZodType<T>;
  readonly timeoutMs: number;
};

export type AgentObjectResult<T> =
  | (ObjectGeneration<T> & AttemptOrigin)
  | { readonly status: 'missing' | 'unreadable' | 'no_model_pair' };

/**
 * Sin herramientas. El valor se vuelve a validar aquí con el esquema de quien llama: lo que devuelva
 * el adaptador no se da por bueno.
 */
export function createGenerateAgentObject(
  deps: GenerateAgentObjectDeps,
): <T>(companyId: string, request: AgentObjectRequest<T>) => Promise<AgentObjectResult<T>> {
  return async function generateAgentObject<T>(
    companyId: string,
    request: AgentObjectRequest<T>,
  ): Promise<AgentObjectResult<T>> {
    assertConversationRequest(request);

    const resolution = await resolveConversationModel(deps, companyId, request.role);
    if (resolution.status !== 'ready') return { status: resolution.status };

    return withFallback(resolution, false, async (target): Promise<ObjectGeneration<T>> => {
      const generated = await deps.model.generateObject<T>({
        ...target,
        system: request.system,
        turns: request.turns,
        schema: request.schema,
        timeoutMs: request.timeoutMs,
      });
      if (generated.status !== 'ok') return generated;
      const parsed = request.schema.safeParse(generated.value);
      return parsed.success
        ? { status: 'ok', value: parsed.data, usage: generated.usage }
        : { status: 'invalid_output', usage: generated.usage };
    });
  };
}
