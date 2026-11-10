import type { OrderLineStatus, OrderRecipesOutline } from '@/lib/modules/pedidos';
import type { RecipeRef } from '@/lib/modules/recetas';

/** Un outline de `estados.length` recetas para cada pedido pedido, en orden de alta. Las lineas son
 *  `linea-<n>`, salvo que `lineIds` nombre alguna. */
export function outlinesDe(
  estados: readonly OrderLineStatus[],
  lineIds: readonly string[] = [],
): (companyId: string, ids: readonly string[]) => Promise<readonly OrderRecipesOutline[]> {
  return async (_companyId, ids) =>
    ids.map((id) => ({
      id,
      deleted: false,
      recipes: estados.map((status, i) => ({
        lineId: lineIds[i] ?? `linea-${String(i + 1)}`,
        position: i + 1,
        recipeId: `receta-${String(i + 1)}`,
        status,
        quantity: '10.0000',
        unitId: null,
        presentationLines: [],
      })),
      progress: { total: estados.filter((status) => status !== 'CANCELADO').length, finished: 0 },
    }));
}

/** Cualquier receta pedida vuelve con el nombre `Receta <id>`. */
export async function refsConNombre(ids: readonly string[]): Promise<readonly RecipeRef[]> {
  return ids.map(
    (id) =>
      ({
        id,
        name: `Receta ${id}`,
        ownName: `Receta ${id}`,
        isUnderReview: false,
        original: null,
        isDeleted: false,
        imageUrl: null,
      }) as RecipeRef,
  );
}

/** Los mismos dobles con un pedido de dos recetas, la otra cancelada: el aviso cuenta las dos. */
export function conDosRecetas<D extends { readonly orders: object; readonly recipes: object }>(deps: D): D {
  return {
    ...deps,
    orders: { ...deps.orders, listRecipeOutlinesByIdsIncludingDeleted: outlinesDe(['CANCELADO', 'EN_CURSO']) },
    recipes: { ...deps.recipes, findRefsIncludingDeleted: refsConNombre },
  };
}

/** Un pedido de tres recetas -otra, la propia y otra cancelada- con la propia en `lineId`. */
export function conTresRecetas<D extends { readonly orders: object; readonly recipes: object }>(
  deps: D,
  lineId: string,
): D {
  return {
    ...deps,
    orders: {
      ...deps.orders,
      listRecipeOutlinesByIdsIncludingDeleted: outlinesDe(['EN_CURSO', 'PENDIENTE', 'CANCELADO'], [
        'otra-1',
        lineId,
        'otra-3',
      ]),
    },
    recipes: { ...deps.recipes, findRefsIncludingDeleted: refsConNombre },
  };
}

/** Lo que una pantalla de una receta espera de `conTresRecetas`. */
export function recetaDeTres(lineId: string) {
  return {
    lineId,
    recipe: { position: 2, count: 3 },
    otherRecipes: [
      { lineId: 'otra-1', recipeName: 'Receta receta-1', status: 'EN_CURSO' },
      { lineId: 'otra-3', recipeName: 'Receta receta-3', status: 'CANCELADO' },
    ],
  };
}
