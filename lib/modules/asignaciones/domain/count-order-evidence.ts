import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { ValidationError } from './errors';

import type { OrderEvidenceCount } from './order-evidence';
import type { StepEvidenceRepository } from '../ports/step-evidence-repository';

const MAX_ORDER_IDS = 25;

const countOrderEvidenceSchema = z.strictObject({
  orderIds: z.array(z.string().uuid()).max(MAX_ORDER_IDS),
});

export type CountOrderEvidenceDeps = {
  readonly evidence: StepEvidenceRepository;
};

export function createCountOrderEvidence(
  deps: CountOrderEvidenceDeps,
): (actor: Actor | null | undefined, input: unknown) => Promise<readonly OrderEvidenceCount[]> {
  return async function countOrderEvidence(
    actor: Actor | null | undefined,
    input: unknown,
  ): Promise<readonly OrderEvidenceCount[]> {
    requirePermission(actor, 'pedidos.consultar');

    const parsed = countOrderEvidenceSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    const orderIds = [...new Set(parsed.data.orderIds)];
    if (orderIds.length === 0) return [];

    const counts = await deps.evidence.countByOrders(actor.companyId, orderIds);
    return orderIds.flatMap((orderId) => {
      const photoCount = counts.get(orderId) ?? 0;
      return photoCount > 0 ? [{ orderId, photoCount }] : [];
    });
  };
}
