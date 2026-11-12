import {
  LinkedCustomerNotFoundError,
  WhatsappContactBlockedError,
  WhatsappContactLinkedElsewhereError,
  WhatsappCustomerWithoutPhoneError,
  WhatsappTemplateNotSendableError,
} from './errors';
import type { IntegracionesScope } from './integraciones-scope';
import type {
  WhatsappEnqueueOutcome,
  WhatsappEnqueueSkipReason,
  WhatsappNotifier,
  WhatsappTemplateRef,
} from './whatsapp-notifier';
import { WHATSAPP_SEND_JOB_KIND } from './whatsapp-send-job';
import { recipientByCustomer, type WhatsappSendRecipientDeps } from './whatsapp-send-recipient';
import {
  buildTemplateMessage,
  isSendable,
  type OwnVariableValue,
  type TemplateMessage,
} from './whatsapp-template-message';

import type { IntegrationsSwitch } from '../ports/integrations-switch';
import type { WhatsappConnectionRepository } from '../ports/whatsapp-connection-repository';
import type { WhatsappOutboxRepository } from '../ports/whatsapp-outbox-repository';
import type { WhatsappQueueLog } from '../ports/whatsapp-queue-log';
import type { WhatsappSendQueue } from '../ports/whatsapp-send-queue';
import type { WhatsappSendQueueRepository } from '../ports/whatsapp-send-queue-repository';
import type { WhatsappTemplateRepository } from '../ports/whatsapp-template-repository';
import type { WhatsappVariableKeyRepository } from '../ports/whatsapp-variable-key-repository';

export type EnqueueWhatsappMessageDeps = WhatsappSendRecipientDeps & {
  readonly integrations: IntegrationsSwitch;
  readonly connections: Pick<WhatsappConnectionRepository, 'findLive'>;
  readonly templates: Pick<WhatsappTemplateRepository, 'findLiveByNameAndLanguage'>;
  readonly variableKeys: Pick<WhatsappVariableKeyRepository, 'listAll'>;
  readonly outbox: Pick<
    WhatsappOutboxRepository,
    'findContact' | 'findContactsByWaIds' | 'ensureContact' | 'linkContact' | 'touchContact'
  >;
  readonly queueStore: Pick<WhatsappSendQueueRepository, 'insertQueued' | 'recordPublished'>;
  readonly queue: WhatsappSendQueue;
  readonly log: WhatsappQueueLog;
  readonly now?: () => Date;
};

class EnqueueSkipped extends Error {
  constructor(
    readonly reason: WhatsappEnqueueSkipReason,
    readonly missing: readonly string[] = [],
  ) {
    super(reason);
  }
}

function skipReasonOf(error: unknown): WhatsappEnqueueSkipReason | null {
  if (error instanceof LinkedCustomerNotFoundError) return 'customer_not_found';
  if (error instanceof WhatsappCustomerWithoutPhoneError) return 'no_phone';
  if (error instanceof WhatsappContactLinkedElsewhereError) return 'contact_linked_elsewhere';
  if (error instanceof WhatsappContactBlockedError) return 'contact_blocked';
  if (error instanceof WhatsappTemplateNotSendableError) return 'template_not_sendable';
  return null;
}

function errorNameOf(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

async function templateMessageFor(
  deps: EnqueueWhatsappMessageDeps,
  connectionId: string,
  ref: WhatsappTemplateRef,
  values: Readonly<Record<string, string>>,
  scope: IntegracionesScope,
): Promise<TemplateMessage> {
  const template = await deps.templates.findLiveByNameAndLanguage(connectionId, ref.name, ref.language, scope);
  if (template === null) throw new EnqueueSkipped('template_not_found');
  if (!isSendable(template)) throw new EnqueueSkipped('template_not_sendable');
  const ownValues = new Map<string, OwnVariableValue>(
    (await deps.variableKeys.listAll(scope)).map((record) => [record.id, { key: record.key, value: record.value }]),
  );
  const built = buildTemplateMessage(template, ownValues, values, {});
  if (!built.ok) {
    throw new EnqueueSkipped(
      'template_values_missing',
      built.missing.map((entry) => entry.key),
    );
  }
  return built.message;
}

/**
 * La plantilla se resuelve antes que el destinatario: resolverlo puede crear o vincular el
 * contacto, y una omisión no debe dejar ninguna escritura.
 */
export function createWhatsappNotifier(deps: EnqueueWhatsappMessageDeps): WhatsappNotifier {
  const now = deps.now ?? (() => new Date());

  async function enqueueOrSkip(
    companyId: string,
    customerId: string,
    ref: WhatsappTemplateRef,
    values: Readonly<Record<string, string>>,
  ): Promise<WhatsappEnqueueOutcome> {
    const scope: IntegracionesScope = { companyId };

    if (!(await deps.integrations.isOn(companyId))) throw new EnqueueSkipped('addon_off');
    const connection = await deps.connections.findLive(scope);
    if (connection === null || connection.status !== 'ACTIVE') throw new EnqueueSkipped('no_active_connection');

    const message = await templateMessageFor(deps, connection.id, ref, values, scope);
    const { contact } = await recipientByCustomer(deps, customerId, {
      connectionId: connection.id,
      actorId: null,
      scope,
    });

    const { id } = await deps.queueStore.insertQueued(
      {
        connectionId: connection.id,
        contactId: contact.id,
        body: message.body,
        templateName: message.name,
        templateLanguage: message.language,
        payload: { ...message.values },
        templateComponents: message.components,
      },
      scope,
    );
    await deps.outbox.touchContact(contact.id, now(), scope);

    let queueMessageId: string;
    try {
      queueMessageId = await deps.queue.publish({ kind: WHATSAPP_SEND_JOB_KIND, messageId: id, companyId });
    } catch {
      deps.log.error('whatsapp_enqueue_publish_failed', { messageId: id });
      return { status: 'queued', messageId: id, published: false };
    }
    await deps.queueStore.recordPublished(id, queueMessageId, scope);
    return { status: 'queued', messageId: id, published: true };
  }

  return {
    async enqueue(companyId, customerId, template, values) {
      try {
        return await enqueueOrSkip(companyId, customerId, template, values);
      } catch (error) {
        const reason = error instanceof EnqueueSkipped ? error.reason : skipReasonOf(error);
        if (reason === null) {
          deps.log.error('whatsapp_enqueue_failed', { companyId, customerId, error: errorNameOf(error) });
          return { status: 'skipped', reason: 'error' };
        }
        const fields = { companyId, customerId, reason };
        const missing = error instanceof EnqueueSkipped ? error.missing : [];
        deps.log.warn('whatsapp_enqueue_skipped', missing.length > 0 ? { ...fields, missing: missing.join(',') } : fields);
        return { status: 'skipped', reason };
      }
    },
  };
}
