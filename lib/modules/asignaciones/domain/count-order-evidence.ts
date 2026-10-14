import { requirePermission, type Actor } from './actor';

import type { OrderEvidenceCount } from './order-evidence';
import type { StepEvidenceRepository } from '../ports/step-evidence-repository';

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
    void deps;
    void input;
    throw new Error('not implemented: countOrderEvidence');
  };
}
