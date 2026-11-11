import { OrderNotFoundError } from './errors';
import {
  groupEvidenceRows,
  type ExecutionEvidenceRead,
  type OrderEvidence,
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

type OrderEvidenceRows = {
  readonly manufacturing: readonly StepEvidenceRow[];
  readonly packing: readonly StepEvidenceRow[];
  readonly conditioning: readonly StepEvidenceRow[];
};

/** Lanza `OrderNotFoundError` si el pedido no es de la empresa, vivo o dado de baja. */
async function readOrderEvidenceRows(
  deps: ReadOrderEvidenceDeps,
  companyId: string,
  orderId: string,
): Promise<OrderEvidenceRows> {
  const summaries = await deps.orders.listSummariesByIdsIncludingDeleted(
    companyId,
    [orderId],
    ORDER_STATUS_VALUES,
    1,
    1,
  );
  if (!summaries.items.some((item) => item.id === orderId)) throw new OrderNotFoundError();

  const [manufacturing, packing, conditioning] = await Promise.all([
    deps.evidence.listByOrder(companyId, orderId, 'manufacturing'),
    deps.evidence.listByOrder(companyId, orderId, 'packing'),
    deps.evidence.listByOrder(companyId, orderId, 'conditioning'),
  ]);
  return { manufacturing, packing, conditioning };
}

function toEvidence(rows: OrderEvidenceRows, signing: Signing): OrderEvidence {
  return {
    manufacturing: toGroups(groupEvidenceRows(rows.manufacturing), signing),
    packing: toGroups(groupEvidenceRows(rows.packing), signing),
    conditioning: toGroups(groupEvidenceRows(rows.conditioning), signing),
  };
}

/** Por fase, paso y `slot`: el orden en que se piden las firmas. */
function allRows(rows: OrderEvidenceRows): readonly StepEvidenceRow[] {
  return [rows.manufacturing, rows.packing, rows.conditioning]
    .flatMap((phaseRows) => groupEvidenceRows(phaseRows))
    .flatMap((group) => group.rows);
}

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
  const rows = await readOrderEvidenceRows(deps, companyId, orderId);
  const all = allRows(rows);

  if (all.length === 0) {
    return { evidence: { manufacturing: [], packing: [], conditioning: [] }, signingFailure: null };
  }

  const signing = await signAll(deps.storage, all);
  return {
    evidence: toEvidence(rows, signing),
    signingFailure: 'failure' in signing ? signing.failure : null,
  };
}

/**
 * Las mismas fotos que `readOrderEvidence`, separadas por linea del pedido: solo salen las lineas
 * con alguna foto, en el orden en que aparece su primera foto. Una sola firma para todas.
 */
export async function readOrderEvidenceByLine(
  deps: ReadOrderEvidenceDeps,
  companyId: string,
  orderId: string,
): Promise<ExecutionEvidenceRead> {
  const rows = await readOrderEvidenceRows(deps, companyId, orderId);
  const all = allRows(rows);
  if (all.length === 0) return { evidence: { recipes: [] }, signingFailure: null };

  const lineIds = [...new Set(all.map((row) => row.orderLineId))];
  const signing = await signAll(deps.storage, all);
  const ofLine = (lineId: string): OrderEvidenceRows => ({
    manufacturing: rows.manufacturing.filter((row) => row.orderLineId === lineId),
    packing: rows.packing.filter((row) => row.orderLineId === lineId),
    conditioning: rows.conditioning.filter((row) => row.orderLineId === lineId),
  });
  return {
    evidence: { recipes: lineIds.map((lineId) => ({ lineId, evidence: toEvidence(ofLine(lineId), signing) })) },
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
