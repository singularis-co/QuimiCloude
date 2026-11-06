/**
 * La migracion `*_order_status_partial` contra Postgres real: el valor PARCIAL delante de
 * PENDIENTE y su `down.sql`, que se niega con un pedido PARCIAL y, sin ninguno, deja el tipo con
 * los diez valores de antes.
 *
 * Cada caso corre en una transaccion que termina en ROLLBACK. Para bajar esta migracion hay que
 * bajar antes las posteriores que dependen del tipo, como en una reversion real.
 */
import { Prisma } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/shared/db/prisma';

import {
  enumValues,
  expectRejectedByDatabase,
  freshSequence,
  inRolledBackTransaction,
  readMigration,
  runDowns,
  runScript,
  schemaSnapshot,
  seedCompany,
  seedRecipe,
  statementsOf,
} from '../../helpers/migration-script';

const DOWN_SQL = readMigration('_order_status_partial', 'down.sql');
const [ABORT_BLOCK] = statementsOf(DOWN_SQL);

const LATER_DOWNS = [
  '_orders_drop_line_columns',
  '_order_lines_references_required',
  '_order_lines_references',
  '_order_lines',
] as const;

const TEN_VALUES = [
  'PENDIENTE',
  'EN_CURSO',
  'ENTREGADO',
  'CANCELADO',
  'POR_EMPACAR',
  'EN_EMPAQUE',
  'BLOQUEADO',
  'POR_ACONDICIONAR',
  'EN_ACONDICIONAMIENTO',
  'TERMINADO',
] as const;

async function seedOrder(
  tx: Prisma.TransactionClient,
  companyId: string,
  recipeId: string,
  status: 'PARCIAL' | 'PENDIENTE',
): Promise<string> {
  void recipeId;
  const order = await tx.order.create({
    data: { companyId, orderYear: new Date().getUTCFullYear(), orderSequence: freshSequence(), status },
    select: { id: true },
  });
  return order.id;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('migration.sql de order_status_partial', () => {
  it('R52: el enum queda con PARCIAL delante de PENDIENTE y el resto en su orden', async () => {
    await inRolledBackTransaction(async (tx) => {
      expect(await enumValues(tx, 'OrderStatus')).toEqual(['PARCIAL', ...TEN_VALUES]);
    });
  });

  it('R52: ordenar por estado ascendente pone los PARCIAL antes que los PENDIENTE', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await seedCompany(tx);
      const recipeId = await seedRecipe(tx, companyId);
      const pendiente = await seedOrder(tx, companyId, recipeId, 'PENDIENTE');
      const parcial = await seedOrder(tx, companyId, recipeId, 'PARCIAL');

      const asc = await tx.order.findMany({ where: { companyId }, orderBy: { status: 'asc' }, select: { id: true } });
      expect(asc.map((row) => row.id)).toEqual([parcial, pendiente]);
      const desc = await tx.order.findMany({ where: { companyId }, orderBy: { status: 'desc' }, select: { id: true } });
      expect(desc.map((row) => row.id)).toEqual([pendiente, parcial]);
    });
  });
});

describe('down.sql de order_status_partial', () => {
  it('R52: con un pedido PARCIAL la bajada aborta y no toca el tipo', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await seedCompany(tx);
      const recipeId = await seedRecipe(tx, companyId);
      await seedOrder(tx, companyId, recipeId, 'PARCIAL');
      const antes = await enumValues(tx, 'OrderStatus');

      const message = await expectRejectedByDatabase(
        tx,
        () => tx.$executeRawUnsafe(ABORT_BLOCK as string),
        'DOWN de order_status_partial con un pedido PARCIAL',
      );
      expect(message).toContain('ROLLBACK ABORTADO');
      expect(message).toContain('PARCIAL');
      expect(await enumValues(tx, 'OrderStatus')).toEqual(antes);
    });
  });

  it('R52: sin pedidos PARCIAL la bajada deja el tipo con los diez valores y orders como estaba', async () => {
    await inRolledBackTransaction(async (tx) => {
      expect(await tx.order.count({ where: { status: 'PARCIAL' } })).toBe(0);
      await runDowns(tx, LATER_DOWNS);
      const ordersAntes = await schemaSnapshot(tx, 'orders');

      await runScript(tx, DOWN_SQL);

      expect(await enumValues(tx, 'OrderStatus')).toEqual([...TEN_VALUES]);
      expect(await schemaSnapshot(tx, 'orders')).toEqual(ordersAntes);
    });
  });
});
