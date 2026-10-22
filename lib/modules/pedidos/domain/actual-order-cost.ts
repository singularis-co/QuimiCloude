// lib/modules/pedidos/domain/actual-order-cost.ts
//
// Dominio puro: recibe los lotes que el pedido consumio, ya leidos por quien orquesta, y devuelve
// el coste real como cadena decimal. Toda la aritmetica va en `BigInt`, sin coma flotante.

import type { ConsumedLot } from '@/lib/modules/inventario'

const OUTPUT_DIGITS = 4
const OUTPUT_SCALE = BigInt(OUTPUT_DIGITS)
const ZERO = BigInt(0)
const ONE = BigInt(1)
const TWO = BigInt(2)
const TEN = BigInt(10)

/** Diez digitos enteros y cuatro decimales: lo que cabe en `Decimal(14,4)`. */
const MAX_OUTPUT_UNSCALED = TEN ** BigInt(14) - ONE

const UNSIGNED_DECIMAL = /^\d+(?:\.\d+)?$/

type Scaled = { readonly unscaled: bigint; readonly scale: bigint }

/** Quien llama pasa cadenas que salen de columnas decimales: otra forma es un flujo roto. */
function parseUnsigned(raw: string): Scaled {
  if (!UNSIGNED_DECIMAL.test(raw)) {
    throw new Error(`calculateActualOrderCost: no es un decimal valido: ${JSON.stringify(raw)}`)
  }
  const [whole = '', fraction = ''] = raw.split('.')
  return { unscaled: BigInt(`${whole}${fraction}`), scale: BigInt(fraction.length) }
}

function rescale(value: Scaled, scale: bigint): bigint {
  return value.unscaled * TEN ** (scale - value.scale)
}

function formatFixedOutputScale(unscaled: bigint): string {
  const factor = TEN ** OUTPUT_SCALE
  const fraction = (unscaled % factor).toString().padStart(OUTPUT_DIGITS, '0')
  return `${(unscaled / factor).toString()}.${fraction}`
}

/** Suma ponderada exacta de los lotes consumidos, redondeada una sola vez a 4 decimales, mitad
 *  arriba. `null` si no hay lotes, si alguno no tiene coste o si no cabe en `Decimal(14,4)`. */
export function calculateActualOrderCost(lots: readonly ConsumedLot[]): string | null {
  if (lots.length === 0) return null

  const products: Scaled[] = []
  for (const lot of lots) {
    if (lot.unitCost === null) return null
    const quantity = parseUnsigned(lot.quantity)
    const unitCost = parseUnsigned(lot.unitCost)
    products.push({ unscaled: quantity.unscaled * unitCost.unscaled, scale: quantity.scale + unitCost.scale })
  }

  const scale = products.reduce((max, product) => (product.scale > max ? product.scale : max), OUTPUT_SCALE)
  const exact = products.reduce((sum, product) => sum + rescale(product, scale), ZERO)

  const divisor = TEN ** (scale - OUTPUT_SCALE)
  const rounded = (exact + divisor / TWO) / divisor
  if (rounded > MAX_OUTPUT_UNSCALED) return null

  return formatFixedOutputScale(rounded)
}
