import type { Prisma, PrismaClient } from '@prisma/client';
import type { CountryCode } from 'libphonenumber-js';

import { prisma } from '@/lib/shared/db/prisma';

import type { CompanyCountryRepository } from '../../../ports/company-country-repository';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

// Escritura aparte de `company-directory-prisma.ts`, que es solo de lectura.
export function createCompanyCountryRepository(db: PrismaLike = prisma): CompanyCountryRepository {
  return {
    async setCountryOfAlive(companyId: string, country: CountryCode | null) {
      // Una sola sentencia sin lectura previa: `deletedAt: null` en el filtro cubre «no existe» y
      // «dada de baja» sin carrera entre leer y escribir.
      const { count } = await db.company.updateMany({
        where: { id: companyId, deletedAt: null },
        data: { country },
      });
      return count === 1 ? 'ok' : 'not_found';
    },
  };
}
