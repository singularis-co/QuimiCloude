import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { ActionNotAllowedError, OrderNotFoundError } from './errors';
import { toOrderCustomer, type OrderCustomer } from './order-customer';
import { remainingPackages } from './order-delivery';
import { formatOrderNumber } from './order-number';
import type { OrderScope } from './order-scope';
import type { OrderLineRow } from './order-view';
import { orderedPackages } from './packing-count';

import type { OrderDeliveryRepository } from '../ports/order-delivery-repository';
import type { OrderRepository } from '../ports/order-repository';
import type { OrderWriteRepository } from '../ports/order-write-repository';

import type { CustomerCatalog } from '@/lib/modules/clientes';
import type { DeliverableBatch, FinishedBatchCatalog, PresentationCatalog } from '@/lib/modules/inventario';

export type OrderDeliveryLineView = {
  readonly presentationLineId: string;
  readonly presentationName: string;
  readonly orderedPackages: number;
  readonly deliveredPackages: number;
  readonly remainingPackages: number;
  /** Vacio cuando a la linea ya no le falta ningun envase. */
  readonly batches: readonly DeliverableBatch[];
};

export type OrderDeliveryView = {
  readonly orderId: string;
  readonly numberText: string;
  /** El cliente del pedido si sigue vivo; si no tiene o esta dado de baja, `null`. */
  readonly customer: OrderCustomer | null;
  readonly lines: readonly OrderDeliveryLineView[];
};

export type GetOrderDeliveryDeps = {
  readonly orders: OrderRepository;
  readonly deliveries: Pick<OrderDeliveryRepository, 'sumDeliveredPackages'>;
  readonly lines: Pick<OrderWriteRepository, 'findPresentationLinesForFinish'>;
  readonly presentations: Pick<PresentationCatalog, 'findRefs'>;
  readonly finishedBatches: FinishedBatchCatalog;
  readonly customerCatalog: Pick<CustomerCatalog, 'findAliveRefById'>;
};

const orderIdSchema = z.string().uuid();

async function aliveCustomer(
  customerCatalog: Pick<CustomerCatalog, 'findAliveRefById'>,
  customerId: string | null,
  companyId: string,
): Promise<OrderCustomer | null> {
  if (customerId === null) return null;
  const ref = await customerCatalog.findAliveRefById(customerId, companyId);
  return ref === null ? null : toOrderCustomer(ref);
}

/** Sin `lineId` lee el pedido entero, que tiene que estar `TERMINADO`; con `lineId`, solo esa receta. */
export type GetOrderDelivery = {
  (orderId: string, actor: Actor | null | undefined): Promise<OrderDeliveryView>;
  (orderId: string, lineId: string | undefined, actor: Actor | null | undefined): Promise<OrderDeliveryView>;
};

/** `findAliveLines` ya deja fuera las quitadas y las de otro pedido o empresa. */
function assertDeliverableLine(orderLines: readonly OrderLineRow[], lineId: string): void {
  const line = orderLines.find((candidate) => candidate.id === lineId);
  if (line === undefined) throw new OrderNotFoundError();
  if (line.status !== 'TERMINADO') throw new ActionNotAllowedError();
}

type ActorArgs =readonly [actor: Actor | null | undefined] | readonly [lineId: string | undefined, actor: Actor | null | undefined];

/** Lo que el sheet de entrega necesita de un pedido `TERMINADO` o de una receta `TERMINADO`. */
export function createGetOrderDelivery(deps: GetOrderDeliveryDeps): GetOrderDelivery {
  return async function getOrderDelivery(orderId: string, ...args: ActorArgs): Promise<OrderDeliveryView> {
    const [lineId, actor] = args.length === 2 ? args : [undefined, args[0]];
    requirePermission(actor, 'entregas.modificar');

    if (!orderIdSchema.safeParse(orderId).success) throw new OrderNotFoundError();
    if (lineId !== undefined && !orderIdSchema.safeParse(lineId).success) throw new OrderNotFoundError();
    const scope: OrderScope = { companyId: actor.companyId };

    const order = await deps.orders.findAliveById(orderId, scope);
    if (order === null) throw new OrderNotFoundError();

    if (lineId === undefined && order.status !== 'TERMINADO') throw new ActionNotAllowedError();
    const orderLines = await deps.orders.findAliveLines(orderId, scope);
    if (lineId !== undefined) assertDeliverableLine(orderLines, lineId);

    const [allLines, delivered] = await Promise.all([
      deps.lines.findPresentationLinesForFinish(orderId, scope),
      deps.deliveries.sumDeliveredPackages(orderId, scope),
    ]);
    const lines = lineId === undefined ? allLines : allLines.filter((line) => line.orderLineId === lineId);
    const recipeByOrderLine = new Map(orderLines.map((line) => [line.id, line.recipeId]));
    const recipeOf = (line: (typeof lines)[number]): string | undefined => recipeByOrderLine.get(line.orderLineId);
    const states = lines.map((line) => {
      const state = { presentationLineId: line.id, orderedPackages: orderedPackages(line), deliveredPackages: delivered.get(line.id) ?? 0 };
      return { line, state, remaining: remainingPackages(state) };
    });

    const presentationIds = [...new Set(lines.map((line) => line.presentationId))];
    // Una lectura de lotes por receta del pedido con algo pendiente, con sus presentaciones.
    const pendingByRecipe = new Map<string, Set<string>>();
    for (const { line, remaining } of states) {
      const recipeId = recipeOf(line);
      if (remaining === 0 || recipeId === undefined) continue;
      const pending = pendingByRecipe.get(recipeId) ?? new Set<string>();
      pending.add(line.presentationId);
      pendingByRecipe.set(recipeId, pending);
    }
    const [refs, batchesByRecipe, customer] = await Promise.all([
      deps.presentations.findRefs(presentationIds, actor.companyId),
      Promise.all(
        [...pendingByRecipe].map(async ([recipeId, pending]) => {
          const found = await deps.finishedBatches.findDeliverableBatches(recipeId, [...pending], actor.companyId);
          return [recipeId, found] as const;
        }),
      ).then((entries) => new Map<string, readonly DeliverableBatch[]>(entries)),
      aliveCustomer(deps.customerCatalog, order.customerId, actor.companyId),
    ]);
    const nameById = new Map(refs.map((ref) => [ref.id, ref.name]));

    return {
      orderId: order.id,
      numberText: formatOrderNumber(order.number),
      customer,
      lines: states.map(({ line, state, remaining }) => {
        const presentationName = nameById.get(line.presentationId);
        // La clave foranea de la linea garantiza la presentacion: si falta, la base esta rota.
        if (presentationName === undefined) {
          throw new Error(`getOrderDelivery: la presentacion ${line.presentationId} no aparece`);
        }
        return {
          presentationLineId: line.id,
          presentationName,
          orderedPackages: state.orderedPackages,
          deliveredPackages: state.deliveredPackages,
          remainingPackages: remaining,
          batches:
            remaining === 0
              ? []
              : (batchesByRecipe.get(recipeOf(line) ?? '') ?? []).filter(
                  (batch) => batch.presentationId === line.presentationId,
                ),
        };
      }),
    };
  };
}
