import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';
import { buildPage, toOffsetLimit } from '@/lib/shared/pagination';

import { PRODUCT_TYPES } from '../../../domain/product-type';

import {
  batchCompanyScope,
  movementCompanyScope,
  presentationCompanyScope,
  productCompanyScope,
} from './company-scope';

import type {
  FinishedProductMovementDirection,
  FinishedProductMovementKind,
  ProducedProductLink,
} from '../../../domain/finished-product-detail';
import type { InventoryScope } from '../../../domain/inventory-scope';
import type { MovementReason } from '../../../domain/movement-reason';
import type { Page } from '../../../domain/page';
import type {
  FinishedProductBatchRecord,
  FinishedProductCostRecord,
  FinishedProductMovementRecord,
  FinishedProductRecord,
  PageRequest,
} from '../../../ports/finished-product-detail-repository';

const NEWEST_FIRST = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

/** `YYYY-MM-DD` de una columna `DATE`: Prisma la entrega como medianoche UTC. */
function toCivilDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function decimalOrNull(value: Prisma.Decimal | null): string | null {
  return value === null ? null : value.toFixed(4);
}

/** Los asientos de los lotes de un producto, en la empresa. */
function productMovementsWhere(
  productId: string,
  extra: Prisma.InventoryMovementWhereInput,
  scope: InventoryScope,
): Prisma.InventoryMovementWhereInput {
  return {
    AND: [
      movementCompanyScope(scope),
      { batch: { AND: [batchCompanyScope(scope), { productId }] } },
      extra,
    ],
  };
}

export async function findAliveFinishedProduct(
  id: string,
  scope: InventoryScope,
): Promise<FinishedProductRecord | null> {
  const product = await prisma.product.findFirst({
    where: {
      AND: [productCompanyScope(scope), { id, deletedAt: null, type: PRODUCT_TYPES.FINISHED_PRODUCT }],
    },
    select: {
      id: true,
      name: true,
      imagePath: true,
      qtyAlert: true,
      unitId: true,
      presentationId: true,
      batches: {
        where: batchCompanyScope(scope),
        orderBy: NEWEST_FIRST,
        select: { id: true, lot: true, stock: true, packageContent: true },
      },
    },
  });
  if (product === null) return null;

  const presentation =
    product.presentationId === null
      ? null
      : await prisma.presentation.findFirst({
          where: { AND: [presentationCompanyScope(scope), { id: product.presentationId }] },
          select: { id: true, name: true, content: true, unitId: true },
        });

  return {
    id: product.id,
    name: product.name,
    imagePath: product.imagePath,
    qtyAlert: decimalOrNull(product.qtyAlert),
    unitId: product.unitId,
    presentation:
      presentation === null
        ? null
        : {
            id: presentation.id,
            name: presentation.name,
            content: decimalOrNull(presentation.content),
            unitId: presentation.unitId,
          },
    batches: product.batches.map((batch) => ({
      id: batch.id,
      lot: batch.lot,
      stock: batch.stock.toFixed(4),
      packageContent: decimalOrNull(batch.packageContent),
    })),
  };
}

export async function listFinishedProductBatches(
  productId: string,
  page: PageRequest,
  scope: InventoryScope,
): Promise<Page<FinishedProductBatchRecord>> {
  const { offset, limit } = toOffsetLimit(page.page, page.pageSize);
  const where: Prisma.ProductBatchWhereInput = { AND: [batchCompanyScope(scope), { productId }] };

  const [rows, total] = await Promise.all([
    prisma.productBatch.findMany({
      where,
      orderBy: NEWEST_FIRST,
      skip: offset,
      take: limit,
      select: {
        id: true,
        lot: true,
        purchaseDate: true,
        productionDate: true,
        expiryDate: true,
        packageContent: true,
        stock: true,
        createdAt: true,
        movements: {
          where: { AND: [movementCompanyScope(scope), { kind: 'production' }] },
          select: { orderId: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 1,
        },
      },
    }),
    prisma.productBatch.count({ where }),
  ]);

  const items = rows.map((row) => ({
    id: row.id,
    lot: row.lot,
    orderId: row.movements[0]?.orderId ?? null,
    purchaseDate: toCivilDate(row.purchaseDate),
    productionDate: row.productionDate === null ? null : toCivilDate(row.productionDate),
    expiryDate: row.expiryDate === null ? null : toCivilDate(row.expiryDate),
    packageContent: decimalOrNull(row.packageContent),
    stock: row.stock.toFixed(4),
    createdAt: row.createdAt.toISOString(),
  }));
  return buildPage(items, total, page.page, limit);
}

export async function listFinishedProductMovements(
  productId: string,
  direction: FinishedProductMovementDirection,
  page: PageRequest,
  scope: InventoryScope,
): Promise<Page<FinishedProductMovementRecord>> {
  const { offset, limit } = toOffsetLimit(page.page, page.pageSize);
  const where = productMovementsWhere(
    productId,
    { quantity: direction === 'in' ? { gt: 0 } : { lt: 0 } },
    scope,
  );

  const [rows, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where,
      orderBy: NEWEST_FIRST,
      skip: offset,
      take: limit,
      select: {
        id: true,
        kind: true,
        batchId: true,
        quantity: true,
        orderId: true,
        reason: true,
        createdAt: true,
        batch: { select: { lot: true, packageContent: true } },
      },
    }),
    prisma.inventoryMovement.count({ where }),
  ]);

  const items = rows.map((row) => ({
    id: row.id,
    kind: row.kind as FinishedProductMovementKind,
    batchId: row.batchId,
    lot: row.batch.lot,
    quantity: row.quantity.toFixed(4),
    packageContent: decimalOrNull(row.batch.packageContent),
    orderId: row.orderId,
    reason: row.reason as MovementReason | null,
    createdAt: row.createdAt.toISOString(),
  }));
  return buildPage(items, total, page.page, limit);
}

export async function listFinishedProductCosts(
  productId: string,
  page: PageRequest,
  scope: InventoryScope,
): Promise<Page<FinishedProductCostRecord>> {
  const { offset, limit } = toOffsetLimit(page.page, page.pageSize);
  const where = productMovementsWhere(productId, { kind: 'production' }, scope);

  const [rows, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where,
      orderBy: NEWEST_FIRST,
      skip: offset,
      take: limit,
      select: {
        batchId: true,
        orderId: true,
        quantity: true,
        createdAt: true,
        batch: { select: { lot: true, packageContent: true, unitCost: true } },
      },
    }),
    prisma.inventoryMovement.count({ where }),
  ]);

  const items = rows.map((row) => ({
    batchId: row.batchId,
    lot: row.batch.lot,
    orderId: row.orderId,
    quantity: row.quantity.toFixed(4),
    packageContent: decimalOrNull(row.batch.packageContent),
    unitCost: decimalOrNull(row.batch.unitCost),
    createdAt: row.createdAt.toISOString(),
  }));
  return buildPage(items, total, page.page, limit);
}

/** El lote de produccion lleva la presentacion de su linea, y `(pedido, presentacion)` es unico en
 *  el reparto: el par identifica la linea sin leer tablas de `pedidos`. */
export async function findProducedFinishedProducts(
  orderIds: readonly string[],
  scope: InventoryScope,
): Promise<readonly ProducedProductLink[]> {
  if (orderIds.length === 0) return [];

  const rows = await prisma.inventoryMovement.findMany({
    where: {
      AND: [
        movementCompanyScope(scope),
        { kind: 'production', orderId: { in: [...orderIds] } },
        {
          batch: {
            AND: [
              batchCompanyScope(scope),
              {
                product: {
                  AND: [productCompanyScope(scope), { deletedAt: null, type: PRODUCT_TYPES.FINISHED_PRODUCT }],
                },
              },
            ],
          },
        },
      ],
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { orderId: true, batch: { select: { presentationId: true, productId: true } } },
  });

  const links = new Map<string, ProducedProductLink>();
  for (const row of rows) {
    const { presentationId, productId } = row.batch;
    if (row.orderId === null || presentationId === null) continue;
    const key = `${row.orderId}|${presentationId}|${productId}`;
    if (!links.has(key)) links.set(key, { orderId: row.orderId, presentationId, productId });
  }
  return [...links.values()];
}
