/**
 * `OrderCatalog.findAliveLineSummary` y `listRecipeOutlinesByIdsIncludingDeleted` contra Postgres
 * real: un pedido de varias recetas (una cancelada y una quitada) y un pedido dado de baja por la
 * escritura real de la baja.
 *
 * AISLAMIENTO: `commit`. Los adaptadores leen con el cliente Prisma GLOBAL; cada caso siembra sus
 * dos empresas efimeras y las borra en su `finally`.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, describe, expect, it } from 'vitest';

import { normalizeCompanyName } from '@/lib/modules/identity';
import { softDeleteAliveOrder } from '@/lib/modules/pedidos/adapters/driven/persistence/order-prisma';
import { prisma } from '@/lib/shared/db/prisma';

import { realOrderSummaries } from '../../helpers/order-summaries';

import type { OrderLineStatus } from '@/lib/modules/pedidos';

const { findAliveLineSummary, listRecipeOutlinesByIdsIncludingDeleted } = realOrderSummaries();

function token(): string {
  return randomUUID().replace(/-/gu, '');
}

type Empresa = {
  readonly companyId: string;
  readonly userId: string;
  readonly roleId: string;
  readonly documentTypeCode: string;
  readonly unitId: string;
  readonly presentationId: string;
  readonly recipeIds: readonly string[];
};

async function sembrarEmpresa(): Promise<Empresa> {
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
  const recipeIds: string[] = [];
  for (const letra of ['a', 'b', 'c', 'd']) {
    const recipe = await prisma.recipe.create({
      data: { name: `Receta ${letra} ${marca}`, nameNormalized: `receta${letra}${marca}`, companyId: company.id },
      select: { id: true },
    });
    recipeIds.push(recipe.id);
  }
  return {
    companyId: company.id,
    userId: user.id,
    roleId: role.id,
    documentTypeCode: documentType.code,
    unitId: unit.id,
    presentationId: presentation.id,
    recipeIds,
  };
}

async function borrarEmpresa(e: Empresa): Promise<void> {
  const where = { companyId: e.companyId };
  await prisma.orderPresentationLine.deleteMany({ where });
  await prisma.orderLine.deleteMany({ where });
  await prisma.order.deleteMany({ where });
  await prisma.recipe.deleteMany({ where });
  await prisma.presentation.deleteMany({ where: { id: e.presentationId } });
  await prisma.unit.deleteMany({ where: { id: e.unitId } });
  await prisma.user.deleteMany({ where: { id: e.userId } });
  await prisma.role.deleteMany({ where: { id: e.roleId } });
  await prisma.documentType.deleteMany({ where: { code: e.documentTypeCode } });
  await prisma.company.deleteMany({ where: { id: e.companyId } });
}

let secuencia = 1;

type Linea = { readonly status: OrderLineStatus; readonly quitada?: Date; readonly packages?: number };

/** Un pedido con una linea por elemento, en ese orden de alta. Devuelve sus ids. */
async function sembrarPedido(e: Empresa, lineas: readonly Linea[]): Promise<{ orderId: string; lineIds: string[] }> {
  const order = await prisma.order.create({
    data: {
      orderYear: 2026,
      orderSequence: secuencia++,
      companyId: e.companyId,
      status: 'PENDIENTE',
      createdAt: new Date('2026-06-01T12:00:00.000Z'),
    },
    select: { id: true },
  });
  const lineIds: string[] = [];
  for (const [position, linea] of lineas.entries()) {
    const recipeId = e.recipeIds[position] ?? '';
    const created = await prisma.orderLine.create({
      data: {
        orderId: order.id,
        companyId: e.companyId,
        position,
        recipeId,
        originalRecipeId: recipeId,
        quantity: `${String(position + 1)}0.5`,
        unitId: e.unitId,
        status: linea.status,
        cancellationReason: linea.status === 'CANCELADO' ? 'ya no' : null,
        packedBy: linea.status === 'TERMINADO' ? e.userId : null,
        conditionedBy: linea.status === 'TERMINADO' ? e.userId : null,
        finishedAt: linea.status === 'TERMINADO' ? new Date('2026-06-02T12:00:00.000Z') : null,
        deletedAt: linea.quitada ?? null,
      },
      select: { id: true },
    });
    if (linea.packages !== undefined) {
      await prisma.orderPresentationLine.create({
        data: {
          orderId: order.id,
          orderLineId: created.id,
          companyId: e.companyId,
          presentationId: e.presentationId,
          packages: linea.packages,
        },
      });
    }
    lineIds.push(created.id);
  }
  return { orderId: order.id, lineIds };
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('findAliveLineSummary — la fila de una receta concreta', () => {
  it('R14: devuelve esa linea viva en cualquier estado, canceladas incluidas; quitada, de otro pedido o de otra empresa da null', async () => {
    const A = await sembrarEmpresa();
    const B = await sembrarEmpresa();
    try {
      const { orderId, lineIds } = await sembrarPedido(A, [
        { status: 'EN_CURSO', packages: 4 },
        { status: 'CANCELADO' },
        { status: 'PENDIENTE', quitada: new Date('2026-11-01T10:00:00.000Z') },
      ]);
      const [enCurso, cancelada, quitada] = lineIds as [string, string, string];
      const otro = await sembrarPedido(A, [{ status: 'PENDIENTE' }]);

      const fila = await findAliveLineSummary(A.companyId, orderId, enCurso);
      expect(fila).toMatchObject({
        id: orderId,
        lineId: enCurso,
        recipeId: A.recipeIds[0],
        status: 'EN_CURSO',
        quantity: '10.5000',
        unitId: A.unitId,
        number: { year: 2026 },
      });
      expect(fila?.presentationLines.map((linea) => [linea.presentationId, linea.packages])).toEqual([[A.presentationId, 4]]);
      expect((await findAliveLineSummary(A.companyId, orderId, cancelada))?.status).toBe('CANCELADO');

      expect(await findAliveLineSummary(A.companyId, orderId, quitada), 'quitada').toBeNull();
      expect(await findAliveLineSummary(A.companyId, otro.orderId, enCurso), 'de otro pedido').toBeNull();
      expect(await findAliveLineSummary(B.companyId, orderId, enCurso), 'de otra empresa').toBeNull();
      expect(await findAliveLineSummary(A.companyId, orderId, randomUUID()), 'inexistente').toBeNull();

      const deBaja = await sembrarPedido(A, [{ status: 'PENDIENTE' }]);
      const [deUnPedidoDeBaja] = deBaja.lineIds as [string];
      expect(await softDeleteAliveOrder(deBaja.orderId, A.userId, new Date(), { companyId: A.companyId })).toBe('ok');
      expect(await findAliveLineSummary(A.companyId, deBaja.orderId, deUnPedidoDeBaja), 'pedido dado de baja').toBeNull();
    } finally {
      await borrarEmpresa(A);
      await borrarEmpresa(B);
    }
  });
});

describe('listRecipeOutlinesByIdsIncludingDeleted — las recetas de cada pedido', () => {
  it('R3, R21, R22: un pedido de varias recetas trae las vivas en orden de alta, la cancelada incluida y la quitada fuera', async () => {
    const A = await sembrarEmpresa();
    try {
      const { orderId, lineIds } = await sembrarPedido(A, [
        { status: 'TERMINADO', packages: 3 },
        { status: 'PENDIENTE', quitada: new Date('2026-11-01T10:00:00.000Z'), packages: 9 },
        { status: 'CANCELADO' },
        { status: 'EN_CURSO', packages: 2 },
      ]);
      const [terminada, , cancelada, enCurso] = lineIds as [string, string, string, string];

      const [outline] = await listRecipeOutlinesByIdsIncludingDeleted(A.companyId, [orderId]);

      expect(outline).toEqual({
        id: orderId,
        deleted: false,
        recipes: [
          {
            lineId: terminada,
            position: 1,
            recipeId: A.recipeIds[0],
            status: 'TERMINADO',
            quantity: '10.5000',
            unitId: A.unitId,
            presentationLines: [{ presentationId: A.presentationId, packages: 3 }],
          },
          {
            lineId: cancelada,
            position: 2,
            recipeId: A.recipeIds[2],
            status: 'CANCELADO',
            quantity: '30.5000',
            unitId: A.unitId,
            presentationLines: [],
          },
          {
            lineId: enCurso,
            position: 3,
            recipeId: A.recipeIds[3],
            status: 'EN_CURSO',
            quantity: '40.5000',
            unitId: A.unitId,
            presentationLines: [{ presentationId: A.presentationId, packages: 2 }],
          },
        ],
        progress: { total: 2, finished: 1 },
      });
    } finally {
      await borrarEmpresa(A);
    }
  });

  it('R24: un pedido dado de baja trae las recetas que tenia vivas al darse de baja, no las quitadas antes', async () => {
    const A = await sembrarEmpresa();
    try {
      const { orderId, lineIds } = await sembrarPedido(A, [
        { status: 'PENDIENTE', quitada: new Date('2026-11-01T10:00:00.000Z') },
        { status: 'PENDIENTE' },
        { status: 'BLOQUEADO' },
      ]);
      const [, viva, bloqueada] = lineIds as [string, string, string];
      expect(await softDeleteAliveOrder(orderId, A.userId, new Date(), { companyId: A.companyId })).toBe('ok');

      const [outline] = await listRecipeOutlinesByIdsIncludingDeleted(A.companyId, [orderId]);

      expect(outline?.deleted).toBe(true);
      expect(outline?.recipes.map((receta) => [receta.lineId, receta.position, receta.status])).toEqual([
        [viva, 1, 'PENDIENTE'],
        [bloqueada, 2, 'BLOQUEADO'],
      ]);
      expect(outline?.progress).toEqual({ total: 2, finished: 0 });
    } finally {
      await borrarEmpresa(A);
    }
  });

  it('R24: varios pedidos en una consulta; un id de otra empresa o inexistente no vuelve', async () => {
    const A = await sembrarEmpresa();
    const B = await sembrarEmpresa();
    try {
      const uno = await sembrarPedido(A, [{ status: 'PENDIENTE' }]);
      const dos = await sembrarPedido(A, [{ status: 'POR_EMPACAR' }, { status: 'PENDIENTE' }]);
      const ajeno = await sembrarPedido(B, [{ status: 'PENDIENTE' }]);

      const outlines = await listRecipeOutlinesByIdsIncludingDeleted(A.companyId, [
        uno.orderId,
        dos.orderId,
        ajeno.orderId,
        randomUUID(),
      ]);

      expect(outlines.map((outline) => [outline.id, outline.recipes.length]).sort()).toEqual(
        [
          [uno.orderId, 1],
          [dos.orderId, 2],
        ].sort(),
      );
      expect(await listRecipeOutlinesByIdsIncludingDeleted(B.companyId, [uno.orderId])).toEqual([]);
      expect(await listRecipeOutlinesByIdsIncludingDeleted(A.companyId, [])).toEqual([]);
    } finally {
      await borrarEmpresa(A);
      await borrarEmpresa(B);
    }
  });
});
