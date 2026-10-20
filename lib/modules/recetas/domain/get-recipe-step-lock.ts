import { requirePermission, type Actor } from './actor';
import { RecipeNotFoundError } from './errors';
import type { RecipeScope } from './recipe-scope';

import type { RecipeRepository } from '../ports/recipe-repository';
import type { RecipeStepLockReader } from '../ports/recipe-step-lock-reader';

export type GetRecipeStepLockDeps = {
  readonly recipes: RecipeRepository;
  readonly stepLocks: RecipeStepLockReader;
};

export type RecipeStepLock = {
  /** Pedidos en curso con fotos de evidencia: mientras haya alguno no se mueven ni quitan pasos. */
  readonly lockingOrders: number;
};

/**
 * Lo que el editor necesita para avisar antes de que el guardado se rechace. Una version no tiene
 * pasos propios: responde por los de su original, que son los que ejecutan sus pedidos.
 */
export function createGetRecipeStepLock(
  deps: GetRecipeStepLockDeps,
): (id: string, actor: Actor | null | undefined) => Promise<RecipeStepLock> {
  return async function getRecipeStepLock(id, actor) {
    requirePermission(actor, 'recetas.consultar');
    const scope: RecipeScope = { companyId: actor.companyId };

    const row = await deps.recipes.findAliveById(id, scope);
    if (row === null) throw new RecipeNotFoundError();

    const originalId = row.original?.id ?? row.id;
    const versionIds = await deps.recipes.listVersionIdsIncludingDeleted(originalId, scope);
    const lockingOrders = await deps.stepLocks.countOrdersWithEvidenceInProgress(
      [originalId, ...versionIds],
      actor.companyId,
    );
    return { lockingOrders };
  };
}
