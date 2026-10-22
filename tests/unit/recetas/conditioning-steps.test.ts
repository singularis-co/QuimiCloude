// Pasos de acondicionamiento en los casos de uso de `recetas`, con dobles de sus puertos: alta y
// edicion los pasan en orden; la edicion sin la clave conserva los guardados; una version nunca
// guarda propios y lee los de su original; sin `recetas.modificar` no se toca ningun puerto; y
// mover o quitar pasos con pedidos con fotos se bloquea, encender un switch no.

import type { Actor } from '@/lib/modules/recetas/domain/actor';
import { createCreateRecipe } from '@/lib/modules/recetas/domain/create-recipe';
import { RecipeStepsLockedError, UnauthorizedError } from '@/lib/modules/recetas/domain/errors';
import { createGetRecipe } from '@/lib/modules/recetas/domain/get-recipe';
import { createUpdateRecipe } from '@/lib/modules/recetas/domain/update-recipe';
import { createUpdateRecipeVersion } from '@/lib/modules/recetas/domain/update-recipe-version';
import type { RecipeImageStorage } from '@/lib/modules/recetas/ports/recipe-image-storage';
import type { RecipeRepository, RecipeRow } from '@/lib/modules/recetas/ports/recipe-repository';
import type { RecipeStepLockReader } from '@/lib/modules/recetas/ports/recipe-step-lock-reader';

import type { ProductCatalog, ProductRef } from '@/lib/modules/inventario';
import { noEvidenceLocks } from '../../helpers/evidence-off';

const EMPRESA = 'empresa-1';
const ACTOR: Actor = { id: 'actor-1', companyId: EMPRESA, permissions: ['recetas.consultar', 'recetas.modificar'] };
const SIN_MODIFICAR: Actor = { ...ACTOR, permissions: ['recetas.consultar'] };
const AHORA = new Date('2026-10-21T10:00:00.000Z');

const P_A = '11111111-1111-4111-8111-111111111111';
const P_B = '22222222-2222-4222-8222-222222222222';
const V_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function paso(text: string) {
  return { blocks: [{ kind: 'paragraph' as const, spans: [{ text }] }] };
}

const MEZCLAR = paso('Mezclar en frio');
const ENVASAR = paso('Envasar en garrafas de 5 L');
const ROTULAR = { ...paso('Rotular cajas'), requiresAssignment: true };
const PALETIZAR = { ...paso('Paletizar'), requiresEvidence: true };
const FLEJAR = paso('Flejar el palet');

const LINEAS = [
  { productId: P_A, percentage: '60.00' },
  { productId: P_B, percentage: '40.00' },
];

const ORIGINAL: RecipeRow = {
  id: 'original-1',
  name: 'Crema base',
  description: null,
  steps: [MEZCLAR],
  packingSteps: [ENVASAR],
  conditioningSteps: [ROTULAR, PALETIZAR],
  imagePath: null,
  createdBy: null,
  updatedBy: null,
  createdAt: AHORA,
  updatedAt: AHORA,
  lines: [
    { id: 'l-1', productId: P_A, percentage: '60.00' },
    { id: 'l-2', productId: P_B, percentage: '40.00' },
  ],
  tools: [],
  original: null,
};

const VERSION: RecipeRow = {
  ...ORIGINAL,
  id: 'version-1',
  name: 'Sin perfume',
  steps: [],
  packingSteps: [],
  conditioningSteps: [],
  original: {
    id: ORIGINAL.id,
    name: ORIGINAL.name,
    description: null,
    imagePath: null,
    steps: [MEZCLAR],
    packingSteps: [ENVASAR],
    conditioningSteps: [ROTULAR, PALETIZAR],
  },
};

function repositorio(fila: RecipeRow | null): RecipeRepository {
  return {
    create: vi.fn<RecipeRepository['create']>(async () => ({ id: 'nueva' })),
    findAliveById: vi.fn<RecipeRepository['findAliveById']>(async () => fila),
    listAlive: vi.fn<RecipeRepository['listAlive']>(async () => ({ rows: [], total: 0 })),
    replaceAlive: vi.fn<RecipeRepository['replaceAlive']>(async () => 'ok'),
    softDeleteAlive: vi.fn<RecipeRepository['softDeleteAlive']>(async () => 'ok'),
    createVersion: vi.fn<RecipeRepository['createVersion']>(async () => ({ id: 'version-nueva' })),
    listAliveVersions: vi.fn<RecipeRepository['listAliveVersions']>(async () => []),
    listVersionIdsIncludingDeleted: vi.fn<RecipeRepository['listVersionIdsIncludingDeleted']>(async () => [
      VERSION.id,
    ]),
    replaceAliveWithPropagation: vi.fn<RecipeRepository['replaceAliveWithPropagation']>(async () => ({
      kind: 'ok',
      propagated: [{ versionId: V_1, isUnderReview: false }],
    })),
  };
}

function montar(fila: RecipeRow | null = ORIGINAL, stepLocks: RecipeStepLockReader = noEvidenceLocks) {
  const recipes = repositorio(fila);
  const products: ProductCatalog = {
    findRefs: vi.fn<ProductCatalog['findRefs']>(async (ids) =>
      ids.map((id): ProductRef => ({ id, name: id, unitId: null, stockByUnit: [], type: 'PRODUCT' })),
    ),
    findCostingBatches: vi.fn<ProductCatalog['findCostingBatches']>(() => {
      throw new Error('no se usa');
    }),
    findFinishedGoodsReceipts: vi.fn<ProductCatalog['findFinishedGoodsReceipts']>(() => {
      throw new Error('no se usa');
    }),
  };
  const images: RecipeImageStorage = {
    upload: vi.fn<RecipeImageStorage['upload']>(async () => 'recetas/nueva.jpg'),
    remove: vi.fn<RecipeImageStorage['remove']>(async () => undefined),
    publicUrl: vi.fn<RecipeImageStorage['publicUrl']>((path) => path),
  };
  const deps = { recipes, products, images, now: () => AHORA };
  return {
    recipes,
    products,
    images,
    create: createCreateRecipe(deps),
    update: createUpdateRecipe({ ...deps, stepLocks }),
    get: createGetRecipe(deps),
    updateVersion: createUpdateRecipeVersion(deps),
  };
}

function conFotos(): RecipeStepLockReader {
  return { countOrdersWithEvidenceInProgress: vi.fn(async () => 2) };
}

const ENTRADA = { name: 'Crema base', steps: [MEZCLAR], packingSteps: [ENVASAR], lines: LINEAS };

describe('alta y edicion pasan los pasos de acondicionamiento al repositorio', () => {
  it('R4: el alta los pasa en el orden recibido, con sus marcas y separados de las otras dos listas', async () => {
    const { recipes, create } = montar();

    await create({ ...ENTRADA, conditioningSteps: [PALETIZAR, FLEJAR, ROTULAR] }, ACTOR);

    const datos = vi.mocked(recipes.create).mock.calls[0]?.[0];
    expect(datos?.conditioningSteps).toEqual([PALETIZAR, FLEJAR, ROTULAR]);
    expect(datos?.packingSteps).toEqual([ENVASAR]);
    expect(datos?.steps).toEqual([MEZCLAR]);
  });

  it('R4: el alta sin conditioningSteps pasa una lista vacia', async () => {
    const { recipes, create } = montar();

    await create(ENTRADA, ACTOR);

    expect(vi.mocked(recipes.create).mock.calls[0]?.[0].conditioningSteps).toEqual([]);
  });

  it('R4: la edicion los pasa a replaceAlive en orden', async () => {
    const { recipes, update } = montar();

    await update(ORIGINAL.id, { ...ENTRADA, conditioningSteps: [ROTULAR, PALETIZAR, FLEJAR] }, ACTOR);

    const datos = vi.mocked(recipes.replaceAlive).mock.calls[0]?.[1];
    expect(datos?.conditioningSteps).toEqual([ROTULAR, PALETIZAR, FLEJAR]);
    expect(datos?.packingSteps).toEqual([ENVASAR]);
  });

  it('R4: la edicion con propagacion los pasa a replaceAliveWithPropagation en orden', async () => {
    const { recipes, update } = montar();

    await update(
      ORIGINAL.id,
      { ...ENTRADA, conditioningSteps: [ROTULAR, PALETIZAR, FLEJAR], propagateToVersionIds: [V_1] },
      ACTOR,
    );

    const datos = vi.mocked(recipes.replaceAliveWithPropagation).mock.calls[0]?.[1];
    expect(datos?.conditioningSteps).toEqual([ROTULAR, PALETIZAR, FLEJAR]);
  });

  it('R4: la edicion sin la clave conditioningSteps no la pasa al repositorio (conserva la guardada)', async () => {
    const { recipes, update } = montar();

    await update(ORIGINAL.id, ENTRADA, ACTOR);

    const datos = vi.mocked(recipes.replaceAlive).mock.calls[0]?.[1];
    expect(datos).toBeDefined();
    expect(datos).not.toHaveProperty('conditioningSteps');
  });

  it('R4: la edicion con conditioningSteps: [] los quita', async () => {
    const { recipes, update } = montar();

    await update(ORIGINAL.id, { ...ENTRADA, conditioningSteps: [] }, ACTOR);

    expect(vi.mocked(recipes.replaceAlive).mock.calls[0]?.[1].conditioningSteps).toEqual([]);
  });
});

describe('versiones', () => {
  it('R14: editar una version escribe conditioningSteps: [] aunque la entrada los traiga', async () => {
    const { recipes, updateVersion } = montar(VERSION);

    await updateVersion(VERSION.id, { name: 'Sin perfume', lines: LINEAS, conditioningSteps: [FLEJAR] }, ACTOR);

    const datos = vi.mocked(recipes.replaceAlive).mock.calls[0]?.[1];
    expect(datos?.conditioningSteps).toEqual([]);
    expect(JSON.stringify(datos)).not.toContain('Flejar');
  });

  it('R15: el detalle de una version devuelve los pasos de acondicionamiento de su original', async () => {
    const { get } = montar(VERSION);

    const detalle = await get(VERSION.id, ACTOR);

    expect(detalle.conditioningSteps).toEqual([ROTULAR, PALETIZAR]);
  });

  it('R4: el detalle de una original devuelve sus tres listas intactas y separadas', async () => {
    const { get } = montar(ORIGINAL);

    const detalle = await get(ORIGINAL.id, ACTOR);

    expect(detalle.steps).toEqual([MEZCLAR]);
    expect(detalle.packingSteps).toEqual([ENVASAR]);
    expect(detalle.conditioningSteps).toEqual([ROTULAR, PALETIZAR]);
  });
});

describe('autorizacion', () => {
  it('R6: sin recetas.modificar el alta con pasos de acondicionamiento se rechaza sin tocar ningun puerto', async () => {
    const { recipes, products, images, create } = montar();

    await expect(create({ ...ENTRADA, conditioningSteps: [ROTULAR] }, SIN_MODIFICAR)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(recipes.create).not.toHaveBeenCalled();
    expect(products.findRefs).not.toHaveBeenCalled();
    expect(images.upload).not.toHaveBeenCalled();
  });

  it('R6: sin recetas.modificar la edicion se rechaza antes de validar, incluso con una entrada invalida', async () => {
    const { recipes, products, images, update } = montar();

    await expect(
      update(ORIGINAL.id, { ...ENTRADA, conditioningSteps: 'no es una lista' }, SIN_MODIFICAR),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(recipes.findAliveById).not.toHaveBeenCalled();
    expect(recipes.replaceAlive).not.toHaveBeenCalled();
    expect(recipes.replaceAliveWithPropagation).not.toHaveBeenCalled();
    expect(products.findRefs).not.toHaveBeenCalled();
    expect(images.upload).not.toHaveBeenCalled();
  });

  it('R6: sin recetas.modificar la edicion de una version se rechaza sin tocar el repositorio', async () => {
    const { recipes, updateVersion } = montar(VERSION);

    await expect(
      updateVersion(VERSION.id, { name: 'Sin perfume', lines: LINEAS, conditioningSteps: [FLEJAR] }, SIN_MODIFICAR),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(recipes.findAliveById).not.toHaveBeenCalled();
    expect(recipes.replaceAlive).not.toHaveBeenCalled();
  });
});

describe('bloqueo por fotos de evidencia', () => {
  it('R34: quitar un paso de acondicionamiento con pedidos con fotos lanza RecipeStepsLockedError sin escribir', async () => {
    const stepLocks = conFotos();
    const { recipes, update } = montar(ORIGINAL, stepLocks);

    await expect(update(ORIGINAL.id, { ...ENTRADA, conditioningSteps: [ROTULAR] }, ACTOR)).rejects.toBeInstanceOf(
      RecipeStepsLockedError,
    );
    expect(stepLocks.countOrdersWithEvidenceInProgress).toHaveBeenCalledWith([ORIGINAL.id, VERSION.id], EMPRESA);
    expect(recipes.replaceAlive).not.toHaveBeenCalled();
  });

  it('R34: mover un paso de acondicionamiento con pedidos con fotos lanza RecipeStepsLockedError', async () => {
    const { recipes, update } = montar(ORIGINAL, conFotos());

    await expect(
      update(ORIGINAL.id, { ...ENTRADA, conditioningSteps: [PALETIZAR, ROTULAR] }, ACTOR),
    ).rejects.toBeInstanceOf(RecipeStepsLockedError);
    expect(recipes.replaceAlive).not.toHaveBeenCalled();
  });

  it('R34: encender o apagar los switches, cambiar el texto o anadir al final no bloquea', async () => {
    const stepLocks = conFotos();
    const { recipes, update } = montar(ORIGINAL, stepLocks);

    await update(
      ORIGINAL.id,
      {
        ...ENTRADA,
        conditioningSteps: [
          { ...paso('Rotular cajas'), requiresAssignment: false, requiresEvidence: true },
          { ...paso('Paletizar con film'), requiresAssignment: true },
          FLEJAR,
        ],
      },
      ACTOR,
    );

    expect(stepLocks.countOrdersWithEvidenceInProgress).not.toHaveBeenCalled();
    expect(recipes.replaceAlive).toHaveBeenCalledTimes(1);
  });

  it('R34: la edicion que omite conditioningSteps no se bloquea por los guardados', async () => {
    const stepLocks = conFotos();
    const { recipes, update } = montar(ORIGINAL, stepLocks);

    await update(ORIGINAL.id, ENTRADA, ACTOR);

    expect(stepLocks.countOrdersWithEvidenceInProgress).not.toHaveBeenCalled();
    expect(recipes.replaceAlive).toHaveBeenCalledTimes(1);
  });
});
