'use client';

import { Fragment, type ReactNode } from 'react';

import { RowActionsMenu } from '@/components/shared/row-actions-menu';
import { cn } from '@/lib/utils';

import type { DataTableCardLayout, DataTableColumn, DataTableTexts } from './data-table-types';

type DataTableCardsProps<TRow> = {
  readonly columns: readonly DataTableColumn<TRow>[];
  readonly rows: readonly TRow[];
  readonly getRowId: (row: TRow) => string;
  readonly layout: DataTableCardLayout;
  readonly texts: DataTableTexts;
  readonly className?: string;
};

export function DataTableCards<TRow>({
  columns,
  rows,
  getRowId,
  layout,
  texts,
  className,
}: DataTableCardsProps<TRow>) {
  const byId = new Map(columns.map((column) => [column.id, column]));
  const actionsColumn = columns.find((column) => column.menu !== undefined);
  const menuTexts = { actions: texts.cardActions, close: texts.closeMenu };

  function field(columnId: string | undefined, row: TRow, extraClass?: string): ReactNode {
    if (columnId === undefined) return null;
    const column = byId.get(columnId);
    if (column === undefined) return null;
    return (
      <span
        data-testid={`data-table-card-field-${column.id}`}
        className={cn(column.tabular === true && 'font-mono tabular-nums', extraClass)}
      >
        {column.cell(row)}
      </span>
    );
  }

  return (
    <ul data-testid="data-table-cards" className={cn('flex-col rounded-xl border border-border bg-card', className)}>
      {rows.map((row) => {
        const id = getRowId(row);
        const spec = actionsColumn?.menu?.(row);
        const hasActions = spec !== undefined && spec.items.length > 0;
        const hasFooter = layout.footer !== undefined || hasActions;
        return (
          <li
            key={id}
            data-testid={`data-table-card-${id}`}
            className="flex flex-col gap-2 border-b border-border px-4 py-3.5 last:border-b-0"
          >
            <div className="flex items-center justify-between gap-2.5">
              {field(layout.primary, row, 'font-mono font-semibold')}
              {field(layout.status, row)}
            </div>
            {field(layout.title, row, 'font-semibold')}
            {layout.meta !== undefined && layout.meta.length > 0 ? (
              <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[13px] text-muted-foreground">
                {layout.meta.map((columnId) => (
                  <Fragment key={columnId}>{field(columnId, row)}</Fragment>
                ))}
              </div>
            ) : null}
            {hasFooter ? (
              <div className="flex items-center justify-between gap-2.5">
                {field(layout.footer, row) ?? <span />}
                {hasActions ? <RowActionsMenu {...spec} presentation="centered" texts={menuTexts} /> : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
