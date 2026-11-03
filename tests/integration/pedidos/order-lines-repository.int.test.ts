/**
 * Las lecturas de lineas de `createOrderWriteRepository` (`order-prisma.ts`) contra Postgres real.
 *
 * Cada caso corre en una transaccion que termina en ROLLBACK, y el repositorio recibe ese mismo
 * `tx`: ninguna fila sobrevive.
 */
import { Prisma } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import { createOrderWriteRepository } from '@/lib/modules/pedidos/adapters/driven/persistence/order-prisma';
import { prisma } from '@/lib/shared/db/prisma';

import { freshSequence, inRolledBackTransaction, seedCompany, seedRecipe } from '../../helpers/migration-script';

type Base = { readonly companyId: string; readonly recipeId: string };

async function seedBase(tx: Prisma.TransactionClient): Promise<Base> {
  const companyId = await seedCompany(tx);
  const recipeId = await seedRecipe(tx, companyId);
  return { companyId, recipeId };
}

async function insertOrder(tx: Prisma.TransactionClient, base: Base): Promise<string> {
  const { id } = await tx.order.create({
    data: {
      companyId: base.companyId,
      orderYear: 2026,
      orderSequence: freshSequence(),
      recipeId: base.recipeId,
      quantity: new Prisma.Decimal('10'),
    },
    select: { id: true },
  });
  return id;
}

async function insertLine(tx: Prisma.TransactionClient, base: Base, orderId: string, position: number): Promise<string> {
  const recipeId = position === 0 ? base.recipeId : await seedRecipe(tx, base.companyId);
  const { id } = await tx.orderLine.create({
    data: {
      orderId,
      companyId: base.companyId,
      position,
      recipeId,
      originalRecipeId: recipeId,
      quantity: new Prisma.Decimal('10'),
    },
    select: { id: true },
  });
  return id;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('QT-313 OrderWriteRepository.findOnlyLineId', () => {
  it('QT-313 R37: con una linea devuelve su id', async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = await seedBase(tx);
      const orderId = await insertOrder(tx, base);
      const lineId = await insertLine(tx, base, orderId, 0);

      expect(await createOrderWriteRepository(tx).findOnlyLineId(orderId, { companyId: base.companyId })).toBe(lineId);
    });
  });

  it('QT-313 R37: sin ninguna linea devuelve null', async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = await seedBase(tx);
      const orderId = await insertOrder(tx, base);

      expect(await createOrderWriteRepository(tx).findOnlyLineId(orderId, { companyId: base.companyId })).toBeNull();
    });
  });

  it('QT-313 R37: con el ambito de otra empresa devuelve null aunque el pedido tenga linea', async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = await seedBase(tx);
      const otra = await seedCompany(tx);
      const orderId = await insertOrder(tx, base);
      await insertLine(tx, base, orderId, 0);

      expect(await createOrderWriteRepository(tx).findOnlyLineId(orderId, { companyId: otra })).toBeNull();
    });
  });

  it('QT-313 R37: una linea quitada no cuenta; con dos vivas lanza en vez de elegir una', async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = await seedBase(tx);
      const orderId = await insertOrder(tx, base);
      const primera = await insertLine(tx, base, orderId, 0);
      const segunda = await insertLine(tx, base, orderId, 1);
      const repository = createOrderWriteRepository(tx);

      await expect(repository.findOnlyLineId(orderId, { companyId: base.companyId })).rejects.toThrow(
        /mas de una linea/u,
      );

      await tx.orderLine.update({ where: { id: segunda }, data: { deletedAt: new Date() } });
      expect(await repository.findOnlyLineId(orderId, { companyId: base.companyId })).toBe(primera);
    });
  });
});
