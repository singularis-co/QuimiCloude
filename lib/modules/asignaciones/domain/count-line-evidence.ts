import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { ValidationError } from './errors';
import { readRecipeOutlines } from './recipe-of-order';
import { lineEvidenceKey } from './step-evidence';

import type { LineEvidenceCount } from './order-evidence';
import type { StepEvidenceRepository } from '../ports/step-evidence-repository';
import type { OrderCatalog, OrderRecipesOutline } from '@/lib/modules/pedidos';
import type { RecipeCatalog } from '@/lib/modules/recetas';

const MAX_LINES = 25;

const countLineEvidenceSchema = z.strictObject({
  lines: z
    .array(z.strictObject({ orderId: z.string().uuid(), lineId: z.string().uuid() }))
    .max(MAX_LINES),
});

export type CountLineEvidenceDeps = {
  readonly evidence: Pick<StepEvidenceRepository, 'countByLines'>;
  readonly orders: Pick<OrderCatalog, 'listRecipeOutlinesByIdsIncludingDeleted'>;
  readonly recipes: Pick<RecipeCatalog, 'findRefsIncludingDeleted'>;
};

type Line = { readonly orderId: string; readonly lineId: string };

/** El `recipeId` de la linea si la pantalla debe nombrarla: con una sola receta en el pedido, o
 *  con la linea ya fuera de el, no se nombra. Las canceladas cuentan. */
function namedRecipeIdOf(outline: OrderRecipesOutline | undefined, lineId: string): string | null {
  const recipes = outline?.recipes ?? [];
  if (recipes.length < 2) return null;
  return recipes.find((recipe) => recipe.lineId === lineId)?.recipeId ?? null;
}

export function createCountLineEvidence(
  deps: CountLineEvidenceDeps,
): (actor: Actor | null | undefined, input: unknown) => Promise<readonly LineEvidenceCount[]> {
  return async function countLineEvidence(
    actor: Actor | null | undefined,
    input: unknown,
  ): Promise<readonly LineEvidenceCount[]> {
    requirePermission(actor, 'pedidos.consultar');

    const parsed = countLineEvidenceSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    const byPair = new Map<string, Line>();
    for (const { orderId, lineId } of parsed.data.lines) byPair.set(lineEvidenceKey(orderId, lineId), { orderId, lineId });
    const lines = [...byPair.values()];
    if (lines.length === 0) return [];

    const counts = await deps.evidence.countByLines(actor.companyId, lines);
    const withPhotos = lines.flatMap((line) => {
      const photoCount = counts.get(lineEvidenceKey(line.orderId, line.lineId)) ?? 0;
      return photoCount > 0 ? [{ ...line, photoCount }] : [];
    });
    if (withPhotos.length === 0) return [];

    const outlines = await readRecipeOutlines(
      deps.orders,
      actor.companyId,
      withPhotos.map((line) => line.orderId),
    );
    const named = withPhotos.map((line) => ({
      line,
      recipeId: namedRecipeIdOf(outlines.get(line.orderId), line.lineId),
    }));
    const recipeIds = [...new Set(named.flatMap(({ recipeId }) => (recipeId === null ? [] : [recipeId])))];
    const refs = recipeIds.length === 0 ? [] : await deps.recipes.findRefsIncludingDeleted(recipeIds, actor.companyId);
    const names = new Map(refs.map((ref) => [ref.id, ref.name] as const));

    return named.map(({ line, recipeId }) => ({
      ...line,
      recipeName: recipeId === null ? null : (names.get(recipeId) ?? null),
    }));
  };
}
