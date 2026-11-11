'use server';

/**
 * Las fotos de una receta del pedido vistas desde fuera del recorrido. Esta capa no decide nada: resuelve el
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
  type LineEvidenceCount,
  type OrderEvidence,
} from '@/lib/modules/asignaciones';
import { forModule } from '@/lib/shared/observability/logger';
import { runInRequestScope } from '@/lib/shared/request-scope';

const toErrorState = createErrorStateTranslator(
  AsignacionesError,
  observabilidad.readRequestIdHeader,
);

const log = forModule('asignaciones');

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

/** Una linea de otro pedido, de otra empresa o inexistente vuelve como `order_not_found`. */
export async function getLineEvidenceAction(orderId: string, lineId: string): Promise<OrderEvidenceResult> {
  const actor = await currentActor();

  try {
    const { evidence, signingFailure } = await asignaciones.getLineEvidence(actor, { orderId, lineId });
    // La firma caida no es un error de la lectura: los grupos salen sin fotos y la causa, al log.
    if (signingFailure !== null) {
      log.warn('evidence_read_signing_failed', { orderId, lineId, message: signingFailure });
    }
    return { status: 'success', data: evidence };
  } catch (error) {
    return toErrorState(error);
  }
}

export type LineEvidenceCountResult =
  | { status: 'success'; data: readonly LineEvidenceCount[] }
  | ErrorState;

/** Solo salen las lineas con alguna foto. */
export async function countLineEvidenceAction(
  lines: readonly { orderId: string; lineId: string }[],
): Promise<LineEvidenceCountResult> {
  const actor = await currentActor();

  try {
    const data = await asignaciones.countLineEvidence(actor, { lines });
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}
