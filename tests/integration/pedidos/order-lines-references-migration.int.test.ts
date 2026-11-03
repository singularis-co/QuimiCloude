/**
 * La migracion `*_order_lines_references` contra Postgres real: la columna `order_line_id` en las
 * seis tablas que cuelgan del pedido, su relleno, el CHECK de `inventory_movements` y su
 * `down.sql`.
 *
 * Cada caso corre en una transaccion que termina en ROLLBACK. Para probar el relleno se baja esta
 * migracion (y las posteriores) dentro de la transaccion, se siembran filas sin la columna y se
 * vuelve a aplicar el `migration.sql` real. Mientras la columna no existe, las filas de esas seis
 * tablas se escriben con SQL crudo: el cliente de Prisma ya la conoce y la pediria.
 */
import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/shared/db/prisma';

import {
  expectRejectedByDatabase,
  freshSequence,
  inRolledBackTransaction,
  readMigration,
  runDowns,
  runScript,
  schemaSnapshot,
  seedCompany,
  seedRecipe,
  seedUser,
} from '../../helpers/migration-script';

const UP_SQL = readMigration('_order_lines_references', 'migration.sql');
const DOWN_SQL = readMigration('_order_lines_references', 'down.sql');
const LATER_DOWNS = ['_orders_drop_line_columns', '_order_lines_references_required'] as const;

const CHILD_TABLES = [
  'order_presentation_lines',
  'reservation_movements',
  'inventory_movements',
  'order_execution_entries',
  'order_step_evidence',
  'order_conditioning_team_members',
] as const;
type ChildTable = (typeof CHILD_TABLES)[number];

type Base = {
  readonly companyId: string;
  readonly userId: string;
  readonly recipeId: string;
  readonly presentationId: string;
  readonly batchId: string;
};

async function seedBase(tx: Prisma.TransactionClient): Promise<Base> {
  const companyId = await seedCompany(tx);
  const userId = await seedUser(tx, companyId);
  const recipeId = await seedRecipe(tx, companyId);
  const marca = randomUUID().replace(/-/gu, '');
  const { id: unitId } = await tx.unit.create({
    data: { name: `Unidad ${marca}`, nameNormalized: `unidad${marca}`, symbol: `u${marca.slice(0, 8)}` },
    select: { id: true },
  });
  const { id: presentationId } = await tx.presentation.create({
    data: { name: `Presentacion ${marca}`, nameNormalized: `presentacion${marca}`, unitId, companyId },
    select: { id: true },
  });
  const { id: productId } = await tx.product.create({
    data: { name: `Producto ${marca}`, nameNormalized: `producto${marca}`, companyId, unitId },
    select: { id: true },
  });
  const { id: batchId } = await tx.productBatch.create({
    data: {
      productId,
      presentationId,
      stock: 100,
      unitCost: new Prisma.Decimal('1.0000'),
      lot: `L-${marca}`,
      purchaseDate: new Date('2026-09-01T00:00:00Z'),
      companyId,
    },
    select: { id: true },
  });
  return { companyId, userId, recipeId, presentationId, batchId };
}

async function seedOrder(tx: Prisma.TransactionClient, base: Base): Promise<string> {
  const order = await tx.order.create({
    data: {
      companyId: base.companyId,
      orderYear: new Date().getUTCFullYear(),
      orderSequence: freshSequence(),
      recipeId: base.recipeId,
      quantity: new Prisma.Decimal('10'),
    },
    select: { id: true },
  });
  return order.id;
}

async function insertLine(
  tx: Prisma.TransactionClient,
  base: Base,
  orderId: string,
  position: number,
  recipeId: string,
): Promise<string> {
  const id = randomUUID();
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "order_lines" (
      "id", "order_id", "company_id", "position", "recipe_id", "original_recipe_id", "quantity", "updated_at"
    ) VALUES (
      ${id}::uuid, ${orderId}::uuid, ${base.companyId}::uuid, ${position}, ${recipeId}::uuid,
      ${recipeId}::uuid, 1, now()
    )
  `);
  return id;
}

type Movement = {
  readonly kind: string;
  readonly quantity: string;
  readonly orderId?: string | null;
  readonly presentationLineId?: string | null;
  readonly deliveryId?: string | null;
  readonly voidId?: string | null;
  readonly reason?: string | null;
  readonly orderLineId?: string | null;
};

async function insertMovement(tx: Prisma.TransactionClient, base: Base, m: Movement): Promise<void> {
  const columns = Prisma.sql`
    "batch_id", "kind", "quantity", "reason", "order_id", "order_presentation_line_id",
    "order_delivery_id", "order_delivery_void_id", "company_id"`;
  const values = Prisma.sql`
    ${base.batchId}::uuid, CAST(${m.kind} AS "InventoryMovementKind"), CAST(${m.quantity} AS decimal(14,4)),
    ${m.reason ?? null}, ${m.orderId ?? null}::uuid, ${m.presentationLineId ?? null}::uuid,
    ${m.deliveryId ?? null}::uuid, ${m.voidId ?? null}::uuid, ${base.companyId}::uuid`;
  if (m.orderLineId === undefined) {
    await tx.$executeRaw(Prisma.sql`INSERT INTO "inventory_movements" (${columns}) VALUES (${values})`);
  } else {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "inventory_movements" (${columns}, "order_line_id")
      VALUES (${values}, ${m.orderLineId}::uuid)`);
  }
}

/**
 * Una fila en cada una de las seis tablas para el pedido, y en `inventory_movements` los cuatro
 * asientos con pedido: consumo, produccion, entrega y la anulacion de esa entrega.
 */
async function seedChildren(tx: Prisma.TransactionClient, base: Base, orderId: string): Promise<void> {
  const presentationLineId = randomUUID();
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "order_presentation_lines" ("id", "order_id", "company_id", "presentation_id", "packages", "updated_at")
    VALUES (${presentationLineId}::uuid, ${orderId}::uuid, ${base.companyId}::uuid, ${base.presentationId}::uuid, 4, now())
  `);
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "reservation_movements" ("company_id", "order_id", "batch_id", "kind", "quantity", "created_by")
    VALUES (${base.companyId}::uuid, ${orderId}::uuid, ${base.batchId}::uuid, 'reserve', 3, ${base.userId}::uuid)
  `);
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "order_execution_entries" ("company_id", "order_id", "user_id", "action", "occurred_at")
    VALUES (${base.companyId}::uuid, ${orderId}::uuid, ${base.userId}::uuid, 'START', now())
  `);
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "order_step_evidence"
      ("company_id", "order_id", "phase", "step_position", "slot", "path", "content_type", "size_bytes", "uploaded_by")
    VALUES (
      ${base.companyId}::uuid, ${orderId}::uuid, 'MANUFACTURING', 1, 1,
      ${`${base.companyId}/${orderId}/${randomUUID()}.jpg`}, 'image/jpeg', 1024, ${base.userId}::uuid
    )
  `);
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "order_conditioning_team_members" ("company_id", "order_id", "user_id", "position")
    VALUES (${base.companyId}::uuid, ${orderId}::uuid, ${base.userId}::uuid, 0)
  `);

  const deliveryId = randomUUID();
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "order_deliveries" ("id", "company_id", "order_id", "delivery_key", "created_by")
    VALUES (${deliveryId}::uuid, ${base.companyId}::uuid, ${orderId}::uuid, ${randomUUID()}::uuid, ${base.userId}::uuid)
  `);
  const voidId = randomUUID();
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "order_delivery_voids" ("id", "company_id", "delivery_id", "void_key", "reason", "created_by")
    VALUES (
      ${voidId}::uuid, ${base.companyId}::uuid, ${deliveryId}::uuid, ${randomUUID()}::uuid,
      'Se entrego al cliente equivocado', ${base.userId}::uuid
    )
  `);

  await insertMovement(tx, base, { kind: 'consumption', quantity: '-1', orderId });
  await insertMovement(tx, base, { kind: 'production', quantity: '2', orderId, presentationLineId });
  await insertMovement(tx, base, { kind: 'delivery', quantity: '-2', orderId, deliveryId });
  await insertMovement(tx, base, { kind: 'delivery_void', quantity: '2', orderId, voidId });
}

async function countRows(tx: Prisma.TransactionClient, table: ChildTable): Promise<number> {
  const rows = await tx.$queryRawUnsafe<ReadonlyArray<{ n: bigint }>>(`SELECT count(*) AS n FROM "${table}"`);
  return Number(rows[0]?.n ?? 0);
}

async function countsOfAll(tx: Prisma.TransactionClient): Promise<Record<ChildTable, number>> {
  const entries: [ChildTable, number][] = [];
  for (const table of CHILD_TABLES) entries.push([table, await countRows(tx, table)]);
  return Object.fromEntries(entries) as Record<ChildTable, number>;
}

/** Las lineas de las filas del pedido en esa tabla, una por fila. */
async function lineIdsOf(
  tx: Prisma.TransactionClient,
  table: ChildTable,
  orderId: string,
): Promise<readonly (string | null)[]> {
  const rows = await tx.$queryRawUnsafe<ReadonlyArray<{ line: string | null }>>(
    `SELECT "order_line_id"::text AS line FROM "${table}" WHERE "order_id" = $1::uuid`,
    orderId,
  );
  return rows.map((row) => row.line);
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('relleno de order_line_id', () => {
  it('R8, R37: los conteos de las seis tablas no cambian y toda fila de un pedido de una linea apunta a ella, delivery_void con la misma linea que su delivery', async () => {
    await inRolledBackTransaction(async (tx) => {
      await runDowns(tx, LATER_DOWNS);
      await runScript(tx, DOWN_SQL);

      const base = await seedBase(tx);
      const orderId = await seedOrder(tx, base);
      const lineId = await insertLine(tx, base, orderId, 0, base.recipeId);
      await seedChildren(tx, base, orderId);
      await insertMovement(tx, base, { kind: 'opening', quantity: '5' });
      await insertMovement(tx, base, { kind: 'adjustment', quantity: '-1', reason: 'merma' });

      const antes = await countsOfAll(tx);
      await runScript(tx, UP_SQL);
      expect(await countsOfAll(tx)).toEqual(antes);

      for (const table of CHILD_TABLES) {
        const lines = await lineIdsOf(tx, table, orderId);
        expect(lines.length, `${table} debe tener filas del pedido`).toBeGreaterThan(0);
        expect(lines, `${table}`).toEqual(lines.map(() => lineId));
      }

      const porTipo = await tx.inventoryMovement.findMany({
        where: { batchId: base.batchId },
        select: { kind: true, orderLineId: true },
      });
      const lineaDe = Object.fromEntries(porTipo.map((m) => [m.kind, m.orderLineId]));
      expect(lineaDe).toEqual({
        consumption: lineId,
        production: lineId,
        delivery: lineId,
        delivery_void: lineId,
        opening: null,
        adjustment: null,
      });
      expect(lineaDe.delivery_void).toBe(lineaDe.delivery);

      const huerfanas = await tx.$queryRaw<ReadonlyArray<{ n: bigint }>>(Prisma.sql`
        SELECT count(*) AS n FROM "inventory_movements"
         WHERE "order_line_id" IS NOT NULL
           AND "kind"::text NOT IN ('consumption', 'production', 'delivery', 'delivery_void')
      `);
      expect(Number(huerfanas[0]?.n)).toBe(0);
    });
  });

  it('R8: en toda la base, cada fila de un pedido con una sola linea queda con esa linea', async () => {
    await inRolledBackTransaction(async (tx) => {
      await runDowns(tx, LATER_DOWNS);
      await runScript(tx, DOWN_SQL);
      const base = await seedBase(tx);
      await seedChildren(tx, base, await seedOrder(tx, base));

      await runScript(tx, UP_SQL);

      for (const table of CHILD_TABLES) {
        const rows = await tx.$queryRawUnsafe<ReadonlyArray<{ n: bigint }>>(`
          SELECT count(*) AS n
            FROM "${table}" t
            JOIN (SELECT "order_id", (array_agg("id"))[1] AS "id"
                    FROM "order_lines" GROUP BY "order_id" HAVING count(*) = 1) u
              ON u."order_id" = t."order_id"
           WHERE t."order_line_id" IS DISTINCT FROM u."id"
        `);
        expect(Number(rows[0]?.n), `${table}: filas sin su unica linea`).toBe(0);
      }
    });
  });

  it('R8: un pedido creado sin linea antes de la migracion la recibe, con sus filas, y la migracion no aborta por un pedido de varias lineas', async () => {
    await inRolledBackTransaction(async (tx) => {
      await runDowns(tx, LATER_DOWNS);
      await runScript(tx, DOWN_SQL);

      const base = await seedBase(tx);
      const sinLinea = await seedOrder(tx, base);
      await seedChildren(tx, base, sinLinea);

      const varias = await seedOrder(tx, base);
      await insertLine(tx, base, varias, 0, base.recipeId);
      await insertLine(tx, base, varias, 1, await seedRecipe(tx, base.companyId));
      await seedChildren(tx, base, varias);

      const pedido = await tx.order.findUniqueOrThrow({ where: { id: sinLinea } });
      expect(await tx.orderLine.count({ where: { orderId: sinLinea } })).toBe(0);

      await runScript(tx, UP_SQL);

      const lineas = await tx.orderLine.findMany({ where: { orderId: sinLinea } });
      expect(lineas).toHaveLength(1);
      const linea = lineas[0]!;
      expect({
        companyId: linea.companyId,
        position: linea.position,
        recipeId: linea.recipeId,
        originalRecipeId: linea.originalRecipeId,
        quantity: linea.quantity.toFixed(4),
        status: linea.status,
        deletedAt: linea.deletedAt,
      }).toEqual({
        companyId: pedido.companyId,
        position: 0,
        recipeId: pedido.recipeId,
        originalRecipeId: pedido.recipeId,
        quantity: pedido.quantity.toFixed(4),
        status: pedido.status,
        deletedAt: null,
      });
      for (const table of CHILD_TABLES) {
        const lines = await lineIdsOf(tx, table, sinLinea);
        expect(lines, `${table}`).toEqual(lines.map(() => linea.id));
        const deVarias = await lineIdsOf(tx, table, varias);
        expect(deVarias.length, `${table} debe tener filas del pedido de varias lineas`).toBeGreaterThan(0);
        expect(deVarias, `${table}: el pedido de varias lineas no se toca`).toEqual(deVarias.map(() => null));
      }
      expect(await tx.orderLine.count({ where: { orderId: varias } })).toBe(2);
    });
  });

  it('R8: bajar y volver a subir no crea otra linea ni cambia la de cada fila', async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = await seedBase(tx);
      const orderId = await seedOrder(tx, base);
      await seedChildren(tx, base, orderId);
      await runDowns(tx, LATER_DOWNS);
      await runScript(tx, DOWN_SQL);
      await runScript(tx, UP_SQL);
      const lineasAntes = await tx.orderLine.count();
      const antes = await lineIdsOf(tx, 'reservation_movements', orderId);

      await runScript(tx, DOWN_SQL);
      await runScript(tx, UP_SQL);

      expect(await tx.orderLine.count()).toBe(lineasAntes);
      expect(await lineIdsOf(tx, 'reservation_movements', orderId)).toEqual(antes);
    });
  });
});

describe('CHECK de linea en inventory_movements', () => {
  it('R37: la base rechaza linea en un asiento opening o adjustment y la admite en los cuatro tipos con pedido', async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = await seedBase(tx);
      const orderId = await seedOrder(tx, base);
      const lineId = await insertLine(tx, base, orderId, 0, base.recipeId);

      expect(
        await expectRejectedByDatabase(
          tx,
          () => insertMovement(tx, base, { kind: 'opening', quantity: '5', orderLineId: lineId }),
          'opening con linea',
        ),
      ).toContain('inventory_movements_order_line_id_matches_kind');
      expect(
        await expectRejectedByDatabase(
          tx,
          () => insertMovement(tx, base, { kind: 'adjustment', quantity: '-1', reason: 'merma', orderLineId: lineId }),
          'adjustment con linea',
        ),
      ).toContain('inventory_movements_order_line_id_matches_kind');

      await insertMovement(tx, base, { kind: 'consumption', quantity: '-1', orderId, orderLineId: lineId });
      await insertMovement(tx, base, { kind: 'consumption', quantity: '-1', orderId, orderLineId: null });
      const conLinea = await tx.inventoryMovement.count({ where: { orderLineId: lineId } });
      expect(conLinea).toBe(1);
    });
  });
});

describe('down.sql de order_lines_references', () => {
  it('R8: la bajada quita columnas, indices y CHECK y deja las seis tablas como estaban', async () => {
    await inRolledBackTransaction(async (tx) => {
      await runDowns(tx, LATER_DOWNS);
      await runScript(tx, DOWN_SQL);
      const antes: Record<string, readonly string[]> = {};
      for (const table of CHILD_TABLES) antes[table] = await schemaSnapshot(tx, table);

      await runScript(tx, UP_SQL);
      for (const table of CHILD_TABLES) {
        expect((await schemaSnapshot(tx, table)).some((line) => line.startsWith('K order_line_id uuid YES'))).toBe(true);
      }
      await runScript(tx, DOWN_SQL);

      for (const table of CHILD_TABLES) {
        expect(await schemaSnapshot(tx, table), table).toEqual(antes[table]);
      }
    });
  });

  it('R8: la bajada se niega si una fila con linea es de un pedido de varias lineas, y dice cuantas', async () => {
    await inRolledBackTransaction(async (tx) => {
      await runDowns(tx, LATER_DOWNS);
      const base = await seedBase(tx);
      const orderId = await seedOrder(tx, base);
      const primera = await insertLine(tx, base, orderId, 0, base.recipeId);
      await insertLine(tx, base, orderId, 1, await seedRecipe(tx, base.companyId));
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "order_execution_entries" ("company_id", "order_id", "user_id", "action", "occurred_at", "order_line_id")
        VALUES (${base.companyId}::uuid, ${orderId}::uuid, ${base.userId}::uuid, 'START', now(), ${primera}::uuid)
      `);
      await insertMovement(tx, base, { kind: 'consumption', quantity: '-1', orderId, orderLineId: primera });

      const message = await expectRejectedByDatabase(tx, () => runScript(tx, DOWN_SQL), 'bajar con un pedido de varias lineas');
      expect(message).toContain('order_lines_references: 2 fila(s)');

      const columnas = await schemaSnapshot(tx, 'order_execution_entries');
      expect(columnas.some((line) => line.startsWith('K order_line_id '))).toBe(true);
    });
  });

  it('R8: la bajada pasa si las filas con linea son de pedidos de una sola linea', async () => {
    await inRolledBackTransaction(async (tx) => {
      await runDowns(tx, LATER_DOWNS);
      const base = await seedBase(tx);
      const orderId = await seedOrder(tx, base);
      const linea = await insertLine(tx, base, orderId, 0, base.recipeId);
      await insertMovement(tx, base, { kind: 'consumption', quantity: '-1', orderId, orderLineId: linea });

      await runScript(tx, DOWN_SQL);

      const columnas = await schemaSnapshot(tx, 'inventory_movements');
      expect(columnas.some((line) => line.startsWith('K order_line_id '))).toBe(false);
    });
  });
});
