import {
  isAccountFailure,
  READING_FAILURE_PREFIX,
  readingFailureMessage,
  type AiProviderFailure,
} from './ai-provider-failure';
import type { IntegracionesScope } from './integraciones-scope';

import type { AiProviderCatalog } from '../ports/ai-provider-catalog';
import type { AiProviderConnectionRepository } from '../ports/ai-provider-connection-repository';

export type ReportAiProviderOutcomeDeps = {
  readonly connections: AiProviderConnectionRepository;
  readonly catalog: AiProviderCatalog;
  readonly now?: () => Date;
};

export type AiProviderReadingOutcome =
  | { readonly kind: 'account_failure'; readonly failure: AiProviderFailure }
  | { readonly kind: 'recovered' };

/**
 * Solo un fallo de la cuenta marca la conexión; la red, el plazo o un modelo caído no dicen nada
 * de la key. Si la empresa desconectó a mitad de la lectura, no queda fila que marcar.
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
        { status: 'ACTIVE', lastError: null, lastErrorAt: null },
        scope,
      );
      return;
    }

    if (!isAccountFailure(outcome.failure)) return;
    const entry = await deps.catalog.get(record.provider);
    if (entry === null) {
      throw new Error(`integraciones: el catálogo no trae el proveedor ${record.provider} de la conexión`);
    }
    await deps.connections.update(
      record.id,
      {
        status: 'ERROR',
        lastError: READING_FAILURE_PREFIX + readingFailureMessage(outcome.failure, entry.name),
        lastErrorAt: now(),
      },
      scope,
    );
  };
}
