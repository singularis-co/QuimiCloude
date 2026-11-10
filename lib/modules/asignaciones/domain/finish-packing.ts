// lib/modules/asignaciones/domain/finish-packing.ts
/**
 * Terminar: la receta nombrada pasa `EN_EMPAQUE -> POR_ACONDICIONAR`, sin `finished_at`, solo si el
 * actor es quien la tiene en empaque. Sin comprobacion de asignacion: cualquier actor con
 * `empaque.modificar` puede terminar cualquier receta de un pedido vivo de su empresa, y sin ningun
 * puerto de inventario: los envases los consume `pedidos` dentro de Terminar, segun el conteo real
 * por linea del reparto que trae la entrada.
 *
 * Devuelve el numero visible del pedido, leido antes de la transicion.
 */
import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import {
  IncompatibleUnitsError,
  MaterialShortageError,
  OrderNotFoundError,
  OrderNotPackableError,
  OrderPackingTakenError,
  OrderWithoutUnitError,
  PackagingStockInsufficientError,
  PresentationWithoutContentError,
  RecipeNotFoundError,
  ValidationError,
  type AsignacionesError,
} from './errors';
import { assertEvidenceComplete } from './evidence-photos';
import { ExecutionAbortedError, isExecutionSuccess, type ExecutionWriteOutcome } from './execution-entry';
import { findLine, orderLineInputSchema } from './order-line-target';

import type { ExecutionLogRepository } from '../ports/execution-log-repository';
import type { ExecutionTransaction } from '../ports/execution-transaction';
import type { StepEvidenceRepository } from '../ports/step-evidence-repository';
import {
  PACKING_DIFFERENCE_REASONS,
  PACKING_REASON_OTHER_MAX,
  formatOrderNumber,
  type OrderCatalog,
  type PackedLineCount,
} from '@/lib/modules/pedidos';
import type { RecipePackingStepsReader } from '@/lib/modules/recetas';

// Aqui solo la forma de cada conteo: que sean justo las lineas del reparto y que el motivo case con
// la diferencia lo decide `pedidos`, que es quien las lee.
const packedCountSchema = z.strictObject({
  presentationLineId: z.string().uuid(),
  packedPackages: z.number().int().min(0),
  reason: z.enum(PACKING_DIFFERENCE_REASONS).nullable(),
  reasonOther: z.string().trim().min(1).max(PACKING_REASON_OTHER_MAX).nullable(),
});

const finishPackingSchema = orderLineInputSchema.extend({
  counts: z.array(packedCountSchema).min(1),
});

export type FinishPackingDeps = {
  readonly orders: OrderCatalog;
  readonly log: ExecutionLogRepository;
  readonly transaction: ExecutionTransaction;
  readonly packingSteps: RecipePackingStepsReader;
  readonly evidence: StepEvidenceRepository;
  readonly now?: () => Date;
};

export type FinishPackingResult = {
  readonly numberText: string;
};

export function createFinishPacking(
  deps: FinishPackingDeps,
): (actor: Actor | null | undefined, input: unknown) => Promise<FinishPackingResult> {
  return async function finishPacking(
    actor: Actor | null | undefined,
    input: unknown,
  ): Promise<FinishPackingResult> {
    // Autorizar va antes de validar la entrada y antes de tocar ningun puerto.
    requirePermission(actor, 'empaque.modificar');

    const parsed = finishPackingSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();
    const { orderId, lineId, counts } = parsed.data;

    const summary = await findLine(deps.orders, actor.companyId, orderId, lineId);
    const numberText = formatOrderNumber(summary.number);
    const packed: PackedLineCount[] = counts.map(({ presentationLineId, ...count }) => ({
      lineId: presentationLineId,
      ...count,
    }));

    // Solo quien lo tiene en empaque puede tener fotos; cualquier otro caso lo rechaza la
    // transaccion con su error propio.
    if (summary.status === 'EN_EMPAQUE' && summary.packedBy === actor.id) {
      const steps = await deps.packingSteps.findPackingStepsById(summary.recipeId, actor.companyId);
      await assertEvidenceComplete(deps.evidence, actor.companyId, orderId, summary.lineId, 'packing', steps ?? []);
    }

    const now = deps.now?.() ?? new Date();
    try {
      await deps.transaction.run(async ({ packing, log }) => {
        // El exito de Terminar es un objeto con los lotes dados de alta, no el literal `'ok'`.
        const result = await packing.finishPackingAliveById(orderId, summary.lineId, actor.companyId, actor.id, now, packed);
        if (!isExecutionSuccess(result)) throw new ExecutionAbortedError(result);
        await log.append({
          companyId: actor.companyId,
          orderId,
          orderLineId: summary.lineId,
          userId: actor.id,
          occurredAt: now,
          action: 'pack_finish',
          stepPosition: null,
        });
      });
    } catch (error) {
      if (error instanceof ExecutionAbortedError) throw finishPackingError(error.outcome);
      throw error;
    }
    return { numberText };
  };
}

function finishPackingError(outcome: ExecutionWriteOutcome): AsignacionesError {
  if (outcome === 'not_packer') return new OrderPackingTakenError();
  if (outcome === 'not_packable') return new OrderNotPackableError();
  if (outcome === 'recipe_not_found') return new RecipeNotFoundError();
  if (outcome === 'presentation_without_content') return new PresentationWithoutContentError();
  if (outcome === 'incompatible_units') return new IncompatibleUnitsError();
  if (outcome === 'order_without_unit') return new OrderWithoutUnitError();
  if (outcome === 'insufficient_material') return new MaterialShortageError();
  if (outcome === 'invalid_packing_count') return new ValidationError('invalid_packing_count');
  if (outcome === 'packaging_stock_insufficient') return new PackagingStockInsufficientError();
  return new OrderNotFoundError();
}
