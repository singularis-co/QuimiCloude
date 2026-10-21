/**
 * El caso de uso de CONSULTAR una tanda: permiso, caducidad y lectura, en ese orden.
 *
 * Una tanda de otra empresa y una tanda inexistente dan el mismo `null`: `readBatch` ya no
 * distingue los dos casos, asi que este caso de uso tampoco tiene como revelarlo.
 */
import { requirePermission, type Actor, DOCUMENT_UPLOAD_PERMISSION } from './actor';
import { MILLISECONDS_PER_SECOND } from './limits';
import { createNotifyIfBatchFinished, type BatchFinishedDeps } from './notify-if-batch-finished';

import type { BatchStatus } from './batch-status';
import type { DocumentBatchRepository } from '../ports/document-batch-repository';
import type { ProcessingConfig } from '../ports/processing-config';

export type GetBatchStatusDeps = {
  readonly repository: DocumentBatchRepository;
  readonly config: ProcessingConfig;
  /** El instante de la consulta, inyectable: la caducidad se cuenta desde el, no desde `new Date()`. */
  readonly now?: () => Date;
  readonly batchFinished?: BatchFinishedDeps;
};

export function createGetBatchStatus(
  deps: GetBatchStatusDeps,
): (actor: Actor | null | undefined, batchId: string) => Promise<BatchStatus | null> {
  const now = deps.now ?? ((): Date => new Date());
  const notifyIfBatchFinished =
    deps.batchFinished === undefined ? null : createNotifyIfBatchFinished(deps.batchFinished);

  return async function getBatchStatus(
    actor: Actor | null | undefined,
    batchId: string,
  ): Promise<BatchStatus | null> {
    requirePermission(actor, DOCUMENT_UPLOAD_PERMISSION);

    const olderThan = new Date(
      now().getTime() - deps.config.timeoutSeconds() * MILLISECONDS_PER_SECOND,
    );
    await deps.repository.expireStale(batchId, actor.companyId, olderThan);
    // La caducidad también cierra archivos: sin esto, una tanda con uno colgado nunca avisaría.
    await notifyIfBatchFinished?.(batchId, actor.companyId);

    const batch = await deps.repository.readBatch(batchId, actor.companyId);
    if (batch === null) return null;
    // `maxRetries()` cuenta las entregas EXTRA tras la primera («total = 1 + retries» en QStash),
    // y `attempts` suma una por entrega reclamada: el tope, en intentos totales, es uno mas.
    return { ...batch, maxAttempts: deps.config.maxRetries() + 1 };
  };
}
