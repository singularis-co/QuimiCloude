/**
 * El coste real del pedido de punta a punta contra Postgres real: alta, Comenzar, Finalizar
 * (consume los ingredientes), Comenzar y Terminar el empaque (liquida los envases, calcula y guarda
 * el real, y lo reparte entre los lotes de producto terminado), con los adaptadores driven REALES
 * cableados como en `lib/composition`. Despues, ajuste de existencia, cambio del coste de un lote,
 * entrega y anulacion de la entrega, que no deben mover el real. La tab de costos del producto
 * terminado se lee por la fachada de `lib/composition`.
 *
 * AISLAMIENTO: `commit`. `withOrderTransaction` y los adaptadores de inventario abren sus propias
 * transacciones sobre el cliente global, asi que una transaccion del test no los envolveria. Cada
 * caso fabrica su propia empresa efimera con randomUUID y la limpia en un `finally`.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, describe, expect, it } from 'vitest';

import { inventario, pedidos } from '@/lib/composition';
import { normalizeCompanyName } from '@/lib/modules/identity';
import { findCostingBatches, findProductRefs } from '@/lib/modules/inventario/adapters/driven/persistence/product-catalog-prisma';
import {
  addBatchToAlive,
  adjustBatchStock,
  createWithFirstBatch,
  findFinishedGoodsReceipts,
} from '@/lib/modules/inventario/adapters/driven/persistence/product-prisma';
import { createMaterialReservations } from '@/lib/modules/inventario/adapters/driven/persistence/reservation-prisma';
import { createFinishedGoodsIntake } from '@/lib/modules/inventario/adapters/driven/persistence/finished-goods-prisma';
import {
  findPresentationRefs,
  findPresentationsByNormalizedNames,
} from '@/lib/modules/inventario/adapters/driven/persistence/presentation-catalog-prisma';
import { findPackagingCostingBatches, findPackagingRefs } from '@/lib/modules/inventario/adapters/driven/persistence/packaging-catalog-prisma';
import {
  createOrderWriteRepository,
  findAliveOrderById,
  finishConditioningAliveOrder,
  startConditioningAliveOrder,
  startPackingAliveOrder,
} from '@/lib/modules/pedidos/adapters/driven/persistence/order-prisma';
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
import { findAliveCustomerRefById } from '@/lib/modules/clientes/adapters/driven/persistence/customer-catalog-prisma';
import { prisma } from '@/lib/shared/db/prisma';
import { createCreateOrder, createFinishPacking, createStartPacking, createTransitionOrder } from '@/lib/modules/pedidos';

import type { Actor, PackedLineCount } from '@/lib/modules/pedidos';
import type { PackagingCatalog, PresentationCatalog, ProductCatalog } from '@/lib/modules/inventario';
import type { OrderPackingRepository } from '@/lib/modules/pedidos/ports/order-packing-repository';
import type { OrderTransactionScope, OrderUnitOfWork } from '@/lib/modules/pedidos/ports/order-unit-of-work';
import type { RecipeCatalog } from '@/lib/modules/recetas';
import type { UnitCatalog } from '@/lib/modules/unidades';

import { crearCliente, type EmpresaDeEntrega } from '../../helpers/order-delivery-seed';
import { orderScopeReaders } from '../../helpers/order-scope-readers';
import { packedCountsOfPlan } from '../../helpers/packed-counts';
import { dropPackaging, seedPackaging } from '../../helpers/packaging-seed';

afterAll(async () => {
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// El cableado REAL: los mismos adaptadores que `lib/composition`.
// ---------------------------------------------------------------------------

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
const units: UnitCatalog = {
  findRefs: findUnitRefs,
  listVisibleRefs: () => Promise.reject(new Error('no se usa')),
  findMassVolumeBridge: () => findMassVolumeBridge(),
  findRefsSharingBaseInCompany: findUnitRefsSharingBaseInCompany,
};
const packagingCatalog: PackagingCatalog = { findRefs: findPackagingRefs, findCostingBatches: findPackagingCostingBatches };
const customerCatalog = {
  findAliveRefById: (id: string, companyId: string) => findAliveCustomerRefById(id, { companyId }),
};
const orderPackingRepository: OrderPackingRepository = { startPackingAlive: startPackingAliveOrder };

const createOrder = createCreateOrder({ customerCatalog, recipes, products, units, presentations, packaging: packagingCatalog, unitOfWork, now: () => new Date() });
const transitionAliveById = createTransitionOrder({ unitOfWork });
const startPackingAliveById = createStartPacking({ packing: orderPackingRepository });
const finishPackingAliveById = createFinishPacking({ packing: orderPackingRepository, unitOfWork, recipes, units, presentations });

// ---------------------------------------------------------------------------
// Empresa efimera
// ---------------------------------------------------------------------------

function token(): string {
  return randomUUID().replace(/-/gu, '');
}

function normalizeForTest(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/gu, '');
}

type Fixture = {
  readonly companyId: string;
  readonly actorId: string;
  readonly roleId: string;
  readonly documentTypeCode: string;
  readonly unitId: string;
  readonly presentationId: string;
  /** Envase de la presentacion: 1000 en un lote a 0.5000. */
  readonly packagingProductId: string;
};

async function crearFixture(): Promise<Fixture> {
  const marca = token();
  const documentType = await prisma.documentType.create({
    data: { code: `DOC${marca.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  });
  const role = await prisma.role.create({ data: { name: `rol-${marca}`, description: 'Rol de prueba' }, select: { id: true } });
  const nombre = `Empresa real ${marca}`;
  const company = await prisma.company.create({
    data: { name: nombre, nameNormalized: normalizeCompanyName(nombre) },
    select: { id: true },
  });
  const user = await prisma.user.create({
    data: {
      firstNames: 'Ana Maria',
      lastNames: 'Perez Gomez',
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
    data: { name: `Unidad ${marca}`, nameNormalized: `unidad${marca}`, symbol: `l${marca}` },
    select: { id: true },
  });
  const presentation = await prisma.presentation.create({
    data: {
      name: `Botella ${marca}`,
      nameNormalized: normalizeForTest(`Botella ${marca}`),
      unitId: unit.id,
      companyId: company.id,
      content: '1.0000',
    },
    select: { id: true },
  });
  return {
    companyId: company.id,
    actorId: user.id,
    roleId: role.id,
    documentTypeCode: documentType.code,
    unitId: unit.id,
    presentationId: presentation.id,
    packagingProductId: await seedPackaging({ companyId: company.id, presentationId: presentation.id, createdBy: user.id }),
  };
}

async function borrarFixture(fixture: Fixture): Promise<void> {
  const companyId = fixture.companyId;
  await prisma.reservationMovement.deleteMany({ where: { companyId } });
  await prisma.inventoryMovement.deleteMany({ where: { companyId } });
  await prisma.orderDeliveryVoidLine.deleteMany({ where: { companyId } });
  await prisma.orderDeliveryVoid.deleteMany({ where: { companyId } });
  await prisma.orderDeliveryLine.deleteMany({ where: { companyId } });
  await prisma.orderDelivery.deleteMany({ where: { companyId } });
  await prisma.orderPresentationLine.deleteMany({ where: { companyId } });
  await prisma.orderExecutionEntry.deleteMany({ where: { companyId } });
  await prisma.order.deleteMany({ where: { companyId } });
  await prisma.recipeLine.deleteMany({ where: { recipe: { companyId } } });
  await prisma.productBatch.deleteMany({ where: { product: { companyId, type: 'FINISHED_PRODUCT' } } });
  await prisma.product.deleteMany({ where: { companyId, type: 'FINISHED_PRODUCT' } });
  await prisma.recipe.deleteMany({ where: { companyId } });
  await dropPackaging([fixture.packagingProductId]);
  await prisma.productBatch.deleteMany({ where: { companyId } });
  await prisma.product.deleteMany({ where: { companyId } });
  await prisma.customer.deleteMany({ where: { companyId } });
  await prisma.presentation.deleteMany({ where: { companyId } });
  await prisma.unit.deleteMany({ where: { id: fixture.unitId } });
  await prisma.user.deleteMany({ where: { id: fixture.actorId } });
  await prisma.role.deleteMany({ where: { id: fixture.roleId } });
  await prisma.documentType.deleteMany({ where: { code: fixture.documentTypeCode } });
  await prisma.company.deleteMany({ where: { id: companyId } });
}

function actorDe(fixture: Fixture): Actor {
  return {
    id: fixture.actorId,
    companyId: fixture.companyId,
    permissions: ['pedidos.consultar', 'pedidos.modificar', 'entregas.modificar', 'entregas.anular'],
  };
}

/** Con `inventario.modificar`, que es el permiso de ver costos. */
function actorDeInventario(fixture: Fixture) {
  return { id: fixture.actorId, companyId: fixture.companyId, permissions: ['inventario.consultar', 'inventario.modificar'] };
}

/** Ingrediente con dos lotes de distinto coste: el mas antiguo no alcanza para el pedido. */
async function crearIngredienteDeDosLotes(
  fixture: Fixture,
): Promise<{ readonly productId: string; readonly primerLote: string; readonly segundoLote: string }> {
  const created = await createWithFirstBatch(
    { name: `Ingrediente ${token()}` },
    { presentationId: fixture.presentationId, stock: '6', unitCost: '10.0000', lot: null, purchaseDate: '2026-09-01', expiryDate: null, createdBy: fixture.actorId },
    new Date(),
    { companyId: fixture.companyId },
  );
  const segundo = await addBatchToAlive(
    created.id,
    { presentationId: fixture.presentationId, stock: '100', unitCost: '20.0000', lot: null, purchaseDate: '2026-09-05', expiryDate: null, createdBy: fixture.actorId },
    new Date(),
    { companyId: fixture.companyId },
  );
  if (segundo === null || segundo === 'finished_product') throw new Error('no se pudo sembrar el segundo lote');
  return { productId: created.id, primerLote: created.batchId, segundoLote: segundo.batchId };
}

async function crearReceta(fixture: Fixture, productId: string): Promise<string> {
  const nombre = `Receta ${token()}`;
  const recipe = await prisma.recipe.create({
    data: { name: nombre, nameNormalized: normalizeForTest(nombre), companyId: fixture.companyId, createdBy: fixture.actorId },
    select: { id: true },
  });
  await prisma.recipeLine.create({ data: { recipeId: recipe.id, productId, percentage: '100.00' } });
  return recipe.id;
}

/** Alta, Comenzar, Finalizar, Comenzar y Terminar el empaque. Devuelve el id del pedido. */
async function producir(
  fixture: Fixture,
  recipeId: string,
  quantity: string,
  packages: number,
  counts?: (orderId: string) => Promise<readonly PackedLineCount[]>,
): Promise<string> {
  const creado = await createOrder(
    {
      recipeId,
      quantity,
      priority: 'BAJA',
      status: 'PENDIENTE',
      unitId: fixture.unitId,
      presentationLines: [{ packagingProductId: fixture.packagingProductId, packages }],
    },
    actorDe(fixture),
  );
  expect(await transitionAliveById(creado.id, fixture.companyId, 'PENDIENTE', 'EN_CURSO', fixture.actorId, new Date())).toBe('ok');
  expect(await transitionAliveById(creado.id, fixture.companyId, 'EN_CURSO', 'POR_EMPACAR', fixture.actorId, new Date())).toBe('ok');
  expect(await startPackingAliveById(creado.id, fixture.companyId, fixture.actorId, new Date())).toBe('ok');
  const conteo = await (counts ?? packedCountsOfPlan)(creado.id);
  const terminado = await finishPackingAliveById(creado.id, fixture.companyId, fixture.actorId, new Date(), conteo);
  expect(terminado).toMatchObject({ kind: 'ok' });
  return creado.id;
}

async function costesDelPedido(orderId: string) {
  const row = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { actualCost: true, ingredientsCost: true, packagingCost: true },
  });
  return {
    actualCost: row.actualCost?.toFixed(4) ?? null,
    ingredientsCost: row.ingredientsCost?.toFixed(4) ?? null,
    packagingCost: row.packagingCost?.toFixed(4) ?? null,
  };
}

/** Lo consumido por el pedido de cada lote, en positivo. */
async function consumidoPorLote(orderId: string): Promise<ReadonlyMap<string, string>> {
  const filas = await prisma.inventoryMovement.groupBy({
    by: ['batchId'],
    where: { orderId, kind: 'consumption' },
    _sum: { quantity: true },
  });
  return new Map(filas.map((fila) => [fila.batchId, fila._sum.quantity?.negated().toFixed(4) ?? '0.0000']));
}

async function loteTerminadoDe(orderId: string) {
  const asiento = await prisma.inventoryMovement.findFirstOrThrow({
    where: { orderId, kind: 'production' },
    select: { batchId: true, batch: { select: { productId: true, unitCost: true } } },
  });
  return { batchId: asiento.batchId, productId: asiento.batch.productId, unitCost: asiento.batch.unitCost?.toFixed(4) ?? null };
}

describe('Terminar guarda el coste real de lo consumido', () => {
  it('R1, R5, R6, R16, R22: el real pondera los dos lotes del ingrediente mas los envases, el estimado no cambia y el lote de producto terminado lleva real / envasado', async () => {
    const fixture = await crearFixture();
    try {
      const ingrediente = await crearIngredienteDeDosLotes(fixture);
      const recipeId = await crearReceta(fixture, ingrediente.productId);

      const orderId = await producir(fixture, recipeId, '10.0000', 10);

      // El mas antiguo no alcanza: 6 de el y 4 del segundo.
      const consumido = await consumidoPorLote(orderId);
      expect(consumido.get(ingrediente.primerLote)).toBe('6.0000');
      expect(consumido.get(ingrediente.segundoLote)).toBe('4.0000');

      // 6 x 10 + 4 x 20 de ingrediente + 10 envases x 0.50 = 145.0000. El estimado promedia los
      // dos lotes sin ponderar: 10 x 15 + 5 = 155.0000.
      const costes = await costesDelPedido(orderId);
      expect(costes).toEqual({ actualCost: '145.0000', ingredientsCost: '155.0000', packagingCost: '5.0000' });

      const lote = await loteTerminadoDe(orderId);
      expect(lote.unitCost).toBe('14.5000');

      const fila = await findAliveOrderById(orderId, { companyId: fixture.companyId });
      expect(fila?.actualCost).toBe('145.0000');

      const tab = await inventario.listFinishedProductCosts(lote.productId, {}, actorDeInventario(fixture));
      expect(tab.items).toHaveLength(1);
      expect(tab.items[0]).toMatchObject({ batchId: lote.batchId, unitCost: '14.5000', totalCost: '145.0000' });
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('R9: un ajuste de existencia, un cambio del coste de un lote, una entrega y su anulacion posteriores no cambian el real', async () => {
    const fixture = await crearFixture();
    try {
      const ingrediente = await crearIngredienteDeDosLotes(fixture);
      const recipeId = await crearReceta(fixture, ingrediente.productId);
      const orderId = await producir(fixture, recipeId, '10.0000', 10);
      const lote = await loteTerminadoDe(orderId);
      expect((await costesDelPedido(orderId)).actualCost).toBe('145.0000');

      const ajuste = await adjustBatchStock(
        { batchId: ingrediente.segundoLote, countedStock: '50', seenStock: '96.0000', reason: 'merma' },
        fixture.actorId,
        new Date(),
        { companyId: fixture.companyId },
      );
      expect(ajuste).toMatchObject({ kind: 'adjusted' });
      expect((await costesDelPedido(orderId)).actualCost).toBe('145.0000');

      await prisma.productBatch.update({ where: { id: ingrediente.primerLote }, data: { unitCost: '99.0000' } });
      await prisma.productBatch.update({ where: { id: ingrediente.segundoLote }, data: { unitCost: '1.0000' } });
      expect((await costesDelPedido(orderId)).actualCost).toBe('145.0000');

      expect(await startConditioningAliveOrder(orderId, fixture.actorId, new Date(), { companyId: fixture.companyId })).toBe('ok');
      expect(await finishConditioningAliveOrder(orderId, fixture.actorId, new Date(), { companyId: fixture.companyId })).toBe('ok');
      const customerId = await crearCliente({ companyId: fixture.companyId } as EmpresaDeEntrega, `Real ${token().slice(0, 6)}`);
      await prisma.order.update({ where: { id: orderId }, data: { customerId } });
      const { id: lineId } = await prisma.orderPresentationLine.findFirstOrThrow({ where: { orderId }, select: { id: true } });

      const deliveryKey = randomUUID();
      const entrega = await pedidos.deliverOrder(
        {
          orderId,
          deliveryKey,
          customers: [{ customerId, allocations: [{ presentationLineId: lineId, batchId: lote.batchId, packages: 4 }] }],
        },
        actorDe(fixture),
      );
      expect(entrega).toMatchObject({ status: 'delivered' });
      expect((await costesDelPedido(orderId)).actualCost).toBe('145.0000');

      const { id: deliveryId } = await prisma.orderDelivery.findFirstOrThrow({ where: { deliveryKey }, select: { id: true } });
      const anulacion = await pedidos.voidDelivery(
        { deliveryId, voidKey: randomUUID(), items: [{ customerId, presentationLineId: lineId }], reason: 'El cliente devolvio el producto' },
        actorDe(fixture),
      );
      expect(anulacion).toMatchObject({ status: 'voided' });

      const costes = await costesDelPedido(orderId);
      expect(costes.actualCost).toBe('145.0000');
      expect((await loteTerminadoDe(orderId)).unitCost).toBe('14.5000');
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('R16, R18: un segundo Terminar de la misma receta y presentacion da su lote con su propio real y no cambia el coste del lote anterior', async () => {
    const fixture = await crearFixture();
    try {
      const ingrediente = await crearIngredienteDeDosLotes(fixture);
      const recipeId = await crearReceta(fixture, ingrediente.productId);

      const primero = await producir(fixture, recipeId, '10.0000', 10);
      const lotePrimero = await loteTerminadoDe(primero);
      expect(lotePrimero.unitCost).toBe('14.5000');

      // El primer lote del ingrediente ya se agoto: el segundo pedido sale entero del de 20.
      const segundo = await producir(fixture, recipeId, '5.0000', 5);
      const loteSegundo = await loteTerminadoDe(segundo);
      expect((await costesDelPedido(segundo)).actualCost).toBe('102.5000');
      expect(loteSegundo.productId).toBe(lotePrimero.productId);
      expect(loteSegundo.unitCost).toBe('20.5000');

      const anterior = await prisma.productBatch.findUniqueOrThrow({ where: { id: lotePrimero.batchId }, select: { unitCost: true } });
      expect(anterior.unitCost?.toFixed(4)).toBe('14.5000');
      expect((await costesDelPedido(primero)).actualCost).toBe('145.0000');
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('R18: un lote de producto terminado nacido con el estimado, antes de esta ficha, conserva su coste tras un Terminar nuevo', async () => {
    const fixture = await crearFixture();
    try {
      const ingrediente = await crearIngredienteDeDosLotes(fixture);
      const recipeId = await crearReceta(fixture, ingrediente.productId);
      const primero = await producir(fixture, recipeId, '10.0000', 10);
      const lotePrimero = await loteTerminadoDe(primero);
      // Asi quedaba un lote de antes: el estimado repartido y el pedido sin real.
      await prisma.productBatch.update({ where: { id: lotePrimero.batchId }, data: { unitCost: '15.5000' } });
      await prisma.$executeRaw`UPDATE "orders" SET "actual_cost" = NULL WHERE "id" = ${primero}::uuid`;

      await producir(fixture, recipeId, '5.0000', 5);

      const anterior = await prisma.productBatch.findUniqueOrThrow({ where: { id: lotePrimero.batchId }, select: { unitCost: true } });
      expect(anterior.unitCost?.toFixed(4)).toBe('15.5000');
      expect((await costesDelPedido(primero)).actualCost).toBeNull();
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('R8: con todas las lineas en 0 guarda el real y no nace ningun lote', async () => {
    const fixture = await crearFixture();
    try {
      const ingrediente = await crearIngredienteDeDosLotes(fixture);
      const recipeId = await crearReceta(fixture, ingrediente.productId);

      const orderId = await producir(fixture, recipeId, '10.0000', 10, async (id) =>
        (await packedCountsOfPlan(id)).map((count) => ({ ...count, packedPackages: 0, reason: 'merma' as const })),
      );

      // Solo los ingredientes: los envases se liquidan a 0.
      expect((await costesDelPedido(orderId)).actualCost).toBe('140.0000');
      expect(await prisma.inventoryMovement.count({ where: { orderId, kind: 'production' } })).toBe(0);
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('R7, R17, R22: un lote consumido sin coste deja el real sin importe, el lote de producto terminado sin coste y la tab con guion en los dos', async () => {
    const fixture = await crearFixture();
    try {
      const sinCoste = await createWithFirstBatch(
        { name: `Maquina ${token()}`, type: 'MACHINE' },
        { presentationId: fixture.presentationId, stock: '50', unitCost: null, lot: null, purchaseDate: '2026-09-01', expiryDate: null, createdBy: fixture.actorId },
        new Date(),
        { companyId: fixture.companyId },
      );
      const recipeId = await crearReceta(fixture, sinCoste.id);

      const orderId = await producir(fixture, recipeId, '10.0000', 10);

      expect((await consumidoPorLote(orderId)).get(sinCoste.batchId)).toBe('10.0000');
      expect((await costesDelPedido(orderId)).actualCost).toBeNull();
      const lote = await loteTerminadoDe(orderId);
      expect(lote.unitCost).toBeNull();

      const tab = await inventario.listFinishedProductCosts(lote.productId, {}, actorDeInventario(fixture));
      expect(tab.items[0]).toMatchObject({ batchId: lote.batchId, unitCost: null, totalCost: null });
    } finally {
      await borrarFixture(fixture);
    }
  });
});
