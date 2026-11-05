// lib/modules/asignaciones/domain/only-order-line.ts
/**
 * Las pantallas de planta operan todavia un pedido de una receta: la linea que se opera es la unica
 * del pedido en el estado pedido. Si hay varias, la pantalla no sabe cual es, y se rechaza sin
 * escribir nada.
 */
import { OrderNotFoundError, ValidationError } from './errors';

import type { AssignedOrderSummary, OrderCatalog, OrderStatus, Page } from '@/lib/modules/pedidos';

/** La fila de la unica linea del resumen, o `undefined` si no hay ninguna. */
export function onlyLineOf(page: Page<AssignedOrderSummary>): AssignedOrderSummary | undefined {
  if (page.total > 1) throw new ValidationError(`el pedido tiene ${String(page.total)} recetas en ese estado`);
  return page.items[0];
}

/** Lee la unica linea del pedido en alguno de `statuses`; `OrderNotFoundError` si no hay ninguna.
 *  Quien escribe pide tambien el estado al que la lleva otra persona a la vez: asi la carrera la
 *  resuelve la escritura, con su propio resultado, y no esta lectura. */
export async function findOnlyLine(
  orders: Pick<OrderCatalog, 'listAliveSummariesByIds'>,
  companyId: string,
  orderId: string,
  statuses: readonly OrderStatus[],
): Promise<AssignedOrderSummary> {
  const line = onlyLineOf(await orders.listAliveSummariesByIds(companyId, [orderId], statuses, 1, 1));
  if (line === undefined) throw new OrderNotFoundError();
  return line;
}
