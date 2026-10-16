'use client';

import { useEffect, useEffectEvent, useState } from 'react';

import { XIcon } from 'lucide-react';

import {
  DataTable,
  createDefaultParams,
  type DataTableCardLayout,
  type DataTableColumn,
  type DataTableParams,
  type DataTableTexts,
} from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { listBatchMovementsAction } from '@/lib/modules/inventario/adapters/driving/batch-actions';
import type { ErrorState } from '@/lib/modules/errores';
import type { BatchHistoryEntry } from '@/lib/modules/inventario';
import { exactDecimalTitle, formatDecimalDisplay, trimDecimal } from '@/lib/shared/ui/decimal-display';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

import { movementReasonLabel } from './movement-reason-label';

const HISTORY_TITLE = 'Historial del lote';
const CLOSE_LABEL = 'Close';
const LOADING_MESSAGE = 'Cargando historial…';
const BEFORE_LEDGER_MESSAGE = 'Este lote es anterior al libro de movimientos: no tiene historial registrado.';

/** Sin autor, lo hizo el sistema: caducidad, la migracion que aparta pedidos vivos. */
const SYSTEM_AUTHOR = 'Sistema';

const BATCH_HISTORY_COLUMN_LABELS = {
  kind: 'Tipo',
  quantity: 'Cantidad',
  previousStock: 'Existencia anterior',
  countedStock: 'Total contado',
  reason: 'Motivo',
  order: 'Pedido',
  author: 'Autor',
  date: 'Fecha',
} as const;

const BATCH_HISTORY_TABLE_TEXTS: DataTableTexts = {
  empty: BEFORE_LEDGER_MESSAGE,
  loading: LOADING_MESSAGE,
  error: 'No se pudo cargar el historial.',
  search: 'Buscar',
  filters: 'Filtros',
  columnMenu: 'opciones de la columna',
  previousPage: 'Página anterior',
  nextPage: 'Página siguiente',
  pageIndicator: (page, totalPages) => `Página ${page} de ${totalPages}`,
  pageSize: 'Asientos por página',
  sortAscending: 'Orden ascendente',
  sortDescending: 'Orden descendente',
  pinColumn: 'Fijar columna',
  unpinColumn: 'Soltar columna',
  filterColumn: 'Filtrar columna',
  clearFilter: 'Limpiar filtro',
  lastWeek: 'Última semana',
  lastMonth: 'Último mes',
  lastYear: 'Último año',
  scrollLeft: 'Desplazar la tabla a la izquierda',
  scrollRight: 'Desplazar la tabla a la derecha',
};

const BATCH_HISTORY_CARD: DataTableCardLayout = {
  primary: 'kind',
  status: 'quantity',
  meta: ['previousStock', 'countedStock', 'reason', 'order', 'author', 'date'],
};

/**
 * Etiqueta legible de cada tipo de asiento del historial, en el mismo orden que
 * `BatchHistoryEntry['kind']`: el libro fisico (apertura, ajuste, salida por entrega) y el libro
 * de la reserva (apartado, liberacion, caducidad, consumo).
 */
const KIND_LABELS: Record<BatchHistoryEntry['kind'], string> = {
  opening: 'Apertura',
  adjustment: 'Ajuste',
  consumption: 'Salida por entrega',
  reserve: 'Apartado',
  release: 'Liberación',
  expire: 'Caducidad',
  consume: 'Consumo',
  delivery: 'Entrega a cliente',
  delivery_void: 'Anulación de entrega',
};

/** Etiqueta del tipo de asiento. */
export function movementKindLabel(kind: BatchHistoryEntry['kind']): string {
  return KIND_LABELS[kind];
}

/**
 * En `YYYY-MM-DD HH:mm`, recortando el ISO tal cual llega: sin `Date` ni `toLocaleString`, que
 * dependen del huso del entorno y desalinean servidor y navegador.
 */
function formatMovementDate(createdAt: string): string {
  return `${createdAt.slice(0, 10)} ${createdAt.slice(11, 16)}`;
}

function DecimalValue({ value, testId }: { readonly value: string; readonly testId: string }) {
  return (
    <span data-testid={testId} title={exactDecimalTitle(value)} aria-label={trimDecimal(value)}>
      {formatDecimalDisplay(value)}
    </span>
  );
}

function optionalDecimal(value: string | null, testId: string) {
  return value === null ? EMPTY_MARK : <DecimalValue value={value} testId={testId} />;
}

function optionalText(value: string | null, testId: string) {
  return value === null ? EMPTY_MARK : <span data-testid={testId}>{value}</span>;
}

// Los dos libros tienen tipos disjuntos y cada `id` es unico dentro del suyo.
function entryRowId(entry: BatchHistoryEntry): string {
  return `${entry.kind}-${entry.id}`;
}

const BATCH_HISTORY_COLUMNS: readonly DataTableColumn<BatchHistoryEntry>[] = [
  {
    id: 'kind',
    label: BATCH_HISTORY_COLUMN_LABELS.kind,
    align: 'start',
    cell: (entry) => <span data-testid="batch-history-entry-kind">{movementKindLabel(entry.kind)}</span>,
  },
  {
    id: 'quantity',
    label: BATCH_HISTORY_COLUMN_LABELS.quantity,
    align: 'end',
    tabular: true,
    cell: (entry) => <DecimalValue value={entry.quantity} testId="batch-history-entry-quantity" />,
  },
  {
    id: 'previousStock',
    label: BATCH_HISTORY_COLUMN_LABELS.previousStock,
    align: 'end',
    tabular: true,
    cell: (entry) => optionalDecimal(entry.previousStock, 'batch-history-entry-previous-stock'),
  },
  {
    id: 'countedStock',
    label: BATCH_HISTORY_COLUMN_LABELS.countedStock,
    align: 'end',
    tabular: true,
    cell: (entry) => optionalDecimal(entry.countedStock, 'batch-history-entry-counted-stock'),
  },
  {
    id: 'reason',
    label: BATCH_HISTORY_COLUMN_LABELS.reason,
    align: 'start',
    cell: (entry) =>
      optionalText(entry.reason === null ? null : movementReasonLabel(entry.reason), 'batch-history-entry-reason'),
  },
  {
    id: 'order',
    label: BATCH_HISTORY_COLUMN_LABELS.order,
    align: 'start',
    tabular: true,
    cell: (entry) => optionalText(entry.orderNumberText, 'batch-history-entry-order'),
  },
  {
    id: 'author',
    label: BATCH_HISTORY_COLUMN_LABELS.author,
    align: 'start',
    cell: (entry) => <span data-testid="batch-history-entry-author">{entry.authorName ?? SYSTEM_AUTHOR}</span>,
  },
  {
    id: 'date',
    label: BATCH_HISTORY_COLUMN_LABELS.date,
    align: 'start',
    tabular: true,
    cell: (entry) => <span data-testid="batch-history-entry-date">{formatMovementDate(entry.createdAt)}</span>,
  },
];

function BatchHistoryTable({ entries }: { readonly entries: readonly BatchHistoryEntry[] }) {
  const [params, setParams] = useState<DataTableParams>(createDefaultParams);
  const totalPages = Math.max(1, Math.ceil(entries.length / params.pageSize));
  const page = Math.min(params.page, totalPages);
  const pageRows = entries.slice((page - 1) * params.pageSize, page * params.pageSize);

  return (
    <div className="min-w-0" data-testid="batch-history-list">
      <DataTable
        tableId="inventory-batch-history"
        columns={BATCH_HISTORY_COLUMNS}
        rows={pageRows}
        getRowId={entryRowId}
        params={{ ...params, page }}
        totalPages={totalPages}
        onParamsChange={setParams}
        status="idle"
        texts={BATCH_HISTORY_TABLE_TEXTS}
        searchable={false}
        card={BATCH_HISTORY_CARD}
      />
    </div>
  );
}

type LoadState =
  | { readonly status: 'idle' }
  /** Pedido: la peticion sale en el efecto, justo despues de pintar, y se espera aqui. */
  | { readonly status: 'queued' }
  | { readonly status: 'success'; readonly data: readonly BatchHistoryEntry[] }
  | ErrorState;

type BatchHistoryProps = {
  readonly batchId: string;
  readonly batchLot: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

/**
 * Diálogo con el historial de un lote: pide los asientos la primera vez que se abre y no los
 * vuelve a pedir. El orden que llega de la action se pinta tal cual, del mas reciente al mas antiguo.
 */
export function BatchHistory({ batchId, batchLot, open, onOpenChange }: BatchHistoryProps) {
  const [state, setState] = useState<LoadState>({ status: 'idle' });

  if (open && state.status === 'idle') setState({ status: 'queued' });

  const sendQueuedRequest = useEffectEvent(() => {
    void listBatchMovementsAction(batchId).then((result) => {
      setState(result.status === 'success' ? { status: 'success', data: result.data } : result);
    });
  });

  useEffect(() => {
    if (state.status === 'queued') sendQueuedRequest();
  }, [state.status]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="batch-history-dialog"
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[min(1000px,calc(100%-2rem))]"
        showCloseButton={false}
      >
        {/* El cierre del primitivo mide 32 px: en el teléfono hace falta el objetivo de 44. */}
        <DialogClose
          render={<Button type="button" variant="ghost" size="icon" touch className="absolute top-2 right-2" />}
        >
          <XIcon aria-hidden="true" />
          <span className="sr-only">{CLOSE_LABEL}</span>
        </DialogClose>
        <DialogHeader className="pr-10">
          <DialogTitle>
            {HISTORY_TITLE}{' '}
            <span className="font-mono tabular-nums" data-testid="batch-history-lot">
              {batchLot}
            </span>
          </DialogTitle>
        </DialogHeader>

        {state.status === 'queued' ? (
          <p data-testid="batch-history-loading">{LOADING_MESSAGE}</p>
        ) : null}

        {state.status === 'error' ? (
          <p role="alert" data-testid="batch-history-error">
            {state.message}
          </p>
        ) : null}

        {state.status === 'success' && state.data.length === 0 ? (
          <p data-testid="batch-history-before-ledger">{BEFORE_LEDGER_MESSAGE}</p>
        ) : null}

        {state.status === 'success' && state.data.length > 0 ? <BatchHistoryTable entries={state.data} /> : null}
      </DialogContent>
    </Dialog>
  );
}
