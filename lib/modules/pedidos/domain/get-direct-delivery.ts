import { requirePermission, type Actor } from './actor';
import type { WaitingOrder } from './direct-delivery';
import { ActionNotAllowedError } from './errors';

import type { WaitingOrdersReader } from '../ports/direct-delivery-repository';

import type { DeliverableBatch, FinishedProductDeliveryCatalog } from '@/lib/modules/inventario';

export type DirectDeliveryView = {
  readonly productId: string;
  readonly productName: string;
  readonly presentationName: string | null;
  readonly stockPackages: number;
  readonly waiting: readonly WaitingOrder[];
  readonly waitingPackages: number;
  readonly surplusPackages: number;
  readonly batches: readonly DeliverableBatch[];
};

export type GetDirectDeliveryDeps = {
  readonly catalog: Pick<FinishedProductDeliveryCatalog, 'findForDelivery'>;
  readonly waiting: WaitingOrdersReader;
};

/** Lo que el sheet de entrega sin pedido necesita de un producto terminado. */
export function createGetDirectDelivery(
  deps: GetDirectDeliveryDeps,
): (productId: string, actor: Actor | null | undefined) => Promise<DirectDeliveryView> {
  void deps;
  return async function getDirectDelivery(productId, actor) {
    requirePermission(actor, 'entregas.modificar');
    throw new ActionNotAllowedError(`getDirectDelivery sin implementar: ${productId}`);
  };
}
