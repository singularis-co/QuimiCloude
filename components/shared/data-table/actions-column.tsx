import type { ReactNode } from 'react';

import { RowActionsMenu } from '@/components/shared/row-actions-menu';

import type { DataTableColumn, RowActionsSpec } from './data-table-types';

export type { RowActionsSpec } from './data-table-types';

const ACTIONS_COLUMN_ID = 'actions';

const ACTIONS_COLUMN_LABEL = 'Acciones';

export type ActionsColumnOptions<T> = {
  readonly id?: string;
  readonly label?: string;
  readonly align?: 'end';
  /** Sin valor, la columna no se puede fijar: asi no tapa las columnas de datos. */
  readonly defaultPinned?: 'right';
} & (
  | { readonly cell: (row: T) => ReactNode; readonly menu?: undefined }
  /** Con `menu`, la tarjeta de la fila tiene de dónde sacar sus acciones. */
  | { readonly menu: (row: T) => RowActionsSpec; readonly cell?: undefined }
);

function withMenu<T, C extends object>(common: C, menu: (row: T) => RowActionsSpec) {
  return { ...common, cell: (row: T) => <RowActionsMenu {...menu(row)} />, menu };
}

/** Columna de acciones por fila: no ordena ni filtra. */
export function actionsColumn<T>(opts: ActionsColumnOptions<T>): DataTableColumn<T> {
  const common = {
    id: opts.id ?? ACTIONS_COLUMN_ID,
    label: opts.label ?? ACTIONS_COLUMN_LABEL,
    align: opts.align ?? 'end',
  } as const;

  const base = opts.menu === undefined ? { ...common, cell: opts.cell } : withMenu(common, opts.menu);

  return opts.defaultPinned === undefined
    ? { ...base, pinnable: false }
    : { ...base, defaultPinned: opts.defaultPinned };
}
