import { AI_MODEL_ROLES, type AiModelRole } from './ai-model-pair';
import { aiProviderKeyContext, type AiCatalogEntry, type AiProviderCode } from './ai-provider';
import { SecretUnreadableError } from './errors';
import type { IntegracionesScope } from './integraciones-scope';
import type { CandidateModel } from './model-fallback';

import type { AiModelPairRepository } from '../ports/ai-model-pair-repository';
import type { AiProviderCatalog } from '../ports/ai-provider-catalog';
import type { AiProviderConnectionRepository } from '../ports/ai-provider-connection-repository';
import type { ConversationalTool, ConversationTurn } from '../ports/conversational-model';
import type { SecretCipher } from '../ports/secret-cipher';

export type ConversationModelDeps = {
  readonly connections: AiProviderConnectionRepository;
  readonly catalog: AiProviderCatalog;
  readonly pairs: AiModelPairRepository;
  readonly cipher: SecretCipher;
};

/** Lleva la key en claro: no sale de los casos de uso de generación salvo hacia el puerto del modelo. */
export type ConversationModelResolution =
  | { readonly status: 'missing' }
  | { readonly status: 'unreadable' }
  | { readonly status: 'no_model_pair' }
  | { readonly status: 'ready'; readonly primary: CandidateModel; readonly fallback: CandidateModel };

export const MAX_STEPS_LIMIT = 8;
const TOOL_NAME = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * El modelo sale del par de plataforma del proveedor de la empresa; el modelo que la empresa eligió
 * en su conexión es para leer PDF y aquí no se lee. Una key ilegible no marca la conexión: quien
 * genera no decide sobre su estado.
 */
export async function resolveConversationModel(
  deps: ConversationModelDeps,
  companyId: string,
  role: AiModelRole,
): Promise<ConversationModelResolution> {
  const scope: IntegracionesScope = { companyId };
  const record = await deps.connections.find(scope);
  if (record === null) return { status: 'missing' };

  let apiKey: string;
  try {
    apiKey = await deps.cipher.decrypt(record.apiKeyEnc, aiProviderKeyContext(record.id, scope));
  } catch (error) {
    if (error instanceof SecretUnreadableError) return { status: 'unreadable' };
    throw error;
  }

  const pair = await deps.pairs.get(record.provider, role);
  if (pair === null) return { status: 'no_model_pair' };

  const entry = await deps.catalog.get(record.provider);
  if (entry === null) {
    throw new Error(`integraciones: el catálogo no trae el proveedor ${record.provider} de la conexión`);
  }

  return {
    status: 'ready',
    primary: candidate(record.provider, pair.primaryModelId, apiKey, entry),
    fallback: candidate(record.provider, pair.fallbackModelId, apiKey, entry),
  };
}

/** Un modelo que ya no está en el catálogo cuenta como sin herramientas: no se le ofrecen. */
function candidate(provider: AiProviderCode, model: string, apiKey: string, entry: AiCatalogEntry): CandidateModel {
  const listed = entry.models.find((option) => option.modelId === model);
  return { provider, model, apiKey, supportsTools: listed?.supportsTools ?? false };
}

/** Errores de programación de quien llama: se lanzan antes de leer la conexión. */
export function assertConversationRequest(request: {
  readonly role: AiModelRole;
  readonly turns: readonly ConversationTurn[];
  readonly timeoutMs: number;
}): void {
  if (!AI_MODEL_ROLES.includes(request.role)) {
    throw new Error(`integraciones: rol de modelo desconocido: ${String(request.role)}`);
  }
  if (!Number.isInteger(request.timeoutMs) || request.timeoutMs <= 0) {
    throw new Error('integraciones: el plazo de la generación tiene que ser un entero de milisegundos mayor que cero');
  }
  if (request.turns.length === 0) {
    throw new Error('integraciones: la generación necesita al menos un turno');
  }
  if (request.turns[request.turns.length - 1]?.role !== 'user') {
    throw new Error('integraciones: el último turno de la generación tiene que ser del usuario');
  }
}

export function assertToolRequest(request: {
  readonly tools: readonly ConversationalTool[];
  readonly maxSteps: number;
}): void {
  if (!Number.isInteger(request.maxSteps) || request.maxSteps < 1 || request.maxSteps > MAX_STEPS_LIMIT) {
    throw new Error(`integraciones: el tope de pasos tiene que ser un entero entre 1 y ${MAX_STEPS_LIMIT}`);
  }
  const seen = new Set<string>();
  for (const tool of request.tools) {
    if (!TOOL_NAME.test(tool.name)) {
      throw new Error(`integraciones: nombre de herramienta fuera de formato: ${JSON.stringify(tool.name)}`);
    }
    if (seen.has(tool.name)) {
      throw new Error(`integraciones: herramienta repetida: ${tool.name}`);
    }
    seen.add(tool.name);
  }
}
