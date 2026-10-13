import type { DataTableParams } from '@/components/shared/data-table';
import { asignaciones, identity, observabilidad } from '@/lib/composition';
import { AsignacionesError, type Actor } from '@/lib/modules/asignaciones';
import { createErrorStateTranslator } from '@/lib/modules/errores';
import { runInRequestScope } from '@/lib/shared/request-scope';

import { assignedOrdersListHref } from './assigned-orders-list-params';
import { AssignmentListError, firstPageHrefWhenPast } from './assignment-list-parts';
import { FIRST_PAGE } from './assignment-view-params';
import { ConditionedOrdersTable } from './conditioned-orders-table';
import { CONDITIONING_ORDERS_EMPTY_TEXTS, ConditioningOrdersEmpty } from './conditioning-orders-empty';

export const DELIVERED_CONDITIONED_ORDERS_SECTION_TESTID = 'delivered-conditioned-orders-list-section';
export const DELIVERED_CONDITIONED_ORDERS_EMPTY_TEXT =
  CONDITIONING_ORDERS_EMPTY_TEXTS.acondicionados_entregados;

const toErrorState = createErrorStateTranslator(
  AsignacionesError,
  observabilidad.readRequestIdHeader,
);

/**
 * El actor, de las dos caras de la sesion, calcado del de `conditioned-orders-list-section.tsx`:
 * cada adaptador driving arma el suyo, no hay una version compartida.
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

type DeliveredConditionedOrdersListSectionProps = {
  /** Ya acotados por `parseAssignmentListParams`. */
  readonly params: DataTableParams;
};

/** `/asignacion?vista=acondicionados_entregados`: los `ENTREGADO` que acondicionó el propio actor. */
export async function DeliveredConditionedOrdersListSection({
  params,
}: DeliveredConditionedOrdersListSectionProps) {
  const actor = await currentActor();

  let result;
  try {
    result = await asignaciones.listDeliveredConditionedOrders(actor, {
      page: params.page,
      pageSize: params.pageSize,
    });
  } catch (error) {
    return (
      <div data-testid={DELIVERED_CONDITIONED_ORDERS_SECTION_TESTID}>
        <AssignmentListError error={await toErrorState(error)} />
      </div>
    );
  }

  const { items, page: currentPage, totalPages } = result;

  if (items.length === 0) {
    return (
      <div data-testid={DELIVERED_CONDITIONED_ORDERS_SECTION_TESTID}>
        <ConditioningOrdersEmpty
          list="acondicionados_entregados"
          firstPageHref={firstPageHrefWhenPast(currentPage, FIRST_PAGE, () =>
            assignedOrdersListHref({ ...params, page: FIRST_PAGE }, 'acondicionados_entregados'),
          )}
        />
      </div>
    );
  }

  return (
    <div data-testid={DELIVERED_CONDITIONED_ORDERS_SECTION_TESTID}>
      <ConditionedOrdersTable
        rows={items}
        params={params}
        totalPages={totalPages}
        view="acondicionados_entregados"
      />
    </div>
  );
}
