import Link from 'next/link';

import type { DataTableParams } from '@/components/shared/data-table';
import { buttonVariants } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { asignaciones, identity, observabilidad } from '@/lib/composition';
import { AsignacionesError, type Actor } from '@/lib/modules/asignaciones';
import { createErrorStateTranslator } from '@/lib/modules/errores';
import { runInRequestScope } from '@/lib/shared/request-scope';
import { cn } from '@/lib/utils';

import { assignedOrdersListHref } from './assigned-orders-list-params';
import { AssignmentListError, AssignmentListSectionFrame } from './assignment-list-parts';
import { FIRST_PAGE } from './assignment-view-params';
import { buildPackingOrdersColumns } from './packing-orders-columns';

export const PACKING_ORDERS_SECTION_TESTID = 'packing-orders-list-section';

const toErrorState = createErrorStateTranslator(
  AsignacionesError,
  observabilidad.readRequestIdHeader,
);

/**
 * El actor, de las dos caras de la sesion, calcado del que arman las Server Actions de este
 * modulo: no hay una version compartida porque cada adaptador driving arma la suya.
 */
async function currentActor(): Promise<Actor | null> {
  const [sessionUser, sessionContext] = await runInRequestScope(() =>
    Promise.all([identity.getSessionUser(), identity.getSessionContext()]),
  );
  if (sessionUser === null || sessionContext === null) return null;
  return {
    id: sessionUser.id,
    companyId: sessionContext.companyId,
    permissions: sessionUser.permissions,
  };
}

type PackingOrdersListSectionProps = {
  /** Ya acotados por `parseAssignmentListParams`. */
  readonly params: DataTableParams;
};

/**
 * `/asignacion?vista=por_empacar`: los `POR_EMPACAR` y `EN_EMPAQUE` de toda la empresa, con el
 * mismo orden y los mismos tamaños de página que la lista de trabajo.
 *
 * Sin `<DataTable>`: esta lista no ordena ni filtra por columna, así que una tabla servida por el
 * servidor con paginación por enlace basta y evita un componente de cliente entero.
 */
export async function PackingOrdersListSection({ params }: PackingOrdersListSectionProps) {
  const actor = await currentActor();

  let items;
  let currentPage: number;
  let totalPages: number;
  try {
    const result = await asignaciones.listPackingOrders(actor, {
      page: params.page,
      pageSize: params.pageSize,
    });
    items = result.items;
    currentPage = result.page;
    totalPages = result.totalPages;
  } catch (error) {
    return (
      <AssignmentListSectionFrame testId={PACKING_ORDERS_SECTION_TESTID}>
        <AssignmentListError error={await toErrorState(error)} />
      </AssignmentListSectionFrame>
    );
  }

  if (items.length === 0) {
    return (
      <AssignmentListSectionFrame testId={PACKING_ORDERS_SECTION_TESTID}>
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground" data-testid="packing-orders-empty-message">
            {currentPage > FIRST_PAGE
              ? 'Esta página ya no tiene pedidos.'
              : 'No hay pedidos por empacar en tu empresa.'}
          </p>
          {currentPage > FIRST_PAGE ? (
            <Link
              href={assignedOrdersListHref({ ...params, page: FIRST_PAGE }, 'por_empacar')}
              data-slot="button"
              data-testid="packing-orders-first-page"
              className={cn(buttonVariants({ variant: 'outline', touch: true }))}
            >
              Volver a la primera página
            </Link>
          ) : null}
        </div>
      </AssignmentListSectionFrame>
    );
  }

  const columns = buildPackingOrdersColumns();
  const hasPrevious = currentPage > FIRST_PAGE;
  const hasNext = currentPage < totalPages;

  return (
    <AssignmentListSectionFrame testId={PACKING_ORDERS_SECTION_TESTID} className="flex flex-col gap-4">
      <Table data-testid="packing-orders-table">
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.id} scope="col">
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((order) => (
            <TableRow key={order.id} data-testid="packing-order-row">
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  className={cn(column.tabular === true && 'font-mono tabular-nums')}
                >
                  {column.cell(order)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground" data-testid="packing-orders-page-indicator">
          {`Página ${currentPage} de ${totalPages}`}
        </span>
        <div className="flex gap-2">
          <Link
            aria-disabled={!hasPrevious}
            href={assignedOrdersListHref(
              { ...params, page: Math.max(FIRST_PAGE, currentPage - 1) },
              'por_empacar',
            )}
            data-slot="button"
            data-testid="packing-orders-prev-page"
            className={cn(
              buttonVariants({ variant: 'outline', touch: true }),
              hasPrevious ? undefined : 'pointer-events-none opacity-50',
            )}
          >
            Página anterior
          </Link>
          <Link
            aria-disabled={!hasNext}
            href={assignedOrdersListHref(
              { ...params, page: Math.min(totalPages, currentPage + 1) },
              'por_empacar',
            )}
            data-slot="button"
            data-testid="packing-orders-next-page"
            className={cn(
              buttonVariants({ variant: 'outline', touch: true }),
              hasNext ? undefined : 'pointer-events-none opacity-50',
            )}
          >
            Página siguiente
          </Link>
        </div>
      </div>
    </AssignmentListSectionFrame>
  );
}
