import { prisma } from '@/lib/shared/db/prisma';

import { wholePackagesIn } from '../../../domain/finished-goods-dispatch';
import { PRODUCT_TYPES } from '../../../domain/product-type';

import { batchCompanyScope, presentationCompanyScope, productCompanyScope } from './company-scope';

import type {
  DeliverableBatch,
  FinishedProductForDelivery,
  FinishedProductSurplusBase,
} from '../../../domain/finished-goods-dispatch';
import type { InventoryScope } from '../../../domain/inventory-scope';

/** `YYYY-MM-DD` de una columna `DATE`: Prisma la entrega como medianoche UTC. */
function toCivilDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * La consulta real. Vive aparte de `findDeliverableBatches` por el mismo motivo que
 * `findProductionMovements`: declara el `scope` como `InventoryScope` y lo lleva hasta las
 * envolturas del punto unico, en las DOS tablas.
 */
async function findBatchesWithStock(
  recipeId: string,
  presentationIds: readonly string[],
  scope: InventoryScope,
): Promise<readonly DeliverableBatch[]> {
  const rows = await prisma.productBatch.findMany({
    where: {
      AND: [
        batchCompanyScope(scope),
        {
          stock: { gt: 0 },
          packageContent: { not: null },
          product: {
            AND: [
              productCompanyScope(scope),
              {
                type: PRODUCT_TYPES.FINISHED_PRODUCT,
                deletedAt: null,
                recipeId,
                presentationId: { in: [...presentationIds] },
              },
            ],
          },
        },
      ],
    },
    orderBy: [{ purchaseDate: 'asc' }, { lot: 'asc' }],
    select: {
      id: true,
      lot: true,
      purchaseDate: true,
      expiryDate: true,
      stock: true,
      packageContent: true,
      product: { select: { presentationId: true } },
    },
  });

  const batches: DeliverableBatch[] = [];
  for (const row of rows) {
    const presentationId = row.product.presentationId;
    if (row.packageContent === null || presentationId === null) continue;
    const packageContent = row.packageContent.toFixed(4);
    const availablePackages = wholePackagesIn(row.stock.toFixed(4), packageContent);
    if (availablePackages < 1) continue;
    batches.push({
      batchId: row.id,
      presentationId,
      lot: row.lot,
      purchaseDate: toCivilDate(row.purchaseDate),
      expiryDate: row.expiryDate === null ? null : toCivilDate(row.expiryDate),
      packageContent,
      availablePackages,
    });
  }
  return batches;
}

/**
 * Implementa `FinishedBatchCatalog['findDeliverableBatches']`: los lotes de producto terminado de
 * una receta en las presentaciones pedidas que tienen al menos un envase entero, por fecha de
 * entrada y luego por lote. Lectura fuera de transaccion; la existencia definitiva la comprueba la
 * salida con el producto bloqueado.
 *
 * No exige permiso: quien llama ya autorizo con el suyo, igual que `findFinishedGoodsReceipts`.
 */
export async function findDeliverableBatches(
  recipeId: string,
  presentationIds: readonly string[],
  companyId: string,
): Promise<readonly DeliverableBatch[]> {
  if (presentationIds.length === 0) return [];
  return findBatchesWithStock(recipeId, presentationIds, { companyId });
}

const BATCH_ORDER = [{ purchaseDate: 'asc' as const }, { lot: 'asc' as const }];

/** Envases enteros de los lotes con contenido de envase; un lote sin contenido no suma ninguno. */
function stockPackagesOf(
  batches: readonly { readonly stock: { toFixed(digits: number): string }; readonly packageContent: { toFixed(digits: number): string } | null }[],
): number {
  let total = 0;
  for (const batch of batches) {
    if (batch.packageContent === null) continue;
    total += wholePackagesIn(batch.stock.toFixed(4), batch.packageContent.toFixed(4));
  }
  return total;
}

/** La consulta real de `findForDelivery`, con el `scope` hasta las envolturas en las tres tablas. */
async function findFinishedProductForDelivery(
  productId: string,
  scope: InventoryScope,
): Promise<FinishedProductForDelivery | null> {
  const product = await prisma.product.findFirst({
    where: {
      AND: [productCompanyScope(scope), { id: productId, type: PRODUCT_TYPES.FINISHED_PRODUCT, deletedAt: null }],
    },
    select: {
      id: true,
      name: true,
      recipeId: true,
      presentationId: true,
      batches: {
        where: { AND: [batchCompanyScope(scope), { stock: { gt: 0 }, packageContent: { not: null } }] },
        orderBy: BATCH_ORDER,
        select: { id: true, lot: true, purchaseDate: true, expiryDate: true, stock: true, packageContent: true },
      },
    },
  });
  if (product === null) return null;

  const presentationId = product.presentationId;
  const presentation =
    presentationId === null
      ? null
      : await prisma.presentation.findFirst({
          where: { AND: [presentationCompanyScope(scope), { id: presentationId }] },
          select: { name: true },
        });

  const batches: DeliverableBatch[] = [];
  for (const row of product.batches) {
    if (row.packageContent === null || presentationId === null) continue;
    const packageContent = row.packageContent.toFixed(4);
    const availablePackages = wholePackagesIn(row.stock.toFixed(4), packageContent);
    if (availablePackages < 1) continue;
    batches.push({
      batchId: row.id,
      presentationId,
      lot: row.lot,
      purchaseDate: toCivilDate(row.purchaseDate),
      expiryDate: row.expiryDate === null ? null : toCivilDate(row.expiryDate),
      packageContent,
      availablePackages,
    });
  }

  return {
    productId: product.id,
    name: product.name,
    recipeId: product.recipeId,
    presentationId,
    presentationName: presentation?.name ?? null,
    stockPackages: stockPackagesOf(product.batches),
    batches,
  };
}

/** La consulta real de `findSurplusBases`: una sola, con los lotes anidados. */
async function findFinishedProductSurplusBases(
  productIds: readonly string[],
  scope: InventoryScope,
): Promise<readonly FinishedProductSurplusBase[]> {
  const rows = await prisma.product.findMany({
    where: {
      AND: [
        productCompanyScope(scope),
        { id: { in: [...productIds] }, type: PRODUCT_TYPES.FINISHED_PRODUCT, deletedAt: null },
      ],
    },
    select: {
      id: true,
      recipeId: true,
      presentationId: true,
      batches: {
        where: { AND: [batchCompanyScope(scope), { stock: { gt: 0 }, packageContent: { not: null } }] },
        select: { stock: true, packageContent: true },
      },
    },
  });

  const byId = new Map(rows.map((row) => [row.id, row] as const));
  const bases: FinishedProductSurplusBase[] = [];
  for (const id of new Set(productIds)) {
    const row = byId.get(id);
    if (row === undefined) continue;
    bases.push({
      productId: row.id,
      recipeId: row.recipeId,
      presentationId: row.presentationId,
      stockPackages: stockPackagesOf(row.batches),
    });
  }
  return bases;
}

/**
 * Implementa `FinishedProductDeliveryCatalog['findForDelivery']`: el producto terminado vivo de la
 * empresa con su presentacion, los envases enteros de sus lotes con contenido y sus lotes
 * entregables, en el orden de `findDeliverableBatches`. Lectura fuera de transaccion; la entrega
 * vuelve a leer con el producto bloqueado. Sin permiso: autoriza quien llama.
 */
export async function findForDelivery(
  productId: string,
  companyId: string,
): Promise<FinishedProductForDelivery | null> {
  return findFinishedProductForDelivery(productId, { companyId });
}

/**
 * Implementa `FinishedProductDeliveryCatalog['findSurplusBases']`: receta, presentacion y envases en
 * stock de cada id que sea un producto terminado vivo de la empresa, en el orden pedido; los demas
 * no vuelven. Sin permiso: autoriza quien llama.
 */
export async function findSurplusBases(
  productIds: readonly string[],
  companyId: string,
): Promise<readonly FinishedProductSurplusBase[]> {
  if (productIds.length === 0) return [];
  return findFinishedProductSurplusBases(productIds, { companyId });
}
