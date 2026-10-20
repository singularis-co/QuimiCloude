import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import { isCustomerPhoneLinkConflict } from './customer-phone-prisma';

/**
 * Dos escrituras simultaneas de telefonos pueden chocar: las del mismo cliente contra un unico
 * parcial de sus vinculos, y las de dos clientes con el mismo numero nuevo contra el unico de
 * `phone_numbers`. La transaccion que choco ya no admite sentencias, asi que el unico reintento
 * abre una nueva y repite la unidad entera; si vuelve a chocar, el error sube.
 */
export async function withCustomerTransaction<T>(
  run: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  try {
    return await prisma.$transaction(run, { maxWait: 10_000, timeout: 30_000 });
  } catch (error) {
    if (!isCustomerPhoneLinkConflict(error)) throw error;
    return prisma.$transaction(run, { maxWait: 10_000, timeout: 30_000 });
  }
}
