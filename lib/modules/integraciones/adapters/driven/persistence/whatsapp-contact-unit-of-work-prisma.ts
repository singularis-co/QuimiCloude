import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import { isCustomerPhoneLinkConflict } from './whatsapp-contact-prisma';

/**
 * Vincular y desvincular escriben los telefonos del cliente, y dos escrituras simultaneas del mismo
 * cliente pueden chocar contra un unico parcial de sus vinculos. La transaccion que choco ya no
 * admite sentencias, asi que el unico reintento abre una nueva; si vuelve a chocar, el error sube.
 */
export async function withWhatsappContactTransaction<T>(
  run: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  try {
    return await prisma.$transaction(run, { maxWait: 10_000, timeout: 30_000 });
  } catch (error) {
    if (!isCustomerPhoneLinkConflict(error)) throw error;
    return prisma.$transaction(run, { maxWait: 10_000, timeout: 30_000 });
  }
}
