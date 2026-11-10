import type { ReactNode } from 'react';

import type { RecipePosition } from '@/lib/modules/asignaciones';
import { cn } from '@/lib/utils';

export const RECIPE_OF_ORDER_LABEL_TESTID = 'recipe-of-order-label';

/** Funcion y no literal, para que un test no pueda comparar contra una copia del texto. */
export function recipeOfOrderText(recipe: RecipePosition): string {
  return `Receta ${recipe.position} de ${recipe.count}`;
}

/** Un pedido de una sola receta se ve como siempre: sin «Receta 1 de 1». */
export function hasSeveralRecipes(recipe: RecipePosition): boolean {
  return recipe.count > 1;
}

export type RecipeOfOrderLabelProps = {
  readonly recipe: RecipePosition;
  readonly className?: string;
};

export function RecipeOfOrderLabel({ recipe, className }: RecipeOfOrderLabelProps) {
  if (!hasSeveralRecipes(recipe)) return null;
  return (
    <span
      className={cn('text-xs text-muted-foreground', className)}
      data-testid={RECIPE_OF_ORDER_LABEL_TESTID}
    >
      {recipeOfOrderText(recipe)}
    </span>
  );
}

/** Celda «Receta» de las listas: el nombre y, debajo, su posicion en el pedido. */
export function RecipeNameWithPosition({
  name,
  recipe,
}: {
  readonly name: ReactNode;
  readonly recipe: RecipePosition;
}) {
  if (!hasSeveralRecipes(recipe)) return <>{name}</>;
  return (
    <span className="flex flex-col gap-0.5">
      <span>{name}</span>
      <RecipeOfOrderLabel recipe={recipe} />
    </span>
  );
}
