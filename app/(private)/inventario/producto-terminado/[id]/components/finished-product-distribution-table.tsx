'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useTransition } from 'react';

import { movementReasonLabel } from '@/app/(private)/inventario/components';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import type { FinishedDistributionLine, FinishedProductDetail, Page } from '@/lib/modules/inventario';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

import {
  FINISHED_PRODUCT_TABLE_TEXTS,
  finishedProductPageHref,
  finishedProductTableParams,
} from './finished-product-params';
import { quantityText, unitLabelOf } from './finished-product-stock';

export const FINISHED_PRODUCT_DISTRIBUTION_TABLE_ID = 'inventario-producto-terminado-reparto';
export const OTHER_REASON_LABEL = 'Otro';
export const WITHOUT_BATCH_LABEL = 'Sin lote';
export const PACKED_BEFORE_COUNT_LABEL = 'Empacado antes de QC-281';

const MINUS_SIGN = '−';
const NOTE_SEPARATOR = ' · ';

type Presentation = FinishedProductDetail['presentation'];

function presentationText(presentation: Presentation): string {
  if (presentation === null) return EMPTY_MARK;
  if (presentation.content === null) return presentation.name;
  return `${presentation.name} ${quantityText(presentation.content, unitLabelOf(presentation.unit))}`;
}

/** Sin conteo guardado la linea se lee como igual al plan. */
function realPackages(line: FinishedDistributionLine): number {
  return line.packedPackages ?? line.plan;
}

/** La diferencia no viaja en la fila: se calcula al pintar. */
export function distributionDifference(line: FinishedDistributionLine): number {
  return realPackages(line) - line.plan;
}

export function differenceText(difference: number): string {
  if (difference === 0) return EMPTY_MARK;
  return difference > 0 ? `+${difference}` : `${MINUS_SIGN}${-difference}`;
}

function reasonText(line: FinishedDistributionLine): string {
  if (line.reason === null) return EMPTY_MARK;
  return line.reason === 'otro' ? OTHER_REASON_LABEL : movementReasonLabel(line.reason);
}

function reasonNote(line: FinishedDistributionLine): string | null {
  if (line.packedPackages === null) return PACKED_BEFORE_COUNT_LABEL;
  const notes: string[] = [];
  if (line.reason === 'otro' && line.reasonOther !== null) notes.push(`«${line.reasonOther}»`);
  if (line.packedPackages === 0) notes.push(WITHOUT_BATCH_LABEL);
  return notes.length === 0 ? null : notes.join(NOTE_SEPARATOR);
}

function DifferenceCell({ line }: { readonly line: FinishedDistributionLine }) {
  const difference = distributionDifference(line);
  if (difference === 0) {
    return (
      <span data-testid="finished-product-distribution-difference" className="text-muted-foreground">
        {EMPTY_MARK}
      </span>
    );
  }
  return (
    <StatusBadge
      tone="waiting"
      label={differenceText(difference)}
      data-testid="finished-product-distribution-difference"
      className="font-mono tabular-nums"
    />
  );
}

function ReasonCell({ line }: { readonly line: FinishedDistributionLine }) {
  const note = reasonNote(line);
  return (
    <span data-testid="finished-product-distribution-reason" className="inline-flex flex-col gap-1">
      <span className={line.reason === null ? 'text-muted-foreground' : undefined}>{reasonText(line)}</span>
      {note === null ? null : (
        <span
          className="whitespace-normal text-xs text-muted-foreground"
          data-testid="finished-product-distribution-reason-note"
        >
          {note}
        </span>
      )}
    </span>
  );
}

function distributionColumns(
  presentation: Presentation,
): readonly DataTableColumn<FinishedDistributionLine>[] {
  const presentationLabel = presentationText(presentation);
  return [
    {
      id: 'order',
      label: 'Pedido',
      align: 'start',
      tabular: true,
      cell: (row) => (
        <span data-testid="finished-product-distribution-row" data-line-id={row.lineId}>
          {row.orderNumberText}
        </span>
      ),
    },
    {
      id: 'presentation',
      label: 'Presentación',
      align: 'start',
      cell: () => (
        <span data-testid="finished-product-distribution-presentation">{presentationLabel}</span>
      ),
    },
    {
      id: 'plan',
      label: 'Plan',
      align: 'end',
      tabular: true,
      cell: (row) => <span data-testid="finished-product-distribution-plan">{row.plan}</span>,
    },
    {
      id: 'packed',
      label: 'Envases reales',
      align: 'end',
      tabular: true,
      cell: (row) => (
        <span data-testid="finished-product-distribution-packed">{realPackages(row)}</span>
      ),
    },
    {
      id: 'difference',
      label: 'Diferencia',
      align: 'end',
      tabular: true,
      cell: (row) => <DifferenceCell line={row} />,
    },
    {
      id: 'reason',
      label: 'Motivo',
      align: 'start',
      hideText: false,
      cell: (row) => <ReasonCell line={row} />,
    },
  ];
}

export type FinishedProductDistributionTableProps = {
  readonly productId: string;
  readonly page: Page<FinishedDistributionLine>;
  readonly presentation: Presentation;
};

export function FinishedProductDistributionTable({
  productId,
  page,
  presentation,
}: FinishedProductDistributionTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const columns = useMemo(() => distributionColumns(presentation), [presentation]);

  return (
    <div data-testid="finished-product-reparto" aria-busy={isPending}>
      <DataTable
        tableId={FINISHED_PRODUCT_DISTRIBUTION_TABLE_ID}
        columns={columns}
        rows={page.items}
        getRowId={(row) => row.lineId}
        params={finishedProductTableParams(page)}
        totalPages={page.totalPages}
        onParamsChange={(next) =>
          startTransition(() => router.push(finishedProductPageHref(productId, 'reparto', next)))
        }
        status="idle"
        texts={FINISHED_PRODUCT_TABLE_TEXTS}
        searchable={false}
      />
    </div>
  );
}
