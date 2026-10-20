'use client';

import { XCircleIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import {
  actionsColumn,
  DataTable,
  type DataTableColumn,
  type RowActionsSpec,
} from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import type {
  DeliveredTotal,
  FinishedProductDeliveriesPage,
  FinishedProductDeliveryRow,
} from '@/lib/modules/inventario';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

import { DirectDeliveryVoidDialog } from './direct-delivery-void-dialog';
import { movementDateText } from './finished-product-movements-table';
import {
  FINISHED_PRODUCT_TABLE_TEXTS,
  finishedProductPageHref,
  finishedProductTableParams,
} from './finished-product-params';
import { packagesText, quantityText } from './finished-product-stock';

export const FINISHED_PRODUCT_DELIVERIES_TABLE_ID = 'inventario-producto-terminado-entregas';
export const DELIVERY_VOIDED_LABEL = 'Anulada';
export const DELETED_CUSTOMER_LABEL = 'Dado de baja';
export const DIRECT_DELIVERY_LABEL = 'Sin pedido';
export const DIRECT_DELIVERY_VOID_LABEL = 'Anular';
export const DIRECT_DELIVERY_ACTIONS_LABEL = 'Acciones';
export const DIRECT_DELIVERY_ACTIONS_TESTID = 'finished-product-delivery-actions';
export const DIRECT_DELIVERY_VOID_TESTID = 'finished-product-delivery-direct-void';

export function directDeliveryActionsLabel(createdAt: string): string {
  return `Acciones de la entrega sin pedido del ${movementDateText(createdAt)}`;
}

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
      <StatusBadge tone="danger" label={DELIVERY_VOIDED_LABEL} />
      <span
        className="whitespace-normal text-xs text-muted-foreground"
        data-testid="finished-product-delivery-void-reason"
      >
        {voided.reason}
      </span>
    </span>
  );
}

function OrderCell({ row }: { readonly row: FinishedProductDeliveryRow }) {
  if (!row.withoutOrder) {
    return <span data-testid="finished-product-delivery-order">{row.orderNumberText ?? EMPTY_MARK}</span>;
  }
  return (
    <span data-testid="finished-product-delivery-order" className="inline-flex flex-col items-start gap-1">
      <StatusBadge tone="info" label={DIRECT_DELIVERY_LABEL} data-testid="finished-product-delivery-direct" />
      {row.note === null ? null : (
        <span
          className="whitespace-normal text-xs text-muted-foreground"
          data-testid="finished-product-delivery-note"
        >
          {row.note}
        </span>
      )}
    </span>
  );
}

/** Solo las entregas sin pedido no anuladas se anulan desde aquí; sin ítems, el menú no se pinta. */
function voidMenu(row: FinishedProductDeliveryRow, onVoid: (row: FinishedProductDeliveryRow) => void): RowActionsSpec {
  const voidable = row.withoutOrder && row.void === null;
  return {
    triggerLabel: directDeliveryActionsLabel(row.createdAt),
    triggerTestId: DIRECT_DELIVERY_ACTIONS_TESTID,
    items: voidable
      ? [
          {
            key: 'void',
            label: DIRECT_DELIVERY_VOID_LABEL,
            icon: XCircleIcon,
            destructive: true,
            onSelect: () => onVoid(row),
            testId: DIRECT_DELIVERY_VOID_TESTID,
          },
        ]
      : [],
  };
}

function voidColumn(
  onVoid: (row: FinishedProductDeliveryRow) => void,
): DataTableColumn<FinishedProductDeliveryRow> {
  return actionsColumn<FinishedProductDeliveryRow>({
    label: DIRECT_DELIVERY_ACTIONS_LABEL,
    srOnlyLabel: true,
    menu: (row) => voidMenu(row, onVoid),
  });
}

function deliveryColumns(
  unitLabel: string | null,
  onVoid: ((row: FinishedProductDeliveryRow) => void) | null,
): readonly DataTableColumn<FinishedProductDeliveryRow>[] {
  const columns: DataTableColumn<FinishedProductDeliveryRow>[] = [
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
      cell: (row) => <OrderCell row={row} />,
    },
    {
      id: 'presentation',
      label: 'Presentación',
      align: 'start',
      cell: (row) => (
        <span data-testid="finished-product-delivery-presentation">
          {row.presentationName ?? EMPTY_MARK}
        </span>
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
  return onVoid === null ? columns : [...columns, voidColumn(onVoid)];
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
  /** Lo decide el servidor con el permiso de anular; la action lo vuelve a exigir. */
  readonly canVoidDirect?: boolean;
};

export function FinishedProductDeliveriesTable({
  productId,
  page,
  unitLabel,
  canVoidDirect = false,
}: FinishedProductDeliveriesTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const columns = useMemo(
    () => deliveryColumns(unitLabel, canVoidDirect ? (row) => setVoidingId(row.orderDeliveryId) : null),
    [unitLabel, canVoidDirect],
  );

  return (
    <div data-testid="finished-product-entregas" aria-busy={isPending} className="flex flex-col gap-3">
      <DeliveredTotalSummary delivered={page.delivered} unitLabel={unitLabel} />
      <DataTable
        tableId={FINISHED_PRODUCT_DELIVERIES_TABLE_ID}
        columns={columns}
        rows={page.items}
        getRowId={(row) => row.deliveryLineId}
        params={finishedProductTableParams(page)}
        totalPages={page.totalPages}
        onParamsChange={(next) =>
          startTransition(() => router.push(finishedProductPageHref(productId, 'entregas', next)))
        }
        status="idle"
        texts={FINISHED_PRODUCT_TABLE_TEXTS}
        searchable={false}
      />
      {voidingId === null ? null : (
        <DirectDeliveryVoidDialog
          deliveryId={voidingId}
          open
          onOpenChange={(open) => {
            if (!open) setVoidingId(null);
          }}
        />
      )}
    </div>
  );
}
