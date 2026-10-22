import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { ConsumedLot } from '@/lib/modules/inventario'
import { calculateActualOrderCost } from '@/lib/modules/pedidos/domain/actual-order-cost'

function lot(batchId: string, quantity: string, unitCost: string | null): ConsumedLot {
  return { batchId, quantity, unitCost }
}

describe('calculateActualOrderCost', () => {
  it('R1: pondera por cantidad: 8 x 10 + 2 x 20 = 120.0000, no el promedio simple 150.0000', () => {
    const cost = calculateActualOrderCost([lot('1A', '8.0000', '10.0000'), lot('1B', '2.0000', '20.0000')])
    expect(cost).toBe('120.0000')
    expect(cost).not.toBe('150.0000')
  })

  it('R2: suma todos los lotes que recibe, ingredientes y envases por igual', () => {
    const cost = calculateActualOrderCost([
      lot('ingrediente-1A', '8.0000', '10.0000'),
      lot('ingrediente-1B', '2.0000', '20.0000'),
      lot('envase', '12.0000', '0.2500'),
    ])
    expect(cost).toBe('123.0000')
  })

  it('R7: sin lotes consumidos no hay coste real (null, nunca 0)', () => {
    expect(calculateActualOrderCost([])).toBeNull()
  })

  it('R7: un lote sin coste unitario deja el pedido sin coste real, aunque los demas lo tengan', () => {
    expect(calculateActualOrderCost([lot('1A', '8.0000', '10.0000'), lot('1B', '2.0000', null)])).toBeNull()
    expect(calculateActualOrderCost([lot('1B', '2.0000', null), lot('1A', '8.0000', '10.0000')])).toBeNull()
  })

  it('R7: una suma que no cabe en Decimal(14,4) da null', () => {
    expect(calculateActualOrderCost([lot('1A', '9999999999.9999', '1.0000')])).toBe('9999999999.9999')
    expect(calculateActualOrderCost([lot('1A', '9999999999.9999', '1.0000'), lot('1B', '0.0001', '1.0000')])).toBeNull()
    expect(calculateActualOrderCost([lot('1A', '100000.0000', '100000.0000')])).toBeNull()
  })

  it('R7: el tope se mide tras redondear: lo que redondea por encima del maximo da null', () => {
    expect(calculateActualOrderCost([lot('1A', '9999999999.99995', '1.0000')])).toBeNull()
    expect(calculateActualOrderCost([lot('1A', '9999999999.99994', '1.0000')])).toBe('9999999999.9999')
  })

  it('R1: redondea una sola vez al final, no lote a lote', () => {
    // Cada lote vale 0.00005: redondeado por separado daria 0.0001 + 0.0001 = 0.0002.
    expect(calculateActualOrderCost([lot('1A', '0.5000', '0.0001'), lot('1B', '0.5000', '0.0001')])).toBe('0.0001')
    // Cada lote vale 0.00009999: redondeado por separado daria 0.0003.
    expect(
      calculateActualOrderCost([
        lot('1A', '0.3333', '0.0003'),
        lot('1B', '0.3333', '0.0003'),
        lot('1C', '0.3333', '0.0003'),
      ]),
    ).toBe('0.0003')
  })

  it('R1: el redondeo es mitad arriba', () => {
    expect(calculateActualOrderCost([lot('1A', '0.5000', '0.0001')])).toBe('0.0001')
    expect(calculateActualOrderCost([lot('1A', '0.4999', '0.0001')])).toBe('0.0000')
    expect(calculateActualOrderCost([lot('1A', '1.2345', '1.5000')])).toBe('1.8518')
  })

  it('R23: la salida es siempre una cadena con 4 decimales', () => {
    expect(calculateActualOrderCost([lot('1A', '3', '7')])).toBe('21.0000')
    expect(calculateActualOrderCost([lot('1A', '0.0000', '7.0000')])).toBe('0.0000')
    expect(calculateActualOrderCost([lot('1A', '12752', '1.00000432')])).toBe('12752.0551')
    const cost = calculateActualOrderCost([lot('1A', '2.5000', '4.1000')])
    expect(cost).toMatch(/^\d+\.\d{4}$/)
    expect(typeof cost).toBe('string')
  })

  it('R23: el calculo no pasa por coma flotante: ni number ni parseFloat en el archivo', () => {
    const source = readFileSync(join(process.cwd(), 'lib/modules/pedidos/domain/actual-order-cost.ts'), 'utf8')
    expect(source).not.toMatch(/\bnumber\b/)
    expect(source).not.toMatch(/\bparseFloat\b|\bNumber\(|\bparseInt\b|toFixed/)
  })

  it('lanza ante una cadena que no es decimal sin signo: es un flujo roto, no un caso de negocio', () => {
    expect(() => calculateActualOrderCost([lot('1A', '-1.0000', '10.0000')])).toThrow()
    expect(() => calculateActualOrderCost([lot('1A', '1.0000', 'abc')])).toThrow()
  })
})
