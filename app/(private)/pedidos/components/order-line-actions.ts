import {
  ORDER_STATUSES_NOT_IN_PROGRESS,
  isCancellableStatus,
  isDeletableOrder,
  type OrderLineStatus,
  type OrderStatus,
  type OrderView,
} from '@/lib/modules/pedidos';

/** Las acciones del menú que se hacen sobre una sola receta del pedido. */
export type LineActionKind = 'distribution' | 'deliver' | 'deliveries' | 'cancelLine';

export const LINE_ACTION_KINDS: readonly LineActionKind[] = [
  'distribution',
  'deliver',
  'deliveries',
  'cancelLine',
];

type LineLike = { readonly status: OrderLineStatus };
type OrderLike = Pick<OrderView, 'status'> & { readonly lines: readonly LineLike[] };

const LINE_ACCEPTS: Readonly<Record<LineActionKind, (status: OrderLineStatus) => boolean>> = {
  distribution: (status) => status === 'POR_EMPACAR',
  deliver: (status) => status === 'TERMINADO',
  deliveries: (status) => status === 'TERMINADO' || status === 'ENTREGADO',
  cancelLine: isCancellableStatus,
};

export const LINE_ACTION_DISABLED_REASONS: Readonly<Record<LineActionKind, string>> = {
  distribution: 'Solo Por empacar',
  deliver: 'Aún no está terminada',
  deliveries: 'Sin entregas',
  cancelLine: 'No se puede cancelar en este estado',
};

export function lineAcceptsAction(kind: LineActionKind, line: LineLike): boolean {
  return LINE_ACCEPTS[kind](line.status);
}

/** `null` si la receta admite la acción. */
export function lineActionDisabledReason(kind: LineActionKind, line: LineLike): string | null {
  return lineAcceptsAction(kind, line) ? null : LINE_ACTION_DISABLED_REASONS[kind];
}

export function orderOffersLineAction(kind: LineActionKind, order: Pick<OrderLike, 'lines'>): boolean {
  return order.lines.some((line) => lineAcceptsAction(kind, line));
}

export function canEditOrder(order: Pick<OrderLike, 'status'>): boolean {
  return !(ORDER_STATUSES_NOT_IN_PROGRESS as readonly OrderStatus[]).includes(order.status);
}

export function canCancelOrder(order: Pick<OrderLike, 'lines'>): boolean {
  return order.lines.some((line) => isCancellableStatus(line.status));
}

export function canDeleteOrder(order: OrderLike): boolean {
  return isDeletableOrder(order.status, order.lines);
}

// Copia de la regla de `asignaciones`, que no la publica: los estados en que admite escribir responsables.
const RESPONSIBLES_WRITABLE: Readonly<Record<OrderLineStatus, boolean>> = {
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
};

export function responsiblesFrozen(order: OrderLike): boolean {
  if (order.status === 'PARCIAL') {
    return !order.lines.some((line) => RESPONSIBLES_WRITABLE[line.status]);
  }
  return !RESPONSIBLES_WRITABLE[order.status];
}
