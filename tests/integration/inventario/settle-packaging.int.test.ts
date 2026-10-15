/**
 * `settlePackagingForOrder` (`reservation-prisma.ts`) contra Postgres real.
 *
 * AISLAMIENTO -- igual que `reservation.int.test.ts`: `createWithFirstBatch` y `addBatchToAlive`
 * abren su propia `prisma.$transaction` contra el cliente global, asi que cada caso fabrica su
 * propia empresa efimera y la limpia en un `finally`. El caso de `insufficient` envuelve solo esa
 * llamada en una `prisma.$transaction` que se deshace, como hara `pedidos` al recibirlo.
 */
import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import { normalizeCompanyName } from '@/lib/modules/identity';
import { addBatchToAlive, createWithFirstBatch } from '@/lib/modules/inventario/adapters/driven/persistence/product-prisma';
import {
  createMaterialReservations,
  findReservedAndAvailableByProduct,
} from '@/lib/modules/inventario/adapters/driven/persistence/reservation-prisma';
import { prisma } from '@/lib/shared/db/prisma';

import type { NewProductBatch } from '@/lib/modules/inventario/domain/product-batch';
import type { ConsumptionOutcome, ReservationRequirementLine } from '@/lib/modules/inventario/domain/reservation';

function token(): string {
  return randomUUID().replace(/-/gu, '');
}

function normalizeForTest(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]/gu, '');
}

class RollbackSignal extends Error {
  constructor() {
    super('rollback de aislamiento del caso');
    this.name = 'RollbackSignal';
  }
}

type Fixture = {
  readonly actorId: string;
  readonly companyId: string;
  readonly roleId: string;
  readonly documentTypeCode: string;
  readonly presentationId: string;
  readonly recipeId: string;
};

async function createFixture(): Promise<Fixture> {
  const marker = token();
  const documentType = await prisma.documentType.create({
    data: { code: `DOC${marker.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  });
  const role = await prisma.role.create({ data: { name: `rol-${marker}`, description: 'Rol de prueba' }, select: { id: true } });
  const companyName = `Empresa ${marker}`;
  const company = await prisma.company.create({
    data: { name: companyName, nameNormalized: normalizeCompanyName(companyName) },
    select: { id: true },
  });
  const user = await prisma.user.create({
    data: {
      firstNames: 'Ana Maria',
      lastNames: 'Perez Gomez',
      birthDate: new Date('1990-05-17T00:00:00.000Z'),
      email: `ana.${marker}@quimicloude.test`,
      phone: '+57 300 111 2233',
      documentTypeCode: documentType.code,
      documentNumber: marker.slice(0, 12),
      username: `ana.${marker}`,
      passwordHash: 'hash-de-prueba-no-es-un-algoritmo-real',
      roleId: role.id,
      companyId: company.id,
    },
    select: { id: true },
  });
  const unit = await prisma.unit.findFirstOrThrow({ where: { nameNormalized: 'kilogramo', companyId: null }, select: { id: true } });
  const presentationName = `Botella ${token()}`;
  const presentation = await prisma.presentation.create({
    data: { name: presentationName, nameNormalized: normalizeForTest(presentationName), unitId: unit.id, companyId: company.id },
    select: { id: true },
  });
  const recipeName = `Receta ${token()}`;
  const recipe = await prisma.recipe.create({
    data: { name: recipeName, nameNormalized: normalizeForTest(recipeName), companyId: company.id, createdBy: user.id },
    select: { id: true },
  });
  return {
    actorId: user.id,
    companyId: company.id,
    roleId: role.id,
    documentTypeCode: documentType.code,
    presentationId: presentation.id,
    recipeId: recipe.id,
  };
}

async function dropFixture(fixture: Fixture): Promise<void> {
  const { companyId } = fixture;
  await prisma.reservationMovement.deleteMany({ where: { companyId } });
  await prisma.inventoryMovement.deleteMany({ where: { companyId } });
  await prisma.order.deleteMany({ where: { companyId } });
  await prisma.productBatch.deleteMany({ where: { companyId } });
  await prisma.product.deleteMany({ where: { companyId } });
  await prisma.recipe.deleteMany({ where: { companyId } });
  await prisma.presentation.deleteMany({ where: { companyId } });
  await prisma.user.delete({ where: { id: fixture.actorId } });
  await prisma.role.delete({ where: { id: fixture.roleId } });
  await prisma.documentType.delete({ where: { code: fixture.documentTypeCode } });
  await prisma.company.delete({ where: { id: companyId } });
}

let orderSequence = 0;

async function createOrderRow(fixture: Fixture): Promise<string> {
  orderSequence += 1;
  const order = await prisma.order.create({
    data: {
      orderYear: new Date().getUTCFullYear(),
      orderSequence,
      recipeId: fixture.recipeId,
      quantity: new Prisma.Decimal('1'),
      companyId: fixture.companyId,
      createdBy: fixture.actorId,
      updatedBy: fixture.actorId,
    },
    select: { id: true },
  });
  return order.id;
}

function newBatch(fixture: Fixture, stock: string, purchaseDate: string): NewProductBatch {
  return {
    presentationId: fixture.presentationId,
    stock,
    unitCost: '1.5000',
    lot: null,
    purchaseDate,
    expiryDate: null,
    createdBy: fixture.actorId,
  };
}

async function createEnvase(fixture: Fixture, stock: string, purchaseDate = '2026-09-01'): Promise<{ productId: string; batchId: string }> {
  const created = await createWithFirstBatch(
    { name: `Envase ${token()}` },
    newBatch(fixture, stock, purchaseDate),
    new Date(),
    { companyId: fixture.companyId },
  );
  return { productId: created.id, batchId: created.batchId };
}

async function addBatch(fixture: Fixture, productId: string, stock: string, purchaseDate: string): Promise<string> {
  const added = await addBatchToAlive(productId, newBatch(fixture, stock, purchaseDate), new Date(), { companyId: fixture.companyId });
  if (added === null || added === 'finished_product') throw new Error('no se pudo anadir el lote de prueba');
  return added.batchId;
}

function req(productId: string, quantity: string): ReservationRequirementLine {
  return { productId, quantity };
}

async function reserve(fixture: Fixture, orderId: string, requirement: readonly ReservationRequirementLine[]): Promise<void> {
  const outcome = await createMaterialReservations(prisma).syncForOrder({
    orderId,
    companyId: fixture.companyId,
    requirement,
    actorId: fixture.actorId,
    now: new Date(),
  });
  expect(outcome.kind).toBe('reserved');
}

async function settle(fixture: Fixture, orderId: string, requirement: readonly ReservationRequirementLine[]): Promise<ConsumptionOutcome> {
  return createMaterialReservations(prisma).settlePackagingForOrder({
    orderId,
    companyId: fixture.companyId,
    requirement,
    actorId: fixture.actorId,
    now: new Date(),
  });
}

async function batchStockOf(batchId: string): Promise<string> {
  const batch = await prisma.productBatch.findUniqueOrThrow({ where: { id: batchId }, select: { stock: true } });
  return batch.stock.toFixed(4);
}

async function productStockOf(productId: string): Promise<string> {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { stock: true } });
  return product.stock.toFixed(4);
}

async function ledgerOf(orderId: string): Promise<readonly string[]> {
  const rows = await prisma.reservationMovement.findMany({
    where: { orderId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { batchId: true, kind: true, quantity: true },
  });
  return rows.map((row) => `${row.batchId}:${row.kind}:${row.quantity.toFixed(4)}`);
}

async function consumptionsOf(orderId: string): Promise<readonly string[]> {
  const rows = await prisma.inventoryMovement.findMany({
    where: { orderId, kind: 'consumption' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { batchId: true, quantity: true },
  });
  return rows.map((row) => `${row.batchId}:${row.quantity.toFixed(4)}`);
}

async function availableOf(fixture: Fixture, productId: string): Promise<string | undefined> {
  const totals = await findReservedAndAvailableByProduct(prisma, fixture.companyId, [productId]);
  return totals.get(productId)?.available;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('settlePackagingForOrder', () => {
  it('R17: con menos envases reales consume solo los reales, libera la diferencia y el disponible del envase sube', async () => {
    const fixture = await createFixture();
    try {
      const envase = await createEnvase(fixture, '10');
      const ingrediente = await createEnvase(fixture, '10');
      const orderId = await createOrderRow(fixture);
      await reserve(fixture, orderId, [req(envase.productId, '5'), req(ingrediente.productId, '2')]);
      expect(await availableOf(fixture, envase.productId)).toBe('5.0000');

      const outcome = await settle(fixture, orderId, [req(envase.productId, '3')]);

      expect(outcome).toEqual({ kind: 'consumed' });
      expect(await batchStockOf(envase.batchId)).toBe('7.0000');
      expect(await productStockOf(envase.productId)).toBe('7.0000');
      expect(await availableOf(fixture, envase.productId)).toBe('7.0000');
      expect(await consumptionsOf(orderId)).toEqual([`${envase.batchId}:-3.0000`]);
      const ledger = await ledgerOf(orderId);
      expect(ledger).toContain(`${envase.batchId}:consume:3.0000`);
      expect(ledger).toContain(`${envase.batchId}:release:2.0000`);
      // Un producto que no viene en la necesidad conserva su apartado intacto.
      expect(ledger.filter((row) => row.startsWith(ingrediente.batchId))).toEqual([`${ingrediente.batchId}:reserve:2.0000`]);
      expect(await batchStockOf(ingrediente.batchId)).toBe('10.0000');
    } finally {
      await dropFixture(fixture);
    }
  });

  it('R17: con los mismos envases que el plan consume todo lo apartado y no libera nada', async () => {
    const fixture = await createFixture();
    try {
      const envase = await createEnvase(fixture, '10');
      const orderId = await createOrderRow(fixture);
      await reserve(fixture, orderId, [req(envase.productId, '4')]);

      expect(await settle(fixture, orderId, [req(envase.productId, '4')])).toEqual({ kind: 'consumed' });

      expect(await batchStockOf(envase.batchId)).toBe('6.0000');
      expect(await ledgerOf(orderId)).toEqual([`${envase.batchId}:reserve:4.0000`, `${envase.batchId}:consume:4.0000`]);
    } finally {
      await dropFixture(fixture);
    }
  });

  it('R19: con 0 envases reales libera todo lo apartado del envase y no consume nada', async () => {
    const fixture = await createFixture();
    try {
      const envase = await createEnvase(fixture, '10');
      const orderId = await createOrderRow(fixture);
      await reserve(fixture, orderId, [req(envase.productId, '4')]);

      expect(await settle(fixture, orderId, [req(envase.productId, '0')])).toEqual({ kind: 'consumed' });

      expect(await batchStockOf(envase.batchId)).toBe('10.0000');
      expect(await productStockOf(envase.productId)).toBe('10.0000');
      expect(await availableOf(fixture, envase.productId)).toBe('10.0000');
      expect(await consumptionsOf(orderId)).toEqual([]);
      expect(await ledgerOf(orderId)).toEqual([`${envase.batchId}:reserve:4.0000`, `${envase.batchId}:release:4.0000`]);
    } finally {
      await dropFixture(fixture);
    }
  });

  it('R18/R29: con mas envases reales consume lo apartado y el exceso del libre, sin tocar el apartado de otro pedido', async () => {
    const fixture = await createFixture();
    try {
      const envase = await createEnvase(fixture, '5', '2026-08-01');
      const nuevo = await addBatch(fixture, envase.productId, '10', '2026-09-01');
      const orderId = await createOrderRow(fixture);
      const otherOrderId = await createOrderRow(fixture);
      await reserve(fixture, orderId, [req(envase.productId, '4')]);
      await reserve(fixture, otherOrderId, [req(envase.productId, '3')]);
      const otherLedgerBefore = await ledgerOf(otherOrderId);

      const outcome = await settle(fixture, orderId, [req(envase.productId, '9')]);

      expect(outcome).toEqual({ kind: 'consumed' });
      // Lote viejo: 4 apartados propios; queda 1 que aparta el otro pedido. El exceso (5) sale del nuevo.
      expect(await batchStockOf(envase.batchId)).toBe('1.0000');
      expect(await batchStockOf(nuevo)).toBe('5.0000');
      expect(await productStockOf(envase.productId)).toBe('6.0000');
      expect([...(await consumptionsOf(orderId))].sort()).toEqual([`${envase.batchId}:-4.0000`, `${nuevo}:-5.0000`].sort());
      expect(await ledgerOf(orderId)).toEqual([`${envase.batchId}:reserve:4.0000`, `${envase.batchId}:consume:4.0000`]);
      expect(await ledgerOf(otherOrderId)).toEqual(otherLedgerBefore);
      // El otro pedido sigue cubierto: su apartado (3) cabe en lo que queda.
      expect(await availableOf(fixture, envase.productId)).toBe('3.0000');
    } finally {
      await dropFixture(fixture);
    }
  });

  it('R18: si el libre no alcanza para el exceso devuelve insufficient y, deshecha la transaccion, nada queda escrito', async () => {
    const fixture = await createFixture();
    try {
      const envase = await createEnvase(fixture, '10');
      const orderId = await createOrderRow(fixture);
      const otherOrderId = await createOrderRow(fixture);
      await reserve(fixture, orderId, [req(envase.productId, '4')]);
      await reserve(fixture, otherOrderId, [req(envase.productId, '5')]);
      const ledgerBefore = await ledgerOf(orderId);
      const otherLedgerBefore = await ledgerOf(otherOrderId);

      let outcome: ConsumptionOutcome | null = null;
      await expect(
        prisma.$transaction(async (tx) => {
          outcome = await createMaterialReservations(tx).settlePackagingForOrder({
            orderId,
            companyId: fixture.companyId,
            requirement: [req(envase.productId, '6')],
            actorId: fixture.actorId,
            now: new Date(),
          });
          throw new RollbackSignal();
        }),
      ).rejects.toBeInstanceOf(RollbackSignal);

      expect(outcome).toEqual({ kind: 'insufficient', productIds: [envase.productId] });
      expect(await batchStockOf(envase.batchId)).toBe('10.0000');
      expect(await productStockOf(envase.productId)).toBe('10.0000');
      expect(await consumptionsOf(orderId)).toEqual([]);
      expect(await ledgerOf(orderId)).toEqual(ledgerBefore);
      expect(await ledgerOf(otherOrderId)).toEqual(otherLedgerBefore);
    } finally {
      await dropFixture(fixture);
    }
  });

  it('R29: un envase de otra empresa no se ve: insufficient y su lote y su libro quedan intactos', async () => {
    const fixture = await createFixture();
    const otherFixture = await createFixture();
    try {
      const ajeno = await createEnvase(otherFixture, '10');
      const otherCompanyOrderId = await createOrderRow(otherFixture);
      await reserve(otherFixture, otherCompanyOrderId, [req(ajeno.productId, '4')]);
      const ajenoLedgerBefore = await ledgerOf(otherCompanyOrderId);
      const orderId = await createOrderRow(fixture);

      let outcome: ConsumptionOutcome | null = null;
      await expect(
        prisma.$transaction(async (tx) => {
          outcome = await createMaterialReservations(tx).settlePackagingForOrder({
            orderId,
            companyId: fixture.companyId,
            requirement: [req(ajeno.productId, '2')],
            actorId: fixture.actorId,
            now: new Date(),
          });
          throw new RollbackSignal();
        }),
      ).rejects.toBeInstanceOf(RollbackSignal);

      expect(outcome).toEqual({ kind: 'insufficient', productIds: [ajeno.productId] });
      expect(await batchStockOf(ajeno.batchId)).toBe('10.0000');
      expect(await ledgerOf(otherCompanyOrderId)).toEqual(ajenoLedgerBefore);
      expect(await ledgerOf(orderId)).toEqual([]);
    } finally {
      await dropFixture(fixture);
      await dropFixture(otherFixture);
    }
  });

  it('R29: con el pedido de otra empresa no ve su apartado y no lo libera ni lo consume', async () => {
    const fixture = await createFixture();
    const otherFixture = await createFixture();
    try {
      const envase = await createEnvase(fixture, '10');
      const orderId = await createOrderRow(fixture);
      await reserve(fixture, orderId, [req(envase.productId, '4')]);
      const ledgerBefore = await ledgerOf(orderId);

      const outcome = await createMaterialReservations(prisma).settlePackagingForOrder({
        orderId,
        companyId: otherFixture.companyId,
        requirement: [req(envase.productId, '0')],
        actorId: otherFixture.actorId,
        now: new Date(),
      });

      expect(outcome).toEqual({ kind: 'consumed' });
      expect(await ledgerOf(orderId)).toEqual(ledgerBefore);
      expect(await batchStockOf(envase.batchId)).toBe('10.0000');
    } finally {
      await dropFixture(fixture);
      await dropFixture(otherFixture);
    }
  });

  it('R19: sin envases en la necesidad no escribe nada', async () => {
    const fixture = await createFixture();
    try {
      const orderId = await createOrderRow(fixture);
      expect(await settle(fixture, orderId, [])).toEqual({ kind: 'nothing_to_consume' });
      expect(await ledgerOf(orderId)).toEqual([]);
    } finally {
      await dropFixture(fixture);
    }
  });
});
