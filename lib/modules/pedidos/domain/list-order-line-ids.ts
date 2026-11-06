import { requirePermission, type Actor } from './actor';
import { OrderNotFoundError } from './errors';
import type { OrderScope } from './order-scope';

import type { OrderRepository } from '../ports/order-repository';

export type ListOrderLineIdsDeps = {
  readonly orders: Pick<OrderRepository, 'findAliveById' | 'findAliveLines'>;
};

/**
 * Los identificadores de las lineas vivas de un pedido, en su orden. Lo usa el formulario de una
 * sola receta para nombrar la linea que edita; pide el mismo permiso que editar, y un pedido ajeno
 * o borrado responde como uno que no existe.
 */
export function createListOrderLineIds(
  deps: ListOrderLineIdsDeps,
): (orderId: string, actor: Actor | null | undefined) => Promise<readonly string[]> {
  return async function listOrderLineIds(orderId, actor) {
    requirePermission(actor, 'pedidos.modificar');
    const scope: OrderScope = { companyId: actor.companyId };

    const order = await deps.orders.findAliveById(orderId, scope);
    if (order === null) throw new OrderNotFoundError();

    const lines = await deps.orders.findAliveLines(orderId, scope);
    return lines.map((line) => line.id);
  };
}
