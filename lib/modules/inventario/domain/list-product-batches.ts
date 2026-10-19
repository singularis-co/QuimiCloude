import { canViewUnitCosts, requirePermission, type Actor } from './actor';
import { withoutUnitCost } from './product-batch-view';

import type { ProductBatchView } from './product-batch-view';
import type { ProductRepository } from '../ports/product-repository';

export type ListProductBatchesDeps = {
  readonly products: ProductRepository;
};

/**
 * Los lotes de un producto, para el panel que permite elegir cual corregir.
 *
 * Consultar exige su propio permiso: quien solo puede modificar no lee. El producto inexistente, el
 * borrado y el de otra empresa vuelven los tres como lista vacia -lo resuelve el puerto-, asi que
 * desde aqui no hay forma de averiguar cual de los tres era. Sin `canViewUnitCosts`, los lotes salen
 * sin `unitCost`.
 */
export function createListProductBatches(
  deps: ListProductBatchesDeps,
): (productId: string, actor: Actor | null | undefined) => Promise<readonly ProductBatchView[]> {
  return async function listProductBatches(
    productId: string,
    actor: Actor | null | undefined,
  ): Promise<readonly ProductBatchView[]> {
    requirePermission(actor, 'inventario.consultar');

    const batches = await deps.products.findBatchesOfAliveProduct(productId, { companyId: actor.companyId });
    // El costo unitario del lote solo sale para quien cumple `canViewUnitCosts`.
    return canViewUnitCosts(actor) ? batches : batches.map(withoutUnitCost);
  };
}
