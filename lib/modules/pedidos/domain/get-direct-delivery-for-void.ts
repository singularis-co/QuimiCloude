import { requirePermission, type Actor } from './actor';
import { ActionNotAllowedError } from './errors';

import type { OrderDeliveryVoidRepository } from '../ports/order-delivery-void-repository';

import type { CustomerCatalog } from '@/lib/modules/clientes';
import type { FinishedProductDeliveryCatalog } from '@/lib/modules/inventario';

export type DirectDeliveryVoidCustomer = {
  readonly customerId: string;
  readonly customerName: string;
  readonly packages: number;
};

export type DirectDeliveryVoidView = {
  readonly deliveryId: string;
  /** ISO. */
  readonly createdAt: string;
  readonly presentationName: string | null;
  /** Solo los clientes con su parte sin anular, por nombre ascendente y luego id. */
  readonly customers: readonly DirectDeliveryVoidCustomer[];
};

export type GetDirectDeliveryForVoidDeps = {
  readonly voids: Pick<OrderDeliveryVoidRepository, 'findDelivery' | 'findDeliveryLines'>;
  readonly catalog: Pick<FinishedProductDeliveryCatalog, 'findForDelivery'>;
  readonly customerCatalog: Pick<CustomerCatalog, 'findRefsIncludingDeleted'>;
};

/** Lo que el dialogo de anular necesita de una entrega sin pedido. */
export function createGetDirectDeliveryForVoid(
  deps: GetDirectDeliveryForVoidDeps,
): (deliveryId: string, actor: Actor | null | undefined) => Promise<DirectDeliveryVoidView> {
  void deps;
  return async function getDirectDeliveryForVoid(deliveryId, actor) {
    requirePermission(actor, 'entregas.anular');
    throw new ActionNotAllowedError(`getDirectDeliveryForVoid sin implementar: ${deliveryId}`);
  };
}
