import { requirePermission, type Actor } from './actor';
import { NotCancellableError, OrderNotFoundError, ValidationError } from './errors';
import { cancelLockedLine, isCancellableStatus } from './order-cancellation';
import { cancelOrderLineSchema } from './order-input';
import type { OrderScope } from './order-scope';

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

    const scope: OrderScope = { companyId: actor.companyId };
    const instant = now();

    const result = await deps.unitOfWork.run(async (transaction) => {
      // Pedido y despues linea, el mismo orden que las demas escrituras, para no cruzar candados.
      const locked = await transaction.orders.lockAliveLine(orderId, lineId, scope);
      if (locked === null) return 'not_found' as const;
      if (!isCancellableStatus(locked.line.status)) return 'not_cancellable' as const;

      await cancelLockedLine(transaction, {
        orderId,
        lineId,
        reason,
        releaseReason: 'release',
        actorId: actor.id,
        now: instant,
        companyId: actor.companyId,
      });
      await transaction.orders.refreshStatus(orderId, actor.id, instant, scope);
      await transaction.orders.mirrorFirstLine(orderId, scope);
      return 'ok' as const;
    });

    if (result === 'not_found') throw new OrderNotFoundError();
    if (result === 'not_cancellable') throw new NotCancellableError();
  };
}
