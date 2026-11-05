import type { OrderStatus } from './order-classification';
import type { OrderScope } from './order-scope';

import type { LockedOrderLines, OrderWriteRepository } from '../ports/order-write-repository';

/** El estado de un pedido con alguna entrega: el de su receta o recetas, `PARCIAL` si difieren. */
export type DeliveryOrderStatus = Extract<OrderStatus, 'TERMINADO' | 'ENTREGADO' | 'PARCIAL'>;

export function isDeliveryOrderStatus(status: OrderStatus): status is DeliveryOrderStatus {
  return status === 'TERMINADO' || status === 'ENTREGADO' || status === 'PARCIAL';
}

/** Una receta del pedido a efectos de entregar o anular: su linea, o el pedido entero si no tiene
 *  lineas (`lineId` `null`, la misma clave con que lo nombra su reparto). */
export type DeliveryTarget = {
  readonly lineId: string | null;
  readonly status: OrderStatus;
  readonly recipeId: string;
};

export function deliveryTargetsOf(locked: LockedOrderLines): ReadonlyMap<string | null, DeliveryTarget> {
  if (locked.lines.length === 0) {
    return new Map([[null, { lineId: null, status: locked.order.status, recipeId: locked.order.recipeId }]]);
  }
  return new Map(locked.lines.map((line) => [line.id, { lineId: line.id, status: line.status, recipeId: line.recipeId }]));
}

/** El estado del pedido tras cambiar el de sus recetas: con lineas se deriva de ellas; sin lineas es
 *  `withoutLines`, el que dejo la escritura del propio pedido. */
export async function statusAfterDelivery(
  orders: Pick<OrderWriteRepository, 'refreshStatus'>,
  locked: LockedOrderLines,
  withoutLines: OrderStatus,
  actorId: string,
  now: Date,
  scope: OrderScope,
): Promise<DeliveryOrderStatus> {
  const status =
    locked.lines.length === 0 ? withoutLines : await orders.refreshStatus(locked.order.id, actorId, now, scope);
  if (status === null || !isDeliveryOrderStatus(status)) {
    throw new Error(`el pedido ${locked.order.id} quedo en '${String(status)}' tras una entrega o su anulacion`);
  }
  return status;
}
