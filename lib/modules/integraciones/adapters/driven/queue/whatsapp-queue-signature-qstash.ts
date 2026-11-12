import { Receiver } from '@upstash/qstash';

import { forModule } from '@/lib/shared/observability/logger';

import {
  missingWhatsappQueueSigningKeys,
  readWhatsappQueueSigningKeys,
} from '../config/whatsapp-send-config-env';

import type { WhatsappQueueDelivery, WhatsappQueueSignature } from '../../../ports/whatsapp-queue-signature';

export const WHATSAPP_SYSTEM_SEND_FLOW = 'whatsapp_system_send';

const log = forModule('integraciones');

/**
 * `Receiver.verify` lanza `SignatureError` cuando la firma no corresponde al cuerpo, y el puerto
 * promete no lanzar. Las claves que faltan también acaban en `false`: la entrega se rechaza igual.
 */
export async function verifyWhatsappQueueSignature(delivery: WhatsappQueueDelivery): Promise<boolean> {
  if (delivery.signature === null) return false;

  const missing = missingWhatsappQueueSigningKeys();
  if (missing.length > 0) {
    log.error('whatsapp_send_signing_keys_missing', {
      flow: WHATSAPP_SYSTEM_SEND_FLOW,
      missing: missing.join(', '),
    });
    return false;
  }

  try {
    const keys = readWhatsappQueueSigningKeys();
    const receiver = new Receiver({
      currentSigningKey: keys.currentSigningKey,
      nextSigningKey: keys.nextSigningKey,
    });
    return await receiver.verify({ signature: delivery.signature, body: delivery.rawBody });
  } catch {
    return false;
  }
}

export const whatsappQueueSignatureQstash: WhatsappQueueSignature = {
  verify: verifyWhatsappQueueSignature,
};
