/**
 * QT-313 T16b: guardar la edicion de un pedido sin cambiar nada reintenta apartar el material de
 * sus lineas `BLOQUEADO` (R56), contra Postgres real y con los adaptadores driven reales.
 *
 * El pedido tiene dos lineas que comparten un insumo: la primera (30) cabe y queda `PENDIENTE`; la
 * segunda (150) no cabe en lo que queda (110) y se guarda `BLOQUEADO` con confirmacion. Con material
 * repuesto la bloqueada pasa a `PENDIENTE`; sin reponer sigue igual.
 *
 * AISLAMIENTO: `commit`. `withOrderTransaction` abre su propia transaccion sobre el cliente global;
 * cada caso siembra una empresa efimera y la borra en su `finally`.
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
import { createCreateOrder, createUpdateOrder, OrderWouldBlockError } from '@/lib/modules/pedidos';
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

import { orderScopeReaders } from '../../helpers/order-scope-readers';

import type { PackagingCatalog, PresentationCatalog, ProductCatalog } from '@/lib/modules/inventario';
import type { Actor } from '@/lib/modules/pedidos';
import type { OrderRepository } from '@/lib/modules/pedidos/ports/order-repository';
import type { OrderTransactionScope, OrderUnitOfWork } from '@/lib/modules/pedidos/ports/order-unit-of-work';
import type { RecipeCatalog } from '@/lib/modules/recetas';
import type { UnitCatalog } from '@/lib/modules/unidades';

const orders: OrderRepository = {
  findAliveById: findAliveOrderById,
  findAliveLines: findAliveOrderLines,
  findAliveLinesByOrderIds: findAliveOrderLinesByOrderIds,
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
const updateOrder = createUpdateOrder({ customerCatalog, orders, recipes, products, units, presentations, packaging, unitOfWork });

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

/** Entra un lote mas del insumo, comprado despues de los otros dos: 100 a 4.0000. */
async function reponer(fixture: Fixture): Promise<string> {
  const repuesto = await addBatchToAlive(
    fixture.productId,
    { presentationId: fixture.presentationId, stock: '100', unitCost: '4.0000', lot: null, purchaseDate: '2026-09-20', expiryDate: null, createdBy: fixture.actorId },
    new Date(),
    { companyId: fixture.companyId },
  );
  if (repuesto === null || repuesto === 'finished_product') throw new Error('no se pudo reponer el insumo');
  return repuesto.batchId;
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

type Pedido = {
  readonly orderId: string;
  readonly recetaA: string;
  readonly recetaB: string;
  /** 30, `PENDIENTE`: aparta 30 del lote viejo. */
  readonly a: string;
  /** 150, `BLOQUEADO`: no cabe en los 110 que quedan. */
  readonly b: string;
};

async function pedidoConUnaBloqueada(fixture: Fixture): Promise<Pedido> {
  const recetaA = await crearReceta(fixture);
  const recetaB = await crearReceta(fixture);
  const creado = await createOrder(
    {
      lines: [
        { recipeId: recetaA, quantity: '30', unitId: fixture.unitId },
        { recipeId: recetaB, quantity: '150', unitId: fixture.unitId },
      ],
      confirmBlocked: true,
    },
    actorDe(fixture),
  );
  const filas = await prisma.orderLine.findMany({ where: { orderId: creado.id }, orderBy: { position: 'asc' }, select: { id: true } });
  const [a, b] = filas.map((fila) => fila.id) as [string, string];
  return { orderId: creado.id, recetaA, recetaB, a, b };
}

/** La edicion «sin tocar nada»: cada linea con su id y sus datos guardados. */
function sinCambios(fixture: Fixture, pedido: Pedido, extra: Record<string, unknown> = {}) {
  return {
    lines: [
      { id: pedido.a, recipeId: pedido.recetaA, quantity: '30', unitId: fixture.unitId },
      { id: pedido.b, recipeId: pedido.recetaB, quantity: '150', unitId: fixture.unitId },
    ],
    ...extra,
  };
}

type Asiento = readonly [lote: string, cantidad: string];

function nombreDeLote(fixture: Fixture, batchId: string, repuestoId?: string): string {
  if (batchId === fixture.oldBatchId) return 'viejo';
  if (batchId === fixture.newBatchId) return 'nuevo';
  if (batchId === repuestoId) return 'repuesto';
  return batchId;
}

/** Los asientos de reserva de un tipo para la linea, por lote, ordenados por lote. */
async function asientosDe(
  fixture: Fixture,
  lineId: string,
  kind: 'reserve' | 'release',
  repuestoId?: string,
): Promise<readonly Asiento[]> {
  const rows = await prisma.reservationMovement.findMany({ where: { orderLineId: lineId, kind }, select: { batchId: true, quantity: true } });
  return rows
    .map((row) => [nombreDeLote(fixture, row.batchId, repuestoId), row.quantity.toFixed(4)] as const)
    .sort((x, y) => x[0].localeCompare(y[0]));
}

/** Todo lo que la edicion podria escribir de una linea, con sus marcas de tiempo. */
async function lineaLeida(lineId: string) {
  const row = await prisma.orderLine.findUniqueOrThrow({
    where: { id: lineId },
    select: { status: true, quantity: true, ingredientsCost: true, packagingCost: true, reservedAt: true, updatedAt: true, updatedBy: true },
  });
  return {
    status: row.status,
    quantity: row.quantity.toFixed(4),
    ingredientsCost: row.ingredientsCost?.toFixed(4) ?? null,
    packagingCost: row.packagingCost?.toFixed(4) ?? null,
    reservedAt: row.reservedAt,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

async function pedidoLeido(orderId: string) {
  return prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true, updatedAt: true, updatedBy: true } });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('QT-313 T16b — reintento de reserva de las lineas BLOQUEADO al editar', () => {
  it('QT-313 R56, R34, R25: con material repuesto, guardar sin cambios deja la bloqueada PENDIENTE con su apartado lote a lote y no toca la otra', async () => {
    const fixture = await crearFixture();
    try {
      const pedido = await pedidoConUnaBloqueada(fixture);
      expect((await pedidoLeido(pedido.orderId)).status).toBe('PARCIAL');
      expect((await lineaLeida(pedido.b)).status).toBe('BLOQUEADO');
      const aAntes = await lineaLeida(pedido.a);
      const asientosDeAAntes = await prisma.reservationMovement.findMany({
        where: { orderLineId: pedido.a },
        orderBy: { id: 'asc' },
      });

      const repuesto = await reponer(fixture);
      const antes = new Date();
      await updateOrder(pedido.orderId, sinCambios(fixture, pedido), actorDe(fixture));

      // La bloqueada ve lo que aparto la primera (30 del viejo): toma los 10 que quedan del viejo,
      // los 100 del nuevo y 40 del repuesto.
      expect(await asientosDe(fixture, pedido.b, 'reserve', repuesto)).toEqual([
        ['nuevo', '100.0000'],
        ['repuesto', '40.0000'],
        ['viejo', '10.0000'],
      ]);
      expect(await asientosDe(fixture, pedido.b, 'release', repuesto)).toEqual([]);
      const b = await lineaLeida(pedido.b);
      expect(b.status).toBe('PENDIENTE');
      expect(b.quantity).toBe('150.0000');
      // Coste con las reglas de hoy (`order-cost.ts`): promedio simple de los lotes con disponible,
      // (2,5 + 3 + 4) / 3, por los 150 de la linea. Antes del reintento no tenia coste.
      expect(b.ingredientsCost).toBe('475.0000');
      expect(b.reservedAt).not.toBeNull();
      expect(b.reservedAt?.getTime()).toBeGreaterThanOrEqual(antes.getTime());

      // La otra linea no cambia ni de fila ni de asientos (R25).
      expect(await lineaLeida(pedido.a)).toEqual(aAntes);
      expect(await prisma.reservationMovement.findMany({ where: { orderLineId: pedido.a }, orderBy: { id: 'asc' } })).toEqual(
        asientosDeAAntes,
      );

      // El pedido se vuelve a derivar: las dos activas PENDIENTE (R34).
      expect((await pedidoLeido(pedido.orderId)).status).toBe('PENDIENTE');
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('QT-313 R56: sin reponer, sin confirmacion rechaza con order_would_block sin escribir; con confirmacion sigue BLOQUEADO sin apartado ni plazo', async () => {
    const fixture = await crearFixture();
    try {
      const pedido = await pedidoConUnaBloqueada(fixture);
      const aAntes = await lineaLeida(pedido.a);
      const bAntes = await lineaLeida(pedido.b);
      const pedidoAntes = await pedidoLeido(pedido.orderId);
      const movimientosAntes = await prisma.reservationMovement.findMany({
        where: { companyId: fixture.companyId },
        orderBy: { id: 'asc' },
      });

      await expect(updateOrder(pedido.orderId, sinCambios(fixture, pedido), actorDe(fixture))).rejects.toBeInstanceOf(
        OrderWouldBlockError,
      );

      expect(await lineaLeida(pedido.a)).toEqual(aAntes);
      expect(await lineaLeida(pedido.b)).toEqual(bAntes);
      expect(await pedidoLeido(pedido.orderId)).toEqual(pedidoAntes);
      expect(await prisma.reservationMovement.findMany({ where: { companyId: fixture.companyId }, orderBy: { id: 'asc' } })).toEqual(
        movimientosAntes,
      );

      await updateOrder(pedido.orderId, sinCambios(fixture, pedido, { confirmBlocked: true }), actorDe(fixture));

      const b = await lineaLeida(pedido.b);
      expect(b.status).toBe('BLOQUEADO');
      expect(b.reservedAt).toBeNull();
      expect(b.ingredientsCost).toBeNull();
      expect(await asientosDe(fixture, pedido.b, 'reserve')).toEqual([]);
      const a = await lineaLeida(pedido.a);
      expect([a.status, a.ingredientsCost, a.reservedAt]).toEqual([aAntes.status, aAntes.ingredientsCost, aAntes.reservedAt]);
      expect(await asientosDe(fixture, pedido.a, 'reserve')).toEqual([['viejo', '30.0000']]);
      expect(await asientosDe(fixture, pedido.a, 'release')).toEqual([]);
      expect((await pedidoLeido(pedido.orderId)).status).toBe('PARCIAL');
    } finally {
      await borrarFixture(fixture);
    }
  });
});
