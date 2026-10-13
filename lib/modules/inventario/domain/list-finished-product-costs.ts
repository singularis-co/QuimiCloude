import { requirePermission, type Actor } from './actor';
import { ProductNotFoundError } from './errors';

import type { FinishedProductCostRow } from './finished-product-detail';
import type { Page } from './page';
import type { OrderNumberDirectory } from './reservation';
import type { FinishedProductDetailRepository } from '../ports/finished-product-detail-repository';

export type ListFinishedProductCostsDeps = {
  readonly products: FinishedProductDetailRepository;
  readonly orders: OrderNumberDirectory;
};

export function createListFinishedProductCosts(
  deps: ListFinishedProductCostsDeps,
): (id: string, input: unknown, actor: Actor | null | undefined) => Promise<Page<FinishedProductCostRow>> {
  return async function listFinishedProductCosts(
    id: string,
    input: unknown,
    actor: Actor | null | undefined,
  ): Promise<Page<FinishedProductCostRow>> {
    requirePermission(actor, 'inventario.consultar');

    void deps;
    throw new ProductNotFoundError();
  };
}
