/**
 * `createOrderConsumptionLedger(tx).findConsumedLots` contra Postgres real: lo que un pedido
 * consumio de cada lote, neto, con el `unit_cost` del lote en el instante de leerlo.
 *
 * AISLAMIENTO: cada `it` corre en una transaccion interactiva que termina en `RollbackSignal`; el
 * adaptador recibe ese mismo `tx`, asi que ninguna fila sobrevive.
 */
import { randomUUID } from 'node:crypto';

import { Prisma, type InventoryMovementKind, type ProductType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { normalizeCompanyName } from '@/lib/modules/identity';
import { normalizePresentationName, type ConsumedLot } from '@/lib/modules/inventario';
import { createOrderConsumptionLedger } from '@/lib/modules/inventario/adapters/driven/persistence/order-consumption-prisma';
import { prisma } from '@/lib/shared/db/prisma';

class RollbackSignal extends Error {
  constructor() {
    super('rollback de aislamiento del test');
    this.name = 'RollbackSignal';
  }
}

async function inRolledBackTransaction(body: (tx: Prisma.TransactionClient) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await body(tx);
        throw new RollbackSignal();
      },
      { maxWait: 20_000, timeout: 60_000 },
    );
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error;
  }
}

function token(): string {
  return randomUUID().replace(/-/gu, '');
}

type Company = {
  readonly companyId: string;
  readonly recipeId: string;
  readonly unitId: string;
  readonly presentationId: string;
};

async function seedCompany(tx: Prisma.TransactionClient): Promise<Company> {
  const marca = token();
  const name = `Empresa consumo ${marca}`;
  const company = await tx.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name) },
    select: { id: true },
  });
  const recipe = await tx.recipe.create({
    data: { name: `Receta ${marca}`, nameNormalized: `receta${marca}`, companyId: company.id },
    select: { id: true },
  });
  const ml = await tx.unit.findFirstOrThrow({
    where: { companyId: null, nameNormalized: 'mililitro' },
    select: { id: true },
  });
  const presentationName = `Botella ${marca}`;
  const presentation = await tx.presentation.create({
    data: {
      name: presentationName,
      nameNormalized: normalizePresentationName(presentationName),
      unitId: ml.id,
      companyId: company.id,
      content: '500',
    },
    select: { id: true },
  });
  return { companyId: company.id, recipeId: recipe.id, unitId: ml.id, presentationId: presentation.id };
}

async function insertBatch(
  tx: Prisma.TransactionClient,
  c: Company,
  unitCost: string | null,
  type: ProductType = 'PRODUCT',
): Promise<string> {
  const name = `Producto ${token()}`;
  const product = await tx.product.create({
    data: { name, nameNormalized: name.toLowerCase(), type, companyId: c.companyId, unitId: c.unitId },
    select: { id: true },
  });
  const batch = await tx.productBatch.create({
    data: {
      productId: product.id,
      presentationId: c.presentationId,
      stock: new Prisma.Decimal('1000'),
      unitCost: unitCost === null ? null : new Prisma.Decimal(unitCost),
      lot: `L-${token()}`,
      purchaseDate: new Date('2026-09-01T00:00:00Z'),
      companyId: c.companyId,
    },
    select: { id: true },
  });
  return batch.id;
}

let nextSequence = 960_000;

async function insertOrder(tx: Prisma.TransactionClient, c: Company): Promise<string> {
  nextSequence += 1;
  const order = await tx.order.create({
    data: {
      companyId: c.companyId,
      orderYear: new Date().getUTCFullYear(),
      orderSequence: nextSequence,
      recipeId: c.recipeId,
      quantity: new Prisma.Decimal('20'),
      unitId: c.unitId,
    },
    select: { id: true },
  });
  return order.id;
}

async function insertMovement(
  tx: Prisma.TransactionClient,
  c: Company,
  movement: {
    readonly batchId: string;
    readonly quantity: string;
    readonly kind?: InventoryMovementKind;
    readonly orderId?: string | null;
    readonly reason?: string | null;
    readonly orderPresentationLineId?: string | null;
  },
): Promise<void> {
  const kind = movement.kind ?? 'consumption';
  await tx.inventoryMovement.create({
    data: {
      batchId: movement.batchId,
      kind,
      quantity: new Prisma.Decimal(movement.quantity),
      reason: movement.reason ?? null,
      orderId: movement.orderId ?? null,
      orderPresentationLineId: movement.orderPresentationLineId ?? null,
      companyId: c.companyId,
    },
  });
}

function byBatch(lots: readonly ConsumedLot[]): ReadonlyMap<string, ConsumedLot> {
  return new Map(lots.map((lot) => [lot.batchId, lot] as const));
}

describe('OrderConsumptionLedger.findConsumedLots', () => {
  it('R2: devuelve, neto y por lote, el ingrediente de dos lotes y los envases con su excedente', async () => {
    await inRolledBackTransaction(async (tx) => {
      const c = await seedCompany(tx);
      const orderId = await insertOrder(tx, c);
      const lote1A = await insertBatch(tx, c, '10.0000');
      const lote1B = await insertBatch(tx, c, '20.0000');
      const envase = await insertBatch(tx, c, '0.2500', 'PACKAGING');
      await insertMovement(tx, c, { batchId: lote1A, quantity: '-8.0000', orderId });
      await insertMovement(tx, c, { batchId: lote1B, quantity: '-2.0000', orderId });
      // Envases del plan y, aparte, el excedente contado al Terminar: los dos al mismo lote.
      await insertMovement(tx, c, { batchId: envase, quantity: '-40.0000', orderId });
      await insertMovement(tx, c, { batchId: envase, quantity: '-3.0000', orderId });

      const lots = await createOrderConsumptionLedger(tx).findConsumedLots({ orderId, companyId: c.companyId });

      expect(lots).toHaveLength(3);
      expect(byBatch(lots).get(lote1A)).toEqual({ batchId: lote1A, quantity: '8.0000', unitCost: '10.0000' });
      expect(byBatch(lots).get(lote1B)).toEqual({ batchId: lote1B, quantity: '2.0000', unitCost: '20.0000' });
      expect(byBatch(lots).get(envase)).toEqual({ batchId: envase, quantity: '43.0000', unitCost: '0.2500' });
    });
  });

  it('R3: cuenta el lote del asiento aunque el pedido no lo tuviera apartado', async () => {
    await inRolledBackTransaction(async (tx) => {
      const c = await seedCompany(tx);
      const orderId = await insertOrder(tx, c);
      const apartado = await insertBatch(tx, c, '10.0000');
      const consumido = await insertBatch(tx, c, '30.0000');
      await tx.reservationMovement.create({
        data: {
          companyId: c.companyId,
          orderId,
          batchId: apartado,
          kind: 'reserve',
          quantity: new Prisma.Decimal('5.0000'),
        },
      });
      await insertMovement(tx, c, { batchId: consumido, quantity: '-5.0000', orderId });

      const lots = await createOrderConsumptionLedger(tx).findConsumedLots({ orderId, companyId: c.companyId });

      expect(lots).toEqual([{ batchId: consumido, quantity: '5.0000', unitCost: '30.0000' }]);
    });
  });

  it('R4: deja fuera los asientos de otro pedido y los que no son de consumo', async () => {
    await inRolledBackTransaction(async (tx) => {
      const c = await seedCompany(tx);
      const orderId = await insertOrder(tx, c);
      const otherOrderId = await insertOrder(tx, c);
      const lote = await insertBatch(tx, c, '10.0000');
      const deOtro = await insertBatch(tx, c, '99.0000');
      const line = await tx.orderPresentationLine.create({
        data: { orderId, companyId: c.companyId, presentationId: c.presentationId, packages: 4, presentationContent: '500' },
        select: { id: true },
      });
      await insertMovement(tx, c, { batchId: lote, quantity: '-1.5000', orderId });
      await insertMovement(tx, c, { batchId: deOtro, quantity: '-7.0000', orderId: otherOrderId });
      await insertMovement(tx, c, { batchId: lote, quantity: '-4.0000', orderId: otherOrderId });
      // Del mismo pedido, pero de otro tipo: la produccion de su linea.
      await insertMovement(tx, c, {
        batchId: lote,
        quantity: '2000.0000',
        kind: 'production',
        orderId,
        orderPresentationLineId: line.id,
      });
      await insertMovement(tx, c, { batchId: lote, quantity: '100.0000', kind: 'opening' });
      await insertMovement(tx, c, { batchId: lote, quantity: '-6.0000', kind: 'adjustment', reason: 'merma' });

      const lots = await createOrderConsumptionLedger(tx).findConsumedLots({ orderId, companyId: c.companyId });

      expect(lots).toEqual([{ batchId: lote, quantity: '1.5000', unitCost: '10.0000' }]);
    });
  });

  it('R4: con la empresa equivocada no devuelve nada del pedido, aunque el id exista', async () => {
    await inRolledBackTransaction(async (tx) => {
      const c = await seedCompany(tx);
      const otra = await seedCompany(tx);
      const orderId = await insertOrder(tx, c);
      const lote = await insertBatch(tx, c, '10.0000');
      await insertMovement(tx, c, { batchId: lote, quantity: '-8.0000', orderId });

      const ledger = createOrderConsumptionLedger(tx);

      expect(await ledger.findConsumedLots({ orderId, companyId: otra.companyId })).toEqual([]);
      expect(await ledger.findConsumedLots({ orderId, companyId: c.companyId })).toHaveLength(1);
    });
  });

  it('R2: un lote cuyo neto queda en 0 no se devuelve', async () => {
    await inRolledBackTransaction(async (tx) => {
      const c = await seedCompany(tx);
      const orderId = await insertOrder(tx, c);
      const neto0 = await insertBatch(tx, c, '10.0000');
      const otro = await insertBatch(tx, c, '20.0000');
      await insertMovement(tx, c, { batchId: neto0, quantity: '-2.0000', orderId });
      await insertMovement(tx, c, { batchId: neto0, quantity: '2.0000', orderId });
      await insertMovement(tx, c, { batchId: otro, quantity: '-1.0000', orderId });

      const lots = await createOrderConsumptionLedger(tx).findConsumedLots({ orderId, companyId: c.companyId });

      expect(lots).toEqual([{ batchId: otro, quantity: '1.0000', unitCost: '20.0000' }]);
    });
  });

  it('R7: un lote sin coste unitario vuelve con unitCost null', async () => {
    await inRolledBackTransaction(async (tx) => {
      const c = await seedCompany(tx);
      const orderId = await insertOrder(tx, c);
      const sinCoste = await insertBatch(tx, c, null);
      await insertMovement(tx, c, { batchId: sinCoste, quantity: '-3.2500', orderId });

      const lots = await createOrderConsumptionLedger(tx).findConsumedLots({ orderId, companyId: c.companyId });

      expect(lots).toEqual([{ batchId: sinCoste, quantity: '3.2500', unitCost: null }]);
    });
  });

  it('R7: un pedido sin asientos de consumo devuelve la lista vacia', async () => {
    await inRolledBackTransaction(async (tx) => {
      const c = await seedCompany(tx);
      const orderId = await insertOrder(tx, c);

      expect(await createOrderConsumptionLedger(tx).findConsumedLots({ orderId, companyId: c.companyId })).toEqual([]);
    });
  });

  it('R9: lee el unit_cost del lote en el instante de leerlo, no el del consumo', async () => {
    await inRolledBackTransaction(async (tx) => {
      const c = await seedCompany(tx);
      const orderId = await insertOrder(tx, c);
      const lote = await insertBatch(tx, c, '10.0000');
      await insertMovement(tx, c, { batchId: lote, quantity: '-8.0000', orderId });
      await tx.productBatch.update({ where: { id: lote }, data: { unitCost: new Prisma.Decimal('12.5000') } });

      const lots = await createOrderConsumptionLedger(tx).findConsumedLots({ orderId, companyId: c.companyId });

      expect(lots).toEqual([{ batchId: lote, quantity: '8.0000', unitCost: '12.5000' }]);
    });
  });
});
