import { requirePermission, type Actor } from './actor';
import { aiProviderKeyContext, modelInUse, type AiProviderConnectionRecord } from './ai-provider';
import { modelUnavailableNotice, probeFailureMessage, UNREADABLE_KEY_MESSAGE } from './ai-provider-failure';
import { SecretUnreadableError } from './errors';
import { scopeOf, type IntegracionesScope } from './integraciones-scope';
import { toTestResult, type AiProviderTestResult } from './test-ai-provider-key';

import type { AiProviderCatalog } from '../ports/ai-provider-catalog';
import type { AiProviderConnectionRepository } from '../ports/ai-provider-connection-repository';
import type { AiProviderProbe } from '../ports/ai-provider-probe';
import type { SecretCipher } from '../ports/secret-cipher';

export type TestSavedAiProviderDeps = {
  readonly connections: AiProviderConnectionRepository;
  readonly catalog: AiProviderCatalog;
  readonly probe: AiProviderProbe;
  readonly cipher: SecretCipher;
  readonly now?: () => Date;
};

/** `not_connected`: otra pestaña desconectó entre la carga de la pantalla y la prueba. */
export type TestSavedAiProviderResult = AiProviderTestResult | { readonly status: 'not_connected' };

/**
 * Una key ilegible no se arregla reintentando: la conexión queda en error pidiendo la key de
 * nuevo y el error sigue su camino.
 */
export async function decryptStoredKey(
  deps: {
    readonly cipher: SecretCipher;
    readonly connections: AiProviderConnectionRepository;
    readonly now: () => Date;
  },
  record: AiProviderConnectionRecord,
  scope: IntegracionesScope,
): Promise<string> {
  try {
    return await deps.cipher.decrypt(record.apiKeyEnc, aiProviderKeyContext(record.id, scope));
  } catch (error) {
    if (error instanceof SecretUnreadableError) {
      await deps.connections.update(
        record.id,
        { status: 'ERROR', lastError: UNREADABLE_KEY_MESSAGE, lastErrorAt: deps.now() },
        scope,
      );
    }
    throw error;
  }
}

export function createTestSavedAiProvider(
  deps: TestSavedAiProviderDeps,
): (actor: Actor | null | undefined) => Promise<TestSavedAiProviderResult> {
  const now = deps.now ?? (() => new Date());

  return async function testSavedAiProvider(actor) {
    requirePermission(actor);
    const scope = scopeOf(actor);

    const record = await deps.connections.find(scope);
    if (record === null) return { status: 'not_connected' };

    const apiKey = await decryptStoredKey({ ...deps, now }, record, scope);
    const entry = await deps.catalog.get(record.provider);
    if (entry === null) {
      throw new Error(`integraciones: el catálogo no trae el proveedor ${record.provider} de la conexión`);
    }

    const model = modelInUse(record, entry);
    const probed = await deps.probe.probe({ provider: record.provider, apiKey, models: [model] });
    const result = toTestResult(probed);
    const checkedAt = now();

    if (probed.ok) {
      await deps.connections.update(
        record.id,
        { status: 'ACTIVE', lastCheckedAt: checkedAt, lastError: null, lastErrorAt: null, unavailableModel: null },
        scope,
      );
      return result;
    }

    if (probed.failure.kind === 'model_unavailable') {
      const missing = probed.failure.model;
      await deps.connections.update(
        record.id,
        {
          status: 'ERROR',
          unavailableModel: missing,
          lastError: modelUnavailableNotice(missing, entry.name, missing === record.model),
          lastErrorAt: checkedAt,
        },
        scope,
      );
      return result;
    }

    await deps.connections.update(
      record.id,
      { status: 'ERROR', lastError: probeFailureMessage(probed.failure), lastErrorAt: checkedAt },
      scope,
    );
    return result;
  };
}
