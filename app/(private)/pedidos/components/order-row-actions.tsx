'use client';

import {
  ClipboardListIcon,
  PackageIcon,
  PencilIcon,
  TrashIcon,
  TruckIcon,
  UserIcon,
  UsersIcon,
  XCircleIcon,
} from 'lucide-react';

import type { RowActionsSpec } from '@/components/shared/data-table';
import {
  RowActionsMenu,
  type RowActionMenuItem,
  type RowActionsMenuProps,
} from '@/components/shared/row-actions-menu';
import { type OrderStatus, type OrderSummary } from '@/lib/modules/pedidos';

/**
 * Las acciones de fila de un pedido: editar, cancelar, borrar, responsables y, cuando aplica,
 * reparto y unidad (R23, R24, `design.md > 8`).
 *
 * **Decision humana puntual (pedida por chat, solo para esta pantalla):** las acciones ya no son
 * botones en linea, sino items de un menu "de los 3 puntos" (`RowActionsMenu`,
 * `components/shared/row-actions-menu.tsx`), mismo criterio que adopto `UserRowActions`. R45
 * sigue exigiendo que nada se descubra con `:hover` y que cada control mida 44x44 px, y eso se
 * sigue cumpliendo: el DISPARADOR del menu esta siempre visible y siempre en el DOM, con su
 * propio objetivo tactil. Lo que cambia es que las acciones individuales viven dentro del menu
 * que ese disparador abre con un clic, no como controles sueltos. No es una derogacion general de
 * R45 para el resto del repo: las demas pantallas con botones en linea siguen con ellos.
 *
 * **Decision humana puntual (2026-10-04):** los items del menu dicen solo el verbo, sin el numero
 * del pedido. El contexto de la fila lo conserva el nombre accesible del disparador.
 *
 * **La fila llega por props** (R43). Este componente no importa `lib/composition`, ni el cliente
 * de base de datos, ni pide nada por su cuenta: lo que muestra ya lo trajo la consulta de la
 * lista, hecha una sola vez por el Server Component de la seccion.
 *
 * **QC-102 T13 — la accion «Responsables», NO se deshabilita en estado final** (QC-102 R24,
 * `design.md > 3.2`). Las otras cambian el pedido y por eso mueren con el; esta solo ABRE el
 * panel en su seccion para VER quien lo preparo, y eso QC-87 R13 lo permite en los cuatro
 * estados. Lo que desaparece dentro del panel son los controles de escritura (QC-102 R29), no la
 * puerta al dato: de responsables no dice nada.
 *
 * **Un solo predicado para el estado final** (`isFinalOrderStatus`): con el pedido en
 * `ENTREGADO`, `CANCELADO`, `POR_EMPACAR`, `EN_EMPAQUE`, en cualquiera de los estados de
 * acondicionamiento (`POR_ACONDICIONAR`, `EN_ACONDICIONAMIENTO`) o en `TERMINADO` (el estado
 * que sigue a terminar el acondicionamiento) los items de editar/cancelar/borrar van `disabled`
 * dentro del menu, sin ningun texto aparte que lo explique, y **no se monta ningun dialogo**.
 * La pantalla anticipa la regla; el backend la impide igual (`invalid_transition`,
 * `not_cancellable`, `not_deletable`), asi que anticipar no es confiar.
 *
 * **`BLOQUEADO` NO es final** (QC-138): un pedido sin material se edita y se cancela como uno
 * `PENDIENTE`, y bajar su cantidad puede bastar para desbloquearlo. Lo que no admite es el
 * trabajo, y eso lo rechazan el backend y la lista del Operador, no este menu.
 *
 * **Reparto y unidad**: item condicional. Solo aparece si `canEditDistribution`
 * -lo decide el servidor con el permiso de modificar pedidos- Y el estado admite esa edicion
 * acotada (`acceptsDistributionEdit`). Antes de `POR_EMPACAR` la edicion general ya cubre reparto
 * y unidad; desde `EN_EMPAQUE` el reparto queda fijado; en `BLOQUEADO` la edicion general sigue
 * abierta y ya los cubre.
 *
 * **Los items emiten `onAction` con la accion y el pedido entero.** Quien compone la tabla decide
 * que panel o dialogo abre. Con el pedido en estado final, el item va `disabled` y el primitivo
 * del menu no llega a invocar su `onSelect`.
 */

/**
 * Que estados del contrato ya no admiten editar, cancelar ni borrar. Mapa exhaustivo y tipado
 * —no una comparacion suelta contra los literales— para que un estado nuevo rompa el
 * `typecheck` en vez de colarse como «editable» por defecto. `POR_EMPACAR` y `EN_EMPAQUE` ya
 * consumieron material y dieron de alta un lote: se cierran igual que `ENTREGADO`.
 *
 * `BLOQUEADO` NO es final: ver el comentario de cabecera.
 */
const ORDER_STATUS_IS_FINAL: Readonly<Record<OrderStatus, boolean>> = {
  PENDIENTE: false,
  EN_CURSO: false,
  POR_EMPACAR: true,
  EN_EMPAQUE: true,
  ENTREGADO: true,
  CANCELADO: true,
  BLOQUEADO: false,
  POR_ACONDICIONAR: true,
  EN_ACONDICIONAMIENTO: true,
  TERMINADO: true,
};

/**
 * El unico predicado de estado final de la pantalla (`design.md > 8`). Se exporta para que
 * ningun otro archivo vuelva a escribir la comparacion: dos definiciones del mismo predicado es
 * como acaban divergiendo.
 */
export function isFinalOrderStatus(status: OrderStatus): boolean {
  return ORDER_STATUS_IS_FINAL[status];
}

/**
 * Estados en que solo cabe la edicion acotada de reparto y unidad (QC-170). Antes de
 * `POR_EMPACAR` la edicion general ya cubre los dos campos; desde `EN_EMPAQUE` el reparto queda
 * fijado.
 */
const ORDER_STATUS_ACCEPTS_DISTRIBUTION_EDIT: Readonly<Record<OrderStatus, boolean>> = {
  PENDIENTE: false,
  EN_CURSO: false,
  POR_EMPACAR: true,
  EN_EMPAQUE: false,
  ENTREGADO: false,
  CANCELADO: false,
  // La edicion general sigue abierta en BLOQUEADO y ya cubre reparto y unidad.
  BLOQUEADO: false,
  POR_ACONDICIONAR: false,
  EN_ACONDICIONAMIENTO: false,
  TERMINADO: false,
};

export function acceptsDistributionEdit(status: OrderStatus): boolean {
  return ORDER_STATUS_ACCEPTS_DISTRIBUTION_EDIT[status];
}

// No reutiliza `ORDER_STATUS_IS_FINAL`: los estados de acondicionamiento y `TERMINADO` cierran la
// edicion pero siguen aceptando el cambio de cliente.
const ORDER_STATUS_ACCEPTS_CUSTOMER_CHANGE: Readonly<Record<OrderStatus, boolean>> = {
  PENDIENTE: true,
  EN_CURSO: true,
  POR_EMPACAR: true,
  EN_EMPAQUE: true,
  ENTREGADO: false,
  CANCELADO: false,
  BLOQUEADO: true,
  POR_ACONDICIONAR: true,
  EN_ACONDICIONAMIENTO: true,
  TERMINADO: true,
};

const ORDER_STATUS_ACCEPTS_DELIVERY: Readonly<Record<OrderStatus, boolean>> = {
  PENDIENTE: false,
  EN_CURSO: false,
  POR_EMPACAR: false,
  EN_EMPAQUE: false,
  ENTREGADO: false,
  CANCELADO: false,
  BLOQUEADO: false,
  POR_ACONDICIONAR: false,
  EN_ACONDICIONAMIENTO: false,
  TERMINADO: true,
};

export function acceptsDelivery(status: OrderStatus): boolean {
  return ORDER_STATUS_ACCEPTS_DELIVERY[status];
}

// No pide permiso propio: ver la lista ya lo cubre el permiso de consultar la pantalla.
const ORDER_STATUS_HAS_DELIVERIES: Readonly<Record<OrderStatus, boolean>> = {
  PENDIENTE: false,
  EN_CURSO: false,
  POR_EMPACAR: false,
  EN_EMPAQUE: false,
  ENTREGADO: true,
  CANCELADO: false,
  BLOQUEADO: false,
  POR_ACONDICIONAR: false,
  EN_ACONDICIONAMIENTO: false,
  TERMINADO: true,
};

export const ORDER_ACTION_DISTRIBUTION_TESTID = 'order-action-distribution';
export const ORDER_ACTION_DELIVER_TESTID = 'order-action-deliver';
export const ORDER_ACTION_CUSTOMER_TESTID = 'order-action-customer';
export const ORDER_ACTION_DELIVERIES_TESTID = 'order-action-deliveries';

export type OrderRowAction =
  | 'edit'
  | 'responsibles'
  | 'customer'
  | 'distribution'
  | 'deliveries'
  | 'deliver'
  | 'cancel'
  | 'delete';

export type OrderRowActionsSpecInput = {
  readonly order: OrderSummary;
  readonly canEditDistribution: boolean;
  readonly canEditCustomer: boolean;
  readonly canDeliver: boolean;
  readonly onAction: (action: OrderRowAction, order: OrderSummary) => void;
};

// `RowActionsMenu` recibe la especificación por propagación, así que `data-order-id` llega al
// disparador tanto en la fila como en la tarjeta.
export type OrderRowActionsSpec = RowActionsSpec & Pick<RowActionsMenuProps, 'triggerDataAttributes'>;

export function orderRowActionsSpec({
  order,
  canEditDistribution,
  canEditCustomer,
  canDeliver,
  onAction,
}: OrderRowActionsSpecInput): OrderRowActionsSpec {
  const isFinal = isFinalOrderStatus(order.status);
  const emit = (action: OrderRowAction) => () => onAction(action, order);

  const items: RowActionMenuItem[] = [
    {
      key: 'edit',
      label: 'Editar',
      icon: PencilIcon,
      onSelect: emit('edit'),
      disabled: isFinal,
      testId: 'order-action-edit',
    },
    // Sin `disabled`: ver quién prepara un pedido no lo modifica, así que sigue abierto en estado final.
    {
      key: 'responsibles',
      label: 'Responsables',
      icon: UsersIcon,
      onSelect: emit('responsibles'),
      testId: 'order-action-responsibles',
    },
  ];

  if (canEditCustomer) {
    items.push({
      key: 'customer',
      label: 'Cliente',
      icon: UserIcon,
      onSelect: emit('customer'),
      disabled: !ORDER_STATUS_ACCEPTS_CUSTOMER_CHANGE[order.status],
      testId: ORDER_ACTION_CUSTOMER_TESTID,
    });
  }

  if (canEditDistribution && acceptsDistributionEdit(order.status)) {
    items.push({
      key: 'distribution',
      label: 'Reparto y unidad',
      icon: PackageIcon,
      onSelect: emit('distribution'),
      testId: ORDER_ACTION_DISTRIBUTION_TESTID,
    });
  }

  if (ORDER_STATUS_HAS_DELIVERIES[order.status]) {
    items.push({
      key: 'deliveries',
      label: 'Entregas',
      icon: ClipboardListIcon,
      onSelect: emit('deliveries'),
      testId: ORDER_ACTION_DELIVERIES_TESTID,
    });
  }

  if (canDeliver && acceptsDelivery(order.status)) {
    items.push({
      key: 'deliver',
      label: 'Entregar',
      icon: TruckIcon,
      onSelect: emit('deliver'),
      testId: ORDER_ACTION_DELIVER_TESTID,
    });
  }

  items.push(
    {
      key: 'cancel',
      label: 'Cancelar',
      icon: XCircleIcon,
      onSelect: emit('cancel'),
      disabled: isFinal,
      destructive: true,
      separatorBefore: true,
      testId: 'order-action-cancel',
    },
    {
      key: 'delete',
      label: 'Eliminar',
      icon: TrashIcon,
      onSelect: emit('delete'),
      disabled: isFinal,
      destructive: true,
      testId: 'order-action-delete',
    },
  );

  return {
    items,
    triggerLabel: `Acciones del pedido ${order.numberText}`,
    triggerTestId: 'order-row-actions',
    triggerDataAttributes: { 'data-order-id': order.id },
    title: `Pedido ${order.numberText}`,
  };
}

export type OrderRowActionsProps = {
  readonly order: OrderSummary;
  readonly onAction?: (action: OrderRowAction, order: OrderSummary) => void;
  readonly onEdit?: (order: OrderSummary) => void;
  readonly onCancel?: (order: OrderSummary) => void;
  readonly onDelete?: (order: OrderSummary) => void;
  readonly onResponsibles?: (order: OrderSummary) => void;
  /** Lo decide el servidor con el permiso de modificar pedidos; sin el, la accion no se pinta. */
  readonly canEditDistribution?: boolean;
  readonly onDistribution?: (order: OrderSummary) => void;
  /** Lo decide el servidor con el permiso de modificar pedidos; sin el, la accion no se pinta. */
  readonly canEditCustomer?: boolean;
  readonly onCustomer?: (order: OrderSummary) => void;
  /** Lo decide el servidor con el permiso de entregas; sin el, la accion no se pinta. */
  readonly canDeliver?: boolean;
  readonly onDeliver?: (order: OrderSummary) => void;
  readonly onDeliveries?: (order: OrderSummary) => void;
};

export function OrderRowActions({
  order,
  onAction,
  onEdit,
  onCancel,
  onDelete,
  onResponsibles,
  canEditDistribution = false,
  onDistribution,
  canEditCustomer = false,
  onCustomer,
  canDeliver = false,
  onDeliver,
  onDeliveries,
}: OrderRowActionsProps) {
  const handlers: Readonly<Record<OrderRowAction, ((order: OrderSummary) => void) | undefined>> = {
    edit: onEdit,
    responsibles: onResponsibles,
    customer: onCustomer,
    distribution: onDistribution,
    deliveries: onDeliveries,
    deliver: onDeliver,
    cancel: onCancel,
    delete: onDelete,
  };

  return (
    <RowActionsMenu
      {...orderRowActionsSpec({
        order,
        canEditDistribution,
        canEditCustomer,
        canDeliver,
        onAction: (action, target) => {
          onAction?.(action, target);
          handlers[action]?.(target);
        },
      })}
    />
  );
}
