import { requirePermission, type Actor } from './actor';
import { ProductNotFoundError } from './errors';

import type { ProducedProductLink } from './finished-product-detail';
import type { FinishedProductDetailRepository } from '../ports/finished-product-detail-repository';

export type ListProducedProductsDeps = {
  readonly products: FinishedProductDetailRepository;
};

export function createListProducedProducts(
  deps: ListProducedProductsDeps,
): (orderIds: unknown, actor: Actor | null | undefined) => Promise<readonly ProducedProductLink[]> {
  return async function listProducedProducts(
    orderIds: unknown,
    actor: Actor | null | undefined,
  ): Promise<readonly ProducedProductLink[]> {
    requirePermission(actor, 'inventario.consultar');

    void deps;
    throw new ProductNotFoundError();
  };
}
