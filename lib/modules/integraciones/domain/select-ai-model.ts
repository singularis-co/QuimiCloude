import { requirePermission, type Actor } from './actor';
import { aiModelInputSchema } from './ai-model-input';
import {
  aiProviderKeyContext,
  toAiProviderConnectionView,
  type AiProviderConnectionRecord,
  type AiProviderConnectionView,
  type AiProviderEntry,
} from './ai-provider';
import { isAccountFailureNotice, isModelUnavailableNotice, probeFailureMessage } from './ai-provider-failure';
import { ValidationError } from './errors';
import { scopeOf } from './integraciones-scope';

import type { AiProviderCatalog } from '../ports/ai-provider-catalog';
import type {
  AiProviderConnectionPatch,
  AiProviderConnectionRepository,
} from '../ports/ai-provider-connection-repository';
import type { AiProviderProbe } from '../ports/ai-provider-probe';
import type { SecretCipher } from '../ports/secret-cipher';

export type SelectAiModelDeps = {
  readonly connections: AiProviderConnectionRepository;
  readonly catalog: AiProviderCatalog;
  readonly cipher: SecretCipher;
  readonly probe: AiProviderProbe;
};

/** `not_connected`: otra pestaña desconectó entre la carga de la pantalla y la elección. */
export type SelectAiModelResult =
  | { readonly status: 'saved'; readonly connection: AiProviderConnectionView }
  | { readonly status: 'not_connected' }
  | { readonly status: 'rejected'; readonly message: string };

/**
 * La consulta acaba de pasar con la key guardada y el modelo nuevo: eso desmiente un error de key,
 * de cuota o del modelo anterior. Un error de red o inesperado no lo desmiente y se queda.
 */
function choicePatch(
  record: AiProviderConnectionRecord,
  entry: AiProviderEntry,
  modelId: string,
  actorId: string,
): AiProviderConnectionPatch {
  const cleared =
    record.status === 'ERROR' &&
    (isModelUnavailableNotice(record.lastError) || isAccountFailureNotice(record.lastError, entry.name));
  return {
    model: modelId === entry.defaultModel ? null : modelId,
    updatedById: actorId,
    ...(record.unavailableModel !== null ? { unavailableModel: null } : {}),
    ...(cleared ? { status: 'ACTIVE', lastError: null, lastErrorAt: null } : {}),
  };
}

export function createSelectAiModel(
  deps: SelectAiModelDeps,
): (input: unknown, actor: Actor | null | undefined) => Promise<SelectAiModelResult> {
  return async function selectAiModel(input, actor) {
    requirePermission(actor);
    const parsed = aiModelInputSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { modelId } = parsed.data;

    const scope = scopeOf(actor);
    const record = await deps.connections.find(scope);
    if (record === null) return { status: 'not_connected' };

    const entry = await deps.catalog.get(record.provider);
    if (entry === null) {
      throw new Error(`integraciones: el catálogo no trae el proveedor ${record.provider} de la conexión`);
    }
    if (!entry.models.some((option) => option.modelId === modelId) || modelId === record.unavailableModel) {
      throw new ValidationError('modelo fuera del catálogo del proveedor conectado');
    }

    // Sin marcar la conexión: elegir no es «Probar conexión», y una key ilegible ya se avisa al elegir.
    const apiKey = await deps.cipher.decrypt(record.apiKeyEnc, aiProviderKeyContext(record.id, scope));

    const probed = await deps.probe.probe({ provider: record.provider, apiKey, models: [modelId] });
    if (!probed.ok) return { status: 'rejected', message: probeFailureMessage(probed.failure) };

    const updated = await deps.connections.update(
      record.id,
      choicePatch(record, entry, modelId, actor.id),
      scope,
    );
    if (updated === null) return { status: 'not_connected' };
    return { status: 'saved', connection: toAiProviderConnectionView(updated, entry) };
  };
}
