import { createHmac, timingSafeEqual } from 'node:crypto';

import type { WebhookSignature } from '../../../ports/webhook-signature';

const SIGNATURE_HEADER = /^sha256=([0-9a-f]{64})$/i;

/** Los dos lados miden 32 bytes por construcción: `timingSafeEqual` no puede lanzar por longitud. */
export function webhookSignatureMatches(
  rawBody: Uint8Array,
  header: string | null,
  appSecret: string,
): boolean {
  if (header === null) return false;
  const match = SIGNATURE_HEADER.exec(header);
  if (match === null) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(match[1], 'hex'));
}

export const webhookSignatureHmac = {
  matches: webhookSignatureMatches,
} satisfies WebhookSignature;
