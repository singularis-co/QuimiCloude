import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { compareQuantities, subtractQuantities } from './decimal-quantity';
import { ProductNotFoundError, ValidationError } from './errors';
import {
  FINISHED_PRODUCT_MOVEMENT_DIRECTIONS,
  packagedQuantityOf,
  type FinishedProductMovementRow,
} from './finished-product-detail';

import type { Page } from './page';
import type { OrderNumberDirectory } from './reservation';
import type { FinishedProductDetailRepository } from '../ports/finished-product-detail-repository';

export type ListFinishedProductMovementsDeps = {
  readonly products: FinishedProductDetailRepository;
  readonly orders: OrderNumberDirectory;
};

const ZERO_QUANTITY = '0.0000';

const productIdSchema = z.string().uuid();

// El defecto y el tope del tamano los aplica el adaptador.
const movementsPageSchema = z.strictObject({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).optional(),
  direction: z.enum(FINISHED_PRODUCT_MOVEMENT_DIRECTIONS),
});

function absoluteQuantity(quantity: string): string {
  return compareQuantities(quantity, ZERO_QUANTITY) < 0 ? subtractQuantities(ZERO_QUANTITY, quantity) : quantity;
}

export function createListFinishedProductMovements(
  deps: ListFinishedProductMovementsDeps,
): (id: string, input: unknown, actor: Actor | null | undefined) => Promise<Page<FinishedProductMovementRow>> {
  return async function listFinishedProductMovements(
    id: string,
    input: unknown,
    actor: Actor | null | undefined,
  ): Promise<Page<FinishedProductMovementRow>> {
    requirePermission(actor, 'inventario.consultar');

    const scope = { companyId: actor.companyId };
    if (!productIdSchema.safeParse(id).success) throw new ProductNotFoundError();
    // Se vuelve a comprobar el producto para que un listado ajeno o borrado no salga como pagina vacia.
    if ((await deps.products.findAliveFinished(id, scope)) === null) throw new ProductNotFoundError();

    const parsed = movementsPageSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { direction, ...pageRequest } = parsed.data;

    const page = await deps.products.listMovements(id, direction, pageRequest, scope);

    const orderIds = [
      ...new Set(page.items.map((item) => item.orderId).filter((orderId): orderId is string => orderId !== null)),
    ];
    const numbers =
      orderIds.length === 0
        ? new Map<string, string>()
        : await deps.orders.findNumberTexts(actor.companyId, orderIds);

    return {
      ...page,
      items: page.items.map((movement) => {
        const quantity = absoluteQuantity(movement.quantity);
        return {
          id: movement.id,
          kind: movement.kind,
          batchId: movement.batchId,
          lot: movement.lot,
          quantity,
          packaged: packagedQuantityOf(quantity, movement.packageContent),
          orderNumberText: movement.orderId === null ? null : (numbers.get(movement.orderId) ?? null),
          reason: movement.reason,
          createdAt: movement.createdAt,
        };
      }),
    };
  };
}
