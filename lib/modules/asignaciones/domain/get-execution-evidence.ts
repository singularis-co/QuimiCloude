import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { OrderNotFoundError } from './errors';
import { readOrderEvidence, type ReadOrderEvidenceDeps } from './read-order-evidence';

import type { OrderEvidenceRead } from './order-evidence';

const getExecutionEvidenceSchema = z.strictObject({ orderId: z.string().uuid() });

export type GetExecutionEvidenceDeps = ReadOrderEvidenceDeps;

export function createGetExecutionEvidence(
  deps: GetExecutionEvidenceDeps,
): (actor: Actor | null | undefined, input: unknown) => Promise<OrderEvidenceRead> {
  return async function getExecutionEvidence(
    actor: Actor | null | undefined,
    input: unknown,
  ): Promise<OrderEvidenceRead> {
    requirePermission(actor, 'dashboard.consultar');

    // Un id mal formado da el mismo error que uno ajeno: la pantalla no puede distinguirlos.
    const parsed = getExecutionEvidenceSchema.safeParse(input);
    if (!parsed.success) throw new OrderNotFoundError();

    return readOrderEvidence(deps, actor.companyId, parsed.data.orderId);
  };
}
