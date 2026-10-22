'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useTransition } from 'react';

import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import type {
  FinishedProductMovementKind,
  FinishedProductMovementRow,
  MovementReason,
  Page,
} from '@/lib/modules/inventario';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

import {
  FINISHED_PRODUCT_TABLE_TEXTS,
  finishedProductPageHref,
  finishedProductTableParams,
} from './finished-product-params';
import { packagedText, quantityText } from './finished-product-stock';

export type FinishedProductMovementsTab = 'entradas' | 'salidas';

/** Exhaustivo: un tipo de asiento nuevo no compila hasta tener su etiqueta. */
export const FINISHED_PRODUCT_MOVEMENT_KIND_LABELS: Readonly<
  Record<FinishedProductMovementKind, string>
> = {
  production: 'Producción',
  opening: 'Apertura (alta o importación)',
  adjustment: 'Ajuste',
  delivery: 'Entrega a cliente',
  delivery_void: 'Anulación de entrega',
  consumption: 'Consumo',
  direct_delivery: 'Entrega sin pedido',
  direct_delivery_void: 'Anulación de entrega sin pedido',
};

/** Recorta el ISO en vez de usar `Date`: así servidor y navegador pintan la misma hora. */
export function movementDateText(createdAt: string): string {
  return `${createdAt.slice(0, 10)} ${createdAt.slice(11, 16)}`;
}

function movementColumns(
  tab: FinishedProductMovementsTab,
  unitLabel: string | null,
  reasonLabels: Readonly<Record<MovementReason, string>>,
): readonly DataTableColumn<FinishedProductMovementRow>[] {
  return [
    {
      id: 'createdAt',
      label: 'Fecha',
      align: 'start',
      tabular: true,
      cell: (row) => (
        <span data-testid="finished-product-movement-row" data-kind={row.kind}>
          {movementDateText(row.createdAt)}
        </span>
      ),
    },
    {
      id: 'origin',
      label: tab === 'entradas' ? 'Origen' : 'Tipo',
      align: 'start',
      cell: (row) => (
        <span data-testid="finished-product-movement-origin">
          {FINISHED_PRODUCT_MOVEMENT_KIND_LABELS[row.kind]}
        </span>
      ),
    },
    {
      id: 'lot',
      label: 'Lote',
      align: 'start',
      tabular: true,
      cell: (row) => <span data-testid="finished-product-movement-lot">{row.lot}</span>,
    },
    {
      id: 'quantity',
      label: 'Cantidad',
      align: 'end',
      tabular: true,
      cell: (row) => (
        <span data-testid="finished-product-movement-quantity">
          {quantityText(row.quantity, unitLabel)}
        </span>
      ),
    },
    {
      id: 'packaged',
      label: 'En envases',
      align: 'end',
      tabular: true,
      cell: (row) => (
        <span data-testid="finished-product-movement-packaged">
          {packagedText(row.packaged, unitLabel)}
        </span>
      ),
    },
    {
      id: 'order',
      label: 'Pedido',
      align: 'start',
      cell: (row) => (
        <span data-testid="finished-product-movement-order">{row.orderNumberText ?? EMPTY_MARK}</span>
      ),
    },
    {
      id: 'reason',
      label: 'Motivo',
      align: 'start',
      cell: (row) => (
        <span data-testid="finished-product-movement-reason">
          {row.reason === null ? EMPTY_MARK : reasonLabels[row.reason]}
        </span>
      ),
    },
  ];
}

export type FinishedProductMovementsTableProps = {
  readonly productId: string;
  readonly tab: FinishedProductMovementsTab;
  readonly page: Page<FinishedProductMovementRow>;
  readonly unitLabel: string | null;
  /** Llegan resueltas del servidor: el barrel de /inventario arrastraría módulos de servidor al cliente. */
  readonly reasonLabels: Readonly<Record<MovementReason, string>>;
};

export function FinishedProductMovementsTable({
  productId,
  tab,
  page,
  unitLabel,
  reasonLabels,
}: FinishedProductMovementsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const columns = useMemo(
    () => movementColumns(tab, unitLabel, reasonLabels),
    [tab, unitLabel, reasonLabels],
  );

  return (
    <div data-testid={`finished-product-${tab}`} aria-busy={isPending}>
      <DataTable
        tableId={`inventario-producto-terminado-${tab}`}
        columns={columns}
        rows={page.items}
        getRowId={(row) => row.id}
        params={finishedProductTableParams(page)}
        totalPages={page.totalPages}
        onParamsChange={(next) =>
          startTransition(() => router.push(finishedProductPageHref(productId, tab, next)))
        }
        status="idle"
        texts={FINISHED_PRODUCT_TABLE_TEXTS}
        searchable={false}
      />
    </div>
  );
}
