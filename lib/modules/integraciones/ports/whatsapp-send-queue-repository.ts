import type { IntegracionesScope } from '../domain/integraciones-scope';
import type { ClaimedMessage, NewQueuedMessage } from '../domain/whatsapp-outbound-message';

/**
 * Los mensajes del sistema en cola. Solo filas de la empresa de `scope` y de origen `SYSTEM`: los de
 * un usuario o del agente no existen aquí. `scope` va al final de cada firma: una llamada que lo
 * omita no compila.
 */
export interface WhatsappSendQueueRepository {
  insertQueued(row: NewQueuedMessage, scope: IntegracionesScope): Promise<{ readonly id: string }>;
  /** Solo si sigue en `QUEUED`; renueva su marca de último cambio. */
  recordPublished(id: string, queueMessageId: string, scope: IntegracionesScope): Promise<void>;
  /**
   * `QUEUED` → `SENDING` sumando un intento, en una sola escritura: de dos entregas simultáneas solo
   * una lo reclama. `null` si no estaba en `QUEUED` o ya agotó el tope.
   */
  claim(id: string, maxAttempts: number, scope: IntegracionesScope): Promise<ClaimedMessage | null>;
  /** `SENDING` → `QUEUED` sin devolver el intento. */
  release(id: string, scope: IntegracionesScope): Promise<void>;
  listStaleQueued(
    before: Date,
    maxAttempts: number,
    limit: number,
    scope: IntegracionesScope,
  ): Promise<readonly string[]>;
  /** Cada `fail*` devuelve cuántos mensajes pasó a `FAILED`. */
  failExhausted(maxAttempts: number, reason: string, scope: IntegracionesScope): Promise<number>;
  failStaleQueued(before: Date, reason: string, scope: IntegracionesScope): Promise<number>;
  failStuckSending(before: Date, reason: string, scope: IntegracionesScope): Promise<number>;
}
