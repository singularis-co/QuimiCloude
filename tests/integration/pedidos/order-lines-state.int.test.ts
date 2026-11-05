/**
 * QT-313 T11 y T12: cancelar una linea, cancelar el pedido, darlo de baja, caducar lineas y
 * desbloquearlas, contra Postgres real, con los adaptadores driven reales de `pedidos`, `recetas`,
 * `inventario` y `unidades` cableados a mano, como `order-lines-use-cases.int.test.ts`.
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
  cancelAliveOrder,
  createOrderWriteRepository,
  findAliveOrderById,
  findAliveOrderLines,
  findAliveOrderLinesByOrderIds,
  findBlockedOrderIds,
  findExpirableOrders,
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
  createCancelOrder,
  createCancelOrderLine,
  createCreateOrder,
  createDeleteOrder,
  createExpireStaleOrders,
  createReviewBlockedOrders,
  EXPIRED_ORDER_REASON,
  NotCancellableError,
  NotDeletableError,
  ValidationError,
} from '@/lib/modules/pedidos';

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
const cancelOrder = createCancelOrder({ unitOfWork });
const cancelOrderLine = createCancelOrderLine({ unitOfWork });
const deleteOrder = createDeleteOrder({ orders, unitOfWork });
const reviewBlockedOrders = createReviewBlockedOrders({ orders, recipes, products, units, packaging, unitOfWork });

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
  /** Insumo compartido por las recetas del caso, a 2.5000. */
  readonly productId: string;
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
  };
}

async function borrarFixture(fixture: Fixture): Promise<void> {
  await prisma.reservationMovement.deleteMany({ where: { companyId: fixture.companyId } });
  await prisma.inventoryMovement.deleteMany({ where: { companyId: fixture.companyId } });
  await prisma.orderPresentationLine.deleteMany({ where: { companyId: fixture.companyId } });
  await prisma.orderLine.deleteMany({ where: { companyId: fixture.companyId } });
  await prisma.order.deleteMany({ where: { companyId: fixture.companyId } });
  await prisma.recipeLine.deleteMany({ where: { recipe: { companyId: fixture.companyId } } });
  await prisma.recipe.deleteMany({ where: { companyId: fixture.companyId } });
  await prisma.productBatch.deleteMany({ where: { productId: fixture.productId } });
  await prisma.product.deleteMany({ where: { id: fixture.productId } });
  await prisma.presentation.deleteMany({ where: { id: fixture.presentationId } });
  await prisma.unit.deleteMany({ where: { id: fixture.unitId } });
  await prisma.user.deleteMany({ where: { id: fixture.actorId } });
  await prisma.role.deleteMany({ where: { id: fixture.roleId } });
  await prisma.documentType.deleteMany({ where: { code: fixture.documentTypeCode } });
  await prisma.company.deleteMany({ where: { id: fixture.companyId } });
}

/** Una receta con el insumo del caso al 100 %: la necesidad es la cantidad de la linea. */
async function crearReceta(fixture: Fixture): Promise<string> {
  const marca = token();
  const recipe = await prisma.recipe.create({
    data: { name: `Receta ${marca}`, nameNormalized: `receta${marca}`, companyId: fixture.companyId, createdBy: fixture.actorId },
    select: { id: true },
  });
  await prisma.recipeLine.create({ data: { recipeId: recipe.id, productId: fixture.productId, percentage: new Prisma.Decimal('100.00') } });
  return recipe.id;
}

/** Un pedido de dos lineas, la primera de `cantidadA` y la segunda de `cantidadB`. */
async function crearPedidoDeDos(
  fixture: Fixture,
  cantidadA = '60',
  cantidadB = '30',
  confirmBlocked = false,
): Promise<{ readonly orderId: string; readonly lineA: string; readonly lineB: string }> {
  const recetaA = await crearReceta(fixture);
  const recetaB = await crearReceta(fixture);
  const creado = await createOrder(
    {
      lines: [
        { recipeId: recetaA, quantity: cantidadA, unitId: fixture.unitId },
        { recipeId: recetaB, quantity: cantidadB, unitId: fixture.unitId },
      ],
      confirmBlocked,
    },
    actorDe(fixture),
  );
  const lineas = await prisma.orderLine.findMany({ where: { orderId: creado.id }, orderBy: { position: 'asc' } });
  const [a, b] = lineas;
  if (a === undefined || b === undefined) throw new Error('el alta no dejo dos lineas');
  return { orderId: creado.id, lineA: a.id, lineB: b.id };
}

type LineaLeida = {
  readonly status: string;
  readonly cancellationReason: string | null;
  readonly reservedAt: Date | null;
  readonly ingredientsCost: string | null;
  readonly deletedAt: Date | null;
};

async function lineaDe(lineId: string): Promise<LineaLeida> {
  const row = await prisma.orderLine.findUniqueOrThrow({ where: { id: lineId } });
  return {
    status: row.status,
    cancellationReason: row.cancellationReason,
    reservedAt: row.reservedAt,
    ingredientsCost: row.ingredientsCost?.toFixed(4) ?? null,
    deletedAt: row.deletedAt,
  };
}

async function pedidoDe(orderId: string) {
  return prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { status: true, cancellationReason: true, deletedAt: true, reservedAt: true },
  });
}

/** Lo apartado neto de una linea. */
async function apartadoDe(lineId: string): Promise<string> {
  const rows = await prisma.reservationMovement.findMany({ where: { orderLineId: lineId } });
  return rows
    .reduce((sum, row) => (row.kind === 'reserve' ? sum.plus(row.quantity) : sum.minus(row.quantity)), new Prisma.Decimal(0))
    .toFixed(4);
}

/** Una linea en un estado posterior a la fabricacion, escrita directamente: los CHECK de la linea
 *  no piden nada mas para `POR_EMPACAR`. */
async function forzarEstado(lineId: string, status: 'POR_EMPACAR'): Promise<void> {
  await prisma.orderLine.update({ where: { id: lineId }, data: { status, reservedAt: null } });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('QT-313 T11 — cancelar una linea contra la base', () => {
  it('QT-313 R27, R34: cancelar una linea la deja CANCELADO con su motivo, libera todo lo suyo, vacia su plazo, no toca la otra y el pedido toma el estado de la que queda activa', async () => {
    const fixture = await crearFixture();
    try {
      const { orderId, lineA, lineB } = await crearPedidoDeDos(fixture);
      const antesB = await lineaDe(lineB);

      await cancelOrderLine(orderId, lineA, { reason: '  sin stock  ' }, actorDe(fixture));

      const a = await lineaDe(lineA);
      expect([a.status, a.cancellationReason, a.reservedAt]).toEqual(['CANCELADO', 'sin stock', null]);
      expect(await apartadoDe(lineA)).toBe('0.0000');
      expect(await lineaDe(lineB)).toEqual(antesB);
      expect(await apartadoDe(lineB)).toBe('30.0000');
      const pedido = await pedidoDe(orderId);
      expect([pedido.status, pedido.cancellationReason]).toEqual(['PENDIENTE', null]);
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('QT-313 R28: una linea POR_EMPACAR responde not_cancellable y un motivo vacio invalid_input, sin escribir nada', async () => {
    const fixture = await crearFixture();
    try {
      const { orderId, lineA, lineB } = await crearPedidoDeDos(fixture);
      await forzarEstado(lineA, 'POR_EMPACAR');
      const antes = [await lineaDe(lineA), await lineaDe(lineB), await pedidoDe(orderId)];

      await expect(cancelOrderLine(orderId, lineA, { reason: 'x' }, actorDe(fixture))).rejects.toBeInstanceOf(NotCancellableError);
      await expect(cancelOrderLine(orderId, lineB, { reason: '   ' }, actorDe(fixture))).rejects.toBeInstanceOf(ValidationError);

      expect([await lineaDe(lineA), await lineaDe(lineB), await pedidoDe(orderId)]).toEqual(antes);
      expect(await apartadoDe(lineB)).toBe('30.0000');
    } finally {
      await borrarFixture(fixture);
    }
  });
});

describe('QT-313 T11 — cancelar el pedido entero contra la base', () => {
  it('QT-313 R29, R34: cancela las lineas cancelables con el mismo motivo, deja intacta la POR_EMPACAR y el pedido toma su estado', async () => {
    const fixture = await crearFixture();
    try {
      const { orderId, lineA, lineB } = await crearPedidoDeDos(fixture);
      await forzarEstado(lineB, 'POR_EMPACAR');
      const antesB = await lineaDe(lineB);

      await cancelOrder(orderId, { reason: 'El cliente anulo' }, actorDe(fixture));

      const a = await lineaDe(lineA);
      expect([a.status, a.cancellationReason]).toEqual(['CANCELADO', 'El cliente anulo']);
      expect(await apartadoDe(lineA)).toBe('0.0000');
      expect(await lineaDe(lineB)).toEqual(antesB);
      expect((await pedidoDe(orderId)).status).toBe('POR_EMPACAR');
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('QT-313 R29: con todas las lineas canceladas el pedido queda CANCELADO con el motivo; sin ninguna cancelable, not_cancellable', async () => {
    const fixture = await crearFixture();
    try {
      const { orderId, lineA, lineB } = await crearPedidoDeDos(fixture);

      await cancelOrder(orderId, { reason: 'Ya no lo quiere' }, actorDe(fixture));

      expect((await lineaDe(lineA)).status).toBe('CANCELADO');
      expect((await lineaDe(lineB)).status).toBe('CANCELADO');
      expect([await apartadoDe(lineA), await apartadoDe(lineB)]).toEqual(['0.0000', '0.0000']);
      const pedido = await pedidoDe(orderId);
      expect([pedido.status, pedido.cancellationReason, pedido.reservedAt]).toEqual(['CANCELADO', 'Ya no lo quiere', null]);

      await expect(cancelOrder(orderId, { reason: 'otra vez' }, actorDe(fixture))).rejects.toBeInstanceOf(NotCancellableError);
      expect((await pedidoDe(orderId)).cancellationReason).toBe('Ya no lo quiere');
    } finally {
      await borrarFixture(fixture);
    }
  });
});

describe('QT-313 T11 — baja del pedido contra la base', () => {
  it('QT-313 R47: la baja marca el pedido y sus dos lineas, libera el material de cada una y ninguna linea vuelve en una lectura', async () => {
    const fixture = await crearFixture();
    try {
      const { orderId, lineA, lineB } = await crearPedidoDeDos(fixture);

      await deleteOrder(orderId, actorDe(fixture));

      expect((await pedidoDe(orderId)).deletedAt).not.toBeNull();
      expect((await lineaDe(lineA)).deletedAt).not.toBeNull();
      expect((await lineaDe(lineB)).deletedAt).not.toBeNull();
      expect([await apartadoDe(lineA), await apartadoDe(lineB)]).toEqual(['0.0000', '0.0000']);
      expect(await findAliveOrderLines(orderId, { companyId: fixture.companyId })).toEqual([]);
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('QT-313 R47: con una linea ya consumida (POR_EMPACAR) la baja se rechaza sin escribir nada', async () => {
    const fixture = await crearFixture();
    try {
      const { orderId, lineA, lineB } = await crearPedidoDeDos(fixture);
      await forzarEstado(lineB, 'POR_EMPACAR');

      await expect(deleteOrder(orderId, actorDe(fixture))).rejects.toBeInstanceOf(NotDeletableError);

      expect((await pedidoDe(orderId)).deletedAt).toBeNull();
      expect((await lineaDe(lineA)).deletedAt).toBeNull();
      expect(await apartadoDe(lineA)).toBe('60.0000');
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('QT-313 T11: cancelAlive y softDeleteAlive ya no copian el estado del pedido a una unica linea: con dos lineas no lanzan, la baja marca las dos y la cancelacion del pedido no toca ninguna', async () => {
    const fixture = await crearFixture('200');
    const scope = { companyId: fixture.companyId };
    try {
      const uno = await crearPedidoDeDos(fixture);
      const antes = [await lineaDe(uno.lineA), await lineaDe(uno.lineB)];

      expect(await cancelAliveOrder(uno.orderId, 'motivo', fixture.actorId, new Date(), scope)).toBe('ok');
      expect([await lineaDe(uno.lineA), await lineaDe(uno.lineB)]).toEqual(antes);

      const dos = await crearPedidoDeDos(fixture);
      const instante = new Date();
      expect(await withOrderTransaction((tx) => createOrderWriteRepository(tx).softDeleteAlive(dos.orderId, fixture.actorId, instante, scope))).toBe(
        'ok',
      );
      expect((await lineaDe(dos.lineA)).deletedAt?.toISOString()).toBe(instante.toISOString());
      expect((await lineaDe(dos.lineB)).deletedAt?.toISOString()).toBe(instante.toISOString());
    } finally {
      await borrarFixture(fixture);
    }
  });
});

describe('QT-313 T12 — caducidad y revision de bloqueados por linea contra la base', () => {
  it('QT-313 R51, R34: con dos lineas PENDIENTE de plazos distintos el proceso cancela solo la vencida, libera solo lo suyo y el pedido sigue con el estado de la otra', async () => {
    const fixture = await crearFixture();
    try {
      const { orderId, lineA, lineB } = await crearPedidoDeDos(fixture);
      const vencido = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      await withOrderTransaction((tx) =>
        createOrderWriteRepository(tx).setLineReservedAt(orderId, lineA, vencido, { companyId: fixture.companyId }),
      );
      const antesB = await lineaDe(lineB);

      const resultado = await createExpireStaleOrders({
        listCompanyIds: async () => [fixture.companyId],
        findExpirable: findExpirableOrders,
        unitOfWork,
      })();

      expect(resultado).toEqual({ expired: 1, failed: [] });
      const a = await lineaDe(lineA);
      expect([a.status, a.cancellationReason, a.reservedAt]).toEqual(['CANCELADO', EXPIRED_ORDER_REASON, null]);
      expect(await apartadoDe(lineA)).toBe('0.0000');
      expect(await lineaDe(lineB)).toEqual(antesB);
      expect(await apartadoDe(lineB)).toBe('30.0000');
      expect((await pedidoDe(orderId)).status).toBe('PENDIENTE');
      const liberado = await prisma.reservationMovement.findMany({ where: { orderLineId: lineA, kind: { not: 'reserve' } } });
      expect(liberado.map((m) => [m.kind, m.createdBy])).toEqual([['expire', null]]);
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('QT-313 R40: con dos lineas BLOQUEADO y material para una, la revision desbloquea la primera, que estrena plazo, y deja la otra', async () => {
    const fixture = await crearFixture('10');
    try {
      const { orderId, lineA, lineB } = await crearPedidoDeDos(fixture, '40', '40', true);
      expect([(await lineaDe(lineA)).status, (await lineaDe(lineB)).status]).toEqual(['BLOQUEADO', 'BLOQUEADO']);
      await prisma.productBatch.create({
        data: {
          productId: fixture.productId,
          presentationId: fixture.presentationId,
          stock: new Prisma.Decimal('35'),
          unitCost: new Prisma.Decimal('2.5000'),
          lot: `L${token().slice(0, 12)}`,
          purchaseDate: new Date('2026-09-02T00:00:00.000Z'),
          companyId: fixture.companyId,
        },
      });
      const instante = new Date();

      const resultado = await reviewBlockedOrders({ companyId: fixture.companyId, now: instante });

      expect(resultado).toEqual({ unblocked: 1, failed: [] });
      const a = await lineaDe(lineA);
      expect([a.status, a.reservedAt?.toISOString(), a.ingredientsCost]).toEqual(['PENDIENTE', instante.toISOString(), '100.0000']);
      expect(await apartadoDe(lineA)).toBe('40.0000');
      const b = await lineaDe(lineB);
      expect([b.status, b.reservedAt]).toEqual(['BLOQUEADO', null]);
      expect(await apartadoDe(lineB)).toBe('0.0000');
      expect((await pedidoDe(orderId)).status).toBe('PARCIAL');
    } finally {
      await borrarFixture(fixture);
    }
  });
});
