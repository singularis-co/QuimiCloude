import { resolveWebhookConnection, type WebhookConnectionDeps } from './webhook-connection';

import type { SecretDigest } from '../ports/secret-digest';

export type VerifyWhatsappWebhookDeps = WebhookConnectionDeps & {
  readonly digest: SecretDigest;
  readonly now?: () => Date;
};

export type VerifyWhatsappWebhookInput = {
  readonly connectionId: string;
  readonly mode: string | null;
  readonly verifyToken: string | null;
  readonly challenge: string | null;
};

export type VerifyWhatsappWebhookRejection =
  | 'bad_request'
  | 'missing'
  | 'addon_off'
  | 'disabled'
  | 'token_mismatch';

/** `reason` es solo para el log: la respuesta de un rechazo es la misma en todos los casos. */
export type VerifyWhatsappWebhookResult =
  | { readonly kind: 'verified'; readonly challenge: string }
  | { readonly kind: 'forbidden'; readonly reason: VerifyWhatsappWebhookRejection };

export function createVerifyWhatsappWebhook(
  deps: VerifyWhatsappWebhookDeps,
): (input: VerifyWhatsappWebhookInput) => Promise<VerifyWhatsappWebhookResult> {
  const now = deps.now ?? (() => new Date());

  return async function verifyWhatsappWebhook({ connectionId, mode, verifyToken, challenge }) {
    if (mode !== 'subscribe' || !verifyToken || !challenge) {
      return { kind: 'forbidden', reason: 'bad_request' };
    }

    const connection = await resolveWebhookConnection(deps, connectionId);
    if (connection.kind !== 'ready') return { kind: 'forbidden', reason: connection.kind };
    const { record, scope } = connection;

    // El resumen se compara en tiempo constante dentro del puerto.
    if (!deps.digest.matches(verifyToken, record.verifyTokenHash)) {
      return { kind: 'forbidden', reason: 'token_mismatch' };
    }

    await deps.connections.recordWebhookHandshake(record.id, now(), scope);
    return { kind: 'verified', challenge };
  };
}
