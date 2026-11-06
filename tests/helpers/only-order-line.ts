// Pedidos de una receta sembrados a mano: los tests escritos antes de las lineas describen el
// pedido con su receta, y estos helpers escriben la cabecera en `orders` y la receta en su unica
// linea; el flujo de planta opera ya sobre la linea.
import { randomUUID } from 'node:crypto';

import { Prisma, type PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import type { StoredOrderCost } from '@/lib/modules/pedidos/domain/order-cost';
import type { OrderScope } from '@/lib/modules/pedidos/domain/order-scope';
import type {
  NewOrder,
  OrderLineRow,
  OrderPresentationLineWrite,
  OrderRow,
} from '@/lib/modules/pedidos/domain/order-view';
import type { OrderWriteRepository } from '@/lib/modules/pedidos/ports/order-write-repository';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Para un INSERT crudo en una tabla hija: la linea de menor `position` del pedido. Si el pedido no
 * tiene linea (no existe), un uuid suelto, para que la base rechace por la FK y no por el NOT NULL
 * de `order_line_id`, que se comprueba antes.
 */
export function lineOfOrder(orderId: string): Prisma.Sql {
  return Prisma.sql`COALESCE(
    (SELECT "id" FROM "order_lines" WHERE "order_id" = CAST(${orderId} AS uuid) ORDER BY "position" LIMIT 1),
    gen_random_uuid()
  )`;
}

const KINDS_WITH_LINE = ['consumption', 'production', 'delivery', 'delivery_void'];

/** Para un INSERT crudo en `inventory_movements`: la linea del pedido en los cuatro tipos que la
 *  llevan, NULL en los demas, como exige su CHECK. */
export function movementLineOf(kind: string, orderId: string | null): Prisma.Sql {
  if (!KINDS_WITH_LINE.includes(kind)) return Prisma.sql`CAST(NULL AS uuid)`;
  return orderId === null ? Prisma.sql`gen_random_uuid()` : lineOfOrder(orderId);
}

/** Lo que un pedido de una receta lleva en su linea, con los nombres de las columnas de la linea. */
const LINE_FIELDS = [
  'recipeId',
  'quantity',
  'unitId',
  'ingredientsCost',
  'packagingCost',
  'actualCost',
  'salePrice',
  'reservedAt',
  'finishedAt',
  'packedBy',
  'conditionedBy',
] as const;

type LineField = (typeof LINE_FIELDS)[number];
type LineData = Pick<Prisma.OrderLineUncheckedCreateInput, LineField>;

/** Un pedido de una receta escrito como antes de las lineas: la cabecera y lo de su receta juntos. */
export type SingleLineOrderData = Prisma.OrderUncheckedCreateInput & LineData;

/** Lo que se cambia de un pedido de una receta: la cabecera y lo de su receta juntos. */
export type SingleLineOrderUpdate = Prisma.OrderUncheckedUpdateInput & Partial<Prisma.OrderLineUncheckedUpdateInput>;

function splitLine<T extends object>(data: T): { header: Record<string, unknown>; line: Record<string, unknown> } {
  const header: Record<string, unknown> = {};
  const line: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if ((LINE_FIELDS as readonly string[]).includes(key)) line[key] = value;
    else header[key] = value;
  }
  return { header, line };
}

/**
 * Crea un pedido y su unica linea, en `position` 0, con los datos de la receta en la linea y el
 * estado, el motivo, los autores y las fechas del pedido copiados en ella. Devuelve el pedido y el
 * id de la linea.
 */
export async function createOrderWithLine(
  db: Db,
  data: SingleLineOrderData,
): Promise<Prisma.OrderGetPayload<object> & { readonly lineId: string }> {
  const { header, line } = splitLine(data);
  const order = await db.order.create({ data: header as Prisma.OrderUncheckedCreateInput });
  if (order.status === 'PARCIAL') throw new Error('un pedido de una receta no puede estar en PARCIAL');
  const recipe = await db.recipe.findUnique({ where: { id: data.recipeId }, select: { id: true, parentRecipeId: true } });
  const created = await db.orderLine.create({
    data: {
      ...(line as LineData),
      orderId: order.id,
      companyId: order.companyId,
      position: 0,
      originalRecipeId: recipe?.parentRecipeId ?? data.recipeId,
      status: order.status,
      cancellationReason: order.cancellationReason,
      createdBy: order.createdBy,
      updatedBy: order.updatedBy,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      deletedAt: order.deletedAt,
    },
    select: { id: true },
  });
  return { ...order, lineId: created.id };
}

/**
 * Cambia un pedido de una receta como se hacia antes de las lineas: la cabecera en `orders` y lo de
 * su receta en su unica linea viva, en una sola sentencia para que sus CHECK lo vean junto. El
 * estado y el motivo van a los dos. Devuelve el id de la linea.
 */
export async function updateOrderAndLine(db: Db, orderId: string, data: SingleLineOrderUpdate): Promise<string> {
  const { header, line } = splitLine(data);
  const lineId = await ensureOnlyLine(db, orderId);
  if (Object.keys(header).length > 0) {
    await db.order.update({ where: { id: orderId }, data: header as Prisma.OrderUncheckedUpdateInput });
  }
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { status: true, cancellationReason: true },
  });
  const current = await db.orderLine.findUniqueOrThrow({
    where: { id: lineId },
    select: { status: true, cancellationReason: true, updatedAt: true },
  });
  const sameStatus =
    order.status === 'PARCIAL' ||
    (order.status === current.status && order.cancellationReason === current.cancellationReason);
  if (Object.keys(line).length === 0 && sameStatus) return lineId;
  const statusData =
    order.status === 'PARCIAL' ? {} : { status: order.status, cancellationReason: order.cancellationReason };
  // Prisma moveria `updated_at` de la linea: se conserva, como hacia el SQL de antes.
  await db.orderLine.update({
    where: { id: lineId },
    data: { updatedAt: current.updatedAt, ...(line as Prisma.OrderLineUncheckedUpdateInput), ...statusData },
  });
  return lineId;
}

/** El alta de un pedido de una receta como se escribia antes de las lineas: la cabecera y su receta. */
export type SingleLineNewOrder = NewOrder & {
  readonly recipeId: string;
  /** La original de `recipeId`; por defecto, ella misma. */
  readonly originalRecipeId?: string;
  readonly quantity: string;
  readonly unitId: string;
  readonly presentationLines: readonly OrderPresentationLineWrite[];
  readonly salePrice: string | null;
};

/** El pedido recien creado con los datos de su unica linea, como los devolvia el alta de antes. */
export type SingleLineOrderRow = OrderRow &
  Pick<
    OrderLineRow,
    'recipeId' | 'quantity' | 'unitId' | 'salePrice' | 'ingredientsCost' | 'packagingCost' | 'actualCost' | 'presentationLines'
  > & { readonly lineId: string };

/**
 * Alta por el puerto real de un pedido de una receta: `create` escribe la cabecera y `writeLines`
 * su unica linea, con el reparto y el coste, en la transaccion de `orders`.
 */
export async function createSingleLineOrder(
  orders: OrderWriteRepository,
  data: SingleLineNewOrder,
  year: number,
  actorId: string,
  now: Date,
  cost: StoredOrderCost | null,
  scope: OrderScope,
): Promise<SingleLineOrderRow> {
  if (data.status === 'PARCIAL') throw new Error('un pedido de una receta no puede estar en PARCIAL');
  const order = await orders.create(
    { priority: data.priority, status: data.status, customerId: data.customerId },
    year,
    actorId,
    now,
    scope,
  );
  const written = await orders.writeLines(
    order.id,
    {
      removedIds: [],
      edited: [],
      added: [
        {
          recipeId: data.recipeId,
          originalRecipeId: data.originalRecipeId ?? data.recipeId,
          quantity: data.quantity,
          unitId: data.unitId,
          salePrice: data.salePrice,
          presentationLines: data.presentationLines,
          status: data.status,
          cost,
        },
      ],
    },
    actorId,
    now,
    scope,
  );
  const line = written?.[0];
  if (line === undefined) throw new Error(`el pedido ${order.id} se creo sin su linea`);
  return {
    ...order,
    lineId: line.id,
    recipeId: line.recipeId,
    quantity: line.quantity,
    unitId: line.unitId,
    salePrice: line.salePrice,
    ingredientsCost: line.ingredientsCost,
    packagingCost: line.packagingCost,
    actualCost: line.actualCost,
    presentationLines: line.presentationLines,
  };
}

/** Lo que una lectura de `orders` pide de su primera linea: la viva de menor `position` o, en un
 *  pedido dado de baja, la ultima que se quito. Es la que guardaba la receta del pedido. */
export function firstLineSelect<S extends Prisma.OrderLineSelect>(select: S) {
  return {
    orderBy: [{ deletedAt: { sort: 'desc' as const, nulls: 'first' as const } }, { position: 'asc' as const }],
    take: 1,
    select,
  };
}

/** Un pedido leido con `firstLineSelect` con las columnas de su primera linea junto a las suyas,
 *  como se leian antes de las lineas. Falla si el pedido no tiene ninguna linea. */
export function withFirstLine<T extends { readonly lines: readonly object[] }>(
  row: T,
): Omit<T, 'lines'> & T['lines'][number] {
  const { lines, ...rest } = row;
  const first = lines[0];
  if (first === undefined) throw new Error('el pedido no tiene ninguna linea');
  return { ...rest, ...first } as Omit<T, 'lines'> & T['lines'][number];
}

/** La cantidad de la primera linea viva de cada pedido, en el orden de `orderIds`, con 4 decimales. */
export async function firstLineQuantities(db: Db, orderIds: readonly string[]): Promise<readonly string[]> {
  const lines = await db.orderLine.findMany({
    where: { orderId: { in: [...orderIds] }, deletedAt: null },
    orderBy: { position: 'asc' },
    select: { orderId: true, quantity: true },
  });
  return orderIds.map((id) => lines.find((line) => line.orderId === id)?.quantity.toFixed(4) ?? '');
}

/**
 * La unica linea de un pedido insertado a mano en `orders`, con los datos de su receta y el estado,
 * el motivo, los autores y las fechas del pedido. Devuelve su id.
 */
export async function insertOnlyLine(db: Db, orderId: string, data: Omit<LineData, 'quantity'> & {
  readonly quantity?: LineData['quantity'];
}): Promise<string> {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status === 'PARCIAL') throw new Error('un pedido de una receta no puede estar en PARCIAL');
  const recipe = await db.recipe.findUnique({ where: { id: data.recipeId }, select: { parentRecipeId: true } });
  const line = await db.orderLine.create({
    data: {
      quantity: 10,
      ...data,
      orderId,
      companyId: order.companyId,
      position: 0,
      originalRecipeId: recipe?.parentRecipeId ?? data.recipeId,
      status: order.status,
      cancellationReason: order.cancellationReason,
      createdBy: order.createdBy,
      updatedBy: order.updatedBy,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      deletedAt: order.deletedAt,
    },
    select: { id: true },
  });
  return line.id;
}

/** La unica linea viva del pedido o, en uno dado de baja, la ultima que se quito con el. Falla si
 *  tiene varias vivas o ninguna. */
export async function ensureOnlyLine(db: Db, orderId: string): Promise<string> {
  const existing = await db.orderLine.findMany({ where: { orderId, deletedAt: null }, select: { id: true }, take: 2 });
  if (existing.length > 1) throw new Error(`el pedido ${orderId} tiene mas de una linea`);
  const found = existing[0];
  if (found !== undefined) return found.id;
  const removed = await db.orderLine.findFirst({
    where: { orderId },
    orderBy: [{ deletedAt: 'desc' }, { position: 'asc' }],
    select: { id: true },
  });
  if (removed === null) throw new Error(`el pedido ${orderId} no tiene ninguna linea`);
  return removed.id;
}

/** La unica linea viva del pedido, con todas sus columnas. */
export async function readOnlyLine(db: Db, orderId: string): Promise<Prisma.OrderLineGetPayload<object>> {
  const lineId = await ensureOnlyLine(db, orderId);
  return db.orderLine.findUniqueOrThrow({ where: { id: lineId } });
}

/**
 * Copia a la unica linea el estado y el motivo que el test escribio a mano en el pedido. Lo de la
 * etapa (quien empaca, quien acondiciona, la fecha de terminado) se escribe en la linea con
 * `updateOrderAndLine`.
 */
export async function syncOnlyLine(db: Db, orderId: string): Promise<string> {
  return updateOrderAndLine(db, orderId, {});
}

type FlowKey =
  | 'transitionAliveById'
  | 'startPackingAliveById'
  | 'finishPackingAliveById'
  | 'startConditioningAliveById'
  | 'finishConditioningAliveById';

type WithoutLine<F> = F extends (id: string, lineId: string, ...rest: infer A) => infer R
  ? (id: string, ...rest: A) => R
  : F;

/** Las operaciones del flujo con la firma de antes de las lineas: sin `lineId`. */
export type SingleLineFlow<T> = { [K in keyof T]: K extends FlowKey ? WithoutLine<T[K]> : T[K] };

const FLOW_KEYS: readonly FlowKey[] = [
  'transitionAliveById',
  'startPackingAliveById',
  'finishPackingAliveById',
  'startConditioningAliveById',
  'finishConditioningAliveById',
];

/** Una operacion por linea llamada sobre la unica linea del pedido, alineada antes con el pedido. Un
 *  pedido que no existe o esta dado de baja no tiene linea que alinear: la operacion recibe una que
 *  no es suya y responde como hoy. */
export function onOnlyLine<A extends unknown[], R>(
  operation: (id: string, lineId: string, ...rest: A) => Promise<R>,
  db: Db = prisma,
): (id: string, ...rest: A) => Promise<R> {
  return async (id, ...rest) => {
    const alive = await db.order.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    return operation(id, alive === null ? randomUUID() : await syncOnlyLine(db, id), ...rest);
  };
}

/** El catalogo con las operaciones del flujo sobre la unica linea de cada pedido. */
export function singleLineFlow<T extends object>(catalog: T, db: Db = prisma): SingleLineFlow<T> {
  const result: Record<string, unknown> = { ...(catalog as Record<string, unknown>) };
  for (const key of FLOW_KEYS) {
    const operation = (catalog as Record<string, unknown>)[key];
    if (typeof operation === 'function') {
      result[key] = onOnlyLine(operation as (id: string, lineId: string, ...rest: unknown[]) => Promise<unknown>, db);
    }
  }
  return result as SingleLineFlow<T>;
}
