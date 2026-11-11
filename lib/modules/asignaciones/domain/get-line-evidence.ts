import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { OrderNotFoundError } from './errors';
import { readOrderEvidenceByLine, type ReadOrderEvidenceDeps } from './read-order-evidence';
import { readRecipeOutlines } from './recipe-of-order';

import type { OrderEvidenceRead } from './order-evidence';

const getLineEvidenceSchema = z.strictObject({ orderId: z.string().uuid(), lineId: z.string().uuid() });

export type GetLineEvidenceDeps = ReadOrderEvidenceDeps;

export function createGetLineEvidence(
  deps: GetLineEvidenceDeps,
): (actor: Actor | null | undefined, input: unknown) => Promise<OrderEvidenceRead> {
  return async function getLineEvidence(
    actor: Actor | null | undefined,
    input: unknown,
  ): Promise<OrderEvidenceRead> {
    requirePermission(actor, 'pedidos.consultar');

    // Un id mal formado da el mismo error que uno ajeno: la pantalla no puede distinguirlos.
    const parsed = getLineEvidenceSchema.safeParse(input);
    if (!parsed.success) throw new OrderNotFoundError();
    const { orderId, lineId } = parsed.data;

    const read = await readOrderEvidenceByLine(deps, actor.companyId, orderId);
    const own = read.evidence.recipes.find((recipe) => recipe.lineId === lineId);
    if (own !== undefined) return { evidence: own.evidence, signingFailure: read.signingFailure };

    // Sin fotos, la linea solo existe si el pedido aun la tiene: una quitada sin fotos, una de otro
    // pedido y una inexistente se ven igual que un pedido ajeno.
    const outline = (await readRecipeOutlines(deps.orders, actor.companyId, [orderId])).get(orderId);
    if (!(outline?.recipes ?? []).some((recipe) => recipe.lineId === lineId)) throw new OrderNotFoundError();
    return { evidence: { manufacturing: [], packing: [], conditioning: [] }, signingFailure: null };
  };
}
