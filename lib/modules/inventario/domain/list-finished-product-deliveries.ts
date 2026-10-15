import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { ProductNotFoundError, ValidationError } from './errors';

import type { DeliveredTotal, FinishedDeliveryDirectory, FinishedProductDeliveriesPage } from './finished-product-detail';
import type { OrderNumberDirectory } from './reservation';
import type { FinishedProductDetailRepository } from '../ports/finished-product-detail-repository';

import type { CustomerCatalog, CustomerRef } from '@/lib/modules/clientes';

export type ListFinishedProductDeliveriesDeps = {
  readonly products: FinishedProductDetailRepository;
  readonly orders: OrderNumberDirectory;
  readonly deliveries: FinishedDeliveryDirectory;
  readonly customers: Pick<CustomerCatalog, 'findRefsIncludingDeleted'>;
};

const NOTHING_DELIVERED: DeliveredTotal = { quantity: '0.0000', packages: 0 };

const productIdSchema = z.string().uuid();

// El defecto y el tope del tamano los aplica el adaptador.
const pageSchema = z.strictObject({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).optional(),
});

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

// El directorio solo devuelve lineas de los lotes que se le pasan, que salen de este mapa.
function lotOf(lotsById: ReadonlyMap<string, string>, batchId: string): string {
  const lot = lotsById.get(batchId);
  if (lot === undefined) throw new Error(`listFinishedProductDeliveries: el lote ${batchId} no es del producto`);
  return lot;
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

    const batchIds = record.batches.map((batch) => batch.id);
    const page = await deps.deliveries.listDeliveryLines(actor.companyId, batchIds, parsed.data);
    if (page.total === 0) return { ...page, items: [], delivered: NOTHING_DELIVERED };

    const orderIds = unique(page.items.map((item) => item.orderId));
    const customerIds = unique(page.items.map((item) => item.customerId));

    // El total cubre todos los lotes del producto, no solo los de la pagina.
    const [delivered, numbers, customers] = await Promise.all([
      deps.deliveries.summarizeDelivered(actor.companyId, batchIds),
      orderIds.length === 0
        ? Promise.resolve(new Map<string, string>())
        : deps.orders.findNumberTexts(actor.companyId, orderIds),
      customerIds.length === 0
        ? Promise.resolve<readonly CustomerRef[]>([])
        : deps.customers.findRefsIncludingDeleted(customerIds, actor.companyId),
    ]);
    const customersById = new Map<string, CustomerRef>(customers.map((customer) => [customer.id, customer]));
    const lotsById = new Map(record.batches.map((batch) => [batch.id, batch.lot]));
    // Todos los lotes de un producto terminado son de su presentacion.
    const presentationName = record.presentation?.name ?? null;

    // Lo que no vuelve de un directorio sale como ausente y la fila se queda en su sitio.
    return {
      ...page,
      items: page.items.map((line) => ({
        deliveryLineId: line.id,
        orderDeliveryId: line.orderDeliveryId,
        createdAt: line.createdAt,
        customer: customersById.get(line.customerId) ?? null,
        orderNumberText: numbers.get(line.orderId) ?? null,
        presentationName,
        batchId: line.batchId,
        lot: lotOf(lotsById, line.batchId),
        packages: line.packages,
        quantity: line.quantity,
        void: line.void,
      })),
      delivered,
    };
  };
}
