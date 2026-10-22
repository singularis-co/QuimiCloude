/**
 * Anulaciones sin pedido reales a la vez contra Postgres: lo que se mide es que el unico de
 * `delivery_line_id` y el de la clave serializan de verdad, sin pedido que bloquear. El caso de la
 * misma clave ata `createVoidDirectDelivery` a mano con los mismos adaptadores reales, para obligar a
 * los dos envios a pasar la lectura previa de la clave antes de competir.
 *
 * AISLAMIENTO: `commit`. Cada `withOrderTransaction` tiene que confirmar para que la otra choque con lo
 * que escribio. Cada caso fabrica su empresa efimera y la borra en un `finally`
 * (`tests/helpers/direct-delivery-seed.ts`).
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
  borrarEmpresaSinPedido,
  codigos,
  crearEscenarioSinPedido,
  escritoSinPedido,
  type EscenarioSinPedido,
} from '../../helpers/direct-delivery-seed';
import { stockDeLote, stockDeProducto } from '../../helpers/order-delivery-seed';

afterAll(async () => {
  await prisma.$disconnect();
});

type ConEntrega = EscenarioSinPedido & { readonly deliveryId: string };

/** Ana: 3 del lote viejo; Bruno: 2 del viejo. Deja el lote viejo en 14.0000. */
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
          { customerId: base.ana, allocations: [{ batchId: base.olderBatchId, packages: 3 }] },
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

/**
 * `voidDirectDelivery` con los adaptadores reales que ata `lib/composition`, salvo que la lectura
 * PREVIA de la clave espera a que las `participantes` peticiones la hayan hecho. Las lecturas
 * siguientes van directas.
 */
function anularConLecturaPreviaSincronizada(participantes: number) {
  const voids = createOrderDeliveryVoidRepository();
  let previas = 0;
  let soltar: () => void = () => undefined;
  const todasLeyeron = new Promise<void>((resolve) => {
    soltar = resolve;
  });
  return createVoidDirectDelivery({
    unitOfWork: {
      run: (work) =>
        withOrderTransaction((tx) => work({ voids: createOrderDeliveryVoidRepository(tx), finishedGoods: createFinishedGoodsReturn(tx) })),
    },
    voids: {
      findDelivery: voids.findDelivery,
      findByKey: async (voidKey, scope) => {
        if (previas >= participantes) return voids.findByKey(voidKey, scope);
        previas += 1;
        const leida = await voids.findByKey(voidKey, scope);
        if (previas === participantes) soltar();
        await todasLeyeron;
        return leida;
      },
    },
  });
}

describe('R51: anulaciones simultaneas de la misma entrega', () => {
  it('R51: dos anulaciones a la vez que comparten a Ana: una aplicada y la otra delivery_already_voided, y el lote recibe una sola vez', async () => {
    await conEntrega('comparten', async (e) => {
      const anular = (customerIds: readonly string[]) =>
        pedidos.voidDirectDelivery({ deliveryId: e.deliveryId, voidKey: randomUUID(), customerIds, reason: 'Devolucion' }, e.actor);

      const resultados = await Promise.allSettled([anular([e.ana]), anular([e.ana, e.bruno])]);

      expect(codigos(resultados)).toEqual(['aplicada', 'delivery_already_voided']);
      const escrito = await escritoSinPedido(e.empresa.companyId);
      expect(escrito.anulaciones).toBe(1);
      expect(escrito.asientosDeAnulacion).toBe(1);
      // Ana devuelve 6.0000; si gano la de los dos, 10.0000.
      expect(['20.0000', '24.0000']).toContain(await stockDeLote(e.olderBatchId));
      expect(await stockDeProducto(e.productId)).toBe(`${String(Number(await stockDeLote(e.olderBatchId)) + 16)}.0000`);
    });
  });

  it('R51: dos envios a la vez con la misma clave: uno voided y el otro already_registered, y una sola anulacion escrita', async () => {
    await conEntrega('misma-clave', async (e) => {
      const anular = anularConLecturaPreviaSincronizada(2);
      const input = { deliveryId: e.deliveryId, voidKey: randomUUID(), customerIds: [e.ana], reason: 'Devolucion' };

      const resultados = await Promise.all([anular(input, e.actor), anular(input, e.actor)]);

      expect(resultados.map((r) => r.status).sort()).toEqual(['already_registered', 'voided']);
      expect(await escritoSinPedido(e.empresa.companyId)).toMatchObject({ anulaciones: 1, lineasAnuladas: 1, asientosDeAnulacion: 1 });
      expect(await stockDeLote(e.olderBatchId)).toBe('20.0000');
    });
  });
});
