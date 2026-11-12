import type { IntegracionesScope } from './integraciones-scope';
import { WHATSAPP_SEND_JOB_KIND } from './whatsapp-send-job';
import {
  maxAttemptsOf,
  NOT_DELIVERABLE_REASON,
  QUEUED_STALE_MS,
  RETRIES_EXHAUSTED_REASON,
  SENDING_STUCK_MS,
  SENDING_STUCK_REASON,
} from './whatsapp-send-retry-policy';
import { syncFailureCodeOf } from './sync-whatsapp-templates';

import type { IntegrationsSwitch } from '../ports/integrations-switch';
import type { WhatsappQueueLog } from '../ports/whatsapp-queue-log';
import type { WhatsappSendConfig } from '../ports/whatsapp-send-config';
import type { WhatsappSendQueue } from '../ports/whatsapp-send-queue';
import type { WhatsappSendQueueRepository } from '../ports/whatsapp-send-queue-repository';

/** Lo que una pasada vuelve a publicar por empresa; lo demás sale en la pasada siguiente. */
export const SWEEP_BATCH = 100;

const DEFAULT_BUDGET_MS = 240_000;

export type SweepWhatsappSendsDeps = {
  readonly listCompanyIds: () => Promise<readonly string[]>;
  readonly integrations: IntegrationsSwitch;
  readonly queueStore: Pick<
    WhatsappSendQueueRepository,
    'listStaleQueued' | 'recordPublished' | 'failExhausted' | 'failStaleQueued' | 'failStuckSending'
  >;
  readonly queue: WhatsappSendQueue;
  readonly config: WhatsappSendConfig;
  readonly log: WhatsappQueueLog;
  readonly now?: () => Date;
  /** Inyectable solo para que el test no espere el presupuesto real. */
  readonly budgetMs?: number;
};

/** Sin datos de los mensajes: cuántos, y qué empresa falló con qué código. */
export type SweepResult = {
  readonly republished: number;
  readonly failed: number;
  readonly companiesFailed: readonly { readonly companyId: string; readonly code: string }[];
};

type CompanyTally = { republished: number; failed: number };

async function republishStale(
  deps: SweepWhatsappSendsDeps,
  before: Date,
  maxAttempts: number,
  scope: IntegracionesScope,
  tally: CompanyTally,
): Promise<void> {
  const ids = await deps.queueStore.listStaleQueued(before, maxAttempts, SWEEP_BATCH, scope);
  for (const messageId of ids) {
    try {
      const queueMessageId = await deps.queue.publish({
        kind: WHATSAPP_SEND_JOB_KIND,
        messageId,
        companyId: scope.companyId,
      });
      await deps.queueStore.recordPublished(messageId, queueMessageId, scope);
      tally.republished += 1;
    } catch {
      deps.log.warn('whatsapp_sweep_publish_failed', { messageId });
    }
  }
}

/**
 * Un `SENDING` colgado se cierra y nunca se republica: no se sabe si Meta lo recibió. Con el
 * añadido apagado nada se republica y lo que sigue en cola se da por no enviable.
 */
async function sweepCompany(
  deps: SweepWhatsappSendsDeps,
  scope: IntegracionesScope,
  at: Date,
  maxAttempts: number,
  tally: CompanyTally,
): Promise<void> {
  const queuedBefore = new Date(at.getTime() - QUEUED_STALE_MS);
  const sendingBefore = new Date(at.getTime() - SENDING_STUCK_MS);

  tally.failed += await deps.queueStore.failStuckSending(sendingBefore, SENDING_STUCK_REASON, scope);
  tally.failed += await deps.queueStore.failExhausted(maxAttempts, RETRIES_EXHAUSTED_REASON, scope);

  if (!(await deps.integrations.isOn(scope.companyId))) {
    tally.failed += await deps.queueStore.failStaleQueued(queuedBefore, NOT_DELIVERABLE_REASON, scope);
    return;
  }
  await republishStale(deps, queuedBefore, maxAttempts, scope, tally);
}

/** Sin actor: lo dispara el cron. Empresas de una en una, y una que falla no detiene a las demás. */
export function createSweepWhatsappSends(deps: SweepWhatsappSendsDeps): () => Promise<SweepResult> {
  const now = deps.now ?? (() => new Date());
  const budgetMs = deps.budgetMs ?? DEFAULT_BUDGET_MS;

  return async function sweepWhatsappSends() {
    const deadline = Date.now() + budgetMs;
    const maxAttempts = maxAttemptsOf(deps.config.maxRetries());
    const tally: CompanyTally = { republished: 0, failed: 0 };
    const companiesFailed: { companyId: string; code: string }[] = [];

    for (const companyId of await deps.listCompanyIds()) {
      if (Date.now() >= deadline) break;
      try {
        await sweepCompany(deps, { companyId }, now(), maxAttempts, tally);
      } catch (error) {
        const code = syncFailureCodeOf(error);
        deps.log.error('whatsapp_sweep_company_failed', { companyId, code });
        companiesFailed.push({ companyId, code });
      }
    }

    return { republished: tally.republished, failed: tally.failed, companiesFailed };
  };
}
