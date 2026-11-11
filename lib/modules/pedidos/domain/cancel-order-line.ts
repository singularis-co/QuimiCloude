import { requirePermission, type Actor } from './actor';
import { NotCancellableError, OrderNotFoundError, ValidationError } from './errors';
import { cancelLineInsideTransaction } from './order-cancellation';
import { cancelOrderLineSchema } from './order-input';

import type { OrderUnitOfWork } from '../ports/order-unit-of-work';

export type CancelOrderLineDeps = {
  readonly unitOfWork: OrderUnitOfWork;
  /** Ver el comentario identico de `create-order.ts` sobre el origen de este reloj. */
  readonly now?: () => Date;
};

/**
 * Cancela una linea del pedido con su motivo y libera todo su material, en una transaccion, sin
 * tocar las demas lineas; despues deriva el estado del pedido. Una linea de otro pedido, de otra
 * empresa o quitada responde `order_not_found`, igual que un pedido que no existe.
 */
export function createCancelOrderLine(
  deps: CancelOrderLineDeps,
): (orderId: string, lineId: string, input: unknown, actor: Actor | null | undefined) => Promise<void> {
  const now = deps.now ?? (() => new Date());

  return async function cancelOrderLine(orderId, lineId, input, actor): Promise<void> {
    requirePermission(actor, 'pedidos.modificar');

    const parsed = cancelOrderLineSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { reason } = parsed.data;

    const instant = now();
    const result = await deps.unitOfWork.run((transaction) =>
      cancelLineInsideTransaction(transaction, {
        orderId,
        lineId,
        reason,
        actorId: actor.id,
        now: instant,
        companyId: actor.companyId,
      }),
    );

    if (result === 'not_found') throw new OrderNotFoundError();
    if (result === 'not_cancellable') throw new NotCancellableError();
  };
}
