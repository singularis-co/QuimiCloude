// lib/modules/asignaciones/domain/get-conditioning-order.ts
/**
 * El detalle del acondicionador: la misma fila de «Por acondicionar» para una receta. Abre una
 * `POR_ACONDICIONAR` o `EN_ACONDICIONAMIENTO` de la empresa, la acondicione quien la acondicione, y
 * una `TERMINADO` o `ENTREGADO` solo si la acondiciono el actor. Todo lo demas es `order_not_found`,
 * el mismo error que un pedido inexistente, para no revelar que existe en otro estado o de otra
 * persona.
 *
 * Los datos de lote solo los ve quien acondiciona, que es el unico que puede escribirlos. Los pasos
 * de acondicionamiento y su avance, solo mientras lo acondiciona: en cualquier otro caso ni se leen.
 */
import { requirePermission, type Actor } from './actor';
import {
  composeConditioningOrderDetail,
  composeConditioningStepsView,
  type ConditioningOrderDetail,
  type ConditioningStepsView,
} from './conditioning-order-view';
import { lineConditioningProgress } from './conditioning-steps';
import { OrderNotFoundError, ValidationError } from './errors';
import { readStepEvidence } from './evidence-photos';
import { findLine, orderLineInputSchema } from './order-line-target';

import type { ComposeOrderRowsDeps } from './compose-order-rows';
import type { ConditioningTeamRepository } from '../ports/conditioning-team-repository';
import type { EvidenceStorage } from '../ports/evidence-storage';
import type { ExecutionLogRepository } from '../ports/execution-log-repository';
import type { StepEvidenceRepository } from '../ports/step-evidence-repository';

import type { FinishedBatchLabels } from '@/lib/modules/inventario';
import type { AssignedOrderSummary, OrderCatalog } from '@/lib/modules/pedidos';
import type { RecipeConditioningStepsReader } from '@/lib/modules/recetas';

const DETAIL_STATUSES: ReadonlySet<string> = new Set(['POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO', 'ENTREGADO']);
const CLOSED_STATUSES: ReadonlySet<string> = new Set(['TERMINADO', 'ENTREGADO']);
const TEAM_STATUSES: ReadonlySet<string> = new Set(['EN_ACONDICIONAMIENTO', 'TERMINADO', 'ENTREGADO']);

export type GetConditioningOrderDeps = ComposeOrderRowsDeps & {
  readonly orders: OrderCatalog;
  readonly team: ConditioningTeamRepository;
  readonly batches: Pick<FinishedBatchLabels, 'listOfOrder'>;
  readonly conditioningSteps: RecipeConditioningStepsReader;
  readonly log: Pick<ExecutionLogRepository, 'listEntriesForOrders'>;
  readonly evidence: StepEvidenceRepository;
  readonly storage: EvidenceStorage;
};

async function readConditioningSteps(
  deps: GetConditioningOrderDeps,
  actor: Actor,
  summary: AssignedOrderSummary,
  detail: Pick<ConditioningOrderDetail, 'conditionedByName' | 'team'>,
): Promise<ConditioningStepsView | null> {
  if (summary.status !== 'EN_ACONDICIONAMIENTO' || summary.conditionedBy !== actor.id) return null;
  const steps = (await deps.conditioningSteps.findConditioningStepsById(summary.recipeId, actor.companyId)) ?? [];
  if (steps.length === 0) return null;
  const [entries, evidence] = await Promise.all([
    deps.log.listEntriesForOrders(actor.companyId, [summary.id]),
    readStepEvidence(deps.evidence, deps.storage, actor.companyId, summary.id, summary.lineId, 'conditioning', steps),
  ]);
  return composeConditioningStepsView(detail, actor.id, steps, lineConditioningProgress(entries, summary.lineId, steps.length), evidence);
}

export function createGetConditioningOrder(
  deps: GetConditioningOrderDeps,
): (actor: Actor | null | undefined, input: unknown) => Promise<ConditioningOrderDetail> {
  return async function getConditioningOrder(
    actor: Actor | null | undefined,
    input: unknown,
  ): Promise<ConditioningOrderDetail> {
    // Autorizar va antes de validar la entrada y antes de tocar ningun puerto.
    requirePermission(actor, 'acondicionamiento.modificar');

    const parsed = orderLineInputSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { orderId, lineId } = parsed.data;

    const summary = await findLine(deps.orders, actor.companyId, orderId, lineId);
    if (!DETAIL_STATUSES.has(summary.status)) throw new OrderNotFoundError();
    const isConditioner = summary.conditionedBy === actor.id;
    if (CLOSED_STATUSES.has(summary.status) && !isConditioner) throw new OrderNotFoundError();

    const team = TEAM_STATUSES.has(summary.status)
      ? await deps.team.listByLineInCompany(actor.companyId, orderId, summary.lineId)
      : [];
    const batches =
      summary.status !== 'POR_ACONDICIONAR' && isConditioner
        ? await deps.batches.listOfOrder(actor.companyId, orderId, summary.lineId)
        : null;
    const detail = await composeConditioningOrderDetail(deps, actor.companyId, summary, team, batches);
    if (detail === undefined) throw new OrderNotFoundError();
    return { ...detail, conditioningSteps: await readConditioningSteps(deps, actor, summary, detail) };
  };
}
