import { hasConfigurePermission, type Actor } from './actor';
import { UnauthorizedError } from './errors';
import { scopeOf } from './integraciones-scope';

import type { AiProviderConnectionRepository } from '../ports/ai-provider-connection-repository';

export type GetAiProviderReadinessDeps = {
  readonly connections: AiProviderConnectionRepository;
};

export type AiProviderReadiness = {
  readonly configured: boolean;
  readonly canConfigure: boolean;
};

/**
 * La consulta quien sube PDF, que no tiene por qué poder configurar: solo exige un actor con
 * empresa, porque de ella sale el ámbito.
 */
export function createGetAiProviderReadiness(
  deps: GetAiProviderReadinessDeps,
): (actor: Actor | null | undefined) => Promise<AiProviderReadiness> {
  return async function getAiProviderReadiness(actor) {
    if (actor === null || actor === undefined || typeof actor.companyId !== 'string' || actor.companyId === '') {
      throw new UnauthorizedError();
    }
    const record = await deps.connections.find(scopeOf(actor));
    return { configured: record !== null, canConfigure: hasConfigurePermission(actor) };
  };
}
