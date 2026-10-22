import type { BatchFinishedListener } from './batch-finished-listener';
import type { BatchNoticeReader } from '../ports/document-batch-repository';
import type { DocumentJobLog } from '../ports/document-job-log';

export type BatchFinishedDeps = {
  readonly notices: BatchNoticeReader;
  readonly listener: BatchFinishedListener;
  readonly log?: DocumentJobLog;
  readonly now?: () => Date;
};

/**
 * Avisa si la tanda ya no tiene archivos en `queued` ni en `processing`. Dos archivos que terminan
 * a la vez pueden avisar los dos: quien escucha deduplica por tanda.
 *
 * Nunca lanza: lo llaman después de dejar escrito el desenlace de un archivo, y un fallo al avisar
 * no puede cambiar ese desenlace.
 */
export function createNotifyIfBatchFinished(
  deps: BatchFinishedDeps,
): (batchId: string, companyId: string) => Promise<void> {
  const now = deps.now ?? ((): Date => new Date());

  return async function notifyIfBatchFinished(batchId, companyId) {
    try {
      const notice = await deps.notices.readBatchNotice(batchId, companyId);
      if (notice === null || notice.pending > 0) return;

      await deps.listener.onBatchFinished({
        companyId,
        batchId,
        strategy: notice.strategy,
        createdBy: notice.createdBy,
        uploadedAt: notice.uploadedAt,
        total: notice.total,
        done: notice.done,
        failed: notice.failed,
        failedNames: notice.failedNames,
        occurredAt: now(),
      });
    } catch (error) {
      deps.log?.warn('aviso de fin de tanda fallido', {
        batchId,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  };
}
