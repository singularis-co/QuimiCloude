import { requirePermission, type Actor } from './actor';
import { scopeOf } from './integraciones-scope';

import type { AiProviderConnectionRepository } from '../ports/ai-provider-connection-repository';

export type DisconnectAiProviderDeps = {
  readonly connections: AiProviderConnectionRepository;
};

export type DisconnectAiProviderResult = { readonly status: 'disconnected' };

/** Borra la fila con su key cifrada; sin conexión no hay nada que borrar y tampoco es un error. */
export function createDisconnectAiProvider(
  deps: DisconnectAiProviderDeps,
): (actor: Actor | null | undefined) => Promise<DisconnectAiProviderResult> {
  return async function disconnectAiProvider(actor) {
    requirePermission(actor);
    await deps.connections.delete(scopeOf(actor));
    return { status: 'disconnected' };
  };
}
