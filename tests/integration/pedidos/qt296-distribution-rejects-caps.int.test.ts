/**
 * Una tapa o un medidor no entran en el reparto del pedido, y Terminar el empaque no los consume,
 * contra Postgres real: los casos de uso de `pedidos` con los adaptadores driven reales de
 * `inventario`, `recetas` y `unidades`, cableados como en `lib/composition`.
 *
 * AISLAMIENTO: commit. `withOrderTransaction` abre su propia `prisma.$transaction` sobre el
 * cliente global y la siembra de empaques (`createWithFirstBatch`) tambien: una transaccion del
 * test no los envolveria. Cada caso fabrica su empresa efimera y la limpia en un `finally`.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, describe, expect, it } from 'vitest';

import { findAliveCustomerRefById } from '@/lib/modules/clientes/adapters/driven/persistence/customer-catalog-prisma';
import { normalizeCompanyName } from '@/lib/modules/identity';
import { PACKAGING_SUBTYPES, PRODUCT_TYPES, type PackagingSubtype } from '@/lib/modules/inventario';
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
import { createWithFirstBatch, findFinishedGoodsReceipts } from '@/lib/modules/inventario/adapters/driven/persistence/product-prisma';
import { createMaterialReservations } from '@/lib/modules/inventario/adapters/driven/persistence/reservation-prisma';
import {
  createCreateOrder,
  createFinishPacking,
  createStartPacking,
  createTransitionOrder,
  createUpdateOrder,
  createUpdateOrderPresentationLines,
  ProductNotFoundError,
} from '@/lib/modules/pedidos';
import {
  createOrderWriteRepository,
  findAliveOrderById,
  findBlockedOrderIds,
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
import { findMassVolumeBridge, findPackageUnitId, findUnitRefs } from '@/lib/modules/unidades/adapters/driven/persistence/unit-catalog-prisma';
import { findUnitRefsSharingBaseInCompany } from '@/lib/modules/unidades/adapters/driven/persistence/unit-prisma';
import { prisma } from '@/lib/shared/db/prisma';

import { dropPackaging, seedPackaging } from '../../helpers/packaging-seed';
import { orderScopeReaders } from '../../helpers/order-scope-readers';
import { packedCountsOfPlan } from '../../helpers/packed-counts';

import type { PackagingCatalog, PresentationCatalog, ProductCatalog } from '@/lib/modules/inventario';
import type { Actor } from '@/lib/modules/pedidos';
import type { OrderPackingRepository } from '@/lib/modules/pedidos/ports/order-packing-repository';
import type { OrderTransactionScope, OrderUnitOfWork } from '@/lib/modules/pedidos/ports/order-unit-of-work';
import type { RecipeCatalog } from '@/lib/modules/recetas';
import type { UnitCatalog } from '@/lib/modules/unidades';

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

const customerCatalog = {
  findAliveRefById: (id: string, companyId: string) => findAliveCustomerRefById(id, { companyId }),
};
const packaging: PackagingCatalog = { findRefs: findPackagingRefs, findCostingBatches: findPackagingCostingBatches };
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
const presentations: PresentationCatalog = {
  findRefs: findPresentationRefs,
  findByNormalizedNames: findPresentationsByNormalizedNames,
};
const units: UnitCatalog = {
  findRefs: findUnitRefs,
  listVisibleRefs: () => Promise.reject(new Error('no se usa')),
  findMassVolumeBridge: () => findMassVolumeBridge(),
  findRefsSharingBaseInCompany: findUnitRefsSharingBaseInCompany,
};
const orderPackingRepository: OrderPackingRepository = { startPackingAlive: startPackingAliveOrder };

const now = () => new Date();
const createOrder = createCreateOrder({ customerCatalog, recipes, products, units, presentations, packaging, unitOfWork, now });
const updateOrder = createUpdateOrder({
  customerCatalog,
  orders: {
    findAliveById: findAliveOrderById,
    listAlive: async () => {
      throw new Error('sin uso en este archivo');
    },
    findBlockedIds: findBlockedOrderIds,
  },
  recipes,
  products,
  units,
  presentations,
  packaging,
  unitOfWork,
  now,
});
const updateDistribution = createUpdateOrderPresentationLines({ recipes, products, packaging, presentations, units, unitOfWork });
const transition = createTransitionOrder({ unitOfWork });
const startPacking = createStartPacking({ packing: orderPackingRepository });
const finishPacking = createFinishPacking({ packing: orderPackingRepository, unitOfWork, recipes, units, presentations });

type Fixture = {
  readonly companyId: string;
  readonly actorId: string;
  readonly roleId: string;
  readonly documentTypeCode: string;
  readonly unitId: string;
  /** Contenido `1.0000`, en `unitId`. */
  readonly presentationId: string;
  readonly envase: string;
  readonly tapa: string;
  readonly medidor: string;
  /** Ingrediente unico de la receta, al 100 %. */
  readonly ingredientId: string;
  readonly recipeId: string;
};

async function seedAccessory(
  companyId: string,
  actorId: string,
  name: string,
  packagingSubtype: PackagingSubtype,
): Promise<string> {
  const unitId = await findPackageUnitId();
  if (unitId === null) throw new Error('falta la unidad de sistema de envases');
  const created = await createWithFirstBatch(
    { name: `${name} ${token().slice(0, 8)}`, qtyAlert: '0', type: PRODUCT_TYPES.PACKAGING },
    {
      presentationId: null,
      stock: '1000',
      unitCost: '0.2000',
      lot: null,
      purchaseDate: '2026-09-01',
      expiryDate: null,
      createdBy: actorId,
    },
    new Date(),
    { companyId },
    { presentationId: null, unitId, packagingSubtype },
  );
  return created.id;
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
    data: { name: `Unidad ${marca}`, nameNormalized: `unidad${marca}`, symbol: `kg${marca}` },
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
  const ingredient = await createWithFirstBatch(
    { name: `Producto ${marca}` },
    {
      presentationId: presentation.id,
      stock: '100',
      unitCost: '2.5000',
      lot: null,
      purchaseDate: '2026-09-01',
      expiryDate: null,
      createdBy: user.id,
    },
    new Date(),
    { companyId: company.id },
  );
  const recipeName = `Receta ${marca}`;
  const recipe = await prisma.recipe.create({
    data: { name: recipeName, nameNormalized: normalizeForTest(recipeName), companyId: company.id, createdBy: user.id },
    select: { id: true },
  });
  await prisma.recipeLine.create({ data: { recipeId: recipe.id, productId: ingredient.id, percentage: '100.00' } });

  return {
    companyId: company.id,
    actorId: user.id,
    roleId: role.id,
    documentTypeCode: documentType.code,
    unitId: unit.id,
    presentationId: presentation.id,
    envase: await seedPackaging({ companyId: company.id, presentationId: presentation.id, createdBy: user.id }),
    tapa: await seedAccessory(company.id, user.id, 'Tapa 28 mm', PACKAGING_SUBTYPES.CAP),
    medidor: await seedAccessory(company.id, user.id, 'Vaso medidor', PACKAGING_SUBTYPES.MEASURER),
    ingredientId: ingredient.id,
    recipeId: recipe.id,
  };
}

async function borrarFixture(fixture: Fixture): Promise<void> {
  const { companyId } = fixture;
  await prisma.reservationMovement.deleteMany({ where: { companyId } });
  await prisma.inventoryMovement.deleteMany({ where: { companyId } });
  await prisma.orderPresentationLine.deleteMany({ where: { companyId } });
  await prisma.orderExecutionEntry.deleteMany({ where: { companyId } });
  await prisma.order.deleteMany({ where: { companyId } });
  await prisma.recipeLine.deleteMany({ where: { recipe: { companyId } } });
  // El producto terminado referencia la receta con `ON DELETE RESTRICT`.
  await prisma.productBatch.deleteMany({ where: { product: { companyId, type: 'FINISHED_PRODUCT' } } });
  await prisma.product.deleteMany({ where: { companyId, type: 'FINISHED_PRODUCT' } });
  await prisma.recipe.deleteMany({ where: { companyId } });
  await dropPackaging([fixture.envase, fixture.tapa, fixture.medidor, fixture.ingredientId]);
  await prisma.presentation.deleteMany({ where: { id: fixture.presentationId } });
  await prisma.unit.deleteMany({ where: { id: fixture.unitId } });
  await prisma.user.deleteMany({ where: { id: fixture.actorId } });
  await prisma.role.deleteMany({ where: { id: fixture.roleId } });
  await prisma.documentType.deleteMany({ where: { code: fixture.documentTypeCode } });
  await prisma.company.deleteMany({ where: { id: companyId } });
}

async function conFixture(body: (fixture: Fixture) => Promise<void>): Promise<void> {
  const fixture = await crearFixture();
  try {
    await body(fixture);
  } finally {
    await borrarFixture(fixture);
  }
}

function actorDe(fixture: Fixture): Actor {
  return { id: fixture.actorId, companyId: fixture.companyId, permissions: ['pedidos.consultar', 'pedidos.modificar'] };
}

function entrada(fixture: Fixture, packagingProductId: string) {
  return {
    recipeId: fixture.recipeId,
    quantity: '10.0000',
    priority: 'BAJA' as const,
    unitId: fixture.unitId,
    presentationLines: [{ packagingProductId, packages: 10 }],
  };
}

/** Todo lo que una escritura del pedido podria tocar: la fila, su reparto y los dos libros. */
async function foto(fixture: Fixture, orderId: string) {
  const fila = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { unitId: true, quantity: true, status: true, updatedAt: true, updatedBy: true },
  });
  const lineas = await prisma.orderPresentationLine.findMany({
    where: { orderId },
    select: { id: true, presentationId: true, packagingProductId: true, packages: true, updatedAt: true },
    orderBy: { id: 'asc' },
  });
  return {
    fila: { ...fila, quantity: fila.quantity.toFixed(4) },
    lineas,
    reservas: await prisma.reservationMovement.count({ where: { companyId: fixture.companyId } }),
    asientos: await prisma.inventoryMovement.count({ where: { companyId: fixture.companyId } }),
  };
}

/** Existencia del producto y de cada lote, mas los asientos y reservas que lo nombran. */
async function existenciaDe(productId: string) {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { stock: true } });
  const batches = await prisma.productBatch.findMany({
    where: { productId },
    select: { id: true, stock: true },
    orderBy: { id: 'asc' },
  });
  const batchIds = batches.map((batch) => batch.id);
  return {
    stock: product.stock.toFixed(4),
    lotes: batches.map((batch) => ({ id: batch.id, stock: batch.stock.toFixed(4) })),
    asientos: await prisma.inventoryMovement.count({ where: { batchId: { in: batchIds } } }),
    reservas: await prisma.reservationMovement.count({ where: { batchId: { in: batchIds } } }),
  };
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('QT-296 — una tapa en el reparto del pedido es un envase inexistente', () => {
  it('R14 — el alta con una linea de reparto que apunta a una tapa da packaging_not_found y no escribe nada', async () => {
    await conFixture(async (fixture) => {
      const antes = await existenciaDe(fixture.tapa);

      await expect(createOrder(entrada(fixture, fixture.tapa), actorDe(fixture))).rejects.toBeInstanceOf(ProductNotFoundError);

      expect(await prisma.order.count({ where: { companyId: fixture.companyId } })).toBe(0);
      expect(await prisma.orderPresentationLine.count({ where: { companyId: fixture.companyId } })).toBe(0);
      expect(await prisma.reservationMovement.count({ where: { companyId: fixture.companyId } })).toBe(0);
      expect(await existenciaDe(fixture.tapa)).toEqual(antes);
    });
  });

  it('R14 — la edicion de un pedido con una linea que apunta a un medidor da packaging_not_found y el pedido queda intacto', async () => {
    await conFixture(async (fixture) => {
      const creado = await createOrder(entrada(fixture, fixture.envase), actorDe(fixture));
      const antes = await foto(fixture, creado.id);

      await expect(updateOrder(creado.id, entrada(fixture, fixture.medidor), actorDe(fixture))).rejects.toBeInstanceOf(
        ProductNotFoundError,
      );

      expect(await foto(fixture, creado.id)).toEqual(antes);
    });
  });

  it('R14 — «Reparto y unidad» en POR_EMPACAR con una linea que apunta a una tapa da packaging_not_found sin escribir nada', async () => {
    await conFixture(async (fixture) => {
      const creado = await createOrder(entrada(fixture, fixture.envase), actorDe(fixture));
      await prisma.order.update({ where: { id: creado.id }, data: { status: 'POR_EMPACAR' } });
      const antes = await foto(fixture, creado.id);

      const resultado = await updateDistribution(creado.id, actorDe(fixture), {
        unitId: fixture.unitId,
        lines: [{ packagingProductId: fixture.tapa, packages: 10 }],
      });

      expect(resultado).toBe('packaging_not_found');
      expect(await foto(fixture, creado.id)).toEqual(antes);
    });
  });

  it('R39 — Terminar el empaque con un envase en el reparto no toca la existencia de la tapa ni del medidor', async () => {
    await conFixture(async (fixture) => {
      const tapaAntes = await existenciaDe(fixture.tapa);
      const medidorAntes = await existenciaDe(fixture.medidor);
      const envaseAntes = await existenciaDe(fixture.envase);

      const creado = await createOrder(entrada(fixture, fixture.envase), actorDe(fixture));
      expect(await transition(creado.id, fixture.companyId, 'PENDIENTE', 'EN_CURSO', fixture.actorId, new Date())).toBe('ok');
      expect(await transition(creado.id, fixture.companyId, 'EN_CURSO', 'POR_EMPACAR', fixture.actorId, new Date())).toBe('ok');
      expect(await startPacking(creado.id, fixture.companyId, fixture.actorId, new Date())).toBe('ok');
      const terminado = await finishPacking(
        creado.id,
        fixture.companyId,
        fixture.actorId,
        new Date(),
        await packedCountsOfPlan(creado.id),
      );
      expect(terminado).toMatchObject({ kind: 'ok' });

      // Control: el envase del reparto si se consumio, asi que el empaque se liquido de verdad.
      expect((await existenciaDe(fixture.envase)).stock).not.toBe(envaseAntes.stock);
      expect(await existenciaDe(fixture.tapa)).toEqual(tapaAntes);
      expect(await existenciaDe(fixture.medidor)).toEqual(medidorAntes);
    });
  });
});
