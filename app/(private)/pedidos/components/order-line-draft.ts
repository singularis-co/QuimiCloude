import {
  isEditableOrderLineStatus,
  isRemovableOrderLineStatus,
  sumDecimal4,
  type DistributionLineInput,
  type OrderLineView,
  type OrderPriority,
  type OrderView,
} from '@/lib/modules/pedidos';
import { trimDecimal } from '@/lib/shared/ui/decimal-display';

import {
  fromOrderPresentationLines,
  toDistributionLinesInput,
  type OrderDistributionLine,
} from './use-order-distribution-availability';

/** Una receta del pedido mientras se edita en el panel. */
export type OrderLineDraft = {
  readonly key: string;
  /** `null` = receta nueva, sin guardar. */
  readonly saved: OrderLineView | null;
  /** La original, aunque se haya elegido una versión. */
  readonly recipe: { readonly id: string; readonly name: string; readonly imageUrl: string | null };
  readonly recipeVersionId: string | null;
  readonly quantity: string;
  /** Cadena vacía = sin unidad. */
  readonly unitId: string;
  readonly unitLabel: string | null;
  readonly presentationLines: readonly OrderDistributionLine[];
  /** El texto ya aplicado en el sub-panel, que pasó `orderLineInputSchema`; vacío = sin precio. */
  readonly salePrice: string;
  readonly ingredientsCost: string | null;
};

export type OrderCandidateHeader = {
  readonly priority: OrderPriority;
  readonly customerId: string | null;
  readonly confirmBlocked: boolean;
};

export type OrderLineCandidate = {
  readonly id?: string;
  readonly recipeId: string;
  readonly recipeVersionId: string | null;
  readonly quantity: string;
  readonly unitId: string;
  readonly presentationLines: readonly DistributionLineInput[];
  readonly salePrice: string;
};

export type OrderCandidate = {
  readonly lines: readonly OrderLineCandidate[];
  readonly priority: OrderPriority;
  /** Cadena vacía = sin cliente. */
  readonly customerId: string;
  readonly confirmBlocked: boolean;
};

export type OrderCandidateWithRows = {
  readonly candidate: OrderCandidate;
  /** `rowOfPosition[i]` es la fila de la tabla (desde 0) de `candidate.lines[i]`: el servidor
   *  señala las recetas que fallan por su índice en lo enviado, y las canceladas no se envían. */
  readonly rowOfPosition: readonly number[];
};

export type OrderDraftTotals = {
  readonly salePriceTotal: string | null;
  readonly linesWithoutPrice: number;
  /** `null` si a alguna receta activa le falta el coste: una suma con huecos no es el coste. */
  readonly ingredientsCostTotal: string | null;
  readonly activeLines: number;
};

export function isCancelledDraft(line: OrderLineDraft): boolean {
  return line.saved?.status === 'CANCELADO';
}

function draftFromLine(line: OrderLineView): OrderLineDraft {
  return {
    key: line.id,
    saved: line,
    recipe: {
      id: line.originalRecipeId,
      name: line.recipeVersion?.originalName ?? line.recipeName ?? '',
      imageUrl: line.recipeImageUrl,
    },
    recipeVersionId: line.recipeVersion === null ? null : line.recipeId,
    quantity: trimDecimal(line.quantity),
    unitId: line.unitId ?? '',
    unitLabel: line.unitLabel,
    presentationLines: fromOrderPresentationLines(line.presentationLines),
    salePrice: trimDecimal(line.salePrice ?? ''),
    ingredientsCost: line.ingredientsCost,
  };
}

export function draftFromOrder(order: Pick<OrderView, 'lines'>): OrderLineDraft[] {
  return [...order.lines].sort((a, b) => a.position - b.position).map(draftFromLine);
}

export function isReadOnly(line: OrderLineDraft): boolean {
  return line.saved !== null && !isEditableOrderLineStatus(line.saved.status);
}

export function canRemove(line: OrderLineDraft): boolean {
  return line.saved === null || isRemovableOrderLineStatus(line.saved.status);
}

/** Dos filas distintas de la tabla con la misma original. Una cancelada no cuenta. */
export function isSameRecipe(a: OrderLineDraft, b: OrderLineDraft): boolean {
  if (a.key === b.key || isCancelledDraft(a) || isCancelledDraft(b)) return false;
  return a.recipe.id === b.recipe.id;
}

// Una receta que no se puede editar viaja tal como se guardó: el servidor rechaza cualquier cambio.
function savedCandidate(saved: OrderLineView): OrderLineCandidate {
  return {
    id: saved.id,
    recipeId: saved.originalRecipeId,
    recipeVersionId: saved.recipeVersion === null ? null : saved.recipeId,
    quantity: saved.quantity,
    unitId: saved.unitId ?? '',
    presentationLines: toDistributionLinesInput(fromOrderPresentationLines(saved.presentationLines)),
    salePrice: saved.salePrice ?? '',
  };
}

function draftCandidate(line: OrderLineDraft): OrderLineCandidate {
  const values = {
    recipeId: line.recipe.id,
    recipeVersionId: line.recipeVersionId,
    quantity: line.quantity,
    unitId: line.unitId,
    presentationLines: toDistributionLinesInput(line.presentationLines),
    salePrice: line.salePrice,
  };
  return line.saved === null ? values : { id: line.saved.id, ...values };
}

export function candidateOf(
  lines: readonly OrderLineDraft[],
  header: OrderCandidateHeader,
): OrderCandidateWithRows {
  const sent: OrderLineCandidate[] = [];
  const rowOfPosition: number[] = [];
  lines.forEach((line, row) => {
    if (isCancelledDraft(line)) return;
    sent.push(line.saved !== null && isReadOnly(line) ? savedCandidate(line.saved) : draftCandidate(line));
    rowOfPosition.push(row);
  });
  return {
    candidate: {
      lines: sent,
      priority: header.priority,
      customerId: header.customerId ?? '',
      confirmBlocked: header.confirmBlocked,
    },
    rowOfPosition,
  };
}

export function draftTotals(lines: readonly OrderLineDraft[]): OrderDraftTotals {
  const active = lines.filter((line) => !isCancelledDraft(line));
  const prices = active.map((line) => line.salePrice.trim()).filter((price) => price !== '');
  const costs = active.flatMap((line) => (line.ingredientsCost === null ? [] : [line.ingredientsCost]));
  return {
    salePriceTotal: prices.length === 0 ? null : sumDecimal4(prices),
    linesWithoutPrice: active.length - prices.length,
    ingredientsCostTotal:
      active.length > 0 && costs.length === active.length ? sumDecimal4(costs) : null,
    activeLines: active.length,
  };
}
