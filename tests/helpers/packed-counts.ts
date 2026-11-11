// Conteo real de envases para los tests de integracion que Terminan el empaque sin probar el
// conteo: el de cada linea del reparto coincide con su plan, sin motivo.
import { prisma } from '@/lib/shared/db/prisma';

import type { PackedLineCount } from '@/lib/modules/pedidos';

export async function packedCountsOfPlan(orderId: string): Promise<readonly PackedLineCount[]> {
  const lines = await prisma.orderPresentationLine.findMany({ where: { orderId }, select: { id: true, packages: true } });
  return lines.map((line) => ({ lineId: line.id, packedPackages: line.packages, reason: null, reasonOther: null }));
}

/** El mismo conteo con la forma de la entrada de Terminar: la linea del reparto va en
 *  `presentationLineId`. */
export async function packingCountsOfPlan(orderId: string) {
  return (await packedCountsOfPlan(orderId)).map(({ lineId, ...resto }) => ({ presentationLineId: lineId, ...resto }));
}
