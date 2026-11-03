/**
 * La migracion `*_order_lines` contra Postgres real: el relleno de una linea por pedido, las
 * restricciones de la tabla y su `down.sql`.
 *
 * Cada caso corre en una transaccion que termina en ROLLBACK. Para probar el relleno se baja la
 * migracion (y las posteriores que dependen de ella) dentro de la transaccion, se siembran pedidos
 * y se vuelve a aplicar el `migration.sql` real.
 */
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
  tableExists,
} from '../../helpers/migration-script';

const UP_SQL = readMigration('_order_lines', 'migration.sql');
const DOWN_SQL = readMigration('_order_lines', 'down.sql');
const LATER_DOWNS = ['_orders_drop_line_columns', '_order_lines_references'] as const;

type OrderSeed = {
  readonly status: 'PENDIENTE' | 'EN_CURSO' | 'CANCELADO' | 'ENTREGADO' | 'BLOQUEADO';
  readonly recipeId: string;
  readonly quantity?: string;
  readonly unitId?: string | null;
  readonly cancellationReason?: string | null;
  readonly ingredientsCost?: string | null;
  readonly packagingCost?: string | null;
  readonly actualCost?: string | null;
  readonly salePrice?: string | null;
  readonly reservedAt?: Date | null;
  readonly finishedAt?: Date | null;
  readonly packedBy?: string | null;
  readonly conditionedBy?: string | null;
  readonly deletedAt?: Date | null;
};

async function seedOrder(tx: Prisma.TransactionClient, companyId: string, seed: OrderSeed): Promise<string> {
  const decimal = (value: string | null | undefined) => (value == null ? null : new Prisma.Decimal(value));
  const order = await tx.order.create({
    data: {
      companyId,
      orderYear: new Date().getUTCFullYear(),
      orderSequence: freshSequence(),
      recipeId: seed.recipeId,
      quantity: new Prisma.Decimal(seed.quantity ?? '10'),
      status: seed.status,
      unitId: seed.unitId ?? null,
      cancellationReason: seed.cancellationReason ?? null,
      ingredientsCost: decimal(seed.ingredientsCost),
      packagingCost: decimal(seed.packagingCost),
      actualCost: decimal(seed.actualCost),
      salePrice: decimal(seed.salePrice),
      reservedAt: seed.reservedAt ?? null,
      finishedAt: seed.finishedAt ?? null,
      packedBy: seed.packedBy ?? null,
      conditionedBy: seed.conditionedBy ?? null,
      deletedAt: seed.deletedAt ?? null,
    },
    select: { id: true },
  });
  return order.id;
}

type LineValues = {
  readonly recipeId: string;
  readonly quantity?: string;
  readonly status?: string;
  readonly cancellationReason?: string | null;
  readonly salePrice?: string | null;
  readonly deletedAt?: Date | null;
  readonly position: number;
};

async function insertLine(
  tx: Prisma.TransactionClient,
  orderId: string,
  companyId: string,
  originalRecipeId: string,
  values: LineValues,
): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "order_lines" (
      "order_id", "company_id", "position", "recipe_id", "original_recipe_id", "quantity",
      "status", "cancellation_reason", "sale_price", "deleted_at", "updated_at"
    ) VALUES (
      ${orderId}::uuid, ${companyId}::uuid, ${values.position}, ${values.recipeId}::uuid,
      ${originalRecipeId}::uuid, ${values.quantity ?? '1'}::numeric,
      ${values.status ?? 'PENDIENTE'}::"OrderStatus", ${values.cancellationReason ?? null},
      ${values.salePrice ?? null}::numeric, ${values.deletedAt ?? null}::timestamptz, now()
    )
  `);
}

async function seedUnit(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
  const unit = await tx.unit.create({
    data: { name: `Unidad ${companyId}`, nameNormalized: `unidad${companyId}`, companyId },
    select: { id: true },
  });
  return unit.id;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('relleno de order_lines', () => {
  it('R7: cada pedido, borrados incluidos, queda con exactamente una linea con sus valores, NULL incluidos, y su estado intacto', async () => {
    await inRolledBackTransaction(async (tx) => {
      await runDowns(tx, LATER_DOWNS);
      await runScript(tx, DOWN_SQL);

      const companyId = await seedCompany(tx);
      const original = await seedRecipe(tx, companyId);
      const version = await seedRecipe(tx, companyId, original);
      const unitId = await seedUnit(tx, companyId);
      const packer = await seedUser(tx, companyId);
      const conditioner = await seedUser(tx, companyId);
      const reservedAt = new Date('2026-10-01T12:00:00.000Z');
      const finishedAt = new Date('2026-10-20T08:30:00.000Z');

      const ids = [
        await seedOrder(tx, companyId, {
          status: 'PENDIENTE',
          recipeId: original,
          quantity: '12.3456',
          unitId,
          ingredientsCost: '150.2500',
          packagingCost: '20.0000',
          salePrice: '0',
          reservedAt,
        }),
        await seedOrder(tx, companyId, { status: 'EN_CURSO', recipeId: version, unitId }),
        await seedOrder(tx, companyId, { status: 'BLOQUEADO', recipeId: original }),
        await seedOrder(tx, companyId, {
          status: 'CANCELADO',
          recipeId: original,
          cancellationReason: 'Ya no lo necesita',
        }),
        await seedOrder(tx, companyId, {
          status: 'ENTREGADO',
          recipeId: version,
          unitId,
          ingredientsCost: '99.9999',
          packagingCost: '0.0000',
          actualCost: '101.5000',
          salePrice: '250.0000',
          finishedAt,
          packedBy: packer,
          conditionedBy: conditioner,
        }),
        await seedOrder(tx, companyId, {
          status: 'PENDIENTE',
          recipeId: original,
          deletedAt: new Date('2026-10-05T00:00:00.000Z'),
        }),
      ];
      const pedidosAntes = await tx.order.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });

      await runScript(tx, UP_SQL);

      expect(await tx.orderLine.count()).toBe(await tx.order.count());
      const pedidosDespues = await tx.order.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
      expect(pedidosDespues).toEqual(pedidosAntes);

      for (const order of pedidosAntes) {
        const lines = await tx.orderLine.findMany({ where: { orderId: order.id } });
        expect(lines, `el pedido ${order.id} debe tener una sola linea`).toHaveLength(1);
        const line = lines[0]!;
        expect({
          companyId: line.companyId,
          position: line.position,
          recipeId: line.recipeId,
          quantity: line.quantity.toFixed(4),
          unitId: line.unitId,
          status: line.status,
          cancellationReason: line.cancellationReason,
          ingredientsCost: line.ingredientsCost?.toFixed(4) ?? null,
          packagingCost: line.packagingCost?.toFixed(4) ?? null,
          actualCost: line.actualCost?.toFixed(4) ?? null,
          salePrice: line.salePrice?.toFixed(4) ?? null,
          reservedAt: line.reservedAt,
          finishedAt: line.finishedAt,
          packedBy: line.packedBy,
          conditionedBy: line.conditionedBy,
          deletedAt: line.deletedAt,
        }).toEqual({
          companyId: order.companyId,
          position: 0,
          recipeId: order.recipeId,
          quantity: order.quantity.toFixed(4),
          unitId: order.unitId,
          status: order.status,
          cancellationReason: order.cancellationReason,
          ingredientsCost: order.ingredientsCost?.toFixed(4) ?? null,
          packagingCost: order.packagingCost?.toFixed(4) ?? null,
          actualCost: order.actualCost?.toFixed(4) ?? null,
          salePrice: order.salePrice?.toFixed(4) ?? null,
          reservedAt: order.reservedAt,
          finishedAt: order.finishedAt,
          packedBy: order.packedBy,
          conditionedBy: order.conditionedBy,
          deletedAt: order.deletedAt,
        });
        expect(line.originalRecipeId).toBe(original);
      }
    });
  });
});

describe('restricciones de order_lines', () => {
  async function seedBase(tx: Prisma.TransactionClient) {
    const companyId = await seedCompany(tx);
    const original = await seedRecipe(tx, companyId);
    const version = await seedRecipe(tx, companyId, original);
    const orderId = await seedOrder(tx, companyId, { status: 'PENDIENTE', recipeId: original });
    return { companyId, original, version, orderId };
  }

  it('R2: la base rechaza una linea cuya empresa no es la de su pedido', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { original, orderId } = await seedBase(tx);
      const otraEmpresa = await seedCompany(tx);
      const message = await expectRejectedByDatabase(
        tx,
        () => insertLine(tx, orderId, otraEmpresa, original, { recipeId: original, position: 0 }),
        'linea de otra empresa',
      );
      expect(message).toContain('order_lines_order_id_company_id_fkey');
    });
  });

  it('R15: la base rechaza cantidad 0 y precio de linea negativo, y admite precio 0', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { companyId, original, orderId } = await seedBase(tx);
      expect(
        await expectRejectedByDatabase(
          tx,
          () => insertLine(tx, orderId, companyId, original, { recipeId: original, position: 0, quantity: '0' }),
          'cantidad 0',
        ),
      ).toContain('order_lines_quantity_positive');
      expect(
        await expectRejectedByDatabase(
          tx,
          () => insertLine(tx, orderId, companyId, original, { recipeId: original, position: 0, salePrice: '-0.0001' }),
          'precio negativo',
        ),
      ).toContain('order_lines_sale_price_non_negative');
      await insertLine(tx, orderId, companyId, original, { recipeId: original, position: 0, salePrice: '0' });
      expect(await tx.orderLine.count({ where: { orderId } })).toBe(1);
    });
  });

  it('R48: la base rechaza una linea PARCIAL', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { companyId, original, orderId } = await seedBase(tx);
      const message = await expectRejectedByDatabase(
        tx,
        () => insertLine(tx, orderId, companyId, original, { recipeId: original, position: 0, status: 'PARCIAL' }),
        'linea PARCIAL',
      );
      expect(message).toContain('order_lines_status_not_partial');
    });
  });

  it('R5: la base rechaza dos lineas activas con la misma original, y tambien original + version', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { companyId, original, version, orderId } = await seedBase(tx);
      await insertLine(tx, orderId, companyId, original, { recipeId: original, position: 0 });
      expect(
        await expectRejectedByDatabase(
          tx,
          () => insertLine(tx, orderId, companyId, original, { recipeId: original, position: 1 }),
          'dos lineas de la misma receta',
        ),
      ).toContain('Key (order_id, original_recipe_id)');
      expect(
        await expectRejectedByDatabase(
          tx,
          () => insertLine(tx, orderId, companyId, original, { recipeId: version, position: 1 }),
          'original + version',
        ),
      ).toContain('Key (order_id, original_recipe_id)');
    });
  });

  it('R5: la base admite la misma original si una de las dos esta cancelada o quitada', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { companyId, original, version, orderId } = await seedBase(tx);
      await insertLine(tx, orderId, companyId, original, {
        recipeId: original,
        position: 0,
        status: 'CANCELADO',
        cancellationReason: 'Se cambio de receta',
      });
      await insertLine(tx, orderId, companyId, original, {
        recipeId: version,
        position: 1,
        deletedAt: new Date('2026-11-01T00:00:00.000Z'),
      });
      await insertLine(tx, orderId, companyId, original, { recipeId: original, position: 2 });
      expect(await tx.orderLine.count({ where: { orderId } })).toBe(3);
    });
  });

  it('R6: la base rechaza dos lineas con la misma posicion en un pedido', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { companyId, original, orderId } = await seedBase(tx);
      const otra = await seedRecipe(tx, companyId);
      await insertLine(tx, orderId, companyId, original, { recipeId: original, position: 0 });
      expect(
        await expectRejectedByDatabase(
          tx,
          () => insertLine(tx, orderId, companyId, otra, { recipeId: otra, position: 0 }),
          'posicion repetida',
        ),
      ).toContain('Key (order_id, "position")');
    });
  });

  it('R2: order_lines tiene RLS activada y forzada', async () => {
    await inRolledBackTransaction(async (tx) => {
      const rows = await tx.$queryRaw<ReadonlyArray<{ enabled: boolean; forced: boolean }>>(Prisma.sql`
        SELECT relrowsecurity AS enabled, relforcerowsecurity AS forced FROM pg_class
         WHERE relname = 'order_lines' AND relnamespace = 'public'::regnamespace
      `);
      expect(rows).toEqual([{ enabled: true, forced: true }]);
    });
  });
});

describe('down.sql de order_lines', () => {
  it('R7: la bajada quita la tabla y deja orders como estaba', async () => {
    await inRolledBackTransaction(async (tx) => {
      await runDowns(tx, LATER_DOWNS);
      const ordersAntes = await schemaSnapshot(tx, 'orders');

      await runScript(tx, DOWN_SQL);

      expect(await tableExists(tx, 'order_lines')).toBe(false);
      expect(await schemaSnapshot(tx, 'orders')).toEqual(ordersAntes);
    });
  });
});
