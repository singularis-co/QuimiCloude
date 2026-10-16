import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { DeliveryAlreadyVoidedError, DeliveryNotFoundError, ValidationError } from './errors';
import { DELIVERY_MAX_ALLOCATIONS } from './order-delivery';
import type { OrderScope } from './order-scope';

import type { DirectDeliveryVoidTransactionScope, DirectDeliveryVoidUnitOfWork } from '../ports/direct-delivery-unit-of-work';
import type {
  DeliveryLineForVoid,
  OrderDeliveryVoidRepository,
  RegisteredDeliveryVoid,
} from '../ports/order-delivery-void-repository';

export type VoidDirectDeliveryResult = { readonly status: 'voided' | 'already_registered' };

export type VoidDirectDeliveryDeps = {
  readonly unitOfWork: DirectDeliveryVoidUnitOfWork;
  /** Sobre el cliente global, fuera de la transaccion. */
  readonly voids: Pick<OrderDeliveryVoidRepository, 'findByKey' | 'findDelivery'>;
  readonly now?: () => Date;
};

const voidDirectDeliverySchema = z
  .strictObject({
    deliveryId: z.string().uuid(),
    voidKey: z.string().uuid(),
    customerIds: z.array(z.string().uuid()).min(1).max(DELIVERY_MAX_ALLOCATIONS),
    reason: z.string().trim().min(1).max(500),
  })
  .refine(({ customerIds }) => new Set(customerIds.map((id) => id.toLowerCase())).size === customerIds.length);

type VoidDirectDeliveryInput = z.infer<typeof voidDirectDeliverySchema>;

/** Deshace la transaccion cuando otra peticion registro la misma clave despues de la lectura previa;
 *  fuera se vuelve a leer la anulacion ya confirmada. */
class DirectVoidAlreadyRegisteredSignal extends Error {
  constructor() {
    super('la clave de anulacion ya estaba registrada');
  }
}

/** Todas las lineas de los clientes pedidos. La parte de un cliente se anula entera o no se anula:
 *  basta una linea ya anulada para rechazar la peticion completa. */
function linesToVoid(
  deliveryLines: readonly DeliveryLineForVoid[],
  customerIds: readonly string[],
): readonly DeliveryLineForVoid[] {
  // Postgres iguala un uuid en mayusculas y en minusculas: son el mismo cliente.
  const requested = new Set(customerIds.map((id) => id.toLowerCase()));
  const selected = deliveryLines.filter((line) => requested.has(line.customerId.toLowerCase()));
  const present = new Set(selected.map((line) => line.customerId.toLowerCase()));
  if ([...requested].some((id) => !present.has(id))) throw new ValidationError();
  if (selected.some((line) => line.voided)) throw new DeliveryAlreadyVoidedError();
  return selected;
}

async function voidInTransaction(
  tx: DirectDeliveryVoidTransactionScope,
  input: VoidDirectDeliveryInput,
  deliveryId: string,
  actorId: string,
  now: Date,
  scope: OrderScope,
): Promise<VoidDirectDeliveryResult> {
  if ((await tx.voids.findByKey(input.voidKey, scope)) !== null) throw new DirectVoidAlreadyRegisteredSignal();

  const lines = linesToVoid(await tx.voids.findDeliveryLines(deliveryId, scope), input.customerIds);

  const created = await tx.voids.create(
    { voidKey: input.voidKey, deliveryId, reason: input.reason, actorId, now },
    scope,
  );
  if (created.kind === 'duplicate_key') throw new DirectVoidAlreadyRegisteredSignal();

  // El unico de la base decide entre dos anulaciones a la vez del mismo cliente.
  const added = await tx.voids.addLines(
    created.id,
    deliveryId,
    lines.map((line) => line.id),
    scope,
  );
  if (added === 'already_voided') throw new DeliveryAlreadyVoidedError();

  const returned = await tx.finishedGoods.returnForDeliveryVoid({
    companyId: scope.companyId,
    orderId: null,
    orderDeliveryVoidId: created.id,
    lines: lines.map((line) => ({ batchId: line.batchId, quantity: line.quantity })),
    actorId,
    now,
  });
  if (returned.kind === 'batch_not_found') {
    throw new Error(`voidDirectDelivery: el lote ${returned.batchId} de una linea de entrega no aparece`);
  }
  return { status: 'voided' };
}

/** Una clave de la anulacion de una entrega de pedido no es un reintento de esta. */
function alreadyRegistered(registered: RegisteredDeliveryVoid): VoidDirectDeliveryResult {
  if (registered.orderId !== null) throw new ValidationError();
  return { status: 'already_registered' };
}

/** Anula la parte de uno o varios clientes de una entrega sin pedido y devuelve sus envases. */
export function createVoidDirectDelivery(
  deps: VoidDirectDeliveryDeps,
): (input: unknown, actor: Actor | null | undefined) => Promise<VoidDirectDeliveryResult> {
  const now = deps.now ?? (() => new Date());

  return async function voidDirectDelivery(input, actor) {
    requirePermission(actor, 'entregas.anular');

    const parsed = voidDirectDeliverySchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const data = parsed.data;
    const scope: OrderScope = { companyId: actor.companyId };

    const registered = await deps.voids.findByKey(data.voidKey, scope);
    if (registered !== null) return alreadyRegistered(registered);

    const delivery = await deps.voids.findDelivery(data.deliveryId, scope);
    if (delivery === null || delivery.orderId !== null) throw new DeliveryNotFoundError();

    try {
      return await deps.unitOfWork.run((tx) => voidInTransaction(tx, data, delivery.id, actor.id, now(), scope));
    } catch (error) {
      if (!(error instanceof DirectVoidAlreadyRegisteredSignal)) throw error;
      const raced = await deps.voids.findByKey(data.voidKey, scope);
      if (raced === null) throw new Error('voidDirectDelivery: duplicate_key sin anulacion con esa clave');
      return alreadyRegistered(raced);
    }
  };
}
