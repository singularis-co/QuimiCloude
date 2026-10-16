import type {
  DeliveredTotal,
  FinishedDeliveryDirectory,
  FinishedDeliveryLineRecord,
  Page,
} from '@/lib/modules/inventario';
import { prisma } from '@/lib/shared/db/prisma';
import { buildPage, toOffsetLimit } from '@/lib/shared/pagination';

import { companyScopeColumns } from './company-scope';

type PageRequest = Parameters<FinishedDeliveryDirectory['listDeliveryLines']>[2];

const NOTHING_DELIVERED: DeliveredTotal = { quantity: '0.0000', packages: 0 };

/**
 * Implementa `FinishedDeliveryDirectory` de `inventario`, que no puede importar `pedidos` sin cerrar
 * un ciclo. Los lotes llegan como ids sueltos: no se cruza con `product_batches`, que es de
 * `inventario`.
 */
export async function listDeliveryLinesByBatchIds(
  companyId: string,
  batchIds: readonly string[],
  page: PageRequest,
): Promise<Page<FinishedDeliveryLineRecord>> {
  const { offset, limit } = toOffsetLimit(page.page, page.pageSize);
  if (batchIds.length === 0) return buildPage([], 0, page.page, limit);

  const columns = companyScopeColumns({ companyId });
  const where = { AND: [columns, { batchId: { in: [...batchIds] } }, { delivery: columns }] };
  const [rows, total] = await Promise.all([
    prisma.orderDeliveryLine.findMany({
      where,
      orderBy: [{ delivery: { createdAt: 'desc' } }, { id: 'desc' }],
      skip: offset,
      take: limit,
      select: {
        id: true,
        deliveryId: true,
        customerId: true,
        batchId: true,
        packages: true,
        quantity: true,
        delivery: { select: { orderId: true, createdAt: true } },
        voidLine: { select: { void: { select: { reason: true } } } },
      },
    }),
    prisma.orderDeliveryLine.count({ where }),
  ]);

  const items = rows.map((row) => ({
    id: row.id,
    orderDeliveryId: row.deliveryId,
    orderId: row.delivery.orderId,
    createdAt: row.delivery.createdAt.toISOString(),
    customerId: row.customerId,
    batchId: row.batchId,
    packages: row.packages,
    quantity: row.quantity.toFixed(4),
    void: row.voidLine === null ? null : { reason: row.voidLine.void.reason },
  }));
  return buildPage(items, total, page.page, limit);
}

export async function summarizeDeliveredByBatchIds(
  companyId: string,
  batchIds: readonly string[],
): Promise<DeliveredTotal> {
  if (batchIds.length === 0) return NOTHING_DELIVERED;

  const columns = companyScopeColumns({ companyId });
  const { _sum: sum } = await prisma.orderDeliveryLine.aggregate({
    where: { AND: [columns, { batchId: { in: [...batchIds] } }, { voidLine: { is: null } }] },
    _sum: { quantity: true, packages: true },
  });

  return {
    quantity: sum.quantity === null ? NOTHING_DELIVERED.quantity : sum.quantity.toFixed(4),
    packages: sum.packages ?? 0,
  };
}
