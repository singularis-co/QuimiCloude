import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import {
  ActionNotAllowedError,
  DeliveryBatchInsufficientError,
  DeliveryBatchNotFoundError,
  DeliveryExceedsRemainingError,
  OrderNotFoundError,
  ValidationError,
} from './errors';
import { requireAliveCustomer } from './order-customer';
import {
  checkDelivery,
  checkDeliveryBlocks,
  DELIVERY_MAX_ALLOCATIONS,
  flattenBlocks,
  type DeliveryAllocation,
} from './order-delivery';
import type { OrderStatus } from './order-classification';
import {
  deliveryTargetsOf,
  isDeliveryOrderStatus,
  statusAfterDelivery,
  type DeliveryOrderStatus,
  type DeliveryTarget,
} from './order-delivery-target';
import type { OrderScope } from './order-scope';
import { orderedPackages } from './packing-count';
import { assertTransition } from './order-transitions';

import type { NewOrderDeliveryLine, OrderDeliveryRepository } from '../ports/order-delivery-repository';
import type { OrderDeliveryTransactionScope, OrderDeliveryUnitOfWork } from '../ports/order-delivery-unit-of-work';
import type { OrderRepository } from '../ports/order-repository';
import type { FinishPackingLine } from '../ports/order-write-repository';

import type { CustomerCatalog } from '@/lib/modules/clientes';

export type DeliverOrderResult = {
  readonly status: 'delivered' | 'already_registered';
  readonly orderStatus: DeliveryOrderStatus;
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
  .refine(({ customers }) => new Set(customers.map((c) => c.customerId.toLowerCase())).size === customers.length)
  .refine(({ customers }) =>
    customers.every(
      ({ allocations }) =>
        new Set(allocations.map((a) => `${a.presentationLineId}:${a.batchId}`)).size === allocations.length,
    ),
  );

type DeliverOrderInput = z.infer<typeof deliverOrderSchema>;

/** Deshace la transaccion cuando otra peticion registro la misma clave despues de la lectura previa
 *  (se ve ya con el pedido bloqueado o choca en el `INSERT`); fuera se vuelve a leer la entrega ya
 *  confirmada. */
class DeliveryAlreadyRegisteredSignal extends Error {
  constructor() {
    super('la clave de entrega ya estaba registrada');
  }
}

type CustomerAllocation = DeliveryAllocation & { readonly customerId: string };

/** Por linea del reparto, las asignaciones de todos los clientes en el orden cliente -> asignacion. */
function groupByLine(input: DeliverOrderInput): ReadonlyMap<string, CustomerAllocation[]> {
  const byLine = new Map<string, CustomerAllocation[]>();
  for (const { customerId, allocations } of input.customers) {
    for (const allocation of allocations) {
      const group = byLine.get(allocation.presentationLineId) ?? [];
      group.push({ ...allocation, customerId });
      byLine.set(allocation.presentationLineId, group);
    }
  }
  return byLine;
}

async function deliverInTransaction(
  tx: OrderDeliveryTransactionScope,
  input: DeliverOrderInput,
  actorId: string,
  now: Date,
  scope: OrderScope,
): Promise<DeliverOrderResult> {
  const locked = await tx.orders.lockAliveLines(input.orderId, scope);
  if (locked === null) throw new OrderNotFoundError();
  // La clave antes que el estado, ya con el pedido bloqueado: si otra peticion con la misma clave
  // confirmo mientras esta esperaba el bloqueo y dejo el pedido ENTREGADO, esta tiene que responder
  // que ya estaba registrada, no que el pedido ya no admite entregas.
  if ((await tx.deliveries.findByKey(input.deliveryKey, scope)) !== null) throw new DeliveryAlreadyRegisteredSignal();
  const targets = deliveryTargetsOf(locked);
  if (![...targets.values()].some((target) => target.status === 'TERMINADO')) throw new ActionNotAllowedError();

  const lines = await tx.orders.findPresentationLinesForFinish(input.orderId, scope);
  const lineById = new Map<string, FinishPackingLine>(lines.map((line) => [line.id, line]));
  const allocations = flattenBlocks(input.customers);
  if (allocations.some((a) => !lineById.has(a.presentationLineId))) throw new ValidationError();
  // Solo se entrega el reparto de una receta TERMINADO.
  const targetOf = (presentationLineId: string): DeliveryTarget => {
    const target = targets.get(lineById.get(presentationLineId)?.orderLineId ?? null);
    if (target === undefined || target.status !== 'TERMINADO') throw new ActionNotAllowedError();
    return target;
  };
  for (const allocation of allocations) targetOf(allocation.presentationLineId);

  // Antes de comprobar el tope. La lectura de arriba no basta: la clave es unica por empresa, asi
  // que otra peticion puede estar insertandola para OTRO pedido sin pasar por este bloqueo.
  const created = await tx.deliveries.create(
    {
      deliveryKey: input.deliveryKey,
      orderId: input.orderId,
      actorId,
      now,
    },
    scope,
  );
  if (created.kind === 'duplicate_key') throw new DeliveryAlreadyRegisteredSignal();

  const delivered = await tx.deliveries.sumDeliveredPackages(input.orderId, scope);
  const stateOf = (line: FinishPackingLine) => ({
    presentationLineId: line.id,
    orderedPackages: orderedPackages(line),
    deliveredPackages: delivered.get(line.id) ?? 0,
  });
  const check = checkDelivery(lines.map(stateOf), null, allocations);
  if (check.kind !== 'ok') throw new DeliveryExceedsRemainingError(`entrega de ${input.orderId}: ${check.kind}`);

  const deliveryLines: NewOrderDeliveryLine[] = [];
  for (const [presentationLineId, lineAllocations] of groupByLine(input)) {
    const line = lineById.get(presentationLineId);
    if (line === undefined) throw new ValidationError();
    const target = targetOf(presentationLineId);
    const outcome = await tx.finishedGoods.dispatchForDelivery({
      companyId: scope.companyId,
      orderId: input.orderId,
      orderLineId: target.lineId,
      orderDeliveryId: created.id,
      recipeId: target.recipeId,
      presentationId: line.presentationId,
      allocations: lineAllocations.map((a) => ({ batchId: a.batchId, packages: a.packages })),
      actorId,
      now,
    });
    if (outcome.kind === 'batch_not_found') throw new DeliveryBatchNotFoundError(outcome.batchId);
    if (outcome.kind === 'insufficient') throw new DeliveryBatchInsufficientError(outcome.batchId);
    if (outcome.lines.length !== lineAllocations.length) {
      throw new Error('deliverOrder: la salida no devolvio una linea por asignacion');
    }
    outcome.lines.forEach((dispatched, index) => {
      deliveryLines.push({ customerId: lineAllocations[index].customerId, presentationLineId, ...dispatched });
    });
  }
  await tx.deliveries.addLines(created.id, deliveryLines, scope);

  // Pasa a ENTREGADO cada receta cuyo reparto queda completo con esta entrega; las demas no cambian.
  let withoutLines: OrderStatus = locked.order.status;
  for (const target of new Set(allocations.map((a) => targetOf(a.presentationLineId)))) {
    const own = lines.filter((line) => line.orderLineId === target.lineId);
    const ownAllocations = allocations.filter((a) => lineById.get(a.presentationLineId)?.orderLineId === target.lineId);
    const ownCheck = checkDelivery(own.map(stateOf), null, ownAllocations);
    if (ownCheck.kind !== 'ok' || !ownCheck.completesOrder) continue;

    const moved =
      target.lineId === null
        ? await tx.orders.setStatus(input.orderId, 'TERMINADO', 'ENTREGADO', actorId, now, scope)
        : await tx.orders.setLineStatus(input.orderId, target.lineId, 'TERMINADO', 'ENTREGADO', actorId, now, scope);
    if (moved !== 'ok') throw new Error(`deliverOrder: el cambio de estado devolvio '${moved}' con el pedido bloqueado`);
    withoutLines = 'ENTREGADO';
  }

  return { status: 'delivered', orderStatus: await statusAfterDelivery(tx.orders, locked, withoutLines, actorId, now, scope) };
}

/** Responde con el estado del pedido DE LA ENTREGA registrada, no del pedido pedido: la clave es
 *  unica por empresa, no por pedido. Ese pedido solo puede estar `TERMINADO`, `ENTREGADO` o
 *  `PARCIAL`, porque la entrega exige una receta `TERMINADO` y `TERMINADO` no se cancela. */
async function alreadyRegistered(
  orders: OrderRepository,
  orderId: string | null,
  scope: OrderScope,
): Promise<DeliverOrderResult> {
  // La clave es de una entrega sin pedido: no es un reintento de esta.
  if (orderId === null) throw new ValidationError();
  const order = await orders.findAliveById(orderId, scope);
  if (order === null) throw new OrderNotFoundError();
  if (!isDeliveryOrderStatus(order.status)) throw new ActionNotAllowedError();
  return { status: 'already_registered', orderStatus: order.status };
}

/** Registra una entrega de producto terminado de un pedido `TERMINADO`. */
export function createDeliverOrder(
  deps: DeliverOrderDeps,
): (input: unknown, actor: Actor | null | undefined) => Promise<DeliverOrderResult> {
  const now = deps.now ?? (() => new Date());

  return async function deliverOrder(input, actor) {
    requirePermission(actor, 'entregas.modificar');

    const parsed = deliverOrderSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const data = parsed.data;
    if (checkDeliveryBlocks(data.customers).size > 0) throw new ValidationError();
    const scope: OrderScope = { companyId: actor.companyId };

    // La clave antes que el cliente, el bloqueo y el estado: un reintento sobre un pedido que la
    // primera ya dejo ENTREGADO tiene que responder que ya estaba registrada.
    const registered = await deps.deliveries.findByKey(data.deliveryKey, scope);
    if (registered !== null) return alreadyRegistered(deps.orders, registered.orderId, scope);

    for (const { customerId } of data.customers) {
      await requireAliveCustomer(deps.customerCatalog, customerId, actor.companyId);
    }

    assertTransition('TERMINADO', 'ENTREGADO');

    try {
      return await deps.unitOfWork.run((tx) => deliverInTransaction(tx, data, actor.id, now(), scope));
    } catch (error) {
      if (!(error instanceof DeliveryAlreadyRegisteredSignal)) throw error;
      const raced = await deps.deliveries.findByKey(data.deliveryKey, scope);
      if (raced === null) throw new Error('deliverOrder: duplicate_key sin entrega con esa clave');
      return alreadyRegistered(deps.orders, raced.orderId, scope);
    }
  };
}
