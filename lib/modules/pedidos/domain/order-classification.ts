// lib/modules/pedidos/domain/order-classification.ts
/** Los estados, EN SU ORDEN DE DECLARACION del esquema. El dominio NO puede importar
 *  `@prisma/client` (`docs/architecture.md > La regla de dependencias`), asi que estos valores
 *  son un DUPLICADO del `enum OrderStatus` de `db/schema.prisma`. Es el punto fragil del
 *  modulo: `module-contract.test.ts` lee el esquema y compara las dos listas, valor a valor y
 *  en orden.
 *
 *  El orden es el que usa Postgres al ordenar por estado: `PARCIAL` va el primero con
 *  `ALTER TYPE ... ADD VALUE ... BEFORE`, que no recrea el tipo. Para pintar en el orden del
 *  flujo de trabajo existe `ORDER_STATUS_FLOW`, mas abajo. */
export const ORDER_STATUS_VALUES = [
  'PARCIAL',
  'PENDIENTE',
  'EN_CURSO',
  'ENTREGADO',
  'CANCELADO',
  'POR_EMPACAR',
  'EN_EMPAQUE',
  'BLOQUEADO',
  'POR_ACONDICIONAR',
  'EN_ACONDICIONAMIENTO',
  'TERMINADO',
] as const;
export type OrderStatus = (typeof ORDER_STATUS_VALUES)[number];

/** El estado de una linea del pedido: `PARCIAL` solo describe al pedido entero. */
export type OrderLineStatus = Exclude<OrderStatus, 'PARCIAL'>;

// Un pedido sin borrar en cualquier otro estado sigue en curso: `TERMINADO` y `BLOQUEADO` cuentan
// porque todavia no se entregaron.
export const ORDER_STATUSES_NOT_IN_PROGRESS = [
  'ENTREGADO',
  'CANCELADO',
] as const satisfies readonly OrderStatus[];

// Desde Comenzar el estimado queda congelado: ningun escritor del importe estimado acepta un pedido
// en uno de estos estados.
export const STARTED_ORDER_STATUSES = [
  'EN_CURSO',
  'POR_EMPACAR',
  'EN_EMPAQUE',
  'POR_ACONDICIONAR',
  'EN_ACONDICIONAMIENTO',
  'TERMINADO',
  'ENTREGADO',
] as const satisfies readonly OrderStatus[];

export function isStartedOrderStatus(status: OrderStatus): boolean {
  return (STARTED_ORDER_STATUSES as readonly OrderStatus[]).includes(status);
}

/** El mismo conjunto, en el orden del FLUJO de trabajo, con `CANCELADO` y `BLOQUEADO` al final
 *  porque no son pasos del flujo sino salidas laterales. Lo usan las pantallas que pintan filtros
 *  o columnas de estado; ninguna lectura de la base ni ninguna regla de transicion depende de este
 *  orden. */
export const ORDER_STATUS_FLOW: readonly OrderStatus[] = [
  'PARCIAL',
  'PENDIENTE',
  'EN_CURSO',
  'POR_EMPACAR',
  'EN_EMPAQUE',
  'POR_ACONDICIONAR',
  'EN_ACONDICIONAMIENTO',
  'TERMINADO',
  'ENTREGADO',
  'CANCELADO',
  'BLOQUEADO',
];

/** Las cuatro prioridades, DE MENOR A MAYOR. El orden es el dato: es lo que fijo la decision
 *  cerrada 4 y lo que ordena Postgres al comparar dos valores del enum. */
export const ORDER_PRIORITY_VALUES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const;
export type OrderPriority = (typeof ORDER_PRIORITY_VALUES)[number];

/** Los dos defectos, tambien duplicados del esquema (`@default`) y tambien vigilados por R35. */
export const DEFAULT_ORDER_STATUS: OrderStatus = 'PENDIENTE';
export const DEFAULT_ORDER_PRIORITY: OrderPriority = 'BAJA';
