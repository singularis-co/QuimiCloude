import type { WaitingOrderLine } from '../domain/direct-delivery';
import type { OrderScope } from '../domain/order-scope';

export type NewDirectDelivery = {
  readonly deliveryKey: string;
  readonly productId: string;
  /** Ya normalizada. */
  readonly note: string | null;
  readonly actorId: string;
  readonly now: Date;
};

export type NewDirectDeliveryLine = {
  readonly customerId: string;
  readonly batchId: string;
  readonly packages: number;
  readonly quantity: string;
};

/** La entrega con esa clave, de pedido o sin pedido. */
export type RegisteredDelivery = { readonly id: string; readonly orderId: string | null };

/** Las entregas sin pedido y sus lineas. Solo se insertan: ni se editan ni se borran. */
export interface DirectDeliveryRepository {
  /** Una clave de otra empresa no se ve. */
  findByKey(deliveryKey: string, scope: OrderScope): Promise<RegisteredDelivery | null>;
  /** `duplicate_key` si la empresa ya tiene una entrega con esa clave. */
  create(
    delivery: NewDirectDelivery,
    scope: OrderScope,
  ): Promise<{ readonly kind: 'created'; readonly id: string } | { readonly kind: 'duplicate_key' }>;
  addLines(deliveryId: string, lines: readonly NewDirectDeliveryLine[], scope: OrderScope): Promise<void>;
}

export type WaitingOrderPair = { readonly recipeId: string; readonly presentationId: string };

export type WaitingOrderLineOfPair = WaitingOrderLine & WaitingOrderPair;

/** Lineas del reparto de los pedidos vivos de la empresa en TERMINADO con esa receta y presentacion,
 *  con sus envases entregados sin las lineas anuladas. Una consulta para todos los pares. */
export interface WaitingOrdersReader {
  listWaitingLines(
    pairs: readonly WaitingOrderPair[],
    scope: OrderScope,
  ): Promise<readonly WaitingOrderLineOfPair[]>;
}

/** Sobre la transaccion de la entrega, antes de bloquear el producto. */
export interface WaitingOrdersLock {
  /** `FOR SHARE`, por id, de los pedidos vivos de la empresa con esa receta en `TERMINADO` o
   *  `EN_ACONDICIONAMIENTO` que tienen linea de esa presentacion. Terminar el acondicionamiento no
   *  bloquea el producto: asi espera, o se le espera, antes de que el pedido empiece a esperar envases. */
  lockWaitingCandidates(pair: WaitingOrderPair, scope: OrderScope): Promise<void>;
}
