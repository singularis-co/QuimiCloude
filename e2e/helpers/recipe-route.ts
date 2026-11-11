import { prisma } from '@/lib/shared/db/prisma';

/**
 * La parte de una ruta que compara `url.pathname`: sin la consulta `?receta=<lineId>` que llevan
 * las pantallas de una receta.
 */
export function pathOf(route: string): string {
  return route.split('?')[0]!;
}

/** El id de la linea viva de menor `position` del pedido: la unica de un pedido de una receta. */
export async function firstLineIdOf(orderId: string): Promise<string> {
  const line = await prisma.orderLine.findFirstOrThrow({
    where: { orderId, deletedAt: null },
    orderBy: { position: 'asc' },
    select: { id: true },
  });
  return line.id;
}
