import { asignaciones, identity } from '@/lib/composition';
import type { Actor } from '@/lib/modules/asignaciones';
import { runInRequestScope } from '@/lib/shared/request-scope';

import { readViewCounts } from './assignment-view-counts';
import { AssignmentViewTabs, type AssignmentViewTabsProps } from './assignment-view-tabs';

/** Calcado del de las secciones de lista: cada una arma el suyo, no hay una versión compartida. */
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

/** Las pestañas con el total de cada vista. */
export async function AssignmentViewTabsSection({
  current,
  views,
}: Omit<AssignmentViewTabsProps, 'counts'>) {
  const actor = await currentActor();
  const counts = await readViewCounts(views, {
    asignados: (query) => asignaciones.listAssignedOrders(actor, query),
    terminados: (query) => asignaciones.listFinishedOrders(actor, query),
    todos: (query) => asignaciones.listCompanyOrders(actor, query),
    por_empacar: (query) => asignaciones.listPackingOrders(actor, query),
    por_acondicionar: (query) => asignaciones.listConditioningOrders(actor, query),
    acondicionados: (query) => asignaciones.listConditionedOrders(actor, query),
    acondicionados_entregados: (query) => asignaciones.listDeliveredConditionedOrders(actor, query),
  });

  return <AssignmentViewTabs current={current} views={views} counts={counts} />;
}
