'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useTransition } from 'react';

import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import type { FinishedProductBatchRow, Page } from '@/lib/modules/inventario';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

import { BatchEvidenceButton } from './batch-evidence-button';
import { BATCH_EVIDENCE_TEXTS } from './batch-evidence-dialog';
import {
  FINISHED_PRODUCT_TABLE_TEXTS,
  finishedProductPageHref,
  finishedProductTableParams,
} from './finished-product-params';
import { packagedText, quantityText } from './finished-product-stock';

export const FINISHED_PRODUCT_BATCHES_TABLE_ID = 'inventario-producto-terminado-lotes';
export const WITHOUT_ORDER_LABEL = 'Sin pedido';

/** Fotos por pedido de origen; sin el mapa, la columna no existe. */
export type EvidenceCounts = ReadonlyMap<string, number>;

function evidenceColumn(evidenceCounts: EvidenceCounts): DataTableColumn<FinishedProductBatchRow> {
  return {
    id: 'evidence',
    label: BATCH_EVIDENCE_TEXTS.column,
    align: 'start',
    cell: (row) => {
      const photoCount = row.orderId === null ? 0 : (evidenceCounts.get(row.orderId) ?? 0);
      return (
        <span data-testid="finished-product-batch-evidence">
          {row.orderId !== null && photoCount > 0 ? (
            <BatchEvidenceButton
              lot={row.lot}
              orderId={row.orderId}
              orderNumberText={row.orderNumberText ?? EMPTY_MARK}
              photoCount={photoCount}
            />
          ) : (
            EMPTY_MARK
          )}
        </span>
      );
    },
  };
}

function batchColumns(
  unitLabel: string | null,
  evidenceCounts: EvidenceCounts | undefined,
): readonly DataTableColumn<FinishedProductBatchRow>[] {
  const columns: DataTableColumn<FinishedProductBatchRow>[] = [
    {
      id: 'lot',
      label: 'Lote',
      align: 'start',
      tabular: true,
      cell: (row) => (
        <span data-testid="finished-product-batch-row" data-batch-id={row.id}>
          {row.lot}
        </span>
      ),
    },
    {
      id: 'order',
      label: 'Pedido de origen',
      align: 'start',
      cell: (row) => (
        <span data-testid="finished-product-batch-order">
          {row.orderNumberText ?? WITHOUT_ORDER_LABEL}
        </span>
      ),
    },
    {
      id: 'purchaseDate',
      label: 'Fecha de entrada',
      align: 'start',
      tabular: true,
      cell: (row) => <span data-testid="finished-product-batch-entry-date">{row.purchaseDate}</span>,
    },
    {
      id: 'productionDate',
      label: 'Fecha de producción',
      align: 'start',
      tabular: true,
      cell: (row) => (
        <span data-testid="finished-product-batch-production-date">
          {row.productionDate ?? EMPTY_MARK}
        </span>
      ),
    },
    {
      id: 'expiryDate',
      label: 'Vencimiento',
      align: 'start',
      tabular: true,
      cell: (row) => (
        <span data-testid="finished-product-batch-expiry-date">{row.expiryDate ?? EMPTY_MARK}</span>
      ),
    },
    {
      id: 'packageContent',
      label: 'Contenido de envase',
      align: 'end',
      tabular: true,
      cell: (row) => (
        <span data-testid="finished-product-batch-package-content">
          {row.packageContent === null ? EMPTY_MARK : quantityText(row.packageContent, unitLabel)}
        </span>
      ),
    },
    {
      id: 'stock',
      label: 'Existencia',
      align: 'end',
      tabular: true,
      cell: (row) => (
        <span data-testid="finished-product-batch-stock">{quantityText(row.stock, unitLabel)}</span>
      ),
    },
    {
      id: 'packagedStock',
      label: 'En envases',
      align: 'end',
      tabular: true,
      cell: (row) => (
        <span data-testid="finished-product-batch-packaged">
          {packagedText(row.packagedStock, unitLabel)}
        </span>
      ),
    },
  ];
  return evidenceCounts === undefined ? columns : [...columns, evidenceColumn(evidenceCounts)];
}

export type FinishedProductBatchesTableProps = {
  readonly productId: string;
  readonly page: Page<FinishedProductBatchRow>;
  readonly unitLabel: string | null;
  readonly evidenceCounts?: EvidenceCounts;
};

export function FinishedProductBatchesTable({
  productId,
  page,
  unitLabel,
  evidenceCounts,
}: FinishedProductBatchesTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const columns = useMemo(
    () => batchColumns(unitLabel, evidenceCounts),
    [unitLabel, evidenceCounts],
  );

  return (
    <div data-testid="finished-product-lotes" aria-busy={isPending}>
      <DataTable
        tableId={FINISHED_PRODUCT_BATCHES_TABLE_ID}
        columns={columns}
        rows={page.items}
        getRowId={(row) => row.id}
        params={finishedProductTableParams(page)}
        totalPages={page.totalPages}
        onParamsChange={(next) =>
          startTransition(() => router.push(finishedProductPageHref(productId, 'lotes', next)))
        }
        status="idle"
        texts={FINISHED_PRODUCT_TABLE_TEXTS}
        searchable={false}
      />
    </div>
  );
}
