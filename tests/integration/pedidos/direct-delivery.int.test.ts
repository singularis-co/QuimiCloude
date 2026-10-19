/**
 * La entrega sin pedido de punta a punta contra Postgres real, por la fachada de `lib/composition`
 * (`pedidos.deliverDirect`, `pedidos.getDirectDelivery`, `pedidos.listDirectDeliverySurplus`). El caso
 * del fallo forzado ata `createDeliverDirect` a mano con los mismos adaptadores reales y una pieza que
 * falla despues de la salida de inventario.
 *
 * AISLAMIENTO: `commit`. La entrega abre su propia `withOrderTransaction` sobre el cliente global, asi
 * que una transaccion del test no la envolveria. Cada caso fabrica sus empresas efimeras y las borra
 * en un `finally` (`tests/helpers/direct-delivery-seed.ts`).
 */
import { randomUUID } from 'node:crypto';

import { afterAll, describe, expect, it } from 'vitest';

import { pedidos } from '@/lib/composition';
import { findAliveCustomerRefById } from '@/lib/modules/clientes/adapters/driven/persistence/customer-catalog-prisma';
import { findSurplusBases } from '@/lib/modules/inventario/adapters/driven/persistence/deliverable-batches-prisma';
import { createFinishedGoodsDirectDispatch } from '@/lib/modules/inventario/adapters/driven/persistence/finished-goods-dispatch-prisma';
import { createDeliverDirect } from '@/lib/modules/pedidos';
import {
  createDirectDeliveryRepository,
  createWaitingOrdersLock,
  createWaitingOrdersReader,
} from '@/lib/modules/pedidos/adapters/driven/persistence/direct-delivery-prisma';
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
import { crearCliente, crearLote, crearPresentacion, crearTerminado, stockDeLote, stockDeProducto } from '../../helpers/order-delivery-seed';

afterAll(async () => {
  await prisma.$disconnect();
});

/** Ana: 4 del lote viejo; Bruno: 1 del viejo y 1 del nuevo. */
function entrada(e: EscenarioSinPedido, overrides: Record<string, unknown> = {}) {
  return {
    productId: e.productId,
    deliveryKey: randomUUID(),
    note: '  Venta mostrador, factura 0012  ',
    customers: [
      { customerId: e.ana, allocations: [{ batchId: e.olderBatchId, packages: 4 }] },
      {
        customerId: e.bruno,
        allocations: [
          { batchId: e.olderBatchId, packages: 1 },
          { batchId: e.newerBatchId, packages: 1 },
        ],
      },
    ],
    ...overrides,
  };
}

/** `n` envases para Ana desde el lote viejo (hasta 12) y el resto del nuevo. */
function deN(e: EscenarioSinPedido, n: number) {
  const viejo = Math.min(n, 12);
  const allocations = [{ batchId: e.olderBatchId, packages: viejo }];
  if (n > viejo) allocations.push({ batchId: e.newerBatchId, packages: n - viejo });
  return entrada(e, { note: null, customers: [{ customerId: e.ana, allocations }] });
}

async function existencias(e: EscenarioSinPedido) {
  return { viejo: await stockDeLote(e.olderBatchId), nuevo: await stockDeLote(e.newerBatchId), producto: await stockDeProducto(e.productId) };
}

const INICIAL = { viejo: '24.0000', nuevo: '16.0000', producto: '40.0000' };

async function conEscenario(label: string, caso: (e: EscenarioSinPedido) => Promise<void>): Promise<void> {
  const e = await crearEscenarioSinPedido(label);
  try {
    await caso(e);
  } finally {
    await borrarEmpresaSinPedido(e.empresa);
  }
}

describe('R33: el excedente, calculado con el producto bloqueado', () => {
  it('R33: 20 en stock y 8 que esperan: 13 envases son delivery_exceeds_surplus sin escribir nada y 12 pasan', async () => {
    await conEscenario('excedente', async (e) => {
      const vista = await pedidos.getDirectDelivery(e.productId, e.actor);
      expect(vista).toMatchObject({ stockPackages: 20, waitingPackages: 8, surplusPackages: 12 });
      expect(await pedidos.listDirectDeliverySurplus([e.productId], e.actor)).toEqual(new Map([[e.productId, 12]]));

      expect(await codigoDe(pedidos.deliverDirect(deN(e, 13), e.actor))).toBe('delivery_exceeds_surplus');
      expect(await escritoSinPedido(e.empresa.companyId)).toEqual(NADA_ESCRITO);
      expect(await existencias(e)).toEqual(INICIAL);

      await expect(pedidos.deliverDirect(deN(e, 12), e.actor)).resolves.toEqual({ status: 'delivered' });
      expect(await existencias(e)).toEqual({ viejo: '0.0000', nuevo: '16.0000', producto: '16.0000' });
      expect(await pedidos.listDirectDeliverySurplus([e.productId], e.actor)).toEqual(new Map([[e.productId, 0]]));
    });
  });

  it('R33: una linea de entrega anulada vuelve a esperar y resta del excedente', async () => {
    await conEscenario('excedente-anulada', async (e) => {
      // Entrega de 3 al primer pedido: espera 2 y el excedente sube a 12 (17 - 5).
      const deliveryKey = randomUUID();
      await pedidos.deliverOrder(
        { orderId: e.firstOrder.orderId, deliveryKey, customers: [{ customerId: e.ana, allocations: [{ presentationLineId: e.firstOrder.lineId, batchId: e.olderBatchId, packages: 3 }] }] },
        e.actor,
      );
      expect(await pedidos.getDirectDelivery(e.productId, e.actor)).toMatchObject({ stockPackages: 17, waitingPackages: 5, surplusPackages: 12 });

      const { id: deliveryId } = await prisma.orderDelivery.findFirstOrThrow({ where: { companyId: e.empresa.companyId, deliveryKey }, select: { id: true } });
      await pedidos.voidDelivery(
        { deliveryId, voidKey: randomUUID(), items: [{ customerId: e.ana, presentationLineId: e.firstOrder.lineId }], reason: 'Error' },
        e.actor,
      );
      expect(await pedidos.getDirectDelivery(e.productId, e.actor)).toMatchObject({ stockPackages: 20, waitingPackages: 8, surplusPackages: 12 });
      expect(await codigoDe(pedidos.deliverDirect(deN(e, 13), e.actor))).toBe('delivery_exceeds_surplus');
    });
  });
});

describe('R36, R37: lo que escribe una entrega sin pedido', () => {
  it('R36: una sola entrega con producto, clave, nota recortada, autor e instante, una linea por cliente y lote, y ningun pedido tocado', async () => {
    await conEscenario('escritura', async (e) => {
      const pedidosAntes = await prisma.order.findMany({ where: { companyId: e.empresa.companyId }, orderBy: { id: 'asc' } });
      const input = entrada(e);
      const antes = new Date();

      await expect(pedidos.deliverDirect(input, e.actor)).resolves.toEqual({ status: 'delivered' });

      const entregas = await prisma.orderDelivery.findMany({ where: { companyId: e.empresa.companyId } });
      expect(entregas).toHaveLength(1);
      const [entrega] = entregas;
      expect(entrega).toMatchObject({ orderId: null, productId: e.productId, deliveryKey: input.deliveryKey, note: 'Venta mostrador, factura 0012', createdBy: e.actor.id });
      expect(entrega!.createdAt.getTime()).toBeGreaterThanOrEqual(antes.getTime() - 1000);

      const lineas = await prisma.orderDeliveryLine.findMany({ where: { deliveryId: entrega!.id }, orderBy: [{ customerId: 'asc' }, { packages: 'asc' }] });
      const esperado = [
        { customerId: e.ana, batchId: e.olderBatchId, packages: 4, quantity: '8.0000' },
        { customerId: e.bruno, batchId: e.olderBatchId, packages: 1, quantity: '2.0000' },
        { customerId: e.bruno, batchId: e.newerBatchId, packages: 1, quantity: '2.0000' },
      ];
      expect(
        lineas.map((l) => ({ customerId: l.customerId, batchId: l.batchId, packages: l.packages, quantity: l.quantity.toFixed(4), presentationLineId: l.orderPresentationLineId })),
      ).toEqual(expect.arrayContaining(esperado.map((x) => ({ ...x, presentationLineId: null }))));
      expect(lineas).toHaveLength(3);

      const pedidosDespues = await prisma.order.findMany({ where: { companyId: e.empresa.companyId }, orderBy: { id: 'asc' } });
      expect(pedidosDespues).toEqual(pedidosAntes);
    });
  });

  it('R36: sin nota la entrega se guarda sin nota', async () => {
    await conEscenario('sin-nota', async (e) => {
      await pedidos.deliverDirect(entrada(e, { note: '   ' }), e.actor);
      const entrega = await prisma.orderDelivery.findFirstOrThrow({ where: { companyId: e.empresa.companyId } });
      expect(entrega.note).toBeNull();
    });
  });

  it('R37: descuenta cada lote, un solo asiento direct_delivery por lote con la suma en negativo, y recalcula el producto', async () => {
    await conEscenario('asientos', async (e) => {
      await pedidos.deliverDirect(entrada(e), e.actor);
      const entrega = await prisma.orderDelivery.findFirstOrThrow({ where: { companyId: e.empresa.companyId }, select: { id: true, createdAt: true } });

      expect(await existencias(e)).toEqual({ viejo: '14.0000', nuevo: '14.0000', producto: '28.0000' });
      const asientos = await prisma.inventoryMovement.findMany({ where: { companyId: e.empresa.companyId, kind: 'direct_delivery' } });
      expect(
        asientos
          .map((a) => ({ batchId: a.batchId, quantity: a.quantity.toFixed(4), orderId: a.orderId, reason: a.reason, orderDeliveryId: a.orderDeliveryId, createdBy: a.createdBy }))
          .sort((a, b) => a.quantity.localeCompare(b.quantity)),
      ).toEqual(
        [
          { batchId: e.olderBatchId, quantity: '-10.0000' },
          { batchId: e.newerBatchId, quantity: '-2.0000' },
        ]
          .map((x) => ({ ...x, orderId: null, reason: null, orderDeliveryId: entrega.id, createdBy: e.actor.id }))
          .sort((a, b) => a.quantity.localeCompare(b.quantity)),
      );
      expect(asientos.every((a) => a.createdAt.getTime() === entrega.createdAt.getTime())).toBe(true);
    });
  });
});

describe('R30, R31, R32, R34: rechazos sin escribir nada', () => {
  it('R30: producto inexistente, dado de baja, que no es terminado o de otra empresa: product_not_found', async () => {
    await conEscenario('producto', async (e) => {
      const b = await crearEscenarioSinPedido('producto-B');
      try {
        const otraPresentacion = await crearPresentacion(e.empresa, '1.0000');
        const deBaja = await crearTerminado(e.empresa, otraPresentacion);
        await prisma.product.update({ where: { id: deBaja }, data: { deletedAt: new Date() } });
        const { id: noTerminado } = await prisma.product.create({
          data: { name: `Materia ${randomUUID()}`, nameNormalized: `materia${randomUUID().replace(/-/g, '')}`, type: 'PRODUCT', unitId: e.empresa.unitId, companyId: e.empresa.companyId },
          select: { id: true },
        });

        for (const productId of [randomUUID(), deBaja, noTerminado, b.productId]) {
          expect(await codigoDe(pedidos.deliverDirect(entrada(e, { productId }), e.actor))).toBe('product_not_found');
          expect(await codigoDe(pedidos.getDirectDelivery(productId, e.actor))).toBe('product_not_found');
        }
        expect(await pedidos.listDirectDeliverySurplus([deBaja, noTerminado, b.productId], e.actor)).toEqual(new Map());
        expect(await escritoSinPedido(e.empresa.companyId)).toEqual(NADA_ESCRITO);
        expect(await escritoSinPedido(b.empresa.companyId)).toEqual(NADA_ESCRITO);
        expect(await stockDeProducto(b.productId)).toBe('40.0000');
      } finally {
        await borrarEmpresaSinPedido(b.empresa);
      }
    });
  });

  it('R31: un cliente inexistente, dado de baja o de otra empresa: customer_not_found', async () => {
    await conEscenario('cliente', async (e) => {
      const b = await crearEscenarioSinPedido('cliente-B');
      try {
        const deBaja = await crearCliente(e.empresa, 'Baja', new Date());
        for (const customerId of [randomUUID(), deBaja, b.ana, 'cliente']) {
          const input = entrada(e);
          input.customers[1] = { ...input.customers[1]!, customerId };
          expect(await codigoDe(pedidos.deliverDirect(input, e.actor))).toBe('customer_not_found');
        }
        expect(await escritoSinPedido(e.empresa.companyId)).toEqual(NADA_ESCRITO);
        expect(await existencias(e)).toEqual(INICIAL);
      } finally {
        await borrarEmpresaSinPedido(b.empresa);
      }
    });
  });

  it('R32: un lote de otro producto o de otra empresa: batch_not_found, y la existencia no cambia', async () => {
    await conEscenario('lote', async (e) => {
      const b = await crearEscenarioSinPedido('lote-B');
      try {
        const otraPresentacion = await crearPresentacion(e.empresa, '2.0000');
        const otro = await crearTerminado(e.empresa, otraPresentacion);
        const loteDeOtro = await crearLote(e.empresa, otro, otraPresentacion, '20.0000', '2.0000');
        for (const batchId of [loteDeOtro, b.olderBatchId, randomUUID()]) {
          const input = entrada(e, { customers: [{ customerId: e.ana, allocations: [{ batchId: e.olderBatchId, packages: 1 }, { batchId, packages: 1 }] }] });
          expect(await codigoDe(pedidos.deliverDirect(input, e.actor))).toBe('batch_not_found');
        }
        expect(await escritoSinPedido(e.empresa.companyId)).toEqual(NADA_ESCRITO);
        expect(await existencias(e)).toEqual(INICIAL);
        expect(await stockDeLote(loteDeOtro)).toBe('20.0000');
        expect(await stockDeLote(b.olderBatchId)).toBe('24.0000');
      } finally {
        await borrarEmpresaSinPedido(b.empresa);
      }
    });
  });

  it('R34: dos clientes que juntos piden a un lote mas de lo que tiene, dentro del excedente: delivery_batch_insufficient', async () => {
    await conEscenario('lote-insuficiente', async (e) => {
      const input = entrada(e, {
        customers: [
          { customerId: e.ana, allocations: [{ batchId: e.newerBatchId, packages: 5 }] },
          { customerId: e.bruno, allocations: [{ batchId: e.newerBatchId, packages: 4 }] },
        ],
      });
      expect(await codigoDe(pedidos.deliverDirect(input, e.actor))).toBe('delivery_batch_insufficient');
      expect(await escritoSinPedido(e.empresa.companyId)).toEqual(NADA_ESCRITO);
      expect(await existencias(e)).toEqual(INICIAL);
      expect(await prisma.productBatch.count({ where: { companyId: e.empresa.companyId, stock: { lt: 0 } } })).toBe(0);
    });
  });
});

describe('R38: la clave', () => {
  it('R38: la misma clave dos veces: la segunda responde already_registered sin escribir nada', async () => {
    await conEscenario('clave', async (e) => {
      const input = entrada(e);
      await expect(pedidos.deliverDirect(input, e.actor)).resolves.toEqual({ status: 'delivered' });
      const tras = await escritoSinPedido(e.empresa.companyId);
      // Aunque hoy ya superaria el excedente: es un reintento, no una entrega nueva.
      await expect(pedidos.deliverDirect({ ...input, customers: deN(e, 12).customers }, e.actor)).resolves.toEqual({ status: 'already_registered' });
      expect(await escritoSinPedido(e.empresa.companyId)).toEqual(tras);
      expect(await existencias(e)).toEqual({ viejo: '14.0000', nuevo: '14.0000', producto: '28.0000' });
    });
  });

  it('R38: la clave de una entrega de pedido es invalid_input, y una entrega de pedido con la clave de una sin pedido tambien', async () => {
    await conEscenario('clave-cruzada', async (e) => {
      const dePedido = randomUUID();
      await pedidos.deliverOrder(
        { orderId: e.firstOrder.orderId, deliveryKey: dePedido, customers: [{ customerId: e.ana, allocations: [{ presentationLineId: e.firstOrder.lineId, batchId: e.olderBatchId, packages: 1 }] }] },
        e.actor,
      );
      expect(await codigoDe(pedidos.deliverDirect(entrada(e, { deliveryKey: dePedido }), e.actor))).toBe('invalid_input');
      expect(await escritoSinPedido(e.empresa.companyId)).toEqual(NADA_ESCRITO);

      const sinPedido = entrada(e);
      await pedidos.deliverDirect(sinPedido, e.actor);
      expect(
        await codigoDe(
          pedidos.deliverOrder(
            { orderId: e.secondOrder.orderId, deliveryKey: sinPedido.deliveryKey, customers: [{ customerId: e.bruno, allocations: [{ presentationLineId: e.secondOrder.lineId, batchId: e.olderBatchId, packages: 1 }] }] },
            e.actor,
          ),
        ),
      ).toBe('invalid_input');
      expect(await prisma.orderDelivery.count({ where: { companyId: e.empresa.companyId } })).toBe(2);
      const { status } = await prisma.order.findUniqueOrThrow({ where: { id: e.secondOrder.orderId }, select: { status: true } });
      expect(status).toBe('TERMINADO');
    });
  });
});

describe('R39: un fallo no deja nada escrito', () => {
  it('R39: si falla la escritura de las lineas, despues de la salida de todos los lotes, no queda ni entrega, ni linea, ni asiento, ni cambio de existencia', async () => {
    await conEscenario('fallo', async (e) => {
      const entregar = createDeliverDirect({
        customerCatalog: { findAliveRefById: (id, companyId) => findAliveCustomerRefById(id, { companyId }) },
        catalog: { findSurplusBases },
        deliveries: createDirectDeliveryRepository(),
        unitOfWork: {
          run: (work) =>
            withOrderTransaction((tx) => {
              const deliveries = createDirectDeliveryRepository(tx);
              return work({
                deliveries: {
                  ...deliveries,
                  addLines: async () => {
                    throw new Error('fallo forzado tras la salida');
                  },
                },
                waiting: createWaitingOrdersReader(tx),
                waitingLock: createWaitingOrdersLock(tx),
                finishedGoods: createFinishedGoodsDirectDispatch(tx),
              });
            }),
        },
      });

      await expect(entregar(entrada(e), e.actor)).rejects.toThrow('fallo forzado tras la salida');
      expect(await escritoSinPedido(e.empresa.companyId)).toEqual(NADA_ESCRITO);
      expect(await existencias(e)).toEqual(INICIAL);
    });
  });

  it('R39: un lote ajeno en el segundo cliente, despues de un lote valido del primero, no deja nada escrito', async () => {
    await conEscenario('fallo-segundo', async (e) => {
      const b = await crearEscenarioSinPedido('fallo-segundo-B');
      try {
        const input = entrada(e, {
          customers: [
            { customerId: e.ana, allocations: [{ batchId: e.olderBatchId, packages: 2 }] },
            { customerId: e.bruno, allocations: [{ batchId: b.newerBatchId, packages: 1 }] },
          ],
        });
        expect(await codigoDe(pedidos.deliverDirect(input, e.actor))).toBe('batch_not_found');
        expect(await escritoSinPedido(e.empresa.companyId)).toEqual(NADA_ESCRITO);
        expect(await existencias(e)).toEqual(INICIAL);
      } finally {
        await borrarEmpresaSinPedido(b.empresa);
      }
    });
  });
});

describe('Empresa B', () => {
  it('R30, R38: la empresa B no ve el producto ni la clave de A, y la misma clave sirve en B para su propio producto', async () => {
    await conEscenario('empresa-A', async (e) => {
      const b = await crearEscenarioSinPedido('empresa-B');
      try {
        const deA = entrada(e);
        await pedidos.deliverDirect(deA, e.actor);

        expect(await codigoDe(pedidos.deliverDirect(entrada(b, { productId: e.productId }), b.actor))).toBe('product_not_found');
        expect(await codigoDe(pedidos.deliverDirect({ ...deA }, b.actor))).toBe('customer_not_found');
        expect(await codigoDe(pedidos.getDirectDelivery(e.productId, b.actor))).toBe('product_not_found');
        expect(await pedidos.listDirectDeliverySurplus([e.productId], b.actor)).toEqual(new Map());

        await expect(pedidos.deliverDirect(entrada(b, { deliveryKey: deA.deliveryKey }), b.actor)).resolves.toEqual({ status: 'delivered' });
        expect((await escritoSinPedido(b.empresa.companyId)).entregas).toBe(1);
        expect((await escritoSinPedido(e.empresa.companyId)).entregas).toBe(1);
        expect(await existencias(e)).toEqual({ viejo: '14.0000', nuevo: '14.0000', producto: '28.0000' });
      } finally {
        await borrarEmpresaSinPedido(b.empresa);
      }
    });
  });
});
