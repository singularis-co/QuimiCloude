'use client';

import {
  BanIcon,
  ClipboardListIcon,
  EyeIcon,
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

import {
  canCancelOrder,
  canDeleteOrder,
  canEditOrder,
  orderOffersLineAction,
  type LineActionKind,
} from './order-line-actions';

/**
 * Las acciones de fila de un pedido, en el menú de los tres puntos (`RowActionsMenu`), en tres
 * grupos: las del pedido, las de una receta y las del pedido entero. La fila llega por props: este
 * componente no pide nada por su cuenta.
 *
 * Las acciones de una receta se pintan si el permiso lo deja y alguna receta del pedido las admite;
 * cuál de las recetas, lo dice después el selector. La pantalla anticipa las reglas del servidor,
 * que las impide igual.
 */

// Los estados de acondicionamiento y `TERMINADO` cierran la edición pero siguen aceptando el cambio
// de cliente.
const ORDER_STATUS_ACCEPTS_CUSTOMER_CHANGE: Readonly<Record<OrderStatus, boolean>> = {
  PARCIAL: true,
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

export const ORDER_ACTION_DETAIL_TESTID = 'order-action-detail';
export const ORDER_ACTION_DISTRIBUTION_TESTID = 'order-action-distribution';
export const ORDER_ACTION_DELIVER_TESTID = 'order-action-deliver';
export const ORDER_ACTION_CUSTOMER_TESTID = 'order-action-customer';
export const ORDER_ACTION_DELIVERIES_TESTID = 'order-action-deliveries';
export const ORDER_ACTION_CANCEL_LINE_TESTID = 'order-action-cancel-line';

export type OrderRowAction =
  | 'detail'
  | 'edit'
  | 'responsibles'
  | 'customer'
  | LineActionKind
  | 'cancel'
  | 'delete';

export const ORDER_ROW_ACTION_LABELS: Readonly<Record<OrderRowAction, string>> = {
  detail: 'Ver detalle',
  edit: 'Editar',
  responsibles: 'Responsables',
  customer: 'Cliente',
  distribution: 'Reparto y unidad…',
  deliver: 'Entregar…',
  deliveries: 'Entregas…',
  cancelLine: 'Cancelar receta…',
  cancel: 'Cancelar pedido',
  delete: 'Eliminar',
};

export const ORDER_ROW_ACTION_GROUPS = {
  line: 'Por receta',
  wholeOrder: 'Pedido entero',
} as const;

export type OrderRowActionsSpecInput = {
  readonly order: OrderSummary;
  readonly canEditDistribution: boolean;
  readonly canEditCustomer: boolean;
  readonly canDeliver: boolean;
  /** Lo decide el servidor con el permiso de modificar pedidos; sin él, «Cancelar receta…» no se pinta. */
  readonly canCancelLine?: boolean;
  readonly onAction: (action: OrderRowAction, order: OrderSummary) => void;
  readonly labels?: Partial<Readonly<Record<OrderRowAction, string>>>;
};

// `RowActionsMenu` recibe la especificación por propagación, así que `data-order-id` llega al
// disparador tanto en la fila como en la tarjeta.
export type OrderRowActionsSpec = RowActionsSpec & Pick<RowActionsMenuProps, 'triggerDataAttributes'>;

type LineItem = Omit<RowActionMenuItem, 'onSelect' | 'href' | 'key'> & { readonly key: LineActionKind };

export function orderRowActionsSpec({
  order,
  canEditDistribution,
  canEditCustomer,
  canDeliver,
  canCancelLine = false,
  onAction,
  labels: labelsOverride,
}: OrderRowActionsSpecInput): OrderRowActionsSpec {
  const labels = { ...ORDER_ROW_ACTION_LABELS, ...labelsOverride };
  const emit = (action: OrderRowAction) => () => onAction(action, order);

  const items: RowActionMenuItem[] = [
    {
      key: 'detail',
      label: labels.detail,
      icon: EyeIcon,
      onSelect: emit('detail'),
      testId: ORDER_ACTION_DETAIL_TESTID,
    },
    {
      key: 'edit',
      label: labels.edit,
      icon: PencilIcon,
      onSelect: emit('edit'),
      disabled: !canEditOrder(order),
      testId: 'order-action-edit',
    },
    // Sin `disabled`: ver quién prepara un pedido no lo modifica.
    {
      key: 'responsibles',
      label: labels.responsibles,
      icon: UsersIcon,
      onSelect: emit('responsibles'),
      testId: 'order-action-responsibles',
    },
  ];

  if (canEditCustomer) {
    items.push({
      key: 'customer',
      label: labels.customer,
      icon: UserIcon,
      onSelect: emit('customer'),
      disabled: !ORDER_STATUS_ACCEPTS_CUSTOMER_CHANGE[order.status],
      testId: ORDER_ACTION_CUSTOMER_TESTID,
    });
  }

  const lineItems: LineItem[] = [];
  if (canEditDistribution && orderOffersLineAction('distribution', order)) {
    lineItems.push({
      key: 'distribution',
      label: labels.distribution,
      icon: PackageIcon,
      testId: ORDER_ACTION_DISTRIBUTION_TESTID,
    });
  }
  if (canDeliver && orderOffersLineAction('deliver', order)) {
    lineItems.push({
      key: 'deliver',
      label: labels.deliver,
      icon: TruckIcon,
      testId: ORDER_ACTION_DELIVER_TESTID,
    });
  }
  if (orderOffersLineAction('deliveries', order)) {
    lineItems.push({
      key: 'deliveries',
      label: labels.deliveries,
      icon: ClipboardListIcon,
      testId: ORDER_ACTION_DELIVERIES_TESTID,
    });
  }
  if (canCancelLine && orderOffersLineAction('cancelLine', order)) {
    lineItems.push({
      key: 'cancelLine',
      label: labels.cancelLine,
      icon: BanIcon,
      destructive: true,
      testId: ORDER_ACTION_CANCEL_LINE_TESTID,
    });
  }
  lineItems.forEach((item, index) => {
    items.push({
      ...item,
      onSelect: emit(item.key),
      ...(index === 0 ? { separatorBefore: true, groupLabel: ORDER_ROW_ACTION_GROUPS.line } : {}),
    });
  });

  items.push(
    {
      key: 'cancel',
      label: labels.cancel,
      icon: XCircleIcon,
      onSelect: emit('cancel'),
      disabled: !canCancelOrder(order),
      destructive: true,
      separatorBefore: true,
      groupLabel: ORDER_ROW_ACTION_GROUPS.wholeOrder,
      testId: 'order-action-cancel',
    },
    {
      key: 'delete',
      label: labels.delete,
      icon: TrashIcon,
      onSelect: emit('delete'),
      disabled: !canDeleteOrder(order),
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
  /** Lo decide el servidor con el permiso de modificar pedidos; sin él, la acción no se pinta. */
  readonly canEditDistribution?: boolean;
  /** Lo decide el servidor con el permiso de modificar pedidos; sin él, la acción no se pinta. */
  readonly canEditCustomer?: boolean;
  /** Lo decide el servidor con el permiso de entregas; sin él, la acción no se pinta. */
  readonly canDeliver?: boolean;
  /** Lo decide el servidor con el permiso de modificar pedidos; sin él, la acción no se pinta. */
  readonly canCancelLine?: boolean;
};

function ignoreAction(): void {}

export function OrderRowActions({
  order,
  onAction = ignoreAction,
  canEditDistribution = false,
  canEditCustomer = false,
  canDeliver = false,
  canCancelLine = false,
}: OrderRowActionsProps) {
  return (
    <RowActionsMenu
      {...orderRowActionsSpec({
        order,
        canEditDistribution,
        canEditCustomer,
        canDeliver,
        canCancelLine,
        onAction,
      })}
    />
  );
}
