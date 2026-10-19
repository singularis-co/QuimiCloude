import type { PdfStrategy } from './pdf-strategy';

export type BatchFinishedEvent = {
  readonly companyId: string;
  readonly batchId: string;
  readonly strategy: PdfStrategy;
  readonly createdBy: string | null;
  readonly uploadedAt: Date;
  readonly total: number;
  readonly done: number;
  readonly failed: number;
  /** Hasta tres, en orden de subida, solo los fallidos que tienen nombre guardado. */
  readonly failedNames: readonly string[];
  readonly occurredAt: Date;
};

/**
 * El aviso que `documentos` da cuando una tanda ya no tiene archivos pendientes. `documentos` no
 * conoce a quien lo escucha: `lib/composition` lo ata.
 */
export interface BatchFinishedListener {
  /** Se llama con la tanda ya cerrada. No debe lanzar: el desenlace de los archivos ya está escrito. */
  onBatchFinished(event: BatchFinishedEvent): Promise<void>;
}
