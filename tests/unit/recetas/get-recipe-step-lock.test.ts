// tests/unit/recetas/get-recipe-step-lock.test.ts
//
// Cuantos pedidos en curso con fotos tiene una formula: lo que el editor pinta como aviso.
import { describe, expect, it, vi } from 'vitest';

import {
  RecipeNotFoundError,
  UnauthorizedError,
  createGetRecipeStepLock,
  type Actor,
} from '@/lib/modules/recetas';
import type { RecipeRepository, RecipeRow } from '@/lib/modules/recetas/ports/recipe-repository';
import type { RecipeStepLockReader } from '@/lib/modules/recetas/ports/recipe-step-lock-reader';

const EMPRESA = 'empresa-1';
const ACTOR: Actor = { id: 'actor-1', companyId: EMPRESA, permissions: ['recetas.consultar'] };
const AHORA = new Date('2026-10-13T10:00:00.000Z');

const ORIGINAL: RecipeRow = {
  id: 'original-1',
  name: 'Crema base',
  description: null,
  steps: [],
  packingSteps: [],
  imagePath: null,
  createdBy: null,
  updatedBy: null,
  createdAt: AHORA,
  updatedAt: AHORA,
  lines: [],
  tools: [],
  original: null,
};

const VERSION: RecipeRow = {
  ...ORIGINAL,
  id: 'version-1',
  original: { id: ORIGINAL.id, name: ORIGINAL.name, description: null, imagePath: null, steps: [], packingSteps: [] },
};

function noUsado(): never {
  throw new Error('no se usa');
}

function montar(fila: RecipeRow | null, pedidos = 2) {
  const recipes = {
    create: vi.fn<RecipeRepository['create']>(noUsado),
    findAliveById: vi.fn<RecipeRepository['findAliveById']>(async () => fila),
    listAlive: vi.fn<RecipeRepository['listAlive']>(noUsado),
    replaceAlive: vi.fn<RecipeRepository['replaceAlive']>(noUsado),
    softDeleteAlive: vi.fn<RecipeRepository['softDeleteAlive']>(noUsado),
    createVersion: vi.fn<RecipeRepository['createVersion']>(noUsado),
    listAliveVersions: vi.fn<RecipeRepository['listAliveVersions']>(noUsado),
    replaceAliveWithPropagation: vi.fn<RecipeRepository['replaceAliveWithPropagation']>(noUsado),
    listVersionIdsIncludingDeleted: vi.fn<RecipeRepository['listVersionIdsIncludingDeleted']>(async () => [
      'version-1',
      'version-baja',
    ]),
  } satisfies RecipeRepository;
  const stepLocks = {
    countOrdersWithEvidenceInProgress: vi.fn<RecipeStepLockReader['countOrdersWithEvidenceInProgress']>(
      async () => pedidos,
    ),
  } satisfies RecipeStepLockReader;
  return { recipes, stepLocks, run: createGetRecipeStepLock({ recipes, stepLocks }) };
}

describe('getRecipeStepLock', () => {
  it('R8: devuelve cuantos pedidos en curso con fotos tienen la original y sus versiones', async () => {
    const { recipes, stepLocks, run } = montar(ORIGINAL, 2);

    expect(await run(ORIGINAL.id, ACTOR)).toEqual({ lockingOrders: 2 });
    expect(recipes.findAliveById).toHaveBeenCalledWith(ORIGINAL.id, { companyId: EMPRESA });
    expect(recipes.listVersionIdsIncludingDeleted).toHaveBeenCalledWith(ORIGINAL.id, { companyId: EMPRESA });
    expect(stepLocks.countOrdersWithEvidenceInProgress).toHaveBeenCalledWith(
      [ORIGINAL.id, 'version-1', 'version-baja'],
      EMPRESA,
    );
  });

  it('R12: sin pedidos en curso con fotos responde cero', async () => {
    const { run } = montar(ORIGINAL, 0);

    expect(await run(ORIGINAL.id, ACTOR)).toEqual({ lockingOrders: 0 });
  });

  it('R8: una version responde por los pasos de su original', async () => {
    const { recipes, stepLocks, run } = montar(VERSION, 1);

    expect(await run(VERSION.id, ACTOR)).toEqual({ lockingOrders: 1 });
    expect(recipes.listVersionIdsIncludingDeleted).toHaveBeenCalledWith(ORIGINAL.id, { companyId: EMPRESA });
    expect(stepLocks.countOrdersWithEvidenceInProgress).toHaveBeenCalledWith(
      [ORIGINAL.id, 'version-1', 'version-baja'],
      EMPRESA,
    );
  });

  it('una receta inexistente o de otra empresa es recipe_not_found y no cuenta nada', async () => {
    const { stepLocks, run } = montar(null);

    await expect(run('otra', ACTOR)).rejects.toBeInstanceOf(RecipeNotFoundError);
    expect(stepLocks.countOrdersWithEvidenceInProgress).not.toHaveBeenCalled();
  });

  it('sin recetas.consultar rechaza antes de tocar ningun puerto', async () => {
    const { recipes, stepLocks, run } = montar(ORIGINAL);

    await expect(run(ORIGINAL.id, { ...ACTOR, permissions: ['recetas.modificar'] })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    await expect(run(ORIGINAL.id, null)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(recipes.findAliveById).not.toHaveBeenCalled();
    expect(stepLocks.countOrdersWithEvidenceInProgress).not.toHaveBeenCalled();
  });
});
