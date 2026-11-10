// lib/modules/asignaciones/domain/recipe-of-order.ts
/**
 * Donde esta una receta entre las de su pedido y cuales son las otras. Las canceladas cuentan en
 * la posicion y en el total: la numeracion de una receta no cambia porque otra se cancele.
 */
import type { OrderCatalog, OrderLineStatus, OrderRecipesOutline } from '@/lib/modules/pedidos';
import type { RecipeCatalog } from '@/lib/modules/recetas';

/** `count` 1 = pedido de una sola receta: la pantalla no muestra «Receta N de M». */
export type RecipePosition = {
  readonly position: number;
  readonly count: number;
};

export type OtherRecipeView = {
  readonly lineId: string;
  /** `null` = la receta no se pudo resolver. */
  readonly recipeName: string | null;
  readonly status: OrderLineStatus;
};

/** Lo que ganan las pantallas de una receta para ubicarla entre las del pedido. */
export type RecipeOfOrderView = {
  readonly lineId: string;
  readonly recipe: RecipePosition;
  /** Las demas recetas del pedido en orden de alta, canceladas incluidas; vacio con una sola. */
  readonly otherRecipes: readonly OtherRecipeView[];
};

export const SINGLE_RECIPE: RecipePosition = { position: 1, count: 1 };

/** Los outlines de una pagina de pedidos en una sola llamada, por pedido. */
export async function readRecipeOutlines(
  orders: Pick<OrderCatalog, 'listRecipeOutlinesByIdsIncludingDeleted'>,
  companyId: string,
  orderIds: readonly string[],
): Promise<ReadonlyMap<string, OrderRecipesOutline>> {
  const ids = [...new Set(orderIds)];
  const outlines = ids.length === 0 ? [] : await orders.listRecipeOutlinesByIdsIncludingDeleted(companyId, ids);
  return new Map(outlines.map((outline) => [outline.id, outline] as const));
}

/** Una linea que el outline ya no trae (se quito entre las dos lecturas) se pinta como unica. */
export function recipePositionOf(outline: OrderRecipesOutline | undefined, lineId: string): RecipePosition {
  const recipes = outline?.recipes ?? [];
  const own = recipes.find((recipe) => recipe.lineId === lineId);
  if (own === undefined) return SINGLE_RECIPE;
  return { position: own.position, count: recipes.length };
}

export function otherRecipesOf(
  outline: OrderRecipesOutline | undefined,
  lineId: string,
  recipeNames: ReadonlyMap<string, string>,
): readonly OtherRecipeView[] {
  return (outline?.recipes ?? [])
    .filter((recipe) => recipe.lineId !== lineId)
    .sort((a, b) => a.position - b.position)
    .map((recipe) => ({
      lineId: recipe.lineId,
      recipeName: recipeNames.get(recipe.recipeId) ?? null,
      status: recipe.status,
    }));
}

/** Para una pantalla que no pasa por `composeOrderRows`: el outline y los nombres de las otras. */
export async function readRecipeOfOrder(
  deps: {
    readonly orders: Pick<OrderCatalog, 'listRecipeOutlinesByIdsIncludingDeleted'>;
    readonly recipes: Pick<RecipeCatalog, 'findRefsIncludingDeleted'>;
  },
  companyId: string,
  orderId: string,
  lineId: string,
): Promise<RecipeOfOrderView> {
  const outline = (await readRecipeOutlines(deps.orders, companyId, [orderId])).get(orderId);
  const otherIds = [
    ...new Set((outline?.recipes ?? []).filter((recipe) => recipe.lineId !== lineId).map((recipe) => recipe.recipeId)),
  ];
  const refs = otherIds.length === 0 ? [] : await deps.recipes.findRefsIncludingDeleted(otherIds, companyId);
  const names = new Map(refs.map((ref) => [ref.id, ref.name] as const));
  return {
    lineId,
    recipe: recipePositionOf(outline, lineId),
    otherRecipes: otherRecipesOf(outline, lineId, names),
  };
}

/** Lo que el aviso de vuelta a la lista necesita para nombrar la receta. */
export type OutcomeRecipe = {
  /** `null` = la receta no se pudo resolver. */
  readonly recipeName: string | null;
  /** Recetas del pedido, canceladas incluidas: con 1 el aviso no nombra la receta. */
  readonly recipeCount: number;
};

/** Se lee antes de escribir: una cancelacion no cambia el total, y asi el aviso no depende de la
 *  escritura. */
export async function readOutcomeRecipe(
  deps: {
    readonly orders: Pick<OrderCatalog, 'listRecipeOutlinesByIdsIncludingDeleted'>;
    readonly recipes: Pick<RecipeCatalog, 'findRefsIncludingDeleted'>;
  },
  companyId: string,
  orderId: string,
  recipeId: string,
): Promise<OutcomeRecipe> {
  const [outlines, refs] = await Promise.all([
    readRecipeOutlines(deps.orders, companyId, [orderId]),
    deps.recipes.findRefsIncludingDeleted([recipeId], companyId),
  ]);
  return {
    recipeName: refs.find((ref) => ref.id === recipeId)?.name ?? null,
    recipeCount: Math.max(outlines.get(orderId)?.recipes.length ?? 1, 1),
  };
}
