import { requireSendPermission, type Actor } from './actor';
import {
  ValidationError,
  WhatsappMessageNotFoundError,
  WhatsappMessageNotRetryableError,
  WhatsappTemplateNotFoundError,
} from './errors';
import { scopeOf, type IntegracionesScope } from './integraciones-scope';
import type { OutboundContact, OutboundMessageRecord } from './whatsapp-outbound-message';
import { retryWhatsappMessageSchema } from './whatsapp-send-input';
import { recipientByContact } from './whatsapp-send-recipient';
import {
  deliver,
  requireActiveConnection,
  templateContent,
  textContent,
  type SendContent,
  type SendWhatsappMessageDeps,
  type TemplateValues,
  type WhatsappSendOutcome,
} from './send-whatsapp-message';

export type RetryWhatsappMessageDeps = SendWhatsappMessageDeps;

type RetryableMessage =
  | { readonly type: 'TEXT'; readonly body: string }
  | { readonly type: 'TEMPLATE'; readonly templateName: string; readonly templateLanguage: string };

function retryableOf(failed: OutboundMessageRecord): RetryableMessage {
  if (failed.status !== 'FAILED' || failed.direction !== 'OUT' || failed.origin !== 'USER') {
    throw new WhatsappMessageNotRetryableError();
  }
  if (failed.type === 'TEXT' && failed.body !== null) return { type: 'TEXT', body: failed.body };
  if (failed.type === 'TEMPLATE' && failed.templateName !== null && failed.templateLanguage !== null) {
    return { type: 'TEMPLATE', templateName: failed.templateName, templateLanguage: failed.templateLanguage };
  }
  throw new WhatsappMessageNotRetryableError(`Mensaje ${failed.id}: sin contenido que reenviar`);
}

async function retryContent(
  deps: RetryWhatsappMessageDeps,
  failed: RetryableMessage,
  contact: OutboundContact,
  connectionId: string,
  values: TemplateValues,
  at: Date,
  scope: IntegracionesScope,
): Promise<SendContent> {
  if (failed.type === 'TEXT') return textContent(failed.body, contact, at);
  const template = await deps.templates.findLiveByNameAndLanguage(
    connectionId,
    failed.templateName,
    failed.templateLanguage,
    scope,
  );
  if (template === null) throw new WhatsappTemplateNotFoundError();
  return templateContent(deps, template, values, scope);
}

export type RetryWhatsappMessage = (input: unknown, actor: Actor | null | undefined) => Promise<WhatsappSendOutcome>;

/** El fallido no se toca: el reintento es un mensaje nuevo, y una plantilla se recalcula con los valores de hoy. */
export function createRetryWhatsappMessage(deps: RetryWhatsappMessageDeps): RetryWhatsappMessage {
  const now = deps.now ?? (() => new Date());

  return async function retryWhatsappMessage(input, actor) {
    requireSendPermission(actor);
    const scope = scopeOf(actor);

    const parsed = retryWhatsappMessageSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const request = parsed.data;
    const at = now();

    const record = await deps.outbox.findOutbound(request.messageId, scope);
    if (record === null) throw new WhatsappMessageNotFoundError();
    const failed = retryableOf(record);

    const connection = await requireActiveConnection(deps, scope);
    const { contact } = await recipientByContact(deps, record.contactId, {
      connectionId: connection.id,
      actorId: actor.id,
      scope,
    });
    const content = await retryContent(deps, failed, contact, connection.id, request, at, scope);

    return deliver(deps, { connection, contact, content }, { actor, scope, at });
  };
}
