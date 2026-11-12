import type { WhatsappSendJob } from '../domain/whatsapp-send-job';

export interface WhatsappSendQueue {
  /** Publica un trabajo y devuelve el identificador que le da la cola. */
  publish(job: WhatsappSendJob): Promise<string>;
}
