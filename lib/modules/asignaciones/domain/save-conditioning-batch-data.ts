// lib/modules/asignaciones/domain/save-conditioning-batch-data.ts
/**
 * Guardar lote, vencimiento y dia de produccion de las lineas de un pedido. Solo lo hace quien
 * acondiciona, y solo desde que comenzo: en `EN_ACONDICIONAMIENTO`, `TERMINADO` o `ENTREGADO`.
 * Ningun dato se borra: cada linea enviada trae los tres. Cada guardado anota en el registro de
 * ejecucion una foto de lo que escribio, en la misma transaccion.
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
import { ExecutionAbortedError, type ExecutionWriteOutcome } from './execution-entry';

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

const lineSchema = z.strictObject({
  batchId: z.string().uuid(),
  lot: typedLotSchema,
  expiryDate: civilDateSchema,
  productionDate: civilDateSchema,
});

export const saveConditioningBatchDataSchema = z.strictObject({
  orderId: z.string().uuid(),
  lines: z
    .array(lineSchema)
    .min(1)
    .refine((lines) => new Set(lines.map((line) => line.batchId)).size === lines.length),
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
/** Fuera de `EN_ACONDICIONAMIENTO` el pedido solo existe para quien lo acondiciono: el detalle
 *  responde igual, y asi no se revela que esta en otro estado o es de otra persona. */
const CLOSED_STATUSES: ReadonlySet<string> = new Set(['TERMINADO', 'ENTREGADO']);

function civilDayUtc(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

function firstDuplicateLot(lines: SaveConditioningBatchDataInput['lines']): string | undefined {
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line.lot)) return line.batchId;
    seen.add(line.lot);
  }
  return undefined;
}

async function composeSnapshot(
  deps: SaveConditioningBatchDataDeps,
  companyId: string,
  orderId: string,
  lines: SaveConditioningBatchDataInput['lines'],
): Promise<readonly ConditioningBatchSnapshotLine[]> {
  const ofOrder = await deps.batches.listOfOrder(companyId, orderId);
  const presentationOf = new Map(ofOrder.map((batch) => [batch.batchId, batch.presentationId]));
  const missing = lines.find((line) => !presentationOf.has(line.batchId));
  if (missing !== undefined) throw new ConditioningBatchNotFoundError(missing.batchId);

  const presentationIds = [...new Set(lines.map((line) => presentationOf.get(line.batchId)!))];
  const refs = await deps.presentations.findRefs(presentationIds, companyId);
  const nameOf = new Map(refs.map((ref) => [ref.id, ref.name]));

  return lines.map((line) => {
    const presentationId = presentationOf.get(line.batchId)!;
    return {
      batchId: line.batchId,
      presentationId,
      presentationName: nameOf.get(presentationId) ?? null,
      lot: line.lot,
      expiryDate: line.expiryDate,
      productionDate: line.productionDate,
    };
  });
}

/** Solo llegan aqui los desenlaces de `writeForOrder` que no son `written`. */
function batchLabelsError(outcome: ExecutionWriteOutcome): AsignacionesError {
  const rejected = outcome as Exclude<FinishedBatchLabelsOutcome, { kind: 'written' }>;
  if (rejected.kind === 'batch_not_found') return new ConditioningBatchNotFoundError(rejected.batchId);
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
    const { orderId, lines } = parsed.data;

    const target = await deps.orders.findAliveById(orderId, actor.companyId);
    if (target === null) throw new OrderNotFoundError();
    if (!(SUMMARY_STATUSES as readonly string[]).includes(target.status)) throw new OrderNotConditionableError();

    const summaryPage = await deps.orders.listAliveSummariesByIds(actor.companyId, [orderId], [target.status], 1, 1);
    const summary = summaryPage.items[0];
    if (summary === undefined) throw new OrderNotFoundError();
    if (summary.conditionedBy !== actor.id) {
      if (CLOSED_STATUSES.has(summary.status)) throw new OrderNotFoundError();
      throw new OrderConditioningTakenError();
    }

    const now = deps.now?.() ?? new Date();
    const today = civilDayUtc(now);
    const expiryNotFuture = lines.find((line) => line.expiryDate <= today);
    if (expiryNotFuture !== undefined) throw new BatchExpiryNotFutureError(expiryNotFuture.batchId);
    const productionFuture = lines.find((line) => line.productionDate > today);
    if (productionFuture !== undefined) throw new BatchProductionDateFutureError(productionFuture.batchId);

    const duplicated = firstDuplicateLot(lines);
    if (duplicated !== undefined) throw new ConditioningBatchDuplicateLotError(duplicated);

    const companyId = actor.companyId;
    const batchLines = await composeSnapshot(deps, companyId, orderId, lines);

    try {
      await deps.transaction.run(async ({ batches, log }) => {
        const outcome = await batches.writeForOrder({ companyId, orderId, labels: lines, actorId: actor.id, now });
        // Tras un `duplicate_lot` la transaccion queda abortada en Postgres: hay que lanzar, no seguir.
        if (outcome.kind !== 'written') throw new ExecutionAbortedError(outcome);
        await log.append({
          action: 'conditioning_batch_save',
          companyId,
          orderId,
          userId: actor.id,
          stepPosition: null,
          batchLines,
          occurredAt: now,
        });
      });
    } catch (error) {
      if (error instanceof ExecutionAbortedError) throw batchLabelsError(error.outcome);
      throw error;
    }
  };
}
