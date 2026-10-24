import type { Prisma, PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import type { CompanyNameReader } from '../../../ports/company-name-reader';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export function createCompanyNameReader(db: PrismaLike = prisma): CompanyNameReader {
  return {
    async findNameOf(companyId: string) {
      const rows = await db.$queryRaw<Array<{ name: string }>>`
        SELECT name FROM companies WHERE id = ${companyId}::uuid AND deleted_at IS NULL`;
      return rows[0]?.name ?? null;
    },
  };
}
