import { z } from 'zod';

import { RECIPE_PARAM } from '@/lib/shared/routes';

const lineIdSchema = z.string().uuid();

export type RecipeSearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

/** La receta que nombra la direccion; `null` si falta, viene repetida o no es un uuid. */
export function recipeLineIdOf(searchParams: RecipeSearchParams): string | null {
  const raw = searchParams[RECIPE_PARAM];
  if (typeof raw !== 'string') return null;
  const parsed = lineIdSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
