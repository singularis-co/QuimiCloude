// Conteo real de envases para los tests de integracion que Terminan el empaque sin probar el
// conteo: el de cada linea del reparto coincide con su plan, sin motivo.
import { prisma } from '@/lib/shared/db/prisma';

import type { PackedLineCount } from '@/lib/modules/pedidos';

export async function packedCountsOfPlan(orderId: string): Promise<readonly PackedLineCount[]> {
  const lines = await prisma.orderPresentationLine.findMany({ where: { orderId }, select: { id: true, packages: true } });
  return lines.map((line) => ({ lineId: line.id, packedPackages: line.packages, reason: null, reasonOther: null }));
}
