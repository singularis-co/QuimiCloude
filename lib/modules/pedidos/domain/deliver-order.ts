import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { ActionNotAllowedError, ValidationError } from './errors';
import { checkDeliveryBlocks, DELIVERY_MAX_ALLOCATIONS } from './order-delivery';

import type { OrderDeliveryRepository } from '../ports/order-delivery-repository';
import type { OrderDeliveryUnitOfWork } from '../ports/order-delivery-unit-of-work';
import type { OrderRepository } from '../ports/order-repository';

import type { CustomerCatalog } from '@/lib/modules/clientes';

export type DeliverOrderResult = {
  readonly status: 'delivered' | 'already_registered';
  readonly orderStatus: 'TERMINADO' | 'ENTREGADO';
};

export type DeliverOrderDeps = {
  readonly customerCatalog: Pick<CustomerCatalog, 'findAliveRefById'>;
  readonly unitOfWork: OrderDeliveryUnitOfWork;
  /** Sobre el cliente global: la clave se mira antes de abrir la transaccion. */
  readonly deliveries: Pick<OrderDeliveryRepository, 'findByKey'>;
  /** Solo para responder a un reintento con el estado del pedido de la entrega ya registrada. */
  readonly orders: OrderRepository;
  readonly now?: () => Date;
};

const allocationSchema = z.strictObject({
  presentationLineId: z.string().uuid(),
  batchId: z.string().uuid(),
  packages: z.number().int().min(1),
});

const deliverOrderSchema = z
  .strictObject({
    orderId: z.string().uuid(),
    deliveryKey: z.string().uuid(),
    customers: z
      .array(
        z.strictObject({
          // Su forma la decide `requireAliveCustomer`: un id que no es uuid responde que no existe.
          customerId: z.string(),
          allocations: z.array(allocationSchema).min(1),
        }),
      )
      .min(1),
  })
  .refine(({ customers }) => customers.reduce((sum, c) => sum + c.allocations.length, 0) <= DELIVERY_MAX_ALLOCATIONS)
  .refine(({ customers }) => new Set(customers.map((c) => c.customerId)).size === customers.length)
  .refine(({ customers }) =>
    customers.every(
      ({ allocations }) =>
        new Set(allocations.map((a) => `${a.presentationLineId}:${a.batchId}`)).size === allocations.length,
    ),
  );

/** Registra una entrega de producto terminado de un pedido `TERMINADO`. */
export function createDeliverOrder(
  deps: DeliverOrderDeps,
): (input: unknown, actor: Actor | null | undefined) => Promise<DeliverOrderResult> {
  return async function deliverOrder(input, actor) {
    requirePermission(actor, 'entregas.modificar');

    const parsed = deliverOrderSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    if (checkDeliveryBlocks(parsed.data.customers).size > 0) throw new ValidationError();

    void deps;
    throw new ActionNotAllowedError();
  };
}
