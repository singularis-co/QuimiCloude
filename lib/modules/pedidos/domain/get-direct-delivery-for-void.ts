import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { DeliveryNotFoundError } from './errors';
import { formatOrderCustomerName } from './order-customer';
import type { OrderScope } from './order-scope';

import type { OrderDeliveryVoidRepository } from '../ports/order-delivery-void-repository';

import type { CustomerCatalog } from '@/lib/modules/clientes';
import type { FinishedProductDeliveryCatalog } from '@/lib/modules/inventario';

export type DirectDeliveryVoidCustomer = {
  readonly customerId: string;
  readonly customerName: string;
  readonly packages: number;
};

export type DirectDeliveryVoidView = {
  readonly deliveryId: string;
  /** ISO. */
  readonly createdAt: string;
  readonly presentationName: string | null;
  /** Solo los clientes con su parte sin anular, por nombre ascendente y luego id. */
  readonly customers: readonly DirectDeliveryVoidCustomer[];
};

export type GetDirectDeliveryForVoidDeps = {
  readonly voids: Pick<OrderDeliveryVoidRepository, 'findDelivery' | 'findDeliveryLines'>;
  readonly catalog: Pick<FinishedProductDeliveryCatalog, 'findForDelivery'>;
  readonly customerCatalog: Pick<CustomerCatalog, 'findRefsIncludingDeleted'>;
};

const deliveryIdSchema = z.string().uuid();

const SHORT_ID_LENGTH = 8;

function compareCustomers(a: DirectDeliveryVoidCustomer, b: DirectDeliveryVoidCustomer): number {
  const byName = a.customerName.localeCompare(b.customerName, 'es');
  if (byName !== 0) return byName;
  return a.customerId < b.customerId ? -1 : a.customerId > b.customerId ? 1 : 0;
}

/** Lo que el dialogo de anular necesita de una entrega sin pedido. */
export function createGetDirectDeliveryForVoid(
  deps: GetDirectDeliveryForVoidDeps,
): (deliveryId: string, actor: Actor | null | undefined) => Promise<DirectDeliveryVoidView> {
  return async function getDirectDeliveryForVoid(deliveryId, actor) {
    requirePermission(actor, 'entregas.anular');
    if (!deliveryIdSchema.safeParse(deliveryId).success) throw new DeliveryNotFoundError();
    const scope: OrderScope = { companyId: actor.companyId };

    const delivery = await deps.voids.findDelivery(deliveryId, scope);
    if (delivery === null || delivery.orderId !== null || delivery.productId === null) {
      throw new DeliveryNotFoundError();
    }

    const [lines, product] = await Promise.all([
      deps.voids.findDeliveryLines(delivery.id, scope),
      // Un producto dado de baja no vuelve: el dialogo sale sin presentacion.
      deps.catalog.findForDelivery(delivery.productId, scope.companyId),
    ]);

    const packagesByCustomer = new Map<string, number>();
    for (const line of lines) {
      if (!line.voided) packagesByCustomer.set(line.customerId, (packagesByCustomer.get(line.customerId) ?? 0) + line.packages);
    }
    const refs =
      packagesByCustomer.size === 0
        ? []
        : await deps.customerCatalog.findRefsIncludingDeleted([...packagesByCustomer.keys()], scope.companyId);
    const names = new Map(refs.map((ref) => [ref.id, formatOrderCustomerName(ref)]));

    return {
      deliveryId: delivery.id,
      createdAt: delivery.createdAt.toISOString(),
      presentationName: product?.presentationName ?? null,
      customers: [...packagesByCustomer]
        .map(([customerId, packages]) => ({
          customerId,
          customerName: names.get(customerId) ?? customerId.slice(0, SHORT_ID_LENGTH),
          packages,
        }))
        .sort(compareCustomers),
    };
  };
}
