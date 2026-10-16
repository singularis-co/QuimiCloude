import type { FinishedGoodsDirectDispatch, FinishedGoodsReturn } from '@/lib/modules/inventario';

import type { DirectDeliveryRepository, WaitingOrdersLock, WaitingOrdersReader } from './direct-delivery-repository';
import type { OrderDeliveryVoidRepository } from './order-delivery-void-repository';

/** Va aparte de los ambitos de la entrega de pedido para no obligar a sus dobles a construirlo. */
export type DirectDeliveryTransactionScope = {
  readonly deliveries: DirectDeliveryRepository;
  readonly waiting: WaitingOrdersReader;
  readonly waitingLock: WaitingOrdersLock;
  readonly finishedGoods: FinishedGoodsDirectDispatch;
};

export interface DirectDeliveryUnitOfWork {
  run<T>(work: (scope: DirectDeliveryTransactionScope) => Promise<T>): Promise<T>;
}

export type DirectDeliveryVoidTransactionScope = {
  readonly voids: OrderDeliveryVoidRepository;
  readonly finishedGoods: FinishedGoodsReturn;
};

export interface DirectDeliveryVoidUnitOfWork {
  run<T>(work: (scope: DirectDeliveryVoidTransactionScope) => Promise<T>): Promise<T>;
}
