'use client';

import type { DataTableColumn } from '@/components/shared/data-table';
import type { FinishedOrderView } from '@/lib/modules/asignaciones';
import { conditioningOrderRoute } from '@/lib/shared/routes';

import { assignmentActionsColumn } from './assignment-row-actions';
import { buildFinishedOrdersColumns } from './finished-orders-columns';

export type ConditionedOrdersColumnsOptions = {
  readonly canViewTrace?: boolean;
};

/**
 * Las columnas de datos son las de «Terminados» del Empacador, para que cambien a la vez; solo se
 * añade el menú, que lleva al detalle.
 */
export function buildConditionedOrdersColumns({
  canViewTrace = false,
}: ConditionedOrdersColumnsOptions = {}): readonly DataTableColumn<FinishedOrderView>[] {
  return [
    ...buildFinishedOrdersColumns(),
    assignmentActionsColumn<FinishedOrderView>({
      canViewTrace,
      enterHref: (order) => conditioningOrderRoute(order.id),
    }),
  ];
}
