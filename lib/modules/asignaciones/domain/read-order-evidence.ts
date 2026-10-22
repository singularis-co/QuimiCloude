import { OrderNotFoundError } from './errors';
import {
  groupEvidenceRows,
  type OrderEvidenceGroup,
  type OrderEvidenceRead,
  type StepEvidenceRowGroup,
} from './order-evidence';
import { EVIDENCE_READ_LINK_TTL_SECONDS } from './step-evidence';

import { ORDER_STATUS_VALUES, type OrderCatalog } from '@/lib/modules/pedidos';

import type { EvidenceStorage } from '../ports/evidence-storage';
import type { StepEvidenceRepository, StepEvidenceRow } from '../ports/step-evidence-repository';

export type ReadOrderEvidenceDeps = {
  readonly orders: OrderCatalog;
  readonly evidence: StepEvidenceRepository;
  readonly storage: EvidenceStorage;
};

type Signing = { readonly urlById: ReadonlyMap<string, string> } | { readonly failure: string };

/**
 * Lanza `OrderNotFoundError` si el pedido no es de la empresa, vivo o dado de baja.
 *
 * No mira la formula: las fotos salen aunque su paso ya no exista o ya no pida evidencia.
 */
export async function readOrderEvidence(
  deps: ReadOrderEvidenceDeps,
  companyId: string,
  orderId: string,
): Promise<OrderEvidenceRead> {
  const summaries = await deps.orders.listSummariesByIdsIncludingDeleted(
    companyId,
    [orderId],
    ORDER_STATUS_VALUES,
    1,
    1,
  );
  if (!summaries.items.some((item) => item.id === orderId)) throw new OrderNotFoundError();

  const [manufacturingRows, packingRows, conditioningRows] = await Promise.all([
    deps.evidence.listByOrder(companyId, orderId, 'manufacturing'),
    deps.evidence.listByOrder(companyId, orderId, 'packing'),
    deps.evidence.listByOrder(companyId, orderId, 'conditioning'),
  ]);
  const manufacturing = groupEvidenceRows(manufacturingRows);
  const packing = groupEvidenceRows(packingRows);
  const conditioning = groupEvidenceRows(conditioningRows);
  const rows = [...manufacturing, ...packing, ...conditioning].flatMap((group) => group.rows);

  if (rows.length === 0) {
    return { evidence: { manufacturing: [], packing: [], conditioning: [] }, signingFailure: null };
  }

  const signing = await signAll(deps.storage, rows);
  return {
    evidence: {
      manufacturing: toGroups(manufacturing, signing),
      packing: toGroups(packing, signing),
      conditioning: toGroups(conditioning, signing),
    },
    signingFailure: 'failure' in signing ? signing.failure : null,
  };
}

/** Una sola llamada al proveedor para todas las fotos del pedido. */
async function signAll(storage: EvidenceStorage, rows: readonly StepEvidenceRow[]): Promise<Signing> {
  try {
    const urls = await storage.createSignedReadUrls(
      rows.map((row) => row.path),
      EVIDENCE_READ_LINK_TTL_SECONDS,
    );
    return { urlById: new Map(rows.map((row, index) => [row.id, urls[index]!])) };
  } catch (error) {
    // Sin firma los grupos salen igual, con su cantidad y sin fotos: la pantalla ofrece reintentar.
    return { failure: error instanceof Error ? error.message : `se lanzo un valor de tipo ${typeof error}` };
  }
}

function toGroups(groups: readonly StepEvidenceRowGroup[], signing: Signing): readonly OrderEvidenceGroup[] {
  return groups.map((group) => ({
    stepPosition: group.stepPosition,
    photoCount: group.rows.length,
    photos:
      'failure' in signing
        ? null
        : group.rows.map((row) => ({ id: row.id, slot: row.slot, url: signing.urlById.get(row.id)! })),
  }));
}
