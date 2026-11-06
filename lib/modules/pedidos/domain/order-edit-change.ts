import { sameDecimal } from './order-distribution';
import type { OrderPresentationLineRow } from './order-view';
import type { DistributionLineInput } from './resolve-distribution';

function sameLine(edit: DistributionLineInput, saved: OrderPresentationLineRow): boolean {
  if (edit.packages !== saved.packages) return false;
  if ('packagingProductId' in edit) return saved.packagingProductId === edit.packagingProductId;
  return saved.packagingProductId === null && saved.presentationId === edit.presentationId;
}

/** `null` (sin precio) solo es igual a `null`: un 0 es un precio. Dos importes se comparan por
 *  valor, asi que `'12.5'` y el `'12.5000'` guardado son el mismo. */
function sameSalePrice(edit: string | null, saved: string | null): boolean {
  if (edit === null || saved === null) return edit === saved;
  return sameDecimal(edit, saved);
}

/** El orden no cuenta: cada linea entrante tiene que casar con una guardada distinta. */
function sameDistribution(
  edit: readonly DistributionLineInput[],
  saved: readonly OrderPresentationLineRow[],
): boolean {
  if (edit.length !== saved.length) return false;
  const pending = [...saved];
  for (const line of edit) {
    const index = pending.findIndex((candidate) => sameLine(line, candidate));
    if (index === -1) return false;
    pending.splice(index, 1);
  }
  return true;
}

/** Lo que una linea guardada tiene y una edicion puede cambiar. `recipeId` es la receta efectiva. */
export type ComparableOrderLine = {
  readonly recipeId: string;
  readonly quantity: string;
  readonly unitId: string | null;
  readonly salePrice: string | null;
  readonly presentationLines: readonly OrderPresentationLineRow[];
};

/** Lo que trae la edicion de una linea, con `recipeId` ya resuelto a la receta efectiva. */
export type ComparableOrderLineEdit = Pick<ComparableOrderLine, 'recipeId' | 'quantity' | 'salePrice'> & {
  readonly unitId: string;
  readonly presentationLines: readonly DistributionLineInput[];
};

/** Una linea guardada sin unidad nunca es igual: la edicion siempre trae una. */
export function isUnchangedOrderLine(saved: ComparableOrderLine, edit: ComparableOrderLineEdit): boolean {
  return (
    edit.recipeId === saved.recipeId &&
    sameDecimal(edit.quantity, saved.quantity) &&
    saved.unitId !== null &&
    edit.unitId === saved.unitId &&
    sameSalePrice(edit.salePrice, saved.salePrice) &&
    sameDistribution(edit.presentationLines, saved.presentationLines)
  );
}
