'use client';

import Link from 'next/link';

import type { DataTableColumn } from '@/components/shared/data-table';
import type { ConditioningOrderRow } from '@/lib/modules/asignaciones';
import { conditioningOrderRoute } from '@/lib/shared/routes';
import { ORDER_STATUS_LABELS } from '@/lib/shared/ui/order-status';
import { touchTarget } from '@/lib/shared/ui/touch-target';
import { cn } from '@/lib/utils';

import { MissingValue } from './assignment-list-parts';
import { OrderDistributionFull } from './order-distribution-full';

/**
 * Las cinco columnas de «Por acondicionar»: número -que abre el detalle-, receta, envases -el
 * reparto entero, no un total-, estado y quién acondiciona, vacío mientras nadie lo ha tomado.
 */

export const CONDITIONING_ORDER_NUMBER_COLUMN_ID = 'orderNumber';
export const CONDITIONING_ORDER_RECIPE_NAME_COLUMN_ID = 'recipeName';
export const CONDITIONING_ORDER_PACKAGES_COLUMN_ID = 'packages';
export const CONDITIONING_ORDER_STATUS_COLUMN_ID = 'status';
export const CONDITIONING_ORDER_CONDITIONER_COLUMN_ID = 'conditionedByName';

export const CONDITIONING_ORDER_LINK_TESTID = 'conditioning-order-link';

export function ConditioningOrderLink({
  id,
  numberText,
}: {
  readonly id: string;
  readonly numberText: string;
}) {
  return (
    <Link
      href={conditioningOrderRoute(id)}
      data-testid={CONDITIONING_ORDER_LINK_TESTID}
      className={cn(
        touchTarget,
        'flex items-center underline-offset-4 hover:underline focus-visible:underline',
      )}
    >
      {numberText}
    </Link>
  );
}

export function buildConditioningOrdersColumns(): readonly DataTableColumn<ConditioningOrderRow>[] {
  return [
    {
      id: CONDITIONING_ORDER_NUMBER_COLUMN_ID,
      label: 'Nº de pedido',
      align: 'start',
      cell: (order) => <ConditioningOrderLink id={order.id} numberText={order.numberText} />,
    },
    {
      id: CONDITIONING_ORDER_RECIPE_NAME_COLUMN_ID,
      label: 'Receta',
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
        <span data-testid="conditioning-order-status" data-status={order.status}>
          {ORDER_STATUS_LABELS[order.status]}
        </span>
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
  ];
}
