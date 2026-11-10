import { canExecuteAssignedOrders, resolveAssignmentViews } from '@/lib/modules/asignaciones';
import type { PermissionBearer } from '@/lib/modules/identity';

import type { RecipeAccess } from './recipe-header';

/**
 * Presentación, no autorización: solo decide a qué otras recetas ofrece ir la cabecera. La pantalla
 * de destino vuelve a exigir su permiso. Empaque y acondicionamiento salen de las vistas de la
 * lista, que piden el mismo permiso que sus pantallas.
 */
export function recipeAccessOf(bearer: PermissionBearer | null): RecipeAccess {
  const views = resolveAssignmentViews(bearer);
  return {
    execute: canExecuteAssignedOrders(bearer),
    pack: views.includes('por_empacar'),
    condition: views.includes('por_acondicionar'),
  };
}
