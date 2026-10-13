import { requirePermission, type Actor } from './actor';
import { ProductNotFoundError } from './errors';

import type { FinishedProductBatchRow } from './finished-product-detail';
import type { Page } from './page';
import type { OrderNumberDirectory } from './reservation';
import type { FinishedProductDetailRepository } from '../ports/finished-product-detail-repository';

export type ListFinishedProductBatchesDeps = {
  readonly products: FinishedProductDetailRepository;
  readonly orders: OrderNumberDirectory;
};

export function createListFinishedProductBatches(
  deps: ListFinishedProductBatchesDeps,
): (id: string, input: unknown, actor: Actor | null | undefined) => Promise<Page<FinishedProductBatchRow>> {
  return async function listFinishedProductBatches(
    id: string,
    input: unknown,
    actor: Actor | null | undefined,
  ): Promise<Page<FinishedProductBatchRow>> {
    requirePermission(actor, 'inventario.consultar');

    void deps;
    throw new ProductNotFoundError();
  };
}
