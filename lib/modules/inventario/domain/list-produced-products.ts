import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { ValidationError } from './errors';

import type { ProducedProductLink } from './finished-product-detail';
import type { FinishedProductDetailRepository } from '../ports/finished-product-detail-repository';

export type ListProducedProductsDeps = {
  readonly products: FinishedProductDetailRepository;
};

// El tope es el de una pagina de pedidos: quien llama pregunta por la pagina que esta pintando.
const orderIdsSchema = z.array(z.string().uuid()).max(25);

/**
 * El producto terminado que produjo cada pedido en cada presentacion. No mira el estado del
 * pedido: ese filtro lo hace quien llama, que es quien lo conoce.
 */
export function createListProducedProducts(
  deps: ListProducedProductsDeps,
): (orderIds: unknown, actor: Actor | null | undefined) => Promise<readonly ProducedProductLink[]> {
  return async function listProducedProducts(
    orderIds: unknown,
    actor: Actor | null | undefined,
  ): Promise<readonly ProducedProductLink[]> {
    requirePermission(actor, 'inventario.consultar');

    const parsed = orderIdsSchema.safeParse(orderIds);
    if (!parsed.success) throw new ValidationError();
    if (parsed.data.length === 0) return [];

    const links = await deps.products.findProducedProducts([...new Set(parsed.data)], {
      companyId: actor.companyId,
    });

    // Un par con mas de un producto no tiene un destino unico: se omite en vez de adivinar.
    const productsByPair = new Map<string, Set<string>>();
    for (const link of links) {
      const key = `${link.orderId}:${link.presentationId}`;
      const products = productsByPair.get(key) ?? new Set<string>();
      products.add(link.productId);
      productsByPair.set(key, products);
    }

    const seen = new Set<string>();
    return links.filter((link) => {
      const key = `${link.orderId}:${link.presentationId}`;
      if (productsByPair.get(key)?.size !== 1 || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
}
