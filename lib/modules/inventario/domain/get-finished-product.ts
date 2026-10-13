import { requirePermission, type Actor } from './actor';
import { ProductNotFoundError } from './errors';

import type { FinishedProductDetail } from './finished-product-detail';
import type { FinishedProductDetailRepository } from '../ports/finished-product-detail-repository';

import type { UnitCatalog } from '@/lib/modules/unidades';

export type GetFinishedProductDeps = {
  readonly products: FinishedProductDetailRepository;
  readonly units: Pick<UnitCatalog, 'findRefs'>;
};

export function createGetFinishedProduct(
  deps: GetFinishedProductDeps,
): (id: string, actor: Actor | null | undefined) => Promise<FinishedProductDetail> {
  return async function getFinishedProduct(
    id: string,
    actor: Actor | null | undefined,
  ): Promise<FinishedProductDetail> {
    requirePermission(actor, 'inventario.consultar');

    void deps;
    throw new ProductNotFoundError();
  };
}
