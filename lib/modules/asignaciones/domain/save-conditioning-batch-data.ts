// lib/modules/asignaciones/domain/save-conditioning-batch-data.ts
/**
 * Guardar lote, vencimiento y dia de produccion de un pedido. Solo lo hace quien acondiciona, y
 * solo desde que comenzo: en `EN_ACONDICIONAMIENTO`, `TERMINADO` o `ENTREGADO`. Los tres datos
 * pasan a todas las lineas con lote: que lotes son lo decide el servidor, no la entrada.
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
} from './errors';

import { civilDateSchema, typedLotSchema, type FinishedBatchLabels } from '@/lib/modules/inventario';
import type { OrderCatalog } from '@/lib/modules/pedidos';

export const saveConditioningBatchDataSchema = z.strictObject({
  orderId: z.string().uuid(),
  lot: typedLotSchema,
  expiryDate: civilDateSchema,
  productionDate: civilDateSchema,
});

export type SaveConditioningBatchDataInput = z.infer<typeof saveConditioningBatchDataSchema>;

export type SaveConditioningBatchDataDeps = {
  readonly orders: OrderCatalog;
  readonly batches: Pick<FinishedBatchLabels, 'writeForOrder'>;
  readonly now?: () => Date;
};

const SUMMARY_STATUSES = ['EN_ACONDICIONAMIENTO', 'TERMINADO', 'ENTREGADO'] as const;
/** Fuera de `EN_ACONDICIONAMIENTO` el pedido solo existe para quien lo acondiciono: el detalle
 *  responde igual, y asi no se revela que esta en otro estado o es de otra persona. */
const CLOSED_STATUSES: ReadonlySet<string> = new Set(['TERMINADO', 'ENTREGADO']);

function civilDayUtc(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

export function createSaveConditioningBatchData(
  deps: SaveConditioningBatchDataDeps,
): (actor: Actor | null | undefined, input: unknown) => Promise<void> {
  return async function saveConditioningBatchData(actor: Actor | null | undefined, input: unknown): Promise<void> {
    // Autorizar va antes de validar la entrada y antes de tocar ningun puerto.
    requirePermission(actor, 'acondicionamiento.modificar');

    const parsed = saveConditioningBatchDataSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { orderId, lot, expiryDate, productionDate } = parsed.data;

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
    if (expiryDate <= today) throw new BatchExpiryNotFutureError();
    if (productionDate > today) throw new BatchProductionDateFutureError();

    const outcome = await deps.batches.writeForOrder({
      companyId: actor.companyId,
      orderId,
      label: { lot, expiryDate, productionDate },
      actorId: actor.id,
      now,
    });
    if (outcome.kind === 'no_batches') throw new ConditioningBatchNotFoundError();
    if (outcome.kind === 'duplicate_lot') throw new ConditioningBatchDuplicateLotError(outcome.batchId ?? undefined);
  };
}
