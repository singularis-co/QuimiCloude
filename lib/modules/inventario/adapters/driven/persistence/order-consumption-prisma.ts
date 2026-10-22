import type { Prisma } from '@prisma/client';

import { batchCompanyScope, movementCompanyScope } from './company-scope';

import type { InventoryScope } from '../../../domain/inventory-scope';
import type { ConsumedLot, OrderConsumptionLedger } from '../../../domain/order-consumption';

/** Lo que el pedido consumio de cada lote de la empresa, neto, con el `unit_cost` actual del lote. */
async function findConsumedLots(
  tx: Prisma.TransactionClient,
  orderId: string,
  scope: InventoryScope,
): Promise<readonly ConsumedLot[]> {
  const sums = await tx.inventoryMovement.groupBy({
    by: ['batchId'],
    where: { AND: [movementCompanyScope(scope), { orderId, kind: 'consumption' }] },
    _sum: { quantity: true },
    orderBy: { batchId: 'asc' },
  });

  // Los asientos de consumo van en negativo: lo consumido es la suma cambiada de signo.
  const consumed: { readonly batchId: string; readonly quantity: Prisma.Decimal }[] = [];
  for (const row of sums) {
    const quantity = row._sum.quantity?.negated();
    if (quantity !== undefined && quantity.greaterThan(0)) consumed.push({ batchId: row.batchId, quantity });
  }
  if (consumed.length === 0) return [];

  const batches = await tx.productBatch.findMany({
    where: { AND: [batchCompanyScope(scope), { id: { in: consumed.map((row) => row.batchId) } }] },
    select: { id: true, unitCost: true },
  });
  const unitCostById = new Map(batches.map((batch) => [batch.id, batch.unitCost] as const));

  return consumed.map((row) => {
    // La FK del asiento garantiza el lote: si no aparece en la empresa, la base esta rota.
    if (!unitCostById.has(row.batchId)) throw new Error(`findConsumedLots: el lote ${row.batchId} no aparece`);
    const unitCost = unitCostById.get(row.batchId) ?? null;
    return {
      batchId: row.batchId,
      quantity: row.quantity.toFixed(4),
      unitCost: unitCost === null ? null : unitCost.toFixed(4),
    };
  });
}

/**
 * `OrderConsumptionLedger` sobre el cliente transaccional de quien llama: `pedidos` lo lee dentro
 * de su unidad de trabajo, despues de haber escrito ahi mismo los asientos de envases.
 */
export function createOrderConsumptionLedger(tx: Prisma.TransactionClient): OrderConsumptionLedger {
  return {
    findConsumedLots(input) {
      const scope: InventoryScope = { companyId: input.companyId };
      return findConsumedLots(tx, input.orderId, scope);
    },
  };
}
