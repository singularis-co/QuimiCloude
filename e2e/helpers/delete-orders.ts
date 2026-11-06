import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

/**
 * Borra los pedidos que casan con `where` y, antes, sus lineas: `order_lines` restringe el borrado
 * del pedido. Los ids se leen primero porque `where` puede filtrar por las propias lineas. Lo que
 * cuelga de las lineas (reparto, movimientos, anotaciones) lo borra antes quien llama.
 */
export async function deleteOrdersWithLines(args: { readonly where: Prisma.OrderWhereInput }): Promise<Prisma.BatchPayload> {
  const ids = (await prisma.order.findMany({ where: args.where, select: { id: true } })).map((order) => order.id);
  if (ids.length === 0) return { count: 0 };
  await prisma.orderLine.deleteMany({ where: { orderId: { in: ids } } });
  return prisma.order.deleteMany({ where: { id: { in: ids } } });
}
