'use client';

import { RouteIcon } from 'lucide-react';

import { actionsColumn, type DataTableColumn } from '@/components/shared/data-table';
import { ResponsibleAvatars } from '@/components/shared/responsible-avatars';
import { StatusBadge } from '@/components/shared/status-badge';
import type { ExecutionTracePerson, ExecutionTraceRow } from '@/lib/modules/asignaciones';
import { ORDER_STATUS_TONES } from '@/lib/shared/ui/order-status';

import {
  ACTIVE_ORDER_MARK,
  DELETED_ORDER_MARK,
  TRACE_ORDER_STATUS_LABELS,
  formatTraceDuration,
  formatTraceInstant,
} from './execution-trace-format';
import {
  LAST_AT_COLUMN_ID,
  PERSON_COLUMN_ID,
  executionTraceDetailHref,
  type ExecutionTraceListParams,
} from './execution-trace-list-params';

export const TRACE_NUMBER_COLUMN_ID = 'orderNumber';
export const TRACE_STATUS_COLUMN_ID = 'status';
export const TRACE_FIRST_AT_COLUMN_ID = 'firstAt';
export const TRACE_DURATION_COLUMN_ID = 'duration';
export const TRACE_GO_BACK_COLUMN_ID = 'goBackCount';

export const TRACE_LINK_TEXT = 'Ver recorrido';
export const TRACE_ACTIONS_LABEL_PREFIX = 'Acciones del pedido ';
export const TRACE_MENU_TITLE_PREFIX = 'Pedido ';

export function DeletedOrderMark() {
  return <StatusBadge tone="muted" label={DELETED_ORDER_MARK} data-testid="execution-trace-deleted" />;
}

/** Solo la lleva un pedido cuya duración sigue abierta, nunca uno dado de baja. */
export function ActiveOrderMark() {
  return <StatusBadge tone="progress" label={ACTIVE_ORDER_MARK} data-testid="execution-trace-active" />;
}

export type ExecutionTraceColumnsDeps = {
  readonly personOptions: readonly ExecutionTracePerson[];
  readonly params: ExecutionTraceListParams;
};

export function buildExecutionTraceColumns({
  personOptions,
  params,
}: ExecutionTraceColumnsDeps): readonly DataTableColumn<ExecutionTraceRow>[] {
  return [
    {
      id: TRACE_NUMBER_COLUMN_ID,
      label: 'Nº de pedido',
      align: 'start',
      defaultPinned: 'left',
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <span data-testid="execution-trace-number">{row.numberText}</span>
          {row.deleted ? <DeletedOrderMark /> : null}
          {!row.deleted && row.duration.kind === 'open' ? <ActiveOrderMark /> : null}
        </span>
      ),
    },
    {
      id: TRACE_STATUS_COLUMN_ID,
      label: 'Estado',
      align: 'start',
      cell: (row) => (
        <StatusBadge
          tone={ORDER_STATUS_TONES[row.status]}
          label={TRACE_ORDER_STATUS_LABELS[row.status]}
          data-testid="execution-trace-status"
          data-status={row.status}
        />
      ),
    },
    {
      id: PERSON_COLUMN_ID,
      label: 'Personas',
      align: 'start',
      filter: {
        kind: 'select',
        options: personOptions.map((person) => ({ value: person.userId, label: person.displayName })),
      },
      cell: (row) => <ResponsibleAvatars responsibles={row.people} />,
    },
    {
      id: TRACE_FIRST_AT_COLUMN_ID,
      label: 'Primera anotación',
      tabular: true,
      align: 'end',
      cell: (row) => formatTraceInstant(row.firstAt),
    },
    {
      id: LAST_AT_COLUMN_ID,
      label: 'Última anotación',
      tabular: true,
      align: 'end',
      filter: { kind: 'dateRange' },
      cell: (row) => formatTraceInstant(row.lastAt),
    },
    {
      id: TRACE_DURATION_COLUMN_ID,
      label: 'Duración',
      tabular: true,
      align: 'end',
      cell: (row) => (
        <span data-testid="execution-trace-duration" data-kind={row.duration.kind}>
          {formatTraceDuration(row.duration)}
        </span>
      ),
    },
    {
      id: TRACE_GO_BACK_COLUMN_ID,
      label: 'Vueltas atrás',
      align: 'end',
      cell: (row) =>
        row.goBackCount > 0 ? (
          <StatusBadge
            tone="waiting"
            label={String(row.goBackCount)}
            data-testid="execution-trace-go-backs"
            className="font-mono tabular-nums"
          />
        ) : (
          <span
            data-testid="execution-trace-go-backs"
            className="font-mono text-muted-foreground tabular-nums"
          >
            {row.goBackCount}
          </span>
        ),
    },
    actionsColumn<ExecutionTraceRow>({
      menu: (row) => ({
        triggerLabel: `${TRACE_ACTIONS_LABEL_PREFIX}${row.numberText}`,
        title: (
          <span>
            {TRACE_MENU_TITLE_PREFIX}
            <span className="font-mono">{row.numberText}</span>
          </span>
        ),
        triggerTestId: 'execution-trace-actions',
        items: [
          {
            key: 'trace',
            label: TRACE_LINK_TEXT,
            icon: RouteIcon,
            href: executionTraceDetailHref(row.orderId, params),
            testId: 'execution-trace-link',
          },
        ],
      }),
    }),
  ];
}
