/**
 * La anulacion de una entrega sin pedido de punta a punta contra Postgres real, por la fachada de
 * `lib/composition` (`pedidos.voidDirectDelivery`, `pedidos.getDirectDeliveryForVoid`, y
 * `pedidos.deliverDirect` para sembrar la entrega). El caso del fallo forzado ata
 * `createVoidDirectDelivery` a mano con los mismos adaptadores reales y una devolucion que falla.
 *
 * AISLAMIENTO: `commit`. La anulacion abre su propia `withOrderTransaction` sobre el cliente global.
 * Cada caso fabrica sus empresas efimeras y las borra en un `finally` (`tests/helpers/direct-delivery-seed.ts`).
 */
import { randomUUID } from 'node:crypto';

import { afterAll, describe, expect, it } from 'vitest';

import { pedidos } from '@/lib/composition';
import { createFinishedGoodsReturn } from '@/lib/modules/inventario/adapters/driven/persistence/finished-goods-return-prisma';
import { createVoidDirectDelivery } from '@/lib/modules/pedidos';
import { createOrderDeliveryVoidRepository } from '@/lib/modules/pedidos/adapters/driven/persistence/order-delivery-void-prisma';
import { withOrderTransaction } from '@/lib/modules/pedidos/adapters/driven/persistence/order-unit-of-work-prisma';
import { prisma } from '@/lib/shared/db/prisma';

import {
  NADA_ESCRITO,
  borrarEmpresaSinPedido,
  codigoDe,
  crearEscenarioSinPedido,
  escritoSinPedido,
  type EscenarioSinPedido,
} from '../../helpers/direct-delivery-seed';
import { stockDeLote, stockDeProducto } from '../../helpers/order-delivery-seed';

afterAll(async () => {
  await prisma.$disconnect();
});

type ConEntrega = EscenarioSinPedido & { readonly deliveryId: string };

/** Ana: 3 del lote viejo y 1 del nuevo; Bruno: 2 del viejo. Deja 14.0000 / 14.0000 y el producto en 28.0000. */
async function conEntrega(label: string, caso: (e: ConEntrega) => Promise<void>): Promise<void> {
  const base = await crearEscenarioSinPedido(label);
  try {
    const deliveryKey = randomUUID();
    await pedidos.deliverDirect(
      {
        productId: base.productId,
        deliveryKey,
        note: null,
        customers: [
          { customerId: base.ana, allocations: [{ batchId: base.olderBatchId, packages: 3 }, { batchId: base.newerBatchId, packages: 1 }] },
          { customerId: base.bruno, allocations: [{ batchId: base.olderBatchId, packages: 2 }] },
        ],
      },
      base.actor,
    );
    const { id: deliveryId } = await prisma.orderDelivery.findFirstOrThrow({ where: { companyId: base.empresa.companyId, deliveryKey }, select: { id: true } });
    await caso({ ...base, deliveryId });
  } finally {
    await borrarEmpresaSinPedido(base.empresa);
  }
}

function anulacion(e: ConEntrega, overrides: Record<string, unknown> = {}) {
  return { deliveryId: e.deliveryId, voidKey: randomUUID(), customerIds: [e.ana], reason: '  Devolucion del cliente  ', ...overrides };
}

async function existencias(e: EscenarioSinPedido) {
  return { viejo: await stockDeLote(e.olderBatchId), nuevo: await stockDeLote(e.newerBatchId), producto: await stockDeProducto(e.productId) };
}

const TRAS_ENTREGA = { viejo: '14.0000', nuevo: '14.0000', producto: '28.0000' };
const ENTREGADO = { entregas: 1, lineas: 3, asientos: 2 };

describe('R44: lo que lee el dialogo', () => {
  it('R44: fecha, presentacion y los clientes con su parte sin anular; tras anular a Ana solo queda Bruno', async () => {
    await conEntrega('dialogo', async (e) => {
      const vista = await pedidos.getDirectDeliveryForVoid(e.deliveryId, e.actor);
      const presentacion = await prisma.presentation.findUniqueOrThrow({ where: { id: e.presentationId }, select: { name: true } });
      expect(vista).toEqual({
        deliveryId: e.deliveryId,
        createdAt: expect.any(String),
        presentationName: presentacion.name,
        customers: [
          { customerId: e.bruno, customerName: 'Cliente Diaz', packages: 2 },
          { customerId: e.ana, customerName: 'Cliente Perez', packages: 4 },
        ],
      });

      await pedidos.voidDirectDelivery(anulacion(e), e.actor);
      expect((await pedidos.getDirectDeliveryForVoid(e.deliveryId, e.actor)).customers).toEqual([{ customerId: e.bruno, customerName: 'Cliente Diaz', packages: 2 }]);
    });
  });
});

describe('R47, R48: rechazos sin escribir nada', () => {
  it('R47: un cliente sin lineas en esa entrega, y una entrada mal formada, responden invalid_input', async () => {
    await conEntrega('forma', async (e) => {
      for (const valor of [
        anulacion(e, { customerIds: [e.ana, randomUUID()] }),
        anulacion(e, { customerIds: [] }),
        anulacion(e, { reason: '   ' }),
        anulacion(e, { customerIds: [e.ana, e.ana.toUpperCase()] }),
        { ...anulacion(e), extra: true },
      ]) {
        expect(await codigoDe(pedidos.voidDirectDelivery(valor, e.actor))).toBe('invalid_input');
      }
      expect(await escritoSinPedido(e.empresa.companyId)).toEqual({ ...NADA_ESCRITO, ...ENTREGADO });
      expect(await existencias(e)).toEqual(TRAS_ENTREGA);
    });
  });

  it('R48: una entrega inexistente, de otra empresa o de pedido responde delivery_not_found; la anulacion de pedido sobre una sin pedido tambien', async () => {
    await conEntrega('entrega', async (e) => {
      const b = await crearEscenarioSinPedido('entrega-B');
      try {
        const dePedidoKey = randomUUID();
        await pedidos.deliverOrder(
          { orderId: e.firstOrder.orderId, deliveryKey: dePedidoKey, customers: [{ customerId: e.ana, allocations: [{ presentationLineId: e.firstOrder.lineId, batchId: e.newerBatchId, packages: 1 }] }] },
          e.actor,
        );
        const { id: dePedido } = await prisma.orderDelivery.findFirstOrThrow({ where: { companyId: e.empresa.companyId, deliveryKey: dePedidoKey }, select: { id: true } });

        for (const deliveryId of [randomUUID(), dePedido]) {
          expect(await codigoDe(pedidos.voidDirectDelivery(anulacion(e, { deliveryId }), e.actor))).toBe('delivery_not_found');
          expect(await codigoDe(pedidos.getDirectDeliveryForVoid(deliveryId, e.actor))).toBe('delivery_not_found');
        }
        expect(await codigoDe(pedidos.voidDirectDelivery(anulacion(e, { customerIds: [b.ana] }), b.actor))).toBe('delivery_not_found');
        expect(await codigoDe(pedidos.getDirectDeliveryForVoid(e.deliveryId, b.actor))).toBe('delivery_not_found');
        expect(
          await codigoDe(
            pedidos.voidDelivery({ deliveryId: e.deliveryId, voidKey: randomUUID(), items: [{ customerId: e.ana, presentationLineId: e.firstOrder.lineId }], reason: 'x' }, e.actor),
          ),
        ).toBe('delivery_not_found');

        expect(await prisma.orderDeliveryVoid.count({ where: { companyId: { in: [e.empresa.companyId, b.empresa.companyId] } } })).toBe(0);
        expect(await prisma.inventoryMovement.count({ where: { companyId: e.empresa.companyId, kind: { in: ['direct_delivery_void', 'delivery_void'] } } })).toBe(0);
      } finally {
        await borrarEmpresaSinPedido(b.empresa);
      }
    });
  });
});

describe('R49: la parte ya anulada', () => {
  it('R49: anulada Ana, pedir Ana y Bruno responde delivery_already_voided y Bruno sigue sin anular', async () => {
    await conEntrega('ya-anulada', async (e) => {
      await pedidos.voidDirectDelivery(anulacion(e), e.actor);
      const tras = await escritoSinPedido(e.empresa.companyId);
      const stock = await existencias(e);

      expect(await codigoDe(pedidos.voidDirectDelivery(anulacion(e, { customerIds: [e.bruno, e.ana] }), e.actor))).toBe('delivery_already_voided');
      expect(await escritoSinPedido(e.empresa.companyId)).toEqual(tras);
      expect(await existencias(e)).toEqual(stock);
      const deBruno = await prisma.orderDeliveryLine.findMany({ where: { deliveryId: e.deliveryId, customerId: e.bruno }, select: { voidLine: { select: { id: true } } } });
      expect(deBruno.every((l) => l.voidLine === null)).toBe(true);
    });
  });
});

describe('R50: lo que escribe la anulacion', () => {
  it('R50: guarda la anulacion, anula solo las lineas de Ana, devuelve a cada lote su suma con un asiento por lote y recalcula el producto', async () => {
    await conEntrega('escritura', async (e) => {
      const entregaAntes = await prisma.orderDelivery.findUniqueOrThrow({ where: { id: e.deliveryId }, include: { lines: { orderBy: { id: 'asc' } } } });
      const asientosAntes = await prisma.inventoryMovement.findMany({ where: { orderDeliveryId: e.deliveryId }, orderBy: { id: 'asc' } });
      const input = anulacion(e);

      await expect(pedidos.voidDirectDelivery(input, e.actor)).resolves.toEqual({ status: 'voided' });

      const anul = await prisma.orderDeliveryVoid.findFirstOrThrow({ where: { companyId: e.empresa.companyId }, include: { lines: { include: { deliveryLine: true } } } });
      expect(anul).toMatchObject({ deliveryId: e.deliveryId, voidKey: input.voidKey, reason: 'Devolucion del cliente', createdBy: e.actor.id });
      expect(anul.lines.map((l) => l.deliveryLine.customerId)).toEqual([e.ana, e.ana]);

      // Ana tenia 3 envases (6.0000) del viejo y 1 (2.0000) del nuevo.
      expect(await existencias(e)).toEqual({ viejo: '20.0000', nuevo: '16.0000', producto: '36.0000' });
      const asientos = await prisma.inventoryMovement.findMany({ where: { companyId: e.empresa.companyId, kind: 'direct_delivery_void' } });
      expect(
        asientos
          .map((a) => ({ batchId: a.batchId, quantity: a.quantity.toFixed(4), orderId: a.orderId, reason: a.reason, voidId: a.orderDeliveryVoidId, createdBy: a.createdBy }))
          .sort((a, b) => a.quantity.localeCompare(b.quantity)),
      ).toEqual(
        [
          { batchId: e.newerBatchId, quantity: '2.0000' },
          { batchId: e.olderBatchId, quantity: '6.0000' },
        ].map((x) => ({ ...x, orderId: null, reason: null, voidId: anul.id, createdBy: e.actor.id })),
      );
      expect(asientos.every((a) => a.createdAt.getTime() === anul.createdAt.getTime())).toBe(true);

      expect(await prisma.orderDelivery.findUniqueOrThrow({ where: { id: e.deliveryId }, include: { lines: { orderBy: { id: 'asc' } } } })).toEqual(entregaAntes);
      expect(await prisma.inventoryMovement.findMany({ where: { orderDeliveryId: e.deliveryId }, orderBy: { id: 'asc' } })).toEqual(asientosAntes);
    });
  });

  it('R50: con el producto dado de baja la anulacion devuelve igual los envases a sus lotes', async () => {
    await conEntrega('de-baja', async (e) => {
      await prisma.product.update({ where: { id: e.productId }, data: { deletedAt: new Date() } });
      await expect(pedidos.voidDirectDelivery(anulacion(e, { customerIds: [e.ana, e.bruno] }), e.actor)).resolves.toEqual({ status: 'voided' });
      expect(await existencias(e)).toEqual({ viejo: '24.0000', nuevo: '16.0000', producto: '40.0000' });
      expect((await pedidos.getDirectDeliveryForVoid(e.deliveryId, e.actor)).presentationName).toBeNull();
    });
  });
});

describe('R51: clave y fallos', () => {
  it('R51: la misma clave dos veces responde already_registered y no escribe nada mas', async () => {
    await conEntrega('clave', async (e) => {
      const input = anulacion(e);
      await pedidos.voidDirectDelivery(input, e.actor);
      const tras = await escritoSinPedido(e.empresa.companyId);
      await expect(pedidos.voidDirectDelivery({ ...input, customerIds: [e.bruno] }, e.actor)).resolves.toEqual({ status: 'already_registered' });
      expect(await escritoSinPedido(e.empresa.companyId)).toEqual(tras);
    });
  });

  it('R51: la clave de la anulacion de una entrega de pedido responde invalid_input sin escribir', async () => {
    await conEntrega('clave-pedido', async (e) => {
      const dePedidoKey = randomUUID();
      await pedidos.deliverOrder(
        { orderId: e.firstOrder.orderId, deliveryKey: dePedidoKey, customers: [{ customerId: e.ana, allocations: [{ presentationLineId: e.firstOrder.lineId, batchId: e.newerBatchId, packages: 1 }] }] },
        e.actor,
      );
      const { id: dePedido } = await prisma.orderDelivery.findFirstOrThrow({ where: { companyId: e.empresa.companyId, deliveryKey: dePedidoKey }, select: { id: true } });
      const voidKey = randomUUID();
      await pedidos.voidDelivery({ deliveryId: dePedido, voidKey, items: [{ customerId: e.ana, presentationLineId: e.firstOrder.lineId }], reason: 'x' }, e.actor);

      expect(await codigoDe(pedidos.voidDirectDelivery(anulacion(e, { voidKey }), e.actor))).toBe('invalid_input');
      expect((await escritoSinPedido(e.empresa.companyId)).anulaciones).toBe(0);
    });
  });

  it('R51: si falla la devolucion a inventario no queda escrita ni la anulacion, ni sus lineas, ni asientos, ni cambio de existencia', async () => {
    await conEntrega('fallo', async (e) => {
      const anular = createVoidDirectDelivery({
        voids: createOrderDeliveryVoidRepository(),
        unitOfWork: {
          run: (work) =>
            withOrderTransaction(async (tx) => {
              const finishedGoods = createFinishedGoodsReturn(tx);
              return work({
                voids: createOrderDeliveryVoidRepository(tx),
                finishedGoods: {
                  returnForDeliveryVoid: async (input) => {
                    await finishedGoods.returnForDeliveryVoid(input);
                    throw new Error('fallo forzado tras la devolucion');
                  },
                },
              });
            }),
        },
      });

      await expect(anular(anulacion(e, { customerIds: [e.ana, e.bruno] }), e.actor)).rejects.toThrow('fallo forzado tras la devolucion');
      expect(await escritoSinPedido(e.empresa.companyId)).toEqual({ ...NADA_ESCRITO, ...ENTREGADO });
      expect(await existencias(e)).toEqual(TRAS_ENTREGA);
    });
  });
});

describe('Empresa B', () => {
  it('R48, R51: la empresa B no ve la entrega de A, y la misma clave de anulacion sirve en B', async () => {
    await conEntrega('empresa-A', async (a) => {
      await conEntrega('empresa-B', async (b) => {
        const input = anulacion(a);
        await pedidos.voidDirectDelivery(input, a.actor);
        expect(await codigoDe(pedidos.voidDirectDelivery({ ...input, voidKey: randomUUID() }, b.actor))).toBe('delivery_not_found');
        await expect(pedidos.voidDirectDelivery(anulacion(b, { voidKey: input.voidKey }), b.actor)).resolves.toEqual({ status: 'voided' });
        expect((await escritoSinPedido(a.empresa.companyId)).anulaciones).toBe(1);
        expect((await escritoSinPedido(b.empresa.companyId)).anulaciones).toBe(1);
        expect(await existencias(b)).toEqual({ viejo: '20.0000', nuevo: '16.0000', producto: '36.0000' });
      });
    });
  });
});
