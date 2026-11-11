// lib/modules/asignaciones/adapters/driving/outcome-query.ts
import { ASSIGNED_ORDERS_ROUTE, OUTCOME_RECIPE_PARAM } from '@/lib/shared/routes';

import type { OutcomeRecipe } from '@/lib/modules/asignaciones';

/** La lista con su aviso. Con una sola receta, o sin nombre que mostrar, el aviso nombra solo el
 *  pedido, como antes de haber varias recetas por pedido. */
export function outcomeRoute(params: Readonly<Record<string, string>>, outcome: OutcomeRecipe): string {
  const query = new URLSearchParams(params);
  if (outcome.recipeCount > 1 && outcome.recipeName !== null) query.set(OUTCOME_RECIPE_PARAM, outcome.recipeName);
  return `${ASSIGNED_ORDERS_ROUTE}?${query.toString()}`;
}
