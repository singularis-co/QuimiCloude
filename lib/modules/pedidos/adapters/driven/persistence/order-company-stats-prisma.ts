import { prisma } from '@/lib/shared/db/prisma';

import { ORDER_STATUSES_NOT_IN_PROGRESS } from '../../../domain/order-classification';

import { orderCompanyScope } from './company-scope';

type OrderClient = Pick<typeof prisma, 'order'>;

export async function countOpenOrdersInCompany(
  companyId: string,
  tx: OrderClient = prisma,
): Promise<number> {
  return tx.order.count({
    where: {
      AND: [
        orderCompanyScope({ companyId }),
        { deletedAt: null, status: { notIn: [...ORDER_STATUSES_NOT_IN_PROGRESS] } },
      ],
    },
  });
}
