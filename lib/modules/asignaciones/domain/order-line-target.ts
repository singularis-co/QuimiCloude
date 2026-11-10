// lib/modules/asignaciones/domain/order-line-target.ts
import { z } from 'zod';

import { OrderNotFoundError } from './errors';

import type { AssignedOrderSummary, OrderAssignmentTarget, OrderCatalog } from '@/lib/modules/pedidos';

/** La receta que opera una accion de planta: el pedido y su linea. */
export const orderLineInputSchema = z.strictObject({
  orderId: z.string().uuid(),
  lineId: z.string().uuid(),
});

/** La linea nombrada de un pedido vivo de la empresa; `OrderNotFoundError` si no lo es. */
export async function findLine(
  orders: Pick<OrderCatalog, 'findAliveLineSummary'>,
  companyId: string,
  orderId: string,
  lineId: string,
): Promise<AssignedOrderSummary> {
  const line = await orders.findAliveLineSummary(companyId, orderId, lineId);
  if (line === null) throw new OrderNotFoundError();
  return line;
}

/** La linea como si fuera un pedido de una sola receta, para las tablas de estado por pedido. */
export function lineAsTarget(line: Pick<AssignedOrderSummary, 'id' | 'status'>): OrderAssignmentTarget {
  return { id: line.id, status: line.status, activeLineStatuses: [line.status] };
}
