import { remainingPackages } from './order-delivery';
import { orderedPackages } from './packing-count';

import type { OrderDeliveryProgress } from './order-catalog';
import type { OrderStatus } from './order-classification';

/** Envases que le faltan por entregar a una presentacion; `label` es su nombre. */
export type OrderPendingDelivery = {
  readonly label: string;
  readonly quantity: number;
};

/**
 * Lo que la fila del listado sabe de la entrega de un pedido:
 * - `not_packed`: todavia no hay nada empacado que entregar (o no lo habra: `CANCELADO`).
 * - `delivered`: se empaco algo y todo lo empacado ya se entrego.
 * - `pending`: queda algo empacado sin entregar; `items` lo detalla por presentacion.
 */
export type OrderDeliveryState =
  | { readonly kind: 'not_packed' }
  | { readonly kind: 'delivered' }
  | { readonly kind: 'pending'; readonly items: readonly OrderPendingDelivery[] };

/** Estados en los que el empaque ya termino: solo en ellos hay algo empacado que entregar. */
const PACKED_STATUSES: readonly OrderStatus[] = ['POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO'];

const NOT_PACKED: OrderDeliveryState = { kind: 'not_packed' };
const DELIVERED: OrderDeliveryState = { kind: 'delivered' };

/**
 * El estado de entrega con el mismo criterio que el sheet de entrega: lo que espera el pedido
 * (`orderedPackages`) menos lo entregado sin anular.
 *
 * `ENTREGADO` es `delivered` aunque no tenga lineas: un entregado anterior a las entregas por
 * linea no tiene nada anotado y ya no debe nada. Antes de terminar el empaque -y en `CANCELADO`-
 * es `not_packed` sin mirar las lineas. Despues, un pedido que no empaco ningun envase tambien es
 * `not_packed`.
 *
 * Una linea cuya presentacion no vuelve del catalogo cuenta para el estado pero no sale en
 * `items`: no hay nombre con que pintarla.
 */
export function deliveryStateOf(
  progress: OrderDeliveryProgress | undefined,
  status: OrderStatus,
  presentations: ReadonlyMap<string, { readonly name: string }>,
): OrderDeliveryState {
  if (status === 'ENTREGADO') return DELIVERED;
  if (!PACKED_STATUSES.includes(status)) return NOT_PACKED;

  let packed = 0;
  let pendingTotal = 0;
  const items: OrderPendingDelivery[] = [];
  for (const line of progress?.lines ?? []) {
    const packages = orderedPackages(line);
    packed += packages;
    const quantity = remainingPackages({
      presentationLineId: line.presentationId,
      orderedPackages: packages,
      deliveredPackages: line.deliveredPackages,
    });
    if (quantity === 0) continue;
    pendingTotal += quantity;
    const label = presentations.get(line.presentationId)?.name;
    if (label !== undefined) items.push({ label, quantity });
  }

  if (packed === 0) return NOT_PACKED;
  return pendingTotal === 0 ? DELIVERED : { kind: 'pending', items };
}
