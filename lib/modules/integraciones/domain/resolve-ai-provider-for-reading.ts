import type {
  AiProviderCode,
  AiProviderConnectionStatus,
  AiProviderEntry,
  AiReadUse,
} from './ai-provider';
import { SecretUnreadableError } from './errors';
import type { IntegracionesScope } from './integraciones-scope';
import { decryptStoredKey } from './test-saved-ai-provider';

import type { AiProviderCatalog } from '../ports/ai-provider-catalog';
import type { AiProviderConnectionRepository } from '../ports/ai-provider-connection-repository';
import type { SecretCipher } from '../ports/secret-cipher';

export type ResolveAiProviderForReadingDeps = {
  readonly connections: AiProviderConnectionRepository;
  readonly catalog: AiProviderCatalog;
  readonly cipher: SecretCipher;
  readonly now?: () => Date;
};

/**
 * Lleva la key en claro: solo la consume quien construye el lector del proveedor, y no se
 * registra ni sale hacia la pantalla.
 */
export type AiProviderReadingResolution =
  | { readonly status: 'missing' }
  | { readonly status: 'unreadable' }
  | {
      readonly status: 'ready';
      readonly provider: AiProviderCode;
      readonly model: string;
      readonly apiKey: string;
      readonly connectionStatus: AiProviderConnectionStatus;
    };

export type AiProviderStatus = {
  readonly provider: AiProviderCode;
  readonly connectionStatus: AiProviderConnectionStatus;
};

function modelFor(entry: AiProviderEntry, use: AiReadUse): string {
  return use === 'recipe' ? entry.recipeModel : entry.catalogModel;
}

/**
 * Sin actor: la empresa sale de la fila del archivo que la cola reclamó. El modelo se lee del
 * catálogo en cada llamada para que un cambio del catálogo llegue a la siguiente lectura.
 */
export function createResolveAiProviderForReading(
  deps: ResolveAiProviderForReadingDeps,
): (companyId: string, use: AiReadUse) => Promise<AiProviderReadingResolution> {
  const now = deps.now ?? (() => new Date());

  return async function resolveAiProviderForReading(companyId, use) {
    const scope: IntegracionesScope = { companyId };
    const record = await deps.connections.find(scope);
    if (record === null) return { status: 'missing' };

    const entry = await deps.catalog.get(record.provider);
    if (entry === null) {
      throw new Error(`integraciones: el catálogo no trae el proveedor ${record.provider} de la conexión`);
    }

    let apiKey: string;
    try {
      apiKey = await decryptStoredKey({ ...deps, now }, record, scope);
    } catch (error) {
      if (error instanceof SecretUnreadableError) return { status: 'unreadable' };
      throw error;
    }

    return {
      status: 'ready',
      provider: record.provider,
      model: modelFor(entry, use),
      apiKey,
      connectionStatus: record.status,
    };
  };
}

/** Sin descifrar nada: basta para saber si la empresa puede leer PDF. */
export function createGetAiProviderStatus(deps: {
  readonly connections: AiProviderConnectionRepository;
}): (companyId: string) => Promise<AiProviderStatus | null> {
  return async function getAiProviderStatus(companyId) {
    const record = await deps.connections.find({ companyId });
    return record === null ? null : { provider: record.provider, connectionStatus: record.status };
  };
}
