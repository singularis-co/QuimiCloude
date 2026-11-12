import { Receiver } from '@upstash/qstash';

import { readWhatsappQueueSigningKeys } from '../config/whatsapp-send-config-env';

import type { WhatsappQueueDelivery, WhatsappQueueSignature } from '../../../ports/whatsapp-queue-signature';

/**
 * `Receiver.verify` lanza `SignatureError` cuando la firma no corresponde al cuerpo, y el puerto
 * promete no lanzar. Las claves que faltan también acaban en `false`: la entrega se rechaza igual.
 */
export async function verifyWhatsappQueueSignature(delivery: WhatsappQueueDelivery): Promise<boolean> {
  if (delivery.signature === null) return false;

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
