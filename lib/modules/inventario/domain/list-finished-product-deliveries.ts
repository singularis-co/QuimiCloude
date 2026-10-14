import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { compareQuantities, subtractQuantities } from './decimal-quantity';
import { ProductNotFoundError, ValidationError } from './errors';

import type {
  DeliveredTotal,
  FinishedDeliveryDirectory,
  FinishedProductDeliveriesPage,
} from './finished-product-detail';
import type { OrderNumberDirectory } from './reservation';
import type { FinishedProductDetailRepository } from '../ports/finished-product-detail-repository';

import type { CustomerCatalog, CustomerRef } from '@/lib/modules/clientes';

export type ListFinishedProductDeliveriesDeps = {
  readonly products: FinishedProductDetailRepository;
  readonly orders: OrderNumberDirectory;
  readonly deliveries: FinishedDeliveryDirectory;
  readonly customers: Pick<CustomerCatalog, 'findRefsIncludingDeleted'>;
};

type DeliveryDetails = Awaited<ReturnType<FinishedDeliveryDirectory['findDeliveryDetails']>>;

const ZERO_QUANTITY = '0.0000';
const NOTHING_DELIVERED: DeliveredTotal = { quantity: ZERO_QUANTITY, packages: 0 };

const productIdSchema = z.string().uuid();

// El defecto y el tope del tamano los aplica el adaptador.
const pageSchema = z.strictObject({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).optional(),
});

function absoluteQuantity(quantity: string): string {
  return compareQuantities(quantity, ZERO_QUANTITY) < 0 ? subtractQuantities(ZERO_QUANTITY, quantity) : quantity;
}

function uniqueNonNull(values: readonly (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => value !== null && value !== undefined))];
}

export function createListFinishedProductDeliveries(
  deps: ListFinishedProductDeliveriesDeps,
): (id: string, input: unknown, actor: Actor | null | undefined) => Promise<FinishedProductDeliveriesPage> {
  return async function listFinishedProductDeliveries(
    id: string,
    input: unknown,
    actor: Actor | null | undefined,
  ): Promise<FinishedProductDeliveriesPage> {
    requirePermission(actor, 'inventario.consultar');

    const scope = { companyId: actor.companyId };
    if (!productIdSchema.safeParse(id).success) throw new ProductNotFoundError();
    // Se vuelve a comprobar el producto para que un listado ajeno o borrado no salga como pagina vacia.
    const record = await deps.products.findAliveFinished(id, scope);
    if (record === null) throw new ProductNotFoundError();

    const parsed = pageSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    const page = await deps.products.listDeliveryMovements(id, parsed.data, scope);
    if (page.total === 0) return { ...page, items: [], delivered: NOTHING_DELIVERED };

    const deliveryIds = uniqueNonNull(page.items.map((item) => item.orderDeliveryId));
    const orderIds = uniqueNonNull(page.items.map((item) => item.orderId));

    // El total cubre todos los lotes del producto, no solo los de la pagina.
    const [delivered, details, numbers] = await Promise.all([
      deps.deliveries.summarizeDelivered(
        actor.companyId,
        record.batches.map((batch) => batch.id),
      ),
      deliveryIds.length === 0
        ? Promise.resolve<DeliveryDetails>(new Map())
        : deps.deliveries.findDeliveryDetails(actor.companyId, deliveryIds),
      orderIds.length === 0
        ? Promise.resolve(new Map<string, string>())
        : deps.orders.findNumberTexts(actor.companyId, orderIds),
    ]);

    const customerIds = uniqueNonNull([...details.values()].map((detail) => detail.customerId));
    const customers =
      customerIds.length === 0
        ? []
        : await deps.customers.findRefsIncludingDeleted(customerIds, actor.companyId);
    const customersById = new Map<string, CustomerRef>(customers.map((customer) => [customer.id, customer]));

    // Lo que no vuelve de un directorio sale como ausente y la fila se queda en su sitio.
    return {
      ...page,
      items: page.items.map((movement) => {
        const detail = details.get(movement.orderDeliveryId);
        const line = detail?.linesByBatch.get(movement.batchId);
        return {
          movementId: movement.id,
          orderDeliveryId: movement.orderDeliveryId,
          createdAt: movement.createdAt,
          customer: detail === undefined ? null : (customersById.get(detail.customerId) ?? null),
          orderNumberText: movement.orderId === null ? null : (numbers.get(movement.orderId) ?? null),
          batchId: movement.batchId,
          lot: movement.lot,
          packages: line?.packages ?? null,
          quantity: absoluteQuantity(movement.quantity),
          void: line?.void ?? null,
        };
      }),
      delivered,
    };
  };
}
