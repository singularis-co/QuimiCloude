'use client';

import { useCallback, useSyncExternalStore } from 'react';

import type { BatchStatus } from '@/lib/modules/documentos';
import type { ErrorState } from '@/lib/modules/errores';

import {
  EMPTY_BATCH_STATUS,
  batchStatusSnapshot,
  listenBatchStatus,
  resumeBatchStatus,
  type BatchStatusSnapshot,
} from './batch-status-store';

export { BATCH_STATUS_POLL_INTERVAL_MS } from './batch-status-store';

export type UseBatchStatusResult = {
  readonly status: BatchStatus | null;
  readonly error: ErrorState | null;
  /** La tanda no existe o es de otra empresa, sin distinguirlo. */
  readonly missing: boolean;
  readonly resume: () => void;
};

function serverSnapshot(): BatchStatusSnapshot {
  return EMPTY_BATCH_STATUS;
}

/**
 * Sondea el estado de una tanda a intervalo fijo. Todos los consumidores de una misma tanda
 * comparten un solo bucle de consulta.
 *
 * Ante un error se detiene y espera a que alguien pulse `resume`: reintentar solo seria un plazo
 * propio encubierto, y la caducidad de una fila la decide el servidor.
 */
export function useBatchStatus(batchId: string | null): UseBatchStatusResult {
  const listen = useCallback(
    (onChange: () => void) =>
      batchId === null ? () => undefined : listenBatchStatus(batchId, onChange),
    [batchId],
  );
  const snapshot = useCallback(
    () => (batchId === null ? EMPTY_BATCH_STATUS : batchStatusSnapshot(batchId)),
    [batchId],
  );
  const { status, error, missing } = useSyncExternalStore(listen, snapshot, serverSnapshot);

  const resume = useCallback(() => {
    if (batchId !== null) resumeBatchStatus(batchId);
  }, [batchId]);

  return { status, error, missing, resume };
}
