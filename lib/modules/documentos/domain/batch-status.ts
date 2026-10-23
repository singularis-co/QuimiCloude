/**
 * El ESTADO de un archivo y el de una tanda: lo que devuelve la consulta y lo que persiste el
 * repositorio.
 *
 * `documentFileStatusSchema` no es solo un tipo: la estrategia guardada ya demostro que un valor de
 * la base puede llegar podrido, y un estado no es distinto.
 *
 * Dominio puro: el unico import externo es `zod`.
 */
import { z } from 'zod';

import type { ErrorCode } from '@/lib/modules/errores';
import type { PdfStrategy } from './pdf-strategy';

export const documentFileStatusSchema = z.union([
  z.literal('queued'),
  z.literal('processing'),
  z.literal('done'),
  z.literal('error'),
]);

export type DocumentFileStatus = z.infer<typeof documentFileStatusSchema>;

/**
 * Una fila de archivo tal como la ve quien consulta: el texto y el motivo solo llevan valor en el
 * estado que les corresponde, igual que lo hacen inexpresable los `CHECK` de la base.
 */
export type DocumentFileStatusEntry = {
  readonly id: string;
  readonly path: string;
  /** Intentos ya consumidos: 0 hasta que la cola reclama el archivo por primera vez. */
  readonly attempts: number;
  /** El nombre legible: el `original_name` de la fila o, si falta, el último segmento de `path`. */
  readonly name: string;
  readonly status: DocumentFileStatus;
  readonly extractedText: string | null;
  readonly errorCode: ErrorCode | null;
  readonly errorReason: string | null;
};

/** Lo que devuelve la lectura del repositorio: la tanda leida, antes de que el caso de uso la complete. */
export type ReadBatch = {
  readonly id: string;
  readonly companyId: string;
  readonly strategy: PdfStrategy;
  readonly files: readonly DocumentFileStatusEntry[];
};

/**
 * La tanda entera, con la estrategia elegida una sola vez, el estado de cada uno de sus archivos y
 * el tope de intentos que aplica la cola.
 */
export type BatchStatus = ReadBatch & {
  /**
   * Intentos TOTALES que la cola le da a un archivo: la primera entrega mas sus reintentos. Con
   * `attempts` pinta «intento 2 de 4».
   */
  readonly maxAttempts: number;
};