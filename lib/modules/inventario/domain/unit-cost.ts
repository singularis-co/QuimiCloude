/**
 * Derivacion del costo unitario a partir del costo total, y costo unitario medio ponderado de
 * los lotes de un producto (columna «Costo» del listado de inventario).
 *
 * Las dos comparten escala y redondeo, por eso viven juntas: el resto de los
 * importes viajan como cadena decimal y la aritmetica la hace Postgres. Por eso se hace con
 * `BigInt` -del lenguaje- y no con una utilidad casera de decimales ni con una dependencia
 * nueva: `design.md > 5` evaluo la libreria de decimales y la descarto con argumento, y
 * `package.json` no cambia en QC-90.
 *
 * Ni el importe ni la existencia se convierten a binario de coma flotante en ningun punto
 * (`docs/architecture.md > Anti-patrones`): los dos entran como cadena, se escalan a
 * entero exacto y el resultado sale como cadena.
 */

/** Decimales de `decimal(14,4)`: la escala con la que se guarda `product_batches.unit_cost`. */
const SCALE = 4;

/**
 * Las constantes enteras se construyen con `BigInt(...)` y NO con literales `0n`/`10n`: el
 * `target` del repo es `ES2017` y `tsc` rechaza el literal (TS2791). Cambiar el `target` por
 * este archivo seria una decision del repo entero, no de esta ficha.
 */
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);

/** 10^SCALE como `BigInt`, el factor con el que un importe pasa a entero exacto. */
const SCALE_FACTOR = BigInt('1' + '0'.repeat(SCALE));

/** La forma exacta que `product-batch-input.ts` ya acepta: hasta 10 enteros y 4 decimales. */
const DECIMAL_PATTERN = /^\d{1,10}(\.\d{1,4})?$/;

/**
 * Cadena decimal -> entero escalado a 4 decimales. `'12.5'` -> `125000n`.
 *
 * Devuelve `null` en vez de lanzar cuando la cadena no tiene la forma acordada: quien llama
 * a esta funcion es el `superRefine` del esquema, y ahi una excepcion se veria como un fallo
 * del servidor en lugar de como el `invalid_input` que R4 exige.
 */
function toScaledInteger(amount: string): bigint | null {
  if (!DECIMAL_PATTERN.test(amount)) return null;
  const [whole, fraction = ''] = amount.split('.');
  return BigInt(whole + fraction.padEnd(SCALE, '0'));
}

/** Entero escalado -> cadena `'d.dddd'`, siempre con sus cuatro decimales. */
function fromScaledInteger(scaled: bigint): string {
  const whole = scaled / SCALE_FACTOR;
  const fraction = scaled % SCALE_FACTOR;
  return `${whole}.${fraction.toString().padStart(SCALE, '0')}`;
}

/**
 * Division entera con redondeo MITAD ARRIBA. Los dos operandos son positivos, asi que
 * «mitad arriba» y «mitad lejos del cero» coinciden y no hace falta distinguirlos.
 *
 * El resto se compara duplicado (`rest * 2n >= divisor`) en vez de dividir por dos: sobre
 * enteros, dividir el divisor perderia el medio cuando es impar.
 */
function divideRoundingHalfUp(dividend: bigint, divisor: bigint): bigint {
  const quotient = dividend / divisor;
  const rest = dividend % divisor;
  return rest * TWO >= divisor ? quotient + ONE : quotient;
}

/**
 * Costo unitario = costo total / existencia decimal, redondeado a 4 decimales mitad arriba.
 * El cociente se escala UNA vez de mas -`total x 10^4 / existencia`- para que el
 * resultado quede en la misma escala que `fromScaledInteger` espera, sin pasar por division
 * de coma flotante.
 *
 * Devuelve `null` cuando la division NO da un costo guardable:
 *  - el resultado redondea a `0.0000` (R9): la columna tiene `CHECK (unit_cost > 0)` y el
 *    esquema convierte ese `null` en un rechazo colgado del campo del costo total;
 *  - la existencia es cero o no tiene la forma de `decimal(14,4)`;
 *  - el importe no tiene la forma de `decimal(14,4)` (R4, ya rechazado por el patron).
 */
export function deriveUnitCost(totalCost: string, stock: string): string | null {
  const scaledStock = toScaledInteger(stock);
  if (scaledStock === null || scaledStock === ZERO) return null;

  const scaledTotal = toScaledInteger(totalCost);
  if (scaledTotal === null) return null;

  const scaledUnitCost = divideRoundingHalfUp(scaledTotal * SCALE_FACTOR, scaledStock);
  if (scaledUnitCost === ZERO) return null;

  return fromScaledInteger(scaledUnitCost);
}

/** Lo minimo de un lote para ponderar su costo: existencia y costo unitario, como cadena decimal. */
export type CostedBatchQuantity = {
  readonly stock: string;
  readonly unitCost: string | null;
};

function toScaledIntegerOrThrow(amount: string): bigint {
  const scaled = toScaledInteger(amount);
  if (scaled === null) {
    throw new Error(`unit-cost: no es un decimal(14,4) valido: ${JSON.stringify(amount)}`);
  }
  return scaled;
}

/**
 * Costo unitario medio ponderado: `suma(unitCost x stock) / suma(stock)`, redondeado a 4
 * decimales mitad arriba.
 *
 * Solo pondera los lotes con existencia mayor que cero Y con costo: un lote agotado no tiene
 * peso y uno sin costo no se puede contar como costo cero. Sin ningun lote que cumpla las dos,
 * devuelve `null`.
 *
 * El numerador se acumula exacto a 8 decimales (4 + 4) y la division por la existencia, a 4,
 * deja el cociente en la escala de la columna. Una cadena que no tenga la forma de
 * `decimal(14,4)` lanza: en un agregado, saltarse un lote en silencio daria una media falsa.
 */
export function weightedAverageUnitCost(batches: readonly CostedBatchQuantity[]): string | null {
  let weightedCost = ZERO;
  let totalStock = ZERO;

  for (const batch of batches) {
    if (batch.unitCost === null) continue;
    const stock = toScaledIntegerOrThrow(batch.stock);
    if (stock === ZERO) continue;
    weightedCost += toScaledIntegerOrThrow(batch.unitCost) * stock;
    totalStock += stock;
  }

  if (totalStock === ZERO) return null;
  return fromScaledInteger(divideRoundingHalfUp(weightedCost, totalStock));
}
