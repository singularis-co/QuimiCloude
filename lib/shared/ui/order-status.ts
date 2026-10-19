import type { StatusTone } from './status-tone';

// Claves propias: lib/shared no importa dominio. El test del mapa comprueba que coinciden con
// los tipos de pedidos e inventario en los dos sentidos.
export type OrderStatusKey =
  | 'PENDIENTE'
  | 'EN_CURSO'
  | 'POR_EMPACAR'
  | 'EN_EMPAQUE'
  | 'ENTREGADO'
  | 'CANCELADO'
  | 'BLOQUEADO'
  | 'POR_ACONDICIONAR'
  | 'EN_ACONDICIONAMIENTO'
  | 'TERMINADO';

export type OrderPriorityKey = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';

export type OrderCoverageKey = 'full' | 'none' | 'partial';

type PriorityLevel = 1 | 2 | 3 | 4;

export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatusKey, string>> = {
  PENDIENTE: 'Pendiente',
  EN_CURSO: 'En fabricación',
  POR_EMPACAR: 'Por empacar',
  EN_EMPAQUE: 'En empaque',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
  BLOQUEADO: 'Bloqueado',
  POR_ACONDICIONAR: 'Por acondicionar',
  EN_ACONDICIONAMIENTO: 'En acondicionamiento',
  TERMINADO: 'Terminado',
};

export const ORDER_STATUS_TONES: Readonly<Record<OrderStatusKey, StatusTone>> = {
  PENDIENTE: 'neutral',
  EN_CURSO: 'progress',
  POR_EMPACAR: 'waiting',
  EN_EMPAQUE: 'progress',
  ENTREGADO: 'success',
  CANCELADO: 'muted',
  BLOQUEADO: 'danger',
  POR_ACONDICIONAR: 'waiting',
  EN_ACONDICIONAMIENTO: 'progress',
  TERMINADO: 'success',
};

export const ORDER_PRIORITY_LABELS: Readonly<Record<OrderPriorityKey, string>> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
};

export const ORDER_PRIORITY_LEVELS: Readonly<Record<OrderPriorityKey, PriorityLevel>> = {
  BAJA: 1,
  MEDIA: 2,
  ALTA: 3,
  CRITICA: 4,
};

// `ENTREGADO` y `CANCELADO` llegan con `coverage: 'none'` y se leen «Sin apartar», no con un guion:
// el dato sigue siendo consultable aunque el pedido ya no admita cambios.
export const ORDER_COVERAGE_LABELS: Readonly<Record<OrderCoverageKey, string>> = {
  full: 'Apartado',
  none: 'Sin apartar',
  partial: 'Sin cobertura completa',
};

export const ORDER_COVERAGE_TONES: Readonly<Record<OrderCoverageKey, StatusTone>> = {
  full: 'success',
  none: 'neutral',
  partial: 'waiting',
};
