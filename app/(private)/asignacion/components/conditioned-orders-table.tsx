'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useTransition } from 'react';

import { DataTable, type DataTableParams, type DataTableTexts } from '@/components/shared/data-table';
import type { AssignmentViewKind, FinishedOrderView } from '@/lib/modules/asignaciones';

import { assignedOrdersListHref } from './assigned-orders-list-params';
import { buildConditionedOrdersColumns } from './conditioned-orders-columns';
import { FINISHED_ORDERS_CARD } from './finished-orders-columns';

export const CONDITIONED_ORDERS_TABLE_ID = 'asignacion-acondicionados';

/** `search` es obligatorio en el contrato de textos aunque `searchable={false}` no lo pinte. */
export const CONDITIONED_ORDERS_TABLE_TEXTS: DataTableTexts = {
  empty: 'No hay pedidos terminados que mostrar.',
  loading: 'Cargando pedidos terminados…',
  error: 'No se pudo cargar la lista de pedidos terminados.',
  search: 'Buscar',
  filters: 'Filtros',
  columnMenu: 'opciones de la columna',
  previousPage: 'Página anterior',
  nextPage: 'Página siguiente',
  pageIndicator: (page, totalPages) => `Página ${page} de ${totalPages}`,
  pageSize: 'Pedidos por página',
  sortAscending: 'Orden ascendente',
  sortDescending: 'Orden descendente',
  pinColumn: 'Fijar columna',
  unpinColumn: 'Soltar columna',
  filterColumn: 'Filtrar columna',
  clearFilter: 'Limpiar filtro',
  lastWeek: 'Última semana',
  lastMonth: 'Último mes',
  lastYear: 'Último año',
};

export type ConditionedOrdersTableProps = {
  readonly rows: readonly FinishedOrderView[];
  readonly params: DataTableParams;
  readonly totalPages: number;
  /** La vista a la que vuelve al paginar: «Terminados» y «Entregados» comparten tabla. */
  readonly view?: Extract<AssignmentViewKind, 'acondicionados' | 'acondicionados_entregados'>;
  readonly canViewTrace?: boolean;
};

export function ConditionedOrdersTable({
  rows,
  params,
  totalPages,
  view = 'acondicionados',
  canViewTrace = false,
}: ConditionedOrdersTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const columns = useMemo(() => buildConditionedOrdersColumns({ canViewTrace }), [canViewTrace]);

  const navigate = (href: string) => {
    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <div
      data-testid="conditioned-orders-table"
      aria-busy={isPending}
      className={isPending ? 'opacity-60 transition-opacity' : 'transition-opacity'}
    >
      {isPending ? (
        <p className="text-xs text-muted-foreground">{CONDITIONED_ORDERS_TABLE_TEXTS.loading}</p>
      ) : null}
      <DataTable
        tableId={CONDITIONED_ORDERS_TABLE_ID}
        columns={columns}
        rows={rows}
        getRowId={(order) => order.id}
        params={params}
        totalPages={totalPages}
        onParamsChange={(next) => navigate(assignedOrdersListHref(next, view))}
        status="idle"
        texts={CONDITIONED_ORDERS_TABLE_TEXTS}
        searchable={false}
        card={FINISHED_ORDERS_CARD}
      />
    </div>
  );
}
