import { wholePackagesIn } from '../../../domain/finished-goods-dispatch';

import { dispatchFinishedGoods, lockFinishedProductForDelivery } from './product-prisma';

import type { Prisma } from '@prisma/client';

import type {
  FinishedGoodsDirectDispatch,
  FinishedGoodsDispatch,
  FinishedGoodsDispatchOutcome,
  FinishedProductDeliveryLock,
} from '../../../domain/finished-goods-dispatch';
import type { InventoryScope } from '../../../domain/inventory-scope';

/**
 * `FinishedGoodsDispatch` sobre el cliente transaccional de quien llama, con el mismo molde que
 * `createFinishedGoodsIntake`: `pedidos` cablea esta fabrica dentro de su unidad de trabajo
 * compartida, asi que la salida, la entrega y el estado del pedido confirman o se deshacen juntos.
 */
export function createFinishedGoodsDispatch(tx: Prisma.TransactionClient): FinishedGoodsDispatch {
  return {
    async dispatchForDelivery(input): Promise<FinishedGoodsDispatchOutcome> {
      const scope: InventoryScope = { companyId: input.companyId };

      return dispatchFinishedGoods(
        tx,
        {
          origin: 'order',
          orderId: input.orderId,
          orderDeliveryId: input.orderDeliveryId,
          recipeId: input.recipeId,
          presentationId: input.presentationId,
          allocations: input.allocations,
          actorId: input.actorId,
          now: input.now,
        },
        scope,
      );
    },
  };
}

/**
 * `FinishedGoodsDirectDispatch` sobre el cliente transaccional de quien llama, con el molde de
 * `createFinishedGoodsDispatch`: el bloqueo, la salida y la entrega sin pedido confirman o se
 * deshacen juntos. Los envases en stock salen de los lotes leidos ya con el producto bloqueado.
 */
export function createFinishedGoodsDirectDispatch(tx: Prisma.TransactionClient): FinishedGoodsDirectDispatch {
  return {
    async lockForDirectDelivery(productId, companyId): Promise<FinishedProductDeliveryLock | null> {
      const scope: InventoryScope = { companyId };
      const locked = await lockFinishedProductForDelivery(tx, productId, scope);
      if (locked === null) return null;

      const stockPackages = locked.batches.reduce(
        (total, batch) => total + wholePackagesIn(batch.stock, batch.packageContent),
        0,
      );
      return { recipeId: locked.recipeId, presentationId: locked.presentationId, stockPackages };
    },

    async dispatchDirect(input): Promise<FinishedGoodsDispatchOutcome> {
      const scope: InventoryScope = { companyId: input.companyId };

      return dispatchFinishedGoods(
        tx,
        {
          origin: 'direct',
          productId: input.productId,
          orderDeliveryId: input.orderDeliveryId,
          allocations: input.allocations,
          actorId: input.actorId,
          now: input.now,
        },
        scope,
      );
    },
  };
}
