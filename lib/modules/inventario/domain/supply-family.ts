import {
  convertQuantity,
  unitFamilyId,
  type UnitConversion,
  type UnitId,
} from '@/lib/modules/unidades';

import { compareDecimals } from './decimal-quantity';
import { isStoredDecimal } from './product-input';
import type { ProductType } from './product-type';

export type SupplyHomonym = {
  readonly id: string;
  readonly name: string;
  readonly type: ProductType;
  readonly unitId: UnitId;
  readonly stock: string;
};

export type SupplyTarget = {
  readonly target: SupplyHomonym;
  /** Los homónimos de la familia, en el orden recibido (antigüedad). */
  readonly family: readonly SupplyHomonym[];
};

/** `candidates` llega ordenado por antigüedad. `units` trae la unidad del alta y las de los
 *  candidatos; un candidato cuya unidad no está ahí no es visible y no cuenta. */
export function pickSupplyTarget(
  unitId: UnitId,
  candidates: readonly SupplyHomonym[],
  units: readonly UnitConversion[],
): SupplyTarget | null {
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const entry = byId.get(unitId);
  if (entry === undefined) return null;

  const familyId = unitFamilyId(entry);
  // La derivación es de un solo nivel (QC-38 R15, R16: una base no deriva de otra), así que la
  // base es `{ id: familyId }` sin factor y no hace falta que venga en `units`; `convertQuantity`
  // (QC-76) solo mira `baseUnitId ?? id` y el factor de cada lado.
  const base: UnitConversion = { id: familyId, baseUnitId: null, factor: null };

  const members: { readonly homonym: SupplyHomonym; readonly stockInBase: string }[] = [];
  for (const candidate of candidates) {
    const unit = byId.get(candidate.unitId);
    if (unit === undefined || unitFamilyId(unit) !== familyId) continue;
    members.push({ homonym: candidate, stockInBase: convertQuantity(candidate.stock, unit, base) });
  }

  const [first, ...rest] = members;
  if (first === undefined) return null;

  let best = first;
  for (const member of rest) {
    if (compareDecimals(member.stockInBase, best.stockInBase) > 0) best = member;
  }
  return { target: best.homonym, family: members.map((member) => member.homonym) };
}

export type ConvertedSupplyBatch =
  | { readonly kind: 'ok'; readonly stock: string; readonly unitCost: string | null }
  | { readonly kind: 'stock_out_of_range'; readonly stock: string }
  | { readonly kind: 'cost_out_of_range'; readonly stock: string; readonly unitCost: string };

/** Convierte existencia y, si viene, costo unitario de `from` a `to` (misma familia). No
 *  redondea: lo que no cabe en `decimal(14,4)` se devuelve como fuera de rango. */
export function convertSupplyBatch(
  batch: { readonly stock: string; readonly unitCost: string | null },
  from: UnitConversion,
  to: UnitConversion,
): ConvertedSupplyBatch {
  if (from.id === to.id) {
    return { kind: 'ok', stock: batch.stock, unitCost: batch.unitCost };
  }

  const stock = convertQuantity(batch.stock, from, to);
  if (!isStoredDecimal(stock)) return { kind: 'stock_out_of_range', stock };
  if (batch.unitCost === null) return { kind: 'ok', stock, unitCost: null };

  // Un precio por unidad se convierte al revés que la cantidad.
  const unitCost = convertQuantity(batch.unitCost, to, from);
  if (!isStoredDecimal(unitCost)) return { kind: 'cost_out_of_range', stock, unitCost };
  return { kind: 'ok', stock, unitCost };
}
