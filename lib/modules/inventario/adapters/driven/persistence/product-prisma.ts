import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';
import { buildPage, toOffsetLimit } from '@/lib/shared/pagination';

import { addQuantities, compareQuantities, subtractQuantities } from '../../../domain/decimal-quantity';
import {
  ActionNotAllowedError,
  BatchDuplicateLotError,
  BatchStockNegativeError,
  ValidationError,
} from '../../../domain/errors';
import { planFinishedGoodsLine } from '../../../domain/finished-goods';
import { quantityForPackages, wholePackagesIn } from '../../../domain/finished-goods-dispatch';
import { isWholeQuantity } from '../../../domain/product-input';
import { normalizeProductName } from '../../../domain/product-name';
import { netReservedQuantity } from '../../../domain/reservation-ledger';
import { weightedAverageUnitCost, type CostedBatchQuantity } from '../../../domain/unit-cost';

import { writeMovement } from './batch-movement-prisma';
import {
  batchCompanyScope,
  companyScopeColumns,
  movementCompanyScope,
  presentationCompanyScope,
  productCompanyScope,
} from './company-scope';
import { findReservedAndAvailableByBatch, findReservedAndAvailableByProduct } from './reservation-prisma';
import {
  dateRangeCondition,
  normalizedSearchCondition,
  numberRangeCondition,
  selectCondition,
  textCondition,
  type NumberRangeCondition,
} from './list-query-sql';

import type { FinishedGoodsOutcome } from '../../../domain/finished-goods';
import type { FinishedBatchLabel, FinishedBatchLabelsOutcome } from '../../../domain/finished-batch-labels';
import type { FinishedGoodsDispatchOutcome } from '../../../domain/finished-goods-dispatch';
import type { FinishedGoodsReturnOutcome } from '../../../domain/finished-goods-return';
import type { InventoryScope } from '../../../domain/inventory-scope';
import type { ListFilterValue, ListQuery, ListSort } from '../../../domain/list-query';
import type { Page } from '../../../domain/page';
import type { NewProductBatch } from '../../../domain/product-batch';
import type { ProductBatchView } from '../../../domain/product-batch-view';
import type { AdjustBatchStockOutcome, BatchStockAdjustment } from '../../../domain/stock-adjustment';
import type { NewProduct, PackagingIdentity, ProductView, ProductType } from '../../../domain/product-view';
import type { ListAliveOptions } from '../../../ports/product-repository';
import { PRODUCT_TYPES } from '../../../domain/product-type';
import { PRODUCT_PRESENTATION_UNIT_FILTER, PRODUCT_TYPE_VALUES } from '../../../domain/product-queryable';

// El ambito de empresa va como conjuncion aparte en un `AND` de primer nivel, para que ninguna otra
// condicion del `where` pueda relajarlo. Una fila de otra empresa sale igual que una que no existe
// (`null`/`false`): distinguirlas seria un oraculo de existencia sobre filas ajenas.

export const PRODUCT_SELECT = {
  id: true,
  name: true,
  imagePath: true,
  stock: true,
  unitId: true,
  qtyAlert: true,
  type: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_SELECT }>;

const ZERO_QUANTITY = '0.0000';

export function toProductView(row: ProductRow): ProductView {
  return {
    id: row.id,
    name: row.name,
    imagePath: row.imagePath,
    stock: row.stock.toFixed(4),
    unitId: row.unitId,
    qtyAlert: row.qtyAlert === null ? null : row.qtyAlert.toFixed(4),
    type: row.type as ProductType,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** `now` llega del caso de uso y no de `now()` de la base, para que los dos compartan reloj. */
export async function createProduct(
  data: NewProduct,
  now: Date,
  scope: InventoryScope,
): Promise<{ id: string }> {
  const created = await prisma.product.create({
    data: {
      name: data.name,
      nameNormalized: normalizeProductName(data.name),
      qtyAlert: data.qtyAlert ?? null,
      type: data.type ?? PRODUCT_TYPES.PRODUCT,
      imagePath: data.imagePath ?? null,
      ...companyScopeColumns(scope),
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true },
  });
  return { id: created.id };
}

export async function findAliveProductById(
  id: string,
  scope: InventoryScope,
): Promise<ProductView | null> {
  const row = await prisma.product.findFirst({
    where: { AND: [productCompanyScope(scope), { id, deletedAt: null }] },
    select: PRODUCT_SELECT,
  });
  return row === null ? null : toProductView(row);
}

type ProductTypeRow = { readonly type: ProductType };

/**
 * Bloquea la fila para decidir el tipo antes de escribir, sin dos consultas sueltas que dejen
 * hueco a una carrera: `FOR NO KEY UPDATE` retiene la fila hasta que la transaccion cierra.
 * Devuelve `false` sin fila viva de la empresa, `'type_locked'` si la edicion cambiaria el tipo
 * a o desde `FINISHED_PRODUCT`, y `true` tras escribir. El tipo en si nunca se escribe: la
 * edicion no lo cambia, ni para un producto terminado ni para ningun otro.
 */
export async function updateAliveProduct(
  id: string,
  data: NewProduct,
  now: Date,
  scope: InventoryScope,
): Promise<boolean | 'type_locked'> {
  const { companyId } = companyScopeColumns(scope);

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<ReadonlyArray<ProductTypeRow>>(Prisma.sql`
      SELECT "type"
        FROM "products"
       WHERE "id" = ${id}::uuid
         AND "company_id" = ${companyId}::uuid
         AND "deleted_at" IS NULL
         FOR NO KEY UPDATE
    `);
    const alive = rows[0];
    if (alive === undefined) return false;

    const requestedType = data.type ?? PRODUCT_TYPES.PRODUCT;
    const wasFinished = alive.type === PRODUCT_TYPES.FINISHED_PRODUCT;
    const staysFinished = requestedType === PRODUCT_TYPES.FINISHED_PRODUCT;
    if (wasFinished !== staysFinished) return 'type_locked';

    const { count } = await tx.product.updateMany({
      where: { id, companyId, deletedAt: null },
      data: {
        name: data.name,
        nameNormalized: normalizeProductName(data.name),
        qtyAlert: data.qtyAlert ?? null,
        ...(data.imagePath !== undefined ? { imagePath: data.imagePath } : {}),
        updatedAt: now,
      },
    });
    return count === 1;
  });
}

export async function softDeleteAliveProduct(
  id: string,
  now: Date,
  scope: InventoryScope,
): Promise<boolean> {
  const { count } = await prisma.product.updateMany({
    where: { AND: [productCompanyScope(scope), { id, deletedAt: null }] },
    data: {
      deletedAt: now,
      updatedAt: now,
    },
  });
  return count === 1;
}

/** Ninguna columna ordenable es unica: sin este desempate, dos filas empatadas pueden cambiar de
 *  pagina entre consultas. */
const TIE_BREAKER = { id: 'asc' } as const satisfies Prisma.ProductOrderByWithRelationInput;

/** Primero el ultimo lote cargado; los productos sin lote, al final, por alta mas reciente. Un
 *  array nuevo por llamada: `orderBy` lo exige mutable, y una instancia compartida la podria mutar
 *  cualquier llamante. */
function defaultOrderBy(): Prisma.ProductOrderByWithRelationInput[] {
  return [{ lastBatchAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }, TIE_BREAKER];
}

/**
 * `nulls: 'last'` va explicito porque Postgres pone los nulos al principio en `DESC`. El `default`
 * no es inalcanzable: el adaptador no confia en que el llamante haya podado el campo.
 */
export function productOrderBy(
  sort: ListSort | null,
): Prisma.ProductOrderByWithRelationInput[] {
  if (sort === null) return defaultOrderBy();
  const dir = sort.direction;

  switch (sort.columnId) {
    case 'name':
      return [{ name: dir }, TIE_BREAKER];
    case 'stock':
      // Sin `nulls`: `products.stock` es `NOT NULL DEFAULT 0`, nunca vacia.
      return [{ stock: dir }, TIE_BREAKER];
    case 'qtyAlert':
      return [{ qtyAlert: { sort: dir, nulls: 'last' } }, TIE_BREAKER];
    case 'createdAt':
      return [{ createdAt: dir }, TIE_BREAKER];
    case 'updatedAt':
      return [{ updatedAt: dir }, TIE_BREAKER];
    default:
      return defaultOrderBy();
  }
}

/** Del rango generico del contrato al rango en `Prisma.Decimal`: `stock` y `qtyAlert` son
 *  columnas `Decimal(14,4)`, y compararlas contra un `number` de JavaScript perderia precision
 *  a partir de 2^53. Mismo patron que `toDecimalRange` de `pedidos/order-prisma.ts`. */
function toDecimalRange(condition: NumberRangeCondition): { gte?: Prisma.Decimal; lte?: Prisma.Decimal } {
  return {
    ...(condition.gte === undefined ? {} : { gte: new Prisma.Decimal(condition.gte) }),
    ...(condition.lte === undefined ? {} : { lte: new Prisma.Decimal(condition.lte) }),
  };
}

function productFilterWhere(
  field: string,
  value: ListFilterValue,
  presentationIdsByUnit: readonly string[],
): Prisma.ProductWhereInput | null {
  switch (value.kind) {
    case 'select': {
      const condition = selectCondition(value.values);
      if (condition === null) return null;
      if (field === PRODUCT_PRESENTATION_UNIT_FILTER) return { presentationId: { in: [...presentationIdsByUnit] } };
      if (field === 'type') {
        const validValues = value.values.filter((v) => PRODUCT_TYPE_VALUES.includes(v as ProductType)) as ProductType[];
        if (validValues.length === 0) return null;
        return { type: { in: validValues } };
      }
      return null;
    }
    case 'numberRange': {
      const condition = numberRangeCondition(value.min, value.max);
      if (condition === null) return null;
      if (field === 'stock') return { stock: toDecimalRange(condition) };
      if (field === 'qtyAlert') return { qtyAlert: toDecimalRange(condition) };
      return null;
    }
    case 'dateRange': {
      const condition = dateRangeCondition(value.from, value.to);
      if (condition === null) return null;
      if (field === 'createdAt') return { createdAt: condition };
      if (field === 'updatedAt') return { updatedAt: condition };
      return null;
    }
    case 'text': {
      const condition = textCondition(value.value);
      if (condition === null) return null;
      if (field === 'name') return { name: condition };
      return null;
    }
  }
}

/** El termino se normaliza con la misma funcion que escribio `name_normalized`, para que la
 *  busqueda y la escritura no discrepen. `presentationIdsByUnit` son las presentaciones que ya
 *  resolvio el filtro por unidad de presentacion; sin ellas ese filtro no deja pasar nada. */
export function buildProductWhere(
  query: ListQuery,
  scope: InventoryScope,
  presentationIdsByUnit: readonly string[] = [],
): Prisma.ProductWhereInput {
  const search = normalizedSearchCondition(query.search, normalizeProductName);
  const filters = Object.entries(query.filters)
    .map(([field, value]) => productFilterWhere(field, value, presentationIdsByUnit))
    .filter((condition): condition is Prisma.ProductWhereInput => condition !== null);

  return {
    AND: [
      productCompanyScope(scope),
      {
        deletedAt: null,
        ...(search === null ? {} : { nameNormalized: search }),
        ...(filters.length === 0 ? {} : { AND: filters }),
      },
    ],
  };
}

/**
 * A `buildPage` va el `limit` acotado y no el `pageSize` pedido: con el pedido, `pageSize` y
 * `totalPages` mentirian. El `count` usa el mismo `where` que el `findMany`, para que `total` no
 * cuente filas de otra empresa ni fuera del filtro.
 */
/** Presentaciones de la empresa con contenido declarado cuya unidad esta entre `unitIds`. */
async function findPresentationIdsWithContentInUnits(
  unitIds: readonly string[],
  scope: InventoryScope,
): Promise<readonly string[]> {
  if (unitIds.length === 0) return [];
  const rows = await prisma.presentation.findMany({
    where: { AND: [presentationCompanyScope(scope), { unitId: { in: [...unitIds] }, content: { not: null } }] },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

type FixedPresentationFields = Pick<
  ProductView,
  'presentationId' | 'presentationName' | 'presentationContent' | 'presentationUnitId'
>;

async function findFixedPresentations(
  presentationIds: readonly string[],
  scope: InventoryScope,
): Promise<ReadonlyMap<string, FixedPresentationFields>> {
  if (presentationIds.length === 0) return new Map();
  const rows = await prisma.presentation.findMany({
    where: { AND: [presentationCompanyScope(scope), { id: { in: [...presentationIds] } }] },
    select: { id: true, name: true, content: true, unitId: true },
  });
  return new Map(
    rows.map((row) => [
      row.id,
      {
        presentationId: row.id,
        presentationName: row.name,
        presentationContent: row.content === null ? null : row.content.toFixed(4),
        presentationUnitId: row.unitId,
      },
    ]),
  );
}

const NO_FIXED_PRESENTATION: FixedPresentationFields = {
  presentationId: null,
  presentationName: null,
  presentationContent: null,
  presentationUnitId: null,
};

type NextExpiryRow = { readonly productId: string; readonly _min: { readonly expiryDate: Date | null } };

/** De las filas del `groupBy` al mapa producto -> `YYYY-MM-DD`. Un producto sin fecha no entra:
 *  el llamante lo resuelve a `null`. */
export function toNextExpiryByProduct(rows: readonly NextExpiryRow[]): ReadonlyMap<string, string> {
  return new Map(
    rows.flatMap((row) => (row._min.expiryDate === null ? [] : [[row.productId, toCivilDate(row._min.expiryDate)] as const])),
  );
}

/** UNA consulta agregada por pagina. Solo lotes con existencia > 0 (`productId` de la pagina y
 *  `companyId`): un lote agotado ya no vence nada. NO coincide a proposito con
 *  `findReservedAndAvailableByProduct`, que suma todos los lotes. El producto vivo ya lo garantiza
 *  el `where` del listado. */
async function findNextExpiryDateByProduct(
  productIds: readonly string[],
  scope: InventoryScope,
): Promise<ReadonlyMap<string, string>> {
  if (productIds.length === 0) return new Map();
  const rows = await prisma.productBatch.groupBy({
    by: ['productId'],
    where: {
      AND: [
        batchCompanyScope(scope),
        { productId: { in: [...productIds] }, stock: { gt: 0 }, expiryDate: { not: null } },
      ],
    },
    _min: { expiryDate: true },
  });
  return toNextExpiryByProduct(rows);
}

type CostedBatchRow = {
  readonly productId: string;
  readonly stock: Prisma.Decimal;
  readonly unitCost: Prisma.Decimal | null;
};

/** De los lotes leidos al mapa producto -> costo medio ponderado. Un producto sin lotes que
 *  ponderar no entra: el llamante lo resuelve a `null`. La aritmetica es del dominio. */
export function toAverageUnitCostByProduct(rows: readonly CostedBatchRow[]): ReadonlyMap<string, string> {
  const byProduct = new Map<string, CostedBatchQuantity[]>();
  for (const row of rows) {
    const batches = byProduct.get(row.productId) ?? [];
    batches.push({ stock: row.stock.toFixed(4), unitCost: row.unitCost === null ? null : row.unitCost.toFixed(4) });
    byProduct.set(row.productId, batches);
  }
  return new Map(
    [...byProduct].flatMap(([productId, batches]) => {
      const average = weightedAverageUnitCost(batches);
      return average === null ? [] : [[productId, average] as const];
    }),
  );
}

/** UNA consulta por pagina: los lotes con existencia > 0 y costo de los productos de la pagina.
 *  La existencia es la guardada en el lote (`stock`, la que pinta la columna «Existencia»), no la
 *  disponible neta de apartados. */
async function findAverageUnitCostByProduct(
  productIds: readonly string[],
  scope: InventoryScope,
): Promise<ReadonlyMap<string, string>> {
  if (productIds.length === 0) return new Map();
  const rows = await prisma.productBatch.findMany({
    where: {
      AND: [
        batchCompanyScope(scope),
        { productId: { in: [...productIds] }, stock: { gt: 0 }, unitCost: { not: null } },
      ],
    },
    select: { productId: true, stock: true, unitCost: true },
  });
  return toAverageUnitCostByProduct(rows);
}

export async function listAliveProducts(
  query: ListQuery,
  scope: InventoryScope,
  options: ListAliveOptions = {},
): Promise<Page<ProductView>> {
  const withUnitCosts = options.withUnitCosts === true;
  const { offset, limit } = toOffsetLimit(query.page, query.pageSize);
  const unitFilter = query.filters[PRODUCT_PRESENTATION_UNIT_FILTER];
  const presentationIdsByUnit =
    unitFilter?.kind === 'select' ? await findPresentationIdsWithContentInUnits(unitFilter.values, scope) : [];
  const where = buildProductWhere(query, scope, presentationIdsByUnit);

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: { ...PRODUCT_SELECT, presentationId: true },
      orderBy: productOrderBy(query.sort),
      skip: offset,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  // UNA consulta agregada mas para la pagina entera, nunca una por fila: `reserved`/`available`
  // salen del libro de reservas, sumados por producto.
  const productIds = rows.map((row) => row.id);
  const [reservedByProduct, nextExpiryByProduct, averageUnitCostByProduct] = await Promise.all([
    findReservedAndAvailableByProduct(prisma, scope.companyId, productIds),
    findNextExpiryDateByProduct(productIds, scope),
    // Sin costos pedidos, la consulta de costos ni se lanza.
    withUnitCosts ? findAverageUnitCostByProduct(productIds, scope) : null,
  ]);
  const presentations = await findFixedPresentations(
    [...new Set(rows.flatMap((row) => (row.presentationId === null ? [] : [row.presentationId])))],
    scope,
  );
  const items = rows.map((row) => {
    const aggregate = reservedByProduct.get(row.id);
    const fixed = row.presentationId === null ? undefined : presentations.get(row.presentationId);
    return {
      ...toProductView(row),
      reserved: aggregate?.reserved ?? ZERO_QUANTITY,
      available: aggregate?.available ?? ZERO_QUANTITY,
      nextExpiryDate: nextExpiryByProduct.get(row.id) ?? null,
      ...(averageUnitCostByProduct === null
        ? {}
        : { averageUnitCost: averageUnitCostByProduct.get(row.id) ?? null }),
      ...(fixed ?? NO_FIXED_PRESENTATION),
    };
  });

  return buildPage(items, total, query.page, limit);
}

/**
 * La unidad no llega de quien llama: se lee de la presentacion, con su propio ambito de
 * empresa. Sin esa fila -no existe o es de otra empresa- no hay unidad que buscar y se
 * devuelve `null` (el alta seguira por crear y fallara alli). Con `created_at` empatado decide
 * el `id`: sin el, dos altas del mismo nombre y unidad podrian colgar su lote de productos
 * distintos.
 *
 * `presentationId === null` (solo MACHINE, 2026-09-23): no hay unidad; se busca el vivo
 * con el mismo nombre y `unit_id` NULL.
 */
export async function findAliveIdByNameInPresentationUnit(
  name: string,
  presentationId: string | null,
  scope: InventoryScope,
): Promise<{ id: string; type: ProductType } | null> {
  let unitId: string | null;

  if (presentationId === null) {
    unitId = null;
  } else {
    const presentation = await prisma.presentation.findFirst({
      where: { AND: [presentationCompanyScope(scope), { id: presentationId }] },
      select: { unitId: true },
    });
    if (presentation === null) return null;
    unitId = presentation.unitId;
  }

  return findAliveIdByNameAndUnitId(name, unitId, scope);
}

/** La unidad llega ya validada por el caso de uso. Mismo desempate que la de arriba. */
export async function findAliveIdByNameInUnit(
  name: string,
  unitId: string,
  scope: InventoryScope,
): Promise<{ id: string; type: ProductType } | null> {
  return findAliveIdByNameAndUnitId(name, unitId, scope);
}

async function findAliveIdByNameAndUnitId(
  name: string,
  unitId: string | null,
  scope: InventoryScope,
): Promise<{ id: string; type: ProductType } | null> {
  const row = await prisma.product.findFirst({
    where: {
      AND: [
        productCompanyScope(scope),
        {
          nameNormalized: normalizeProductName(name),
          unitId,
          deletedAt: null,
        },
      ],
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, type: true },
  });
  return row === null ? null : { id: row.id, type: row.type as ProductType };
}

/** Mismo desempate que `findAliveIdByNameInPresentationUnit`. */
export async function findAlivePackagingByName(
  name: string,
  scope: InventoryScope,
): Promise<{ id: string; presentationId: string } | null> {
  const row = await prisma.product.findFirst({
    where: {
      AND: [
        productCompanyScope(scope),
        {
          nameNormalized: normalizeProductName(name),
          type: PRODUCT_TYPES.PACKAGING,
          presentationId: { not: null },
          deletedAt: null,
        },
      ],
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, presentationId: true },
  });
  return row?.presentationId == null ? null : { id: row.id, presentationId: row.presentationId };
}

/**
 * Suma los lotes vivos-de-empresa del producto y escribe `products.stock`. No toca
 * `product_batches`: quien la llama ya escribio el lote (o el ajuste) y su asiento antes de
 * invocarla, en la MISMA transaccion. Exportada para el consumo del pedido.
 *
 * La suma la hace Postgres en `numeric`, sobre las filas de la MISMA empresa: pasar por
 * JavaScript convertiria cada `Decimal` a un tipo intermedio antes de sumar y perderia
 * precision. Que los lotes sumados compartan unidad ya lo garantiza el disparador
 * `product_batches_check_unit`, asi que este `UPDATE` no necesita comprobarlo.
 *
 * El `UPDATE` es SQL crudo -y no `updateMany`- para no disparar el `@updatedAt` de Prisma: el
 * recalculo no debe mover `products.updated_at`.
 */
export async function recalculateProductStock(
  tx: Prisma.TransactionClient,
  productId: string,
  scope: InventoryScope,
): Promise<void> {
  const { companyId } = companyScopeColumns(scope);

  await tx.$executeRaw(Prisma.sql`
    UPDATE "products"
       SET "stock" = COALESCE((
             SELECT sum("stock")
               FROM "product_batches"
              WHERE "product_id" = ${productId}::uuid
                AND "company_id" = ${companyId}::uuid
           ), 0)
     WHERE "id" = ${productId}::uuid
       AND "company_id" = ${companyId}::uuid
  `);
}

/**
 * Solo para la carga de un lote -alta, importacion o el lote de una produccion-, con el mismo `now`
 * que su `created_at`. SQL crudo por lo mismo que `recalculateProductStock`: no mueve `updated_at`.
 */
async function markBatchLoaded(
  tx: Prisma.TransactionClient,
  productId: string,
  now: Date,
  scope: InventoryScope,
): Promise<void> {
  const { companyId } = companyScopeColumns(scope);

  await tx.$executeRaw(Prisma.sql`
    UPDATE "products"
       SET "last_batch_at" = ${now}
     WHERE "id" = ${productId}::uuid
       AND "company_id" = ${companyId}::uuid
  `);
}

/** Del texto directo a `Prisma.Decimal`: pasar por un numero del lenguaje meteria el error de la
 *  coma flotante antes de una columna `DECIMAL(14,4)`. `null` solo llega de MACHINE sin costo. */
function toBatchUnitCost(unitCost: string | null): Prisma.Decimal | null {
  return unitCost === null ? null : new Prisma.Decimal(unitCost);
}

/** `'5.0000'` -> `'-5.0000'`: la salida del consumo se guarda en negativo, como la resta de un
 *  ajuste. `quantity` llega siempre positiva -es lo que se decremento-, asi que basta anteponer
 *  el signo. */
function negateQuantity(quantity: string): string {
  return quantity.startsWith('-') ? quantity.slice(1) : `-${quantity}`;
}

/** Con `Z`: sin zona, la cadena se leeria en la hora local del servidor y la fecha podria correrse un
 *  dia al pasar a UTC. */
function toBatchExpiryDate(expiryDate: string | null): Date | null {
  return expiryDate === null ? null : new Date(`${expiryDate}T00:00:00Z`);
}

/** Con `Z`, por lo mismo que `toBatchExpiryDate`. */
function toBatchPurchaseDate(purchaseDate: string): Date {
  return new Date(`${purchaseDate}T00:00:00Z`);
}

/** Lock de dos enteros: es otro espacio de claves que el `pg_advisory_lock(bigint)` de
 *  `tests/helpers/test-database.ts`, asi que no pueden colisionar. */
const BATCH_LOT_LOCK_NAMESPACE = 81;

/** La empresa va en la clave del lock: dos empresas no se hacen cola entre si. */
const BATCH_LOT_LOCK_KEY_PREFIX = 'product_batches_lot:';

/** El maximo llega como texto: es un `numeric` sin techo, y `BigInt` lo suma sin perder precision
 *  donde `Number` redondearia a partir de 2^53. */
type BatchLotTopRow = { readonly top: string | null };

/**
 * El lote escrito a mano, tal cual y sin lock; o el siguiente de la serie numerica de la empresa.
 *
 * El lock es una sentencia aparte y va antes del `SELECT max`: en READ COMMITTED cada sentencia
 * toma su instantanea al empezar, y dentro de la misma sentencia leeria el maximo anterior al
 * commit de la otra sesion. El lock solo evita choques; la garantia es el indice unico.
 */
export async function resolveLot(
  tx: Prisma.TransactionClient,
  batch: NewProductBatch,
  scope: InventoryScope,
): Promise<string> {
  if (batch.lot !== null) return batch.lot;

  const { companyId } = companyScopeColumns(scope);

  // `$executeRaw` y no `$queryRaw`: `pg_advisory_xact_lock` devuelve `void`, y el cliente no sabe
  // deserializar una columna de ese tipo.
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(${BATCH_LOT_LOCK_NAMESPACE}::int, hashtext(${BATCH_LOT_LOCK_KEY_PREFIX + companyId}::text))`,
  );

  // `numeric` y sin cota de digitos, como el relleno de la migracion: un maximo que no cupiera en el
  // tipo dejaria la serie proponiendo siempre el mismo valor. Limite conocido: tras 60 nueves el
  // siguiente tiene 61 caracteres, y el `23514` del CHECK de largo sale sin traducir.
  const rows = await tx.$queryRaw<ReadonlyArray<BatchLotTopRow>>(Prisma.sql`
    SELECT max(("lot")::numeric)::text AS "top"
      FROM "product_batches"
     WHERE "company_id" = ${companyId}::uuid
       AND "lot" ~ '^[0-9]+$'
  `);

  const top = rows[0]?.top ?? null;
  return (BigInt(top ?? '0') + BigInt(1)).toString();
}

/**
 * `lot` llega aparte y ya resuelto, no se lee de `batch`: asi el tipo impide escribir el `null` de
 * «que lo genere el backend» en una columna NOT NULL. `createdBy`/`updatedBy` van como escalares:
 * la FK a `users` solo existe en la migracion, para que el cliente no pueda atravesar a `identity`.
 */
export function toBatchCreateData(
  productId: string,
  batch: NewProductBatch,
  lot: string,
  now: Date,
  scope: InventoryScope,
): Prisma.ProductBatchUncheckedCreateInput {
  return {
    productId,
    presentationId: batch.presentationId,
    stock: batch.stock,
    unitCost: toBatchUnitCost(batch.unitCost),
    lot,
    purchaseDate: toBatchPurchaseDate(batch.purchaseDate),
    expiryDate: toBatchExpiryDate(batch.expiryDate),
    // Que la empresa coincida con la del producto y la de la presentacion lo verifica el disparador
    // `product_batches_check_company`, no este archivo.
    ...companyScopeColumns(scope),
    createdBy: batch.createdBy,
    updatedBy: batch.createdBy,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Por el codigo `P2003` y nunca por el texto, que depende del idioma del servidor. El conector no
 * dice que FK fallo (`meta.constraint` llega `null`), pero la unica alimentada por la entrada es
 * `presentation_id`: las demas salen de un producto recien escrito o leido, de la sesion o del ambito.
 */
function isBatchForeignKeyViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';
}

/** Un `RAISE EXCEPTION` no tiene codigo `P####` propio: llega como `P2010` con el SQLSTATE en
 *  `meta.code`, o como `PrismaClientUnknownRequestError` con el codigo dentro del mensaje. */
function sqlStateOf(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta: unknown = error.meta;
    if (typeof meta === 'object' && meta !== null && 'code' in meta) {
      const code: unknown = (meta as { code: unknown }).code;
      if (typeof code === 'string') return code;
    }
    return error.code;
  }
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    const match = /\bcode:\s*"(\d{5})"/.exec(error.message);
    if (match !== null) return match[1] as string;
  }
  return null;
}

/** El texto del error, incluido lo que trae `meta.message`, donde Postgres deja el nombre de la
 *  restriccion violada. */
function violationMessageOf(error: unknown): string {
  const meta: unknown = error instanceof Prisma.PrismaClientKnownRequestError ? error.meta : null;
  const detalle =
    typeof meta === 'object' && meta !== null && 'message' in meta
      ? String((meta as { message: unknown }).message)
      : '';
  const bruto = error instanceof Error ? error.message : '';
  return `${detalle}\n${bruto}`;
}

/** Identificadores que escribe el propio `RAISE EXCEPTION` del disparador, no texto que Postgres
 *  traduzca: buscarlos no es decidir por el mensaje. */
const BATCH_COMPANY_SCOPE_VIOLATIONS = [
  'product_batches_company_differs_from_product',
  'product_batches_company_differs_from_presentation',
] as const;

/** Ademas del `23514` hace falta el nombre: los CHECK de `stock` y `unit_cost` dan el mismo
 *  SQLSTATE y no son entrada que no encaja. */
function isBatchCompanyScopeViolation(error: unknown): boolean {
  if (sqlStateOf(error) !== '23514') return false;
  return BATCH_COMPANY_SCOPE_VIOLATIONS.some((nombre) => violationMessageOf(error).includes(nombre));
}

const BATCH_STOCK_NON_NEGATIVE_CONSTRAINT = 'product_batches_stock_non_negative';

/** Mismo criterio que `isBatchCompanyScopeViolation`: `23514` mas el nombre de la restriccion. */
function isBatchStockNegativeViolation(error: unknown): boolean {
  if (sqlStateOf(error) !== '23514') return false;
  return violationMessageOf(error).includes(BATCH_STOCK_NON_NEGATIVE_CONSTRAINT);
}

const BATCH_UNIT_MISMATCH_TRIGGER = 'product_batches_unit_differs_from_product';

/** Disparador de `product_batches_check_unit`: mismo criterio, `23514` mas el nombre. Solo puede
 *  llegar por la aplicacion en carrera con un cambio de unidad de la presentacion. */
function isBatchUnitMismatchViolation(error: unknown): boolean {
  if (sqlStateOf(error) !== '23514') return false;
  return violationMessageOf(error).includes(BATCH_UNIT_MISMATCH_TRIGGER);
}

const BATCH_PRODUCT_WITHOUT_UNIT_TRIGGER = 'product_batches_product_without_unit';

/** Mismo disparador y mismo criterio. El caso de uso escribe la unidad antes que el lote: solo
 *  llega por un fallo de programacion o una escritura que no pasa por el. */
function isBatchProductWithoutUnitViolation(error: unknown): boolean {
  if (sqlStateOf(error) !== '23514') return false;
  return violationMessageOf(error).includes(BATCH_PRODUCT_WITHOUT_UNIT_TRIGGER);
}

/** Lo que no se sabe traducir se relanza: un CHECK violado o una caida de conexion no son entrada
 *  invalida. */
function translateBatchWriteError(error: unknown): never {
  if (isBatchForeignKeyViolation(error)) throw new ValidationError();
  if (isBatchCompanyScopeViolation(error)) throw new ValidationError();
  if (isBatchUnitMismatchViolation(error)) throw new ValidationError();
  if (isBatchProductWithoutUnitViolation(error)) throw new ValidationError();
  throw error;
}

/** Por columnas y no por el nombre del indice: con esta version de Prisma, `meta.target` trae las
 *  columnas (igual que en `unit-write-prisma.ts`). Un conjunto por indice parcial: con presentacion
 *  y sin ella. */
const BATCH_LOT_UNIQUE_COLUMN_SETS: readonly ReadonlySet<string>[] = [
  new Set(['company_id', 'product_id', 'presentation_id', 'lot']),
  new Set(['company_id', 'product_id', 'lot']),
];

function uniqueTargetsOf(error: Prisma.PrismaClientKnownRequestError): readonly string[] {
  const target: unknown = error.meta?.target;
  if (typeof target === 'string') return [target];
  if (Array.isArray(target)) return target.filter((item): item is string => typeof item === 'string');
  return [];
}

/** Conjunto exacto y no «contiene»: un indice unico nuevo sin mapear no debe anunciarse como lote
 *  duplicado. */
export function isDuplicateBatchLot(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const targets = new Set(uniqueTargetsOf(error));
  return BATCH_LOT_UNIQUE_COLUMN_SETS.some(
    (columns) => targets.size === columns.size && [...columns].every((column) => targets.has(column)),
  );
}

/** Acotado: el lock ya evita el choque, y uno que se repite no es mala suerte. */
const BATCH_LOT_MAX_ATTEMPTS = 3;

type BatchLotAttemptLog = { lastLot: string | null };

/**
 * El reintento va fuera de `prisma.$transaction`: una transaccion abortada no admite mas sentencias,
 * y cada vuelta abre una nueva que vuelve a pedir el lock y a leer el maximo. El `catch` tambien va
 * fuera: dentro del callback consumiria el error y se comitearia lo ya escrito. Solo se reintenta el
 * lote generado; uno escrito a mano chocaria igual en cada intento.
 */
async function writeBatchWithLotRetry<T>(
  batch: NewProductBatch,
  scope: InventoryScope,
  write: (tx: Prisma.TransactionClient, resolveBatchLot: () => Promise<string>) => Promise<T>,
): Promise<T> {
  const { companyId } = companyScopeColumns(scope);
  const attemptLog: BatchLotAttemptLog = { lastLot: null };
  let lastCollision: unknown = null;

  for (let attempt = 1; attempt <= BATCH_LOT_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction((tx) =>
        write(tx, async () => {
          const lot = await resolveLot(tx, batch, scope);
          attemptLog.lastLot = lot;
          return lot;
        }),
      );
    } catch (error) {
      if (!isDuplicateBatchLot(error)) translateBatchWriteError(error);
      if (batch.lot !== null) {
        // El diagnostico acaba en el log del servidor, nunca en el navegador.
        throw new BatchDuplicateLotError(`empresa ${companyId}, lote escrito a mano '${batch.lot}'`);
      }
      lastCollision = error;
    }
  }

  throw new Error(
    `no se pudo escribir un lote generado sin chocar con la unicidad del lote: empresa ${companyId}, ultimo lote intentado '${attemptLog.lastLot ?? '(sin resolver)'}', ${BATCH_LOT_MAX_ATTEMPTS} intentos`,
    { cause: lastCollision },
  );
}

/**
 * Producto y lote en la misma transaccion: si el lote falla, el producto tampoco queda. La
 * unidad del producto sale, por este orden, del envase, de `product.unitId` o de la presentacion
 * del lote -sin fila viva de la empresa, se aborta con `ValidationError` antes de escribir nada-;
 * sin ninguna de las tres, nace sin unidad. Su existencia queda recalculada al final.
 */
export async function createWithFirstBatch(
  product: NewProduct,
  batch: NewProductBatch,
  now: Date,
  scope: InventoryScope,
  packaging?: PackagingIdentity,
): Promise<{ id: string; batchId: string; lot: string }> {
  return writeBatchWithLotRetry(batch, scope, async (tx, resolveBatchLot) => {
    let unitId: string | null = null;
    if (packaging !== undefined) {
      const presentation = await tx.presentation.findFirst({
        where: { AND: [presentationCompanyScope(scope), { id: packaging.presentationId }] },
        select: { id: true },
      });
      if (presentation === null) throw new ValidationError();
      unitId = packaging.unitId;
    } else if (product.unitId !== undefined) {
      unitId = product.unitId;
    } else if (batch.presentationId !== null) {
      const presentation = await tx.presentation.findFirst({
        where: { AND: [presentationCompanyScope(scope), { id: batch.presentationId }] },
        select: { unitId: true },
      });
      if (presentation === null) throw new ValidationError();
      unitId = presentation.unitId;
    }

    const created = await tx.product.create({
      data: {
        name: product.name,
        nameNormalized: normalizeProductName(product.name),
        unitId,
        qtyAlert: product.qtyAlert ?? null,
        type: product.type ?? PRODUCT_TYPES.PRODUCT,
        presentationId: packaging?.presentationId ?? null,
        imagePath: product.imagePath ?? null,
        ...companyScopeColumns(scope),
        createdAt: now,
        updatedAt: now,
        lastBatchAt: now,
      },
      select: { id: true },
    });

    const lot = await resolveBatchLot();

    const createdBatch = await tx.productBatch.create({
      data: toBatchCreateData(created.id, batch, lot, now, scope),
      select: { id: true },
    });

    await writeMovement(
      tx,
      {
        batchId: createdBatch.id,
        kind: 'opening',
        quantity: batch.stock,
        reason: null,
        orderId: null,
        orderPresentationLineId: null,
        createdBy: batch.createdBy,
      },
      now,
      scope,
    );

    await recalculateProductStock(tx, created.id, scope);

    return { id: created.id, batchId: createdBatch.id, lot };
  });
}

type AliveProductRow = { readonly id: string; readonly type: string; readonly presentationId: string | null };

/** Con `productId` escalar y no como escritura anidada desde `product`, que dispararia el
 *  `@updatedAt` de `products`. */
export async function addBatchToAlive(
  productId: string,
  batch: NewProductBatch,
  now: Date,
  scope: InventoryScope,
  packaging?: { readonly presentationId: string },
): Promise<{ batchId: string; lot: string } | null | 'finished_product'> {
  const { companyId } = companyScopeColumns(scope);

  return writeBatchWithLotRetry(batch, scope, async (tx, resolveBatchLot) => {
    // El borrado logico toma este mismo lock sobre la fila, asi que uno espera al otro. En READ
    // COMMITTED, el SELECT que espera vuelve a evaluar el WHERE y ya no ve la fila borrada.
    const rows = await tx.$queryRaw<ReadonlyArray<AliveProductRow>>(Prisma.sql`
      SELECT "id", "type", "presentation_id" AS "presentationId"
        FROM "products"
       WHERE "id" = ${productId}::uuid
         AND "company_id" = ${companyId}::uuid
         AND "deleted_at" IS NULL
         FOR NO KEY UPDATE
    `);
    const alive = rows[0];
    if (alive === undefined) return null;

    // Un envase con presentacion fija solo admite lotes sin presentacion y por su misma presentacion.
    const isFixedPackaging = alive.type === PRODUCT_TYPES.PACKAGING && alive.presentationId !== null;
    if (packaging !== undefined ? !isFixedPackaging || alive.presentationId !== packaging.presentationId : isFixedPackaging) {
      throw new ActionNotAllowedError();
    }

    // Bajo la misma fila bloqueada, cierra la carrera con un alta manual que naciera
    // terminado despues de que `findAliveIdByNameInPresentationUnit` ya lo hubiera leido.
    if (alive.type === PRODUCT_TYPES.FINISHED_PRODUCT) return 'finished_product';

    // Despues de la fila: un alta que no va a escribir no pide el lock de aviso. Y con la fila ya
    // tomada arriba, esta funcion pide siempre los dos locks en ese orden: fila y luego aviso.
    const lot = await resolveBatchLot();

    const createdBatch = await tx.productBatch.create({
      data: toBatchCreateData(alive.id, batch, lot, now, scope),
      select: { id: true },
    });

    await writeMovement(
      tx,
      {
        batchId: createdBatch.id,
        kind: 'opening',
        quantity: batch.stock,
        reason: null,
        orderId: null,
        orderPresentationLineId: null,
        createdBy: batch.createdBy,
      },
      now,
      scope,
    );

    await recalculateProductStock(tx, alive.id, scope);
    await markBatchLoaded(tx, alive.id, now, scope);

    return { batchId: createdBatch.id, lot };
  });
}

const BATCH_VIEW_SELECT = {
  id: true,
  lot: true,
  stock: true,
  purchaseDate: true,
  expiryDate: true,
  packageContent: true,
  unitCost: true,
  // La del producto y no la de la presentacion: los lotes de insumo ya no llevan presentacion, y
  // los que la llevan estan en la misma unidad que su producto.
  product: { select: { unitId: true } },
} satisfies Prisma.ProductBatchSelect;

type BatchViewRow = Prisma.ProductBatchGetPayload<{ select: typeof BATCH_VIEW_SELECT }>;

/** Fecha civil, sin hora: la columna es `@db.Date` y las tres cifras del ISO bastan. */
function toCivilDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toBatchView(row: BatchViewRow): ProductBatchView {
  return {
    id: row.id,
    lot: row.lot,
    stock: row.stock.toFixed(4),
    unitId: row.product.unitId,
    purchaseDate: toCivilDate(row.purchaseDate),
    expiryDate: row.expiryDate === null ? null : toCivilDate(row.expiryDate),
    packageContent: row.packageContent === null ? null : row.packageContent.toFixed(4),
    unitCost: row.unitCost === null ? null : row.unitCost.toFixed(4),
  };
}

/** Todos los lotes del producto, siempre que el producto siga vivo: un producto borrado o ajeno
 *  devuelve un array vacio, no una excepcion. */
export async function findBatchesOfAliveProduct(
  productId: string,
  scope: InventoryScope,
): Promise<readonly ProductBatchView[]> {
  const rows = await prisma.productBatch.findMany({
    where: {
      AND: [batchCompanyScope(scope), { productId, product: { deletedAt: null } }],
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: BATCH_VIEW_SELECT,
  });

  // UNA consulta agregada para todos los lotes del producto, no una por lote.
  const reservedByBatch = await findReservedAndAvailableByBatch(
    prisma,
    scope.companyId,
    rows.map((row) => row.id),
  );
  return rows.map((row) => {
    const aggregate = reservedByBatch.get(row.id);
    return {
      ...toBatchView(row),
      reserved: aggregate?.reserved ?? ZERO_QUANTITY,
      available: aggregate?.available ?? row.stock.toFixed(4),
      overReserved: aggregate?.overReserved ?? false,
    };
  });
}

/** Lotes que entraron por el asiento `production` del pedido. El ambito va en el lote y en el
 *  asiento: un `orderId` de otra empresa no encuentra ninguno de los dos. Con `orderId` `null`,
 *  los lotes sin asiento `production`, y entonces solo los de `productId`. */
export async function findBatchesOfOrder(
  orderId: string | null,
  scope: InventoryScope,
  productId: string | null = null,
): Promise<readonly ProductBatchView[]> {
  if (orderId === null && productId === null) return [];
  const production = { AND: [movementCompanyScope(scope), { kind: 'production' as const }] };
  const rows = await prisma.productBatch.findMany({
    where: {
      AND: [
        batchCompanyScope(scope),
        {
          ...(productId === null ? {} : { productId }),
          product: { deletedAt: null },
          movements:
            orderId === null
              ? { none: production }
              : { some: { AND: [movementCompanyScope(scope), { kind: 'production', orderId }] } },
        },
      ],
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { ...BATCH_VIEW_SELECT, presentation: { select: { name: true } } },
  });

  const reservedByBatch = await findReservedAndAvailableByBatch(
    prisma,
    scope.companyId,
    rows.map((row) => row.id),
  );
  return rows.map((row) => {
    const aggregate = reservedByBatch.get(row.id);
    return {
      ...toBatchView(row),
      presentationName: row.presentation?.name ?? null,
      reserved: aggregate?.reserved ?? ZERO_QUANTITY,
      available: aggregate?.available ?? row.stock.toFixed(4),
      overReserved: aggregate?.overReserved ?? false,
    };
  });
}

/** `P2025`: el `where` unico mas el filtro de empresa no encontraron fila que actualizar. */
function isBatchNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

type AdjustProductRow = {
  readonly id: string;
  readonly type: string;
  readonly presentationId: string | null;
  readonly batchStock: string;
};

/**
 * Producto y lote se bloquean en una sola sentencia, el producto primero -mismo orden que
 * `addBatchToAlive`-, para que el ajuste se serialice con el alta y el consumo sin abrir un orden
 * de bloqueo nuevo. Con el lote ya bloqueado, la existencia leida es la que habra al escribir: si
 * no es la que vio el usuario, se devuelve `stock_changed` sin tocar nada, y dos ajustes simultaneos
 * con la misma vista no pueden aplicarse los dos.
 *
 * `stock: { increment: difference }` sigue siendo un `UPDATE` relativo, y `productBatch.update` es
 * la UNICA funcion del repositorio que escribe sobre una fila de lote ya existente -el `where`
 * combina el identificador con la empresa, y sin fila Prisma lanza `P2025` en vez de tocar una
 * ajena-. El asiento y el recalculo de `products.stock` quedan en la MISMA transaccion.
 */
export async function adjustBatchStock(
  adjustment: BatchStockAdjustment,
  actorId: string,
  now: Date,
  scope: InventoryScope,
): Promise<AdjustBatchStockOutcome> {
  const { companyId } = companyScopeColumns(scope);
  const { batchId, countedStock, seenStock, reason } = adjustment;

  try {
    return await prisma.$transaction(async (tx): Promise<AdjustBatchStockOutcome> => {
      const rows = await tx.$queryRaw<ReadonlyArray<AdjustProductRow>>(Prisma.sql`
        SELECT p."id", p."type", p."presentation_id" AS "presentationId", b."stock"::text AS "batchStock"
          FROM "products" p
          JOIN "product_batches" b ON b."product_id" = p."id"
         WHERE b."id" = ${batchId}::uuid
           AND b."company_id" = ${companyId}::uuid
         FOR NO KEY UPDATE OF p, b
      `);
      const product = rows[0];
      if (product === undefined) return { kind: 'batch_not_found' };

      // Antes que las reglas de terminado y envase: con otra existencia el sentido puede ser otro.
      if (compareQuantities(product.batchStock, seenStock) !== 0) {
        return { kind: 'stock_changed', currentStock: new Prisma.Decimal(product.batchStock).toFixed(4) };
      }

      const difference = subtractQuantities(countedStock, product.batchStock);

      if (product.type === PRODUCT_TYPES.FINISHED_PRODUCT && compareQuantities(difference, '0') > 0) {
        return { kind: 'increase_not_allowed' };
      }

      if (product.type === PRODUCT_TYPES.PACKAGING && product.presentationId !== null && !isWholeQuantity(countedStock)) {
        throw new ValidationError('countedStock: un envase se cuenta en envases enteros');
      }

      const updated = await tx.productBatch.update({
        where: { id: batchId, companyId },
        data: { stock: { increment: new Prisma.Decimal(difference) }, updatedBy: actorId, updatedAt: now },
        select: { stock: true },
      });

      const previousStock = new Prisma.Decimal(product.batchStock).toFixed(4);

      await writeMovement(
        tx,
        {
          batchId,
          kind: 'adjustment',
          quantity: difference,
          reason,
          orderId: null,
          orderPresentationLineId: null,
          createdBy: actorId,
          previousStock,
          countedStock,
        },
        now,
        scope,
      );

      await recalculateProductStock(tx, product.id, scope);

      // El apartado no lo escribe este archivo -es un libro aparte, `reservation_movements`,
      // dueno de `reservation-prisma.ts`-, pero un ajuste tiene que poder decir si deja el lote
      // sobre-reservado, y las dos tablas estan en la misma transaccion.
      const reservationRows = await tx.reservationMovement.findMany({
        where: { companyId, batchId },
        select: { kind: true, quantity: true },
      });
      const reserved = netReservedQuantity(
        reservationRows.map((row) => ({ kind: row.kind, quantity: row.quantity.toFixed(4) })),
      );
      const stock = updated.stock.toFixed(4);

      return {
        kind: 'adjusted',
        previousStock,
        difference,
        stock,
        reserved,
        overReserved: compareQuantities(reserved, stock) > 0,
      };
    });
  } catch (error) {
    if (isBatchNotFound(error)) return { kind: 'batch_not_found' };
    if (isBatchStockNegativeViolation(error)) throw new BatchStockNegativeError();
    throw error;
  }
}

/**
 * El decremento CONDICIONAL del consumo al entregar: `stock >= quantity` va
 * en el `WHERE`, asi que dos escrituras concurrentes nunca dejan el lote negativo aunque las dos
 * pasen el mismo bloqueo de producto. `count === 0` no dice POR QUE fallo -lote de otra empresa,
 * inexistente o con menos de lo pedido-, y con el producto ya bloqueado por quien llama la unica
 * causa posible es la merma: por eso se resuelve leyendo el `stock` actual, sin lanzar.
 *
 * Como `adjustBatchStock`, asienta en la MISMA transaccion con `kind: 'consumption'`, cantidad EN
 * NEGATIVO -es una salida- y el pedido que la causa. No recalcula `products.stock`: con varios
 * lotes de un mismo producto consumidos en la misma entrega, recalcular una vez por producto (en
 * `consumeForOrder`) evita sumar la misma tabla varias veces por nada.
 */
export async function consumeBatchStock(
  tx: Prisma.TransactionClient,
  input: { readonly batchId: string; readonly quantity: string; readonly orderId: string; readonly actorId: string },
  now: Date,
  scope: InventoryScope,
): Promise<{ kind: 'consumed'; stock: string } | { kind: 'insufficient'; available: string }> {
  const { companyId } = companyScopeColumns(scope);
  const decimalQuantity = new Prisma.Decimal(input.quantity);

  const { count } = await tx.productBatch.updateMany({
    where: { id: input.batchId, companyId, stock: { gte: decimalQuantity } },
    data: { stock: { decrement: decimalQuantity }, updatedBy: input.actorId, updatedAt: now },
  });

  if (count === 0) {
    const current = await tx.productBatch.findFirst({
      where: { id: input.batchId, companyId },
      select: { stock: true },
    });
    return { kind: 'insufficient', available: current === null ? '0.0000' : current.stock.toFixed(4) };
  }

  await writeMovement(
    tx,
    {
      batchId: input.batchId,
      kind: 'consumption',
      quantity: negateQuantity(input.quantity),
      reason: null,
      orderId: input.orderId,
      orderPresentationLineId: null,
      createdBy: input.actorId,
    },
    now,
    scope,
  );

  const updated = await tx.productBatch.findFirst({
    where: { id: input.batchId, companyId },
    select: { stock: true },
  });
  return { kind: 'consumed', stock: (updated?.stock ?? new Prisma.Decimal(0)).toFixed(4) };
}

type PresentationForShareRow = { readonly name: string; readonly unitId: string; readonly content: string | null };

/**
 * La entrada de un lote de produccion al Terminar el empaque, por UNA linea del reparto:
 * presentacion `FOR SHARE`, producto terminado (nace si falta, `ON CONFLICT ...
 * DO NOTHING` sobre el indice parcial de la combinacion), lote, asiento `production` -con
 * `order_id` Y `order_presentation_line_id`-, recalculo y `last_batch_at` con el mismo `now` que el
 * lote (cuenta como lote cargado, como un alta), todo sobre la MISMA transaccion que
 * el resto de Terminar -no abre la suya, a diferencia de `createWithFirstBatch`-. `unitCost` ya
 * llega resuelto: el mismo para todas las lineas de un pedido, no se recalcula aqui.
 */
export async function receiveFinishedGoods(
  tx: Prisma.TransactionClient,
  input: {
    readonly orderId: string;
    readonly recipeId: string;
    readonly recipeName: string;
    readonly presentationId: string;
    readonly orderPresentationLineId: string;
    readonly packages: number;
    readonly orderContent: string | null;
    readonly unitCost: string;
    readonly actorId: string;
    readonly now: Date;
  },
  scope: InventoryScope,
): Promise<FinishedGoodsOutcome> {
  const { companyId } = companyScopeColumns(scope);

  const presentationRows = await tx.$queryRaw<ReadonlyArray<PresentationForShareRow>>(Prisma.sql`
    SELECT "name", "unit_id" AS "unitId", "content"::text AS "content"
      FROM "presentations"
     WHERE "id" = ${input.presentationId}::uuid
       AND "company_id" = ${companyId}::uuid
       FOR SHARE
  `);
  const presentation = presentationRows[0];
  if (presentation === undefined) return { kind: 'presentation_without_content' };

  const content = input.orderContent ?? presentation.content;
  if (content === null) return { kind: 'presentation_without_content' };

  const plan = planFinishedGoodsLine({ packages: input.packages, content, unitCost: input.unitCost });
  if (plan.kind === 'no_content') return { kind: 'presentation_without_content' };

  const name = `${input.recipeName} · ${presentation.name}`;
  // El arbitro de `ON CONFLICT ... WHERE` lo resuelve Postgres en el analisis de la sentencia,
  // antes de que un parametro tenga valor: esa clausula necesita el texto tal cual, no un bind.
  const finishedProductTypeSql = Prisma.raw(`'${PRODUCT_TYPES.FINISHED_PRODUCT}'`);
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "products"
      ("name", "name_normalized", "type", "unit_id", "company_id", "recipe_id", "presentation_id", "created_at", "updated_at")
    VALUES
      (${name}, ${normalizeProductName(name)}, ${PRODUCT_TYPES.FINISHED_PRODUCT}::"ProductType", ${presentation.unitId}::uuid, ${companyId}::uuid,
       ${input.recipeId}::uuid, ${input.presentationId}::uuid, ${input.now}, ${input.now})
    ON CONFLICT (company_id, recipe_id, presentation_id) WHERE type = ${finishedProductTypeSql} AND deleted_at IS NULL
    DO NOTHING
  `);

  const productRows = await tx.$queryRaw<ReadonlyArray<{ id: string; name: string }>>(Prisma.sql`
    SELECT "id", "name"
      FROM "products"
     WHERE "company_id" = ${companyId}::uuid
       AND "recipe_id" = ${input.recipeId}::uuid
       AND "presentation_id" = ${input.presentationId}::uuid
       AND "type" = ${PRODUCT_TYPES.FINISHED_PRODUCT}::"ProductType"
       AND "deleted_at" IS NULL
       FOR NO KEY UPDATE
  `);
  const product = productRows[0];
  if (product === undefined) {
    throw new Error('receiveFinishedGoods: el producto terminado no aparecio tras el INSERT ON CONFLICT');
  }

  const batch: NewProductBatch = {
    presentationId: input.presentationId,
    stock: plan.quantity,
    unitCost: input.unitCost,
    lot: null,
    purchaseDate: toCivilDate(input.now),
    expiryDate: null,
    createdBy: input.actorId,
  };
  const lot = await resolveLot(tx, batch, scope);

  const createdBatch = await tx.productBatch.create({
    data: {
      ...toBatchCreateData(product.id, batch, lot, input.now, scope),
      packageContent: new Prisma.Decimal(content),
    },
    select: { id: true },
  });

  await writeMovement(
    tx,
    {
      batchId: createdBatch.id,
      kind: 'production',
      quantity: plan.quantity,
      reason: null,
      orderId: input.orderId,
      orderPresentationLineId: input.orderPresentationLineId,
      createdBy: input.actorId,
    },
    input.now,
    scope,
  );

  await recalculateProductStock(tx, product.id, scope);
  await markBatchLoaded(tx, product.id, input.now, scope);

  return { kind: 'received', productId: product.id, productName: product.name, packages: input.packages.toString() };
}

/**
 * La salida de producto terminado hacia un cliente, para UNA combinacion receta-presentacion, sobre
 * la MISMA transaccion de quien llama: bloquea el producto terminado vivo (`FOR NO KEY UPDATE`,
 * como la entrada), lee los lotes pedidos -de ese producto, de la empresa y con contenido de
 * envase-, y por cada lote hace el decremento CONDICIONAL (`stock >= cantidad` en el `where`, como
 * `consumeBatchStock`) de la suma de sus asignaciones y un asiento `delivery` en negativo. Recalcula
 * `products.stock` una sola vez, al final. Devuelve una linea por asignacion, en el orden de entrada.
 *
 * No lanza por un lote ausente o corto: lo devuelve, y quien llama deshace la transaccion entera.
 * Un lote de otra empresa, de otro producto o sin contenido sale igual que uno que no existe.
 */
export async function dispatchFinishedGoods(
  tx: Prisma.TransactionClient,
  input: {
    readonly orderId: string;
    readonly orderDeliveryId: string;
    readonly recipeId: string;
    readonly presentationId: string;
    readonly allocations: readonly { readonly batchId: string; readonly packages: number }[];
    readonly actorId: string;
    readonly now: Date;
  },
  scope: InventoryScope,
): Promise<FinishedGoodsDispatchOutcome> {
  const { companyId } = companyScopeColumns(scope);
  const firstAllocation = input.allocations[0];
  if (firstAllocation === undefined) return { kind: 'dispatched', lines: [] };

  const productRows = await tx.$queryRaw<ReadonlyArray<{ id: string }>>(Prisma.sql`
    SELECT "id"
      FROM "products"
     WHERE "company_id" = ${companyId}::uuid
       AND "recipe_id" = ${input.recipeId}::uuid
       AND "presentation_id" = ${input.presentationId}::uuid
       AND "type" = ${PRODUCT_TYPES.FINISHED_PRODUCT}::"ProductType"
       AND "deleted_at" IS NULL
       FOR NO KEY UPDATE
  `);
  const product = productRows[0];
  if (product === undefined) return { kind: 'batch_not_found', batchId: firstAllocation.batchId };

  const packagesByBatch = new Map<string, number>();
  for (const allocation of input.allocations) {
    packagesByBatch.set(allocation.batchId, (packagesByBatch.get(allocation.batchId) ?? 0) + allocation.packages);
  }

  const batchRows = await tx.productBatch.findMany({
    where: {
      AND: [
        batchCompanyScope(scope),
        {
          id: { in: [...packagesByBatch.keys()] },
          productId: product.id,
          packageContent: { not: null },
        },
      ],
    },
    select: { id: true, packageContent: true },
  });
  const contentByBatch = new Map<string, string>();
  for (const row of batchRows) {
    if (row.packageContent !== null) contentByBatch.set(row.id, row.packageContent.toFixed(4));
  }
  const missing = input.allocations.find((allocation) => !contentByBatch.has(allocation.batchId));
  if (missing !== undefined) return { kind: 'batch_not_found', batchId: missing.batchId };

  // Un decremento y un asiento por lote aunque varias asignaciones lo repitan: el indice unico del
  // libro por (entrega, lote) no admite dos asientos, y el asiento es el movimiento fisico del lote.
  for (const [batchId, packages] of packagesByBatch) {
    const packageContent = contentByBatch.get(batchId);
    if (packageContent === undefined) return { kind: 'batch_not_found', batchId };
    const quantity = quantityForPackages(packages, packageContent);
    const decimalQuantity = new Prisma.Decimal(quantity);

    const { count } = await tx.productBatch.updateMany({
      where: {
        AND: [batchCompanyScope(scope), { id: batchId, productId: product.id, stock: { gte: decimalQuantity } }],
      },
      data: { stock: { decrement: decimalQuantity }, updatedBy: input.actorId, updatedAt: input.now },
    });

    if (count === 0) {
      const current = await tx.productBatch.findFirst({
        where: { AND: [batchCompanyScope(scope), { id: batchId }] },
        select: { stock: true },
      });
      const stock = current === null ? ZERO_QUANTITY : current.stock.toFixed(4);
      return { kind: 'insufficient', batchId, availablePackages: wholePackagesIn(stock, packageContent) };
    }

    await writeMovement(
      tx,
      {
        batchId,
        kind: 'delivery',
        quantity: negateQuantity(quantity),
        reason: null,
        orderId: input.orderId,
        orderPresentationLineId: null,
        orderDeliveryId: input.orderDeliveryId,
        createdBy: input.actorId,
      },
      input.now,
      scope,
    );
  }

  await recalculateProductStock(tx, product.id, scope);

  // Misma multiplicacion exacta que el asiento: la suma de las lineas de un lote es su asiento.
  const lines = input.allocations.map((allocation) => ({
    batchId: allocation.batchId,
    packages: allocation.packages,
    quantity: quantityForPackages(allocation.packages, contentByBatch.get(allocation.batchId) ?? ZERO_QUANTITY),
  }));

  return { kind: 'dispatched', lines };
}

/**
 * La vuelta al lote de lo que salio en una entrega anulada, sobre la MISMA transaccion de quien
 * llama. Los productos se bloquean ordenados por `id` para que dos devoluciones concurrentes no se
 * crucen, y sin mirar `deleted_at`: un producto dado de baja tambien recupera su existencia. El
 * incremento no es condicional porque sumar no puede dejar el lote en negativo.
 *
 * No lanza por un lote ausente o de otra empresa: lo devuelve, y quien llama deshace todo.
 */
export async function returnFinishedGoods(
  tx: Prisma.TransactionClient,
  input: {
    readonly orderId: string;
    readonly orderDeliveryVoidId: string;
    readonly lines: readonly { readonly batchId: string; readonly quantity: string }[];
    readonly actorId: string;
    readonly now: Date;
  },
  scope: InventoryScope,
): Promise<FinishedGoodsReturnOutcome> {
  const { companyId } = companyScopeColumns(scope);
  if (input.lines.length === 0) return { kind: 'returned' };

  const batchRows = await tx.productBatch.findMany({
    where: { AND: [batchCompanyScope(scope), { id: { in: input.lines.map((line) => line.batchId) } }] },
    select: { id: true, productId: true },
  });
  const productByBatch = new Map(batchRows.map((row) => [row.id, row.productId]));
  const missing = input.lines.find((line) => !productByBatch.has(line.batchId));
  if (missing !== undefined) return { kind: 'batch_not_found', batchId: missing.batchId };

  const productIds = [...new Set(productByBatch.values())].sort();
  await tx.$queryRaw(Prisma.sql`
    SELECT "id"
      FROM "products"
     WHERE "company_id" = ${companyId}::uuid
       AND "id" IN (${Prisma.join(productIds.map((id) => Prisma.sql`${id}::uuid`))})
     ORDER BY "id"
       FOR NO KEY UPDATE
  `);

  // Un incremento y un asiento por lote: el indice unico del libro por (anulacion, lote) no admite dos.
  const quantityByBatch = new Map<string, string>();
  for (const line of input.lines) {
    quantityByBatch.set(line.batchId, addQuantities(quantityByBatch.get(line.batchId) ?? ZERO_QUANTITY, line.quantity));
  }

  for (const [batchId, quantity] of quantityByBatch) {
    await tx.productBatch.update({
      where: { id: batchId, companyId },
      data: { stock: { increment: new Prisma.Decimal(quantity) }, updatedBy: input.actorId, updatedAt: input.now },
      select: { id: true },
    });

    await writeMovement(
      tx,
      {
        batchId,
        kind: 'delivery_void',
        quantity,
        reason: null,
        orderId: input.orderId,
        orderPresentationLineId: null,
        orderDeliveryVoidId: input.orderDeliveryVoidId,
        createdBy: input.actorId,
      },
      input.now,
      scope,
    );
  }

  for (const productId of productIds) {
    await recalculateProductStock(tx, productId, scope);
  }

  return { kind: 'returned' };
}

/** Lote de producto terminado que entra por importacion: asiento `opening`, no `production`,
 *  porque no sale de ningun pedido. El producto ya debe existir y estar fijado en `tx`. */
export async function addImportedFinishedGoodsBatch(
  tx: Prisma.TransactionClient,
  productId: string,
  batch: NewProductBatch,
  packageContent: string,
  now: Date,
  scope: InventoryScope,
): Promise<{ batchId: string; lot: string }> {
  const lot = await resolveLot(tx, batch, scope);

  const createdBatch = await tx.productBatch.create({
    data: {
      ...toBatchCreateData(productId, batch, lot, now, scope),
      packageContent: new Prisma.Decimal(packageContent),
    },
    select: { id: true },
  });

  await writeMovement(
    tx,
    {
      batchId: createdBatch.id,
      kind: 'opening',
      quantity: batch.stock,
      reason: null,
      orderId: null,
      orderPresentationLineId: null,
      createdBy: batch.createdBy,
    },
    now,
    scope,
  );

  await recalculateProductStock(tx, productId, scope);
  await markBatchLoaded(tx, productId, now, scope);

  return { batchId: createdBatch.id, lot };
}

/** `quantity / packageContent`, como entero: `receiveFinishedGoods` siempre escribe la cantidad
 *  del asiento `production` como un multiplo exacto del contenido del lote (`planFinishedGoodsLine`),
 *  asi que la division nunca deja resto. */
function packagesFromReceipt(quantity: Prisma.Decimal, packageContent: Prisma.Decimal): string {
  const scaledQuantity = BigInt(quantity.toFixed(4).replace('.', ''));
  const scaledContent = BigInt(packageContent.toFixed(4).replace('.', ''));
  return (scaledQuantity / scaledContent).toString();
}

/**
 * La consulta real. Vive aparte de `findFinishedGoodsReceipts` por el mismo motivo que
 * `findAliveProducts`: declara el `scope` como `InventoryScope` y lo lleva hasta
 * `movementCompanyScope`, el punto unico del modulo.
 */
async function findProductionMovements(
  orderIds: readonly string[],
  scope: InventoryScope,
): Promise<
  readonly { readonly orderId: string | null; readonly quantity: Prisma.Decimal; readonly batch: { readonly packageContent: Prisma.Decimal | null } }[]
> {
  return prisma.inventoryMovement.findMany({
    where: {
      AND: [movementCompanyScope(scope), { kind: 'production', orderId: { in: [...orderIds] } }],
    },
    select: { orderId: true, quantity: true, batch: { select: { packageContent: true } } },
  });
}

/**
 * Implementa `ProductCatalog['findFinishedGoodsReceipts']`: los envases que de verdad entraron
 * por cada pedido, leidos del asiento `production` -uno por pedido, porque el Finalizar solo se
 * escribe una vez- y divididos por el contenido guardado en su lote. Un `orderId` sin ese
 * asiento, con lote sin contenido de envase, o de otra empresa, simplemente no aparece en la
 * respuesta: quien compone la fila del pedido trata la ausencia como `packages: null`.
 *
 * No exige `inventario.consultar`: quien llama ya autorizo con su propio permiso. Por eso NO es
 * un caso de uso de `inventario`, sino una lectura directa que `asignaciones` compone dentro de
 * la suya.
 */
export async function findFinishedGoodsReceipts(
  orderIds: readonly string[],
  companyId: string,
): Promise<readonly { orderId: string; packages: string }[]> {
  if (orderIds.length === 0) return [];

  const rows = await findProductionMovements(orderIds, { companyId });

  return rows
    .filter(
      (row): row is typeof row & { orderId: string; batch: { packageContent: Prisma.Decimal } } =>
        row.orderId !== null && row.batch.packageContent !== null,
    )
    .map((row) => ({ orderId: row.orderId, packages: packagesFromReceipt(row.quantity, row.batch.packageContent) }));
}

/**
 * El mismo lote, vencimiento y dia de produccion en todos los lotes de produccion del pedido: los
 * de las lineas que devuelve `listOfOrder`. Cambia la etiqueta del lote, no su existencia: por eso
 * no asienta movimiento, y la trazabilidad queda en `updated_by` y `updated_at`.
 *
 * Los lotes se bloquean antes de comprobar el choque, asi que dos guardados del mismo pedido se
 * serializan. Contra otro pedido en carrera solo protege el indice unico: su `P2002` sale como
 * excepcion para que se deshaga la transaccion entera, y lo traduce quien la abrio.
 */
export async function writeFinishedBatchLabels(
  tx: Prisma.TransactionClient,
  input: {
    readonly orderId: string;
    readonly label: FinishedBatchLabel;
    readonly actorId: string;
    readonly now: Date;
  },
  scope: InventoryScope,
): Promise<FinishedBatchLabelsOutcome> {
  const { companyId } = companyScopeColumns(scope);

  const locked = await tx.$queryRaw<ReadonlyArray<{ readonly id: string }>>(Prisma.sql`
    SELECT b."id"::text AS "id"
      FROM "product_batches" b
     WHERE b."company_id" = ${companyId}::uuid
       AND b."presentation_id" IS NOT NULL
       AND EXISTS (
             SELECT 1
               FROM "inventory_movements" m
              WHERE m."batch_id" = b."id"
                AND m."company_id" = ${companyId}::uuid
                AND m."kind" = 'production'
                AND m."order_id" = ${input.orderId}::uuid
                AND m."order_presentation_line_id" IS NOT NULL
           )
     ORDER BY b."id"
       FOR UPDATE
  `);
  if (locked.length === 0) return { kind: 'no_batches' };
  const batchIds = locked.map((row) => row.id);

  // La misma regla que los dos indices unicos: `IS NOT DISTINCT FROM` iguala dos lotes sin
  // presentacion. El codigo se compara exacto, sensible a mayusculas.
  const clash = await tx.$queryRaw<ReadonlyArray<{ readonly id: string }>>(Prisma.sql`
    SELECT b."id"::text AS "id"
      FROM "product_batches" b
     WHERE b."company_id" = ${companyId}::uuid
       AND b."id" = ANY(${batchIds}::uuid[])
       AND EXISTS (
             SELECT 1
               FROM "product_batches" o
              WHERE o."company_id" = ${companyId}::uuid
                AND o."product_id" = b."product_id"
                AND o."presentation_id" IS NOT DISTINCT FROM b."presentation_id"
                AND o."lot" = ${input.label.lot}
                AND o."id" <> b."id"
           )
     ORDER BY b."id"
     LIMIT 1
  `);
  const [first] = clash;
  if (first !== undefined) return { kind: 'duplicate_lot', batchId: first.id };

  for (const id of batchIds) {
    await tx.productBatch.update({
      where: { id, companyId },
      data: {
        lot: input.label.lot,
        expiryDate: toBatchExpiryDate(input.label.expiryDate),
        productionDate: toBatchExpiryDate(input.label.productionDate),
        updatedBy: input.actorId,
        updatedAt: input.now,
      },
      select: { id: true },
    });
  }

  return { kind: 'written' };
}
