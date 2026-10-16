import type { Prisma, PrismaClient } from '@prisma/client';
import type { CountryCode } from 'libphonenumber-js';

import { prisma } from '@/lib/shared/db/prisma';

import { atomically, recordCompanyEvent } from './company-prisma';

import type { CompanyCountryRepository } from '../../../ports/company-country-repository';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export function createCompanyCountryRepository(db: PrismaLike = prisma): CompanyCountryRepository {
  return {
    async setCountryOfAlive(
      companyId: string,
      country: CountryCode | null,
      actorId: string,
      now: Date,
    ) {
      return atomically(db, async (tx) => {
        const rows = await tx.$queryRaw<Array<{ country: string | null }>>`
          SELECT country FROM companies
          WHERE id = ${companyId}::uuid AND deleted_at IS NULL FOR UPDATE`;
        const current = rows[0];
        if (current === undefined) return 'not_found' as const;
        if (current.country === country) return 'ok' as const;

        await tx.company.update({
          where: { id: companyId },
          data: { country, updatedAt: now },
          select: { id: true },
        });
        await recordCompanyEvent(tx, {
          companyId,
          kind: 'company.updated',
          actorId,
          now,
          fields: ['country'],
        });
        return 'ok' as const;
      });
    },
  };
}
