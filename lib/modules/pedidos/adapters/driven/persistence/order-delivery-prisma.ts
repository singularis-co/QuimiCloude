import { Prisma, type PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import { companyScopeColumns } from './company-scope';

import type { OrderScope } from '../../../domain/order-scope';
import type {
  NewOrderDelivery,
  NewOrderDeliveryLine,
  OrderDeliveryRepository,
  RegisteredOrderDelivery,
} from '../../../ports/order-delivery-repository';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

type CreateOutcome = { readonly kind: 'created'; readonly id: string } | { readonly kind: 'duplicate_key' };

/** Lee por el indice unico `(company_id, delivery_key)`: la empresa va en el `where`, asi que la
 *  clave de otra empresa no aparece. */
async function findOrderDeliveryByKey(
  deliveryKey: string,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<RegisteredOrderDelivery | null> {
  const { companyId } = companyScopeColumns(scope);
  return tx.orderDelivery.findUnique({
    where: { companyId_deliveryKey: { companyId, deliveryKey } },
    select: { id: true, orderId: true },
  });
}

// La tabla aun exige el cliente en la entrega y el contrato ya lo lleva en cada linea: no hay
// valor correcto que escribir hasta que la columna pase a las lineas.
async function createOrderDelivery(delivery: NewOrderDelivery): Promise<CreateOutcome> {
  throw new Error(`createOrderDelivery: sin columna de cliente en las lineas (entrega ${delivery.deliveryKey})`);
}

/** La empresa de cada linea la fijan las claves foraneas compuestas: una entrega, una linea del
 *  reparto o un lote de otra empresa hacen fallar el `INSERT`. */
async function addOrderDeliveryLines(
  deliveryId: string,
  lines: readonly NewOrderDeliveryLine[],
  scope: OrderScope,
  tx: PrismaLike,
): Promise<void> {
  if (lines.length === 0) return;
  const { companyId } = companyScopeColumns(scope);
  await tx.orderDeliveryLine.createMany({
    data: lines.map((line) => ({
      companyId,
      deliveryId,
      orderPresentationLineId: line.presentationLineId,
      batchId: line.batchId,
      packages: line.packages,
      quantity: new Prisma.Decimal(line.quantity),
    })),
  });
}

/** Lo anulado no cuenta como entregado: vuelve a quedar pendiente y se puede entregar de nuevo. */
async function sumOrderDeliveredPackages(
  orderId: string,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<ReadonlyMap<string, number>> {
  const columns = companyScopeColumns(scope);
  const rows = await tx.orderDeliveryLine.groupBy({
    by: ['orderPresentationLineId'],
    where: { ...columns, delivery: { ...columns, orderId }, voidLine: null },
    _sum: { packages: true },
  });
  return new Map(rows.map((row) => [row.orderPresentationLineId, row._sum.packages ?? 0]));
}

/** Sobre el cliente global para la lectura del sheet, o sobre el `tx` de la entrega. Sin `update`,
 *  `delete` ni `upsert`: una entrega registrada no se modifica. */
export function createOrderDeliveryRepository(tx: PrismaLike = prisma): OrderDeliveryRepository {
  return {
    findByKey: (deliveryKey, scope) => findOrderDeliveryByKey(deliveryKey, scope, tx),
    create: (delivery) => createOrderDelivery(delivery),
    addLines: (deliveryId, lines, scope) => addOrderDeliveryLines(deliveryId, lines, scope, tx),
    sumDeliveredPackages: (orderId, scope) => sumOrderDeliveredPackages(orderId, scope, tx),
  };
}
