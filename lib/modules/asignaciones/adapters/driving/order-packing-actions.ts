'use server';

/**
 * Las DOS Server Actions de la pantalla del pedido de empaque. Esta capa NO DECIDE NADA: resuelve
 * el actor de las dos caras de la sesion, traduce el `FormData` y traduce el error por su `code`,
 * calcada de `order-execution-actions.ts`.
 *
 * Archivo nuevo, importado por su RUTA EXACTA: no se reexporta desde el barrel del modulo porque
 * un `'use server'` en su cierre de imports lo volveria inimportable desde un componente de
 * cliente.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { asignaciones, identity, observabilidad } from '@/lib/composition';
import { createErrorStateTranslator, type ErrorState } from '@/lib/modules/errores';
import { AsignacionesError, type Actor } from '@/lib/modules/asignaciones';
import { ASSIGNED_ORDERS_ROUTE, PACKED_ORDER_PARAM, packingOrderRoute } from '@/lib/shared/routes';
import { runInRequestScope } from '@/lib/shared/request-scope';

const toErrorState = createErrorStateTranslator(
  AsignacionesError,
  observabilidad.readRequestIdHeader,
);

/** El actor, de las DOS caras de la sesion, compartiendo UNA sola lectura por peticion. */
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

function orderLineFromFormData(formData: FormData): { orderId: unknown; lineId: unknown } {
  return { orderId: formData.get('orderId'), lineId: formData.get('lineId') };
}

// `counts` llega como JSON porque es una lista de objetos; uno roto o ausente se deja `undefined`
// para que lo rechace el zod del caso de uso, no esta capa.
function finishPackingInputFromFormData(formData: FormData): unknown {
  const raw = formData.get('counts');
  let counts: unknown;
  if (typeof raw === 'string') {
    try {
      counts = JSON.parse(raw);
    } catch {
      counts = undefined;
    }
  }
  return { ...orderLineFromFormData(formData), counts };
}

export type StartPackingResult = { status: 'success' } | ErrorState;

/** Comienza el empaque de la receta —`POR_EMPACAR` a `EN_EMPAQUE`— y se queda en su pantalla. */
export async function startPackingAction(
  _prevState: StartPackingResult,
  formData: FormData,
): Promise<StartPackingResult> {
  const actor = await currentActor();

  try {
    await asignaciones.startPacking(actor, orderLineFromFormData(formData));
  } catch (error) {
    return toErrorState(error);
  }

  const { orderId, lineId } = orderLineFromFormData(formData);
  if (typeof orderId === 'string' && typeof lineId === 'string') revalidatePath(packingOrderRoute(orderId, lineId));
  return { status: 'success' };
}

export type FinishPackingResult = { status: 'success' } | ErrorState;

/** Deja la receta `POR_ACONDICIONAR` y vuelve a la pestaña «Por empacar» con la confirmacion. */
export async function finishPackingAction(
  _prevState: FinishPackingResult,
  formData: FormData,
): Promise<FinishPackingResult> {
  const actor = await currentActor();

  let numberText: string;
  try {
    ({ numberText } = await asignaciones.finishPacking(actor, finishPackingInputFromFormData(formData)));
  } catch (error) {
    return toErrorState(error);
  }

  revalidatePath(ASSIGNED_ORDERS_ROUTE);
  const query = new URLSearchParams({ vista: 'por_empacar', [PACKED_ORDER_PARAM]: numberText });
  redirect(`${ASSIGNED_ORDERS_ROUTE}?${query.toString()}`);
}
