import {
  batchesOverAvailable,
  type DeliveryAllocation,
  type DeliveryBatchState,
} from './order-delivery';

export const DIRECT_DELIVERY_NOTE_MAX_LENGTH = 500;

/** Productos por peticion al calcular el excedente de una pagina del listado. */
export const DIRECT_DELIVERY_SURPLUS_MAX_PRODUCTS = 200;

/** Una linea del reparto de un pedido TERMINADO de la misma receta y presentacion. */
export type WaitingOrderLine = {
  readonly orderId: string;
  readonly numberText: string;
  /** Los envases que espera el pedido (`orderedPackages`): los libres quedan para el excedente. */
  readonly orderedPackages: number;
  /** Sin las lineas anuladas. */
  readonly deliveredPackages: number;
};

export type WaitingOrder = {
  readonly orderId: string;
  readonly numberText: string;
  readonly missingPackages: number;
};

/** Los pedidos a los que les faltan envases, por `numberText` ascendente. */
export function waitingOrders(lines: readonly WaitingOrderLine[]): readonly WaitingOrder[] {
  const byOrder = new Map<string, { numberText: string; missingPackages: number }>();
  for (const line of lines) {
    const missing = Math.max(0, line.orderedPackages - line.deliveredPackages);
    const current = byOrder.get(line.orderId);
    if (current === undefined) byOrder.set(line.orderId, { numberText: line.numberText, missingPackages: missing });
    else current.missingPackages += missing;
  }
  return [...byOrder]
    .filter(([, order]) => order.missingPackages > 0)
    .map(([orderId, order]) => ({ orderId, numberText: order.numberText, missingPackages: order.missingPackages }))
    .sort((a, b) => compareText(a.numberText, b.numberText) || compareText(a.orderId, b.orderId));
}

function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function waitingPackages(waiting: readonly WaitingOrder[]): number {
  return waiting.reduce((sum, order) => sum + order.missingPackages, 0);
}

export function surplusPackages(stockPackages: number, waiting: readonly WaitingOrder[]): number {
  return Math.max(0, stockPackages - waitingPackages(waiting));
}

/** Recorta y deja una nota vacia en `null`. El tope lo valida quien llama. */
export function normalizeDeliveryNote(note: string | null): string | null {
  if (note === null) return null;
  const trimmed = note.trim();
  return trimmed === '' ? null : trimmed;
}

/** Una entrega sin pedido tiene una sola «linea»: el producto. Con esa forma, las reglas de bloque y
 *  de lote de la entrega de pedido sirven sin cambios. */
export function directAllocations(
  productId: string,
  allocations: readonly { readonly batchId: string; readonly packages: number }[],
): readonly DeliveryAllocation[] {
  return allocations.map(({ batchId, packages }) => ({ presentationLineId: productId, batchId, packages }));
}

export type DirectDeliveryCheck =
  | { readonly kind: 'ok' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'exceeds_surplus'; readonly surplus: number }
  | { readonly kind: 'exceeds_batch'; readonly batchIds: readonly string[] };

function totalPackages(allocations: readonly DeliveryAllocation[]): number {
  return allocations.reduce((sum, allocation) => sum + (allocation.packages > 0 ? allocation.packages : 0), 0);
}

/** En este orden: `empty`, `exceeds_surplus` y `exceeds_batch`. Con `batches` en `null` no se mira
 *  el lote: lo hace quien lo tiene bloqueado. */
export function checkDirectDelivery(
  surplus: number,
  batches: readonly DeliveryBatchState[] | null,
  allocations: readonly DeliveryAllocation[],
): DirectDeliveryCheck {
  const total = totalPackages(allocations);
  if (total === 0) return { kind: 'empty' };
  if (total > surplus) return { kind: 'exceeds_surplus', surplus };
  if (batches !== null) {
    const batchIds = batchesOverAvailable(batches, allocations);
    if (batchIds.length > 0) return { kind: 'exceeds_batch', batchIds };
  }
  return { kind: 'ok' };
}
