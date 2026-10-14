'use client';

import {
  ORDER_COVERAGE_LABELS,
  ORDER_COVERAGE_TONES,
  ORDER_PRIORITY_LABELS,
  ORDER_PRIORITY_LEVELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
} from '@/lib/shared/ui/order-status';
import { PriorityMark } from '@/components/shared/priority-mark';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  ORDER_PRIORITY_VALUES,
  ORDER_STATUS_FLOW,
  type OrderPriority,
  type OrderStatus,
} from '@/lib/modules/pedidos';
import type { OrderCoverage } from '@/lib/modules/inventario';

export { ORDER_STATUS_LABELS, ORDER_PRIORITY_LABELS, ORDER_COVERAGE_LABELS };

/**
 * Opciones de un filtro de seleccion, derivadas del conjunto cerrado del contrato (R14). Se
 * exportan ya construidas para que la declaracion de columnas no vuelva a recorrer los valores
 * ni a decidir como se leen.
 */
export const ORDER_STATUS_FILTER_OPTIONS: readonly { value: string; label: string }[] =
  ORDER_STATUS_FLOW.map((value) => ({ value, label: ORDER_STATUS_LABELS[value] }));

export const ORDER_PRIORITY_FILTER_OPTIONS: readonly { value: string; label: string }[] =
  ORDER_PRIORITY_VALUES.map((value) => ({ value, label: ORDER_PRIORITY_LABELS[value] }));

export function OrderStatusBadge({ status }: { readonly status: OrderStatus }) {
  return (
    <StatusBadge
      tone={ORDER_STATUS_TONES[status]}
      label={ORDER_STATUS_LABELS[status]}
      data-testid="order-status"
      data-status={status}
    />
  );
}

export function OrderPriorityBadge({ priority }: { readonly priority: OrderPriority }) {
  return (
    <PriorityMark
      level={ORDER_PRIORITY_LEVELS[priority]}
      label={ORDER_PRIORITY_LABELS[priority]}
      data-testid="order-priority"
      data-priority={priority}
    />
  );
}

export function OrderCoverageBadge({ coverage }: { readonly coverage: OrderCoverage }) {
  return (
    <StatusBadge
      tone={ORDER_COVERAGE_TONES[coverage]}
      label={ORDER_COVERAGE_LABELS[coverage]}
      data-testid="order-coverage"
      data-coverage={coverage}
    />
  );
}
