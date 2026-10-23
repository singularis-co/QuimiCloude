'use client';

import type { DataTableCardLayout, DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import type { ConditioningOrderRow } from '@/lib/modules/asignaciones';
import { conditioningOrderRoute } from '@/lib/shared/routes';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from '@/lib/shared/ui/order-status';

import { MissingValue } from './assignment-list-parts';
import { assignmentActionsColumn } from './assignment-row-actions';
import { OrderDistributionFull } from './order-distribution-full';

/**
 * Las cinco columnas de «Por acondicionar»: número, receta, envases -el reparto entero, no un
 * total-, estado y quién acondiciona, vacío mientras nadie lo ha tomado; y el menú, que lleva al
 * detalle.
 */

export const CONDITIONING_ORDER_NUMBER_COLUMN_ID = 'orderNumber';
export const CONDITIONING_ORDER_RECIPE_NAME_COLUMN_ID = 'recipeName';
export const CONDITIONING_ORDER_PACKAGES_COLUMN_ID = 'packages';
export const CONDITIONING_ORDER_STATUS_COLUMN_ID = 'status';
export const CONDITIONING_ORDER_CONDITIONER_COLUMN_ID = 'conditionedByName';

export const CONDITIONING_ORDERS_CARD: DataTableCardLayout = {
  primary: CONDITIONING_ORDER_NUMBER_COLUMN_ID,
  status: CONDITIONING_ORDER_STATUS_COLUMN_ID,
  title: CONDITIONING_ORDER_RECIPE_NAME_COLUMN_ID,
  meta: [CONDITIONING_ORDER_PACKAGES_COLUMN_ID, CONDITIONING_ORDER_CONDITIONER_COLUMN_ID],
};

export type ConditioningOrdersColumnsOptions = {
  readonly canViewTrace?: boolean;
};

export function buildConditioningOrdersColumns({
  canViewTrace = false,
}: ConditioningOrdersColumnsOptions = {}): readonly DataTableColumn<ConditioningOrderRow>[] {
  return [
    {
      id: CONDITIONING_ORDER_NUMBER_COLUMN_ID,
      label: 'Nº de pedido',
      align: 'start',
      cell: (order) => order.numberText,
    },
    {
      id: CONDITIONING_ORDER_RECIPE_NAME_COLUMN_ID,
      label: 'Fórmula',
      align: 'start',
      cell: (order) =>
        order.recipeName ?? <MissingValue testIdPrefix="conditioning-order" field={CONDITIONING_ORDER_RECIPE_NAME_COLUMN_ID} />,
    },
    {
      id: CONDITIONING_ORDER_PACKAGES_COLUMN_ID,
      label: 'Envases',
      tabular: true,
      align: 'start',
      cell: (order) => <OrderDistributionFull lines={order.presentationLines} />,
    },
    {
      id: CONDITIONING_ORDER_STATUS_COLUMN_ID,
      label: 'Estado',
      align: 'start',
      cell: (order) => (
        <StatusBadge
          tone={ORDER_STATUS_TONES[order.status]}
          label={ORDER_STATUS_LABELS[order.status]}
          data-testid="conditioning-order-status"
          data-status={order.status}
        />
      ),
    },
    {
      id: CONDITIONING_ORDER_CONDITIONER_COLUMN_ID,
      label: 'Quién acondiciona',
      align: 'start',
      cell: (order) =>
        order.conditionedByName ?? (
          <MissingValue testIdPrefix="conditioning-order" field={CONDITIONING_ORDER_CONDITIONER_COLUMN_ID} />
        ),
    },
    assignmentActionsColumn<ConditioningOrderRow>({
      canViewTrace,
      enterHref: (order) => conditioningOrderRoute(order.id),
    }),
  ];
}
