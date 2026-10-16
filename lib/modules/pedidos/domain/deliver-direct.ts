import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import {
  DIRECT_DELIVERY_NOTE_MAX_LENGTH,
  checkDirectDelivery,
  directAllocations,
  normalizeDeliveryNote,
  surplusPackages,
  waitingOrders,
} from './direct-delivery';
import {
  DeliveryBatchInsufficientError,
  DeliveryBatchNotFoundError,
  DeliveryExceedsSurplusError,
  ProductNotFoundError,
  ValidationError,
} from './errors';
import { requireAliveCustomer } from './order-customer';
import { checkDeliveryBlocks, DELIVERY_MAX_ALLOCATIONS } from './order-delivery';
import type { OrderScope } from './order-scope';

import type {
  DirectDeliveryRepository,
  NewDirectDeliveryLine,
  RegisteredDelivery,
  WaitingOrderPair,
} from '../ports/direct-delivery-repository';
import type { DirectDeliveryTransactionScope, DirectDeliveryUnitOfWork } from '../ports/direct-delivery-unit-of-work';

import type { CustomerCatalog } from '@/lib/modules/clientes';
import type { FinishedProductDeliveryCatalog } from '@/lib/modules/inventario';

export type DeliverDirectResult = { readonly status: 'delivered' | 'already_registered' };

export type DeliverDirectDeps = {
  readonly customerCatalog: Pick<CustomerCatalog, 'findAliveRefById'>;
  /** Sobre el cliente global: la receta y la presentacion del producto, para bloquear antes sus pedidos. */
  readonly catalog: Pick<FinishedProductDeliveryCatalog, 'findSurplusBases'>;
  readonly unitOfWork: DirectDeliveryUnitOfWork;
  /** Sobre el cliente global: la clave se mira antes de abrir la transaccion. */
  readonly deliveries: Pick<DirectDeliveryRepository, 'findByKey'>;
  readonly now?: () => Date;
};

const deliverDirectSchema = z
  .strictObject({
    // Su forma la decide la busqueda del producto: un id que no es uuid responde que no existe.
    productId: z.string(),
    deliveryKey: z.string().uuid(),
    note: z.string().nullable(),
    customers: z
      .array(
        z.strictObject({
          // Su forma la decide `requireAliveCustomer`.
          customerId: z.string(),
          allocations: z
            .array(
              z.strictObject({
                batchId: z.string().uuid(),
                packages: z.number().int().min(1),
              }),
            )
            .min(1),
        }),
      )
      .min(1),
  })
  .refine(({ customers }) => customers.reduce((sum, c) => sum + c.allocations.length, 0) <= DELIVERY_MAX_ALLOCATIONS)
  .refine(({ customers }) => new Set(customers.map((c) => c.customerId.toLowerCase())).size === customers.length)
  .refine(({ customers }) =>
    customers.every(({ allocations }) => new Set(allocations.map((a) => a.batchId)).size === allocations.length),
  )
  .refine(({ note }) => note === null || note.trim().length <= DIRECT_DELIVERY_NOTE_MAX_LENGTH);

type DeliverDirectInput = z.infer<typeof deliverDirectSchema>;

const productIdSchema = z.string().uuid();

/** Deshace la transaccion cuando otra peticion registro la misma clave despues de la lectura previa;
 *  fuera se vuelve a leer la entrega ya confirmada. */
class DirectDeliveryAlreadyRegisteredSignal extends Error {
  constructor() {
    super('la clave de entrega ya estaba registrada');
  }
}

function samePair(a: WaitingOrderPair | null, b: { recipeId: string | null; presentationId: string | null }): boolean {
  if (a === null) return b.recipeId === null || b.presentationId === null;
  return a.recipeId === b.recipeId && a.presentationId === b.presentationId;
}

async function deliverInTransaction(
  tx: DirectDeliveryTransactionScope,
  input: DeliverDirectInput,
  pair: WaitingOrderPair | null,
  actorId: string,
  now: Date,
  scope: OrderScope,
): Promise<DeliverDirectResult> {
  // Antes que el producto, como la entrega de pedido (pedido -> producto -> lote).
  if (pair !== null) await tx.waitingLock.lockWaitingCandidates(pair, scope);

  const product = await tx.finishedGoods.lockForDirectDelivery(input.productId, scope.companyId);
  if (product === null) throw new ProductNotFoundError();
  // Los pedidos bloqueados son los de la receta y la presentacion leidas antes: si no coinciden,
  // no protegen el calculo de lo que esperan.
  if (!samePair(pair, product)) {
    throw new Error(`deliverDirect: la receta o la presentacion de ${input.productId} cambio durante la entrega`);
  }

  if ((await tx.deliveries.findByKey(input.deliveryKey, scope)) !== null) {
    throw new DirectDeliveryAlreadyRegisteredSignal();
  }

  const lines = pair === null ? [] : await tx.waiting.listWaitingLines([pair], scope);
  const surplus = surplusPackages(product.stockPackages, waitingOrders(lines));
  const allocations = input.customers.flatMap(({ customerId, allocations: own }) =>
    own.map((allocation) => ({ ...allocation, customerId })),
  );
  const check = checkDirectDelivery(surplus, null, directAllocations(input.productId, allocations));
  if (check.kind === 'exceeds_surplus') {
    throw new DeliveryExceedsSurplusError(`entrega sin pedido de ${input.productId}: excedente ${String(surplus)}`);
  }
  if (check.kind !== 'ok') throw new ValidationError();

  const created = await tx.deliveries.create(
    {
      deliveryKey: input.deliveryKey,
      productId: input.productId,
      note: normalizeDeliveryNote(input.note),
      actorId,
      now,
    },
    scope,
  );
  if (created.kind === 'duplicate_key') throw new DirectDeliveryAlreadyRegisteredSignal();

  const outcome = await tx.finishedGoods.dispatchDirect({
    companyId: scope.companyId,
    productId: input.productId,
    orderDeliveryId: created.id,
    allocations: allocations.map((a) => ({ batchId: a.batchId, packages: a.packages })),
    actorId,
    now,
  });
  if (outcome.kind === 'batch_not_found') throw new DeliveryBatchNotFoundError(outcome.batchId);
  if (outcome.kind === 'insufficient') throw new DeliveryBatchInsufficientError(outcome.batchId);
  if (outcome.lines.length !== allocations.length) {
    throw new Error('deliverDirect: la salida no devolvio una linea por asignacion');
  }

  const deliveryLines: NewDirectDeliveryLine[] = outcome.lines.map((dispatched, index) => ({
    customerId: allocations[index].customerId,
    batchId: dispatched.batchId,
    packages: dispatched.packages,
    quantity: dispatched.quantity,
  }));
  await tx.deliveries.addLines(created.id, deliveryLines, scope);
  return { status: 'delivered' };
}

/** Una clave de una entrega de pedido no es un reintento de esta. */
function alreadyRegistered(registered: RegisteredDelivery): DeliverDirectResult {
  if (registered.orderId !== null) throw new ValidationError();
  return { status: 'already_registered' };
}

/** Registra una entrega sin pedido de los lotes de un producto terminado a uno o varios clientes. */
export function createDeliverDirect(
  deps: DeliverDirectDeps,
): (input: unknown, actor: Actor | null | undefined) => Promise<DeliverDirectResult> {
  const now = deps.now ?? (() => new Date());

  return async function deliverDirect(input, actor) {
    requirePermission(actor, 'entregas.modificar');

    const parsed = deliverDirectSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const data = parsed.data;
    const blocks = data.customers.map(({ customerId, allocations }) => ({
      customerId,
      allocations: directAllocations(data.productId, allocations),
    }));
    if (checkDeliveryBlocks(blocks).size > 0) throw new ValidationError();
    if (!productIdSchema.safeParse(data.productId).success) throw new ProductNotFoundError();
    const scope: OrderScope = { companyId: actor.companyId };

    const registered = await deps.deliveries.findByKey(data.deliveryKey, scope);
    if (registered !== null) return alreadyRegistered(registered);

    for (const { customerId } of data.customers) {
      await requireAliveCustomer(deps.customerCatalog, customerId, actor.companyId);
    }

    const [base] = await deps.catalog.findSurplusBases([data.productId], scope.companyId);
    if (base === undefined) throw new ProductNotFoundError();
    const pair =
      base.recipeId !== null && base.presentationId !== null
        ? { recipeId: base.recipeId, presentationId: base.presentationId }
        : null;

    try {
      return await deps.unitOfWork.run((tx) => deliverInTransaction(tx, data, pair, actor.id, now(), scope));
    } catch (error) {
      if (!(error instanceof DirectDeliveryAlreadyRegisteredSignal)) throw error;
      const raced = await deps.deliveries.findByKey(data.deliveryKey, scope);
      if (raced === null) throw new Error('deliverDirect: duplicate_key sin entrega con esa clave');
      return alreadyRegistered(raced);
    }
  };
}
