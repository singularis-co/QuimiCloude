/**
 * La migracion `*_orders_drop_line_columns` contra Postgres real: quita de `orders` lo que es de
 * cada receta, con sus CHECK, FK e indices, y deja en la linea el indice de listado por cantidad.
 * Tambien su `down.sql`: se niega sin cambiar nada si algun pedido tiene mas de una linea viva, y
 * si no, devuelve a cada pedido los valores de su linea.
 *
 * Cada caso corre en una transaccion que termina en ROLLBACK. Para sembrar pedidos como los de
 * antes se baja la migracion dentro de la transaccion: el cliente de Prisma ya no conoce esas
 * columnas, asi que los pedidos se escriben y se leen con SQL crudo.
 */
import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/shared/db/prisma';

import {
  ensureLegacyOrderLine,
  expectRejectedByDatabase,
  freshSequence,
  inRolledBackTransaction,
  insertLegacyOrder,
  readLegacyOrders,
  readMigration,
  runScript,
  schemaSnapshot,
  seedCompany,
  seedRecipe,
  seedUser,
} from '../../helpers/migration-script';

const UP_SQL = readMigration('_orders_drop_line_columns', 'migration.sql');
const DOWN_SQL = readMigration('_orders_drop_line_columns', 'down.sql');

const DROPPED_COLUMNS = [
  'recipe_id',
  'quantity',
  'unit_id',
  'ingredients_cost',
  'packaging_cost',
  'actual_cost',
  'sale_price',
  'reserved_at',
  'finished_at',
  'packed_by',
  'conditioned_by',
] as const;

const DROPPED_CONSTRAINTS = [
  'orders_quantity_positive',
  'orders_packaging_cost_matches_ingredients_cost',
  'orders_actual_cost_non_negative',
  'orders_actual_cost_requires_packed',
  'orders_sale_price_non_negative',
  'orders_finished_at_requires_delivered',
  'orders_finished_requires_finished_at',
  'orders_packed_by_matches_status',
  'orders_conditioned_by_matches_status',
  'orders_recipe_id_fkey',
  'orders_unit_id_fkey',
  'orders_packed_by_company_id_fkey',
  'orders_conditioned_by_company_id_fkey',
] as const;

const DROPPED_INDEXES = [
  'orders_recipe_id_idx',
  'orders_unit_id_idx',
  'orders_packed_by_idx',
  'orders_conditioned_by_idx',
  'orders_quantity_idx',
  'orders_expirable_idx',
  'orders_company_finished_idx',
  'orders_company_terminated_idx',
] as const;

/**
 * Lo que `orders` tenia de las columnas de la linea antes de esta migracion: columnas, CHECK, FK e
 * indices, tal como los describe `schemaSnapshot`. La bajada los tiene que dejar identicos.
 */
const ORDERS_LINE_OBJECTS_BEFORE: readonly string[] = [
  "C orders_actual_cost_non_negative CHECK (((actual_cost IS NULL) OR (actual_cost >= (0)::numeric)))",
  "C orders_actual_cost_requires_packed CHECK (((actual_cost IS NULL) OR ((status)::text = ANY (ARRAY['POR_ACONDICIONAR'::text, 'EN_ACONDICIONAMIENTO'::text, 'TERMINADO'::text, 'ENTREGADO'::text]))))",
  "C orders_conditioned_by_company_id_fkey FOREIGN KEY (conditioned_by, company_id) REFERENCES users(id, company_id) ON UPDATE CASCADE ON DELETE RESTRICT",
  "C orders_conditioned_by_matches_status CHECK (((((status)::text <> ALL (ARRAY['EN_ACONDICIONAMIENTO'::text, 'TERMINADO'::text])) OR (conditioned_by IS NOT NULL)) AND (((status)::text <> ALL (ARRAY['PENDIENTE'::text, 'EN_CURSO'::text, 'POR_EMPACAR'::text, 'EN_EMPAQUE'::text, 'POR_ACONDICIONAR'::text, 'CANCELADO'::text, 'BLOQUEADO'::text])) OR (conditioned_by IS NULL))))",
  "C orders_finished_at_requires_delivered CHECK (((finished_at IS NULL) OR ((status)::text = ANY (ARRAY['TERMINADO'::text, 'ENTREGADO'::text]))))",
  "C orders_finished_requires_finished_at CHECK ((((status)::text <> 'TERMINADO'::text) OR (finished_at IS NOT NULL)))",
  "C orders_packaging_cost_matches_ingredients_cost CHECK (((packaging_cost IS NULL) = (ingredients_cost IS NULL)))",
  "C orders_packed_by_company_id_fkey FOREIGN KEY (packed_by, company_id) REFERENCES users(id, company_id) ON UPDATE CASCADE ON DELETE RESTRICT",
  "C orders_packed_by_matches_status CHECK (((((status)::text <> ALL (ARRAY['EN_EMPAQUE'::text, 'POR_ACONDICIONAR'::text, 'EN_ACONDICIONAMIENTO'::text, 'TERMINADO'::text])) OR (packed_by IS NOT NULL)) AND (((status)::text <> ALL (ARRAY['PENDIENTE'::text, 'EN_CURSO'::text, 'POR_EMPACAR'::text, 'CANCELADO'::text])) OR (packed_by IS NULL))))",
  "C orders_quantity_positive CHECK ((quantity > (0)::numeric))",
  "C orders_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON UPDATE CASCADE ON DELETE RESTRICT",
  "C orders_sale_price_non_negative CHECK (((sale_price IS NULL) OR (sale_price >= (0)::numeric)))",
  "C orders_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES units(id) ON UPDATE CASCADE ON DELETE RESTRICT",
  "I CREATE INDEX orders_company_finished_idx ON public.orders USING btree (company_id, finished_at DESC NULLS LAST, order_year DESC, order_sequence DESC) WHERE ((deleted_at IS NULL) AND (status = 'ENTREGADO'::\"OrderStatus\"))",
  "I CREATE INDEX orders_company_terminated_idx ON public.orders USING btree (company_id, finished_at DESC NULLS LAST, order_year DESC, order_sequence DESC) WHERE ((deleted_at IS NULL) AND (status = 'TERMINADO'::\"OrderStatus\"))",
  "I CREATE INDEX orders_conditioned_by_idx ON public.orders USING btree (conditioned_by)",
  "I CREATE INDEX orders_expirable_idx ON public.orders USING btree (reserved_at) WHERE ((status = 'PENDIENTE'::\"OrderStatus\") AND (deleted_at IS NULL) AND (reserved_at IS NOT NULL))",
  "I CREATE INDEX orders_packed_by_idx ON public.orders USING btree (packed_by)",
  "I CREATE INDEX orders_quantity_idx ON public.orders USING btree (quantity) WHERE (deleted_at IS NULL)",
  "I CREATE INDEX orders_recipe_id_idx ON public.orders USING btree (recipe_id)",
  "I CREATE INDEX orders_unit_id_idx ON public.orders USING btree (unit_id)",
  "K actual_cost numeric YES ",
  "K conditioned_by uuid YES ",
  "K finished_at timestamptz YES ",
  "K ingredients_cost numeric YES ",
  "K packaging_cost numeric YES ",
  "K packed_by uuid YES ",
  "K quantity numeric NO ",
  "K recipe_id uuid NO ",
  "K reserved_at timestamptz YES ",
  "K sale_price numeric YES ",
  "K unit_id uuid YES ",
];

/** Las lineas de una foto de `orders` que hablan de lo que esta migracion quita. */
function lineObjects(snapshot: readonly string[]): readonly string[] {
  const names: readonly string[] = [...DROPPED_CONSTRAINTS, ...DROPPED_INDEXES];
  return snapshot.filter((line) => {
    const parts = line.split(' ');
    if (line.startsWith('K ')) return (DROPPED_COLUMNS as readonly string[]).includes(parts[1] ?? '');
    if (line.startsWith('C ')) return names.includes(parts[1] ?? '');
    return names.includes((parts[2] === 'INDEX' ? parts[3] : parts[4]) ?? '');
  });
}

type Base = {
  readonly companyId: string;
  readonly recipeId: string;
  readonly unitId: string;
  readonly packer: string;
  readonly conditioner: string;
};

async function seedBase(tx: Prisma.TransactionClient): Promise<Base> {
  const companyId = await seedCompany(tx);
  const marca = randomUUID().replace(/-/gu, '');
  const unit = await tx.unit.create({
    data: { name: `Unidad ${marca}`, nameNormalized: `unidad${marca}`, companyId },
    select: { id: true },
  });
  return {
    companyId,
    recipeId: await seedRecipe(tx, companyId),
    unitId: unit.id,
    packer: await seedUser(tx, companyId),
    conditioner: await seedUser(tx, companyId),
  };
}

/** Una linea mas de un pedido del esquema de hoy, en `position`. */
async function insertLine(
  tx: Prisma.TransactionClient,
  base: Base,
  orderId: string,
  position: number,
  options: { readonly status?: string; readonly deletedAt?: Date | null; readonly recipeId?: string } = {},
): Promise<string> {
  const recipeId = options.recipeId ?? (await seedRecipe(tx, base.companyId));
  const id = randomUUID();
  const status = options.status ?? 'PENDIENTE';
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "order_lines" (
      "id", "order_id", "company_id", "position", "recipe_id", "original_recipe_id", "quantity", "status",
      "cancellation_reason", "deleted_at", "updated_at"
    ) VALUES (
      ${id}::uuid, ${orderId}::uuid, ${base.companyId}::uuid, ${position}, ${recipeId}::uuid, ${recipeId}::uuid,
      3, ${status}::"OrderStatus", ${status === 'CANCELADO' ? 'Se cancelo en la prueba' : null},
      ${options.deletedAt ?? null}::timestamptz, now()
    )
  `);
  return id;
}

/** Un pedido del esquema de hoy: solo la cabecera, en `PENDIENTE`. */
async function seedHeader(tx: Prisma.TransactionClient, base: Base): Promise<string> {
  const order = await tx.order.create({
    data: { companyId: base.companyId, orderYear: new Date().getUTCFullYear(), orderSequence: freshSequence() },
    select: { id: true },
  });
  return order.id;
}

/** La RLS forzada de las dos tablas: la bajada la levanta para leer y la tiene que restaurar. */
async function forcedRls(tx: Prisma.TransactionClient): Promise<Record<string, boolean>> {
  const rows = await tx.$queryRaw<ReadonlyArray<{ relname: string; forced: boolean }>>(Prisma.sql`
    SELECT relname::text AS relname, relforcerowsecurity AS forced FROM pg_class
     WHERE relnamespace = 'public'::regnamespace AND relname IN ('orders', 'order_lines')
     ORDER BY relname
  `);
  return Object.fromEntries(rows.map((row) => [row.relname, row.forced]));
}

async function lineSnapshot(tx: Prisma.TransactionClient, companyId: string): Promise<readonly unknown[]> {
  return tx.$queryRaw<unknown[]>(Prisma.sql`
    SELECT "id"::text, "order_id"::text, "position", "recipe_id"::text, "quantity"::text, "status"::text,
           "deleted_at", "packed_by"::text, "actual_cost"::text, "reserved_at"
      FROM "order_lines" WHERE "company_id" = ${companyId}::uuid ORDER BY "id"
  `);
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('migration.sql de orders_drop_line_columns', () => {
  it('QT-313 R1: orders queda sin las columnas de la linea, sin sus CHECK, FK e indices, y la cantidad se indexa en la linea', async () => {
    await inRolledBackTransaction(async (tx) => {
      const orders = await schemaSnapshot(tx, 'orders');

      for (const column of DROPPED_COLUMNS) {
        expect(orders.some((line) => line.startsWith(`K ${column} `)), column).toBe(false);
      }
      for (const name of [...DROPPED_CONSTRAINTS, ...DROPPED_INDEXES]) {
        expect(orders.some((line) => line.includes(` ${name} `)), name).toBe(false);
      }
      expect(orders.some((line) => line.startsWith('C orders_cancellation_reason_matches_status '))).toBe(true);
      expect(orders.some((line) => line.startsWith('C orders_delivered_not_deleted '))).toBe(true);

      const lines = await schemaSnapshot(tx, 'order_lines');
      expect(
        lines.some((line) => line.startsWith('I CREATE INDEX order_lines_quantity_idx') && line.includes('(deleted_at IS NULL)')),
      ).toBe(true);
    });
  });
});

describe('down.sql de orders_drop_line_columns', () => {
  it('QT-313 R9: bajar y volver a subir con pedidos de una linea deja los valores y el esquema como estaban', async () => {
    await inRolledBackTransaction(async (tx) => {
      const esquemaHoy = { orders: await schemaSnapshot(tx, 'orders'), lines: await schemaSnapshot(tx, 'order_lines') };
      await runScript(tx, DOWN_SQL);
      const esquemaAntes = { orders: await schemaSnapshot(tx, 'orders'), lines: await schemaSnapshot(tx, 'order_lines') };
      expect(lineObjects(esquemaAntes.orders)).toEqual(ORDERS_LINE_OBJECTS_BEFORE);
      expect(await forcedRls(tx)).toEqual({ order_lines: true, orders: true });

      const base = await seedBase(tx);
      const finishedAt = new Date('2026-10-20T15:00:00.000Z');
      const ids = [
        await insertLegacyOrder(tx, {
          companyId: base.companyId,
          recipeId: base.recipeId,
          quantity: '12.5',
          unitId: base.unitId,
          salePrice: '250',
          ingredientsCost: '30',
          packagingCost: '4.5',
          reservedAt: new Date('2026-10-01T12:00:00.000Z'),
        }),
        await insertLegacyOrder(tx, {
          companyId: base.companyId,
          recipeId: base.recipeId,
          status: 'ENTREGADO',
          unitId: base.unitId,
          ingredientsCost: '99.9999',
          packagingCost: '0',
          actualCost: '101.5',
          finishedAt,
          packedBy: base.packer,
          conditionedBy: base.conditioner,
        }),
        await insertLegacyOrder(tx, {
          companyId: base.companyId,
          recipeId: base.recipeId,
          status: 'POR_ACONDICIONAR',
          actualCost: '7',
          packedBy: base.packer,
        }),
        await insertLegacyOrder(tx, {
          companyId: base.companyId,
          recipeId: base.recipeId,
          status: 'CANCELADO',
          cancellationReason: 'El cliente desistio',
        }),
        await insertLegacyOrder(tx, {
          companyId: base.companyId,
          recipeId: base.recipeId,
          deletedAt: new Date('2026-10-05T00:00:00.000Z'),
        }),
      ];
      for (const id of ids) await ensureLegacyOrderLine(tx, id);
      // La linea de un pedido dado de baja se quita con el.
      await tx.$executeRaw(Prisma.sql`
        UPDATE "order_lines" l SET "deleted_at" = o."deleted_at"
          FROM "orders" o WHERE o."id" = l."order_id" AND o."deleted_at" IS NOT NULL AND o."id" = ANY(${ids}::uuid[])
      `);
      const pedidosAntes = await readLegacyOrders(tx, ids);
      const lineasAntes = await lineSnapshot(tx, base.companyId);

      await runScript(tx, UP_SQL);

      expect({ orders: await schemaSnapshot(tx, 'orders'), lines: await schemaSnapshot(tx, 'order_lines') }).toEqual(esquemaHoy);
      expect(await lineSnapshot(tx, base.companyId)).toEqual(lineasAntes);

      await runScript(tx, DOWN_SQL);

      expect(await readLegacyOrders(tx, ids)).toEqual(pedidosAntes);
      expect({ orders: await schemaSnapshot(tx, 'orders'), lines: await schemaSnapshot(tx, 'order_lines') }).toEqual(
        esquemaAntes,
      );
      expect(await lineSnapshot(tx, base.companyId)).toEqual(lineasAntes);
      expect(await forcedRls(tx)).toEqual({ order_lines: true, orders: true });
    });
  });

  it('QT-313 R9: con pedidos de dos lineas vivas la bajada falla, nombra cuantos y no cambia nada', async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = await seedBase(tx);
      const conDosPendientes = await seedHeader(tx, base);
      await insertLine(tx, base, conDosPendientes, 0, { recipeId: base.recipeId });
      await insertLine(tx, base, conDosPendientes, 1);
      // Una linea cancelada sigue viva: el pedido no cabe en una sola fila de `orders`.
      const conUnaCancelada = await seedHeader(tx, base);
      await insertLine(tx, base, conUnaCancelada, 0, { recipeId: base.recipeId });
      await insertLine(tx, base, conUnaCancelada, 1, { status: 'CANCELADO' });
      // Una quitada no cuenta.
      const conUnaQuitada = await seedHeader(tx, base);
      await insertLine(tx, base, conUnaQuitada, 0, { recipeId: base.recipeId });
      await insertLine(tx, base, conUnaQuitada, 1, { deletedAt: new Date('2026-10-02T00:00:00.000Z') });

      const ordersAntes = await schemaSnapshot(tx, 'orders');
      const lineasAntes = await lineSnapshot(tx, base.companyId);

      const message = await expectRejectedByDatabase(tx, () => runScript(tx, DOWN_SQL), 'bajar con pedidos de dos lineas');

      expect(message).toContain('orders_drop_line_columns: 2 pedido(s) con mas de una linea viva');
      expect(await schemaSnapshot(tx, 'orders')).toEqual(ordersAntes);
      expect(await lineSnapshot(tx, base.companyId)).toEqual(lineasAntes);
      expect(await forcedRls(tx)).toEqual({ order_lines: true, orders: true });
    });
  });

  it('QT-313 R9: un pedido con una linea viva y otra quitada baja con los valores de la viva', async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = await seedBase(tx);
      const pedido = await seedHeader(tx, base);
      const otraReceta = await seedRecipe(tx, base.companyId);
      await insertLine(tx, base, pedido, 0, { recipeId: otraReceta, deletedAt: new Date('2026-10-02T00:00:00.000Z') });
      await insertLine(tx, base, pedido, 1, { recipeId: base.recipeId });

      await runScript(tx, DOWN_SQL);

      const [fila] = await readLegacyOrders(tx, [pedido]);
      expect(fila).toMatchObject({ recipe_id: base.recipeId, quantity: '3.0000', status: 'PENDIENTE' });
    });
  });

  it('QT-313 R9: un pedido sin ninguna linea hace fallar la bajada nombrando cuantos', async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = await seedBase(tx);
      await seedHeader(tx, base);
      const ordersAntes = await schemaSnapshot(tx, 'orders');

      const message = await expectRejectedByDatabase(tx, () => runScript(tx, DOWN_SQL), 'bajar con un pedido sin linea');

      expect(message).toContain('orders_drop_line_columns: 1 pedido(s) sin ninguna linea');
      expect(await schemaSnapshot(tx, 'orders')).toEqual(ordersAntes);
    });
  });
});
