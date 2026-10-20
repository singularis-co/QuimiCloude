import { APP_SECRET_FIELD, decryptStoredSecret } from './connection-secrets';
import { SecretUnreadableError } from './errors';
import { resolveWebhookConnection, type WebhookConnectionDeps } from './webhook-connection';
import { parseWhatsappWebhook } from './whatsapp-webhook-payload';

import type { SecretCipher } from '../ports/secret-cipher';
import type { WebhookSignature } from '../ports/webhook-signature';
import type { WhatsappInboxRepository } from '../ports/whatsapp-inbox-repository';

export type ReceiveWhatsappWebhookDeps = WebhookConnectionDeps & {
  readonly cipher: SecretCipher;
  readonly signature: WebhookSignature;
  readonly inbox: WhatsappInboxRepository;
  readonly now?: () => Date;
};

export type ReceiveWhatsappWebhookInput = {
  readonly connectionId: string;
  /** Los bytes exactos recibidos: la firma de Meta se calcula sobre ellos, no sobre un texto. */
  readonly rawBody: Uint8Array;
  readonly signature: string | null;
};

export type ReceiveWhatsappWebhookResult =
  | { readonly kind: 'ignored'; readonly reason: 'missing' | 'addon_off' | 'disabled' | 'unparseable' }
  | { readonly kind: 'unauthorized' }
  | { readonly kind: 'secret_unreadable' }
  | {
      readonly kind: 'stored';
      readonly counts: { readonly messages: number; readonly statuses: number };
      /** Solo cuantos se saltaron: el log del driving no puede llevar el numero ni el contenido. */
      readonly skipped: { readonly changes: number; readonly messages: number; readonly statuses: number };
    };

function decodeJson(rawBody: Uint8Array): { readonly ok: true; readonly json: unknown } | { readonly ok: false } {
  try {
    return { ok: true, json: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rawBody)) };
  } catch {
    return { ok: false };
  }
}

/**
 * Un fallo al guardar no se captura: se propaga para que la respuesta sea un error y Meta reintente.
 */
export function createReceiveWhatsappWebhook(
  deps: ReceiveWhatsappWebhookDeps,
): (input: ReceiveWhatsappWebhookInput) => Promise<ReceiveWhatsappWebhookResult> {
  const now = deps.now ?? (() => new Date());

  return async function receiveWhatsappWebhook({ connectionId, rawBody, signature }) {
    const connection = await resolveWebhookConnection(deps, connectionId);
    if (connection.kind !== 'ready') return { kind: 'ignored', reason: connection.kind };
    const { record, scope } = connection;

    let appSecret: string;
    try {
      appSecret = await decryptStoredSecret(deps, record, APP_SECRET_FIELD, scope);
    } catch (error) {
      if (error instanceof SecretUnreadableError) return { kind: 'secret_unreadable' };
      throw error;
    }

    if (!deps.signature.matches(rawBody, signature, appSecret)) return { kind: 'unauthorized' };

    const decoded = decodeJson(rawBody);
    if (!decoded.ok) return { kind: 'ignored', reason: 'unparseable' };
    const batch = parseWhatsappWebhook(decoded.json, record.phoneNumberId);
    if (batch === null) return { kind: 'ignored', reason: 'unparseable' };

    const { discardedBlocked } = await deps.inbox.record(batch, record.id, now(), scope);
    return {
      kind: 'stored',
      counts: { messages: batch.messages.length - discardedBlocked, statuses: batch.statuses.length },
      skipped: {
        changes: batch.skipped.changes,
        messages: batch.skipped.messages,
        statuses: batch.skipped.statuses,
      },
    };
  };
}
