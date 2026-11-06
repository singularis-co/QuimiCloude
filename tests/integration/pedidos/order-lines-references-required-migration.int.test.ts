/**
 * La migracion `*_order_lines_references_required` contra Postgres real: repite el relleno, aborta
 * si queda una fila sin linea que no se puede asignar, y deja `order_line_id` obligatorio con el
 * CHECK definitivo, las FK compuestas y los unicos y la PK por linea. Tambien su `down.sql`.
 *
 * Cada caso corre en una transaccion que termina en ROLLBACK. Para probar el relleno se baja esta
 * migracion (y las posteriores) dentro de la transaccion, se siembran filas sin linea y se vuelve a
 * aplicar el `migration.sql` real. Las filas de las tablas hijas se escriben con SQL crudo: el
 * cliente de Prisma exige ya la linea.
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

const UP_SQL = readMigration('_order_lines_references_required', 'migration.sql');
const DOWN_SQL = readMigration('_order_lines_references_required', 'down.sql');
const LATER_DOWNS = ['_orders_drop_line_columns'] as const;

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
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "inventory_movements" (
      "batch_id", "kind", "quantity", "reason", "order_id", "order_presentation_line_id",
      "order_delivery_id", "order_delivery_void_id", "company_id", "order_line_id"
    ) VALUES (
      ${base.batchId}::uuid, CAST(${m.kind} AS "InventoryMovementKind"), CAST(${m.quantity} AS decimal(14,4)),
      ${m.reason ?? null}, ${m.orderId ?? null}::uuid, ${m.presentationLineId ?? null}::uuid,
      ${m.deliveryId ?? null}::uuid, ${m.voidId ?? null}::uuid, ${base.companyId}::uuid,
      ${m.orderLineId ?? null}::uuid
    )
  `);
}

async function insertDelivery(tx: Prisma.TransactionClient, base: Base, orderId: string): Promise<string> {
  const deliveryId = randomUUID();
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "order_deliveries" ("id", "company_id", "order_id", "delivery_key", "created_by")
    VALUES (${deliveryId}::uuid, ${base.companyId}::uuid, ${orderId}::uuid, ${randomUUID()}::uuid, ${base.userId}::uuid)
  `);
  return deliveryId;
}

/**
 * Una fila sin linea en cada una de las seis tablas para el pedido, y en `inventory_movements` los
 * cuatro asientos con pedido. `presentationId` y `slot` dejan sembrar dos pedidos sin chocar.
 */
async function seedChildrenWithoutLine(
  tx: Prisma.TransactionClient,
  base: Base,
  orderId: string,
): Promise<void> {
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

  const deliveryId = await insertDelivery(tx, base, orderId);
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

/** Baja esta migracion y las posteriores: las tablas hijas vuelven a admitir filas sin linea. */
async function toStepOne(tx: Prisma.TransactionClient): Promise<void> {
  await runDowns(tx, LATER_DOWNS);
  await runScript(tx, DOWN_SQL);
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('relleno de order_lines_references_required', () => {
  it('R8: un pedido creado sin linea antes de aplicarla la recibe y todas sus filas apuntan a ella', async () => {
    await inRolledBackTransaction(async (tx) => {
      await toStepOne(tx);
      const base = await seedBase(tx);
      const orderId = await seedOrder(tx, base);
      await seedChildrenWithoutLine(tx, base, orderId);
      expect(await tx.orderLine.count({ where: { orderId } })).toBe(0);

      await runScript(tx, UP_SQL);

      const lineas = await tx.orderLine.findMany({ where: { orderId }, select: { id: true, position: true } });
      expect(lineas).toHaveLength(1);
      expect(lineas[0]?.position).toBe(0);
      for (const table of CHILD_TABLES) {
        const lines = await lineIdsOf(tx, table, orderId);
        expect(lines.length, `${table} debe tener filas del pedido`).toBeGreaterThan(0);
        expect(lines, table).toEqual(lines.map(() => lineas[0]?.id));
      }
    });
  });

  it('R8, R37: un pedido con linea y filas sin ella las une a su linea, delivery_void con la misma que su delivery', async () => {
    await inRolledBackTransaction(async (tx) => {
      await toStepOne(tx);
      const base = await seedBase(tx);
      const orderId = await seedOrder(tx, base);
      const lineId = await insertLine(tx, base, orderId, 0, base.recipeId);
      await seedChildrenWithoutLine(tx, base, orderId);
      await insertMovement(tx, base, { kind: 'opening', quantity: '5' });

      await runScript(tx, UP_SQL);

      expect(await tx.orderLine.count({ where: { orderId } })).toBe(1);
      for (const table of CHILD_TABLES) {
        const lines = await lineIdsOf(tx, table, orderId);
        expect(lines, table).toEqual(lines.map(() => lineId));
      }
      const porTipo = await tx.inventoryMovement.findMany({
        where: { batchId: base.batchId },
        select: { kind: true, orderLineId: true },
      });
      expect(Object.fromEntries(porTipo.map((m) => [m.kind, m.orderLineId]))).toEqual({
        consumption: lineId,
        production: lineId,
        delivery: lineId,
        delivery_void: lineId,
        opening: null,
      });
    });
  });

  it('R8: una fila sin linea de un pedido de dos lineas hace abortar la migracion nombrando la tabla y cuantas', async () => {
    await inRolledBackTransaction(async (tx) => {
      await toStepOne(tx);
      const base = await seedBase(tx);
      const orderId = await seedOrder(tx, base);
      await insertLine(tx, base, orderId, 0, base.recipeId);
      await insertLine(tx, base, orderId, 1, await seedRecipe(tx, base.companyId));
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "reservation_movements" ("company_id", "order_id", "batch_id", "kind", "quantity", "created_by")
        VALUES
          (${base.companyId}::uuid, ${orderId}::uuid, ${base.batchId}::uuid, 'reserve', 3, ${base.userId}::uuid),
          (${base.companyId}::uuid, ${orderId}::uuid, ${base.batchId}::uuid, 'release', 3, ${base.userId}::uuid)
      `);
      await insertMovement(tx, base, { kind: 'consumption', quantity: '-1', orderId });

      const message = await expectRejectedByDatabase(tx, () => runScript(tx, UP_SQL), 'subir con filas sin linea');
      expect(message).toContain('order_lines_references_required');
      expect(message).toContain('reservation_movements (2)');
      expect(message).toContain('inventory_movements (1)');
      expect(message).not.toContain('order_execution_entries');
    });
  });
});

describe('order_line_id obligatorio', () => {
  it('R37: la base rechaza una fila sin linea en cada una de las cinco tablas', async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = await seedBase(tx);
      const orderId = await seedOrder(tx, base);
      await insertLine(tx, base, orderId, 0, base.recipeId);

      const inserts: Record<Exclude<ChildTable, 'inventory_movements'>, Prisma.Sql> = {
        order_presentation_lines: Prisma.sql`
          INSERT INTO "order_presentation_lines" ("order_id", "company_id", "presentation_id", "packages", "updated_at")
          VALUES (${orderId}::uuid, ${base.companyId}::uuid, ${base.presentationId}::uuid, 4, now())`,
        reservation_movements: Prisma.sql`
          INSERT INTO "reservation_movements" ("company_id", "order_id", "batch_id", "kind", "quantity")
          VALUES (${base.companyId}::uuid, ${orderId}::uuid, ${base.batchId}::uuid, 'reserve', 3)`,
        order_execution_entries: Prisma.sql`
          INSERT INTO "order_execution_entries" ("company_id", "order_id", "user_id", "action", "occurred_at")
          VALUES (${base.companyId}::uuid, ${orderId}::uuid, ${base.userId}::uuid, 'START', now())`,
        order_step_evidence: Prisma.sql`
          INSERT INTO "order_step_evidence"
            ("company_id", "order_id", "phase", "step_position", "slot", "path", "content_type", "size_bytes", "uploaded_by")
          VALUES (${base.companyId}::uuid, ${orderId}::uuid, 'MANUFACTURING', 1, 1,
                  ${`${base.companyId}/${orderId}/${randomUUID()}.jpg`}, 'image/jpeg', 1024, ${base.userId}::uuid)`,
        order_conditioning_team_members: Prisma.sql`
          INSERT INTO "order_conditioning_team_members" ("company_id", "order_id", "user_id", "position")
          VALUES (${base.companyId}::uuid, ${orderId}::uuid, ${base.userId}::uuid, 0)`,
      };
      for (const [table, sql] of Object.entries(inserts)) {
        const message = await expectRejectedByDatabase(tx, () => tx.$executeRaw(sql), `${table} sin linea`);
        // not_null_violation: el mensaje de Prisma trae el codigo, no el nombre de la columna.
        expect(message, table).toContain('23502');
      }
    });
  });

  it('R37: la base rechaza un delivery sin linea y una linea en un asiento sin pedido', async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = await seedBase(tx);
      const orderId = await seedOrder(tx, base);
      const lineId = await insertLine(tx, base, orderId, 0, base.recipeId);
      const deliveryId = await insertDelivery(tx, base, orderId);

      expect(
        await expectRejectedByDatabase(
          tx,
          () => insertMovement(tx, base, { kind: 'delivery', quantity: '-2', orderId, deliveryId }),
          'delivery sin linea',
        ),
      ).toContain('inventory_movements_order_line_id_matches_kind');
      expect(
        await expectRejectedByDatabase(
          tx,
          () => insertMovement(tx, base, { kind: 'consumption', quantity: '-1', orderId }),
          'consumption sin linea',
        ),
      ).toContain('inventory_movements_order_line_id_matches_kind');
      expect(
        await expectRejectedByDatabase(
          tx,
          () => insertMovement(tx, base, { kind: 'opening', quantity: '5', orderLineId: lineId }),
          'opening con linea',
        ),
      ).toContain('inventory_movements_order_line_id_matches_kind');

      await insertMovement(tx, base, { kind: 'delivery', quantity: '-2', orderId, deliveryId, orderLineId: lineId });
      await insertMovement(tx, base, { kind: 'opening', quantity: '5' });
      expect(await tx.inventoryMovement.count({ where: { batchId: base.batchId } })).toBe(2);
    });
  });

  it('R37: la base rechaza la linea de otro pedido en cada una de las seis tablas', async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = await seedBase(tx);
      const orderId = await seedOrder(tx, base);
      await insertLine(tx, base, orderId, 0, base.recipeId);
      const otroPedido = await seedOrder(tx, base);
      const ajena = await insertLine(tx, base, otroPedido, 0, base.recipeId);

      const inserts: Record<ChildTable, Prisma.Sql> = {
        order_presentation_lines: Prisma.sql`
          INSERT INTO "order_presentation_lines" ("order_id", "company_id", "presentation_id", "packages", "updated_at", "order_line_id")
          VALUES (${orderId}::uuid, ${base.companyId}::uuid, ${base.presentationId}::uuid, 4, now(), ${ajena}::uuid)`,
        reservation_movements: Prisma.sql`
          INSERT INTO "reservation_movements" ("company_id", "order_id", "batch_id", "kind", "quantity", "order_line_id")
          VALUES (${base.companyId}::uuid, ${orderId}::uuid, ${base.batchId}::uuid, 'reserve', 3, ${ajena}::uuid)`,
        inventory_movements: Prisma.sql`
          INSERT INTO "inventory_movements" ("batch_id", "kind", "quantity", "order_id", "company_id", "order_line_id")
          VALUES (${base.batchId}::uuid, 'consumption', -1, ${orderId}::uuid, ${base.companyId}::uuid, ${ajena}::uuid)`,
        order_execution_entries: Prisma.sql`
          INSERT INTO "order_execution_entries" ("company_id", "order_id", "user_id", "action", "occurred_at", "order_line_id")
          VALUES (${base.companyId}::uuid, ${orderId}::uuid, ${base.userId}::uuid, 'START', now(), ${ajena}::uuid)`,
        order_step_evidence: Prisma.sql`
          INSERT INTO "order_step_evidence"
            ("company_id", "order_id", "phase", "step_position", "slot", "path", "content_type", "size_bytes", "uploaded_by", "order_line_id")
          VALUES (${base.companyId}::uuid, ${orderId}::uuid, 'MANUFACTURING', 1, 1,
                  ${`${base.companyId}/${orderId}/${randomUUID()}.jpg`}, 'image/jpeg', 1024, ${base.userId}::uuid, ${ajena}::uuid)`,
        order_conditioning_team_members: Prisma.sql`
          INSERT INTO "order_conditioning_team_members" ("company_id", "order_id", "user_id", "position", "order_line_id")
          VALUES (${base.companyId}::uuid, ${orderId}::uuid, ${base.userId}::uuid, 0, ${ajena}::uuid)`,
      };
      for (const table of CHILD_TABLES) {
        const message = await expectRejectedByDatabase(tx, () => tx.$executeRaw(inserts[table]), `${table} con linea ajena`);
        expect(message, table).toContain(`${table}_order_line_id_order_id_fkey`);
      }
    });
  });

  it('R37: dos lineas del mismo pedido pueden repetir presentacion, slot de evidencia y persona del equipo', async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = await seedBase(tx);
      const orderId = await seedOrder(tx, base);
      const lineas = [
        await insertLine(tx, base, orderId, 0, base.recipeId),
        await insertLine(tx, base, orderId, 1, await seedRecipe(tx, base.companyId)),
      ];
      for (const lineId of lineas) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "order_presentation_lines" ("order_id", "company_id", "presentation_id", "packages", "updated_at", "order_line_id")
          VALUES (${orderId}::uuid, ${base.companyId}::uuid, ${base.presentationId}::uuid, 4, now(), ${lineId}::uuid)`);
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "order_step_evidence"
            ("company_id", "order_id", "phase", "step_position", "slot", "path", "content_type", "size_bytes", "uploaded_by", "order_line_id")
          VALUES (${base.companyId}::uuid, ${orderId}::uuid, 'MANUFACTURING', 1, 1,
                  ${`${base.companyId}/${orderId}/${randomUUID()}.jpg`}, 'image/jpeg', 1024, ${base.userId}::uuid, ${lineId}::uuid)`);
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "order_conditioning_team_members" ("company_id", "order_id", "user_id", "position", "order_line_id")
          VALUES (${base.companyId}::uuid, ${orderId}::uuid, ${base.userId}::uuid, 0, ${lineId}::uuid)`);
      }

      expect(await tx.orderPresentationLine.count({ where: { orderId } })).toBe(2);
      expect(await tx.orderStepEvidence.count({ where: { orderId } })).toBe(2);
      expect(await tx.orderConditioningTeamMember.count({ where: { orderId } })).toBe(2);
    });
  });
});

describe('down.sql de order_lines_references_required', () => {
  it('R8: subir y bajar deja las seis tablas como estaban', async () => {
    await inRolledBackTransaction(async (tx) => {
      await toStepOne(tx);
      const antes: Record<string, readonly string[]> = {};
      for (const table of CHILD_TABLES) antes[table] = await schemaSnapshot(tx, table);

      await runScript(tx, UP_SQL);
      for (const table of CHILD_TABLES.filter((t) => t !== 'inventory_movements')) {
        expect((await schemaSnapshot(tx, table)).some((line) => line.startsWith('K order_line_id uuid NO')), table).toBe(true);
      }
      await runScript(tx, DOWN_SQL);

      for (const table of CHILD_TABLES) {
        expect(await schemaSnapshot(tx, table), table).toEqual(antes[table]);
      }
    });
  });

  it('R8: la bajada se niega si los unicos por pedido chocarian, dice cuantos y no cambia nada', async () => {
    await inRolledBackTransaction(async (tx) => {
      await runDowns(tx, LATER_DOWNS);
      const base = await seedBase(tx);
      const orderId = await seedOrder(tx, base);
      const lineas = [
        await insertLine(tx, base, orderId, 0, base.recipeId),
        await insertLine(tx, base, orderId, 1, await seedRecipe(tx, base.companyId)),
      ];
      for (const lineId of lineas) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "order_presentation_lines" ("order_id", "company_id", "presentation_id", "packages", "updated_at", "order_line_id")
          VALUES (${orderId}::uuid, ${base.companyId}::uuid, ${base.presentationId}::uuid, 4, now(), ${lineId}::uuid)`);
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "order_conditioning_team_members" ("company_id", "order_id", "user_id", "position", "order_line_id")
          VALUES (${base.companyId}::uuid, ${orderId}::uuid, ${base.userId}::uuid, 0, ${lineId}::uuid)`);
      }
      const antes = await schemaSnapshot(tx, 'order_conditioning_team_members');

      const message = await expectRejectedByDatabase(tx, () => runScript(tx, DOWN_SQL), 'bajar con choques');
      // Reparto por presentacion, equipo por persona y equipo por posicion.
      expect(message).toContain('order_lines_references_required: 3 choque(s)');
      expect(await schemaSnapshot(tx, 'order_conditioning_team_members')).toEqual(antes);
    });
  });

  it('R8: la bajada pasa con pedidos de una sola linea y la columna vuelve a admitir NULL', async () => {
    await inRolledBackTransaction(async (tx) => {
      await runDowns(tx, LATER_DOWNS);
      const base = await seedBase(tx);
      const orderId = await seedOrder(tx, base);
      const lineId = await insertLine(tx, base, orderId, 0, base.recipeId);
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "order_conditioning_team_members" ("company_id", "order_id", "user_id", "position", "order_line_id")
        VALUES (${base.companyId}::uuid, ${orderId}::uuid, ${base.userId}::uuid, 0, ${lineId}::uuid)`);

      await runScript(tx, DOWN_SQL);

      const columnas = await schemaSnapshot(tx, 'order_conditioning_team_members');
      expect(columnas.some((line) => line.startsWith('K order_line_id uuid YES'))).toBe(true);
      expect(await lineIdsOf(tx, 'order_conditioning_team_members', orderId)).toEqual([lineId]);
    });
  });
});
