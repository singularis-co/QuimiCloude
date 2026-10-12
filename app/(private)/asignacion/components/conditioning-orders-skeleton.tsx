import { AssignmentListSkeleton } from './assignment-list-parts';
import { FINISHED_ORDERS_SKELETON_COLUMN_COUNT } from './finished-orders-skeleton';

/**
 * Copia a mano el numero de columnas de `buildConditioningOrdersColumns()`: ese archivo es de
 * cliente y su constante no llega a un componente de servidor. Un test ata las dos.
 */
export const CONDITIONING_ORDERS_SKELETON_COLUMN_COUNT = 5;

const SKELETON_SHAPE = {
  por_acondicionar: {
    columnCount: CONDITIONING_ORDERS_SKELETON_COLUMN_COUNT,
    label: 'Cargando pedidos por acondicionar…',
  },
  acondicionados: {
    columnCount: FINISHED_ORDERS_SKELETON_COLUMN_COUNT,
    label: 'Cargando pedidos terminados…',
  },
  acondicionados_entregados: {
    columnCount: FINISHED_ORDERS_SKELETON_COLUMN_COUNT,
    label: 'Cargando pedidos entregados…',
  },
} as const;

export type ConditioningOrdersSkeletonProps = {
  readonly rows: number;
  /** Qué tabla se está cargando: decide el número de columnas y el texto. */
  readonly list: keyof typeof SKELETON_SHAPE;
};

/** El esqueleto de las tres tablas del acondicionador. */
export function ConditioningOrdersSkeleton({ rows, list }: ConditioningOrdersSkeletonProps) {
  const { columnCount, label } = SKELETON_SHAPE[list];

  return (
    <AssignmentListSkeleton
      columns={columnCount}
      rows={rows}
      label={label}
      testId="conditioning-orders-skeleton"
      rowTestId="conditioning-order-row-skeleton"
    />
  );
}
