'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useTransition } from 'react';

import { DataTable, type DataTableParams, type DataTableTexts } from '@/components/shared/data-table';
import type { PackingOrderRow } from '@/lib/modules/asignaciones';

import { assignedOrdersListHref } from './assigned-orders-list-params';
import { PACKING_ORDERS_CARD, buildPackingOrdersColumns } from './packing-orders-columns';

export const PACKING_ORDERS_TABLE_ID = 'asignacion-por-empacar';

/** `search` es obligatorio en el contrato de textos aunque `searchable={false}` no lo pinte. */
export const PACKING_ORDERS_TABLE_TEXTS: DataTableTexts = {
  empty: 'No hay pedidos por empacar en tu empresa.',
  loading: 'Cargando pedidos por empacar…',
  error: 'No se pudo cargar la lista de pedidos por empacar.',
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

export type PackingOrdersTableProps = {
  readonly rows: readonly PackingOrderRow[];
  readonly params: DataTableParams;
  readonly totalPages: number;
  readonly canViewTrace?: boolean;
};

export function PackingOrdersTable({
  rows,
  params,
  totalPages,
  canViewTrace = false,
}: PackingOrdersTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const columns = useMemo(() => buildPackingOrdersColumns({ canViewTrace }), [canViewTrace]);

  const navigate = (href: string) => {
    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <div
      data-testid="packing-orders-table"
      aria-busy={isPending}
      className={isPending ? 'opacity-60 transition-opacity' : 'transition-opacity'}
    >
      {isPending ? (
        <p className="text-xs text-muted-foreground">{PACKING_ORDERS_TABLE_TEXTS.loading}</p>
      ) : null}
      <DataTable
        tableId={PACKING_ORDERS_TABLE_ID}
        columns={columns}
        rows={rows}
        getRowId={(order) => order.id}
        params={params}
        totalPages={totalPages}
        onParamsChange={(next) => navigate(assignedOrdersListHref(next, 'por_empacar'))}
        status="idle"
        texts={PACKING_ORDERS_TABLE_TEXTS}
        searchable={false}
        card={PACKING_ORDERS_CARD}
      />
    </div>
  );
}
