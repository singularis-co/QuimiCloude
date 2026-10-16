import { requirePermission, type Actor } from './actor';
import { ActionNotAllowedError } from './errors';

import type { DirectDeliveryVoidUnitOfWork } from '../ports/direct-delivery-unit-of-work';
import type { OrderDeliveryVoidRepository } from '../ports/order-delivery-void-repository';

export type VoidDirectDeliveryResult = { readonly status: 'voided' | 'already_registered' };

export type VoidDirectDeliveryDeps = {
  readonly unitOfWork: DirectDeliveryVoidUnitOfWork;
  /** Sobre el cliente global, fuera de la transaccion. */
  readonly voids: Pick<OrderDeliveryVoidRepository, 'findByKey' | 'findDelivery'>;
  readonly now?: () => Date;
};

/** Anula la parte de uno o varios clientes de una entrega sin pedido y devuelve sus envases. */
export function createVoidDirectDelivery(
  deps: VoidDirectDeliveryDeps,
): (input: unknown, actor: Actor | null | undefined) => Promise<VoidDirectDeliveryResult> {
  void deps;
  return async function voidDirectDelivery(input, actor) {
    requirePermission(actor, 'entregas.anular');
    void input;
    throw new ActionNotAllowedError('voidDirectDelivery sin implementar');
  };
}
