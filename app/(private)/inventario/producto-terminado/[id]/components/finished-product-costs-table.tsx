'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useTransition } from 'react';

import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import type { FinishedProductCostRow, Page } from '@/lib/modules/inventario';
import { trimDecimal } from '@/lib/shared/ui/decimal-display';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

import {
  FINISHED_PRODUCT_TABLE_TEXTS,
  finishedProductPageHref,
  finishedProductTableParams,
} from './finished-product-params';
import { packagedText, quantityText } from './finished-product-stock';

export const FINISHED_PRODUCT_COSTS_TABLE_ID = 'inventario-producto-terminado-costo';

function amountText(value: string | null): string {
  return value === null ? EMPTY_MARK : trimDecimal(value);
}

function costColumns(unitLabel: string | null): readonly DataTableColumn<FinishedProductCostRow>[] {
  return [
    {
      id: 'lot',
      label: 'Lote',
      align: 'start',
      tabular: true,
      cell: (row) => (
        <span data-testid="finished-product-cost-row" data-batch-id={row.batchId}>
          {row.lot}
        </span>
      ),
    },
    {
      id: 'order',
      label: 'Pedido',
      align: 'start',
      cell: (row) => (
        <span data-testid="finished-product-cost-order">{row.orderNumberText ?? EMPTY_MARK}</span>
      ),
    },
    {
      id: 'quantity',
      label: 'Cantidad producida',
      align: 'end',
      tabular: true,
      cell: (row) => (
        <span data-testid="finished-product-cost-quantity">{quantityText(row.quantity, unitLabel)}</span>
      ),
    },
    {
      id: 'packaged',
      label: 'En envases',
      align: 'end',
      tabular: true,
      cell: (row) => (
        <span data-testid="finished-product-cost-packaged">{packagedText(row.packaged, unitLabel)}</span>
      ),
    },
    {
      id: 'unitCost',
      label: 'Costo unitario',
      align: 'end',
      tabular: true,
      cell: (row) => (
        <span data-testid="finished-product-cost-unit">{amountText(row.unitCost)}</span>
      ),
    },
    {
      id: 'totalCost',
      label: 'Costo total',
      align: 'end',
      tabular: true,
      cell: (row) => (
        <span data-testid="finished-product-cost-total">{amountText(row.totalCost)}</span>
      ),
    },
  ];
}

export type FinishedProductCostsTableProps = {
  readonly productId: string;
  readonly page: Page<FinishedProductCostRow>;
  readonly unitLabel: string | null;
};

export function FinishedProductCostsTable({ productId, page, unitLabel }: FinishedProductCostsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const columns = useMemo(() => costColumns(unitLabel), [unitLabel]);

  return (
    <div data-testid="finished-product-costo" aria-busy={isPending}>
      <DataTable
        tableId={FINISHED_PRODUCT_COSTS_TABLE_ID}
        columns={columns}
        rows={page.items}
        getRowId={(row) => row.batchId}
        params={finishedProductTableParams(page)}
        totalPages={page.totalPages}
        onParamsChange={(next) =>
          startTransition(() => router.push(finishedProductPageHref(productId, 'costo', next)))
        }
        status="idle"
        texts={FINISHED_PRODUCT_TABLE_TEXTS}
        searchable={false}
      />
    </div>
  );
}
