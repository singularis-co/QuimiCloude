/**
 * Alta y edicion de un pedido con varias lineas contra Postgres real, con los adaptadores driven
 * reales de `pedidos`, `recetas`, `inventario` y `unidades` cableados a mano, como
 * `order-reservation.int.test.ts`.
 *
 * AISLAMIENTO: `withOrderTransaction` abre su propia transaccion sobre el cliente global, asi que
 * envolver el caso en otra seria aislamiento de mentira. Cada caso siembra una empresa efimera y la
 * borra en un `finally`.
 */
import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import { normalizeCompanyName } from '@/lib/modules/identity';
import { findAliveCustomerRefById } from '@/lib/modules/clientes/adapters/driven/persistence/customer-catalog-prisma';
import {
  findPackagingCostingBatches,
  findPackagingRefs,
} from '@/lib/modules/inventario/adapters/driven/persistence/packaging-catalog-prisma';
import { findCostingBatches, findProductRefs } from '@/lib/modules/inventario/adapters/driven/persistence/product-catalog-prisma';
import { createWithFirstBatch, findFinishedGoodsReceipts } from '@/lib/modules/inventario/adapters/driven/persistence/product-prisma';
import { createFinishedGoodsIntake } from '@/lib/modules/inventario/adapters/driven/persistence/finished-goods-prisma';
import {
  findPresentationRefs,
  findPresentationsByNormalizedNames,
} from '@/lib/modules/inventario/adapters/driven/persistence/presentation-catalog-prisma';
import { createMaterialReservations } from '@/lib/modules/inventario/adapters/driven/persistence/reservation-prisma';
import {
  createOrderWriteRepository,
  findAliveOrderById,
  findAliveOrderLines,
  findAliveOrderLinesByOrderIds,
  findBlockedOrderIds,
  listAliveOrders,
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
import { prisma } from '@/lib/shared/db/prisma';
import {
  createCreateOrder,
  createGetOrder,
  createUpdateOrder,
  createUpdateOrderPresentationLines,
  OrderWouldBlockError,
  RecipeNotFoundError,
} from '@/lib/modules/pedidos';
import { DuplicateOrderRecipeError } from '@/lib/modules/pedidos/domain/errors';

import { dropPackaging, seedPackaging } from '../../helpers/packaging-seed';
import { orderScopeReaders } from '../../helpers/order-scope-readers';

import type { Actor } from '@/lib/modules/pedidos';
import type { PackagingCatalog, PresentationCatalog, ProductCatalog } from '@/lib/modules/inventario';
import type { OrderRepository } from '@/lib/modules/pedidos/ports/order-repository';
import type { OrderTransactionScope, OrderUnitOfWork } from '@/lib/modules/pedidos/ports/order-unit-of-work';
import type { RecipeCatalog } from '@/lib/modules/recetas';
import type { UnitCatalog } from '@/lib/modules/unidades';

const orders: OrderRepository = {
  findAliveById: findAliveOrderById,
  findAliveLines: findAliveOrderLines, findAliveLinesByOrderIds: findAliveOrderLinesByOrderIds,
  listAlive: listAliveOrders,
  findBlockedIds: findBlockedOrderIds,
};

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
const getOrder = createGetOrder({
  orders,
  recipes,
  presentations,
  packaging,
  units,
  customerCatalog: { findRefsIncludingDeleted: async () => [] },
});
const updateOrder = createUpdateOrder({ customerCatalog, orders, recipes, products, units, presentations, packaging, unitOfWork });
const updateDistribution = createUpdateOrderPresentationLines({ recipes, products, packaging, presentations, units, unitOfWork });

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
  /** Insumo compartido por las recetas del caso: 100 en existencia a 2.5000. */
  readonly productId: string;
  readonly batchId: string;
};

function actorDe(fixture: Fixture): Actor {
  return { id: fixture.actorId, companyId: fixture.companyId, permissions: ['pedidos.consultar', 'pedidos.modificar'] };
}

async function crearFixture(stock = '100'): Promise<Fixture> {
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
  const created = await createWithFirstBatch(
    { name: `Insumo ${marca}` },
    {
      presentationId: presentation.id,
      stock,
      unitCost: '2.5000',
      lot: null,
      purchaseDate: '2026-09-01',
      expiryDate: null,
      createdBy: user.id,
    },
    new Date(),
    { companyId: company.id },
  );
  return {
    companyId: company.id,
    actorId: user.id,
    roleId: role.id,
    documentTypeCode: documentType.code,
    presentationId: presentation.id,
    unitId: unit.id,
    productId: created.id,
    batchId: created.batchId,
  };
}

async function borrarFixture(
  fixture: Fixture,
  envases: readonly string[] = [],
  presentaciones: readonly string[] = [],
): Promise<void> {
  await prisma.reservationMovement.deleteMany({ where: { companyId: fixture.companyId } });
  await prisma.inventoryMovement.deleteMany({ where: { companyId: fixture.companyId } });
  await prisma.orderPresentationLine.deleteMany({ where: { companyId: fixture.companyId } });
  await prisma.orderLine.deleteMany({ where: { companyId: fixture.companyId } });
  await prisma.order.deleteMany({ where: { companyId: fixture.companyId } });
  await dropPackaging(envases);
  await prisma.recipeLine.deleteMany({ where: { recipe: { companyId: fixture.companyId } } });
  await prisma.recipe.deleteMany({ where: { companyId: fixture.companyId, parentRecipeId: { not: null } } });
  await prisma.recipe.deleteMany({ where: { companyId: fixture.companyId } });
  await prisma.productBatch.deleteMany({ where: { productId: fixture.productId } });
  await prisma.product.deleteMany({ where: { id: fixture.productId } });
  await prisma.presentation.deleteMany({ where: { id: { in: [fixture.presentationId, ...presentaciones] } } });
  await prisma.unit.deleteMany({ where: { id: fixture.unitId } });
  await prisma.user.deleteMany({ where: { id: fixture.actorId } });
  await prisma.role.deleteMany({ where: { id: fixture.roleId } });
  await prisma.documentType.deleteMany({ where: { code: fixture.documentTypeCode } });
  await prisma.company.deleteMany({ where: { id: fixture.companyId } });
}

/** Una receta con el insumo del caso al 100 %: la necesidad es la cantidad de la linea. */
async function crearReceta(fixture: Fixture, parentRecipeId: string | null = null): Promise<string> {
  const marca = token();
  const recipe = await prisma.recipe.create({
    data: { name: `Receta ${marca}`, nameNormalized: `receta${marca}`, companyId: fixture.companyId, createdBy: fixture.actorId, parentRecipeId },
    select: { id: true },
  });
  await prisma.recipeLine.create({ data: { recipeId: recipe.id, productId: fixture.productId, percentage: new Prisma.Decimal('100.00') } });
  return recipe.id;
}

function linea(fixture: Fixture, recipeId: string, quantity: string, extra: Record<string, unknown> = {}) {
  return { recipeId, quantity, unitId: fixture.unitId, ...extra };
}

type LineaLeida = {
  readonly id: string;
  readonly position: number;
  readonly recipeId: string;
  readonly status: string;
  readonly quantity: string;
  readonly ingredientsCost: string | null;
  readonly reservedAt: Date | null;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
};

async function lineasDe(orderId: string): Promise<readonly LineaLeida[]> {
  const rows = await prisma.orderLine.findMany({ where: { orderId }, orderBy: { position: 'asc' } });
  return rows.map((row) => ({
    id: row.id,
    position: row.position,
    recipeId: row.recipeId,
    status: row.status,
    quantity: row.quantity.toFixed(4),
    ingredientsCost: row.ingredientsCost?.toFixed(4) ?? null,
    reservedAt: row.reservedAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  }));
}

/** Lo apartado neto por linea, en el orden de las lineas pedidas. */
async function apartadoDe(lineIds: readonly string[]): Promise<readonly string[]> {
  const rows = await prisma.reservationMovement.findMany({ where: { orderLineId: { in: [...lineIds] } } });
  return lineIds.map((lineId) => {
    const total = rows
      .filter((row) => row.orderLineId === lineId)
      .reduce((sum, row) => (row.kind === 'reserve' ? sum.plus(row.quantity) : sum.minus(row.quantity)), new Prisma.Decimal(0));
    return total.toFixed(4);
  });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('QT-313 T9 — alta con lineas contra la base', () => {
  it('QT-313 R10, R12, R17, R34, R41: dos lineas con un insumo compartido nacen en orden, cada una con su coste, su apartado y su plazo', async () => {
    const fixture = await crearFixture();
    try {
      const recetaA = await crearReceta(fixture);
      const recetaB = await crearReceta(fixture);

      const creado = await createOrder(
        { lines: [linea(fixture, recetaA, '60', { salePrice: '900' }), linea(fixture, recetaB, '30')] },
        actorDe(fixture),
      );

      const lineas = await lineasDe(creado.id);
      expect(lineas.map((l) => [l.position, l.recipeId, l.status, l.quantity, l.ingredientsCost])).toEqual([
        [0, recetaA, 'PENDIENTE', '60.0000', '150.0000'],
        [1, recetaB, 'PENDIENTE', '30.0000', '75.0000'],
      ]);
      expect(lineas.every((l) => l.reservedAt !== null)).toBe(true);
      expect(await apartadoDe(lineas.map((l) => l.id))).toEqual(['60.0000', '30.0000']);
      const pedido = await prisma.order.findUniqueOrThrow({ where: { id: creado.id } });
      expect(pedido.status).toBe('PENDIENTE');
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('QT-313 R44, R1: la ficha toma receta, cantidad, unidad, precio y coste de su linea de menor posicion, y el pedido no los guarda', async () => {
    const fixture = await crearFixture();
    try {
      const recetaA = await crearReceta(fixture);
      const recetaB = await crearReceta(fixture);

      const creado = await createOrder(
        { lines: [linea(fixture, recetaA, '60', { salePrice: '900' }), linea(fixture, recetaB, '30', { salePrice: '5' })] },
        actorDe(fixture),
      );

      const primera = await prisma.orderLine.findFirstOrThrow({ where: { orderId: creado.id, position: 0 } });
      const vista = await getOrder(creado.id, actorDe(fixture));
      expect({
        recipeId: vista.recipeId,
        quantity: vista.quantity,
        unitId: vista.unitId,
        salePrice: vista.salePrice,
        ingredientsCost: vista.ingredientsCost,
        packagingCost: vista.packagingCost,
      }).toEqual({
        recipeId: primera.recipeId,
        quantity: primera.quantity.toFixed(4),
        unitId: primera.unitId,
        salePrice: primera.salePrice?.toFixed(4) ?? null,
        ingredientsCost: primera.ingredientsCost?.toFixed(4) ?? null,
        packagingCost: primera.packagingCost?.toFixed(4) ?? null,
      });
      const columnas = await prisma.$queryRaw<ReadonlyArray<{ column_name: string }>>`
        SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders'`;
      expect(columnas.map((c) => c.column_name)).not.toContain('recipe_id');
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('QT-313 R13: si la segunda linea no alcanza y no se confirma, order_would_block y no queda nada escrito', async () => {
    const fixture = await crearFixture();
    try {
      const recetaA = await crearReceta(fixture);
      const recetaB = await crearReceta(fixture);

      await expect(
        createOrder({ lines: [linea(fixture, recetaA, '60'), linea(fixture, recetaB, '50')] }, actorDe(fixture)),
      ).rejects.toBeInstanceOf(OrderWouldBlockError);

      expect(await prisma.order.count({ where: { companyId: fixture.companyId } })).toBe(0);
      expect(await prisma.orderLine.count({ where: { companyId: fixture.companyId } })).toBe(0);
      expect(await prisma.reservationMovement.count({ where: { companyId: fixture.companyId } })).toBe(0);
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('QT-313 R14, R34: con confirmacion solo la linea que no alcanza queda BLOQUEADO, sin apartado, coste ni plazo; el pedido queda PARCIAL', async () => {
    const fixture = await crearFixture();
    try {
      const recetaA = await crearReceta(fixture);
      const recetaB = await crearReceta(fixture);

      const creado = await createOrder(
        { lines: [linea(fixture, recetaA, '60'), linea(fixture, recetaB, '50')], confirmBlocked: true },
        actorDe(fixture),
      );

      const [a, b] = await lineasDe(creado.id);
      expect([a?.status, b?.status]).toEqual(['PENDIENTE', 'BLOQUEADO']);
      expect(b?.ingredientsCost).toBeNull();
      expect(b?.reservedAt).toBeNull();
      expect(a?.reservedAt).not.toBeNull();
      expect(await apartadoDe([a?.id ?? '', b?.id ?? ''])).toEqual(['60.0000', '0.0000']);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: creado.id } })).status).toBe('PARCIAL');
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('QT-313 R4: la original y una version suya en la misma alta rechazan con duplicate_order_recipe y no escriben nada', async () => {
    const fixture = await crearFixture();
    try {
      const original = await crearReceta(fixture);
      const version = await crearReceta(fixture, original);

      await expect(
        createOrder(
          { lines: [linea(fixture, original, '10'), linea(fixture, original, '5', { recipeVersionId: version })] },
          actorDe(fixture),
        ),
      ).rejects.toBeInstanceOf(DuplicateOrderRecipeError);
      expect(await prisma.order.count({ where: { companyId: fixture.companyId } })).toBe(0);
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('QT-313 R10, R11: una segunda linea con una receta de otra empresa rechaza el alta entera con recipe_not_found y no escribe nada', async () => {
    const fixture = await crearFixture();
    const otra = await crearFixture();
    try {
      const recetaA = await crearReceta(fixture);
      const ajena = await crearReceta(otra);

      const error = await createOrder(
        { lines: [linea(fixture, recetaA, '10'), linea(fixture, ajena, '10')] },
        actorDe(fixture),
      ).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(RecipeNotFoundError);
      expect((error as RecipeNotFoundError).diagnostic).toContain('posicion 1');
      expect(await prisma.order.count({ where: { companyId: fixture.companyId } })).toBe(0);
    } finally {
      await borrarFixture(fixture);
      await borrarFixture(otra);
    }
  });
});

describe('QT-313 T10 — edicion con lineas contra la base', () => {
  async function pedidoDeDos(fixture: Fixture): Promise<{ readonly orderId: string; readonly recetaA: string; readonly recetaB: string }> {
    const recetaA = await crearReceta(fixture);
    const recetaB = await crearReceta(fixture);
    const creado = await createOrder({ lines: [linea(fixture, recetaA, '60'), linea(fixture, recetaB, '30')] }, actorDe(fixture));
    return { orderId: creado.id, recetaA, recetaB };
  }

  it('QT-313 R20, R21, R22: edita una linea, quita otra liberando su material y anade una nueva que aparta lo suyo', async () => {
    const fixture = await crearFixture();
    try {
      const { orderId, recetaA, recetaB } = await pedidoDeDos(fixture);
      const recetaC = await crearReceta(fixture);
      const [a, b] = await lineasDe(orderId);

      await updateOrder(
        orderId,
        { lines: [linea(fixture, recetaA, '40', { id: a?.id }), linea(fixture, recetaC, '20')] },
        actorDe(fixture),
      );

      const despues = await lineasDe(orderId);
      expect(despues.map((l) => [l.recipeId, l.quantity, l.status, l.deletedAt === null])).toEqual([
        [recetaA, '40.0000', 'PENDIENTE', true],
        [recetaB, '30.0000', 'PENDIENTE', false],
        [recetaC, '20.0000', 'PENDIENTE', true],
      ]);
      expect(await apartadoDe(despues.map((l) => l.id))).toEqual(['40.0000', '0.0000', '20.0000']);
      const liberado = await prisma.reservationMovement.findFirst({ where: { orderLineId: b?.id, kind: 'release' } });
      expect(liberado?.createdBy).toBe(fixture.actorId);
      // La quitada no sale en ninguna lectura del pedido.
      expect((await findAliveOrderLines(orderId, { companyId: fixture.companyId })).map((l) => l.id)).not.toContain(b?.id);
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('QT-313 R17, R25, R41: editar una linea deja coste, apartado, plazo y fila de la otra identicos', async () => {
    const fixture = await crearFixture();
    try {
      const { orderId, recetaA, recetaB } = await pedidoDeDos(fixture);
      const [a, b] = await lineasDe(orderId);
      const apartadoAntes = await apartadoDe([a?.id ?? '']);
      const movimientosAntes = await prisma.reservationMovement.count({ where: { orderLineId: a?.id } });

      await updateOrder(
        orderId,
        { lines: [linea(fixture, recetaA, '60', { id: a?.id }), linea(fixture, recetaB, '35', { id: b?.id })] },
        actorDe(fixture),
      );

      const [aDespues, bDespues] = await lineasDe(orderId);
      expect(aDespues).toEqual(a);
      expect(await apartadoDe([a?.id ?? ''])).toEqual(apartadoAntes);
      expect(await prisma.reservationMovement.count({ where: { orderLineId: a?.id } })).toBe(movimientosAntes);
      expect(bDespues?.quantity).toBe('35.0000');
      expect(bDespues?.ingredientsCost).toBe('87.5000');
      expect(await apartadoDe([b?.id ?? ''])).toEqual(['35.0000']);
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('QT-313 R4, R5: quitar la linea de una receta y anadir otra de la misma receta en la misma edicion se admite', async () => {
    const fixture = await crearFixture();
    try {
      const { orderId, recetaA, recetaB } = await pedidoDeDos(fixture);
      const [a, b] = await lineasDe(orderId);

      await updateOrder(
        orderId,
        { lines: [linea(fixture, recetaA, '60', { id: a?.id }), linea(fixture, recetaB, '10')] },
        actorDe(fixture),
      );

      const vivas = await findAliveOrderLines(orderId, { companyId: fixture.companyId });
      expect(vivas.map((l) => [l.recipeId, l.quantity])).toEqual([
        [recetaA, '60.0000'],
        [recetaB, '10.0000'],
      ]);
      expect(vivas[1]?.id).not.toBe(b?.id);
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('QT-313 R4, R5: dos lineas que se intercambian la receta en la misma edicion se guardan', async () => {
    const fixture = await crearFixture();
    try {
      const { orderId, recetaA, recetaB } = await pedidoDeDos(fixture);
      const [a, b] = await lineasDe(orderId);

      await updateOrder(
        orderId,
        { lines: [linea(fixture, recetaB, '60', { id: a?.id }), linea(fixture, recetaA, '30', { id: b?.id })] },
        actorDe(fixture),
      );

      const vivas = await findAliveOrderLines(orderId, { companyId: fixture.companyId });
      expect(vivas.map((l) => [l.id, l.recipeId, l.originalRecipeId])).toEqual([
        [a?.id, recetaB, recetaB],
        [b?.id, recetaA, recetaA],
      ]);
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('QT-313 R4: volver a anadir la receta de una linea cancelada funciona', async () => {
    const fixture = await crearFixture();
    try {
      const { orderId, recetaA, recetaB } = await pedidoDeDos(fixture);
      const [a, b] = await lineasDe(orderId);
      await withOrderTransaction((tx) =>
        createOrderWriteRepository(tx).cancelLine(orderId, b?.id ?? '', 'ya no', fixture.actorId, new Date(), { companyId: fixture.companyId }),
      );

      await updateOrder(
        orderId,
        { lines: [linea(fixture, recetaA, '60', { id: a?.id }), linea(fixture, recetaB, '10')] },
        actorDe(fixture),
      );

      const vivas = await findAliveOrderLines(orderId, { companyId: fixture.companyId });
      expect(vivas.map((l) => [l.recipeId, l.status])).toEqual([
        [recetaA, 'PENDIENTE'],
        [recetaB, 'CANCELADO'],
        [recetaB, 'PENDIENTE'],
      ]);
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('QT-313 R17, R25: findCostingBatches con excludeOrderLineId cuenta como disponible lo de esa linea y no lo de otra linea del mismo pedido', async () => {
    const fixture = await crearFixture();
    try {
      const { orderId } = await pedidoDeDos(fixture);
      const [a, b] = await lineasDe(orderId);

      const disponible = async (options?: { readonly excludeOrderLineId?: string }) =>
        (await findCostingBatches([fixture.productId], fixture.companyId, options)).map((batch) => batch.available);

      // 100 en existencia, 60 apartados por la primera linea y 30 por la segunda.
      expect(await disponible()).toEqual(['10.0000']);
      expect(await disponible({ excludeOrderLineId: a?.id })).toEqual(['70.0000']);
      expect(await disponible({ excludeOrderLineId: b?.id })).toEqual(['40.0000']);
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('QT-313 R26: editar el reparto de una linea no toca el de la otra', async () => {
    const fixture = await crearFixture();
    const envase = await seedPackaging({ companyId: fixture.companyId, presentationId: fixture.presentationId, createdBy: fixture.actorId });
    // Hasta que dos lineas puedan compartir presentacion, la segunda reparte en otra.
    const marca = token();
    const otraPresentacion = await prisma.presentation.create({
      data: { name: `Garrafa ${marca}`, nameNormalized: `garrafa${marca}`, unitId: fixture.unitId, companyId: fixture.companyId, content: '1.0000' },
      select: { id: true },
    });
    const otroEnvase = await seedPackaging({ companyId: fixture.companyId, presentationId: otraPresentacion.id, createdBy: fixture.actorId });
    try {
      const recetaA = await crearReceta(fixture);
      const recetaB = await crearReceta(fixture);
      const creado = await createOrder(
        {
          lines: [
            linea(fixture, recetaA, '10', { presentationLines: [{ packagingProductId: envase, packages: 2 }] }),
            linea(fixture, recetaB, '10', { presentationLines: [{ packagingProductId: otroEnvase, packages: 3 }] }),
          ],
        },
        actorDe(fixture),
      );
      const [a, b] = await lineasDe(creado.id);
      const repartoDeB = await prisma.orderPresentationLine.findMany({ where: { orderLineId: b?.id } });

      const resultado = await updateDistribution(creado.id, actorDe(fixture), {
        lineId: a?.id ?? '',
        unitId: fixture.unitId,
        lines: [{ packagingProductId: envase, packages: 5 }],
      });

      expect(resultado).toBe('ok');
      expect((await prisma.orderPresentationLine.findMany({ where: { orderLineId: a?.id } })).map((l) => l.packages)).toEqual([5]);
      expect(await prisma.orderPresentationLine.findMany({ where: { orderLineId: b?.id } })).toEqual(repartoDeB);
    } finally {
      await borrarFixture(fixture, [envase, otroEnvase], [otraPresentacion.id]);
    }
  });
});
