import { requirePermission, type Actor } from './actor';

import type { OrderEvidenceRead } from './order-evidence';
import type { ReadOrderEvidenceDeps } from './read-order-evidence';

export type GetExecutionEvidenceDeps = ReadOrderEvidenceDeps;

export function createGetExecutionEvidence(
  deps: GetExecutionEvidenceDeps,
): (actor: Actor | null | undefined, input: unknown) => Promise<OrderEvidenceRead> {
  return async function getExecutionEvidence(
    actor: Actor | null | undefined,
    input: unknown,
  ): Promise<OrderEvidenceRead> {
    requirePermission(actor, 'dashboard.consultar');
    void deps;
    void input;
    throw new Error('not implemented: getExecutionEvidence');
  };
}
