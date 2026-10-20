import { prisma } from '@/lib/shared/db/prisma';

/**
 * Sin ámbito porque la URL del webhook solo trae el id de la conexión. Devuelve la empresa y nada
 * más: la fila se lee después con su ámbito, y la respuesta HTTP es la misma con o sin fila.
 */
export async function companyOfWhatsappConnection(connectionId: string): Promise<string | null> {
  const row = await prisma.whatsappConnection.findFirst({
    where: { id: connectionId, deletedAt: null },
    select: { companyId: true },
  });
  return row?.companyId ?? null;
}
