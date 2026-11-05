import { Prisma, type PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import { companyScopeColumns, orderCompanyScope } from './company-scope';

import { formatOrderNumber } from '../../../domain/order-number';
import { orderedPackages } from '../../../domain/packing-count';

import type { OrderScope } from '../../../domain/order-scope';
import type {
  DirectDeliveryRepository,
  NewDirectDelivery,
  NewDirectDeliveryLine,
  RegisteredDelivery,
  WaitingOrderLineOfPair,
  WaitingOrderPair,
  WaitingOrdersLock,
  WaitingOrdersReader,
} from '../../../ports/direct-delivery-repository';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

type CreateOutcome = { readonly kind: 'created'; readonly id: string } | { readonly kind: 'duplicate_key' };

/** La clave es unica por empresa y compartida con las entregas de pedido: devuelve la que haya. */
async function findDeliveryByKey(
  deliveryKey: string,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<RegisteredDelivery | null> {
  const { companyId } = companyScopeColumns(scope);
  return tx.orderDelivery.findUnique({
    where: { companyId_deliveryKey: { companyId, deliveryKey } },
    select: { id: true, orderId: true },
  });
}

/** El `INSERT` no escribe `id`: el unico unico con el que puede chocar es la clave por empresa. */
function isDuplicateDeliveryKey(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function createDirectDelivery(
  delivery: NewDirectDelivery,
  scope: OrderScope,
  tx: PrismaLike,
): Promise<CreateOutcome> {
  try {
    const { id } = await tx.orderDelivery.create({
      data: {
        ...companyScopeColumns(scope),
        productId: delivery.productId,
        note: delivery.note,
        deliveryKey: delivery.deliveryKey,
        createdBy: delivery.actorId,
        createdAt: delivery.now,
      },
      select: { id: true },
    });
    return { kind: 'created', id };
  } catch (error) {
    if (isDuplicateDeliveryKey(error)) return { kind: 'duplicate_key' };
    throw error;
  }
}

/** Las claves foraneas compuestas y el disparador de lineas rechazan un cliente, un lote o una
 *  entrega de otra empresa, y un lote de otro producto. */
async function addDirectDeliveryLines(
  deliveryId: string,
  lines: readonly NewDirectDeliveryLine[],
  scope: OrderScope,
  tx: PrismaLike,
): Promise<void> {
  if (lines.length === 0) return;
  const { companyId } = companyScopeColumns(scope);
  await tx.orderDeliveryLine.createMany({
    data: lines.map((line) => ({
      companyId,
      deliveryId,
      customerId: line.customerId,
      orderPresentationLineId: null,
      batchId: line.batchId,
      packages: line.packages,
      quantity: new Prisma.Decimal(line.quantity),
    })),
  });
}

/** Las lineas del pedido vivas en `TERMINADO` con alguna de esas recetas, por id. */
async function findWaitingOrderLineRecipes(
  recipeIds: readonly string[],
  scope: OrderScope,
  tx: PrismaLike,
): Promise<ReadonlyMap<string, string>> {
  const lines = await tx.orderLine.findMany({
    where: {
      AND: [
        companyScopeColumns(scope),
        { deletedAt: null, status: 'TERMINADO', recipeId: { in: [...recipeIds] } },
        { order: { AND: [orderCompanyScope(scope), { deletedAt: null }] } },
      ],
    },
    select: { id: true, recipeId: true },
  });
  return new Map(lines.map((line) => [line.id, line.recipeId]));
}

/** Lo anulado no cuenta como entregado: vuelve a esperar. */
async function listWaitingOrderLines(
  pairs: readonly WaitingOrderPair[],
  scope: OrderScope,
  tx: PrismaLike,
): Promise<readonly WaitingOrderLineOfPair[]> {
  if (pairs.length === 0) return [];
  const recipeByLine = await findWaitingOrderLineRecipes([...new Set(pairs.map((pair) => pair.recipeId))], scope, tx);
  const matching = pairs.flatMap((pair) => {
    const lineIds = [...recipeByLine].filter(([, recipeId]) => recipeId === pair.recipeId).map(([id]) => id);
    return lineIds.length === 0 ? [] : [{ presentationId: pair.presentationId, orderLineId: { in: lineIds } }];
  });
  if (matching.length === 0) return [];

  const columns = companyScopeColumns(scope);
  const lines = await tx.orderPresentationLine.findMany({
    where: {
      AND: [
        columns,
        { order: { AND: [orderCompanyScope(scope), { deletedAt: null }] } },
        { OR: matching },
      ],
    },
    select: {
      id: true,
      presentationId: true,
      packages: true,
      packedPackages: true,
      packedSurplusPackages: true,
      orderLineId: true,
      order: { select: { id: true, orderYear: true, orderSequence: true } },
    },
    orderBy: [{ order: { orderYear: 'asc' } }, { order: { orderSequence: 'asc' } }, { id: 'asc' }],
  });
  if (lines.length === 0) return [];

  const delivered = await tx.orderDeliveryLine.groupBy({
    by: ['orderPresentationLineId'],
    where: {
      AND: [
        columns,
        { orderPresentationLineId: { in: lines.map((line) => line.id) } },
        { voidLine: { is: null } },
      ],
    },
    _sum: { packages: true },
  });
  const deliveredByLine = new Map(delivered.map((row) => [row.orderPresentationLineId, row._sum.packages ?? 0]));

  return lines.flatMap((line) => {
    const recipeId = line.orderLineId === null ? undefined : recipeByLine.get(line.orderLineId);
    if (recipeId === undefined) return [];
    return [
      {
        orderId: line.order.id,
        numberText: formatOrderNumber({ year: line.order.orderYear, sequence: line.order.orderSequence }),
        orderedPackages: orderedPackages(line),
        deliveredPackages: deliveredByLine.get(line.id) ?? 0,
        recipeId,
        presentationId: line.presentationId,
      },
    ];
  });
}

/** Solo bloquea: lo que esperan se vuelve a leer con el producto ya bloqueado. */
async function lockWaitingCandidateOrders(
  pair: WaitingOrderPair,
  scope: OrderScope,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const { companyId } = companyScopeColumns(scope);
  await tx.$queryRaw<ReadonlyArray<{ id: string }>>(Prisma.sql`
    SELECT o."id"
      FROM "orders" o
     WHERE o."company_id" = ${companyId}::uuid
       AND o."deleted_at" IS NULL
       AND EXISTS (
             SELECT 1
               FROM "order_lines" ol
               JOIN "order_presentation_lines" l
                 ON l."order_line_id" = ol."id"
                AND l."company_id" = ${companyId}::uuid
              WHERE ol."order_id" = o."id"
                AND ol."company_id" = ${companyId}::uuid
                AND ol."recipe_id" = ${pair.recipeId}::uuid
                AND ol."deleted_at" IS NULL
                AND ol."status" IN ('TERMINADO'::"OrderStatus", 'EN_ACONDICIONAMIENTO'::"OrderStatus")
                AND l."presentation_id" = ${pair.presentationId}::uuid
           )
     ORDER BY o."id"
       FOR SHARE OF o
  `);
}

/** Sobre el `tx` de la entrega. Sin `update`, `delete` ni `upsert`: una entrega no se modifica. */
export function createDirectDeliveryRepository(tx: PrismaLike = prisma): DirectDeliveryRepository {
  return {
    findByKey: (deliveryKey, scope) => findDeliveryByKey(deliveryKey, scope, tx),
    create: (delivery, scope) => createDirectDelivery(delivery, scope, tx),
    addLines: (deliveryId, lines, scope) => addDirectDeliveryLines(deliveryId, lines, scope, tx),
  };
}

/** Sobre el cliente global para el listado, o sobre el `tx` de la entrega. Solo lee tablas de `pedidos`. */
export function createWaitingOrdersReader(tx: PrismaLike = prisma): WaitingOrdersReader {
  return {
    listWaitingLines: (pairs, scope) => listWaitingOrderLines(pairs, scope, tx),
  };
}

/** Solo sobre el `tx` de la entrega: fuera de una transaccion el bloqueo no duraria nada. */
export function createWaitingOrdersLock(tx: Prisma.TransactionClient): WaitingOrdersLock {
  return {
    lockWaitingCandidates: (pair, scope) => lockWaitingCandidateOrders(pair, scope, tx),
  };
}
