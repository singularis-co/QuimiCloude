import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { ProductNotFoundError } from './errors';
import { summarizeFinishedStock, type FinishedProductDetail } from './finished-product-detail';

import type { FinishedProductDetailRepository } from '../ports/finished-product-detail-repository';

import type { UnitCatalog, UnitRef } from '@/lib/modules/unidades';

export type GetFinishedProductDeps = {
  readonly products: FinishedProductDetailRepository;
  readonly units: Pick<UnitCatalog, 'findRefs'>;
};

const productIdSchema = z.string().uuid();

type UnitSummary = { readonly id: string; readonly name: string; readonly symbol: string | null };

function unitOf(unitId: string | null, refs: ReadonlyMap<string, UnitRef>): UnitSummary | null {
  if (unitId === null) return null;
  const ref = refs.get(unitId);
  return ref === undefined ? null : { id: ref.id, name: ref.name, symbol: ref.symbol };
}

export function createGetFinishedProduct(
  deps: GetFinishedProductDeps,
): (id: string, actor: Actor | null | undefined) => Promise<FinishedProductDetail> {
  return async function getFinishedProduct(
    id: string,
    actor: Actor | null | undefined,
  ): Promise<FinishedProductDetail> {
    requirePermission(actor, 'inventario.consultar');

    // Un id malformado responde igual que uno inexistente: no se distingue por que no se encontro.
    if (!productIdSchema.safeParse(id).success) throw new ProductNotFoundError();
    const record = await deps.products.findAliveFinished(id, { companyId: actor.companyId });
    if (record === null) throw new ProductNotFoundError();

    const unitIds = [
      ...new Set(
        [record.unitId, record.presentation?.unitId ?? null].filter((unitId): unitId is string => unitId !== null),
      ),
    ];
    const refs =
      unitIds.length === 0 ? [] : await deps.units.findRefs(unitIds, actor.companyId);
    const refsById = new Map(refs.map((ref) => [ref.id, ref] as const));

    return {
      id: record.id,
      name: record.name,
      imagePath: record.imagePath,
      qtyAlert: record.qtyAlert,
      unit: unitOf(record.unitId, refsById),
      presentation:
        record.presentation === null
          ? null
          : {
              id: record.presentation.id,
              name: record.presentation.name,
              content: record.presentation.content,
              unit: unitOf(record.presentation.unitId, refsById),
            },
      stock: summarizeFinishedStock(record.batches),
    };
  };
}
