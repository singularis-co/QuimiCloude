import { ACCESS_TOKEN_FIELD, decryptStoredSecret } from './connection-secrets';
import { SecretUnreadableError } from './errors';
import type { IntegracionesScope } from './integraciones-scope';
import type { WhatsappSendJob } from './whatsapp-send-job';
import { sendDiagnosticOf, sendFailureOf, TOKEN_INVALID_MESSAGE } from './whatsapp-send-failure';
import { isTemporarySendFailure, maxAttemptsOf, NOT_DELIVERABLE_REASON } from './whatsapp-send-retry-policy';

import type { IntegrationsSwitch } from '../ports/integrations-switch';
import type { SecretCipher } from '../ports/secret-cipher';
import type { WhatsappConnectionRepository } from '../ports/whatsapp-connection-repository';
import type { WhatsappGraphClient } from '../ports/whatsapp-graph-client';
import type { WhatsappOutboxRepository } from '../ports/whatsapp-outbox-repository';
import type { WhatsappSendConfig } from '../ports/whatsapp-send-config';
import type { WhatsappSendLog } from '../ports/whatsapp-send-log';
import type { WhatsappSendQueueRepository } from '../ports/whatsapp-send-queue-repository';

export type ProcessWhatsappSendDeps = {
  readonly integrations: IntegrationsSwitch;
  readonly connections: WhatsappConnectionRepository;
  readonly cipher: SecretCipher;
  readonly queueStore: Pick<WhatsappSendQueueRepository, 'claim' | 'release'>;
  readonly outbox: Pick<WhatsappOutboxRepository, 'findContact' | 'markSent' | 'markFailed'>;
  readonly graph: Pick<WhatsappGraphClient, 'sendMessage'>;
  readonly config: WhatsappSendConfig;
  readonly sendLog: WhatsappSendLog;
};

/** `requeue` pide a la cola que vuelva a entregar el trabajo; `done`, que lo dé por terminado. */
export type WhatsappSendJobResult = 'done' | 'requeue';

export type ProcessWhatsappSend = (job: WhatsappSendJob) => Promise<WhatsappSendJobResult>;

type Deliverable = { readonly phoneNumberId: string; readonly accessToken: string; readonly waId: string };

async function deliverableOf(
  deps: ProcessWhatsappSendDeps,
  connectionId: string,
  contactId: string,
  scope: IntegracionesScope,
): Promise<Deliverable | null> {
  if (!(await deps.integrations.isOn(scope.companyId))) return null;
  const connection = await deps.connections.findLive(scope);
  if (connection === null || connection.status !== 'ACTIVE' || connection.id !== connectionId) return null;
  const contact = await deps.outbox.findContact(contactId, connectionId, scope);
  if (contact === null || contact.blockedAt !== null) return null;
  try {
    const accessToken = await decryptStoredSecret(deps, connection, ACCESS_TOKEN_FIELD, scope);
    return { phoneNumberId: connection.phoneNumberId, accessToken, waId: contact.waId };
  } catch (error) {
    if (error instanceof SecretUnreadableError) return null;
    throw error;
  }
}

/**
 * Sin actor: la única puerta es la firma de la cola, y la empresa viaja firmada en el trabajo. El
 * candado es el reclamo por estado, así que una entrega repetida no vuelve a llamar a Meta.
 */
export function createProcessWhatsappSend(deps: ProcessWhatsappSendDeps): ProcessWhatsappSend {
  return async function processWhatsappSend(job) {
    const scope: IntegracionesScope = { companyId: job.companyId };
    const maxAttempts = maxAttemptsOf(deps.config.maxRetries());

    const claimed = await deps.queueStore.claim(job.messageId, maxAttempts, scope);
    if (claimed === null) return 'done';

    const target = await deliverableOf(deps, claimed.connectionId, claimed.contactId, scope);
    if (target === null) {
      await deps.outbox.markFailed(claimed.id, null, NOT_DELIVERABLE_REASON, scope);
      return 'done';
    }

    const sent = await deps.graph.sendMessage({
      phoneNumberId: target.phoneNumberId,
      accessToken: target.accessToken,
      to: target.waId,
      message: {
        type: 'template',
        name: claimed.templateName,
        language: claimed.templateLanguage,
        components: claimed.templateComponents,
      },
    });

    // Si el barrido ya lo cerró, `markSent` no cambia nada; reintentar duplicaría lo que Meta aceptó.
    if (sent.ok) {
      await deps.outbox.markSent(claimed.id, sent.wamid, scope);
      return 'done';
    }

    if (isTemporarySendFailure(sent)) {
      await deps.queueStore.release(claimed.id, scope);
      deps.sendLog.sendFailed({ messageId: claimed.id, diagnostic: sendDiagnosticOf(sent) });
      return 'requeue';
    }

    const failure = sendFailureOf(sent);
    await deps.outbox.markFailed(claimed.id, failure.errorCode, failure.errorReason, scope);
    if (failure.effect === 'token_invalid') {
      await deps.connections.update(claimed.connectionId, { status: 'ERROR', lastError: TOKEN_INVALID_MESSAGE }, scope);
    }
    deps.sendLog.sendFailed({ messageId: claimed.id, diagnostic: sendDiagnosticOf(sent) });
    return 'done';
  };
}
