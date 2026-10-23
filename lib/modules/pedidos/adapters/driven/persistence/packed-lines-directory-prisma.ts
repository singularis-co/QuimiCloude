import type { FinishedDistributionLine, Page } from '@/lib/modules/inventario';
import { prisma } from '@/lib/shared/db/prisma';
import { buildPage, toOffsetLimit } from '@/lib/shared/pagination';

import { formatOrderNumber } from '../../../domain/order-number';
import { PACKING_DIFFERENCE_REASONS, type PackingDifferenceReason } from '../../../domain/packing-count';

import { companyScopeColumns, orderCompanyScope } from './company-scope';

const PACKED_STATUSES = ['POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO', 'ENTREGADO'] as const;

const REASONS: readonly string[] = PACKING_DIFFERENCE_REASONS;

function toReason(value: string | null): PackingDifferenceReason | null {
  if (value === null) return null;
  if (!REASONS.includes(value)) throw new Error(`Motivo de empaque fuera del catalogo: ${value}`);
  return value as PackingDifferenceReason;
}

/**
 * Implementa `FinishedDistributionDirectory` de `inventario`, que no puede importar `pedidos` sin
 * cerrar un ciclo. La linea y su pedido se filtran los dos por empresa.
 */
export async function listPackedLinesByCombination(
  companyId: string,
  combination: { readonly recipeId: string; readonly presentationId: string },
  paging: { readonly page: number; readonly pageSize?: number },
): Promise<Page<FinishedDistributionLine>> {
  const { offset, limit } = toOffsetLimit(paging.page, paging.pageSize);
  const where = {
    AND: [
      companyScopeColumns({ companyId }),
      { presentationId: combination.presentationId },
      {
        order: {
          AND: [
            orderCompanyScope({ companyId }),
            { deletedAt: null, recipeId: combination.recipeId, status: { in: [...PACKED_STATUSES] } },
          ],
        },
      },
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.orderPresentationLine.findMany({
      where,
      orderBy: [
        { order: { orderYear: 'desc' } },
        { order: { orderSequence: 'desc' } },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
      skip: offset,
      take: limit,
      select: {
        id: true,
        packages: true,
        packedPackages: true,
        packedReason: true,
        packedReasonOther: true,
        order: { select: { orderYear: true, orderSequence: true } },
      },
    }),
    prisma.orderPresentationLine.count({ where }),
  ]);

  const items = rows.map((row) => ({
    lineId: row.id,
    orderNumberText: formatOrderNumber({ year: row.order.orderYear, sequence: row.order.orderSequence }),
    plan: row.packages,
    packedPackages: row.packedPackages,
    reason: toReason(row.packedReason),
    reasonOther: row.packedReasonOther,
  }));
  return buildPage(items, total, paging.page, limit);
}
