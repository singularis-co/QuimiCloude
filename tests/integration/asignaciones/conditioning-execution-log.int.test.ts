/**
 * El acondicionamiento anota en el registro de ejecucion, contra Postgres real y con la composicion
 * real (`asignaciones` de `@/lib/composition`): Comenzar, guardar datos de lote y Terminar escriben
 * su anotacion en la misma transaccion que su cambio, o no escriben nada.
 *
 * Como se fuerza el fallo: el registro atado a la transaccion de ejecucion se envuelve para que,
 * con `falloDeAnotacion.activo`, escriba la fila con `step_position = 1`. La rechaza el CHECK
 * `order_execution_entries_conditioning_has_no_step` dentro de la misma transaccion, asi que el
 * error es de la base y no un doble. El registro global (el que lee el recorrido) no se toca.
 *
 * AISLAMIENTO: `commit`. `withExecutionTransaction` abre su propia transaccion sobre el cliente
 * global y lo que se mide es su ROLLBACK. Cada caso fabrica su empresa efimera con randomUUID y la
 * borra en su `finally`, en orden de FK.
 */
import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';
import { afterAll, describe, expect, it, vi } from 'vitest';

import type { NewExecutionEntry } from '@/lib/modules/asignaciones';

const falloDeAnotacion = vi.hoisted(() => ({ activo: false }));

vi.mock('@/lib/modules/asignaciones/adapters/driven/persistence/execution-log-prisma', async (importOriginal) => {
  const real =
    await importOriginal<typeof import('@/lib/modules/asignaciones/adapters/driven/persistence/execution-log-prisma')>();
  return {
    ...real,
    createExecutionLogRepository: (db?: Parameters<typeof real.createExecutionLogRepository>[0]) => {
      const repo = real.createExecutionLogRepository(db);
      if (db === undefined) return repo;
      return {
        ...repo,
        append: (entry: NewExecutionEntry) =>
          repo.append(falloDeAnotacion.activo ? ({ ...entry, stepPosition: 1 } as unknown as NewExecutionEntry) : entry),
      };
    },
  };
});

import { asignaciones } from '@/lib/composition';
import { normalizeCompanyName } from '@/lib/modules/identity';
import { prisma } from '@/lib/shared/db/prisma';

const CHECK_SIN_PASO = /order_execution_entries_conditioning_has_no_step/u;

type Actor = { readonly id: string; readonly companyId: string; readonly permissions: readonly string[] };

const PERMISOS_ACONDICIONADOR = ['asignaciones.consultar', 'acondicionamiento.modificar'] as const;

function token(): string {
  return randomUUID().replace(/-/gu, '');
}

let nextSequence = 970_000;
function freshSequence(): number {
  nextSequence += 1;
  return nextSequence;
}

type Fixture = {
  readonly companyId: string;
  readonly documentTypeCode: string;
  readonly roleIds: readonly string[];
  readonly recipeId: string;
  readonly unitId: string;
  readonly packerId: string;
  readonly acondicionador: string;
  readonly operario: string;
  readonly presentationIds: string[];
};

async function crearRol(permisos: readonly string[]): Promise<string> {
  const role = await prisma.role.create({
    data: { name: `rol-${token()}`, description: 'Rol de prueba' },
    select: { id: true },
  });
  for (const permissionCode of permisos) {
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionCode } });
  }
  return role.id;
}

async function crearPersona(companyId: string, roleId: string, documentTypeCode: string, nombre: string): Promise<string> {
  const marca = token();
  const user = await prisma.user.create({
    data: {
      firstNames: nombre,
      lastNames: 'Prueba',
      birthDate: new Date('1990-05-17T00:00:00.000Z'),
      email: `${marca}@quimicloude.test`,
      phone: '+57 300 111 2233',
      documentTypeCode,
      documentNumber: marca.slice(0, 12),
      username: `u.${marca}`,
      passwordHash: 'hash-de-prueba-no-es-un-algoritmo-real',
      roleId,
      companyId,
      accountStatus: 'active',
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
  const nombre = `Empresa registro acondicionamiento ${marca}`;
  const company = await prisma.company.create({
    data: { name: nombre, nameNormalized: normalizeCompanyName(nombre) },
    select: { id: true },
  });
  const rolAcondicionador = await crearRol(PERMISOS_ACONDICIONADOR);
  const rolOtro = await crearRol(['asignaciones.consultar', 'asignaciones.ejecutar']);
  const persona = (roleId: string, n: string) => crearPersona(company.id, roleId, documentType.code, n);
  const packerId = await persona(rolOtro, 'Empacador');
  const operario = await persona(rolOtro, 'Olga');
  const acondicionador = await persona(rolAcondicionador, 'Alba');

  const unit = await prisma.unit.create({
    data: { name: `unidad ${marca}`, nameNormalized: `unidad${marca}`, symbol: `u${marca}` },
    select: { id: true },
  });
  const recipe = await prisma.recipe.create({
    data: { name: `Receta ${marca}`, nameNormalized: `receta${marca}`, companyId: company.id },
    select: { id: true },
  });

  return {
    companyId: company.id,
    documentTypeCode: documentType.code,
    roleIds: [rolAcondicionador, rolOtro],
    recipeId: recipe.id,
    unitId: unit.id,
    packerId,
    acondicionador,
    operario,
    presentationIds: [],
  };
}

async function borrarFixture(fixture: Fixture): Promise<void> {
  const companyId = fixture.companyId;
  const products = await prisma.product.findMany({ where: { companyId }, select: { id: true } });
  const productIds = products.map((product) => product.id);
  await prisma.orderExecutionEntry.deleteMany({ where: { companyId } });
  await prisma.orderConditioningTeamMember.deleteMany({ where: { companyId } });
  await prisma.reservationMovement.deleteMany({ where: { companyId } });
  await prisma.inventoryMovement.deleteMany({ where: { batch: { productId: { in: productIds } } } });
  await prisma.productBatch.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.orderPresentationLine.deleteMany({ where: { companyId } });
  await prisma.order.deleteMany({ where: { companyId } });
  await prisma.recipe.deleteMany({ where: { companyId } });
  await prisma.presentation.deleteMany({ where: { id: { in: fixture.presentationIds } } });
  await prisma.unit.deleteMany({ where: { id: fixture.unitId } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.rolePermission.deleteMany({ where: { roleId: { in: [...fixture.roleIds] } } });
  await prisma.role.deleteMany({ where: { id: { in: [...fixture.roleIds] } } });
  await prisma.documentType.deleteMany({ where: { code: fixture.documentTypeCode } });
  await prisma.company.deleteMany({ where: { id: companyId } });
}

async function pedidoPorAcondicionar(fixture: Fixture): Promise<string> {
  const order = await prisma.order.create({
    data: {
      companyId: fixture.companyId,
      orderYear: new Date().getUTCFullYear(),
      orderSequence: freshSequence(),
      recipeId: fixture.recipeId,
      quantity: new Prisma.Decimal('10'),
      status: 'POR_ACONDICIONAR',
      packedBy: fixture.packerId,
    },
    select: { id: true },
  });
  return order.id;
}

function actor(fixture: Fixture): Actor {
  return { id: fixture.acondicionador, companyId: fixture.companyId, permissions: PERMISOS_ACONDICIONADOR };
}

async function leerPedido(id: string) {
  return prisma.order.findUniqueOrThrow({
    where: { id },
    select: { status: true, conditionedBy: true, finishedAt: true },
  });
}

async function leerEquipo(orderId: string) {
  return prisma.orderConditioningTeamMember.findMany({ where: { orderId }, select: { userId: true } });
}

async function leerAnotaciones(orderId: string) {
  return prisma.orderExecutionEntry.findMany({
    where: { orderId },
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    select: { userId: true, action: true, stepPosition: true, reason: true, batchLines: true, occurredAt: true },
  });
}

async function conFallo<T>(work: () => Promise<T>): Promise<T> {
  falloDeAnotacion.activo = true;
  try {
    return await work();
  } finally {
    falloDeAnotacion.activo = false;
  }
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Comenzar anota en el registro de ejecucion', () => {
  it('R1: la transicion, el equipo y la anotacion conditioning_start quedan juntos, a nombre de quien comienza', async () => {
    const fixture = await crearFixture();
    try {
      const pedido = await pedidoPorAcondicionar(fixture);

      await asignaciones.startConditioning(actor(fixture), {
        orderId: pedido,
        userIds: [fixture.operario],
        workGroupIds: [],
      });

      expect((await leerPedido(pedido)).status).toBe('EN_ACONDICIONAMIENTO');
      expect(await leerEquipo(pedido)).toEqual([{ userId: fixture.operario }]);
      const anotaciones = await leerAnotaciones(pedido);
      expect(anotaciones).toEqual([
        {
          userId: fixture.acondicionador,
          action: 'CONDITIONING_START',
          stepPosition: null,
          reason: null,
          batchLines: null,
          occurredAt: expect.any(Date),
        },
      ]);
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('R1: si append falla no quedan ni transicion ni equipo', async () => {
    const fixture = await crearFixture();
    try {
      const pedido = await pedidoPorAcondicionar(fixture);

      await conFallo(() =>
        expect(
          asignaciones.startConditioning(actor(fixture), { orderId: pedido, userIds: [fixture.operario], workGroupIds: [] }),
        ).rejects.toThrow(CHECK_SIN_PASO),
      );

      expect(await leerPedido(pedido)).toEqual({ status: 'POR_ACONDICIONAR', conditionedBy: null, finishedAt: null });
      expect(await leerEquipo(pedido)).toEqual([]);
      expect(await leerAnotaciones(pedido)).toEqual([]);
    } finally {
      await borrarFixture(fixture);
    }
  });

  it('R2: repetir Comenzar (already_mine) no anota otra vez', async () => {
    const fixture = await crearFixture();
    try {
      const pedido = await pedidoPorAcondicionar(fixture);
      const entrada = { orderId: pedido, userIds: [fixture.operario], workGroupIds: [] };

      await asignaciones.startConditioning(actor(fixture), entrada);
      await asignaciones.startConditioning(actor(fixture), entrada);

      expect((await leerAnotaciones(pedido)).map((a) => a.action)).toEqual(['CONDITIONING_START']);
    } finally {
      await borrarFixture(fixture);
    }
  });
});
