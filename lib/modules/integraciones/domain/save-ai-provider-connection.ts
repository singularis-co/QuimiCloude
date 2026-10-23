import { requirePermission, type Actor } from './actor';
import {
  aiProviderKeyContext,
  toAiProviderConnectionView,
  type AiProviderCode,
  type AiProviderConnectionRecord,
  type AiProviderConnectionView,
} from './ai-provider';
import { scopeOf, type IntegracionesScope } from './integraciones-scope';
import { modelAfterSaving, parseKeyInput, toTestResult } from './test-ai-provider-key';

import type { AiProviderCatalog } from '../ports/ai-provider-catalog';
import {
  AiProviderConnectionRaceError,
  type AiProviderConnectionRepository,
} from '../ports/ai-provider-connection-repository';
import type { AiProviderProbe } from '../ports/ai-provider-probe';
import type { RandomSource } from '../ports/random-source';
import type { SecretCipher } from '../ports/secret-cipher';

export type SaveAiProviderConnectionDeps = {
  readonly connections: AiProviderConnectionRepository;
  readonly catalog: AiProviderCatalog;
  readonly probe: AiProviderProbe;
  readonly cipher: SecretCipher;
  readonly random: RandomSource;
  readonly now?: () => Date;
};

export type SaveAiProviderConnectionResult =
  | { readonly status: 'saved'; readonly connection: AiProviderConnectionView }
  | { readonly status: 'test_failed'; readonly message: string };

type GoodKey = {
  readonly provider: AiProviderCode;
  readonly apiKey: string;
  readonly checkedAt: Date;
  readonly actorId: string;
};

/**
 * Cifra con el id de la fila que de verdad queda: si cambia de fila, cambia el contexto, y una key
 * cifrada con el id de otra fila no se podría volver a leer.
 */
async function persistOnce(
  deps: SaveAiProviderConnectionDeps,
  key: GoodKey,
  scope: IntegracionesScope,
): Promise<AiProviderConnectionRecord | null> {
  const existing = await deps.connections.find(scope);
  const id = existing?.id ?? deps.random.newId();
  const apiKeyEnc = await deps.cipher.encrypt(key.apiKey, aiProviderKeyContext(id, scope));
  const fresh = {
    provider: key.provider,
    apiKeyEnc,
    status: 'ACTIVE',
    lastError: null,
    lastErrorAt: null,
    lastCheckedAt: key.checkedAt,
    keyUpdatedAt: key.checkedAt,
    updatedById: key.actorId,
  } as const;

  if (existing !== null) {
    // La prueba acaba de pasar con el modelo que queda en uso: ya no hay modelo marcado.
    const sameProvider = existing.provider === key.provider;
    const models = sameProvider ? { unavailableModel: null } : { model: null, unavailableModel: null };
    return deps.connections.update(id, { ...fresh, ...models }, scope);
  }
  return deps.connections.create(
    { ...fresh, model: null, unavailableModel: null, id, createdById: key.actorId },
    scope,
  );
}

/** Si otro guardado de la misma empresa gana la carrera, la segunda vuelta reemplaza su fila. */
async function persist(
  deps: SaveAiProviderConnectionDeps,
  key: GoodKey,
  scope: IntegracionesScope,
): Promise<AiProviderConnectionRecord> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const record = await persistOnce(deps, key, scope);
      if (record !== null) return record;
    } catch (error) {
      if (!(error instanceof AiProviderConnectionRaceError)) throw error;
    }
  }
  throw new AiProviderConnectionRaceError();
}

export function createSaveAiProviderConnection(
  deps: SaveAiProviderConnectionDeps,
): (input: unknown, actor: Actor | null | undefined) => Promise<SaveAiProviderConnectionResult> {
  const now = deps.now ?? (() => new Date());

  return async function saveAiProviderConnection(input, actor) {
    requirePermission(actor);
    const scope = scopeOf(actor);
    const { data, entry } = await parseKeyInput(input, deps.catalog);

    const existing = await deps.connections.find(scope);
    const tested = toTestResult(
      await deps.probe.probe({
        provider: entry.code,
        apiKey: data.apiKey,
        models: [modelAfterSaving(existing, entry)],
      }),
    );
    const checkedAt = now();
    if (!tested.ok) return { status: 'test_failed', message: tested.message };

    const record = await persist(
      deps,
      { provider: data.provider, apiKey: data.apiKey, checkedAt, actorId: actor.id },
      scope,
    );
    return { status: 'saved', connection: toAiProviderConnectionView(record, entry) };
  };
}
