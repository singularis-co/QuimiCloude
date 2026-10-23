import type { DataTableCardLayout, DataTableColumn } from '@/components/shared/data-table';
import { PriorityMark } from '@/components/shared/priority-mark';
import { StatusBadge } from '@/components/shared/status-badge';
import type { PackingOrderRow } from '@/lib/modules/asignaciones';
import { packingOrderRoute } from '@/lib/shared/routes';
import { formatDecimalDisplay } from '@/lib/shared/ui/decimal-display';
import {
  ORDER_PRIORITY_LABELS,
  ORDER_PRIORITY_LEVELS,
  ORDER_STATUS_TONES,
} from '@/lib/shared/ui/order-status';

import { MissingValue, presentationColumn, quantityColumn, recipeColumn } from './assignment-list-parts';
import { assignmentActionsColumn } from './assignment-row-actions';
import { COMPANY_ORDER_STATUS_LABELS } from './company-orders-columns';

/**
 * Las siete columnas de «Por empacar»: número, receta, cantidad, presentación, prioridad, estado y
 * quién empaca -vacío en `POR_EMPACAR`-; y el menú, que abre la pantalla del pedido. Cantidad y
 * prioridad salen de las mismas piezas que «Todos» y «Terminados». Las filas llegan ya ordenadas del
 * servidor (prioridad y antigüedad): aquí no se reordenan. Sin `'use client'`:
 * `packing-orders-skeleton.tsx`, de servidor, lee de aquí el número de columnas.
 */

const MISSING_TEST_ID_PREFIX = 'packing-order';

export const PACKING_ORDER_NUMBER_COLUMN_ID = 'orderNumber';
export const PACKING_ORDER_RECIPE_NAME_COLUMN_ID = 'recipeName';
export const PACKING_ORDER_QUANTITY_COLUMN_ID = 'quantity';
export const PACKING_ORDER_PRESENTATION_COLUMN_ID = 'presentationName';
export const PACKING_ORDER_PRIORITY_COLUMN_ID = 'priority';
export const PACKING_ORDER_STATUS_COLUMN_ID = 'status';
export const PACKING_ORDER_PACKER_COLUMN_ID = 'packedByName';

/** Las columnas de datos de `buildPackingOrdersColumns()`, sin el menú; un test ata las dos. */
export const PACKING_ORDERS_COLUMN_COUNT = 7;

export const PACKING_ORDERS_CARD: DataTableCardLayout = {
  primary: PACKING_ORDER_NUMBER_COLUMN_ID,
  status: PACKING_ORDER_STATUS_COLUMN_ID,
  title: PACKING_ORDER_RECIPE_NAME_COLUMN_ID,
  meta: [
    PACKING_ORDER_QUANTITY_COLUMN_ID,
    PACKING_ORDER_PRESENTATION_COLUMN_ID,
    PACKING_ORDER_PRIORITY_COLUMN_ID,
    PACKING_ORDER_PACKER_COLUMN_ID,
  ],
};

export type PackingOrdersColumnsOptions = {
  readonly canViewTrace?: boolean;
};

export function buildPackingOrdersColumns({
  canViewTrace = false,
}: PackingOrdersColumnsOptions = {}): readonly DataTableColumn<PackingOrderRow>[] {
  return [
    {
      id: PACKING_ORDER_NUMBER_COLUMN_ID,
      label: 'Nº de pedido',
      align: 'start',
      cell: (order) => order.numberText,
    },
    recipeColumn(PACKING_ORDER_RECIPE_NAME_COLUMN_ID, MISSING_TEST_ID_PREFIX),
    quantityColumn(PACKING_ORDER_QUANTITY_COLUMN_ID, formatDecimalDisplay),
    presentationColumn(PACKING_ORDER_PRESENTATION_COLUMN_ID),
    {
      id: PACKING_ORDER_PRIORITY_COLUMN_ID,
      label: 'Prioridad',
      align: 'start',
      cell: (order) => (
        <PriorityMark
          level={ORDER_PRIORITY_LEVELS[order.priority]}
          label={ORDER_PRIORITY_LABELS[order.priority]}
          data-testid="packing-order-priority"
          data-priority={order.priority}
        />
      ),
    },
    {
      id: PACKING_ORDER_STATUS_COLUMN_ID,
      label: 'Estado',
      align: 'start',
      cell: (order) => (
        <StatusBadge
          tone={ORDER_STATUS_TONES[order.status]}
          label={COMPANY_ORDER_STATUS_LABELS[order.status]}
          data-testid="packing-order-status"
          data-status={order.status}
        />
      ),
    },
    {
      id: PACKING_ORDER_PACKER_COLUMN_ID,
      label: 'Quién empaca',
      align: 'start',
      cell: (order) =>
        order.packedByName ?? (
          <MissingValue testIdPrefix={MISSING_TEST_ID_PREFIX} field={PACKING_ORDER_PACKER_COLUMN_ID} />
        ),
    },
    assignmentActionsColumn<PackingOrderRow>({
      canViewTrace,
      enterHref: (order) => packingOrderRoute(order.id),
    }),
  ];
}
