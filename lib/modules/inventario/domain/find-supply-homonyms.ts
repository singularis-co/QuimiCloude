import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { ValidationError } from './errors';
import { PRODUCT_NAME_MAX_LENGTH } from './product-input';

import type { SupplyHomonym } from './supply-family';
import type { ProductRepository } from '../ports/product-repository';

export type FindSupplyHomonymsDeps = {
  readonly products: Pick<ProductRepository, 'findAliveSupplyHomonyms'>;
};

export type FindSupplyHomonyms = (
  name: unknown,
  actor: Actor | null | undefined,
) => Promise<readonly SupplyHomonym[]>;

const nameSchema = z.string().trim().max(PRODUCT_NAME_MAX_LENGTH);

/**
 * Alimenta el aviso del alta, asi que pide el permiso del alta. Un nombre vacio aun no tiene
 * homonimos: se responde sin consultar.
 */
export function createFindSupplyHomonyms(deps: FindSupplyHomonymsDeps): FindSupplyHomonyms {
  return async function findSupplyHomonyms(name, actor) {
    requirePermission(actor, 'inventario.modificar');

    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) throw new ValidationError();
    if (parsed.data === '') return [];

    return deps.products.findAliveSupplyHomonyms(parsed.data, { companyId: actor.companyId });
  };
}
