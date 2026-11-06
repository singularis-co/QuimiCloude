// La unica linea de un pedido sembrado a mano, como la habria dejado el relleno de la migracion de
// lineas: los tests escritos antes de las lineas crean el pedido en `orders` y fuerzan su estado
// alli; el flujo de planta opera ya sobre la linea.
import { randomUUID } from 'node:crypto';

import { Prisma, type PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

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

/**
 * La linea viva del pedido; si no tiene ninguna, la crea con los datos y el estado del pedido y le
 * cuelga el reparto que aun no tenga linea. Devuelve su id.
 */
export async function ensureOnlyLine(db: Db, orderId: string): Promise<string> {
  const existing = await db.orderLine.findMany({ where: { orderId, deletedAt: null }, select: { id: true }, take: 2 });
  if (existing.length > 1) throw new Error(`el pedido ${orderId} tiene mas de una linea`);
  const found = existing[0];
  if (found !== undefined) return found.id;

  const rows = await db.$queryRaw<ReadonlyArray<{ readonly id: string }>>(Prisma.sql`
    INSERT INTO "order_lines" (
      "order_id", "company_id", "position", "recipe_id", "original_recipe_id", "quantity", "unit_id",
      "status", "cancellation_reason", "ingredients_cost", "packaging_cost", "actual_cost",
      "sale_price", "reserved_at", "finished_at", "packed_by", "conditioned_by",
      "created_by", "updated_by", "created_at", "updated_at"
    )
    SELECT o."id", o."company_id", 0, o."recipe_id", COALESCE(r."parent_recipe_id", r."id"), o."quantity",
           o."unit_id", o."status", o."cancellation_reason", o."ingredients_cost", o."packaging_cost",
           o."actual_cost", o."sale_price", o."reserved_at", o."finished_at", o."packed_by",
           o."conditioned_by", o."created_by", o."updated_by", o."created_at", o."updated_at"
      FROM "orders" o
      JOIN "recipes" r ON r."id" = o."recipe_id"
     WHERE o."id" = ${orderId}::uuid
    RETURNING "id"
  `);
  const line = rows[0];
  if (line === undefined) throw new Error(`el pedido ${orderId} no existe`);
  await db.$executeRaw(Prisma.sql`
    UPDATE "order_presentation_lines"
       SET "order_line_id" = ${line.id}::uuid
     WHERE "order_id" = ${orderId}::uuid
       AND "order_line_id" IS NULL
  `);
  return line.id;
}

/**
 * Copia a la unica linea el estado y las columnas de etapa que el test escribio a mano en el pedido,
 * en una sola sentencia: los CHECK de la linea los exigen juntos. Crea la linea si no existe.
 */
export async function syncOnlyLine(db: Db, orderId: string): Promise<string> {
  const lineId = await ensureOnlyLine(db, orderId);
  await db.$executeRaw(Prisma.sql`
    UPDATE "order_lines" AS l
       SET "status" = o."status",
           "cancellation_reason" = o."cancellation_reason",
           "finished_at" = o."finished_at",
           "packed_by" = o."packed_by",
           "conditioned_by" = o."conditioned_by",
           "actual_cost" = o."actual_cost",
           "reserved_at" = o."reserved_at"
      FROM "orders" AS o
     WHERE o."id" = l."order_id"
       AND l."id" = ${lineId}::uuid
  `);
  return lineId;
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
