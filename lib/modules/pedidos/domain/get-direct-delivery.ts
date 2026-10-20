import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { surplusPackages, waitingOrders, waitingPackages, type WaitingOrder } from './direct-delivery';
import { ProductNotFoundError } from './errors';
import type { OrderScope } from './order-scope';

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

const productIdSchema = z.string().uuid();

/** Lo que el sheet de entrega sin pedido necesita de un producto terminado. */
export function createGetDirectDelivery(
  deps: GetDirectDeliveryDeps,
): (productId: string, actor: Actor | null | undefined) => Promise<DirectDeliveryView> {
  return async function getDirectDelivery(productId, actor) {
    requirePermission(actor, 'entregas.modificar');
    if (!productIdSchema.safeParse(productId).success) throw new ProductNotFoundError();
    const scope: OrderScope = { companyId: actor.companyId };

    const product = await deps.catalog.findForDelivery(productId, scope.companyId);
    if (product === null) throw new ProductNotFoundError();

    // Sin receta o sin presentacion ningun pedido puede esperar este producto.
    const { recipeId, presentationId } = product;
    const lines =
      recipeId !== null && presentationId !== null
        ? await deps.waiting.listWaitingLines([{ recipeId, presentationId }], scope)
        : [];
    const waiting = waitingOrders(lines);

    return {
      productId: product.productId,
      productName: product.name,
      presentationName: product.presentationName,
      stockPackages: product.stockPackages,
      waiting,
      waitingPackages: waitingPackages(waiting),
      surplusPackages: surplusPackages(product.stockPackages, waiting),
      batches: product.batches,
    };
  };
}
