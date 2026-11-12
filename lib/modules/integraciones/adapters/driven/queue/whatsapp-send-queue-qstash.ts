import { Client } from '@upstash/qstash';

import { readWhatsappSendQueueConfig } from '../config/whatsapp-send-config-env';

import type { WhatsappSendJob } from '../../../domain/whatsapp-send-job';
import type { WhatsappSendQueue } from '../../../ports/whatsapp-send-queue';

/**
 * El cliente se construye dentro de la llamada: importar este archivo con las variables vacías no
 * debe fallar. `retries` son los reintentos después de la primera entrega.
 */
export async function publishWhatsappSendJob(job: WhatsappSendJob): Promise<string> {
  const config = readWhatsappSendQueueConfig();
  const client = new Client({ token: config.token });

  const response = await client.publishJSON({
    url: config.targetUrl,
    body: job,
    retries: config.maxRetries,
  });

  return response.messageId;
}

export const whatsappSendQueueQstash: WhatsappSendQueue = {
  publish: publishWhatsappSendJob,
};
