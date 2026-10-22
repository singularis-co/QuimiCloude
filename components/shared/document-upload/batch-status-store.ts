import type { BatchStatus } from '@/lib/modules/documentos';
import {
  getBatchStatusAction,
} from '@/lib/modules/documentos/adapters/driving/document-batch-actions';
import type { ErrorState } from '@/lib/modules/errores';

export const BATCH_STATUS_POLL_INTERVAL_MS = 2000;

export type BatchStatusSnapshot = {
  readonly status: BatchStatus | null;
  readonly error: ErrorState | null;
  readonly missing: boolean;
};

export const EMPTY_BATCH_STATUS: BatchStatusSnapshot = {
  status: null,
  error: null,
  missing: false,
};

type Entry = {
  snapshot: BatchStatusSnapshot;
  readonly listeners: Set<() => void>;
  timer: ReturnType<typeof setTimeout> | undefined;
  inFlight: boolean;
  /** Terminada o desaparecida: la respuesta ya no puede cambiar. */
  final: boolean;
};

// Solo en memoria: una recarga debe volver a consultar cada tanda una vez.
const entries = new Map<string, Entry>();

function everyFileFinished(batch: BatchStatus): boolean {
  return batch.files.every((file) => file.status === 'done' || file.status === 'error');
}

function publish(entry: Entry, snapshot: BatchStatusSnapshot): void {
  entry.snapshot = snapshot;
  for (const listener of [...entry.listeners]) listener();
}

function release(batchId: string, entry: Entry): void {
  if (entry.listeners.size > 0 || entry.inFlight || entry.final) return;
  if (entry.timer !== undefined) clearTimeout(entry.timer);
  // Una consulta que responde tras un reinicio no debe borrar la entrada nueva de la tanda.
  if (entries.get(batchId) === entry) entries.delete(batchId);
}

async function query(batchId: string, entry: Entry): Promise<void> {
  entry.timer = undefined;
  entry.inFlight = true;
  let result: Awaited<ReturnType<typeof getBatchStatusAction>>;
  try {
    result = await getBatchStatusAction(batchId);
  } finally {
    entry.inFlight = false;
  }

  if (result.status === 'error') {
    publish(entry, { ...entry.snapshot, error: result });
  } else if (result.data === null) {
    entry.final = true;
    publish(entry, { ...entry.snapshot, missing: true });
  } else {
    const batch = result.data;
    entry.final = everyFileFinished(batch);
    publish(entry, { status: batch, error: null, missing: false });
    if (!entry.final && entry.listeners.size > 0) {
      entry.timer = setTimeout(() => {
        void query(batchId, entry);
      }, BATCH_STATUS_POLL_INTERVAL_MS);
    }
  }

  release(batchId, entry);
}

/** Lo ultimo que se sabe de la tanda; la misma referencia mientras no cambie. */
export function batchStatusSnapshot(batchId: string): BatchStatusSnapshot {
  return entries.get(batchId)?.snapshot ?? EMPTY_BATCH_STATUS;
}

/**
 * Engancha un oyente a la tanda. El primero arranca el sondeo; el resto se suma al mismo bucle.
 * Devuelve la funcion que lo desengancha: con el ultimo, el sondeo se para.
 */
export function listenBatchStatus(batchId: string, listener: () => void): () => void {
  let entry = entries.get(batchId);
  if (entry === undefined) {
    entry = {
      snapshot: EMPTY_BATCH_STATUS,
      listeners: new Set(),
      timer: undefined,
      inFlight: false,
      final: false,
    };
    entries.set(batchId, entry);
  }

  const current = entry;
  current.listeners.add(listener);
  const idle = !current.inFlight && current.timer === undefined;
  if (idle && !current.final && current.snapshot.error === null) void query(batchId, current);

  return () => {
    current.listeners.delete(listener);
    if (current.listeners.size > 0) return;
    if (current.timer !== undefined) clearTimeout(current.timer);
    current.timer = undefined;
    release(batchId, current);
  };
}

/** Limpia el error y vuelve a consultar la tanda para todos sus oyentes. */
export function resumeBatchStatus(batchId: string): void {
  const entry = entries.get(batchId);
  if (entry === undefined) return;

  if (entry.snapshot.error !== null) publish(entry, { ...entry.snapshot, error: null });
  if (entry.inFlight) return;
  if (entry.timer !== undefined) clearTimeout(entry.timer);
  entry.final = false;
  void query(batchId, entry);
}

/**
 * Solo para tests: vacia el almacen y cancela los temporizadores pendientes, como una recarga.
 * La aplicacion nunca la llama.
 */
export function resetBatchStatusStore(): void {
  for (const entry of entries.values()) {
    if (entry.timer !== undefined) clearTimeout(entry.timer);
    entry.timer = undefined;
  }
  entries.clear();
}
