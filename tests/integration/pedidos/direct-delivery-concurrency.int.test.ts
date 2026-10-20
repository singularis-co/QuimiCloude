/**
 * Entregas sin pedido reales a la vez contra Postgres, por la fachada de `lib/composition`: lo que se
 * mide es que el bloqueo del producto y el de los pedidos que pueden esperar serializan de verdad.
 *
 * El caso del acondicionamiento abre a mano la transaccion que deja un pedido TERMINADO y la mantiene
 * abierta: terminar el acondicionamiento no bloquea el producto, asi que solo el bloqueo de los
 * pedidos hace que la entrega espere a que confirme y cuente lo que ese pedido espera.
 *
 * AISLAMIENTO: `commit`. Cada transaccion tiene que confirmar para que la otra vea lo que escribio.
 * Cada caso fabrica su empresa efimera y la borra en un `finally` (`tests/helpers/direct-delivery-seed.ts`).
 */
import { randomUUID } from 'node:crypto';

import { afterAll, describe, expect, it } from 'vitest';

import { pedidos } from '@/lib/composition';
import { finishConditioningAliveOrder } from '@/lib/modules/pedidos/adapters/driven/persistence/order-prisma';
import { prisma } from '@/lib/shared/db/prisma';

import {
  borrarEmpresaSinPedido,
  codigos,
  crearEscenarioSinPedido,
  escritoSinPedido,
  type EscenarioSinPedido,
} from '../../helpers/direct-delivery-seed';
import { crearPedido, stockDeLote, stockDeProducto } from '../../helpers/order-delivery-seed';

afterAll(async () => {
  await prisma.$disconnect();
});

/** `n` envases para un cliente desde el lote viejo (12 envases) y el resto del nuevo (8). */
function entrega(e: EscenarioSinPedido, n: number, customerId = e.ana) {
  const viejo = Math.min(n, 12);
  const allocations = [{ batchId: e.olderBatchId, packages: viejo }];
  if (n > viejo) allocations.push({ batchId: e.newerBatchId, packages: n - viejo });
  return pedidos.deliverDirect({ productId: e.productId, deliveryKey: randomUUID(), note: null, customers: [{ customerId, allocations }] }, e.actor);
}

async function conEscenario(label: string, caso: (e: EscenarioSinPedido) => Promise<void>): Promise<void> {
  const e = await crearEscenarioSinPedido(label);
  try {
    await caso(e);
  } finally {
    await borrarEmpresaSinPedido(e.empresa);
  }
}

/** Espera a que alguna sesion de esta base este esperando un bloqueo en una sentencia con `fragmento`. */
async function esperarSesionBloqueada(fragmento: string, plazoMs = 15_000): Promise<void> {
  const limite = Date.now() + plazoMs;
  while (Date.now() < limite) {
    const [fila] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n
        FROM pg_stat_activity
       WHERE datname = current_database()
         AND wait_event_type = 'Lock'
         AND query LIKE ${`%${fragmento}%`}`;
    if ((fila?.n ?? 0) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`ninguna sesion quedo esperando un bloqueo en «${fragmento}»`);
}

describe('R35: entregas simultaneas del mismo producto', () => {
  it('R35: dos entregas sin pedido a la vez que juntas superan el excedente (7 + 7 con 12): una aplicada y la otra delivery_exceeds_surplus', async () => {
    await conEscenario('dos-sin-pedido', async (e) => {
      // Los lotes alcanzan para las dos (20 envases): solo el bloqueo del producto puede frenar a una.
      const resultados = await Promise.allSettled([entrega(e, 7), entrega(e, 7, e.bruno)]);

      expect(codigos(resultados)).toEqual(['aplicada', 'delivery_exceeds_surplus']);
      expect(await escritoSinPedido(e.empresa.companyId)).toMatchObject({ entregas: 1, lineas: 1, asientos: 1 });
      expect(await stockDeProducto(e.productId)).toBe('26.0000');
      expect(await pedidos.getDirectDelivery(e.productId, e.actor)).toMatchObject({ stockPackages: 13, waitingPackages: 8, surplusPackages: 5 });
    });
  });

  it('R35: una entrega sin pedido y una entrega de pedido a la vez se aplican una detras de otra, sin dejar el stock por debajo de lo que esperan', async () => {
    await conEscenario('con-pedido', async (e) => {
      const dePedido = pedidos.deliverOrder(
        {
          orderId: e.firstOrder.orderId,
          deliveryKey: randomUUID(),
          customers: [{ customerId: e.ana, allocations: [{ presentationLineId: e.firstOrder.lineId, batchId: e.newerBatchId, packages: 5 }] }],
        },
        e.actor,
      );
      // Cada una de su lote: lo unico que comparten es el excedente.
      const resultados = await Promise.allSettled([dePedido, entrega(e, 12, e.bruno)]);

      expect(codigos(resultados)).toEqual(['aplicada', 'aplicada']);
      // 20 - 5 - 12 = 3, justo lo que sigue esperando el segundo pedido.
      expect(await pedidos.getDirectDelivery(e.productId, e.actor)).toMatchObject({ stockPackages: 3, waitingPackages: 3, surplusPackages: 0 });
      expect(await prisma.productBatch.count({ where: { companyId: e.empresa.companyId, stock: { lt: 0 } } })).toBe(0);
    });
  });

  it('R35: si un pedido termina el acondicionamiento a la vez, la entrega espera a que confirme y cuenta lo que ese pedido espera', async () => {
    await conEscenario('acondicionamiento', async (e) => {
      // Tercer pedido de 5 envases EN_ACONDICIONAMIENTO: aun no espera; el excedente es 12.
      const { orderId } = await crearPedido(e.empresa, 'EN_ACONDICIONAMIENTO', e.ana, [{ presentationId: e.presentationId, packages: 5 }]);
      expect(await pedidos.getDirectDelivery(e.productId, e.actor)).toMatchObject({ surplusPackages: 12 });

      let soltar: () => void = () => undefined;
      const suelta = new Promise<void>((resolve) => {
        soltar = resolve;
      });
      let terminado: () => void = () => undefined;
      const yaTerminado = new Promise<void>((resolve) => {
        terminado = resolve;
      });
      const acondicionamiento = prisma.$transaction(
        async (tx) => {
          const movido = await finishConditioningAliveOrder(orderId, e.empresa.conditionerId, new Date(), { companyId: e.empresa.companyId }, tx);
          terminado();
          await suelta;
          return movido;
        },
        { timeout: 30_000 },
      );
      await yaTerminado;

      let resuelta = false;
      const sinPedido = entrega(e, 12).finally(() => {
        resuelta = true;
      });
      await esperarSesionBloqueada('FOR SHARE OF o');
      expect(resuelta).toBe(false);

      soltar();
      await expect(acondicionamiento).resolves.toBe('ok');
      const [resultado] = await Promise.allSettled([sinPedido]);

      // Con el pedido ya TERMINADO esperan 13: el excedente es 7 y 12 envases no caben.
      expect(codigos([resultado!])).toEqual(['delivery_exceeds_surplus']);
      expect(await escritoSinPedido(e.empresa.companyId)).toMatchObject({ entregas: 0, asientos: 0 });
      expect(await stockDeLote(e.olderBatchId)).toBe('24.0000');
      expect(await pedidos.getDirectDelivery(e.productId, e.actor)).toMatchObject({ stockPackages: 20, waitingPackages: 13, surplusPackages: 7 });
    });
  });
});
