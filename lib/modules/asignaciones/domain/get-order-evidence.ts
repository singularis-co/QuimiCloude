import { requirePermission, type Actor } from './actor';

import type { OrderEvidenceRead } from './order-evidence';
import type { ReadOrderEvidenceDeps } from './read-order-evidence';

export type GetOrderEvidenceDeps = ReadOrderEvidenceDeps;

export function createGetOrderEvidence(
  deps: GetOrderEvidenceDeps,
): (actor: Actor | null | undefined, input: unknown) => Promise<OrderEvidenceRead> {
  return async function getOrderEvidence(
    actor: Actor | null | undefined,
    input: unknown,
  ): Promise<OrderEvidenceRead> {
    requirePermission(actor, 'pedidos.consultar');
    void deps;
    void input;
    throw new Error('not implemented: getOrderEvidence');
  };
}
