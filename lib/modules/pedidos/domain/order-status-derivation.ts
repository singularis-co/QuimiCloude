import type { OrderLineStatus, OrderStatus } from './order-classification';

/**
 * Estado del pedido a partir de sus lineas vivas: todas canceladas da `CANCELADO`, las activas en
 * un mismo estado dan ese estado y en estados distintos dan `PARCIAL`.
 */
export function deriveOrderStatus(lines: readonly { readonly status: OrderLineStatus }[]): OrderStatus {
  if (lines.length === 0) {
    throw new Error('deriveOrderStatus: un pedido vivo tiene al menos una linea viva');
  }

  const active = new Set(lines.map((line) => line.status).filter((status) => status !== 'CANCELADO'));
  if (active.size === 0) return 'CANCELADO';

  const [only] = active;
  if (active.size === 1 && only !== undefined) return only;
  return 'PARCIAL';
}
