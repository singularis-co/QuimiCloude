import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PageHeader } from '@/components/shared/page-header';
import { PageShell } from '@/components/shared/page-shell';
import { identity } from '@/lib/composition';
import {
  canExecuteAssignedOrders,
  resolveAssignmentView,
  resolveAssignmentViews,
} from '@/lib/modules/asignaciones';
import { assertPermission, type PermissionBearer } from '@/lib/modules/identity';
import { requirePagePermission } from '@/lib/modules/identity/adapters/driving/require-page-permission';
import { ASSIGNED_ORDERS_LABEL, BRAND_LABEL } from '@/lib/shared/navigation/private-nav';
import {
  CANCELLED_ORDER_PARAM,
  CONDITIONED_ORDER_PARAM,
  DELIVERED_ORDER_PACKAGES_PARAM,
  DELIVERED_ORDER_PARAM,
  DELIVERED_ORDER_PRODUCT_PARAM,
  PACKED_ORDER_PARAM,
} from '@/lib/shared/routes';

import {
  AssignedOrdersListSection,
  AssignedOrdersSkeleton,
  AssignmentViewTabs,
  AssignmentViewTabsSection,
  CompanyOrdersListSection,
  CompanyOrdersSkeleton,
  ConditionedOrdersListSection,
  ConditioningOrdersListSection,
  ConditioningOrdersSkeleton,
  DeliveredConditionedOrdersListSection,
  FinishedOrdersListSection,
  FinishedOrdersSkeleton,
  OrderOutcomeNotice,
  PackingOrdersListSection,
  PackingOrdersSkeleton,
  VIEW_PARAM,
  isExactlyDelivered,
  parseAssignedOrdersListParams,
  parseAssignmentListParams,
  parseStatusFilter,
  type AssignedOrdersSearchParams,
} from './components';

/** El App Router entrega un array cuando el parametro viene repetido: la primera basta aqui. */
function firstSearchParamValue(raw: string | readonly string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  return typeof raw === 'string' ? raw : raw[0];
}

const PERMISO_DENEGADO = new Error('permiso denegado');

/**
 * Presentación, no autorización: solo decide si el menú de cada fila ofrece «Ver recorrido». La
 * pertenencia la resuelve `assertPermission`, como en las vistas de `resolveAssignmentViews`.
 */
function canViewExecutionTrace(sessionUser: PermissionBearer | null): boolean {
  try {
    assertPermission(sessionUser, 'dashboard.consultar', () => PERMISO_DENEGADO);
    return true;
  } catch (error) {
    if (error !== PERMISO_DENEGADO) throw error;
    return false;
  }
}

export const metadata: Metadata = {
  title: `${ASSIGNED_ORDERS_LABEL} · ${BRAND_LABEL}`,
};

export default async function AsignacionPage({
  searchParams,
}: {
  searchParams: Promise<AssignedOrdersSearchParams>;
}) {
  // El corte por permiso va antes de resolver `searchParams`: sin permiso no se procesa ni la
  // entrada.
  await requirePagePermission('asignaciones.consultar');

  const resolvedSearchParams = await searchParams;

  // Misma lectura de sesion de la peticion que `requirePagePermission`: `getSessionUser` esta
  // memoizado por peticion, asi que esto no es una segunda consulta a la base.
  const sessionUser = await identity.getSessionUser();
  const views = resolveAssignmentViews(sessionUser);
  const canExecute = canExecuteAssignedOrders(sessionUser);
  const canViewTrace = canViewExecutionTrace(sessionUser);
  const vista = resolveAssignmentView(firstSearchParamValue(resolvedSearchParams[VIEW_PARAM]), views);

  const deliveredOrderNumber = firstSearchParamValue(
    resolvedSearchParams[DELIVERED_ORDER_PARAM],
  );
  const deliveredOrderPackages = firstSearchParamValue(
    resolvedSearchParams[DELIVERED_ORDER_PACKAGES_PARAM],
  );
  const deliveredOrderProductName = firstSearchParamValue(
    resolvedSearchParams[DELIVERED_ORDER_PRODUCT_PARAM],
  );
  const packedOrderNumber = firstSearchParamValue(resolvedSearchParams[PACKED_ORDER_PARAM]);
  const conditionedOrderNumber = firstSearchParamValue(resolvedSearchParams[CONDITIONED_ORDER_PARAM]);
  const cancelledOrderNumber = firstSearchParamValue(resolvedSearchParams[CANCELLED_ORDER_PARAM]);

  const assignedOrdersParams = parseAssignedOrdersListParams(resolvedSearchParams);
  const genericListParams = parseAssignmentListParams(resolvedSearchParams);
  const statuses = parseStatusFilter(resolvedSearchParams);

  return (
    <PageShell>
      <PageHeader title={ASSIGNED_ORDERS_LABEL} titleTestId="asignacion-title" />
      {deliveredOrderNumber !== undefined ? (
        <OrderOutcomeNotice
          kind="delivered"
          orderNumber={deliveredOrderNumber}
          packages={deliveredOrderPackages}
          productName={deliveredOrderProductName}
        />
      ) : null}
      {cancelledOrderNumber !== undefined ? (
        <OrderOutcomeNotice kind="cancelled" orderNumber={cancelledOrderNumber} />
      ) : null}
      {vista === 'por_empacar' && packedOrderNumber !== undefined ? (
        <OrderOutcomeNotice kind="packed" orderNumber={packedOrderNumber} />
      ) : null}
      {vista === 'por_acondicionar' && conditionedOrderNumber !== undefined ? (
        <OrderOutcomeNotice kind="conditioned" orderNumber={conditionedOrderNumber} />
      ) : null}
      {views.length > 1 ? (
        <Suspense fallback={<AssignmentViewTabs current={vista} views={views} />}>
          <AssignmentViewTabsSection current={vista} views={views} />
        </Suspense>
      ) : null}
      {vista === 'asignados' ? (
        <Suspense
          fallback={
            <AssignedOrdersSkeleton rows={assignedOrdersParams.pageSize} canExecute={canExecute} />
          }
        >
          <AssignedOrdersListSection
            params={assignedOrdersParams}
            vista={vista}
            canExecute={canExecute}
            canViewTrace={canViewTrace}
          />
        </Suspense>
      ) : null}
      {vista === 'terminados' ? (
        <Suspense fallback={<FinishedOrdersSkeleton rows={genericListParams.pageSize} />}>
          <FinishedOrdersListSection params={genericListParams} canViewTrace={canViewTrace} />
        </Suspense>
      ) : null}
      {vista === 'todos' ? (
        <Suspense
          fallback={
            <CompanyOrdersSkeleton
              rows={genericListParams.pageSize}
              showFinishedAt={isExactlyDelivered(statuses)}
            />
          }
        >
          <CompanyOrdersListSection
            params={genericListParams}
            statuses={statuses}
            canViewTrace={canViewTrace}
          />
        </Suspense>
      ) : null}
      {vista === 'por_empacar' ? (
        <Suspense fallback={<PackingOrdersSkeleton rows={genericListParams.pageSize} />}>
          <PackingOrdersListSection params={genericListParams} canViewTrace={canViewTrace} />
        </Suspense>
      ) : null}
      {vista === 'por_acondicionar' ? (
        <Suspense
          fallback={
            <ConditioningOrdersSkeleton rows={genericListParams.pageSize} list="por_acondicionar" />
          }
        >
          <ConditioningOrdersListSection params={genericListParams} canViewTrace={canViewTrace} />
        </Suspense>
      ) : null}
      {vista === 'acondicionados' ? (
        <Suspense
          fallback={
            <ConditioningOrdersSkeleton rows={genericListParams.pageSize} list="acondicionados" />
          }
        >
          <ConditionedOrdersListSection params={genericListParams} canViewTrace={canViewTrace} />
        </Suspense>
      ) : null}
      {vista === 'acondicionados_entregados' ? (
        <Suspense
          fallback={
            <ConditioningOrdersSkeleton
              rows={genericListParams.pageSize}
              list="acondicionados_entregados"
            />
          }
        >
          <DeliveredConditionedOrdersListSection
            params={genericListParams}
            canViewTrace={canViewTrace}
          />
        </Suspense>
      ) : null}
    </PageShell>
  );
}
