// lib/modules/asignaciones/domain/conditioning-batch-data.ts
/**
 * Que lineas del reparto tienen ya sus datos de lote, y como abre el formulario del pedido. Lo usan
 * Terminar y el detalle, para que el aviso de la pantalla y el rechazo del servidor cuenten lo mismo.
 *
 * La clave es la presentacion: es unica por pedido, y es lo que comparten la linea del reparto y el
 * lote que entro por ella.
 */
import type { FinishedBatchOfOrderLine } from '@/lib/modules/inventario';

/** El lote de cada presentacion del pedido; una presentacion sin lote de produccion no aparece. */
export function batchesByPresentation(
  batches: readonly FinishedBatchOfOrderLine[],
): ReadonlyMap<string, FinishedBatchOfOrderLine> {
  return new Map(batches.map((batch) => [batch.presentationId, batch] as const));
}

/** Los tres datos se escriben juntos y la base no admite produccion sin vencimiento: basta mirar uno. */
export function hasBatchData(batch: FinishedBatchOfOrderLine | undefined): boolean {
  return batch !== undefined && batch.productionDate !== null;
}

/** Cuantas lineas no tienen datos de lote. Una linea sin lote cuenta como sin datos. */
export function missingBatchDataLines(
  lines: readonly { readonly presentationId: string }[],
  batches: readonly FinishedBatchOfOrderLine[],
): number {
  const byPresentation = batchesByPresentation(batches);
  return lines.filter((line) => !hasBatchData(byPresentation.get(line.presentationId))).length;
}

/** Como abre el formulario unico del pedido. En `divergent`, una entrada por linea en orden de alta
 *  con el codigo actual de su lote, escrito o provisional; `null` = la linea no tiene lote. */
export type ConditioningBatchForm =
  | { readonly kind: 'empty' }
  | {
      readonly kind: 'shared';
      readonly lot: string;
      readonly expiryDate: string;
      readonly productionDate: string;
    }
  | {
      readonly kind: 'divergent';
      readonly lines: readonly { readonly presentationId: string; readonly lot: string | null }[];
    }
  | { readonly kind: 'no_batches' };

/** Relleno solo si todas las lineas con lote llevan los mismos tres datos; vacio si ninguna los
 *  lleva; con aviso en cualquier otro caso. Las lineas sin lote no cuentan para decidirlo. */
export function batchDataForm(
  lines: readonly { readonly presentationId: string }[],
  batches: readonly FinishedBatchOfOrderLine[],
): ConditioningBatchForm {
  const byPresentation = batchesByPresentation(batches);
  const withBatch = lines
    .map((line) => byPresentation.get(line.presentationId))
    .filter((batch): batch is FinishedBatchOfOrderLine => batch !== undefined);
  if (withBatch.length === 0) return { kind: 'no_batches' };

  const withData = withBatch.filter(hasBatchData);
  if (withData.length === 0) return { kind: 'empty' };

  const [first] = withData;
  if (
    first !== undefined &&
    withData.length === withBatch.length &&
    first.expiryDate !== null &&
    first.productionDate !== null &&
    withData.every(
      (batch) =>
        batch.lot === first.lot &&
        batch.expiryDate === first.expiryDate &&
        batch.productionDate === first.productionDate,
    )
  ) {
    return { kind: 'shared', lot: first.lot, expiryDate: first.expiryDate, productionDate: first.productionDate };
  }

  return {
    kind: 'divergent',
    lines: lines.map((line) => ({
      presentationId: line.presentationId,
      lot: byPresentation.get(line.presentationId)?.lot ?? null,
    })),
  };
}
