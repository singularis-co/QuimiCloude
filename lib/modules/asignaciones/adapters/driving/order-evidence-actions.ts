'use server';

/**
 * Las fotos de un pedido vistas desde fuera del recorrido. Esta capa no decide nada: resuelve el
 * actor y traduce el error por su `code`. Ningun permiso se comprueba aqui.
 *
 * No se reexporta desde el barril del modulo: un `'use server'` en su cierre de imports lo
 * volveria inimportable desde un componente de cliente.
 */

import { asignaciones, identity, observabilidad } from '@/lib/composition';
import { createErrorStateTranslator, type ErrorState } from '@/lib/modules/errores';
import {
  AsignacionesError,
  type Actor,
  type OrderEvidence,
  type OrderEvidenceCount,
} from '@/lib/modules/asignaciones';
import { runInRequestScope } from '@/lib/shared/request-scope';

const toErrorState = createErrorStateTranslator(
  AsignacionesError,
  observabilidad.readRequestIdHeader,
);

/** El actor, de las dos caras de la sesion, compartiendo una sola lectura por peticion. */
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

export type OrderEvidenceResult = { status: 'success'; data: OrderEvidence } | ErrorState;

/** Un pedido inexistente o de otra empresa vuelve como `order_not_found`. */
export async function getOrderEvidenceAction(orderId: string): Promise<OrderEvidenceResult> {
  const actor = await currentActor();

  try {
    const { evidence } = await asignaciones.getOrderEvidence(actor, { orderId });
    return { status: 'success', data: evidence };
  } catch (error) {
    return toErrorState(error);
  }
}

export type OrderEvidenceCountResult =
  | { status: 'success'; data: readonly OrderEvidenceCount[] }
  | ErrorState;

/** Solo salen los pedidos con alguna foto. */
export async function countOrderEvidenceAction(
  orderIds: readonly string[],
): Promise<OrderEvidenceCountResult> {
  const actor = await currentActor();

  try {
    const data = await asignaciones.countOrderEvidence(actor, { orderIds });
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}
