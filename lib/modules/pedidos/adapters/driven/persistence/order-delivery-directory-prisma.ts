import type { DeliveredTotal, FinishedDeliveryDirectory } from '@/lib/modules/inventario';
import { prisma } from '@/lib/shared/db/prisma';

import { companyScopeColumns } from './company-scope';

type DeliveryLineDetail = {
  readonly packages: number;
  readonly void: { readonly reason: string } | null;
};

type DeliveryDetail = {
  readonly customerId: string;
  readonly linesByBatch: ReadonlyMap<string, DeliveryLineDetail>;
};

const NOTHING_DELIVERED: DeliveredTotal = { quantity: '0.0000', packages: 0 };

/**
 * Implementa `FinishedDeliveryDirectory` de `inventario`, que no puede importar `pedidos` sin cerrar
 * un ciclo. Los lotes llegan como ids sueltos: no se cruza con `product_batches`, que es de
 * `inventario`.
 */
export async function findDeliveryDetailsByIds(
  companyId: string,
  deliveryIds: readonly string[],
): Promise<ReadonlyMap<string, DeliveryDetail>> {
  const result = new Map<string, DeliveryDetail>();
  if (deliveryIds.length === 0) return result;

  const columns = companyScopeColumns({ companyId });
  const rows = await prisma.orderDelivery.findMany({
    where: { AND: [columns, { id: { in: [...deliveryIds] } }] },
    select: {
      id: true,
      customerId: true,
      lines: {
        where: columns,
        select: {
          batchId: true,
          packages: true,
          voidLine: { select: { void: { select: { reason: true } } } },
        },
      },
    },
  });

  for (const row of rows) {
    const linesByBatch = new Map<string, DeliveryLineDetail>();
    for (const line of row.lines) {
      linesByBatch.set(line.batchId, {
        packages: line.packages,
        void: line.voidLine === null ? null : { reason: line.voidLine.void.reason },
      });
    }
    result.set(row.id, { customerId: row.customerId, linesByBatch });
  }
  return result;
}

// El cliente aun vive en la entrega y la fila del tab ya es la linea con su cliente: hasta que la
// columna pase a las lineas no hay lectura correcta que devolver.
export const listDeliveryLinesByBatchIds: FinishedDeliveryDirectory['listDeliveryLines'] = async (companyId) => {
  throw new Error(`listDeliveryLinesByBatchIds: sin columna de cliente en las lineas (empresa ${companyId})`);
};

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
