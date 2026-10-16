import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { DIRECT_DELIVERY_SURPLUS_MAX_PRODUCTS, surplusPackages, waitingOrders } from './direct-delivery';
import { ValidationError } from './errors';
import type { OrderScope } from './order-scope';

import type { WaitingOrderPair, WaitingOrdersReader } from '../ports/direct-delivery-repository';

import type { FinishedProductDeliveryCatalog } from '@/lib/modules/inventario';

export type ListDirectDeliverySurplusDeps = {
  readonly catalog: Pick<FinishedProductDeliveryCatalog, 'findSurplusBases'>;
  readonly waiting: WaitingOrdersReader;
};

const productIdsSchema = z.array(z.string().uuid()).max(DIRECT_DELIVERY_SURPLUS_MAX_PRODUCTS);

function pairKey(pair: WaitingOrderPair): string {
  return `${pair.recipeId}:${pair.presentationId}`;
}

/** El excedente de cada producto terminado de una pagina del listado, con dos lecturas en total. */
export function createListDirectDeliverySurplus(
  deps: ListDirectDeliverySurplusDeps,
): (productIds: unknown, actor: Actor | null | undefined) => Promise<ReadonlyMap<string, number>> {
  return async function listDirectDeliverySurplus(productIds, actor) {
    requirePermission(actor, 'entregas.modificar');
    const parsed = productIdsSchema.safeParse(productIds);
    if (!parsed.success) throw new ValidationError();
    const ids = [...new Set(parsed.data)];
    if (ids.length === 0) return new Map();
    const scope: OrderScope = { companyId: actor.companyId };

    const bases = await deps.catalog.findSurplusBases(ids, scope.companyId);

    const pairs = new Map<string, WaitingOrderPair>();
    for (const { recipeId, presentationId } of bases) {
      if (recipeId !== null && presentationId !== null) {
        pairs.set(pairKey({ recipeId, presentationId }), { recipeId, presentationId });
      }
    }
    const lines = pairs.size === 0 ? [] : await deps.waiting.listWaitingLines([...pairs.values()], scope);

    const linesByPair = new Map<string, (typeof lines)[number][]>();
    for (const line of lines) {
      const key = pairKey(line);
      const group = linesByPair.get(key) ?? [];
      group.push(line);
      linesByPair.set(key, group);
    }

    const surplus = new Map<string, number>();
    for (const base of bases) {
      const group =
        base.recipeId !== null && base.presentationId !== null
          ? (linesByPair.get(pairKey({ recipeId: base.recipeId, presentationId: base.presentationId })) ?? [])
          : [];
      surplus.set(base.productId, surplusPackages(base.stockPackages, waitingOrders(group)));
    }
    return surplus;
  };
}
