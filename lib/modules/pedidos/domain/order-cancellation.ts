import { OrderNotFoundError } from './errors';
import type { OrderLineStatus, OrderStatus } from './order-classification';

import type { OrderTransactionScope, OrderUnitOfWork } from '../ports/order-unit-of-work';

/**
 * Desde `ENTREGADO` no se cancela -eso seria una devolucion, que no existe- y desde `CANCELADO`
 * tampoco, porque es final. `POR_EMPACAR`, `EN_EMPAQUE`, los de acondicionamiento y `TERMINADO`
 * tampoco: el material ya se consumio al dejar el pedido `POR_EMPACAR`, asi que cancelar dejaria un
 * consumo sin pedido que lo explique; un problema en esos estados se corrige con un ajuste de
 * inventario. Es un mapa total para
 * que un estado nuevo no compile hasta decidir si es cancelable.
 *
 * `BLOQUEADO` si se cancela, con las mismas reglas que un `PENDIENTE` y su motivo: es la unica
 * salida manual de un pedido sin material -no se fabrico nada, y esperar lotes no es cancelar-.
 * No tiene nada apartado, asi que `releaseForLine` no encuentra filas y no falla por eso.
 */
const CANCELLABLE = {
  PENDIENTE: true,
  EN_CURSO: true,
  BLOQUEADO: true,
  POR_EMPACAR: false,
  EN_EMPAQUE: false,
  POR_ACONDICIONAR: false,
  EN_ACONDICIONAMIENTO: false,
  TERMINADO: false,
  ENTREGADO: false,
  CANCELADO: false,
} as const satisfies Record<OrderLineStatus, boolean>;

export function isCancellableStatus(status: OrderStatus): boolean {
  return status !== 'PARCIAL' && CANCELLABLE[status];
}

export type OrderCancellationOutcome = 'ok' | 'not_found' | 'not_cancellable';

export type OrderCancellationInput = {
  readonly id: string;
  readonly reason: string;
  readonly actorId: string;
  readonly now: Date;
  readonly companyId: string;
};

/** Una linea ya bloqueada que se cancela: estado y motivo, todo su material liberado y su plazo
 *  vaciado. No toca el pedido: quien llama deriva su estado despues. */
export async function cancelLockedLine(
  scope: OrderTransactionScope,
  input: {
    readonly orderId: string;
    readonly lineId: string;
    readonly reason: string;
    readonly releaseReason: 'release' | 'expire';
    readonly actorId: string | null;
    readonly now: Date;
    readonly companyId: string;
  },
): Promise<void> {
  const { orderId, lineId, reason, releaseReason, actorId, now, companyId } = input;
  const cancelled = await scope.orders.cancelLine(orderId, lineId, reason, actorId, now, { companyId });
  // Con la linea bloqueada no deberia pasar; lanzar deshace lo ya escrito en la transaccion.
  if (cancelled === 'not_found') throw new OrderNotFoundError();

  await scope.reservations.releaseForLine({
    orderId,
    orderLineId: lineId,
    companyId,
    reason: releaseReason,
    actorId,
    now,
  });
  await scope.orders.setLineReservedAt(orderId, lineId, null, { companyId });
}

/**
 * Cancela dentro de una transaccion ya abierta: bloquea el pedido y sus lineas, vuelve a comprobar
 * bajo el candado cuales son cancelables -otra operacion pudo moverlas desde la lectura de quien
 * llama-, cancela esas con el mismo motivo y deja intactas las demas. Despues deriva el estado del
 * pedido. No abre ni cierra nada: quien llama decide si la transaccion es propia o compartida.
 */
export async function cancelInsideTransaction(
  scope: OrderTransactionScope,
  input: OrderCancellationInput,
): Promise<OrderCancellationOutcome> {
  const { id, reason, actorId, now, companyId } = input;

  const locked = await scope.orders.lockAliveLines(id, { companyId });
  if (locked === null) return 'not_found';
  const cancellable = locked.lines.filter((line) => isCancellableStatus(line.status));
  if (cancellable.length === 0) return 'not_cancellable';

  for (const line of cancellable) {
    await cancelLockedLine(scope, {
      orderId: id,
      lineId: line.id,
      reason,
      releaseReason: 'release',
      actorId,
      now,
      companyId,
    });
  }
  await scope.orders.refreshStatus(id, actorId, now, { companyId });
  return 'ok';
}

/** Cancelar un pedido vivo de una empresa, por encargo de otro modulo: no exige permiso ni
 *  valida el motivo, eso es de quien llama. */
export type OrderCancellation = {
  cancelAliveById(
    id: string,
    companyId: string,
    reason: string,
    actorId: string,
    now: Date,
  ): Promise<OrderCancellationOutcome>;
};

export type CancelAliveOrderDeps = {
  readonly unitOfWork: OrderUnitOfWork;
};

export function createCancelAliveOrder(deps: CancelAliveOrderDeps): OrderCancellation['cancelAliveById'] {
  return async function cancelAliveById(id, companyId, reason, actorId, now) {
    return deps.unitOfWork.run((scope) => cancelInsideTransaction(scope, { id, reason, actorId, now, companyId }));
  };
}
