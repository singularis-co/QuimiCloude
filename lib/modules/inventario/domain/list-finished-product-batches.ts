import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { ProductNotFoundError, ValidationError } from './errors';
import { packagedQuantityOf, type FinishedProductBatchRow } from './finished-product-detail';

import type { Page } from './page';
import type { OrderNumberDirectory } from './reservation';
import type { FinishedProductDetailRepository } from '../ports/finished-product-detail-repository';

export type ListFinishedProductBatchesDeps = {
  readonly products: FinishedProductDetailRepository;
  readonly orders: OrderNumberDirectory;
};

const productIdSchema = z.string().uuid();

// El defecto y el tope del tamano los aplica el adaptador.
const pageSchema = z.strictObject({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).optional(),
});

export function createListFinishedProductBatches(
  deps: ListFinishedProductBatchesDeps,
): (id: string, input: unknown, actor: Actor | null | undefined) => Promise<Page<FinishedProductBatchRow>> {
  return async function listFinishedProductBatches(
    id: string,
    input: unknown,
    actor: Actor | null | undefined,
  ): Promise<Page<FinishedProductBatchRow>> {
    requirePermission(actor, 'inventario.consultar');

    const scope = { companyId: actor.companyId };
    if (!productIdSchema.safeParse(id).success) throw new ProductNotFoundError();
    // Se vuelve a comprobar el producto para que un listado ajeno o borrado no salga como pagina vacia.
    if ((await deps.products.findAliveFinished(id, scope)) === null) throw new ProductNotFoundError();

    const parsed = pageSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    const page = await deps.products.listBatches(id, parsed.data, scope);

    const orderIds = [
      ...new Set(page.items.map((item) => item.orderId).filter((orderId): orderId is string => orderId !== null)),
    ];
    const numbers =
      orderIds.length === 0
        ? new Map<string, string>()
        : await deps.orders.findNumberTexts(actor.companyId, orderIds);

    return {
      ...page,
      items: page.items.map(({ orderId, ...batch }) => ({
        ...batch,
        orderNumberText: orderId === null ? null : (numbers.get(orderId) ?? null),
        packagedStock: packagedQuantityOf(batch.stock, batch.packageContent),
      })),
    };
  };
}
