import { requirePermission, type Actor } from './actor';
import { ProductNotFoundError } from './errors';

import type { FinishedProductMovementRow } from './finished-product-detail';
import type { Page } from './page';
import type { OrderNumberDirectory } from './reservation';
import type { FinishedProductDetailRepository } from '../ports/finished-product-detail-repository';

export type ListFinishedProductMovementsDeps = {
  readonly products: FinishedProductDetailRepository;
  readonly orders: OrderNumberDirectory;
};

export function createListFinishedProductMovements(
  deps: ListFinishedProductMovementsDeps,
): (id: string, input: unknown, actor: Actor | null | undefined) => Promise<Page<FinishedProductMovementRow>> {
  return async function listFinishedProductMovements(
    id: string,
    input: unknown,
    actor: Actor | null | undefined,
  ): Promise<Page<FinishedProductMovementRow>> {
    requirePermission(actor, 'inventario.consultar');

    void deps;
    throw new ProductNotFoundError();
  };
}
