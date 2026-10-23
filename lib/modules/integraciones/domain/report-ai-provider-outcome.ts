import {
  isAccountFailure,
  modelUnavailableNotice,
  READING_FAILURE_PREFIX,
  readingFailureMessage,
  type AiProviderFailure,
} from './ai-provider-failure';
import type { IntegracionesScope } from './integraciones-scope';

import type { AiProviderCatalog } from '../ports/ai-provider-catalog';
import type {
  AiProviderConnectionPatch,
  AiProviderConnectionRepository,
} from '../ports/ai-provider-connection-repository';

export type ReportAiProviderOutcomeDeps = {
  readonly connections: AiProviderConnectionRepository;
  readonly catalog: AiProviderCatalog;
  readonly now?: () => Date;
};

export type AiProviderReadingOutcome =
  | { readonly kind: 'connection_failure'; readonly failure: AiProviderFailure }
  | { readonly kind: 'recovered' };

/**
 * La red, el plazo o un error inesperado no dicen nada de la key ni del modelo: no marcan la
 * conexión. Si la empresa desconectó a mitad de la lectura, no queda fila que marcar.
 */
export function createReportAiProviderOutcome(
  deps: ReportAiProviderOutcomeDeps,
): (companyId: string, outcome: AiProviderReadingOutcome) => Promise<void> {
  const now = deps.now ?? (() => new Date());

  return async function reportAiProviderOutcome(companyId, outcome) {
    const scope: IntegracionesScope = { companyId };
    const record = await deps.connections.find(scope);
    if (record === null) return;

    if (outcome.kind === 'recovered') {
      if (record.status !== 'ERROR') return;
      await deps.connections.update(
        record.id,
        { status: 'ACTIVE', lastError: null, lastErrorAt: null, unavailableModel: null },
        scope,
      );
      return;
    }

    const { failure } = outcome;
    if (failure.kind !== 'model_unavailable' && !isAccountFailure(failure)) return;
    const entry = await deps.catalog.get(record.provider);
    if (entry === null) {
      throw new Error(`integraciones: el catálogo no trae el proveedor ${record.provider} de la conexión`);
    }

    const patch: AiProviderConnectionPatch =
      failure.kind === 'model_unavailable'
        ? {
            status: 'ERROR',
            unavailableModel: failure.model,
            lastError:
              READING_FAILURE_PREFIX + modelUnavailableNotice(failure.model, entry.name, failure.model === record.model),
            lastErrorAt: now(),
          }
        : {
            status: 'ERROR',
            lastError: READING_FAILURE_PREFIX + readingFailureMessage(failure, entry.name),
            lastErrorAt: now(),
          };
    await deps.connections.update(record.id, patch, scope);
  };
}
