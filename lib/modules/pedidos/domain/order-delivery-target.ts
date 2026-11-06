import type { OrderStatus } from './order-classification';
import type { OrderScope } from './order-scope';

import type { LockedOrderLines, OrderWriteRepository } from '../ports/order-write-repository';

/** El estado de un pedido con alguna entrega: el de su receta o recetas, `PARCIAL` si difieren. */
export type DeliveryOrderStatus = Extract<OrderStatus, 'TERMINADO' | 'ENTREGADO' | 'PARCIAL'>;

export function isDeliveryOrderStatus(status: OrderStatus): status is DeliveryOrderStatus {
  return status === 'TERMINADO' || status === 'ENTREGADO' || status === 'PARCIAL';
}

/** Una receta del pedido a efectos de entregar o anular: su linea. */
export type DeliveryTarget = {
  readonly lineId: string;
  readonly status: OrderStatus;
  readonly recipeId: string;
};

export function deliveryTargetsOf(locked: LockedOrderLines): ReadonlyMap<string, DeliveryTarget> {
  return new Map(locked.lines.map((line) => [line.id, { lineId: line.id, status: line.status, recipeId: line.recipeId }]));
}

/** El estado del pedido tras cambiar el de sus recetas, derivado de ellas. */
export async function statusAfterDelivery(
  orders: Pick<OrderWriteRepository, 'refreshStatus'>,
  locked: LockedOrderLines,
  actorId: string,
  now: Date,
  scope: OrderScope,
): Promise<DeliveryOrderStatus> {
  const status = await orders.refreshStatus(locked.order.id, actorId, now, scope);
  if (status === null || !isDeliveryOrderStatus(status)) {
    throw new Error(`el pedido ${locked.order.id} quedo en '${String(status)}' tras una entrega o su anulacion`);
  }
  return status;
}
