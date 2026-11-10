// lib/modules/asignaciones/domain/save-conditioning-batch-data.ts
/**
 * Guardar lote, vencimiento y dia de produccion de una receta del pedido. Solo lo hace quien la
 * acondiciona, y solo desde que comenzo: en `EN_ACONDICIONAMIENTO`, `TERMINADO` o `ENTREGADO`. Los tres datos
 * pasan a todas las lineas con lote: que lotes son lo decide el servidor, no la entrada. Cada
 * guardado anota en el registro de ejecucion una foto de lo que escribio, en la misma transaccion.
 *
 * Las fechas se comparan como cadenas `AAAA-MM-DD` contra el dia civil UTC del servidor: con ancho
 * fijo el orden lexicografico es el del calendario y no hay corrimiento de zona.
 */
import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import {
  BatchExpiryNotFutureError,
  BatchProductionDateFutureError,
  ConditioningBatchDuplicateLotError,
  ConditioningBatchNotFoundError,
  OrderConditioningTakenError,
  OrderNotConditionableError,
  OrderNotFoundError,
  ValidationError,
  type AsignacionesError,
} from './errors';
import { ExecutionAbortedError } from './execution-entry';
import { findLine, orderLineInputSchema } from './order-line-target';

import type { ConditioningBatchSnapshotLine } from './conditioning-trace';
import type { ExecutionTransaction } from '../ports/execution-transaction';
import {
  civilDateSchema,
  typedLotSchema,
  type FinishedBatchLabels,
  type FinishedBatchLabelsOutcome,
  type PresentationCatalog,
} from '@/lib/modules/inventario';
import type { OrderCatalog } from '@/lib/modules/pedidos';

export const saveConditioningBatchDataSchema = orderLineInputSchema.extend({
  lot: typedLotSchema,
  expiryDate: civilDateSchema,
  productionDate: civilDateSchema,
});

export type SaveConditioningBatchDataInput = z.infer<typeof saveConditioningBatchDataSchema>;

export type SaveConditioningBatchDataDeps = {
  readonly orders: OrderCatalog;
  readonly batches: Pick<FinishedBatchLabels, 'listOfOrder'>;
  readonly presentations: Pick<PresentationCatalog, 'findRefs'>;
  readonly transaction: ExecutionTransaction;
  readonly now?: () => Date;
};

const SUMMARY_STATUSES = ['EN_ACONDICIONAMIENTO', 'TERMINADO', 'ENTREGADO'] as const;
/** Fuera de `EN_ACONDICIONAMIENTO` la receta solo existe para quien la acondiciono: el detalle
 *  responde igual, y asi no se revela que esta en otro estado o es de otra persona. */
const CLOSED_STATUSES: ReadonlySet<string> = new Set(['TERMINADO', 'ENTREGADO']);

function civilDayUtc(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

/**
 * La foto: una linea por cada lote que el guardado va a escribir (los que devuelve `listOfOrder`, en
 * su orden), con los datos ya parseados. Sin lotes, el pedido no tiene nada que guardar.
 */
async function composeSnapshot(
  deps: SaveConditioningBatchDataDeps,
  companyId: string,
  orderId: string,
  lineId: string,
  label: { readonly lot: string; readonly expiryDate: string; readonly productionDate: string },
): Promise<readonly ConditioningBatchSnapshotLine[]> {
  const ofOrder = await deps.batches.listOfOrder(companyId, orderId, lineId);
  if (ofOrder.length === 0) throw new ConditioningBatchNotFoundError();

  const presentationIds = [...new Set(ofOrder.map((batch) => batch.presentationId))];
  const refs = await deps.presentations.findRefs(presentationIds, companyId);
  const nameOf = new Map(refs.map((ref) => [ref.id, ref.name]));

  return ofOrder.map((batch) => ({
    batchId: batch.batchId,
    presentationId: batch.presentationId,
    presentationName: nameOf.get(batch.presentationId) ?? null,
    lot: label.lot,
    expiryDate: label.expiryDate,
    productionDate: label.productionDate,
  }));
}

type BatchLabelsRejection = Exclude<FinishedBatchLabelsOutcome, { kind: 'written' }>;

class BatchLabelsAbortedError extends ExecutionAbortedError {
  constructor(override readonly outcome: BatchLabelsRejection) {
    super(outcome);
  }
}

function batchLabelsError(rejected: BatchLabelsRejection): AsignacionesError {
  if (rejected.kind === 'no_batches') return new ConditioningBatchNotFoundError();
  return new ConditioningBatchDuplicateLotError(rejected.batchId ?? undefined);
}

export function createSaveConditioningBatchData(
  deps: SaveConditioningBatchDataDeps,
): (actor: Actor | null | undefined, input: unknown) => Promise<void> {
  return async function saveConditioningBatchData(actor: Actor | null | undefined, input: unknown): Promise<void> {
    // Autorizar va antes de validar la entrada y antes de tocar ningun puerto.
    requirePermission(actor, 'acondicionamiento.modificar');

    const parsed = saveConditioningBatchDataSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { orderId, lineId, lot, expiryDate, productionDate } = parsed.data;

    const summary = await findLine(deps.orders, actor.companyId, orderId, lineId);
    if (!(SUMMARY_STATUSES as readonly string[]).includes(summary.status)) throw new OrderNotConditionableError();
    if (summary.conditionedBy !== actor.id) {
      if (CLOSED_STATUSES.has(summary.status)) throw new OrderNotFoundError();
      throw new OrderConditioningTakenError();
    }

    const now = deps.now?.() ?? new Date();
    const today = civilDayUtc(now);
    if (expiryDate <= today) throw new BatchExpiryNotFutureError();
    if (productionDate > today) throw new BatchProductionDateFutureError();

    const companyId = actor.companyId;
    const label = { lot, expiryDate, productionDate };
    const batchLines = await composeSnapshot(deps, companyId, orderId, summary.lineId, label);

    try {
      await deps.transaction.run(async ({ batches, log }) => {
        const outcome = await batches.writeForOrder({
          companyId,
          orderId,
          orderLineId: summary.lineId,
          label,
          actorId: actor.id,
          now,
        });
        // Tras un `duplicate_lot` la transaccion queda abortada en Postgres: hay que lanzar, no seguir.
        if (outcome.kind !== 'written') throw new BatchLabelsAbortedError(outcome);
        await log.append({
          action: 'conditioning_batch_save',
          companyId,
          orderId,
          orderLineId: summary.lineId,
          userId: actor.id,
          stepPosition: null,
          batchLines,
          occurredAt: now,
        });
      });
    } catch (error) {
      if (error instanceof BatchLabelsAbortedError) throw batchLabelsError(error.outcome);
      throw error;
    }
  };
}
