import type { DataTableParams } from '@/components/shared/data-table';
import { asignaciones, identity, observabilidad } from '@/lib/composition';
import { AsignacionesError, type Actor } from '@/lib/modules/asignaciones';
import { createErrorStateTranslator } from '@/lib/modules/errores';
import { runInRequestScope } from '@/lib/shared/request-scope';

import { assignedOrdersListHref } from './assigned-orders-list-params';
import {
  AssignmentListEmpty,
  AssignmentListError,
  AssignmentListSectionFrame,
  firstPageHrefWhenPast,
} from './assignment-list-parts';
import { FIRST_PAGE } from './assignment-view-params';
import { PackingOrdersTable } from './packing-orders-table';

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
  readonly canViewTrace?: boolean;
};

/**
 * `/asignacion?vista=por_empacar`: los `POR_EMPACAR` y `EN_EMPAQUE` de toda la empresa, con el
 * mismo orden y los mismos tamaños de página que la lista de trabajo.
 */
export async function PackingOrdersListSection({
  params,
  canViewTrace = false,
}: PackingOrdersListSectionProps) {
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
        <AssignmentListEmpty
          testIdPrefix="packing-orders"
          message="No hay pedidos por empacar en tu empresa."
          firstPageHref={firstPageHrefWhenPast(currentPage, FIRST_PAGE, () =>
            assignedOrdersListHref({ ...params, page: FIRST_PAGE }, 'por_empacar'),
          )}
        />
      </AssignmentListSectionFrame>
    );
  }

  return (
    <AssignmentListSectionFrame testId={PACKING_ORDERS_SECTION_TESTID}>
      <PackingOrdersTable
        rows={items}
        params={params}
        totalPages={totalPages}
        canViewTrace={canViewTrace}
      />
    </AssignmentListSectionFrame>
  );
}
