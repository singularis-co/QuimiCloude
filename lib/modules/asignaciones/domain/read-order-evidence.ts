import { OrderNotFoundError } from './errors';

import type { OrderEvidenceRead } from './order-evidence';
import type { EvidenceStorage } from '../ports/evidence-storage';
import type { StepEvidenceRepository } from '../ports/step-evidence-repository';
import type { OrderCatalog } from '@/lib/modules/pedidos';

export type ReadOrderEvidenceDeps = {
  readonly orders: OrderCatalog;
  readonly evidence: StepEvidenceRepository;
  readonly storage: EvidenceStorage;
};

/** Lanza `OrderNotFoundError` si el pedido no es de la empresa, vivo o dado de baja. */
export async function readOrderEvidence(
  deps: ReadOrderEvidenceDeps,
  companyId: string,
  orderId: string,
): Promise<OrderEvidenceRead> {
  void deps;
  throw new OrderNotFoundError(`not implemented: ${companyId}/${orderId}`);
}
