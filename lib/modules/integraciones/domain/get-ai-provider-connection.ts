import { requirePermission, type Actor } from './actor';
import {
  toAiProviderConnectionView,
  type AiProviderConnectionView,
  type AiProviderEntry,
} from './ai-provider';
import { scopeOf } from './integraciones-scope';

import type { AiProviderCatalog } from '../ports/ai-provider-catalog';
import type { AiProviderConnectionRepository } from '../ports/ai-provider-connection-repository';

export type GetAiProviderConnectionDeps = {
  readonly connections: AiProviderConnectionRepository;
  readonly catalog: AiProviderCatalog;
};

/** El catálogo viaja con la conexión porque el formulario ofrece los proveedores. */
export type AiProviderConnectionOverview = {
  readonly providers: readonly AiProviderEntry[];
  readonly connection: AiProviderConnectionView | null;
};

export function createGetAiProviderConnection(
  deps: GetAiProviderConnectionDeps,
): (actor: Actor | null | undefined) => Promise<AiProviderConnectionOverview> {
  return async function getAiProviderConnection(actor) {
    requirePermission(actor);
    const providers = await deps.catalog.list();
    const record = await deps.connections.find(scopeOf(actor));
    if (record === null) return { providers, connection: null };

    const entry = providers.find((candidate) => candidate.code === record.provider);
    if (entry === undefined) {
      throw new Error(`integraciones: el catálogo no trae el proveedor ${record.provider} de la conexión`);
    }
    return { providers, connection: toAiProviderConnectionView(record, entry) };
  };
}
