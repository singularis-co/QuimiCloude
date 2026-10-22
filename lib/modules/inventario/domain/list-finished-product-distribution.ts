import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { ProductNotFoundError, ValidationError } from './errors';

import type { FinishedDistributionDirectory, FinishedDistributionLine } from './finished-product-detail';
import type { Page } from './page';
import type { FinishedProductDetailRepository } from '../ports/finished-product-detail-repository';

export type ListFinishedProductDistributionDeps = {
  readonly products: Pick<FinishedProductDetailRepository, 'findAliveFinished'>;
  readonly distribution: FinishedDistributionDirectory;
};

// Copia del defecto y el tope de `lib/shared/pagination`, que el dominio no puede importar: solo
// para la pagina vacia que se arma aqui sin llegar al adaptador.
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 25;

const productIdSchema = z.string().uuid();

const pageSchema = z.strictObject({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).optional(),
});

function emptyPage(page: number, pageSize: number | undefined): Page<FinishedDistributionLine> {
  return {
    items: [],
    total: 0,
    page,
    pageSize: Math.min(pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    totalPages: 1,
  };
}

export function createListFinishedProductDistribution(
  deps: ListFinishedProductDistributionDeps,
): (id: string, input: unknown, actor: Actor | null | undefined) => Promise<Page<FinishedDistributionLine>> {
  return async function listFinishedProductDistribution(
    id: string,
    input: unknown,
    actor: Actor | null | undefined,
  ): Promise<Page<FinishedDistributionLine>> {
    requirePermission(actor, 'inventario.consultar');

    const scope = { companyId: actor.companyId };
    if (!productIdSchema.safeParse(id).success) throw new ProductNotFoundError();
    const record = await deps.products.findAliveFinished(id, scope);
    if (record === null) throw new ProductNotFoundError();

    const parsed = pageSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    // Sin receta o sin presentacion ningun pedido puede ser de este producto.
    if (record.recipeId === null || record.presentation === null) {
      return emptyPage(parsed.data.page, parsed.data.pageSize);
    }

    return deps.distribution.listPackedLines(
      actor.companyId,
      { recipeId: record.recipeId, presentationId: record.presentation.id },
      parsed.data,
    );
  };
}
