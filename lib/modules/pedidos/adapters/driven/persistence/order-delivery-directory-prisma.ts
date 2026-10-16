import type {
  DeliveredTotal,
  DeliveryCustomerDirectory,
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
        delivery: { select: { orderId: true, note: true, createdAt: true } },
        voidLine: { select: { void: { select: { reason: true } } } },
      },
    }),
    prisma.orderDeliveryLine.count({ where }),
  ]);

  const items = rows.map((row) => ({
    id: row.id,
    orderDeliveryId: row.deliveryId,
    orderId: row.delivery.orderId,
    note: row.delivery.note,
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

type MovementRef = Parameters<DeliveryCustomerDirectory['findCustomerIds']>[1][number];

function refKey(referenceId: string, batchId: string): string {
  return `${referenceId}:${batchId}`;
}

/**
 * Implementa `DeliveryCustomerDirectory` de `inventario`: los clientes de cada asiento de entrega o
 * de anulacion, por la pareja (entrega o anulacion, lote). Una consulta por tipo de referencia.
 */
export async function findCustomerIdsForMovements(
  companyId: string,
  refs: readonly MovementRef[],
): Promise<ReadonlyMap<string, readonly string[]>> {
  const result = new Map<string, readonly string[]>();
  const deliveryRefs = refs.flatMap((ref) =>
    ref.deliveryId === null ? [] : [{ deliveryId: ref.deliveryId, batchId: ref.batchId }],
  );
  const voidRefs = refs.flatMap((ref) => (ref.voidId === null ? [] : [{ voidId: ref.voidId, batchId: ref.batchId }]));
  if (deliveryRefs.length === 0 && voidRefs.length === 0) return result;

  const columns = companyScopeColumns({ companyId });
  const [deliveryLines, voidLines] = await Promise.all([
    deliveryRefs.length === 0
      ? []
      : prisma.orderDeliveryLine.findMany({
          where: {
            AND: [
              columns,
              { OR: deliveryRefs.map((ref) => ({ deliveryId: ref.deliveryId, batchId: ref.batchId })) },
            ],
          },
          select: { deliveryId: true, batchId: true, customerId: true },
        }),
    voidRefs.length === 0
      ? []
      : prisma.orderDeliveryVoidLine.findMany({
          where: {
            AND: [
              columns,
              {
                OR: voidRefs.map((ref) => ({
                  voidId: ref.voidId,
                  deliveryLine: { AND: [columns, { batchId: ref.batchId }] },
                })),
              },
            ],
          },
          select: { voidId: true, deliveryLine: { select: { batchId: true, customerId: true } } },
        }),
  ]);

  const customersByRef = new Map<string, Set<string>>();
  const collect = (key: string, customerId: string): void => {
    const current = customersByRef.get(key);
    if (current === undefined) customersByRef.set(key, new Set([customerId]));
    else current.add(customerId);
  };
  for (const line of deliveryLines) collect(refKey(line.deliveryId, line.batchId), line.customerId);
  for (const line of voidLines) {
    collect(refKey(line.voidId, line.deliveryLine.batchId), line.deliveryLine.customerId);
  }

  for (const ref of refs) {
    const referenceId = ref.deliveryId ?? ref.voidId;
    if (referenceId === null) continue;
    const customers = customersByRef.get(refKey(referenceId, ref.batchId));
    if (customers !== undefined) result.set(ref.movementId, [...customers].sort());
  }
  return result;
}
