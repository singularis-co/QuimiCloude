import { requirePermission, type Actor } from './actor';
import { ActionNotAllowedError } from './errors';

import type { DirectDeliveryRepository } from '../ports/direct-delivery-repository';
import type { DirectDeliveryUnitOfWork } from '../ports/direct-delivery-unit-of-work';

import type { CustomerCatalog } from '@/lib/modules/clientes';

export type DeliverDirectResult = { readonly status: 'delivered' | 'already_registered' };

export type DeliverDirectDeps = {
  readonly customerCatalog: Pick<CustomerCatalog, 'findAliveRefById'>;
  readonly unitOfWork: DirectDeliveryUnitOfWork;
  /** Sobre el cliente global: la clave se mira antes de abrir la transaccion. */
  readonly deliveries: Pick<DirectDeliveryRepository, 'findByKey'>;
  readonly now?: () => Date;
};

/** Registra una entrega sin pedido de los lotes de un producto terminado a uno o varios clientes. */
export function createDeliverDirect(
  deps: DeliverDirectDeps,
): (input: unknown, actor: Actor | null | undefined) => Promise<DeliverDirectResult> {
  void deps;
  return async function deliverDirect(input, actor) {
    requirePermission(actor, 'entregas.modificar');
    void input;
    throw new ActionNotAllowedError('deliverDirect sin implementar');
  };
}
