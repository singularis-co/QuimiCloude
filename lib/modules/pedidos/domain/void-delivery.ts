import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { ActionNotAllowedError, ValidationError } from './errors';
import { DELIVERY_MAX_ALLOCATIONS } from './order-delivery';

import type { OrderDeliveryVoidRepository } from '../ports/order-delivery-void-repository';
import type { OrderDeliveryVoidUnitOfWork } from '../ports/order-delivery-void-unit-of-work';
import type { OrderRepository } from '../ports/order-repository';

export type VoidDeliveryResult = {
  readonly status: 'voided' | 'already_registered';
  readonly orderStatus: 'TERMINADO' | 'ENTREGADO';
};

export type VoidDeliveryDeps = {
  readonly unitOfWork: OrderDeliveryVoidUnitOfWork;
  /** Sobre el cliente global, fuera de la transaccion. */
  readonly voids: Pick<OrderDeliveryVoidRepository, 'findByKey' | 'findDelivery'>;
  /** Solo para responder con el estado actual cuando la clave de anulacion ya estaba registrada. */
  readonly orders: OrderRepository;
  readonly now?: () => Date;
};

const voidDeliverySchema = z
  .strictObject({
    deliveryId: z.string().uuid(),
    voidKey: z.string().uuid(),
    items: z
      .array(
        z.strictObject({
          customerId: z.string().uuid(),
          presentationLineId: z.string().uuid(),
        }),
      )
      .min(1)
      .max(DELIVERY_MAX_ALLOCATIONS),
    reason: z.string().trim().min(1).max(500),
  })
  .refine(
    ({ items }) => new Set(items.map((i) => `${i.customerId}:${i.presentationLineId}`)).size === items.length,
  );

/** Anula pares cliente-presentacion de una entrega y devuelve sus envases a los lotes de origen. */
export function createVoidDelivery(
  deps: VoidDeliveryDeps,
): (input: unknown, actor: Actor | null | undefined) => Promise<VoidDeliveryResult> {
  return async function voidDelivery(input, actor) {
    requirePermission(actor, 'entregas.anular');

    const parsed = voidDeliverySchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    void deps;
    throw new ActionNotAllowedError();
  };
}
