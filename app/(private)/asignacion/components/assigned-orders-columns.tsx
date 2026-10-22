'use client';

import type { DataTableColumn } from '@/components/shared/data-table';
import { PriorityMark } from '@/components/shared/priority-mark';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  ORDER_PRIORITY_LABELS,
  ORDER_PRIORITY_LEVELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
} from '@/lib/shared/ui/order-status';
import type { AssignedOrderView } from '@/lib/modules/asignaciones';

import { AssignedOrderEnterTrigger } from './assigned-order-enter-trigger';
import { assignmentActionsColumn } from './assignment-row-actions';
import {
  orderNumberColumn,
  presentationColumn,
  quantityColumn,
  recipeColumn,
  responsiblesColumn,
} from './assignment-list-parts';

export const ASSIGNED_ORDER_STATUS_LABELS: Readonly<Record<AssignedOrderView['status'], string>> =
  {
    PENDIENTE: ORDER_STATUS_LABELS.PENDIENTE,
    EN_CURSO: ORDER_STATUS_LABELS.EN_CURSO,
    BLOQUEADO: ORDER_STATUS_LABELS.BLOQUEADO,
  };

export const ASSIGNED_ORDER_PRIORITY_LABELS = ORDER_PRIORITY_LABELS;

export const ASSIGNED_ORDER_NUMBER_COLUMN_ID = 'orderNumber';
export const ASSIGNED_ORDER_RECIPE_NAME_COLUMN_ID = 'recipeName';
export const ASSIGNED_ORDER_QUANTITY_COLUMN_ID = 'quantity';
export const ASSIGNED_ORDER_PRESENTATION_COLUMN_ID = 'presentationName';
export const ASSIGNED_ORDER_PRIORITY_COLUMN_ID = 'priority';
export const ASSIGNED_ORDER_STATUS_COLUMN_ID = 'status';
export const ASSIGNED_ORDER_RESPONSIBLES_COLUMN_ID = 'responsibles';
export const ASSIGNED_ORDER_ENTER_COLUMN_ID = 'enter';

export type AssignedOrdersColumnsOptions = {
  /** Decidido en servidor; sin el, la columna «Entrar» no se emite. */
  readonly canExecute: boolean;
  /** Decidido en servidor; sin el, la columna de acciones no se emite: su menú quedaría vacío. */
  readonly canViewTrace?: boolean;
};

export function buildAssignedOrdersColumns({
  canExecute,
  canViewTrace = false,
}: AssignedOrdersColumnsOptions): readonly DataTableColumn<AssignedOrderView>[] {
  const columns: DataTableColumn<AssignedOrderView>[] = [
    orderNumberColumn(ASSIGNED_ORDER_NUMBER_COLUMN_ID),
    recipeColumn(ASSIGNED_ORDER_RECIPE_NAME_COLUMN_ID, 'assigned-order'),
    quantityColumn(ASSIGNED_ORDER_QUANTITY_COLUMN_ID, (quantity) => quantity),
    presentationColumn(ASSIGNED_ORDER_PRESENTATION_COLUMN_ID),
    {
      id: ASSIGNED_ORDER_PRIORITY_COLUMN_ID,
      label: 'Prioridad',
      align: 'start',
      cell: (order) => (
        <PriorityMark
          level={ORDER_PRIORITY_LEVELS[order.priority]}
          label={ASSIGNED_ORDER_PRIORITY_LABELS[order.priority]}
          data-testid="assigned-order-priority"
          data-priority={order.priority}
        />
      ),
    },
    {
      id: ASSIGNED_ORDER_STATUS_COLUMN_ID,
      label: 'Estado',
      align: 'start',
      cell: (order) => (
        <StatusBadge
          tone={ORDER_STATUS_TONES[order.status]}
          label={ASSIGNED_ORDER_STATUS_LABELS[order.status]}
          data-testid="assigned-order-status"
          data-status={order.status}
        />
      ),
    },
    responsiblesColumn(ASSIGNED_ORDER_RESPONSIBLES_COLUMN_ID, (order) => order.otherResponsibles),
  ];

  if (canExecute) {
    columns.push({
      id: ASSIGNED_ORDER_ENTER_COLUMN_ID,
      label: 'Entrar',
      align: 'end',
      pinnable: false,
      cell: (order) => <AssignedOrderEnterTrigger order={order} />,
    });
  }

  if (canViewTrace) {
    columns.push(assignmentActionsColumn<AssignedOrderView>({ canViewTrace }));
  }

  return columns;
}
