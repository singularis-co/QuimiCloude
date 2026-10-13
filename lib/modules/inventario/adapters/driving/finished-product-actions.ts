'use server';

import { identity, inventario, observabilidad } from '@/lib/composition';
import { createErrorStateTranslator, type ErrorState } from '@/lib/modules/errores';
import {
  InventarioError,
  type Actor,
  type FinishedProductBatchRow,
  type FinishedProductCostRow,
  type FinishedProductDeliveriesPage,
  type FinishedProductDetail,
  type FinishedProductMovementRow,
  type Page,
  type ProducedProductLink,
} from '@/lib/modules/inventario';
import { runInRequestScope } from '@/lib/shared/request-scope';

// Aqui no se repite `requirePermission`: es la primera linea de cada caso de uso.

export type FinishedProductResult =
  | { status: 'success'; data: FinishedProductDetail }
  | ErrorState;

export type PageResult<T> =
  | { status: 'success'; data: Page<T> }
  | ErrorState;

export type FinishedProductDeliveriesResult =
  | { status: 'success'; data: FinishedProductDeliveriesPage }
  | ErrorState;

export type ProducedProductsResult =
  | { status: 'success'; data: readonly ProducedProductLink[] }
  | ErrorState;

const toErrorState = createErrorStateTranslator(InventarioError, observabilidad.readRequestIdHeader);

/** La empresa sale de la sesion del servidor y nunca de la entrada. */
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

export async function getFinishedProductAction(id: string): Promise<FinishedProductResult> {
  const actor = await currentActor();

  try {
    const data = await inventario.getFinishedProduct(id, actor);
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function listFinishedProductBatchesAction(
  id: string,
  input: unknown,
): Promise<PageResult<FinishedProductBatchRow>> {
  const actor = await currentActor();

  try {
    const data = await inventario.listFinishedProductBatches(id, input, actor);
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function listFinishedProductMovementsAction(
  id: string,
  input: unknown,
): Promise<PageResult<FinishedProductMovementRow>> {
  const actor = await currentActor();

  try {
    const data = await inventario.listFinishedProductMovements(id, input, actor);
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function listFinishedProductDeliveriesAction(
  id: string,
  input: unknown,
): Promise<FinishedProductDeliveriesResult> {
  const actor = await currentActor();

  try {
    const data = await inventario.listFinishedProductDeliveries(id, input, actor);
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function listFinishedProductCostsAction(
  id: string,
  input: unknown,
): Promise<PageResult<FinishedProductCostRow>> {
  const actor = await currentActor();

  try {
    const data = await inventario.listFinishedProductCosts(id, input, actor);
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

export async function listProducedProductsAction(
  orderIds: readonly string[],
): Promise<ProducedProductsResult> {
  const actor = await currentActor();

  try {
    const data = await inventario.listProducedProducts(orderIds, actor);
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}
