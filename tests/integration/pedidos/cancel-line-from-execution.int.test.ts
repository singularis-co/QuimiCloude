/**
 * `OrderCancellation.cancelLineAliveById` contra Postgres real, cableado como en la composicion:
 * dentro de la transaccion de ejecucion, uniendose a ella. Un pedido de dos recetas con un insumo
 * compartido en dos lotes, para ver lote a lote que solo se libera lo de la receta cancelada.
 *
 * AISLAMIENTO: `commit`. La transaccion de ejecucion y el alta abren SU PROPIA transaccion sobre el
 * cliente global; cada caso siembra una empresa efimera y la borra en su `finally`.
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
import { createCancelAliveOrderLine, createCreateOrder, createTransitionOrder } from '@/lib/modules/pedidos';
import { withExecutionTransaction } from '@/lib/modules/asignaciones/adapters/driven/persistence/execution-transaction-prisma';
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

function scopeOn(tx: Prisma.TransactionClient): OrderTransactionScope {
  return {
    orders: createOrderWriteRepository(tx),
    reservations: createMaterialReservations(tx),
    recipes: createRecipeExecutionReader(tx),
    ...orderScopeReaders(tx),
    finishedGoods: createFinishedGoodsIntake(tx),
  };
}

const unitOfWork: OrderUnitOfWork = { run: (work) => withOrderTransaction((tx) => work(scopeOn(tx))) };

/** Como en la composicion: la transaccion de ejecucion la abre `asignaciones` y `pedidos` se une a ella. */
function cancelLineAliveById(...args: Parameters<ReturnType<typeof createCancelAliveOrderLine>>) {
  return withExecutionTransaction((tx) =>
    createCancelAliveOrderLine({ unitOfWork: { run: (work) => work(scopeOn(tx)) } })(...args),
  );
}

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

/** Los asientos de reserva de un tipo para la linea, por lote, ordenados por lote. */
async function asientosDe(fixture: Fixture, lineId: string, kind: 'reserve' | 'release' | 'consume') {
  const rows = await prisma.reservationMovement.findMany({ where: { orderLineId: lineId, kind }, select: { batchId: true, quantity: true } });
  return rows
    .map((row) => [row.batchId === fixture.oldBatchId ? 'viejo' : 'nuevo', row.quantity.toFixed(4)] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));
}

async function lineaDe(lineId: string) {
  return prisma.orderLine.findUniqueOrThrow({
    where: { id: lineId },
    select: { status: true, cancellationReason: true, reservedAt: true, actualCost: true },
  });
}

async function estadoDelPedido(orderId: string) {
  return (await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } })).status;
}

async function stockDe(batchId: string): Promise<string> {
  return (await prisma.productBatch.findUniqueOrThrow({ where: { id: batchId }, select: { stock: true } })).stock.toFixed(4);
}

/** Todo lo que una cancelacion podria escribir, para comprobar que no escribio nada. */
async function foto(fixture: Fixture, orderId: string, lineIds: readonly string[]) {
  return {
    pedido: await estadoDelPedido(orderId),
    lineas: await Promise.all(lineIds.map(lineaDe)),
    asientos: await prisma.reservationMovement.count({ where: { orderId } }),
    stock: [await stockDe(fixture.oldBatchId), await stockDe(fixture.newBatchId)],
  };
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('cancelLineAliveById — cancelar una receta desde la ejecucion', () => {
  it('R16: cancela solo esa receta con su motivo, libera todo su material y deriva el pedido; la otra receta no cambia', async () => {
    const fixture = await crearFixture();
    try {
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
      const [a, b] = filas.map((fila) => fila.id) as [string, string];
      expect(await transition(creado.id, a, fixture.companyId, 'PENDIENTE', 'EN_CURSO', fixture.actorId, new Date())).toBe('ok');
      const pedidoAntes = await estadoDelPedido(creado.id);
      const reservaDeB = await asientosDe(fixture, b, 'reserve');
      const lineaBAntes = await lineaDe(b);

      const resultado = await cancelLineAliveById(creado.id, a, fixture.companyId, 'se derramo el lote', fixture.actorId, new Date());

      expect(resultado).toBe('ok');
      expect(await lineaDe(a)).toMatchObject({ status: 'CANCELADO', cancellationReason: 'se derramo el lote', reservedAt: null });
      // Todo lo apartado para la linea cancelada se libera, lote a lote.
      expect(await asientosDe(fixture, a, 'release')).toEqual(await asientosDe(fixture, a, 'reserve'));
      expect(await asientosDe(fixture, a, 'release')).toEqual([['viejo', '30.0000']]);
      // La otra receta: ni estado, ni material, ni coste.
      expect(await lineaDe(b)).toEqual(lineaBAntes);
      expect(await asientosDe(fixture, b, 'reserve')).toEqual(reservaDeB);
      expect(await asientosDe(fixture, b, 'release')).toEqual([]);
      // El pedido se vuelve a derivar: solo queda la receta PENDIENTE.
      expect(pedidoAntes).not.toBe('PENDIENTE');
      expect(await estadoDelPedido(creado.id)).toBe('PENDIENTE');
      // Liberar no mueve stock.
      expect([await stockDe(fixture.oldBatchId), await stockDe(fixture.newBatchId)]).toEqual(['40.0000', '100.0000']);
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('R17: una receta en un estado no cancelable, ya cancelada, ajena o de otra empresa no escribe nada', async () => {
    const fixture = await crearFixture();
    try {
      const creado = await createOrder(
        {
          lines: [
            { recipeId: await crearReceta(fixture), quantity: '30', unitId: fixture.unitId },
            { recipeId: await crearReceta(fixture), quantity: '20', unitId: fixture.unitId },
          ],
        },
        actorDe(fixture),
      );
      const filas = await prisma.orderLine.findMany({ where: { orderId: creado.id }, orderBy: { position: 'asc' }, select: { id: true } });
      const [a, b] = filas.map((fila) => fila.id) as [string, string];
      const ahora = new Date();
      expect(await transition(creado.id, a, fixture.companyId, 'PENDIENTE', 'EN_CURSO', fixture.actorId, ahora)).toBe('ok');
      expect(await transition(creado.id, a, fixture.companyId, 'EN_CURSO', 'POR_EMPACAR', fixture.actorId, ahora)).toBe('ok');
      expect(await cancelLineAliveById(creado.id, b, fixture.companyId, 'primera', fixture.actorId, ahora)).toBe('ok');
      const antes = await foto(fixture, creado.id, [a, b]);

      expect(await cancelLineAliveById(creado.id, a, fixture.companyId, 'motivo', fixture.actorId, new Date()), 'POR_EMPACAR').toBe(
        'not_cancellable',
      );
      expect(await cancelLineAliveById(creado.id, b, fixture.companyId, 'otra vez', fixture.actorId, new Date()), 'CANCELADO').toBe(
        'not_cancellable',
      );
      expect(await cancelLineAliveById(creado.id, randomUUID(), fixture.companyId, 'motivo', fixture.actorId, new Date())).toBe(
        'not_found',
      );
      expect(await cancelLineAliveById(creado.id, a, randomUUID(), 'motivo', fixture.actorId, new Date()), 'otra empresa').toBe(
        'not_found',
      );

      expect(await foto(fixture, creado.id, [a, b])).toEqual(antes);
      expect((await lineaDe(b)).cancellationReason).toBe('primera');
    } finally {
      await borrarFixture(fixture);
    }
  });
});
