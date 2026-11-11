/**
 * QT-313 T14a: abrir, finalizar, empaque y acondicionamiento por linea, contra Postgres real.
 *
 * Los pedidos se crean con el alta por lineas y se recorren por la via nueva: las operaciones de
 * `OrderCatalog` que reciben la linea, cableadas con los adaptadores reales, y los casos de uso de
 * `asignaciones` de `@/lib/composition` para un pedido de una linea. Cada CHECK de `orders` que
 * nombra el estado se ejercita con el estado derivado que lo dispara.
 *
 * AISLAMIENTO: `commit`. La unidad de trabajo y las escrituras de empaque y acondicionamiento abren
 * su propia transaccion sobre el cliente global. Cada caso siembra una empresa efimera y la borra en
 * su `finally`.
 */
import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { asignaciones, pedidos } from '@/lib/composition';
import { normalizeCompanyName, ROLE_OPERADOR } from '@/lib/modules/identity';
import { createConditioningTeamRepository } from '@/lib/modules/asignaciones/adapters/driven/persistence/conditioning-team-prisma';
import { createStepEvidenceRepository } from '@/lib/modules/asignaciones/adapters/driven/persistence/step-evidence-prisma';
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
import { createWithFirstBatch, findFinishedGoodsReceipts } from '@/lib/modules/inventario/adapters/driven/persistence/product-prisma';
import { createMaterialReservations } from '@/lib/modules/inventario/adapters/driven/persistence/reservation-prisma';
import {
  createCancelOrderLine,
  createCreateOrder,
  createFinishConditioning,
  createFinishPacking,
  createStartConditioning,
  createStartPacking,
  createTransitionOrder,
} from '@/lib/modules/pedidos';
import {
  createOrderConditioningRepository,
  createOrderPackingRepository,
  createOrderWriteRepository,
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

import { realOrderSummaries } from '../../helpers/order-summaries';
import { orderScopeReaders } from '../../helpers/order-scope-readers';
import { dropPackaging, seedPackaging } from '../../helpers/packaging-seed';

import type { Actor as PedidosActor, PackedLineCount } from '@/lib/modules/pedidos';
import type { PackagingCatalog, PresentationCatalog, ProductCatalog } from '@/lib/modules/inventario';
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
const transition = createTransitionOrder({ unitOfWork });
const startPacking = createStartPacking({ packing: createOrderPackingRepository() });
const finishPacking = createFinishPacking({ packing: createOrderPackingRepository(), unitOfWork, recipes, units, presentations });
const startConditioning = createStartConditioning({ conditioning: createOrderConditioningRepository() });
const finishConditioning = createFinishConditioning({ conditioning: createOrderConditioningRepository() });
const cancelOrderLine = createCancelOrderLine({ unitOfWork });
const summaries = realOrderSummaries();

const PERMISOS = [
  'pedidos.consultar',
  'pedidos.modificar',
  'asignaciones.consultar',
  'asignaciones.ejecutar',
  'empaque.modificar',
  'acondicionamiento.modificar',
] as const;

function token(): string {
  return randomUUID().replace(/-/gu, '');
}

type Fixture = {
  readonly companyId: string;
  readonly actorId: string;
  readonly otherActorId: string;
  readonly roleId: string;
  readonly documentTypeCode: string;
  readonly presentationId: string;
  readonly unitId: string;
  /** Insumo compartido por las recetas del caso, a 2.5000. */
  readonly productId: string;
  /** Un envase por linea posible, cada uno con su presentacion, a 0.5000: dos lineas todavia no
   *  comparten presentacion en el reparto. */
  readonly packagingProductIds: readonly [string, string];
  readonly presentationIds: readonly [string, string];
};

function actorDe(fixture: Fixture, id = fixture.actorId): PedidosActor {
  return { id, companyId: fixture.companyId, permissions: [...PERMISOS] };
}

async function crearPersona(companyId: string, roleId: string, documentTypeCode: string, nombre: string): Promise<string> {
  const marca = token();
  const user = await prisma.user.create({
    data: {
      firstNames: nombre,
      lastNames: 'Prueba',
      birthDate: new Date('1990-05-17T00:00:00.000Z'),
      email: `${nombre.toLowerCase()}.${marca}@quimicloude.test`,
      phone: '+57 300 111 2233',
      documentTypeCode,
      documentNumber: marca.slice(0, 12),
      username: `${nombre.toLowerCase()}.${marca}`,
      passwordHash: 'hash-de-prueba-no-es-un-algoritmo-real',
      roleId,
      companyId,
    },
    select: { id: true },
  });
  return user.id;
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
  const actorId = await crearPersona(company.id, role.id, documentType.code, 'Ana');
  const otherActorId = await crearPersona(company.id, role.id, documentType.code, 'Luis');
  const unit = await prisma.unit.create({
    data: { name: `Unidad ${marca}`, nameNormalized: `unidad${marca}`, symbol: `kg${marca}` },
    select: { id: true },
  });
  const presentation = await prisma.presentation.create({
    data: { name: `Bidon ${marca}`, nameNormalized: `bidon${marca}`, unitId: unit.id, companyId: company.id, content: '1.0000' },
    select: { id: true },
  });
  const insumo = await createWithFirstBatch(
    { name: `Insumo ${marca}` },
    {
      presentationId: presentation.id,
      stock: '1000',
      unitCost: '2.5000',
      lot: null,
      purchaseDate: '2026-09-01',
      expiryDate: null,
      createdBy: actorId,
    },
    new Date(),
    { companyId: company.id },
  );
  const otra = await prisma.presentation.create({
    data: { name: `Garrafa ${marca}`, nameNormalized: `garrafa${marca}`, unitId: unit.id, companyId: company.id, content: '1.0000' },
    select: { id: true },
  });
  const packagingProductIds = [
    await seedPackaging({ companyId: company.id, presentationId: presentation.id, createdBy: actorId }),
    await seedPackaging({ companyId: company.id, presentationId: otra.id, createdBy: actorId }),
  ] as const;
  return {
    companyId: company.id,
    actorId,
    otherActorId,
    roleId: role.id,
    documentTypeCode: documentType.code,
    presentationId: presentation.id,
    unitId: unit.id,
    productId: insumo.id,
    packagingProductIds,
    presentationIds: [presentation.id, otra.id],
  };
}

async function borrarFixture(fixture: Fixture): Promise<void> {
  const where = { companyId: fixture.companyId };
  await prisma.orderExecutionEntry.deleteMany({ where });
  await prisma.orderConditioningTeamMember.deleteMany({ where });
  await prisma.orderStepEvidence.deleteMany({ where });
  await prisma.orderAssignment.deleteMany({ where });
  await prisma.reservationMovement.deleteMany({ where });
  await prisma.inventoryMovement.deleteMany({ where });
  await prisma.orderPresentationLine.deleteMany({ where });
  await prisma.orderLine.deleteMany({ where });
  await prisma.order.deleteMany({ where });
  await dropPackaging([...fixture.packagingProductIds]);
  await prisma.recipeLine.deleteMany({ where: { recipe: { companyId: fixture.companyId } } });
  await prisma.productBatch.deleteMany({ where: { product: { companyId: fixture.companyId } } });
  await prisma.product.deleteMany({ where });
  await prisma.recipe.deleteMany({ where });
  await prisma.presentation.deleteMany({ where: { id: { in: [fixture.presentationId, ...fixture.presentationIds] } } });
  await prisma.unit.deleteMany({ where: { id: fixture.unitId } });
  await prisma.user.deleteMany({ where });
  await prisma.role.deleteMany({ where: { id: fixture.roleId } });
  await prisma.documentType.deleteMany({ where: { code: fixture.documentTypeCode } });
  await prisma.company.deleteMany({ where: { id: fixture.companyId } });
}

async function conFixture(work: (fixture: Fixture) => Promise<void>): Promise<void> {
  const fixture = await crearFixture();
  try {
    await work(fixture);
  } finally {
    await borrarFixture(fixture);
  }
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

type Pedido = { readonly orderId: string; readonly lines: readonly string[] };

/** Un pedido con una linea por cantidad, cada una repartida en envases de 1 de su cantidad. */
async function crearPedido(fixture: Fixture, cantidades: readonly string[]): Promise<Pedido> {
  const lineas = [];
  for (const [index, cantidad] of cantidades.entries()) {
    lineas.push({
      recipeId: await crearReceta(fixture),
      quantity: cantidad,
      unitId: fixture.unitId,
      presentationLines: [{ packagingProductId: fixture.packagingProductIds[index % 2] as string, packages: Number(cantidad) }],
    });
  }
  const creado = await createOrder({ lines: lineas }, actorDe(fixture));
  const filas = await prisma.orderLine.findMany({ where: { orderId: creado.id }, orderBy: { position: 'asc' }, select: { id: true } });
  return { orderId: creado.id, lines: filas.map((fila) => fila.id) };
}

/** El conteo del plan de la linea: cada fila de su reparto, sin diferencia. */
async function conteoDe(lineId: string): Promise<readonly PackedLineCount[]> {
  const filas = await prisma.orderPresentationLine.findMany({ where: { orderLineId: lineId }, select: { id: true, packages: true } });
  return filas.map((fila) => ({ lineId: fila.id, packedPackages: fila.packages, reason: null, reasonOther: null }));
}

async function aEmpaque(fixture: Fixture, orderId: string, lineId: string, packerId = fixture.actorId): Promise<void> {
  const ahora = new Date();
  expect(await transition(orderId, lineId, fixture.companyId, 'PENDIENTE', 'EN_CURSO', fixture.actorId, ahora)).toBe('ok');
  expect(await transition(orderId, lineId, fixture.companyId, 'EN_CURSO', 'POR_EMPACAR', fixture.actorId, ahora)).toBe('ok');
  expect(await startPacking(orderId, lineId, fixture.companyId, packerId, new Date())).toBe('ok');
}

async function aPorAcondicionar(fixture: Fixture, orderId: string, lineId: string): Promise<void> {
  await aEmpaque(fixture, orderId, lineId);
  const terminado = await finishPacking(orderId, lineId, fixture.companyId, fixture.actorId, new Date(), await conteoDe(lineId));
  expect(terminado).toMatchObject({ kind: 'ok' });
}

async function aAcondicionamiento(
  fixture: Fixture,
  orderId: string,
  lineId: string,
  conditionerId = fixture.actorId,
): Promise<void> {
  await aPorAcondicionar(fixture, orderId, lineId);
  expect(await startConditioning(orderId, lineId, fixture.companyId, conditionerId, new Date())).toBe('ok');
}

async function aTerminado(fixture: Fixture, orderId: string, lineId: string, at: Date): Promise<void> {
  await aAcondicionamiento(fixture, orderId, lineId);
  expect(await finishConditioning(orderId, lineId, fixture.companyId, fixture.actorId, at)).toBe('ok');
}

/** El estado derivado del pedido: lo de cada etapa vive en sus lineas. */
async function pedidoDe(orderId: string) {
  return prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } });
}

async function lineaDe(lineId: string) {
  const row = await prisma.orderLine.findUniqueOrThrow({
    where: { id: lineId },
    select: { status: true, packedBy: true, conditionedBy: true, finishedAt: true, actualCost: true, reservedAt: true },
  });
  return { ...row, actualCost: row.actualCost === null ? null : row.actualCost.toFixed(4) };
}

describe('QT-313 T14a — el flujo de planta escribe la linea y deriva el pedido', () => {
  it('QT-313 R31, R32: una linea recorre todo el flujo y la otra se queda PENDIENTE; el pedido queda PARCIAL', async () => {
    await conFixture(async (fixture) => {
      const { orderId, lines } = await crearPedido(fixture, ['6', '3']);
      const [a, b] = lines as [string, string];

      const ahora = new Date();
      expect(await transition(orderId, a, fixture.companyId, 'PENDIENTE', 'EN_CURSO', fixture.actorId, ahora)).toBe('ok');
      expect((await lineaDe(b)).status).toBe('PENDIENTE');
      expect((await pedidoDe(orderId)).status).toBe('PARCIAL');

      expect(await transition(orderId, a, fixture.companyId, 'EN_CURSO', 'POR_EMPACAR', fixture.actorId, ahora)).toBe('ok');
      expect(await startPacking(orderId, a, fixture.companyId, fixture.actorId, new Date())).toBe('ok');
      expect((await lineaDe(a)).status).toBe('EN_EMPAQUE');
      expect(await finishPacking(orderId, a, fixture.companyId, fixture.actorId, new Date(), await conteoDe(a))).toMatchObject({ kind: 'ok' });
      expect(await startConditioning(orderId, a, fixture.companyId, fixture.actorId, new Date())).toBe('ok');
      expect(await finishConditioning(orderId, a, fixture.companyId, fixture.actorId, new Date())).toBe('ok');

      expect((await lineaDe(a)).status).toBe('TERMINADO');
      expect((await lineaDe(b)).status).toBe('PENDIENTE');
      expect((await pedidoDe(orderId)).status).toBe('PARCIAL');
    });
  });

  it('QT-313 R31: una linea que no esta en `from` responde stale y una de otro pedido not_found, sin escribir', async () => {
    await conFixture(async (fixture) => {
      const uno = await crearPedido(fixture, ['2']);
      const otro = await crearPedido(fixture, ['2']);
      const [linea] = uno.lines as [string];

      expect(await transition(uno.orderId, linea, fixture.companyId, 'EN_CURSO', 'POR_EMPACAR', fixture.actorId, new Date())).toBe('stale');
      expect(await transition(otro.orderId, linea, fixture.companyId, 'PENDIENTE', 'EN_CURSO', fixture.actorId, new Date())).toBe('not_found');
      expect(await startPacking(otro.orderId, linea, fixture.companyId, fixture.actorId, new Date())).toBe('not_found');
      expect((await lineaDe(linea)).status).toBe('PENDIENTE');
    });
  });

  it('QT-313 R36: finalizar una linea consume solo lo apartado para ella, con el insumo compartido', async () => {
    await conFixture(async (fixture) => {
      const { orderId, lines } = await crearPedido(fixture, ['6', '3']);
      const [a, b] = lines as [string, string];
      const apartadoDe = async (lineId: string) =>
        prisma.reservationMovement.findMany({ where: { orderLineId: lineId }, select: { kind: true, quantity: true } });
      const apartadoDeB = await apartadoDe(b);

      expect(await transition(orderId, a, fixture.companyId, 'PENDIENTE', 'EN_CURSO', fixture.actorId, new Date())).toBe('ok');
      expect(await transition(orderId, a, fixture.companyId, 'EN_CURSO', 'POR_EMPACAR', fixture.actorId, new Date())).toBe('ok');

      const consumos = await prisma.inventoryMovement.findMany({
        where: { orderId, kind: 'consumption', batch: { productId: fixture.productId } },
        select: { orderLineId: true, quantity: true },
      });
      expect(consumos.map((consumo) => [consumo.orderLineId, consumo.quantity.toFixed(4)])).toEqual([[a, '-6.0000']]);
      expect(await apartadoDe(b)).toEqual(apartadoDeB);
      expect((await lineaDe(a)).reservedAt).toBeNull();
      expect((await lineaDe(b)).status).toBe('PENDIENTE');
    });
  });

  it('QT-313 R38, R37: terminar el empaque guarda el coste real de esa linea y cada lote de producto terminado lleva su linea', async () => {
    await conFixture(async (fixture) => {
      const { orderId, lines } = await crearPedido(fixture, ['6', '3']);
      const [a, b] = lines as [string, string];

      await aPorAcondicionar(fixture, orderId, a);

      // 6 del insumo a 2.5000 y 6 envases a 0.5000.
      expect((await lineaDe(a)).actualCost).toBe('18.0000');
      expect((await lineaDe(b)).actualCost).toBeNull();
      const produccion = await prisma.inventoryMovement.findMany({ where: { orderId, kind: 'production' }, select: { orderLineId: true } });
      expect(produccion.length).toBeGreaterThan(0);
      expect(produccion.every((asiento) => asiento.orderLineId === a)).toBe(true);
    });
  });
});

describe('QT-313 T14a — con una linea, las salidas son las de hoy', () => {
  it('QT-313 R45: OrderView de un pedido de una linea lleva el coste real de la linea, y la linea su etapa y su fecha de terminado', async () => {
    await conFixture(async (fixture) => {
      const { orderId, lines } = await crearPedido(fixture, ['4']);
      const [linea] = lines as [string];
      const terminado = new Date('2026-10-03T10:00:00.000Z');

      await aTerminado(fixture, orderId, linea, terminado);

      const vista = await pedidos.getOrder(orderId, actorDe(fixture));
      expect(vista.status).toBe('TERMINADO');
      // 4 del insumo a 2.5000 y 4 envases a 0.5000.
      expect(vista.lines[0]?.actualCost).toBe('12.0000');
      expect(vista.actualCostTotal).toBe('12.0000');
      expect(vista.lines[0]?.finishedAt?.toISOString()).toBe(terminado.toISOString());
      const etapa = await lineaDe(linea);
      expect(etapa).toMatchObject({ packedBy: fixture.actorId, conditionedBy: fixture.actorId, actualCost: '12.0000' });
      expect(etapa.finishedAt?.toISOString()).toBe(terminado.toISOString());
    });
  });

  it('QT-313 R45, R19: el resumen de un pedido de una linea es el de hoy mas lineId, sin precio', async () => {
    await conFixture(async (fixture) => {
      const { orderId, lines } = await crearPedido(fixture, ['5']);
      const [linea] = lines as [string];
      await aEmpaque(fixture, orderId, linea);

      const pagina = await summaries.listAliveSummariesByIds(fixture.companyId, [orderId], ['EN_EMPAQUE'], 1, 10);
      expect(pagina.total).toBe(1);
      const [fila] = pagina.items;
      const pedido = await prisma.orderLine.findFirstOrThrow({ where: { orderId: orderId }, orderBy: { position: 'asc' }, select: { recipeId: true, quantity: true, unitId: true } });
      expect(fila).toMatchObject({
        id: orderId,
        lineId: linea,
        recipeId: pedido.recipeId,
        quantity: pedido.quantity.toFixed(4),
        unitId: pedido.unitId,
        status: 'EN_EMPAQUE',
        packedBy: fixture.actorId,
        conditionedBy: null,
        finishedAt: null,
      });
      expect(fila?.presentationLines).toHaveLength(1);
      expect(Object.keys(fila ?? {})).not.toContain('salePrice');
      expect(JSON.stringify(pagina)).not.toMatch(/salePrice|sale_price/u);
    });
  });

  it('QT-313 R45: un pedido de dos lineas en el mismo estado sale como dos filas, cada una con la suya', async () => {
    await conFixture(async (fixture) => {
      const { orderId, lines } = await crearPedido(fixture, ['2', '3']);

      const pagina = await summaries.listAliveSummariesByIds(fixture.companyId, [orderId], ['PENDIENTE'], 1, 10);

      expect(pagina.total).toBe(2);
      expect(pagina.items.map((fila) => [fila.id, fila.lineId, fila.quantity])).toEqual([
        [orderId, lines[0], '2.0000'],
        [orderId, lines[1], '3.0000'],
      ]);
    });
  });
});

describe('QT-313 T14a — asignaciones opera la unica linea del pedido', () => {
  async function asignar(fixture: Fixture, orderId: string): Promise<void> {
    await prisma.orderAssignment.create({ data: { orderId, userId: fixture.actorId, companyId: fixture.companyId } });
  }

  it('QT-313 R35, R37: el responsable del pedido abre, finaliza y empaca su linea, y cada anotacion lleva la linea', async () => {
    await conFixture(async (fixture) => {
      const { orderId, lines } = await crearPedido(fixture, ['3']);
      const [linea] = lines as [string];
      await asignar(fixture, orderId);
      const actor = actorDe(fixture);

      const abierta = await asignaciones.startAssignedOrder(actor, { orderId, lineId: linea });
      expect(abierta.status).toBe('EN_CURSO');
      await asignaciones.finishAssignedOrder(actor, { orderId, lineId: linea, stepPosition: null });
      await asignaciones.startPacking(actor, { orderId, lineId: linea });
      await asignaciones.finishPacking(actor, { orderId, lineId: linea, counts: (await conteoDe(linea)).map(({ lineId, ...resto }) => ({ presentationLineId: lineId, ...resto })) });

      expect((await lineaDe(linea)).status).toBe('POR_ACONDICIONAR');
      expect((await pedidoDe(orderId)).status).toBe('POR_ACONDICIONAR');
      const anotaciones = await prisma.orderExecutionEntry.findMany({
        where: { orderId },
        orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
        select: { action: true, orderLineId: true },
      });
      expect(anotaciones.map((anotacion) => anotacion.action)).toEqual(['START', 'FINISH', 'PACK_START', 'PACK_FINISH']);
      expect(anotaciones.every((anotacion) => anotacion.orderLineId === linea)).toBe(true);
    });
  });

  it('R11, R12: con dos lineas PENDIENTE, comenzar la nombrada la deja EN_CURSO, la anota y no toca la otra', async () => {
    await conFixture(async (fixture) => {
      const { orderId, lines } = await crearPedido(fixture, ['2', '3']);
      const [primera, segunda] = lines as [string, string];
      await asignar(fixture, orderId);

      await asignaciones.startAssignedOrder(actorDe(fixture), { orderId, lineId: segunda });

      expect((await lineaDe(segunda)).status).toBe('EN_CURSO');
      expect((await lineaDe(primera)).status).toBe('PENDIENTE');
      const anotaciones = await prisma.orderExecutionEntry.findMany({ where: { orderId }, select: { orderLineId: true } });
      expect(anotaciones.map((anotacion) => anotacion.orderLineId)).toEqual([segunda]);
    });
  });

  it('R16, R17, R20: cancelar desde la ejecucion deja CANCELADO solo la receta nombrada, anota en su registro, la otra sigue y el aviso trae la receta', async () => {
    await conFixture(async (fixture) => {
      const { orderId, lines } = await crearPedido(fixture, ['2', '3']);
      const [primera, segunda] = lines as [string, string];
      await asignar(fixture, orderId);

      const salida = await asignaciones.cancelAssignedOrder(actorDe(fixture), {
        orderId,
        lineId: primera,
        stepPosition: null,
        reason: 'Se derramo el lote',
      });

      expect(salida.recipeCount).toBe(2);
      expect(salida.recipeName).toEqual(expect.any(String));

      expect((await lineaDe(primera)).status).toBe('CANCELADO');
      expect((await lineaDe(segunda)).status).toBe('PENDIENTE');
      const anotaciones = await prisma.orderExecutionEntry.findMany({ where: { orderId }, select: { action: true, orderLineId: true } });
      expect(anotaciones).toEqual([{ action: 'CANCEL', orderLineId: primera }]);

      await expect(
        asignaciones.cancelAssignedOrder(actorDe(fixture), { orderId, lineId: primera, stepPosition: null, reason: 'otra vez' }),
      ).rejects.toMatchObject({ code: 'not_cancellable' });
      expect(await prisma.orderExecutionEntry.count({ where: { orderId } })).toBe(1);
    });
  });

  it('R14: sin lineId responde invalid_input sin escribir', async () => {
    await conFixture(async (fixture) => {
      const { orderId, lines } = await crearPedido(fixture, ['2', '3']);
      await asignar(fixture, orderId);

      await expect(asignaciones.startAssignedOrder(actorDe(fixture), { orderId })).rejects.toMatchObject({ code: 'invalid_input' });

      expect(await prisma.orderExecutionEntry.count({ where: { orderId } })).toBe(0);
      for (const linea of lines) expect((await lineaDe(linea)).status).toBe('PENDIENTE');
    });
  });

  it('QT-313 R37: el equipo de acondicionamiento y las evidencias se guardan con la linea que se opera', async () => {
    await conFixture(async (fixture) => {
      const { orderId, lines } = await crearPedido(fixture, ['2']);
      const [linea] = lines as [string];

      await createConditioningTeamRepository().insertAll([
        { orderId, orderLineId: linea, userId: fixture.actorId, companyId: fixture.companyId, workGroupId: null, workGroupName: null, position: 0 },
      ]);
      const evidencia = await createStepEvidenceRepository().insert({
        companyId: fixture.companyId,
        orderId,
        orderLineId: linea,
        phase: 'manufacturing',
        stepPosition: 1,
        path: `${fixture.companyId}/${orderId}/${randomUUID()}`,
        contentType: 'image/jpeg',
        sizeBytes: 2048,
        uploadedBy: fixture.actorId,
      });
      expect(typeof evidencia).toBe('object');

      expect(await prisma.orderConditioningTeamMember.findMany({ where: { orderId }, select: { orderLineId: true } })).toEqual([
        { orderLineId: linea },
      ]);
      expect(await prisma.orderStepEvidence.findMany({ where: { orderId }, select: { orderLineId: true } })).toEqual([
        { orderLineId: linea },
      ]);
    });
  });
});

describe('QT-313 R55 — responsables en un pedido PARCIAL', () => {
  /** El actor de las escrituras de responsables: las tres piden `asignaciones.modificar`. */
  function quienAsigna(fixture: Fixture): PedidosActor {
    return { id: fixture.actorId, companyId: fixture.companyId, permissions: [...PERMISOS, 'asignaciones.modificar'] };
  }

  /** Las asignaciones del pedido, para afirmar que un rechazo no escribio nada. */
  async function asignacionesDe(orderId: string) {
    return prisma.orderAssignment.findMany({ where: { orderId }, orderBy: { userId: 'asc' }, select: { userId: true, workGroupId: true } });
  }

  /** Las tres escrituras, con el codigo de cada una (o `'ok'`). */
  async function lasTres(fixture: Fixture, orderId: string): Promise<readonly string[]> {
    const actor = quienAsigna(fixture);
    // Quien se asigna tiene que poder ser responsable: cuenta activa (el fixture la crea `pending`)
    // y rol Operador, el rol base de la siembra.
    const operador = await prisma.role.findUniqueOrThrow({ where: { name: ROLE_OPERADOR }, select: { id: true } });
    await prisma.user.update({ where: { id: fixture.otherActorId }, data: { accountStatus: 'active', roleId: operador.id } });
    const codigos: string[] = [];
    const escrituras = [
      () => asignaciones.assignResponsibles(actor, { orderId, userIds: [fixture.otherActorId], workGroupIds: [] }, new Date()),
      () => asignaciones.removeWorkGroupFromOrder(actor, { orderId, workGroupId: randomUUID() }),
      () => asignaciones.unassignResponsible(actor, { orderId, userId: fixture.actorId }),
    ];
    for (const escritura of escrituras) {
      try {
        await escritura();
        codigos.push('ok');
      } catch (error) {
        codigos.push((error as { readonly code?: string }).code ?? String(error));
      }
    }
    return codigos;
  }

  it('QT-313 R55: un PARCIAL con una linea PENDIENTE admite asignar, quitar grupo y desasignar', async () => {
    await conFixture(async (fixture) => {
      const { orderId, lines } = await crearPedido(fixture, ['2', '3']);
      const [primera] = lines as [string, string];
      const ahora = new Date();
      expect(await transition(orderId, primera, fixture.companyId, 'PENDIENTE', 'EN_CURSO', fixture.actorId, ahora)).toBe('ok');
      expect(await transition(orderId, primera, fixture.companyId, 'EN_CURSO', 'POR_EMPACAR', fixture.actorId, ahora)).toBe('ok');
      expect((await pedidoDe(orderId)).status).toBe('PARCIAL');
      await prisma.orderAssignment.create({ data: { orderId, userId: fixture.actorId, companyId: fixture.companyId } });

      expect(await lasTres(fixture, orderId)).toEqual(['ok', 'ok', 'ok']);

      // Entro el nuevo y salio el que estaba.
      expect(await asignacionesDe(orderId)).toEqual([{ userId: fixture.otherActorId, workGroupId: null }]);
    });
  });

  it('QT-313 R55: un PARCIAL con todas sus lineas activas fabricadas rechaza las tres con order_produced_frozen sin escribir', async () => {
    await conFixture(async (fixture) => {
      const { orderId, lines } = await crearPedido(fixture, ['2', '3']);
      const [primera, segunda] = lines as [string, string];
      const ahora = new Date();
      expect(await transition(orderId, primera, fixture.companyId, 'PENDIENTE', 'EN_CURSO', fixture.actorId, ahora)).toBe('ok');
      expect(await transition(orderId, primera, fixture.companyId, 'EN_CURSO', 'POR_EMPACAR', fixture.actorId, ahora)).toBe('ok');
      await aEmpaque(fixture, orderId, segunda);
      expect((await pedidoDe(orderId)).status).toBe('PARCIAL');
      await prisma.orderAssignment.create({ data: { orderId, userId: fixture.actorId, companyId: fixture.companyId } });
      const antes = await asignacionesDe(orderId);

      expect(await lasTres(fixture, orderId)).toEqual(['order_produced_frozen', 'order_produced_frozen', 'order_produced_frozen']);

      expect(await asignacionesDe(orderId)).toEqual(antes);
    });
  });

  it('QT-313 R55: una linea cancelada no cuenta: con las demas fabricadas, el PARCIAL rechaza sin escribir', async () => {
    await conFixture(async (fixture) => {
      // La linea que se cancelara va sin reparto: dos lineas aun no comparten presentacion, y el
      // fixture solo trae dos envases.
      const conReparto = async (index: number, cantidad: string) => ({
        recipeId: await crearReceta(fixture),
        quantity: cantidad,
        unitId: fixture.unitId,
        presentationLines: [{ packagingProductId: fixture.packagingProductIds[index] as string, packages: Number(cantidad) }],
      });
      const creado = await createOrder(
        {
          lines: [
            { recipeId: await crearReceta(fixture), quantity: '1', unitId: fixture.unitId, presentationLines: [] },
            await conReparto(0, '2'),
            await conReparto(1, '3'),
          ],
        },
        actorDe(fixture),
      );
      const orderId = creado.id;
      const filas = await prisma.orderLine.findMany({ where: { orderId }, orderBy: { position: 'asc' }, select: { id: true } });
      const [cancelada, primera, segunda] = filas.map((fila) => fila.id) as [string, string, string];
      const ahora = new Date();
      expect(await transition(orderId, primera, fixture.companyId, 'PENDIENTE', 'EN_CURSO', fixture.actorId, ahora)).toBe('ok');
      expect(await transition(orderId, primera, fixture.companyId, 'EN_CURSO', 'POR_EMPACAR', fixture.actorId, ahora)).toBe('ok');
      await aEmpaque(fixture, orderId, segunda);
      await prisma.orderAssignment.create({ data: { orderId, userId: fixture.actorId, companyId: fixture.companyId } });

      // Con la linea PENDIENTE todavia activa, el pedido admite responsables...
      expect(await lasTres(fixture, orderId)).toEqual(['ok', 'ok', 'ok']);
      await prisma.orderAssignment.create({ data: { orderId, userId: fixture.actorId, companyId: fixture.companyId } });

      // ...y al cancelarla deja de admitirlos: sigue siendo PARCIAL, pero ya fabricado.
      await cancelOrderLine(orderId, cancelada, { reason: 'el cliente ya no la quiere' }, actorDe(fixture));
      expect((await lineaDe(cancelada)).status).toBe('CANCELADO');
      expect((await pedidoDe(orderId)).status).toBe('PARCIAL');
      const antes = await asignacionesDe(orderId);

      expect(await lasTres(fixture, orderId)).toEqual(['order_produced_frozen', 'order_produced_frozen', 'order_produced_frozen']);

      expect(await asignacionesDe(orderId)).toEqual(antes);
    });
  });

  it('QT-313 R55: una linea quitada (deleted_at) en PENDIENTE no cuenta: con las demas fabricadas, el PARCIAL rechaza sin escribir', async () => {
    await conFixture(async (fixture) => {
      // Fija el filtro `deletedAt: null` de la query de `findAliveOrderTargetById`: la linea
      // quitada sigue PENDIENTE en su columna, pero no es activa y no abre el pedido.
      const conReparto = async (index: number, cantidad: string) => ({
        recipeId: await crearReceta(fixture),
        quantity: cantidad,
        unitId: fixture.unitId,
        presentationLines: [{ packagingProductId: fixture.packagingProductIds[index] as string, packages: Number(cantidad) }],
      });
      const creado = await createOrder(
        {
          lines: [
            { recipeId: await crearReceta(fixture), quantity: '1', unitId: fixture.unitId, presentationLines: [] },
            await conReparto(0, '2'),
            await conReparto(1, '3'),
          ],
        },
        actorDe(fixture),
      );
      const orderId = creado.id;
      const filas = await prisma.orderLine.findMany({ where: { orderId }, orderBy: { position: 'asc' }, select: { id: true } });
      const [quitada, primera, segunda] = filas.map((fila) => fila.id) as [string, string, string];
      const ahora = new Date();
      expect(await transition(orderId, primera, fixture.companyId, 'PENDIENTE', 'EN_CURSO', fixture.actorId, ahora)).toBe('ok');
      expect(await transition(orderId, primera, fixture.companyId, 'EN_CURSO', 'POR_EMPACAR', fixture.actorId, ahora)).toBe('ok');
      await aEmpaque(fixture, orderId, segunda);
      expect((await pedidoDe(orderId)).status).toBe('PARCIAL');

      // La linea se quita directamente en la fila: sigue PENDIENTE, con `deleted_at` puesto.
      await prisma.orderLine.update({ where: { id: quitada }, data: { deletedAt: ahora } });
      expect((await lineaDe(quitada)).status).toBe('PENDIENTE');
      expect((await pedidoDe(orderId)).status).toBe('PARCIAL');
      await prisma.orderAssignment.create({ data: { orderId, userId: fixture.actorId, companyId: fixture.companyId } });
      const antes = await asignacionesDe(orderId);

      expect(await lasTres(fixture, orderId)).toEqual(['order_produced_frozen', 'order_produced_frozen', 'order_produced_frozen']);

      expect(await asignacionesDe(orderId)).toEqual(antes);
    });
  });
});
