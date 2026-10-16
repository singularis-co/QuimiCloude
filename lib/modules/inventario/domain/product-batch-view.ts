import { compareQuantities } from './decimal-quantity';

export type ProductBatchView = {
  readonly id: string;
  readonly lot: string;
  readonly stock: string;
  /** Unidad del producto del lote; `null` cuando el producto no tiene unidad (MACHINE). */
  readonly unitId: string | null;
  readonly purchaseDate: string;
  readonly expiryDate: string | null;
  /** Contenido con el que se contaron los envases del lote; `null` si no es de produccion. */
  readonly packageContent: string | null;
  /** Costo unitario guardado en el lote (`product_batches.unit_cost`), en cadena decimal de
   *  cuatro decimales; `null` si el lote no tiene costo. Opcional: lo rellenan las lecturas que
   *  usan `BATCH_VIEW_SELECT` (`findBatchesOfAliveProduct`, `findBatchesOfOrder`), y los casos de
   *  uso la quitan (`withoutUnitCost`) a quien no cumple `canViewUnitCosts`. */
  readonly unitCost?: string | null;
  /** Lo apartado por pedidos vivos en este lote. Opcional: solo lo rellena
   *  `findBatchesOfAliveProduct`; las demas lecturas no la traen. */
  readonly reserved?: string;
  /** Su existencia menos su apartado, nunca por debajo de cero. Misma condicion que `reserved`. */
  readonly available?: string;
  /** El apartado supera la existencia. Misma condicion que `reserved`. */
  readonly overReserved?: boolean;
  /** Nombre de la presentacion del lote. Solo lo rellena `findBatchesOfOrder`: un pedido puede
   *  tener lotes de varias presentaciones. */
  readonly presentationName?: string | null;
};

/**
 * El lote sin `unitCost`: el campo desaparece, no queda en `null`, para que un actor sin
 * `canViewUnitCosts` no reciba ni la clave. Lo aplican los casos de uso de listado de lotes.
 */
export function withoutUnitCost(batch: ProductBatchView): ProductBatchView {
  const copy: { -readonly [K in keyof ProductBatchView]: ProductBatchView[K] } = { ...batch };
  delete copy.unitCost;
  return copy;
}

/**
 * Los lotes vivos: los que conservan existencia (`stock > 0`). Puro, sin reloj ni base de datos;
 * la lista de lotes la filtra el servidor para que la UI no repita el criterio.
 */
export function aliveBatches(batches: readonly ProductBatchView[]): readonly ProductBatchView[] {
  return batches.filter((batch) => compareQuantities(batch.stock, '0') > 0);
}
