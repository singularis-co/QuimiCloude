/**
 * QT-314 T4: lo que queda por entregar y las entregas de un pedido de dos recetas, leidos por receta,
 * contra Postgres real y por la fachada de `lib/composition`.
 *
 * AISLAMIENTO: `commit`. La entrega abre su propia `withOrderTransaction` sobre el cliente global,
 * asi que una transaccion del test no la envolveria. Cada caso fabrica su empresa efimera y la borra
 * en un `finally` (`tests/helpers/order-delivery-seed.ts`).
 */
import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import { pedidos } from '@/lib/composition';
import { prisma } from '@/lib/shared/db/prisma';

import {
  borrarEmpresaDeEntrega,
  crearCliente,
  crearEmpresaDeEntrega,
  crearLote,
  crearPedido,
  crearPresentacion,
  crearTerminado,
  type EmpresaDeEntrega,
} from '../../helpers/order-delivery-seed';

import type { Actor } from '@/lib/modules/pedidos';

afterAll(async () => {
  await prisma.$disconnect();
});

function administrador(empresa: EmpresaDeEntrega): Actor {
  return { ...empresa.actor, permissions: ['entregas.modificar', 'pedidos.consultar'] };
}

type Escenario = {
  readonly empresa: EmpresaDeEntrega;
  readonly customerId: string;
  readonly orderId: string;
  /** Receta A: 5 envases de su presentacion. */
  readonly lineA: string;
  readonly presentationLineA: string;
  readonly batchA: string;
  /** Receta B, otra receta: 3 envases de otra presentacion. */
  readonly lineB: string;
  readonly presentationLineB: string;
  readonly batchB: string;
};

/** Un pedido `TERMINADO` de dos recetas `TERMINADO`, cada una con su reparto y un lote de su receta. */
async function crearEscenario(): Promise<Escenario> {
  const empresa = await crearEmpresaDeEntrega('R');
  const customerId = await crearCliente(empresa, 'Garcia');
  const presentacionA = await crearPresentacion(empresa, '1.0000');
  const presentacionB = await crearPresentacion(empresa, '1.0000');
  const { orderId, lineIds, orderLineId: lineA } = await crearPedido(empresa, 'TERMINADO', customerId, [
    { presentationId: presentacionA, packages: 5 },
  ]);

  const otraReceta = await prisma.recipe.create({
    data: { name: `Receta B ${randomUUID()}`, nameNormalized: `recetab${randomUUID().replace(/-/gu, '')}`, companyId: empresa.companyId },
    select: { id: true },
  });
  const { id: lineB } = await prisma.orderLine.create({
    data: {
      orderId,
      companyId: empresa.companyId,
      position: 1,
      recipeId: otraReceta.id,
      originalRecipeId: otraReceta.id,
      quantity: new Prisma.Decimal('3'),
      status: 'TERMINADO',
      packedBy: empresa.packerId,
      conditionedBy: empresa.conditionerId,
      finishedAt: new Date('2026-10-01T10:00:00Z'),
    },
    select: { id: true },
  });
  const { id: presentationLineB } = await prisma.orderPresentationLine.create({
    data: {
      orderId,
      orderLineId: lineB,
      companyId: empresa.companyId,
      presentationId: presentacionB,
      packages: 3,
      presentationContent: null,
      createdAt: new Date(Date.now() + 10_000),
    },
    select: { id: true },
  });

  const productoA = await crearTerminado(empresa, presentacionA);
  const batchA = await crearLote(empresa, productoA, presentacionA, '10.0000', '1.0000');
  const nombreB = `Terminado B ${randomUUID()}`;
  const productoB = await prisma.product.create({
    data: {
      name: nombreB,
      nameNormalized: nombreB.toLowerCase().replace(/[^a-z0-9]/gu, ''),
      type: 'FINISHED_PRODUCT',
      unitId: empresa.unitId,
      recipeId: otraReceta.id,
      presentationId: presentacionB,
      companyId: empresa.companyId,
    },
    select: { id: true },
  });
  const batchB = await crearLote(empresa, productoB.id, presentacionB, '10.0000', '1.0000');

  return {
    empresa,
    customerId,
    orderId,
    lineA,
    presentationLineA: lineIds[0] as string,
    batchA,
    lineB,
    presentationLineB,
    batchB,
  };
}

async function borrarEscenario(e: Escenario): Promise<void> {
  await borrarEmpresaDeEntrega(e.empresa);
}

async function entregar(
  e: Escenario,
  allocations: readonly { presentationLineId: string; batchId: string; packages: number }[],
): Promise<string> {
  const deliveryKey = randomUUID();
  await pedidos.deliverOrder(
    { orderId: e.orderId, deliveryKey, customers: [{ customerId: e.customerId, allocations }] },
    administrador(e.empresa),
  );
  const { id } = await prisma.orderDelivery.findFirstOrThrow({ where: { deliveryKey }, select: { id: true } });
  return id;
}

async function codigoDelFallo(operacion: () => Promise<unknown>): Promise<string> {
  const error = await operacion().then(
    () => null,
    (err: unknown) => err,
  );
  expect(error, 'la operacion tenia que fallar').not.toBeNull();
  return (error as { code: string }).code;
}

describe('QT-314 T4 — entregas por receta contra la base', () => {
  it('QT-314 R33, R35: con el pedido PARCIAL, cada receta lee solo su reparto y solo lo entregado de ella', async () => {
    const e = await crearEscenario();
    try {
      const actor = administrador(e.empresa);
      const mezclada = await entregar(e, [
        { presentationLineId: e.presentationLineA, batchId: e.batchA, packages: 2 },
        { presentationLineId: e.presentationLineB, batchId: e.batchB, packages: 1 },
      ]);
      const soloB = await entregar(e, [{ presentationLineId: e.presentationLineB, batchId: e.batchB, packages: 2 }]);

      expect((await prisma.orderLine.findUniqueOrThrow({ where: { id: e.lineB }, select: { status: true } })).status).toBe('ENTREGADO');
      expect((await prisma.order.findUniqueOrThrow({ where: { id: e.orderId }, select: { status: true } })).status).toBe('PARCIAL');

      const repartoA = await pedidos.getOrderDelivery(e.orderId, e.lineA, actor);
      expect(repartoA.lines.map((l) => [l.presentationLineId, l.orderedPackages, l.deliveredPackages, l.remainingPackages])).toEqual([
        [e.presentationLineA, 5, 2, 3],
      ]);
      expect(repartoA.lines[0]?.batches.map((b) => b.batchId)).toEqual([e.batchA]);
      expect(repartoA.customer?.id).toBe(e.customerId);

      expect(await codigoDelFallo(() => pedidos.getOrderDelivery(e.orderId, e.lineB, actor))).toBe('action_not_allowed');
      expect(await codigoDelFallo(() => pedidos.getOrderDelivery(e.orderId, actor))).toBe('action_not_allowed');

      const entregasA = await pedidos.listOrderDeliveries(e.orderId, e.lineA, actor);
      expect(entregasA).toMatchObject({ orderStatus: 'PARCIAL', lineStatus: 'TERMINADO' });
      expect(
        entregasA.deliveries.map((d) => [d.id, d.packages, d.customers.flatMap((c) => c.presentations.map((p) => p.presentationLineId))]),
      ).toEqual([[mezclada, 2, [e.presentationLineA]]]);

      const entregasB = await pedidos.listOrderDeliveries(e.orderId, e.lineB, actor);
      expect(entregasB).toMatchObject({ orderStatus: 'PARCIAL', lineStatus: 'ENTREGADO' });
      expect(
        entregasB.deliveries.map((d) => [d.id, d.packages, d.customers.flatMap((c) => c.presentations.map((p) => p.presentationLineId))]),
      ).toEqual([
        [soloB, 2, [e.presentationLineB]],
        [mezclada, 1, [e.presentationLineB]],
      ]);

      const todas = await pedidos.listOrderDeliveries(e.orderId, actor);
      expect(todas.lineStatus).toBeNull();
      expect(todas.deliveries.map((d) => [d.id, d.packages])).toEqual([
        [soloB, 2],
        [mezclada, 3],
      ]);
    } finally {
      await borrarEscenario(e);
    }
  });

  it('QT-314 R33, R35: una receta de otro pedido, quitada o leida desde otra empresa es order_not_found', async () => {
    const e = await crearEscenario();
    const otra = await crearEmpresaDeEntrega('X');
    try {
      const actor = administrador(e.empresa);
      const { orderLineId: deOtroPedido } = await crearPedido(e.empresa, 'TERMINADO', null, []);
      const { id: quitada } = await prisma.orderLine.create({
        data: {
          orderId: e.orderId,
          companyId: e.empresa.companyId,
          position: 2,
          recipeId: e.empresa.recipeId,
          originalRecipeId: e.empresa.recipeId,
          quantity: new Prisma.Decimal('1'),
          status: 'PENDIENTE',
          deletedAt: new Date(),
        },
        select: { id: true },
      });
      const deOtraEmpresa = administrador(otra);

      for (const lineId of [deOtroPedido, quitada]) {
        expect(await codigoDelFallo(() => pedidos.getOrderDelivery(e.orderId, lineId, actor))).toBe('order_not_found');
        expect(await codigoDelFallo(() => pedidos.listOrderDeliveries(e.orderId, lineId, actor))).toBe('order_not_found');
      }
      expect(await codigoDelFallo(() => pedidos.getOrderDelivery(e.orderId, e.lineA, deOtraEmpresa))).toBe('order_not_found');
      expect(await codigoDelFallo(() => pedidos.listOrderDeliveries(e.orderId, e.lineA, deOtraEmpresa))).toBe('order_not_found');

      expect((await pedidos.getOrderDelivery(e.orderId, e.lineA, actor)).lines.map((l) => l.presentationLineId)).toEqual([
        e.presentationLineA,
      ]);
    } finally {
      await borrarEmpresaDeEntrega(otra);
      await borrarEscenario(e);
    }
  });
});
