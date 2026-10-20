import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { OrderNotFoundError } from './errors';
import { readOrderEvidence, type ReadOrderEvidenceDeps } from './read-order-evidence';

import type { OrderEvidenceRead } from './order-evidence';

const getOrderEvidenceSchema = z.strictObject({ orderId: z.string().uuid() });

export type GetOrderEvidenceDeps = ReadOrderEvidenceDeps;

export function createGetOrderEvidence(
  deps: GetOrderEvidenceDeps,
): (actor: Actor | null | undefined, input: unknown) => Promise<OrderEvidenceRead> {
  return async function getOrderEvidence(
    actor: Actor | null | undefined,
    input: unknown,
  ): Promise<OrderEvidenceRead> {
    requirePermission(actor, 'pedidos.consultar');

    // Un id mal formado da el mismo error que uno ajeno: la pantalla no puede distinguirlos.
    const parsed = getOrderEvidenceSchema.safeParse(input);
    if (!parsed.success) throw new OrderNotFoundError();

    return readOrderEvidence(deps, actor.companyId, parsed.data.orderId);
  };
}
