import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import { batchCompanyScope, movementCompanyScope } from './company-scope';
import { isDuplicateBatchLot, writeFinishedBatchLabels } from './product-prisma';

import type {
  FinishedBatchLabels,
  FinishedBatchLabelsOutcome,
  FinishedBatchOfOrderLine,
} from '../../../domain/finished-batch-labels';
import type { InventoryScope } from '../../../domain/inventory-scope';

/** Fecha civil de una columna `@db.Date`: el instante llega a medianoche UTC. */
function toCivilDate(date: Date | null): string | null {
  return date === null ? null : date.toISOString().slice(0, 10);
}

/** El ambito va en el asiento y en el lote, como en `findBatchesOfOrder`. */
async function findFinishedBatchesOfOrder(
  db: Prisma.TransactionClient,
  orderId: string,
  scope: InventoryScope,
): Promise<readonly FinishedBatchOfOrderLine[]> {
  const rows = await db.inventoryMovement.findMany({
    where: {
      AND: [movementCompanyScope(scope), { orderId, kind: 'production', batch: batchCompanyScope(scope) }],
    },
    select: {
      orderPresentationLineId: true,
      batch: {
        select: { id: true, presentationId: true, lot: true, expiryDate: true, productionDate: true },
      },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  return rows.flatMap((row) =>
    row.orderPresentationLineId === null || row.batch.presentationId === null
      ? []
      : [
          {
            batchId: row.batch.id,
            orderPresentationLineId: row.orderPresentationLineId,
            presentationId: row.batch.presentationId,
            lot: row.batch.lot,
            expiryDate: toCivilDate(row.batch.expiryDate),
            productionDate: toCivilDate(row.batch.productionDate),
          },
        ],
  );
}

/**
 * Sin `db`, cada escritura abre su propia transaccion. Con `db`, escribe en la que recibe; tras un
 * `duplicate_lot` esa transaccion queda abortada en Postgres, asi que quien la abrio tiene que lanzar.
 */
export function createFinishedBatchLabels(db?: Prisma.TransactionClient): FinishedBatchLabels {
  return {
    listOfOrder(companyId, orderId): Promise<readonly FinishedBatchOfOrderLine[]> {
      return findFinishedBatchesOfOrder(db ?? prisma, orderId, { companyId });
    },

    async writeForOrder(input): Promise<FinishedBatchLabelsOutcome> {
      const scope: InventoryScope = { companyId: input.companyId };
      const write = (tx: Prisma.TransactionClient) =>
        writeFinishedBatchLabels(
          tx,
          { orderId: input.orderId, label: input.label, actorId: input.actorId, now: input.now },
          scope,
        );
      try {
        return await (db === undefined ? prisma.$transaction(write) : write(db));
      } catch (error) {
        if (isDuplicateBatchLot(error)) return { kind: 'duplicate_lot', batchId: null };
        throw error;
      }
    },
  };
}
