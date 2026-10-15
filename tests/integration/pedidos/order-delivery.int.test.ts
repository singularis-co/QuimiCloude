/**
 * La entrega de producto terminado de punta a punta contra Postgres real, por la fachada de
 * `lib/composition`: `pedidos.deliverOrder` y `pedidos.getOrderDelivery` con su cableado real.
 *
 * AISLAMIENTO: `commit`. La entrega abre su propia `withOrderTransaction` sobre el cliente global,
 * asi que una transaccion del test no la envolveria. Cada caso fabrica sus empresas efimeras y las
 * borra en un `finally` (`tests/helpers/order-delivery-seed.ts`).
 */
import { randomUUID } from 'node:crypto';

import { afterAll, describe, expect, it } from 'vitest';

import { pedidos } from '@/lib/composition';
import { prisma } from '@/lib/shared/db/prisma';

import {
  borrarEmpresaDeEntrega,
  clientesDeEntrega,
  crearCliente,
  crearEmpresaDeEntrega,
  crearLote,
  crearPedido,
  crearPresentacion,
  crearTerminado,
  escritoPorEntregas,
  stockDeLote,
  stockDeProducto,
  type EmpresaDeEntrega,
} from '../../helpers/order-delivery-seed';

afterAll(async () => {
  await prisma.$disconnect();
});

type Escenario = {
  readonly a: EmpresaDeEntrega;
  readonly b: EmpresaDeEntrega;
  readonly customerId: string;
  readonly otherCustomerId: string;
  readonly orderId: string;
  /** Linea de 5 envases de 2 L y linea de 3 envases de 1 L. */
  readonly lineId: string;
  readonly smallLineId: string;
  readonly productId: string;
  readonly smallProductId: string;
  /** 4 envases de 2 L. */
  readonly batchId: string;
  /** 3 envases de 2 L. */
  readonly secondBatchId: string;
  /** 6 envases de 1 L. */
  readonly smallBatchId: string;
};

async function crearEscenario(): Promise<Escenario> {
  const a = await crearEmpresaDeEntrega('A');
  const b = await crearEmpresaDeEntrega('B');
  const customerId = await crearCliente(a, 'Garcia');
  const otherCustomerId = await crearCliente(a, 'Lopez');
  const presentationId = await crearPresentacion(a, '2.0000');
  const smallPresentationId = await crearPresentacion(a, '1.0000');
  const { orderId, lineIds } = await crearPedido(a, 'TERMINADO', customerId, [
    { presentationId, packages: 5 },
    { presentationId: smallPresentationId, packages: 3 },
  ]);
  const productId = await crearTerminado(a, presentationId);
  const smallProductId = await crearTerminado(a, smallPresentationId);
  const batchId = await crearLote(a, productId, presentationId, '8.0000', '2.0000', '2026-09-01');
  const secondBatchId = await crearLote(a, productId, presentationId, '6.0000', '2.0000', '2026-09-02');
  const smallBatchId = await crearLote(a, smallProductId, smallPresentationId, '6.0000', '1.0000');
  return {
    a,
    b,
    customerId,
    otherCustomerId,
    orderId,
    lineId: lineIds[0] as string,
    smallLineId: lineIds[1] as string,
    productId,
    smallProductId,
    batchId,
    secondBatchId,
    smallBatchId,
  };
}

async function borrarEscenario(e: Escenario): Promise<void> {
  await borrarEmpresaDeEntrega(e.a);
  await borrarEmpresaDeEntrega(e.b);
}

async function pedido(orderId: string) {
  return prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { status: true, customerId: true, finishedAt: true, packedBy: true, conditionedBy: true },
  });
}

async function codigoDe(promesa: Promise<unknown>): Promise<string> {
  try {
    await promesa;
  } catch (error) {
    return (error as { code?: string }).code ?? 'sin-codigo';
  }
  return 'no-fallo';
}

// 2026-10-15: las entregas de QC-223 van como un solo cliente en `customers`.
describe('deliverOrder contra Postgres', () => {
  it('R17: un pedido de la empresa B es order_not_found y un pedido no TERMINADO es action_not_allowed, sin escribir nada', async () => {
    const e = await crearEscenario();
    try {
      const customerB = await crearCliente(e.b, 'Ajeno');
      const presentationB = await crearPresentacion(e.b, '2.0000');
      const { orderId: orderB, lineIds: linesB } = await crearPedido(e.b, 'TERMINADO', customerB, [
        { presentationId: presentationB, packages: 2 },
      ]);
      const { orderId: enCurso, lineIds: linesEnCurso } = await crearPedido(e.a, 'EN_ACONDICIONAMIENTO', e.customerId, [
        { presentationId: (await prisma.orderPresentationLine.findUniqueOrThrow({ where: { id: e.lineId } })).presentationId, packages: 2 },
      ]);

      expect(
        await codigoDe(
          pedidos.deliverOrder(
            {
              orderId: orderB,
              deliveryKey: randomUUID(),
              customers: [{ customerId: e.customerId, allocations: [{ presentationLineId: linesB[0], batchId: e.batchId, packages: 1 }] }],
            },
            e.a.actor,
          ),
        ),
      ).toBe('order_not_found');
      expect(
        await codigoDe(
          pedidos.deliverOrder(
            {
              orderId: enCurso,
              deliveryKey: randomUUID(),
              customers: [{ customerId: e.customerId, allocations: [{ presentationLineId: linesEnCurso[0], batchId: e.batchId, packages: 1 }] }],
            },
            e.a.actor,
          ),
        ),
      ).toBe('action_not_allowed');

      expect(await escritoPorEntregas(e.a.companyId)).toEqual({ entregas: 0, lineas: 0, asientos: 0 });
      expect(await escritoPorEntregas(e.b.companyId)).toEqual({ entregas: 0, lineas: 0, asientos: 0 });
      expect(await stockDeLote(e.batchId)).toBe('8.0000');
      expect((await pedido(orderB)).status).toBe('TERMINADO');
      expect((await pedido(enCurso)).status).toBe('EN_ACONDICIONAMIENTO');
    } finally {
      await borrarEscenario(e);
    }
  });

  it('R21: un cliente de la empresa B o un cliente dado de baja es customer_not_found, sin escribir nada', async () => {
    const e = await crearEscenario();
    try {
      const customerB = await crearCliente(e.b, 'Ajeno');
      const baja = await crearCliente(e.a, 'DeBaja', new Date());

      for (const customerId of [customerB, baja]) {
        expect(
          await codigoDe(
            pedidos.deliverOrder(
              {
                orderId: e.orderId,
                deliveryKey: randomUUID(),
                customers: [{ customerId, allocations: [{ presentationLineId: e.lineId, batchId: e.batchId, packages: 1 }] }],
              },
              e.a.actor,
            ),
          ),
        ).toBe('customer_not_found');
      }

      expect(await escritoPorEntregas(e.a.companyId)).toEqual({ entregas: 0, lineas: 0, asientos: 0 });
      expect(await stockDeLote(e.batchId)).toBe('8.0000');
    } finally {
      await borrarEscenario(e);
    }
  });

  it('R25, R26: una entrega parcial guarda entrega, lineas y asientos, baja los lotes, deja el pedido TERMINADO y no toca orders.customer_id', async () => {
    const e = await crearEscenario();
    try {
      const deliveryKey = randomUUID();
      const resultado = await pedidos.deliverOrder(
        {
          orderId: e.orderId,
          deliveryKey,
          customers: [{ customerId: e.otherCustomerId, allocations: [
            { presentationLineId: e.lineId, batchId: e.batchId, packages: 2 },
            { presentationLineId: e.smallLineId, batchId: e.smallBatchId, packages: 1 },
          ] }],
        },
        e.a.actor,
      );

      expect(resultado).toEqual({ status: 'delivered', orderStatus: 'TERMINADO' });

      const entrega = await prisma.orderDelivery.findFirstOrThrow({ where: { companyId: e.a.companyId } });
      // 2026-10-15: el cliente ya no se guarda en la entrega sino en cada linea.
      expect(entrega).toMatchObject({
        orderId: e.orderId,
        deliveryKey,
        createdBy: e.a.actor.id,
      });
      expect(await clientesDeEntrega(entrega.id)).toEqual([e.otherCustomerId]);
      const lineas = await prisma.orderDeliveryLine.findMany({
        where: { deliveryId: entrega.id },
        orderBy: { packages: 'desc' },
      });
      expect(lineas.map((l) => [l.orderPresentationLineId, l.batchId, l.packages, l.quantity.toFixed(4)])).toEqual([
        [e.lineId, e.batchId, 2, '4.0000'],
        [e.smallLineId, e.smallBatchId, 1, '1.0000'],
      ]);
      const asientos = await prisma.inventoryMovement.findMany({
        where: { orderDeliveryId: entrega.id },
        orderBy: { quantity: 'asc' },
      });
      expect(asientos.map((m) => [m.kind, m.batchId, m.quantity.toFixed(4), m.orderId, m.reason])).toEqual([
        ['delivery', e.batchId, '-4.0000', e.orderId, null],
        ['delivery', e.smallBatchId, '-1.0000', e.orderId, null],
      ]);

      expect(await stockDeLote(e.batchId)).toBe('4.0000');
      expect(await stockDeLote(e.smallBatchId)).toBe('5.0000');
      expect(await stockDeProducto(e.productId)).toBe('10.0000');

      const fila = await pedido(e.orderId);
      expect(fila.status).toBe('TERMINADO');
      expect(fila.customerId).toBe(e.customerId);
    } finally {
      await borrarEscenario(e);
    }
  });

  it('R27: la entrega que completa todas las lineas deja ENTREGADO con finished_at, packed_by y conditioned_by intactos', async () => {
    const e = await crearEscenario();
    try {
      const antes = await pedido(e.orderId);
      const primera = await pedidos.deliverOrder(
        {
          orderId: e.orderId,
          deliveryKey: randomUUID(),
          customers: [{ customerId: e.customerId, allocations: [{ presentationLineId: e.lineId, batchId: e.batchId, packages: 2 }] }],
        },
        e.a.actor,
      );
      expect(primera).toEqual({ status: 'delivered', orderStatus: 'TERMINADO' });

      const segunda = await pedidos.deliverOrder(
        {
          orderId: e.orderId,
          deliveryKey: randomUUID(),
          customers: [{ customerId: e.customerId, allocations: [
            { presentationLineId: e.lineId, batchId: e.batchId, packages: 2 },
            { presentationLineId: e.lineId, batchId: e.secondBatchId, packages: 1 },
            { presentationLineId: e.smallLineId, batchId: e.smallBatchId, packages: 3 },
          ] }],
        },
        e.a.actor,
      );
      expect(segunda).toEqual({ status: 'delivered', orderStatus: 'ENTREGADO' });

      const despues = await pedido(e.orderId);
      expect(despues.status).toBe('ENTREGADO');
      expect(despues.finishedAt).toEqual(antes.finishedAt);
      expect(despues.packedBy).toBe(antes.packedBy);
      expect(despues.conditionedBy).toBe(antes.conditionedBy);
      expect(await stockDeLote(e.batchId)).toBe('0.0000');
      expect(await stockDeLote(e.secondBatchId)).toBe('4.0000');
      expect(await escritoPorEntregas(e.a.companyId)).toEqual({ entregas: 2, lineas: 4, asientos: 4 });
    } finally {
      await borrarEscenario(e);
    }
  });

  it('R29: la misma clave dos veces deja un solo juego de filas y un solo asiento por lote, y la segunda es already_registered', async () => {
    const e = await crearEscenario();
    try {
      const entrada = {
        orderId: e.orderId,
        deliveryKey: randomUUID(),
        customers: [{ customerId: e.customerId, allocations: [
          { presentationLineId: e.lineId, batchId: e.batchId, packages: 2 },
          { presentationLineId: e.lineId, batchId: e.secondBatchId, packages: 1 },
        ] }],
      };

      expect(await pedidos.deliverOrder(entrada, e.a.actor)).toEqual({ status: 'delivered', orderStatus: 'TERMINADO' });
      expect(await pedidos.deliverOrder(entrada, e.a.actor)).toEqual({
        status: 'already_registered',
        orderStatus: 'TERMINADO',
      });

      expect(await escritoPorEntregas(e.a.companyId)).toEqual({ entregas: 1, lineas: 2, asientos: 2 });
      expect(await stockDeLote(e.batchId)).toBe('4.0000');
      expect(await stockDeLote(e.secondBatchId)).toBe('4.0000');
    } finally {
      await borrarEscenario(e);
    }
  });

  it('R29: reintentar con la misma clave la entrega que dejo el pedido ENTREGADO es already_registered con ENTREGADO, sin escribir nada mas', async () => {
    const e = await crearEscenario();
    try {
      const entrada = {
        orderId: e.orderId,
        deliveryKey: randomUUID(),
        customers: [{ customerId: e.customerId, allocations: [
          { presentationLineId: e.lineId, batchId: e.batchId, packages: 4 },
          { presentationLineId: e.lineId, batchId: e.secondBatchId, packages: 1 },
          { presentationLineId: e.smallLineId, batchId: e.smallBatchId, packages: 3 },
        ] }],
      };

      expect(await pedidos.deliverOrder(entrada, e.a.actor)).toEqual({ status: 'delivered', orderStatus: 'ENTREGADO' });
      expect(await pedidos.deliverOrder(entrada, e.a.actor)).toEqual({
        status: 'already_registered',
        orderStatus: 'ENTREGADO',
      });

      expect((await pedido(e.orderId)).status).toBe('ENTREGADO');
      expect(await escritoPorEntregas(e.a.companyId)).toEqual({ entregas: 1, lineas: 3, asientos: 3 });
      expect(await stockDeLote(e.batchId)).toBe('0.0000');
      expect(await stockDeLote(e.secondBatchId)).toBe('4.0000');
      expect(await stockDeLote(e.smallBatchId)).toBe('3.0000');
    } finally {
      await borrarEscenario(e);
    }
  });

  // QC-223 2026-10-08: R29 enmendado por el humano; responde con el estado ACTUAL del pedido.
  it('R29: parcial registrada, otra entrega completa el pedido y reintentar la clave de la parcial es already_registered con ENTREGADO, sin escribir nada', async () => {
    const e = await crearEscenario();
    try {
      const parcial = {
        orderId: e.orderId,
        deliveryKey: randomUUID(),
        customers: [{ customerId: e.customerId, allocations: [{ presentationLineId: e.lineId, batchId: e.batchId, packages: 2 }] }],
      };
      const resto = {
        orderId: e.orderId,
        deliveryKey: randomUUID(),
        customers: [{ customerId: e.customerId, allocations: [
          { presentationLineId: e.lineId, batchId: e.batchId, packages: 2 },
          { presentationLineId: e.lineId, batchId: e.secondBatchId, packages: 1 },
          { presentationLineId: e.smallLineId, batchId: e.smallBatchId, packages: 3 },
        ] }],
      };

      expect(await pedidos.deliverOrder(parcial, e.a.actor)).toEqual({ status: 'delivered', orderStatus: 'TERMINADO' });
      expect(await pedidos.deliverOrder(resto, e.a.actor)).toEqual({ status: 'delivered', orderStatus: 'ENTREGADO' });
      const escritoAntes = await escritoPorEntregas(e.a.companyId);

      expect(await pedidos.deliverOrder(parcial, e.a.actor)).toEqual({
        status: 'already_registered',
        orderStatus: 'ENTREGADO',
      });

      expect(escritoAntes).toEqual({ entregas: 2, lineas: 4, asientos: 4 });
      expect(await escritoPorEntregas(e.a.companyId)).toEqual(escritoAntes);
      expect((await pedido(e.orderId)).status).toBe('ENTREGADO');
      expect(await stockDeLote(e.batchId)).toBe('0.0000');
      expect(await stockDeLote(e.secondBatchId)).toBe('4.0000');
      expect(await stockDeLote(e.smallBatchId)).toBe('3.0000');
    } finally {
      await borrarEscenario(e);
    }
  });

  it('R30: si el segundo lote no alcanza no queda nada escrito, ni siquiera la salida del primero', async () => {
    const e = await crearEscenario();
    try {
      const antes = await pedido(e.orderId);
      const codigo = await codigoDe(
        pedidos.deliverOrder(
          {
            orderId: e.orderId,
            deliveryKey: randomUUID(),
            customers: [{ customerId: e.customerId, allocations: [
              { presentationLineId: e.lineId, batchId: e.batchId, packages: 1 },
              { presentationLineId: e.lineId, batchId: e.secondBatchId, packages: 4 },
            ] }],
          },
          e.a.actor,
        ),
      );

      expect(codigo).toBe('delivery_batch_insufficient');
      expect(await escritoPorEntregas(e.a.companyId)).toEqual({ entregas: 0, lineas: 0, asientos: 0 });
      expect(await stockDeLote(e.batchId)).toBe('8.0000');
      expect(await stockDeLote(e.secondBatchId)).toBe('6.0000');
      expect(await stockDeProducto(e.productId)).toBe('14.0000');
      expect(await pedido(e.orderId)).toEqual(antes);
    } finally {
      await borrarEscenario(e);
    }
  });
});

describe('QC-282 deliverOrder con varios clientes contra Postgres', () => {
  type Asignacion = { presentationLineId: string; batchId: string; packages: number };
  const cliente = (customerId: string, allocations: Asignacion[]) => ({ customerId, allocations });
  const entrada = (e: Escenario, customers: ReturnType<typeof cliente>[], deliveryKey: string = randomUUID()) => ({
    orderId: e.orderId,
    deliveryKey,
    customers,
  });

  async function nadaEscrito(e: Escenario, antes: Awaited<ReturnType<typeof pedido>>): Promise<void> {
    expect(await escritoPorEntregas(e.a.companyId)).toEqual({ entregas: 0, lineas: 0, asientos: 0 });
    expect(await stockDeLote(e.batchId)).toBe('8.0000');
    expect(await stockDeLote(e.secondBatchId)).toBe('6.0000');
    expect(await stockDeLote(e.smallBatchId)).toBe('6.0000');
    expect(await stockDeProducto(e.productId)).toBe('14.0000');
    expect(await stockDeProducto(e.smallProductId)).toBe('6.0000');
    expect(await pedido(e.orderId)).toEqual(antes);
  }

  it('QC-282 R25, R26: guarda una sola entrega sin cliente propio, una linea por cliente y lote, un asiento por lote con la suma, y no toca orders.customer_id', async () => {
    const e = await crearEscenario();
    try {
      const deliveryKey = randomUUID();
      const resultado = await pedidos.deliverOrder(
        entrada(
          e,
          [
            cliente(e.customerId, [{ presentationLineId: e.lineId, batchId: e.batchId, packages: 2 }]),
            cliente(e.otherCustomerId, [
              { presentationLineId: e.lineId, batchId: e.batchId, packages: 1 },
              { presentationLineId: e.smallLineId, batchId: e.smallBatchId, packages: 1 },
            ]),
          ],
          deliveryKey,
        ),
        e.a.actor,
      );

      expect(resultado).toEqual({ status: 'delivered', orderStatus: 'TERMINADO' });
      expect(await escritoPorEntregas(e.a.companyId)).toEqual({ entregas: 1, lineas: 3, asientos: 2 });

      const entrega = await prisma.orderDelivery.findFirstOrThrow({ where: { companyId: e.a.companyId } });
      expect(entrega).toMatchObject({ orderId: e.orderId, deliveryKey, createdBy: e.a.actor.id });
      expect(await clientesDeEntrega(entrega.id)).toEqual([e.customerId, e.otherCustomerId].sort());

      const lineas = await prisma.orderDeliveryLine.findMany({ where: { deliveryId: entrega.id } });
      const porCliente = lineas
        .map((l) => [l.customerId === e.customerId ? 'A' : 'B', l.orderPresentationLineId, l.batchId, l.packages, l.quantity.toFixed(4)])
        .sort((x, y) => String(x[0]).localeCompare(String(y[0])) || Number(y[3]) - Number(x[3]));
      expect(porCliente).toEqual([
        ['A', e.lineId, e.batchId, 2, '4.0000'],
        ['B', e.lineId, e.batchId, 1, '2.0000'],
        ['B', e.smallLineId, e.smallBatchId, 1, '1.0000'],
      ]);

      const asientos = await prisma.inventoryMovement.findMany({
        where: { orderDeliveryId: entrega.id },
        orderBy: { quantity: 'asc' },
      });
      expect(asientos.map((m) => [m.kind, m.batchId, m.quantity.toFixed(4)])).toEqual([
        ['delivery', e.batchId, '-6.0000'],
        ['delivery', e.smallBatchId, '-1.0000'],
      ]);

      expect(await stockDeLote(e.batchId)).toBe('2.0000');
      expect(await stockDeLote(e.smallBatchId)).toBe('5.0000');
      const fila = await pedido(e.orderId);
      expect(fila.status).toBe('TERMINADO');
      expect(fila.customerId).toBe(e.customerId);
    } finally {
      await borrarEscenario(e);
    }
  });

  it('QC-282 R27: si la suma de los clientes completa todas las presentaciones el pedido pasa a ENTREGADO', async () => {
    const e = await crearEscenario();
    try {
      const resultado = await pedidos.deliverOrder(
        entrada(e, [
          cliente(e.customerId, [
            { presentationLineId: e.lineId, batchId: e.batchId, packages: 4 },
            { presentationLineId: e.smallLineId, batchId: e.smallBatchId, packages: 1 },
          ]),
          cliente(e.otherCustomerId, [
            { presentationLineId: e.lineId, batchId: e.secondBatchId, packages: 1 },
            { presentationLineId: e.smallLineId, batchId: e.smallBatchId, packages: 2 },
          ]),
        ]),
        e.a.actor,
      );

      expect(resultado).toEqual({ status: 'delivered', orderStatus: 'ENTREGADO' });
      expect((await pedido(e.orderId)).status).toBe('ENTREGADO');
      expect(await escritoPorEntregas(e.a.companyId)).toEqual({ entregas: 1, lineas: 4, asientos: 3 });
      expect(await stockDeLote(e.smallBatchId)).toBe('3.0000');
    } finally {
      await borrarEscenario(e);
    }
  });

  it('QC-282 R27: si a una presentacion le siguen faltando envases el pedido sigue TERMINADO', async () => {
    const e = await crearEscenario();
    try {
      const resultado = await pedidos.deliverOrder(
        entrada(e, [
          cliente(e.customerId, [{ presentationLineId: e.lineId, batchId: e.batchId, packages: 4 }]),
          cliente(e.otherCustomerId, [{ presentationLineId: e.lineId, batchId: e.secondBatchId, packages: 1 }]),
        ]),
        e.a.actor,
      );

      expect(resultado).toEqual({ status: 'delivered', orderStatus: 'TERMINADO' });
      expect((await pedido(e.orderId)).status).toBe('TERMINADO');
    } finally {
      await borrarEscenario(e);
    }
  });

  it('QC-282 R21: el mismo cliente dos veces, un cliente sin envases, una linea de otro pedido o la forma de QC-223 son invalid_input sin escribir nada', async () => {
    const e = await crearEscenario();
    try {
      const antes = await pedido(e.orderId);
      const presentationId = (await prisma.orderPresentationLine.findUniqueOrThrow({ where: { id: e.lineId } })).presentationId;
      const { lineIds: deOtroPedido } = await crearPedido(e.a, 'TERMINADO', e.customerId, [{ presentationId, packages: 2 }]);
      const una = { presentationLineId: e.lineId, batchId: e.batchId, packages: 1 };
      const invalidas: unknown[] = [
        entrada(e, [cliente(e.customerId, [una]), cliente(e.customerId, [{ ...una, batchId: e.secondBatchId }])]),
        entrada(e, [cliente(e.customerId, [una]), cliente(e.otherCustomerId, [])]),
        entrada(e, []),
        entrada(e, [cliente(e.customerId, [una]), cliente(e.otherCustomerId, [{ ...una, presentationLineId: deOtroPedido[0] as string }])]),
        { orderId: e.orderId, deliveryKey: randomUUID(), customerId: e.customerId, allocations: [una] },
      ];

      for (const invalida of invalidas) {
        expect(await codigoDe(pedidos.deliverOrder(invalida, e.a.actor))).toBe('invalid_input');
      }
      await nadaEscrito(e, antes);
    } finally {
      await borrarEscenario(e);
    }
  });

  it('QC-282 R22: un segundo cliente de la empresa B, dado de baja o sin forma de uuid es customer_not_found sin escribir nada', async () => {
    const e = await crearEscenario();
    try {
      const antes = await pedido(e.orderId);
      const customerB = await crearCliente(e.b, 'Ajeno');
      const baja = await crearCliente(e.a, 'DeBaja', new Date());
      const una = { presentationLineId: e.lineId, batchId: e.batchId, packages: 1 };

      for (const segundo of [customerB, baja, 'cliente-b']) {
        expect(
          await codigoDe(pedidos.deliverOrder(entrada(e, [cliente(e.customerId, [una]), cliente(segundo, [una])]), e.a.actor)),
        ).toBe('customer_not_found');
      }
      await nadaEscrito(e, antes);
    } finally {
      await borrarEscenario(e);
    }
  });

  it('QC-282 R23: dos clientes que por separado caben pero juntos superan lo que falta a una presentacion es delivery_exceeds_remaining sin escribir nada', async () => {
    const e = await crearEscenario();
    try {
      const antes = await pedido(e.orderId);
      // A la presentacion de 2 L le faltan 5: 3 + 3 los supera, y los lotes tienen de sobra.
      const codigo = await codigoDe(
        pedidos.deliverOrder(
          entrada(e, [
            cliente(e.customerId, [{ presentationLineId: e.lineId, batchId: e.batchId, packages: 3 }]),
            cliente(e.otherCustomerId, [{ presentationLineId: e.lineId, batchId: e.secondBatchId, packages: 3 }]),
          ]),
          e.a.actor,
        ),
      );

      expect(codigo).toBe('delivery_exceeds_remaining');
      await nadaEscrito(e, antes);
    } finally {
      await borrarEscenario(e);
    }
  });

  it('QC-282 R24: dos clientes que juntos superan los envases de un lote es delivery_batch_insufficient sin escribir nada de la entrega', async () => {
    const e = await crearEscenario();
    try {
      const antes = await pedido(e.orderId);
      // El lote tiene 4 envases: 3 + 2 los superan; la presentacion admite 5.
      const codigo = await codigoDe(
        pedidos.deliverOrder(
          entrada(e, [
            cliente(e.customerId, [
              { presentationLineId: e.smallLineId, batchId: e.smallBatchId, packages: 1 },
              { presentationLineId: e.lineId, batchId: e.batchId, packages: 3 },
            ]),
            cliente(e.otherCustomerId, [{ presentationLineId: e.lineId, batchId: e.batchId, packages: 2 }]),
          ]),
          e.a.actor,
        ),
      );

      expect(codigo).toBe('delivery_batch_insufficient');
      await nadaEscrito(e, antes);
      const negativos = await prisma.productBatch.count({ where: { companyId: e.a.companyId, stock: { lt: 0 } } });
      expect(negativos).toBe(0);
    } finally {
      await borrarEscenario(e);
    }
  });

  it('QC-282 R28: la misma clave dos veces con varios clientes deja una sola entrega y la segunda es already_registered', async () => {
    const e = await crearEscenario();
    try {
      const misma = entrada(e, [
        cliente(e.customerId, [{ presentationLineId: e.lineId, batchId: e.batchId, packages: 2 }]),
        cliente(e.otherCustomerId, [
          { presentationLineId: e.lineId, batchId: e.batchId, packages: 1 },
          { presentationLineId: e.smallLineId, batchId: e.smallBatchId, packages: 1 },
        ]),
      ]);

      expect(await pedidos.deliverOrder(misma, e.a.actor)).toEqual({ status: 'delivered', orderStatus: 'TERMINADO' });
      expect(await pedidos.deliverOrder(misma, e.a.actor)).toEqual({ status: 'already_registered', orderStatus: 'TERMINADO' });

      expect(await escritoPorEntregas(e.a.companyId)).toEqual({ entregas: 1, lineas: 3, asientos: 2 });
      expect(await stockDeLote(e.batchId)).toBe('2.0000');
      expect(await stockDeLote(e.smallBatchId)).toBe('5.0000');
    } finally {
      await borrarEscenario(e);
    }
  });

  it('QC-282 R29: si falla el lote del segundo cliente despues de despachar lo del primero, no queda nada escrito', async () => {
    const e = await crearEscenario();
    try {
      const antes = await pedido(e.orderId);
      // Se despacha primero la presentacion de 1 L (primer cliente); el segundo pide 4 envases a un
      // lote que tiene 3.
      const codigo = await codigoDe(
        pedidos.deliverOrder(
          entrada(e, [
            cliente(e.customerId, [{ presentationLineId: e.smallLineId, batchId: e.smallBatchId, packages: 2 }]),
            cliente(e.otherCustomerId, [{ presentationLineId: e.lineId, batchId: e.secondBatchId, packages: 4 }]),
          ]),
          e.a.actor,
        ),
      );

      expect(codigo).toBe('delivery_batch_insufficient');
      await nadaEscrito(e, antes);
    } finally {
      await borrarEscenario(e);
    }
  });
});

describe('getOrderDelivery contra Postgres', () => {
  it('R5, R6, R7, R9: devuelve pedidos, entregados y faltan por linea, los lotes entregables y el cliente vivo del pedido', async () => {
    const e = await crearEscenario();
    try {
      await pedidos.deliverOrder(
        {
          orderId: e.orderId,
          deliveryKey: randomUUID(),
          customers: [{ customerId: e.customerId, allocations: [{ presentationLineId: e.smallLineId, batchId: e.smallBatchId, packages: 3 }] }],
        },
        e.a.actor,
      );

      const vista = await pedidos.getOrderDelivery(e.orderId, e.a.actor);

      expect(vista.orderId).toBe(e.orderId);
      expect(vista.customer).toMatchObject({ id: e.customerId, isDeleted: false });
      const [grande, chica] = vista.lines;
      expect(grande).toMatchObject({
        presentationLineId: e.lineId,
        orderedPackages: 5,
        deliveredPackages: 0,
        remainingPackages: 5,
      });
      expect(grande?.batches.map((batch) => [batch.batchId, batch.availablePackages])).toEqual([
        [e.batchId, 4],
        [e.secondBatchId, 3],
      ]);
      expect(chica).toMatchObject({
        presentationLineId: e.smallLineId,
        orderedPackages: 3,
        deliveredPackages: 3,
        remainingPackages: 0,
        batches: [],
      });
    } finally {
      await borrarEscenario(e);
    }
  });

  it('R5: un pedido de otra empresa es order_not_found y un pedido ENTREGADO es action_not_allowed', async () => {
    const e = await crearEscenario();
    try {
      const presentationB = await crearPresentacion(e.b, '1.0000');
      const { orderId: orderB } = await crearPedido(e.b, 'TERMINADO', null, [{ presentationId: presentationB, packages: 1 }]);
      const { orderId: entregado } = await crearPedido(e.a, 'ENTREGADO', e.customerId, []);

      expect(await codigoDe(pedidos.getOrderDelivery(orderB, e.a.actor))).toBe('order_not_found');
      expect(await codigoDe(pedidos.getOrderDelivery(entregado, e.a.actor))).toBe('action_not_allowed');
    } finally {
      await borrarEscenario(e);
    }
  });
});
