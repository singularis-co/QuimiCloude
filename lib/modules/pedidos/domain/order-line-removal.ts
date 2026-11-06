import { OrderLineNotRemovableError } from './errors';
import type { OrderLineStatus } from './order-classification';

/** Mapa total: un estado nuevo no compila hasta decidir si su linea se puede quitar. */
const REMOVABLE = {
  PENDIENTE: true,
  BLOQUEADO: true,
  EN_CURSO: false,
  POR_EMPACAR: false,
  EN_EMPAQUE: false,
  POR_ACONDICIONAR: false,
  EN_ACONDICIONAMIENTO: false,
  TERMINADO: false,
  ENTREGADO: false,
  CANCELADO: false,
} as const satisfies Record<OrderLineStatus, boolean>;

export function isRemovableOrderLineStatus(status: OrderLineStatus): boolean {
  return REMOVABLE[status];
}

export function assertOrderLinesRemovable(
  lines: readonly { readonly id: string; readonly status: OrderLineStatus }[],
): void {
  const blocked = lines.find((line) => !isRemovableOrderLineStatus(line.status));
  if (blocked !== undefined) {
    throw new OrderLineNotRemovableError(`linea ${blocked.id} en ${blocked.status}`);
  }
}
