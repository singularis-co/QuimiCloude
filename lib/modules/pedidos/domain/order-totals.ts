import type { OrderLineStatus } from './order-classification';

const OUTPUT_DIGITS = 4;
const TEN = BigInt(10);
const SCALE_FACTOR = TEN ** BigInt(OUTPUT_DIGITS);

const DECIMAL_4 = /^\d+(?:\.\d{1,4})?$/;

/** Las cadenas salen de columnas `Decimal(14,4)`: otra forma es un flujo roto, no una entrada. */
function toUnscaled(raw: string): bigint {
  if (!DECIMAL_4.test(raw)) {
    throw new Error(`sumDecimal4: no es un decimal de hasta 4 decimales: ${JSON.stringify(raw)}`);
  }
  const [whole = '', fraction = ''] = raw.split('.');
  return BigInt(`${whole}${fraction.padEnd(OUTPUT_DIGITS, '0')}`);
}

/** Suma exacta en `BigInt`. Sin tope: el total no se guarda, asi que no lo limita ninguna columna. */
export function sumDecimal4(values: readonly string[]): string {
  const total = values.reduce((sum, value) => sum + toUnscaled(value), BigInt(0));
  const fraction = (total % SCALE_FACTOR).toString().padStart(OUTPUT_DIGITS, '0');
  return `${(total / SCALE_FACTOR).toString()}.${fraction}`;
}

export type OrderLineAmounts = {
  readonly status: OrderLineStatus;
  readonly salePrice: string | null;
  readonly ingredientsCost: string | null;
  readonly actualCost: string | null;
};

export type OrderProgress = { readonly total: number; readonly finished: number };

export type OrderTotals = {
  readonly progress: OrderProgress;
  readonly salePriceTotal: string | null;
  readonly linesWithoutPrice: number;
  readonly ingredientsCostTotal: string | null;
  readonly actualCostTotal: string | null;
};

const FINISHED_LINE_STATUSES: readonly OrderLineStatus[] = ['TERMINADO', 'ENTREGADO'];

function activeLines<T extends { readonly status: OrderLineStatus }>(lines: readonly T[]): readonly T[] {
  return lines.filter((line) => line.status !== 'CANCELADO');
}

export function orderProgress(lines: readonly { readonly status: OrderLineStatus }[]): OrderProgress {
  const active = activeLines(lines);
  return {
    total: active.length,
    finished: active.filter((line) => FINISHED_LINE_STATUSES.includes(line.status)).length,
  };
}

/** Las lineas sin precio no impiden el total: se suman las que lo tienen y se cuentan las demas. */
export function orderSalePriceTotal(
  lines: readonly Pick<OrderLineAmounts, 'status' | 'salePrice'>[],
): { readonly salePriceTotal: string | null; readonly linesWithoutPrice: number } {
  const active = activeLines(lines);
  const prices = active.flatMap((line) => (line.salePrice === null ? [] : [line.salePrice]));
  return {
    salePriceTotal: prices.length === 0 ? null : sumDecimal4(prices),
    linesWithoutPrice: active.length - prices.length,
  };
}

/** Un coste es la suma de todas las lineas activas o no es: con un hueco, el total seria falso. */
function totalOrNull(values: readonly (string | null)[]): string | null {
  const present = values.filter((value): value is string => value !== null);
  return present.length === values.length ? sumDecimal4(present) : null;
}

export function orderTotals(lines: readonly OrderLineAmounts[]): OrderTotals {
  const active = activeLines(lines);
  return {
    progress: orderProgress(lines),
    ...orderSalePriceTotal(lines),
    ingredientsCostTotal: totalOrNull(active.map((line) => line.ingredientsCost)),
    actualCostTotal: totalOrNull(active.map((line) => line.actualCost)),
  };
}
