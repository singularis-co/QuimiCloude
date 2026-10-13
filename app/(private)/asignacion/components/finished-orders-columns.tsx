'use client';

import type { DataTableCardLayout, DataTableColumn } from '@/components/shared/data-table';
import type { FinishedOrderView } from '@/lib/modules/asignaciones';
import { formatCivilDate } from '@/lib/shared/ui/date-civil';
import { formatDecimalDisplay } from '@/lib/shared/ui/decimal-display';

import {
  orderNumberColumn,
  presentationColumn,
  quantityColumn,
  recipeColumn,
  responsiblesColumn,
} from './assignment-list-parts';
import { assignmentActionsColumn } from './assignment-row-actions';

/**
 * Las SEIS columnas de «Terminados»: número, receta, cantidad, presentación, fecha de terminado y
 * responsables. Sin «Entrar»: esta vista es de solo lectura para toda la empresa, incluido el
 * propio actor; con `canViewTrace` se añade el menú con «Ver recorrido».
 */

export const FINISHED_ORDER_NUMBER_COLUMN_ID = 'orderNumber';
export const FINISHED_ORDER_RECIPE_NAME_COLUMN_ID = 'recipeName';
export const FINISHED_ORDER_QUANTITY_COLUMN_ID = 'quantity';
export const FINISHED_ORDER_PRESENTATION_COLUMN_ID = 'presentationName';
export const FINISHED_ORDER_DATE_COLUMN_ID = 'finishedAt';
export const FINISHED_ORDER_RESPONSIBLES_COLUMN_ID = 'responsibles';

const MISSING_DATE_TEXT = 'Sin fecha';

function FinishedAtCell({ finishedAt }: { readonly finishedAt: Date | null }) {
  const isMissing = finishedAt === null;

  return (
    <span
      data-testid="finished-order-date"
      data-missing={isMissing ? 'true' : undefined}
    >
      {isMissing ? MISSING_DATE_TEXT : formatCivilDate(finishedAt)}
    </span>
  );
}

/** Las vistas que pintan pedidos terminados comparten tarjeta. */
export const FINISHED_ORDERS_CARD: DataTableCardLayout = {
  primary: FINISHED_ORDER_NUMBER_COLUMN_ID,
  title: FINISHED_ORDER_RECIPE_NAME_COLUMN_ID,
  meta: [
    FINISHED_ORDER_QUANTITY_COLUMN_ID,
    FINISHED_ORDER_PRESENTATION_COLUMN_ID,
    FINISHED_ORDER_DATE_COLUMN_ID,
    FINISHED_ORDER_RESPONSIBLES_COLUMN_ID,
  ],
};

export type FinishedOrdersColumnsOptions = {
  /** Decidido en servidor; sin el, la columna de acciones no se emite: su menú quedaría vacío. */
  readonly canViewTrace?: boolean;
};

export function buildFinishedOrdersColumns({
  canViewTrace = false,
}: FinishedOrdersColumnsOptions = {}): readonly DataTableColumn<FinishedOrderView>[] {
  const columns: DataTableColumn<FinishedOrderView>[] = [
    orderNumberColumn(FINISHED_ORDER_NUMBER_COLUMN_ID),
    recipeColumn(FINISHED_ORDER_RECIPE_NAME_COLUMN_ID, 'finished-order'),
    quantityColumn(FINISHED_ORDER_QUANTITY_COLUMN_ID, formatDecimalDisplay),
    presentationColumn(FINISHED_ORDER_PRESENTATION_COLUMN_ID),
    {
      id: FINISHED_ORDER_DATE_COLUMN_ID,
      label: 'Fecha de terminado',
      tabular: true,
      align: 'start',
      cell: (order) => <FinishedAtCell finishedAt={order.finishedAt} />,
    },
    responsiblesColumn(FINISHED_ORDER_RESPONSIBLES_COLUMN_ID, (order) => order.responsibles),
  ];

  if (canViewTrace) {
    columns.push(assignmentActionsColumn<FinishedOrderView>({ canViewTrace }));
  }

  return columns;
}
