import type { IntegracionesScope } from '../domain/integraciones-scope';
import type { InboundBatch } from '../domain/whatsapp-webhook-payload';

/** `discardedBlocked`: mensajes del lote que no se guardaron porque su contacto está bloqueado. */
export type WhatsappInboxRecordResult = { readonly discardedBlocked: number };

/** Guarda todo el lote en una sola transacción: si algo falla, no queda nada y la excepción se propaga. */
export interface WhatsappInboxRepository {
  record(
    batch: InboundBatch,
    connectionId: string,
    receivedAt: Date,
    scope: IntegracionesScope,
  ): Promise<WhatsappInboxRecordResult>;
}
