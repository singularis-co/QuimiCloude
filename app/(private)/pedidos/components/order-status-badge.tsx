'use client';

import {
  ORDER_COVERAGE_LABELS,
  ORDER_PRIORITY_LABELS,
  ORDER_STATUS_LABELS,
} from '@/lib/shared/ui/order-status';
import { Badge } from '@/components/ui/badge';
import {
  ORDER_PRIORITY_VALUES,
  ORDER_STATUS_FLOW,
  type OrderPriority,
  type OrderStatus,
} from '@/lib/modules/pedidos';
import type { OrderCoverage } from '@/lib/modules/inventario';

export { ORDER_STATUS_LABELS, ORDER_PRIORITY_LABELS, ORDER_COVERAGE_LABELS };

/**
 * Variante visual por estado y por prioridad. Tambien exhaustivas: el color acompana a la
 * etiqueta, **nunca la sustituye** —el estado se lee, no se adivina por el tono—.
 */
type StatusTone = 'success' | 'warning' | 'destructive' | 'info' | 'neutral';

const STATUS_VARIANTS: Readonly<Record<OrderStatus, StatusTone>> = {
  PENDIENTE: 'neutral',
  EN_CURSO: 'info',
  POR_EMPACAR: 'warning',
  EN_EMPAQUE: 'info',
  ENTREGADO: 'success',
  CANCELADO: 'destructive',
  BLOQUEADO: 'destructive',
  POR_ACONDICIONAR: 'warning',
  EN_ACONDICIONAMIENTO: 'info',
  TERMINADO: 'success',
};

const PRIORITY_VARIANTS: Readonly<Record<OrderPriority, StatusTone>> = {
  BAJA: 'neutral',
  MEDIA: 'info',
  ALTA: 'warning',
  CRITICA: 'destructive',
};

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
    <Badge variant={STATUS_VARIANTS[status]} data-testid="order-status" data-status={status}>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}

export function OrderPriorityBadge({ priority }: { readonly priority: OrderPriority }) {
  return (
    <Badge variant={PRIORITY_VARIANTS[priority]} data-testid="order-priority" data-priority={priority}>
      {ORDER_PRIORITY_LABELS[priority]}
    </Badge>
  );
}

const COVERAGE_VARIANTS: Readonly<Record<OrderCoverage, StatusTone>> = {
  full: 'success',
  none: 'neutral',
  partial: 'warning',
};

export function OrderCoverageBadge({ coverage }: { readonly coverage: OrderCoverage }) {
  return (
    <Badge variant={COVERAGE_VARIANTS[coverage]} data-testid="order-coverage" data-coverage={coverage}>
      {ORDER_COVERAGE_LABELS[coverage]}
    </Badge>
  );
}
