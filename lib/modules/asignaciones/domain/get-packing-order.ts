// lib/modules/asignaciones/domain/get-packing-order.ts
/**
 * La misma fila de `list-packing-orders.ts` para una receta: la pantalla de empaque abre con esto.
 * Una linea inexistente o en un estado distinto de `POR_EMPACAR`/`EN_EMPAQUE` es `order_not_found`,
 * igual que un pedido inexistente: esta consulta no revela que la receta existe en otro estado.
 */
import { requirePermission, type Actor } from './actor';
import { OrderNotFoundError, ValidationError } from './errors';
import { readStepEvidence } from './evidence-photos';
import {
  composePackingFinishView,
  composePackingOrderRows,
  type PackingFinishViewDeps,
  type PackingOrderDetail,
  type PackingOrderViewDeps,
} from './packing-order-view';
import { findLine, orderLineInputSchema } from './order-line-target';

import type { EvidenceStorage } from '../ports/evidence-storage';
import type { StepEvidenceRepository } from '../ports/step-evidence-repository';
import type { OrderCatalog } from '@/lib/modules/pedidos';
import type { RecipePackingStepsReader } from '@/lib/modules/recetas';

const PACKING_STATUSES: ReadonlySet<string> = new Set(['POR_EMPACAR', 'EN_EMPAQUE']);

export type GetPackingOrderDeps = PackingOrderViewDeps & PackingFinishViewDeps & {
  readonly orders: OrderCatalog;
  readonly packingSteps: RecipePackingStepsReader;
  readonly evidence: StepEvidenceRepository;
  readonly storage: EvidenceStorage;
};

export function createGetPackingOrder(
  deps: GetPackingOrderDeps,
): (actor: Actor | null | undefined, input: unknown) => Promise<PackingOrderDetail> {
  return async function getPackingOrder(
    actor: Actor | null | undefined,
    input: unknown,
  ): Promise<PackingOrderDetail> {
    // Autorizar va antes de validar la entrada y antes de tocar ningun puerto.
    requirePermission(actor, 'empaque.modificar');

    const parsed = orderLineInputSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { orderId, lineId } = parsed.data;

    const summary = await findLine(deps.orders, actor.companyId, orderId, lineId);
    if (!PACKING_STATUSES.has(summary.status)) throw new OrderNotFoundError();

    const [row] = await composePackingOrderRows(deps, actor.companyId, [summary]);
    if (row === undefined) throw new OrderNotFoundError();

    // Antes de Comenzar, o si empaca otro, ni los pasos, ni las fotos, ni el conteo salen en la respuesta.
    if (summary.status !== 'EN_EMPAQUE' || summary.packedBy !== actor.id) {
      return { ...row, packingSteps: [], packingEvidence: [], finish: null };
    }
    const packingSteps = (await deps.packingSteps.findPackingStepsById(summary.recipeId, actor.companyId)) ?? [];
    const packingEvidence = await readStepEvidence(
      deps.evidence,
      deps.storage,
      actor.companyId,
      orderId,
      summary.lineId,
      'packing',
      packingSteps,
    );

    const finish = await composePackingFinishView(deps, actor.companyId, summary);

    return { ...row, packingSteps, packingEvidence, finish };
  };
}
