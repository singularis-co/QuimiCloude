/**
 * QT-313 T12: la entrega y su anulacion escriben la linea del pedido en sus asientos de inventario
 * y el estado en la linea, contra Postgres real y por la fachada de `lib/composition`.
 *
 * AISLAMIENTO: `commit`. La entrega y la anulacion abren su propia `withOrderTransaction` sobre el
 * cliente global, asi que una transaccion del test no las envolveria. Cada caso fabrica su empresa
 * efimera y la borra en un `finally` (`tests/helpers/order-delivery-seed.ts`), antes las filas de la
 * anulacion.
 */
import { randomUUID } from 'node:crypto';

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
  return { ...empresa.actor, permissions: ['entregas.modificar', 'entregas.anular', 'pedidos.consultar'] };
}

type Escenario = {
  readonly empresa: EmpresaDeEntrega;
  readonly customerId: string;
  readonly orderId: string;
  readonly orderLineId: string;
  readonly presentationLineId: string;
  readonly batchId: string;
};

/** Un pedido TERMINADO de 5 envases de 1 L, con su linea, y un lote de 10. */
async function crearEscenario(): Promise<Escenario> {
  const empresa = await crearEmpresaDeEntrega('L');
  const customerId = await crearCliente(empresa, 'Garcia');
  const presentationId = await crearPresentacion(empresa, '1.0000');
  const { orderId, lineIds, orderLineId } = await crearPedido(empresa, 'TERMINADO', customerId, [{ presentationId, packages: 5 }]);
  const productId = await crearTerminado(empresa, presentationId);
  const batchId = await crearLote(empresa, productId, presentationId, '10.0000', '1.0000');
  return { empresa, customerId, orderId, orderLineId, presentationLineId: lineIds[0] as string, batchId };
}

async function borrarEscenario(e: Escenario): Promise<void> {
  const companyId = e.empresa.companyId;
  await prisma.inventoryMovement.deleteMany({ where: { companyId } });
  await prisma.orderDeliveryVoidLine.deleteMany({ where: { companyId } });
  await prisma.orderDeliveryVoid.deleteMany({ where: { companyId } });
  await borrarEmpresaDeEntrega(e.empresa);
}

async function entregarTodo(e: Escenario): Promise<string> {
  const deliveryKey = randomUUID();
  await pedidos.deliverOrder(
    {
      orderId: e.orderId,
      deliveryKey,
      customers: [
        {
          customerId: e.customerId,
          allocations: [{ presentationLineId: e.presentationLineId, batchId: e.batchId, packages: 5 }],
        },
      ],
    },
    administrador(e.empresa),
  );
  const { id } = await prisma.orderDelivery.findFirstOrThrow({ where: { deliveryKey }, select: { id: true } });
  return id;
}

async function anularTodo(e: Escenario, deliveryId: string) {
  return pedidos.voidDelivery(
    {
      deliveryId,
      voidKey: randomUUID(),
      items: [{ customerId: e.customerId, presentationLineId: e.presentationLineId }],
      reason: 'Error de despacho',
    },
    administrador(e.empresa),
  );
}

async function asientos(companyId: string, kind: 'delivery' | 'delivery_void') {
  return prisma.inventoryMovement.findMany({
    where: { companyId, kind },
    select: { orderId: true, orderLineId: true, orderDeliveryId: true, orderDeliveryVoidId: true },
  });
}

describe('QT-313 T12 — entrega y anulacion por linea contra la base', () => {
  it('QT-313 R37, R39: el asiento delivery lleva la linea del reparto, la entrega completa deja la linea ENTREGADO, y el delivery_void lleva la misma linea y la devuelve a TERMINADO', async () => {
    const e = await crearEscenario();
    try {

      const deliveryId = await entregarTodo(e);

      const entregas = await asientos(e.empresa.companyId, 'delivery');
      expect(entregas).toEqual([{ orderId: e.orderId, orderLineId: e.orderLineId, orderDeliveryId: deliveryId, orderDeliveryVoidId: null }]);
      const linea = await prisma.orderLine.findUniqueOrThrow({ where: { id: e.orderLineId }, select: { status: true } });
      expect(linea.status).toBe('ENTREGADO');
      expect((await prisma.order.findUniqueOrThrow({ where: { id: e.orderId } })).status).toBe('ENTREGADO');

      expect(await anularTodo(e, deliveryId)).toEqual({ status: 'voided', orderStatus: 'TERMINADO' });

      const anulaciones = await asientos(e.empresa.companyId, 'delivery_void');
      expect(anulaciones.map((a) => [a.orderId, a.orderLineId])).toEqual([[e.orderId, entregas[0]?.orderLineId]]);
      const lineaDespues = await prisma.orderLine.findUniqueOrThrow({ where: { id: e.orderLineId }, select: { status: true } });
      expect(lineaDespues.status).toBe('TERMINADO');
      expect((await prisma.order.findUniqueOrThrow({ where: { id: e.orderId } })).status).toBe('TERMINADO');
    } finally {
      await borrarEscenario(e);
    }
  });
});
