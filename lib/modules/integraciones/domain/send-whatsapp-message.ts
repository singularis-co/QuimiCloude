import { requireSendPermission, type Actor } from './actor';
import { ACCESS_TOKEN_FIELD, decryptStoredSecret } from './connection-secrets';
import {
  ValidationError,
  WhatsappConnectionNotActiveError,
  WhatsappConnectionNotFoundError,
  WhatsappTemplateNotFoundError,
  WhatsappTemplateNotSendableError,
  WhatsappTemplateValuesMissingError,
  WhatsappWindowClosedError,
} from './errors';
import type { GraphFailure } from './graph-failure';
import { scopeOf, type IntegracionesScope } from './integraciones-scope';
import type { WhatsappConnectionRecord } from './whatsapp-connection';
import type {
  NewOutboundMessage,
  OutboundContact,
  WhatsappOutboundMessageView,
} from './whatsapp-outbound-message';
import { sendFailureOf, TOKEN_INVALID_MESSAGE } from './whatsapp-send-failure';
import { sendWhatsappMessageSchema } from './whatsapp-send-input';
import { resolveRecipient, type WhatsappSendRecipientDeps } from './whatsapp-send-recipient';
import { isWindowOpen } from './whatsapp-send-window';
import type { WhatsappTemplateRecord } from './whatsapp-template';
import { buildTemplateMessage, isSendable, type OwnVariableValue, type TemplateMessage } from './whatsapp-template-message';

import type { SecretCipher } from '../ports/secret-cipher';
import type { WhatsappConnectionRepository } from '../ports/whatsapp-connection-repository';
import type { GraphOutboundMessage, WhatsappGraphClient } from '../ports/whatsapp-graph-client';
import type { WhatsappOutboxRepository } from '../ports/whatsapp-outbox-repository';
import type { WhatsappSendLog } from '../ports/whatsapp-send-log';
import type { WhatsappTemplateRepository } from '../ports/whatsapp-template-repository';
import type { WhatsappVariableKeyRepository } from '../ports/whatsapp-variable-key-repository';

export type SendWhatsappMessageDeps = WhatsappSendRecipientDeps & {
  readonly connections: WhatsappConnectionRepository;
  readonly cipher: SecretCipher;
  readonly outbox: WhatsappOutboxRepository;
  readonly templates: Pick<WhatsappTemplateRepository, 'findLiveById' | 'findLiveByNameAndLanguage'>;
  readonly variableKeys: Pick<WhatsappVariableKeyRepository, 'listAll'>;
  readonly graph: Pick<WhatsappGraphClient, 'sendMessage'>;
  readonly sendLog: WhatsappSendLog;
  readonly now?: () => Date;
};

/** El diagnóstico de un fallo de Meta no viaja aquí: va al puerto de log (`design.md > 7`). */
export type WhatsappSendOutcome = {
  readonly message: WhatsappOutboundMessageView;
};

export type SendContent =
  | { readonly kind: 'text'; readonly body: string }
  | { readonly kind: 'template'; readonly message: TemplateMessage };

export type TemplateValues = {
  readonly constants: Readonly<Record<string, string>>;
  readonly constantLabels: Readonly<Record<string, string>>;
};

export type DeliveryPlan = {
  readonly connection: WhatsappConnectionRecord;
  readonly contact: OutboundContact;
  readonly content: SendContent;
};

export type DeliveryContext = { readonly actor: Actor; readonly scope: IntegracionesScope; readonly at: Date };

export async function requireActiveConnection(
  deps: Pick<SendWhatsappMessageDeps, 'connections'>,
  scope: IntegracionesScope,
): Promise<WhatsappConnectionRecord> {
  const connection = await deps.connections.findLive(scope);
  if (connection === null) throw new WhatsappConnectionNotFoundError();
  if (connection.status !== 'ACTIVE') throw new WhatsappConnectionNotActiveError();
  return connection;
}

export function textContent(body: string, contact: OutboundContact, at: Date): SendContent {
  if (!isWindowOpen(contact.lastInboundAt, at)) throw new WhatsappWindowClosedError();
  return { kind: 'text', body };
}

export async function templateContent(
  deps: Pick<SendWhatsappMessageDeps, 'variableKeys'>,
  template: WhatsappTemplateRecord,
  values: TemplateValues,
  scope: IntegracionesScope,
): Promise<SendContent> {
  if (!isSendable(template)) throw new WhatsappTemplateNotSendableError();
  const ownValues = new Map<string, OwnVariableValue>(
    (await deps.variableKeys.listAll(scope)).map((record) => [record.id, { key: record.key, value: record.value }]),
  );
  const built = buildTemplateMessage(template, ownValues, values.constants, values.constantLabels);
  if (!built.ok) throw new WhatsappTemplateValuesMissingError(built.missing);
  return { kind: 'template', message: built.message };
}

function graphMessageOf(content: SendContent): GraphOutboundMessage {
  if (content.kind === 'text') return { type: 'text', body: content.body };
  const { name, language, components } = content.message;
  return { type: 'template', name, language, components };
}

function newMessageOf(plan: DeliveryPlan, actor: Actor): NewOutboundMessage {
  const base = { connectionId: plan.connection.id, contactId: plan.contact.id, sentById: actor.id };
  const { content } = plan;
  if (content.kind === 'text') {
    return { ...base, type: 'TEXT', body: content.body, templateName: null, templateLanguage: null, payload: {} };
  }
  return {
    ...base,
    type: 'TEMPLATE',
    body: content.message.body,
    templateName: content.message.name,
    templateLanguage: content.message.language,
    payload: { ...content.message.values },
  };
}

function diagnosticOf(failure: GraphFailure): string {
  return `Graph enviar mensaje: ${failure.kind}; code=${failure.code ?? '-'}; subcode=${failure.subcode ?? '-'}`;
}

type DeliveryResult = {
  readonly status: 'SENT' | 'FAILED';
  readonly errorCode: string | null;
  readonly errorReason: string | null;
};

/**
 * Lo previo ya está validado: a partir de aquí se descifra el token, se escribe el mensaje y se llama
 * a Meta, en ese orden. La vista cuenta el resultado de esta llamada aunque el `UPDATE` condicionado
 * no encuentre el mensaje en `SENDING`.
 */
export async function deliver(
  deps: SendWhatsappMessageDeps,
  plan: DeliveryPlan,
  ctx: DeliveryContext,
): Promise<WhatsappSendOutcome> {
  const { connection, contact } = plan;
  const accessToken = await decryptStoredSecret(deps, connection, ACCESS_TOKEN_FIELD, ctx.scope);
  const row = newMessageOf(plan, ctx.actor);
  const inserted = await deps.outbox.insertSending(row, ctx.scope);

  const sent = await deps.graph.sendMessage({
    phoneNumberId: connection.phoneNumberId,
    accessToken,
    to: contact.waId,
    message: graphMessageOf(plan.content),
  });

  let result: DeliveryResult;
  if (sent.ok) {
    await deps.outbox.markSent(inserted.id, sent.wamid, ctx.scope);
    result = { status: 'SENT', errorCode: null, errorReason: null };
  } else {
    const failure = sendFailureOf(sent);
    await deps.outbox.markFailed(inserted.id, failure.errorCode, failure.errorReason, ctx.scope);
    if (failure.effect === 'token_invalid') {
      await deps.connections.update(connection.id, { status: 'ERROR', lastError: TOKEN_INVALID_MESSAGE }, ctx.scope);
    }
    result = { status: 'FAILED', errorCode: failure.errorCode, errorReason: failure.errorReason };
    deps.sendLog.sendFailed({ messageId: inserted.id, diagnostic: diagnosticOf(sent) });
  }

  await deps.outbox.touchContact(contact.id, ctx.at, ctx.scope);
  return {
    message: {
      id: inserted.id,
      type: row.type,
      status: result.status,
      body: row.body,
      templateName: row.templateName,
      templateLanguage: row.templateLanguage,
      errorCode: result.errorCode,
      errorReason: result.errorReason,
      createdAt: inserted.createdAt.toISOString(),
    },
  };
}

export type SendWhatsappMessage = (input: unknown, actor: Actor | null | undefined) => Promise<WhatsappSendOutcome>;

export function createSendWhatsappMessage(deps: SendWhatsappMessageDeps): SendWhatsappMessage {
  const now = deps.now ?? (() => new Date());

  return async function sendWhatsappMessage(input, actor) {
    requireSendPermission(actor);
    const scope = scopeOf(actor);

    const parsed = sendWhatsappMessageSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const request = parsed.data;
    const at = now();

    const connection = await requireActiveConnection(deps, scope);
    const { contact } = await resolveRecipient(deps, request.recipient, {
      connectionId: connection.id,
      actorId: actor.id,
      scope,
    });

    let content: SendContent;
    if (request.kind === 'text') {
      content = textContent(request.text, contact, at);
    } else {
      const template = await deps.templates.findLiveById(request.templateId, scope);
      if (template === null || template.connectionId !== connection.id) throw new WhatsappTemplateNotFoundError();
      content = await templateContent(deps, template, request, scope);
    }

    return deliver(deps, { connection, contact, content }, { actor, scope, at });
  };
}
