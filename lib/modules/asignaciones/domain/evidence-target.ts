// lib/modules/asignaciones/domain/evidence-target.ts
/**
 * Quien puede tocar las fotos de evidencia de un pedido, y con que lista de pasos. Fabricacion:
 * `asignaciones.ejecutar`, responsable asignado y `EN_CURSO`. Envasado: `empaque.modificar`,
 * `EN_EMPAQUE` y quien empaca es el actor. Cualquier otro caso es `order_not_found`: «no es tuyo»,
 * «no existe» y «ya no esta en curso» son la misma respuesta desde fuera.
 *
 * Los pasos son los de la formula ACTUAL, leidos en cada llamada: un switch encendido despues de
 * empezar tambien rige.
 */
import { requireAnyPermission, requirePermission, type Actor } from './actor';
import { OrderBlockedError, OrderNotFoundError } from './errors';

import type { EvidencePhase } from './step-evidence';
import type { OrderAssignmentRepository } from '../ports/order-assignment-repository';
import type { OrderCatalog } from '@/lib/modules/pedidos';
import type { RecipeCatalog, RecipePackingStepsReader, RecipeStepView } from '@/lib/modules/recetas';

export type EvidenceTargetDeps = {
  readonly assignments: OrderAssignmentRepository;
  readonly orders: OrderCatalog;
  readonly recipes: RecipeCatalog;
  readonly packingSteps: RecipePackingStepsReader;
};

export type EvidenceTarget = {
  readonly recipeId: string;
  readonly steps: readonly RecipeStepView[];
};

async function resolveManufacturing(
  deps: EvidenceTargetDeps,
  actor: Actor,
  orderId: string,
): Promise<EvidenceTarget> {
  const ids = await deps.assignments.listOrderIdsByUserInCompany(actor.companyId, actor.id);
  if (!ids.includes(orderId)) throw new OrderNotFoundError();

  const order = await deps.orders.findAliveById(orderId, actor.companyId);
  if (order === null) throw new OrderNotFoundError();
  if (order.status === 'BLOQUEADO') throw new OrderBlockedError();
  if (order.status !== 'EN_CURSO') throw new OrderNotFoundError();

  const page = await deps.orders.listAliveSummariesByIds(actor.companyId, [orderId], ['EN_CURSO'], 1, 1);
  const summary = page.items[0];
  if (summary === undefined) throw new OrderNotFoundError();

  const content = await deps.recipes.findExecutionContentById(summary.recipeId, actor.companyId);
  return { recipeId: summary.recipeId, steps: content?.steps ?? [] };
}

async function resolvePacking(
  deps: EvidenceTargetDeps,
  actor: Actor,
  orderId: string,
): Promise<EvidenceTarget> {
  const page = await deps.orders.listAliveSummariesByIds(actor.companyId, [orderId], ['EN_EMPAQUE'], 1, 1);
  const summary = page.items[0];
  if (summary?.packedBy !== actor.id) throw new OrderNotFoundError();

  const steps = await deps.packingSteps.findPackingStepsById(summary.recipeId, actor.companyId);
  return { recipeId: summary.recipeId, steps: steps ?? [] };
}

/** Autoriza antes de tocar ningun puerto; la empresa sale siempre del actor. */
export async function resolveEvidenceTarget(
  deps: EvidenceTargetDeps,
  actor: Actor | null | undefined,
  orderId: string,
  phase: EvidencePhase,
): Promise<EvidenceTarget> {
  if (phase === 'manufacturing') {
    requirePermission(actor, 'asignaciones.ejecutar');
    return resolveManufacturing(deps, actor, orderId);
  }
  requirePermission(actor, 'empaque.modificar');
  return resolvePacking(deps, actor, orderId);
}

/**
 * Primer corte de los casos de uso de fotos, antes de leer la entrada: la fase viaja en ella, asi
 * que aqui solo se exige poder tocar alguna. `resolveEvidenceTarget` exige despues el de la fase.
 */
export function requireEvidenceAccess(actor: Actor | null | undefined): asserts actor is Actor {
  requireAnyPermission(actor, ['asignaciones.ejecutar', 'empaque.modificar']);
}
