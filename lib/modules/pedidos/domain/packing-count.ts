// Dominio PURO del conteo real de envases al terminar el empaque. Lo usan el servidor y el
// dialogo del cliente, para que la regla no pueda divergir entre los dos.

import { MOVEMENT_REASONS, STOCK_INCREASE_REASONS } from '@/lib/modules/inventario';
import type { UnitConversion } from '@/lib/modules/unidades';

import { sumInOrderUnit, validateDistribution, type SumInOrderUnitResult } from './order-distribution';

/** Motivos validos cuando salen menos envases que el plan. */
export const PACKING_DIFFERENCE_REASONS = [...MOVEMENT_REASONS, 'otro'] as const;

/** Motivos validos cuando salen mas envases que el plan: merma y rotura no explican un sobrante. */
export const PACKING_INCREASE_REASONS = [...STOCK_INCREASE_REASONS, 'otro'] as const;

export type PackingDifferenceReason = (typeof PACKING_DIFFERENCE_REASONS)[number];

export const PACKING_REASON_OTHER_MAX = 200;

export type PackedLineCount = {
  readonly lineId: string;
  readonly packedPackages: number;
  readonly reason: PackingDifferenceReason | null;
  readonly reasonOther: string | null;
};

export type PackingPlanLine = {
  readonly id: string;
  readonly packages: number;
};

export type PackingLineError =
  | 'invalid_count'
  | 'missing_reason'
  | 'unexpected_reason'
  | 'reason_not_allowed'
  | 'missing_reason_other'
  | 'reason_other_too_long'
  | 'unexpected_reason_other';

export type PackingCountCheck =
  | { readonly kind: 'ok' }
  | {
      readonly kind: 'invalid';
      /** Lineas del pedido sin conteo. */
      readonly missingLineIds: readonly string[];
      /** Conteos de lineas que no son del pedido, o repetidos. */
      readonly unexpectedLineIds: readonly string[];
      readonly lineErrors: ReadonlyMap<string, PackingLineError>;
    };

function lineError(plan: number, count: PackedLineCount): PackingLineError | null {
  const packed = count.packedPackages;
  if (!Number.isSafeInteger(packed) || packed < 0) return 'invalid_count';

  if (packed === plan) {
    if (count.reason !== null) return 'unexpected_reason';
    return count.reasonOther === null ? null : 'unexpected_reason_other';
  }

  if (count.reason === null) return 'missing_reason';
  const allowed: readonly string[] = packed > plan ? PACKING_INCREASE_REASONS : PACKING_DIFFERENCE_REASONS;
  if (!allowed.includes(count.reason)) return 'reason_not_allowed';

  if (count.reason !== 'otro') return count.reasonOther === null ? null : 'unexpected_reason_other';
  const text = count.reasonOther?.trim() ?? '';
  if (text.length === 0) return 'missing_reason_other';
  return text.length > PACKING_REASON_OTHER_MAX ? 'reason_other_too_long' : null;
}

/**
 * Exige un conteo por cada linea del pedido y solo por ellas, entero >= 0, con motivo si y solo
 * si difiere del plan y valido para su sentido, y texto (tras recortar) si y solo si el motivo
 * es `otro`. Recorre todo para que el dialogo pueda marcar cada linea, no solo la primera.
 */
export function checkPackingCounts(
  lines: readonly PackingPlanLine[],
  counts: readonly PackedLineCount[],
): PackingCountCheck {
  const planById = new Map(lines.map((line) => [line.id, line.packages] as const));
  const seen = new Set<string>();
  const unexpectedLineIds: string[] = [];
  const lineErrors = new Map<string, PackingLineError>();

  for (const count of counts) {
    const plan = planById.get(count.lineId);
    if (plan === undefined || seen.has(count.lineId)) {
      unexpectedLineIds.push(count.lineId);
      continue;
    }
    seen.add(count.lineId);
    const error = lineError(plan, count);
    if (error !== null) lineErrors.set(count.lineId, error);
  }

  const missingLineIds = lines.map((line) => line.id).filter((id) => !seen.has(id));
  if (missingLineIds.length === 0 && unexpectedLineIds.length === 0 && lineErrors.size === 0) {
    return { kind: 'ok' };
  }
  return { kind: 'invalid', missingLineIds, unexpectedLineIds, lineErrors };
}

/** Los envases que cuentan para entregar, acondicionar y consultar: sin conteo guardado, el plan. */
export function effectivePackages(line: { readonly packages: number; readonly packedPackages: number | null }): number {
  return line.packedPackages ?? line.packages;
}

export type PackedDistributionLine = {
  readonly lineId: string;
  readonly presentationId: string;
  readonly packedPackages: number;
  readonly content: string | null;
  readonly unit: UnitConversion;
};

function toDistributionLines(lines: readonly PackedDistributionLine[]) {
  return lines.map((line) => ({
    presentationId: line.presentationId,
    packages: line.packedPackages,
    content: line.content,
    unit: line.unit,
  }));
}

/** Lo envasado de verdad en la unidad del pedido, con la misma conversion que el reparto. */
export function packedTotalInOrderUnit(
  orderUnit: UnitConversion,
  lines: readonly PackedDistributionLine[],
): SumInOrderUnitResult {
  return sumInOrderUnit(orderUnit, toDistributionLines(lines));
}

/**
 * El mayor numero de envases de `lineId` que, con las demas lineas como estan, no supera la
 * cantidad del pedido. `null` si ni con 0 cabe, o si alguna linea no se puede convertir.
 */
export function maxPackagesForLine(
  quantity: string,
  orderUnit: UnitConversion,
  lines: readonly PackedDistributionLine[],
  lineId: string,
): number | null {
  if (!lines.some((line) => line.lineId === lineId)) return null;

  const fits = (packages: number): boolean =>
    validateDistribution(
      quantity,
      orderUnit,
      toDistributionLines(lines.map((line) => (line.lineId === lineId ? { ...line, packedPackages: packages } : line))),
    ).kind === 'ok';

  if (!fits(0)) return null;

  let low = 0;
  let high = 1;
  while (fits(high)) {
    if (high >= Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
    low = high;
    high = Math.min(high * 2, Number.MAX_SAFE_INTEGER);
  }
  while (high - low > 1) {
    const middle = low + Math.floor((high - low) / 2);
    if (fits(middle)) low = middle;
    else high = middle;
  }
  return low;
}
