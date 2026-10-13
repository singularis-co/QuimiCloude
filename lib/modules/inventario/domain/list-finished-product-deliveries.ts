import { requirePermission, type Actor } from './actor';
import { ProductNotFoundError } from './errors';

import type { FinishedDeliveryDirectory, FinishedProductDeliveriesPage } from './finished-product-detail';
import type { OrderNumberDirectory } from './reservation';
import type { FinishedProductDetailRepository } from '../ports/finished-product-detail-repository';

import type { CustomerCatalog } from '@/lib/modules/clientes';

export type ListFinishedProductDeliveriesDeps = {
  readonly products: FinishedProductDetailRepository;
  readonly orders: OrderNumberDirectory;
  readonly deliveries: FinishedDeliveryDirectory;
  readonly customers: Pick<CustomerCatalog, 'findRefsIncludingDeleted'>;
};

export function createListFinishedProductDeliveries(
  deps: ListFinishedProductDeliveriesDeps,
): (id: string, input: unknown, actor: Actor | null | undefined) => Promise<FinishedProductDeliveriesPage> {
  return async function listFinishedProductDeliveries(
    id: string,
    input: unknown,
    actor: Actor | null | undefined,
  ): Promise<FinishedProductDeliveriesPage> {
    requirePermission(actor, 'inventario.consultar');

    void deps;
    throw new ProductNotFoundError();
  };
}
