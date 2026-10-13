'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useTransition } from 'react';

import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import type {
  DeliveredTotal,
  FinishedProductDeliveriesPage,
  FinishedProductDeliveryRow,
} from '@/lib/modules/inventario';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

import { movementDateText } from './finished-product-movements-table';
import {
  FINISHED_PRODUCT_TABLE_TEXTS,
  finishedProductPageHref,
  finishedProductTableParams,
} from './finished-product-params';
import { packagesText, quantityText } from './finished-product-stock';

export const FINISHED_PRODUCT_DELIVERIES_TABLE_ID = 'inventario-producto-terminado-entregas';
export const VOIDED_DELIVERY_LABEL = 'Anulada';
export const DELETED_CUSTOMER_LABEL = 'Dado de baja';

function CustomerCell({ customer }: { readonly customer: FinishedProductDeliveryRow['customer'] }) {
  if (customer === null) {
    return (
      <span data-testid="finished-product-delivery-customer" data-missing="true">
        {EMPTY_MARK}
      </span>
    );
  }
  return (
    <span
      data-testid="finished-product-delivery-customer"
      data-deleted={customer.isDeleted ? 'true' : undefined}
      className="inline-flex items-center gap-2"
    >
      <span>{`${customer.firstNames} ${customer.lastNames}`.trim()}</span>
      {customer.isDeleted ? (
        <StatusBadge
          tone="muted"
          label={DELETED_CUSTOMER_LABEL}
          data-testid="finished-product-delivery-customer-deleted"
        />
      ) : null}
    </span>
  );
}

function VoidCell({ voided }: { readonly voided: FinishedProductDeliveryRow['void'] }) {
  if (voided === null) return null;
  return (
    <span data-testid="finished-product-delivery-void" className="inline-flex flex-col gap-1">
      <StatusBadge tone="danger" label={VOIDED_DELIVERY_LABEL} />
      <span
        className="whitespace-normal text-xs text-muted-foreground"
        data-testid="finished-product-delivery-void-reason"
      >
        {voided.reason}
      </span>
    </span>
  );
}

function deliveryColumns(unitLabel: string | null): readonly DataTableColumn<FinishedProductDeliveryRow>[] {
  return [
    {
      id: 'createdAt',
      label: 'Fecha',
      align: 'start',
      tabular: true,
      cell: (row) => (
        <span
          data-testid="finished-product-delivery-row"
          data-voided={row.void === null ? 'false' : 'true'}
        >
          {movementDateText(row.createdAt)}
        </span>
      ),
    },
    {
      id: 'customer',
      label: 'Cliente',
      align: 'start',
      cell: (row) => <CustomerCell customer={row.customer} />,
    },
    {
      id: 'order',
      label: 'Pedido',
      align: 'start',
      cell: (row) => (
        <span data-testid="finished-product-delivery-order">{row.orderNumberText ?? EMPTY_MARK}</span>
      ),
    },
    {
      id: 'lot',
      label: 'Lote',
      align: 'start',
      tabular: true,
      cell: (row) => <span data-testid="finished-product-delivery-lot">{row.lot}</span>,
    },
    {
      id: 'packages',
      label: 'Envases',
      align: 'end',
      tabular: true,
      cell: (row) => (
        <span data-testid="finished-product-delivery-packages">
          {row.packages === null ? EMPTY_MARK : row.packages}
        </span>
      ),
    },
    {
      id: 'quantity',
      label: 'Cantidad',
      align: 'end',
      tabular: true,
      cell: (row) => (
        <span data-testid="finished-product-delivery-quantity">
          {quantityText(row.quantity, unitLabel)}
        </span>
      ),
    },
    {
      id: 'void',
      label: 'Anulación',
      align: 'start',
      hideText: false,
      cell: (row) => <VoidCell voided={row.void} />,
    },
  ];
}

function DeliveredTotalSummary({
  delivered,
  unitLabel,
}: {
  readonly delivered: DeliveredTotal;
  readonly unitLabel: string | null;
}) {
  return (
    <p className="text-sm" data-testid="finished-product-deliveries-total">
      <span className="text-muted-foreground">Total entregado: </span>
      <span className="font-medium tabular-nums" data-testid="finished-product-deliveries-total-quantity">
        {quantityText(delivered.quantity, unitLabel)}
      </span>
      <span className="text-muted-foreground"> · </span>
      <span className="font-medium tabular-nums" data-testid="finished-product-deliveries-total-packages">
        {packagesText(delivered.packages)}
      </span>
    </p>
  );
}

export type FinishedProductDeliveriesTableProps = {
  readonly productId: string;
  readonly page: FinishedProductDeliveriesPage;
  readonly unitLabel: string | null;
};

export function FinishedProductDeliveriesTable({
  productId,
  page,
  unitLabel,
}: FinishedProductDeliveriesTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const columns = useMemo(() => deliveryColumns(unitLabel), [unitLabel]);

  return (
    <div data-testid="finished-product-entregas" aria-busy={isPending} className="flex flex-col gap-3">
      <DeliveredTotalSummary delivered={page.delivered} unitLabel={unitLabel} />
      <DataTable
        tableId={FINISHED_PRODUCT_DELIVERIES_TABLE_ID}
        columns={columns}
        rows={page.items}
        getRowId={(row) => row.movementId}
        params={finishedProductTableParams(page)}
        totalPages={page.totalPages}
        onParamsChange={(next) =>
          startTransition(() => router.push(finishedProductPageHref(productId, 'entregas', next)))
        }
        status="idle"
        texts={FINISHED_PRODUCT_TABLE_TEXTS}
        searchable={false}
      />
    </div>
  );
}
