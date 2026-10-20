import { ACCESS_TOKEN_FIELD, decryptStoredSecret } from './connection-secrets';
import type { IntegracionesScope } from './integraciones-scope';
import {
  syncConnectionTemplates,
  syncFailureCodeOf,
  type SyncTemplatesGraph,
} from './sync-whatsapp-templates';

import type { IntegrationsSwitch } from '../ports/integrations-switch';
import type { SecretCipher } from '../ports/secret-cipher';
import type { WhatsappConnectionRepository } from '../ports/whatsapp-connection-repository';
import type { WhatsappTemplateRepository } from '../ports/whatsapp-template-repository';

export type SyncAllWhatsappTemplatesDeps = {
  readonly listCompanyIds: () => Promise<readonly string[]>;
  readonly integrations: IntegrationsSwitch;
  readonly connections: WhatsappConnectionRepository;
  readonly cipher: SecretCipher;
  readonly graph: SyncTemplatesGraph;
  readonly templates: WhatsappTemplateRepository;
  readonly now?: () => Date;
  /** Inyectable solo para que el test no espere el presupuesto real. */
  readonly budgetMs?: number;
};

/** Sin mensaje: solo dónde falló y el código del catálogo, para una línea de log. */
export type SyncAllFailure =
  | { readonly stage: 'companies'; readonly code: string }
  | { readonly stage: 'connection'; readonly companyId: string; readonly code: string };

export type SyncAllResult = {
  readonly synced: number;
  readonly failed: readonly SyncAllFailure[];
};

const DEFAULT_BUDGET_MS = 240_000;

/**
 * Sin actor: lo dispara el cron, cuya única puerta es su secreto. Cada consulta lleva el ámbito de
 * una sola empresa, y una conexión que falla no detiene a las demás.
 */
export function createSyncAllWhatsappTemplates(
  deps: SyncAllWhatsappTemplatesDeps,
): () => Promise<SyncAllResult> {
  const budgetMs = deps.budgetMs ?? DEFAULT_BUDGET_MS;

  return async function syncAllWhatsappTemplates() {
    const deadline = Date.now() + budgetMs;
    let synced = 0;
    const failed: SyncAllFailure[] = [];

    let companyIds: readonly string[];
    try {
      companyIds = await deps.listCompanyIds();
    } catch (error) {
      failed.push({ stage: 'companies', code: syncFailureCodeOf(error) });
      return { synced, failed };
    }

    for (const companyId of companyIds) {
      if (Date.now() >= deadline) break;
      const scope: IntegracionesScope = { companyId };
      try {
        if (!(await deps.integrations.isOn(companyId))) continue;
        const record = await deps.connections.findLive(scope);
        if (record === null || record.status !== 'ACTIVE') continue;
        const accessToken = await decryptStoredSecret(deps, record, ACCESS_TOKEN_FIELD, scope);
        await syncConnectionTemplates(deps, record, accessToken, scope);
        synced += 1;
      } catch (error) {
        failed.push({ stage: 'connection', companyId, code: syncFailureCodeOf(error) });
      }
    }

    return { synced, failed };
  };
}
