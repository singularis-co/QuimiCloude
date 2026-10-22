// Dominio PURO del conteo real de envases al terminar el empaque. Lo usan el servidor y el
// dialogo del cliente, para que la regla no pueda divergir entre los dos.

import { MOVEMENT_REASONS, STOCK_INCREASE_REASONS } from '@/lib/modules/inventario';
import type { UnitConversion } from '@/lib/modules/unidades';

import {
  compareDecimals,
  sumInOrderUnit,
  validateDistribution,
  type SumInOrderUnitResult,
} from './order-distribution';

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

/** Los envases reales de la linea, para acondicionar y consultar: sin conteo guardado, el plan. */
export function effectivePackages(line: { readonly packages: number; readonly packedPackages: number | null }): number {
  return line.packedPackages ?? line.packages;
}

/** Los libres siguen en la existencia del lote, pero el pedido no los espera al entregar. */
export function orderedPackages(line: {
  readonly packages: number;
  readonly packedPackages: number | null;
  readonly packedSurplusPackages: number;
}): number {
  return effectivePackages(line) - line.packedSurplusPackages;
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

export type SurplusLine = PackedDistributionLine & { readonly plan: number };

export type PackingSurplus =
  | {
      readonly kind: 'ok';
      /** Envasado menos la cantidad, en la unidad del pedido; `'0'` si no la supera. */
      readonly excess: string;
      /** Envases libres por `lineId`: estan todas las lineas, con 0 si no dejan libres. */
      readonly byLine: ReadonlyMap<string, number>;
    }
  | { readonly kind: 'presentation_without_content'; readonly presentationId: string }
  | { readonly kind: 'incompatible_units'; readonly presentationId: string };

function onePackageContent(orderUnit: UnitConversion, line: PackedDistributionLine): SumInOrderUnitResult {
  return sumInOrderUnit(orderUnit, toDistributionLines([{ ...line, packedPackages: 1 }]));
}

export type LargestPackageFirst<T> =
  | { readonly kind: 'ok'; readonly lines: readonly T[] }
  | { readonly kind: 'presentation_without_content'; readonly presentationId: string }
  | { readonly kind: 'incompatible_units'; readonly presentationId: string };

/**
 * `lines` de mayor a menor contenido por envase en la unidad del pedido y, a igual contenido, en
 * su orden. Es el orden en que se reparte el excedente; quien lo muestre lo reutiliza para no
 * contar los libres en un orden distinto del que los fijo.
 */
export function largestPackageFirst<T extends PackedDistributionLine>(
  orderUnit: UnitConversion,
  lines: readonly T[],
): LargestPackageFirst<T> {
  const withContent: { readonly line: T; readonly content: string }[] = [];
  for (const line of lines) {
    const content = onePackageContent(orderUnit, line);
    if (content.kind !== 'ok') return content;
    withContent.push({ line, content: content.total });
  }
  // `sort` es estable: a igual contenido se conserva el orden de `lines`.
  withContent.sort((a, b) => compareDecimals(b.content, a.content));
  return { kind: 'ok', lines: withContent.map(({ line }) => line) };
}

/** El mayor numero de envases sobre el plan de `line` que cabe en `remaining`, y lo que sobra. */
function largestFitting(
  remaining: string,
  orderUnit: UnitConversion,
  line: SurplusLine,
): { readonly packages: number; readonly available: string } {
  let low = 0;
  let available = remaining;
  let high = line.packedPackages - line.plan + 1;
  while (high - low > 1) {
    const middle = low + Math.floor((high - low) / 2);
    const result = validateDistribution(
      remaining,
      orderUnit,
      toDistributionLines([{ ...line, packedPackages: middle }]),
    );
    if (result.kind === 'ok') {
      low = middle;
      available = result.available;
    } else {
      high = middle;
    }
  }
  return { packages: low, available };
}

/**
 * Que envases reales no espera el pedido. Solo salen de lineas por encima de su plan, en envases
 * enteros y sin pasar del excedente; se reparten primero a la de mayor contenido por envase y, a
 * igual contenido, en el orden de `lines`. Lo que no llega a un envase entero sigue en el pedido.
 */
export function packingSurplusByLine(
  quantity: string,
  orderUnit: UnitConversion,
  lines: readonly SurplusLine[],
): PackingSurplus {
  const checked = validateDistribution(quantity, orderUnit, toDistributionLines(lines));
  if (checked.kind === 'presentation_without_content' || checked.kind === 'incompatible_units') return checked;

  const byLine = new Map<string, number>(lines.map((line) => [line.lineId, 0]));
  if (checked.kind !== 'exceeds_quantity') return { kind: 'ok', excess: '0', byLine };

  // `validateDistribution` da el disponible en negativo cuando se supera la cantidad.
  const excess = checked.available.slice(1);

  const candidates = largestPackageFirst(
    orderUnit,
    lines.filter((line) => line.packedPackages > line.plan),
  );
  if (candidates.kind !== 'ok') return candidates;

  let remaining = excess;
  for (const line of candidates.lines) {
    const fitted = largestFitting(remaining, orderUnit, line);
    byLine.set(line.lineId, fitted.packages);
    remaining = fitted.available;
  }
  return { kind: 'ok', excess, byLine };
}
