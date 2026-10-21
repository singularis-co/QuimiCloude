/**
 * Cuantos pedidos en curso de esas recetas ya tienen fotos de evidencia: los que impiden mover o
 * quitar pasos de la formula. Servicio interno, sin actor: quien lo llama ya autorizo.
 *
 * Se parte de los pedidos en curso, que son la cola de trabajo de planta y estan acotados, y no de
 * las fotos, que crecen sin fin.
 */
import type { EvidencePhase } from './step-evidence';
import type { StepEvidenceRepository } from '../ports/step-evidence-repository';
import type { OrderCatalog, OrderStatus } from '@/lib/modules/pedidos';

/** El tope que acepta el catalogo de pedidos: pedir mas no trae mas por pagina. */
const PAGE_SIZE = 25;

const PHASE_BY_STATUS = {
  EN_CURSO: 'manufacturing',
  EN_EMPAQUE: 'packing',
  EN_ACONDICIONAMIENTO: 'conditioning',
} as const satisfies Partial<Record<OrderStatus, EvidencePhase>>;

const IN_PROGRESS_STATUSES = Object.keys(PHASE_BY_STATUS) as (keyof typeof PHASE_BY_STATUS)[];

export type CountEvidenceLockingOrdersDeps = {
  readonly orders: OrderCatalog;
  readonly evidence: StepEvidenceRepository;
};

export type CountEvidenceLockingOrders = (companyId: string, recipeIds: readonly string[]) => Promise<number>;

function phaseOf(status: OrderStatus): EvidencePhase | null {
  return status === 'EN_CURSO' || status === 'EN_EMPAQUE' || status === 'EN_ACONDICIONAMIENTO'
    ? PHASE_BY_STATUS[status]
    : null;
}

export function createCountEvidenceLockingOrders(deps: CountEvidenceLockingOrdersDeps): CountEvidenceLockingOrders {
  return async function countEvidenceLockingOrders(companyId, recipeIds) {
    if (recipeIds.length === 0) return 0;
    const wanted = new Set(recipeIds);

    const candidates: { orderId: string; phase: EvidencePhase }[] = [];
    for (let page = 1; ; page++) {
      const result = await deps.orders.listAliveSummariesInCompany(
        companyId,
        IN_PROGRESS_STATUSES,
        'work_queue',
        page,
        PAGE_SIZE,
      );
      for (const order of result.items) {
        const phase = phaseOf(order.status);
        if (phase !== null && wanted.has(order.recipeId)) candidates.push({ orderId: order.id, phase });
      }
      if (result.items.length === 0 || page >= result.totalPages) break;
    }
    if (candidates.length === 0) return 0;

    const withEvidence = await deps.evidence.listOrderIdsWithEvidence(companyId, candidates);
    return new Set(withEvidence).size;
  };
}
