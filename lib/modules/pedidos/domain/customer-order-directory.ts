import type { OrderStatus } from './order-classification';
import type { OrderNumber } from './order-number';

export type CustomerOrderSummary = {
  readonly id: string;
  readonly number: OrderNumber;
  readonly status: OrderStatus;
  readonly recipeId: string;
  readonly createdAt: Date;
};

/** Lo que `pedidos` ofrece a otros modulos para listar los pedidos de un cliente sin tocar la
 *  tabla de pedidos. Servicio aparte de `OrderCatalog`: no comparte su ciclo de cambios. */
export interface CustomerOrderDirectory {
  /** Pedidos vivos de ese cliente en esa empresa, sin los de `excludedStatuses`, los `limit` de
   *  `created_at` mas reciente (desempate `id` DESC). Cliente inexistente o de otra empresa: []. */
  listAliveOfCustomer(
    companyId: string,
    customerId: string,
    excludedStatuses: readonly OrderStatus[],
    limit: number,
  ): Promise<readonly CustomerOrderSummary[]>;
}
