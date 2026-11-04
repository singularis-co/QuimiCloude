import type { AiModelRole } from './ai-model-pair';
import { withFallback, type AttemptOrigin } from './model-fallback';
import {
  assertConversationRequest,
  assertToolRequest,
  resolveConversationModel,
  type ConversationModelDeps,
} from './resolve-conversation-model';

import type {
  ConversationalModel,
  ConversationalTool,
  ConversationTurn,
  TextGeneration,
  TokenUsage,
  ToolCallRecord,
} from '../ports/conversational-model';

export type { ConversationalTool, ConversationTurn, TokenUsage, ToolCallRecord };

export type GenerateAgentTextDeps = ConversationModelDeps & { readonly model: ConversationalModel };

export type AgentTextRequest = {
  readonly role: AiModelRole;
  readonly system: string;
  readonly turns: readonly ConversationTurn[];
  readonly tools: readonly ConversationalTool[];
  readonly maxSteps: number;
  readonly timeoutMs: number;
};

export type AgentTextResult =
  | (TextGeneration & AttemptOrigin)
  | { readonly status: 'missing' | 'unreadable' | 'no_model_pair' | 'model_without_tools' };

/**
 * Sin actor: la empresa la pone el servidor (el job que atiende la conversación), nunca el modelo.
 * El fallo sale tal cual y la conexión no se toca: quien orquesta decide si la marca.
 */
export function createGenerateAgentText(
  deps: GenerateAgentTextDeps,
): (companyId: string, request: AgentTextRequest) => Promise<AgentTextResult> {
  return async function generateAgentText(companyId, request) {
    assertConversationRequest(request);
    assertToolRequest(request);

    const resolution = await resolveConversationModel(deps, companyId, request.role);
    if (resolution.status !== 'ready') return { status: resolution.status };

    const needsTools = request.tools.length > 0;
    if (needsTools && !resolution.primary.supportsTools) return { status: 'model_without_tools' };

    return withFallback(resolution, needsTools, (target) =>
      deps.model.generateText({
        ...target,
        system: request.system,
        turns: request.turns,
        tools: request.tools,
        maxSteps: request.maxSteps,
        timeoutMs: request.timeoutMs,
      }),
    );
  };
}
