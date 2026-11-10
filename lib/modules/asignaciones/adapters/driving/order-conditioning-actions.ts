'use server';

/**
 * Las Server Actions del detalle del acondicionador. No deciden nada: resuelven el actor,
 * traducen el `FormData` y traducen el error por su `code`.
 *
 * Se importa por su ruta exacta: un `'use server'` reexportado desde el barrel del modulo lo
 * volveria inimportable desde un componente de cliente.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { asignaciones, identity, observabilidad } from '@/lib/composition';
import { createErrorStateTranslator, type ErrorState } from '@/lib/modules/errores';
import { AsignacionesError, type Actor, type RecordConditioningStepResult } from '@/lib/modules/asignaciones';
import { ASSIGNED_ORDERS_ROUTE, CONDITIONED_ORDER_PARAM, conditioningOrderRoute } from '@/lib/shared/routes';
import { runInRequestScope } from '@/lib/shared/request-scope';

import { outcomeRoute } from './outcome-query';

const toErrorState = createErrorStateTranslator(
  AsignacionesError,
  observabilidad.readRequestIdHeader,
);

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

function revalidateConditioningOrder({ orderId, lineId }: { orderId?: unknown; lineId?: unknown }): void {
  if (typeof orderId === 'string' && typeof lineId === 'string') {
    revalidatePath(conditioningOrderRoute(orderId, lineId));
  }
}

export type StartConditioningResult = { status: 'success' } | ErrorState;

/** Comienza con el equipo marcado y se queda en el detalle, que ya ofrece «Terminar». */
export async function startConditioningAction(
  _prevState: StartConditioningResult,
  formData: FormData,
): Promise<StartConditioningResult> {
  const actor = await currentActor();

  try {
    await asignaciones.startConditioning(actor, {
      ...orderLineFromFormData(formData),
      userIds: formData.getAll('userIds'),
      workGroupIds: formData.getAll('workGroupIds'),
    });
  } catch (error) {
    return toErrorState(error);
  }

  revalidateConditioningOrder(orderLineFromFormData(formData));
  return { status: 'success' };
}

export type FinishConditioningResult = { status: 'success' } | ErrorState;

/** Deja la receta `TERMINADO` y vuelve a «Por acondicionar» con el aviso. */
export async function finishConditioningAction(
  _prevState: FinishConditioningResult,
  formData: FormData,
): Promise<FinishConditioningResult> {
  const actor = await currentActor();

  let outcome: Awaited<ReturnType<typeof asignaciones.finishConditioning>>;
  try {
    outcome = await asignaciones.finishConditioning(actor, orderLineFromFormData(formData));
  } catch (error) {
    return toErrorState(error);
  }

  revalidatePath(ASSIGNED_ORDERS_ROUTE);
  redirect(outcomeRoute({ vista: 'por_acondicionar', [CONDITIONED_ORDER_PARAM]: outcome.numberText }, outcome));
}

export type SaveConditioningBatchDataResult = { status: 'idle' } | { status: 'success' } | ErrorState;

/** Guarda los datos de lote de la receta y se queda en el detalle. El campo culpable lo deduce el
 *  formulario por el `code`. */
export async function saveConditioningBatchDataAction(
  _prevState: SaveConditioningBatchDataResult,
  formData: FormData,
): Promise<SaveConditioningBatchDataResult> {
  const actor = await currentActor();

  try {
    await asignaciones.saveConditioningBatchData(actor, {
      ...orderLineFromFormData(formData),
      lot: formData.get('lot'),
      expiryDate: formData.get('expiryDate'),
      productionDate: formData.get('productionDate'),
    });
  } catch (error) {
    return toErrorState(error);
  }

  revalidateConditioningOrder(orderLineFromFormData(formData));
  return { status: 'success' };
}

export type RecordConditioningStepActionResult =
  | { status: 'success'; data: RecordConditioningStepResult }
  | ErrorState;

/** Deja atras un paso: lo completa o anota el cambio de responsables, y se queda en el detalle. */
export async function recordConditioningStepAction(input: unknown): Promise<RecordConditioningStepActionResult> {
  const actor = await currentActor();

  let data: RecordConditioningStepResult;
  try {
    data = await asignaciones.recordConditioningStep(actor, input);
  } catch (error) {
    return toErrorState(error);
  }

  if (typeof input === 'object' && input !== null) {
    revalidateConditioningOrder(input as { orderId?: unknown; lineId?: unknown });
  }
  return { status: 'success', data };
}
