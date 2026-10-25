import { prisma } from '@/lib/shared/db/prisma';

import type { OrderStatus } from '../../../domain/order-classification';
import type {
  CustomerOrderDirectory,
  CustomerOrderSummary,
} from '../../../domain/customer-order-directory';

import { orderCompanyScope } from './company-scope';

type OrderClient = Pick<typeof prisma, 'order'>;

/** Archivo propio, y no un metodo mas de `order-catalog-prisma.ts`, para que los cambios de un
 *  servicio no toquen el archivo del otro. Solo lectura. */
export function createCustomerOrderDirectory(db: OrderClient = prisma): CustomerOrderDirectory {
  return {
    async listAliveOfCustomer(
      companyId: string,
      customerId: string,
      excludedStatuses: readonly OrderStatus[],
      limit: number,
    ): Promise<readonly CustomerOrderSummary[]> {
      if (limit <= 0) return [];

      const rows = await db.order.findMany({
        where: {
          AND: [
            orderCompanyScope({ companyId }),
            { customerId, deletedAt: null, status: { notIn: [...excludedStatuses] } },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: {
          id: true,
          orderYear: true,
          orderSequence: true,
          status: true,
          recipeId: true,
          createdAt: true,
        },
      });

      return rows.map((row) => ({
        id: row.id,
        number: { year: row.orderYear, sequence: row.orderSequence },
        status: row.status,
        recipeId: row.recipeId,
        createdAt: row.createdAt,
      }));
    },
  };
}
