'use client';

import { Notice } from '@/components/shared/notice';
import {
  convertSupplyBatch,
  isStoredDecimal,
  pickSupplyTarget,
  type SupplyHomonym,
} from '@/lib/modules/inventario';
import { convertQuantity, type UnitRef } from '@/lib/modules/unidades';
import { trimDecimal } from '@/lib/shared/ui/decimal-display';

export const SUPPLY_CONVERSION_NOTICE_TESTID = 'supply-conversion-notice';
export const SUPPLY_CONVERSION_STOCK_LINE_TESTID = 'supply-conversion-notice-stock';
export const SUPPLY_CONVERSION_COST_LINE_TESTID = 'supply-conversion-notice-cost';

/** Coma decimal y sin ceros sobrantes, como el resto del formulario. */
export function displayDecimal(value: string): string {
  return trimDecimal(value).replace('.', ',');
}

export function unitDisplayLabel(unit: UnitRef): string {
  return unit.symbol ?? unit.name;
}

export type SupplyDestination = {
  readonly target: SupplyHomonym;
  /** Unidad del alta. */
  readonly from: UnitRef;
  /** Unidad del destino. */
  readonly to: UnitRef;
  readonly family: readonly { readonly homonym: SupplyHomonym; readonly unit: UnitRef }[];
};

/** El mismo destino que elegirá el servidor, o `null` si el alta crea un producto nuevo. */
export function resolveSupplyDestination(
  unitId: string,
  homonyms: readonly SupplyHomonym[],
  units: readonly UnitRef[],
): SupplyDestination | null {
  if (unitId === '' || homonyms.length === 0) return null;
  const picked = pickSupplyTarget(unitId, homonyms, units);
  if (picked === null) return null;

  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const from = byId.get(unitId);
  const to = byId.get(picked.target.unitId);
  if (from === undefined || to === undefined) return null;

  const family = picked.family.flatMap((homonym) => {
    const unit = byId.get(homonym.unitId);
    return unit === undefined ? [] : [{ homonym, unit }];
  });
  return { target: picked.target, from, to, family };
}

export function convertsUnit(destination: SupplyDestination): boolean {
  return destination.from.id !== destination.to.id;
}

/** Ayuda bajo «Unidad»: solo cuando el lote se convierte. */
export function supplyUnitHint(destination: SupplyDestination | null): string | undefined {
  if (destination === null || !convertsUnit(destination)) return undefined;
  return `Misma familia que ${unitDisplayLabel(destination.to)}: se convierte al guardar.`;
}

export type SupplyBatchFieldError = {
  readonly field: 'stock' | 'unitCost';
  readonly message: string;
};

/** Lo que el servidor rechazaría por no caber tras convertir, dicho en el campo que lo resuelve. */
export function checkConvertedSupplyBatch(
  destination: SupplyDestination,
  stock: string,
  unitCost: string | null,
): SupplyBatchFieldError | null {
  if (!convertsUnit(destination)) return null;
  const ua = unitDisplayLabel(destination.from);
  const ud = unitDisplayLabel(destination.to);
  const converted = convertSupplyBatch({ stock, unitCost }, destination.from, destination.to);

  if (converted.kind === 'stock_out_of_range') {
    return {
      field: 'stock',
      message: `${displayDecimal(stock)} ${ua} son ${displayDecimal(converted.stock)} ${ud} y no caben en 4 decimales. Ingresa la existencia en ${ud}.`,
    };
  }
  if (converted.kind === 'cost_out_of_range') {
    return {
      field: 'unitCost',
      message: `El costo por ${ud} quedaría en ${displayDecimal(converted.unitCost)} y no cabe en 4 decimales. Ingresa el lote en ${ud}.`,
    };
  }
  return null;
}

/** «en A (…) y en B (…)», o «en A (…), en B (…) y en C (…)». */
function joinFamily(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

type SupplyConversionNoticeProps = {
  readonly destination: SupplyDestination | null;
  /** Existencia del alta tal cual está en el campo. */
  readonly stock: string;
  /** Costo unitario del alta tal cual está en el campo. */
  readonly unitCost: string;
};

/** Aviso antes de guardar: a qué producto va el lote y cómo queda convertido. */
export function SupplyConversionNotice({ destination, stock, unitCost }: SupplyConversionNoticeProps) {
  if (destination === null || !isStoredDecimal(stock)) return null;

  const converts = convertsUnit(destination);
  const several = destination.family.length > 1;
  if (!converts && !several) return null;

  const name = destination.target.name;
  const ua = unitDisplayLabel(destination.from);
  const ud = unitDisplayLabel(destination.to);

  const title = several
    ? `Ya existen ${name} ${joinFamily(
        destination.family.map(({ homonym, unit }) => {
          const label = unitDisplayLabel(unit);
          return `en ${label} (${displayDecimal(homonym.stock)} ${label})`;
        }),
      )}`
    : `Ya existe ${name} en ${ud}`;

  let body: string;
  if (!several) body = `El lote se agregará a ese producto, convertido a ${ud}:`;
  else if (converts) body = `El lote va a la que tiene más existencia, ${name} · ${ud}, convertido:`;
  else body = `El lote va a la que tiene más existencia, ${name} · ${ud}.`;

  const cost = unitCost.trim();
  const hasCost = isStoredDecimal(cost);
  const converted = converts
    ? convertSupplyBatch(
        { stock, unitCost: hasCost ? cost : null },
        destination.from,
        destination.to,
      )
    : null;
  let convertedCost: string | null = null;
  if (converted !== null && hasCost) {
    // Con la existencia fuera de rango, `convertSupplyBatch` no llega a convertir el costo.
    convertedCost =
      converted.kind === 'stock_out_of_range'
        ? convertQuantity(cost, destination.to, destination.from)
        : converted.unitCost;
  }

  return (
    <Notice tone="info" title={title} testId={SUPPLY_CONVERSION_NOTICE_TESTID}>
      <p>{body}</p>
      {converted === null ? null : (
        <span className="block font-mono" data-testid={SUPPLY_CONVERSION_STOCK_LINE_TESTID}>
          {`${displayDecimal(stock)} ${ua} = ${displayDecimal(converted.stock)} ${ud}`}
        </span>
      )}
      {convertedCost === null ? null : (
        <span className="block font-mono" data-testid={SUPPLY_CONVERSION_COST_LINE_TESTID}>
          {`${displayDecimal(cost)} por ${ua} = ${displayDecimal(convertedCost)} por ${ud}`}
        </span>
      )}
    </Notice>
  );
}
