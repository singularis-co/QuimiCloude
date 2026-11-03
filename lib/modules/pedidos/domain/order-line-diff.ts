import { DuplicateOrderRecipeError, OrderNotFoundError, ValidationError } from './errors';
import type { OrderLineStatus } from './order-classification';
import { assertTransition } from './order-transitions';

type EntryLine = { readonly id?: string | undefined };
type SavedLine = { readonly id: string; readonly status: OrderLineStatus };

export type OrderLineDiff<I extends EntryLine, S extends SavedLine> = {
  readonly edited: readonly { readonly input: I; readonly saved: S }[];
  readonly added: readonly I[];
  readonly removed: readonly S[];
};

/**
 * Reparte la entrada de una edicion contra las lineas vivas del pedido. Una linea cancelada que no
 * llega se deja como esta. Un `id` que no es de una linea viva del pedido responde igual que un
 * pedido ajeno, para no distinguir «no existe» de «no es tuya».
 */
export function diffOrderLines<I extends EntryLine, S extends SavedLine>(
  entry: readonly I[],
  saved: readonly S[],
): OrderLineDiff<I, S> {
  const savedById = new Map(saved.map((line) => [line.id, line]));
  const seen = new Set<string>();
  const edited: { readonly input: I; readonly saved: S }[] = [];
  const added: I[] = [];

  for (const input of entry) {
    if (input.id === undefined) {
      added.push(input);
      continue;
    }
    if (seen.has(input.id)) throw new ValidationError(`linea ${input.id} repetida en la entrada`);
    seen.add(input.id);
    const match = savedById.get(input.id);
    if (match === undefined) throw new OrderNotFoundError(`linea ${input.id}`);
    edited.push({ input, saved: match });
  }

  const removed = saved.filter((line) => line.status !== 'CANCELADO' && !seen.has(line.id));
  return { edited, added, removed };
}

/** Una linea que llega sin cambios no se mira: solo una con cambios necesita estado editable. */
export function assertOrderLineEditable(status: OrderLineStatus, changed: boolean): void {
  if (changed) assertTransition(status, status);
}

/**
 * La receta se compara por su original, asi que una version choca con su original y con otra
 * version de la misma. Una entrada que nombra una linea cancelada no cuenta: esa linea no vuelve.
 */
export function assertNoDuplicateOrderRecipe(
  entry: readonly (EntryLine & { readonly originalRecipeId: string })[],
  saved: readonly SavedLine[] = [],
): void {
  const cancelled = new Set(saved.filter((line) => line.status === 'CANCELADO').map((line) => line.id));
  const positionByRecipe = new Map<string, number>();

  entry.forEach((line, position) => {
    if (line.id !== undefined && cancelled.has(line.id)) return;
    const first = positionByRecipe.get(line.originalRecipeId);
    if (first !== undefined) {
      throw new DuplicateOrderRecipeError(
        `receta ${line.originalRecipeId} en las posiciones ${first} y ${position} de la entrada`,
      );
    }
    positionByRecipe.set(line.originalRecipeId, position);
  });
}
