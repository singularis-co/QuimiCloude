/**
 * QT-313 T16: el recorrido de un pedido de dos lineas que comparten un insumo, contra Postgres real.
 * Alta, cancelar una linea y finalizar la otra, afirmando lote a lote lo apartado, lo liberado y lo
 * consumido.
 *
 * El insumo tiene dos lotes: uno viejo que no alcanza para las dos lineas y uno nuevo. Asi el reparto
 * entre lotes y entre lineas (la segunda ve lo que aparto la primera) queda a la vista.
 *
 * AISLAMIENTO: `commit`. `withOrderTransaction` abre su propia transaccion sobre el cliente global;
 * el caso siembra una empresa efimera y la borra en su `finally`.
 */
import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import { normalizeCompanyName } from '@/lib/modules/identity';
import { findAliveCustomerRefById } from '@/lib/modules/clientes/adapters/driven/persistence/customer-catalog-prisma';
import { createFinishedGoodsIntake } from '@/lib/modules/inventario/adapters/driven/persistence/finished-goods-prisma';
import {
  findPackagingCostingBatches,
  findPackagingRefs,
} from '@/lib/modules/inventario/adapters/driven/persistence/packaging-catalog-prisma';
import {
  findPresentationRefs,
  findPresentationsByNormalizedNames,
} from '@/lib/modules/inventario/adapters/driven/persistence/presentation-catalog-prisma';
import { findCostingBatches, findProductRefs } from '@/lib/modules/inventario/adapters/driven/persistence/product-catalog-prisma';
import {
  addBatchToAlive,
  createWithFirstBatch,
  findFinishedGoodsReceipts,
} from '@/lib/modules/inventario/adapters/driven/persistence/product-prisma';
import { createMaterialReservations } from '@/lib/modules/inventario/adapters/driven/persistence/reservation-prisma';
import { createCancelOrderLine, createCreateOrder, createTransitionOrder } from '@/lib/modules/pedidos';
import { createOrderWriteRepository } from '@/lib/modules/pedidos/adapters/driven/persistence/order-prisma';
import { withOrderTransaction } from '@/lib/modules/pedidos/adapters/driven/persistence/order-unit-of-work-prisma';
import {
  createRecipeExecutionReader,
  findAliveRecipeByNormalizedName,
  findRecipeExecutionContentById,
  findRecipeIdsMatchingName,
  findRecipeRefsIncludingDeleted,
} from '@/lib/modules/recetas/adapters/driven/persistence/recipe-catalog-prisma';
import { findMassVolumeBridge, findUnitRefs } from '@/lib/modules/unidades/adapters/driven/persistence/unit-catalog-prisma';
import { findUnitRefsSharingBaseInCompany } from '@/lib/modules/unidades/adapters/driven/persistence/unit-prisma';
import { prisma } from '@/lib/shared/db/prisma';

import { orderScopeReaders } from '../../helpers/order-scope-readers';

import type { PackagingCatalog, PresentationCatalog, ProductCatalog } from '@/lib/modules/inventario';
import type { Actor } from '@/lib/modules/pedidos';
import type { OrderTransactionScope, OrderUnitOfWork } from '@/lib/modules/pedidos/ports/order-unit-of-work';
import type { RecipeCatalog } from '@/lib/modules/recetas';
import type { UnitCatalog } from '@/lib/modules/unidades';

const unitOfWork: OrderUnitOfWork = {
  run: (work) =>
    withOrderTransaction((tx) => {
      const scope: OrderTransactionScope = {
        orders: createOrderWriteRepository(tx),
        reservations: createMaterialReservations(tx),
        recipes: createRecipeExecutionReader(tx),
        ...orderScopeReaders(tx),
        finishedGoods: createFinishedGoodsIntake(tx),
      };
      return work(scope);
    }),
};

const recipes: RecipeCatalog = {
  findRefsIncludingDeleted: findRecipeRefsIncludingDeleted,
  findExecutionContentById: findRecipeExecutionContentById,
  findIdsMatchingName: findRecipeIdsMatchingName,
  findAliveByNormalizedName: findAliveRecipeByNormalizedName,
};
const products: ProductCatalog = { findRefs: findProductRefs, findCostingBatches, findFinishedGoodsReceipts };
const presentations: PresentationCatalog = { findRefs: findPresentationRefs, findByNormalizedNames: findPresentationsByNormalizedNames };
const packaging: PackagingCatalog = { findRefs: findPackagingRefs, findCostingBatches: findPackagingCostingBatches };
const units: UnitCatalog = {
  findRefs: findUnitRefs,
  listVisibleRefs: () => Promise.reject(new Error('no se usa')),
  findMassVolumeBridge: () => findMassVolumeBridge(),
  findRefsSharingBaseInCompany: findUnitRefsSharingBaseInCompany,
};
const customerCatalog = {
  findAliveRefById: (id: string, companyId: string) => findAliveCustomerRefById(id, { companyId }),
};

const createOrder = createCreateOrder({ customerCatalog, recipes, products, units, presentations, packaging, unitOfWork });
const cancelOrderLine = createCancelOrderLine({ unitOfWork });
const transition = createTransitionOrder({ unitOfWork });

function token(): string {
  return randomUUID().replace(/-/gu, '');
}

type Fixture = {
  readonly companyId: string;
  readonly actorId: string;
  readonly roleId: string;
  readonly documentTypeCode: string;
  readonly presentationId: string;
  readonly unitId: string;
  /** El insumo que comparten las dos recetas. */
  readonly productId: string;
  /** 40 a 2.5000, comprado primero: se aparta antes que el nuevo. */
  readonly oldBatchId: string;
  /** 100 a 3.0000, comprado despues. */
  readonly newBatchId: string;
};

function actorDe(fixture: Fixture): Actor {
  return { id: fixture.actorId, companyId: fixture.companyId, permissions: ['pedidos.consultar', 'pedidos.modificar'] };
}

async function crearFixture(): Promise<Fixture> {
  const marca = token();
  const documentType = await prisma.documentType.create({
    data: { code: `DOC${marca.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  });
  const role = await prisma.role.create({ data: { name: `rol-${marca}`, description: 'Rol de prueba' }, select: { id: true } });
  const nombre = `Empresa ${marca}`;
  const company = await prisma.company.create({
    data: { name: nombre, nameNormalized: normalizeCompanyName(nombre) },
    select: { id: true },
  });
  const user = await prisma.user.create({
    data: {
      firstNames: 'Ana',
      lastNames: 'Perez',
      birthDate: new Date('1990-05-17T00:00:00.000Z'),
      email: `ana.${marca}@quimicloude.test`,
      phone: '+57 300 111 2233',
      documentTypeCode: documentType.code,
      documentNumber: marca.slice(0, 12),
      username: `ana.${marca}`,
      passwordHash: 'hash-de-prueba-no-es-un-algoritmo-real',
      roleId: role.id,
      companyId: company.id,
    },
    select: { id: true },
  });
  const unit = await prisma.unit.create({
    data: { name: `Unidad ${marca}`, nameNormalized: `unidad${marca}`, symbol: `kg${marca}` },
    select: { id: true },
  });
  const presentation = await prisma.presentation.create({
    data: { name: `Bidon ${marca}`, nameNormalized: `bidon${marca}`, unitId: unit.id, companyId: company.id, content: '1.0000' },
    select: { id: true },
  });
  const scope = { companyId: company.id };
  const insumo = await createWithFirstBatch(
    { name: `Insumo ${marca}` },
    { presentationId: presentation.id, stock: '40', unitCost: '2.5000', lot: null, purchaseDate: '2026-09-01', expiryDate: null, createdBy: user.id },
    new Date(),
    scope,
  );
  const nuevo = await addBatchToAlive(
    insumo.id,
    { presentationId: presentation.id, stock: '100', unitCost: '3.0000', lot: null, purchaseDate: '2026-09-10', expiryDate: null, createdBy: user.id },
    new Date(),
    scope,
  );
  if (nuevo === null || nuevo === 'finished_product') throw new Error('no se pudo dar de alta el segundo lote');
  const viejo = await prisma.productBatch.findFirstOrThrow({
    where: { productId: insumo.id, id: { not: nuevo.batchId } },
    select: { id: true },
  });
  return {
    companyId: company.id,
    actorId: user.id,
    roleId: role.id,
    documentTypeCode: documentType.code,
    presentationId: presentation.id,
    unitId: unit.id,
    productId: insumo.id,
    oldBatchId: viejo.id,
    newBatchId: nuevo.batchId,
  };
}

async function borrarFixture(fixture: Fixture): Promise<void> {
  const where = { companyId: fixture.companyId };
  await prisma.reservationMovement.deleteMany({ where });
  await prisma.inventoryMovement.deleteMany({ where });
  await prisma.orderExecutionEntry.deleteMany({ where });
  await prisma.orderPresentationLine.deleteMany({ where });
  await prisma.orderLine.deleteMany({ where });
  await prisma.order.deleteMany({ where });
  await prisma.recipeLine.deleteMany({ where: { recipe: where } });
  await prisma.recipe.deleteMany({ where });
  await prisma.productBatch.deleteMany({ where: { productId: fixture.productId } });
  await prisma.product.deleteMany({ where: { id: fixture.productId } });
  await prisma.presentation.deleteMany({ where: { id: fixture.presentationId } });
  await prisma.unit.deleteMany({ where: { id: fixture.unitId } });
  await prisma.user.deleteMany({ where: { id: fixture.actorId } });
  await prisma.role.deleteMany({ where: { id: fixture.roleId } });
  await prisma.documentType.deleteMany({ where: { code: fixture.documentTypeCode } });
  await prisma.company.deleteMany({ where: { id: fixture.companyId } });
}

/** Una receta con el insumo compartido al 100 %: la necesidad es la cantidad de la linea. */
async function crearReceta(fixture: Fixture): Promise<string> {
  const marca = token();
  const recipe = await prisma.recipe.create({
    data: { name: `Receta ${marca}`, nameNormalized: `receta${marca}`, companyId: fixture.companyId, createdBy: fixture.actorId },
    select: { id: true },
  });
  await prisma.recipeLine.create({ data: { recipeId: recipe.id, productId: fixture.productId, percentage: new Prisma.Decimal('100.00') } });
  return recipe.id;
}

type Asiento = readonly [lote: string, cantidad: string];

/** Los asientos de reserva de un tipo para la linea, por lote, ordenados por lote. */
async function asientosDe(fixture: Fixture, lineId: string, kind: 'reserve' | 'release' | 'consume'): Promise<readonly Asiento[]> {
  const rows = await prisma.reservationMovement.findMany({ where: { orderLineId: lineId, kind }, select: { batchId: true, quantity: true } });
  return rows.map((row) => [nombreDeLote(fixture, row.batchId), row.quantity.toFixed(4)] as const).sort(porLote);
}

/** Las salidas de stock del insumo para la linea, por lote. */
async function consumosDe(fixture: Fixture, lineId: string): Promise<readonly Asiento[]> {
  const rows = await prisma.inventoryMovement.findMany({
    where: { orderLineId: lineId, kind: 'consumption', batch: { productId: fixture.productId } },
    select: { batchId: true, quantity: true },
  });
  return rows.map((row) => [nombreDeLote(fixture, row.batchId), row.quantity.toFixed(4)] as const).sort(porLote);
}

function nombreDeLote(fixture: Fixture, batchId: string): string {
  if (batchId === fixture.oldBatchId) return 'viejo';
  if (batchId === fixture.newBatchId) return 'nuevo';
  return batchId;
}

function porLote(a: Asiento, b: Asiento): number {
  return a[0].localeCompare(b[0]);
}

async function stockDe(batchId: string): Promise<string> {
  return (await prisma.productBatch.findUniqueOrThrow({ where: { id: batchId }, select: { stock: true } })).stock.toFixed(4);
}

async function estadoDe(orderId: string, lineIds: readonly string[]) {
  const pedido = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } });
  const lineas = await prisma.orderLine.findMany({ where: { id: { in: [...lineIds] } }, select: { id: true, status: true } });
  return { pedido: pedido.status, lineas: lineIds.map((id) => lineas.find((linea) => linea.id === id)?.status) };
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('QT-313 T16 — recorrido de un pedido de dos lineas con un insumo compartido', () => {
  it('QT-313 R46: alta, cancelar una linea y finalizar la otra; lote a lote, lo apartado, lo liberado y lo consumido', async () => {
    const fixture = await crearFixture();
    try {
      // --- Alta: la primera linea (30) cabe en el lote viejo (40); la segunda (50) ve lo que
      // aparto la primera, agota el viejo (10) y completa con el nuevo (40).
      const creado = await createOrder(
        {
          lines: [
            { recipeId: await crearReceta(fixture), quantity: '30', unitId: fixture.unitId },
            { recipeId: await crearReceta(fixture), quantity: '50', unitId: fixture.unitId },
          ],
        },
        actorDe(fixture),
      );
      const filas = await prisma.orderLine.findMany({ where: { orderId: creado.id }, orderBy: { position: 'asc' }, select: { id: true } });
      expect(filas).toHaveLength(2);
      const [a, b] = filas.map((fila) => fila.id) as [string, string];

      expect(await asientosDe(fixture, a, 'reserve')).toEqual([['viejo', '30.0000']]);
      expect(await asientosDe(fixture, b, 'reserve')).toEqual([
        ['nuevo', '40.0000'],
        ['viejo', '10.0000'],
      ]);
      expect(await estadoDe(creado.id, [a, b])).toEqual({ pedido: 'PENDIENTE', lineas: ['PENDIENTE', 'PENDIENTE'] });
      // Apartar no mueve stock.
      expect([await stockDe(fixture.oldBatchId), await stockDe(fixture.newBatchId)]).toEqual(['40.0000', '100.0000']);

      // --- Cancelar la primera: libera solo lo suyo, del lote viejo, y la segunda no se toca.
      await cancelOrderLine(creado.id, a, { reason: 'el cliente ya no la quiere' }, actorDe(fixture));

      expect(await asientosDe(fixture, a, 'release')).toEqual([['viejo', '30.0000']]);
      expect(await asientosDe(fixture, b, 'release')).toEqual([]);
      expect(await asientosDe(fixture, b, 'reserve')).toEqual([
        ['nuevo', '40.0000'],
        ['viejo', '10.0000'],
      ]);
      expect(await estadoDe(creado.id, [a, b])).toEqual({ pedido: 'PENDIENTE', lineas: ['CANCELADO', 'PENDIENTE'] });

      // --- Finalizar la segunda: consume exactamente lo que tenia apartado, lote a lote.
      const ahora = new Date();
      expect(await transition(creado.id, b, fixture.companyId, 'PENDIENTE', 'EN_CURSO', fixture.actorId, ahora)).toBe('ok');
      expect(await transition(creado.id, b, fixture.companyId, 'EN_CURSO', 'POR_EMPACAR', fixture.actorId, ahora)).toBe('ok');

      expect(await asientosDe(fixture, b, 'consume')).toEqual([
        ['nuevo', '40.0000'],
        ['viejo', '10.0000'],
      ]);
      expect(await consumosDe(fixture, b)).toEqual([
        ['nuevo', '-40.0000'],
        ['viejo', '-10.0000'],
      ]);
      // La linea cancelada no consume nada, y no le queda nada apartado.
      expect(await asientosDe(fixture, a, 'consume')).toEqual([]);
      expect(await consumosDe(fixture, a)).toEqual([]);

      // El stock baja solo por lo consumido: lo liberado de la primera sigue en el lote viejo.
      expect([await stockDe(fixture.oldBatchId), await stockDe(fixture.newBatchId)]).toEqual(['30.0000', '60.0000']);
      const neto = await prisma.reservationMovement.groupBy({
        by: ['batchId', 'kind'],
        where: { orderId: creado.id },
        _sum: { quantity: true },
      });
      const netoPorLote = new Map<string, Prisma.Decimal>();
      for (const fila of neto) {
        const signo = fila.kind === 'reserve' ? 1 : -1;
        const actual = netoPorLote.get(fila.batchId) ?? new Prisma.Decimal(0);
        netoPorLote.set(fila.batchId, actual.plus((fila._sum.quantity ?? new Prisma.Decimal(0)).times(signo)));
      }
      expect([...netoPorLote.values()].map((valor) => valor.toFixed(4))).toEqual(['0.0000', '0.0000']);

      expect(await estadoDe(creado.id, [a, b])).toEqual({ pedido: 'POR_EMPACAR', lineas: ['CANCELADO', 'POR_EMPACAR'] });
    } finally {
      await borrarFixture(fixture);
    }
  });
});
