// Los casos de uso de planta reciben la receta (`lineId`) junto al pedido. Los tests de integracion
// escritos con pedidos de una sola receta siguen describiendo ese pedido: este puente les pone la
// unica linea viva del pedido en la entrada, igual que la pantalla la pone desde la direccion.
// Los tests de varias recetas pasan `lineId` explicito y el puente no lo toca.
import { ensureOnlyLine } from './only-order-line';

import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/** Un uuid que no es la linea de ningun pedido: el caso de uso responde `order_not_found`. */
const SIN_LINEA = '00000000-0000-4000-8000-000000000000';

async function conLinea(db: Db, input: unknown): Promise<unknown> {
  if (typeof input !== 'object' || input === null || 'lineId' in input) return input;
  const { orderId } = input as { readonly orderId?: unknown };
  if (typeof orderId !== 'string') return input;
  let lineId = SIN_LINEA;
  try {
    lineId = await ensureOnlyLine(db, orderId);
  } catch {
    // Pedido inexistente, de otra empresa o con un id que no es uuid: que decida el caso de uso.
  }
  return { ...input, lineId };
}

type CasoDeUso = (actor: never, input: never, ...resto: never[]) => Promise<unknown>;

/** Los casos de uso de `useCases` con la unica receta del pedido puesta en la entrada. */
export function onOnlyRecipe<T extends object>(useCases: T, db: Db): T {
  return new Proxy(useCases, {
    get(target, prop, receiver) {
      const value: unknown = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      const caso = value as CasoDeUso;
      return async (actor: never, input: unknown, ...resto: never[]) =>
        caso.call(target, actor, (await conLinea(db, input)) as never, ...resto);
    },
  });
}

/** Un caso de uso suelto con la unica receta del pedido puesta en la entrada. */
export function withOnlyRecipe<A, R>(caso: (actor: A, input: unknown) => Promise<R>, db: Db) {
  return async (actor: A, input: unknown): Promise<R> => caso(actor, await conLinea(db, input));
}
