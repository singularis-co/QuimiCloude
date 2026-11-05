import { requirePermission, type Actor } from './actor';
import { NotCancellableError, OrderNotFoundError, ValidationError } from './errors';
import { cancelInsideTransaction } from './order-cancellation';
import { cancelOrderSchema } from './order-input';

import type { OrderUnitOfWork } from '../ports/order-unit-of-work';

export type CancelOrderDeps = {
  /** Cancelar solo libera: no toca la receta, asi que no recibe `recipes`, `products` ni
   *  `units`. Lo que se puede cancelar se decide bajo el candado, sin lectura previa. */
  readonly unitOfWork: OrderUnitOfWork;
  /** Ver el comentario identico de `create-order.ts` sobre el origen de este reloj. */
  readonly now?: () => Date;
};

/**
 * Cancelar el pedido entero: cancela con el mismo motivo cada linea cancelable y deja intactas las
 * demas, en una transaccion; si ninguna lo es, `not_cancellable` sin escribir nada. El pedido queda
 * `CANCELADO`, con el motivo, solo si todas sus lineas acaban canceladas.
 *
 * De `CANCELADO` no se sale y una linea cancelada no se vuelve a cancelar, asi que su motivo no se
 * sustituye nunca.
 */
export function createCancelOrder(
  deps: CancelOrderDeps,
): (id: string, input: unknown, actor: Actor | null | undefined) => Promise<void> {
  const now = deps.now ?? (() => new Date());

  return async function cancelOrder(
    id: string,
    input: unknown,
    actor: Actor | null | undefined,
  ): Promise<void> {
    requirePermission(actor, 'pedidos.modificar');

    const parsed = cancelOrderSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { reason } = parsed.data;

    const instant = now();

    // La empresa sale del ACTOR y jamas de la entrada: nadie puede elegir cancelar en otra.
    const result = await deps.unitOfWork.run((transaction) =>
      cancelInsideTransaction(transaction, {
        id,
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
