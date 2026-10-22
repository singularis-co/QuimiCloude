'use client';

import { ArrowRightIcon, RouteIcon } from 'lucide-react';

import { actionsColumn, type DataTableColumn, type RowActionsSpec } from '@/components/shared/data-table';
import { RowActionsMenu, type RowActionMenuItem } from '@/components/shared/row-actions-menu';
import { executionTraceRoute } from '@/lib/shared/routes';

export const ASSIGNMENT_ROW_ACTIONS_TESTID = 'assignment-row-actions';
export const ASSIGNMENT_ROW_ENTER_TESTID = 'assignment-row-enter';
export const ASSIGNMENT_ROW_TRACE_TESTID = 'assignment-row-trace';

export const ASSIGNMENT_ROW_ACTIONS_TEXTS = {
  enter: 'Entrar',
  trace: 'Ver recorrido',
  triggerLabelPrefix: 'Acciones del pedido ',
  titlePrefix: 'Pedido ',
} as const;

/** Solo datos serializables: el icono lo pone este componente, que ya vive en el cliente. */
export type AssignmentRowActionsProps = {
  readonly orderNumber: string;
  /** Sin valor, el menú no ofrece «Entrar». */
  readonly enterHref?: string;
  /** Sin valor, el menú no ofrece «Ver recorrido». */
  readonly traceHref?: string;
};

export function assignmentRowActions({
  orderNumber,
  enterHref,
  traceHref,
}: AssignmentRowActionsProps): RowActionsSpec {
  const items: RowActionMenuItem[] = [];
  if (enterHref !== undefined) {
    items.push({
      key: 'enter',
      label: ASSIGNMENT_ROW_ACTIONS_TEXTS.enter,
      icon: ArrowRightIcon,
      href: enterHref,
      testId: ASSIGNMENT_ROW_ENTER_TESTID,
    });
  }
  if (traceHref !== undefined) {
    items.push({
      key: 'trace',
      label: ASSIGNMENT_ROW_ACTIONS_TEXTS.trace,
      icon: RouteIcon,
      href: traceHref,
      testId: ASSIGNMENT_ROW_TRACE_TESTID,
    });
  }
  return {
    items,
    triggerLabel: `${ASSIGNMENT_ROW_ACTIONS_TEXTS.triggerLabelPrefix}${orderNumber}`,
    triggerTestId: ASSIGNMENT_ROW_ACTIONS_TESTID,
    title: (
      <span>
        {ASSIGNMENT_ROW_ACTIONS_TEXTS.titlePrefix}
        <span className="font-mono">{orderNumber}</span>
      </span>
    ),
  };
}

export function AssignmentRowActions(props: AssignmentRowActionsProps) {
  return <RowActionsMenu {...assignmentRowActions(props)} />;
}

export type AssignmentActionsColumnOptions<TRow> = {
  readonly canViewTrace: boolean;
  /** Sin valor, ninguna fila ofrece «Entrar» en el menú. */
  readonly enterHref?: (row: TRow) => string;
};

/** Con `menu`, `DataTable` saca de aquí también el «Acciones» de la tarjeta. */
export function assignmentActionsColumn<TRow extends { readonly id: string; readonly numberText: string }>({
  canViewTrace,
  enterHref,
}: AssignmentActionsColumnOptions<TRow>): DataTableColumn<TRow> {
  return actionsColumn<TRow>({
    menu: (row) =>
      assignmentRowActions({
        orderNumber: row.numberText,
        enterHref: enterHref?.(row),
        traceHref: canViewTrace ? executionTraceRoute(row.id) : undefined,
      }),
  });
}
