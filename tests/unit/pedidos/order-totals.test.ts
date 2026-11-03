// QT-313 T4 — Precio total, costes totales y avance del pedido, calculados al leer.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { OrderLineStatus } from '@/lib/modules/pedidos/domain/order-classification'
import {
  orderProgress,
  orderSalePriceTotal,
  orderTotals,
  sumDecimal4,
  type OrderLineAmounts,
} from '@/lib/modules/pedidos/domain/order-totals'

function linea(status: OrderLineStatus, overrides: Partial<OrderLineAmounts> = {}): OrderLineAmounts {
  return { status, salePrice: null, ingredientsCost: null, actualCost: null, ...overrides }
}

describe('sumDecimal4', () => {
  it('R16, R18: suma exacta con 4 decimales, sin perder centimos', () => {
    expect(sumDecimal4(['0.1', '0.2'])).toBe('0.3000')
    expect(sumDecimal4(['12.5', '0.0001', '3'])).toBe('15.5001')
  })

  it('R16, R18: sin sumandos es 0.0000 y el 0 suma como 0', () => {
    expect(sumDecimal4([])).toBe('0.0000')
    expect(sumDecimal4(['0', '0.0000'])).toBe('0.0000')
  })

  it('R16, R18: pasa de 10 digitos enteros sin truncar ni redondear', () => {
    expect(sumDecimal4(['9999999999.9999', '9999999999.9999'])).toBe('19999999999.9998')
    expect(sumDecimal4(['9999999999.9999', '0.0001'])).toBe('10000000000.0000')
  })

  it('R16, R18: una cadena que no es un decimal de 4 decimales es un flujo roto', () => {
    expect(() => sumDecimal4(['-1'])).toThrow()
    expect(() => sumDecimal4(['1.23456'])).toThrow()
    expect(() => sumDecimal4(['abc'])).toThrow()
  })

  it('R16, R18: el calculo no pasa por number', () => {
    const fuente = readFileSync(join(process.cwd(), 'lib/modules/pedidos/domain/order-totals.ts'), 'utf8')
    expect(fuente).not.toMatch(/\bNumber\(|parseFloat|parseInt|toFixed/)
  })
})

describe('orderSalePriceTotal', () => {
  it('R16: suma los precios de las lineas activas y cuenta las que no tienen', () => {
    const total = orderSalePriceTotal([
      linea('PENDIENTE', { salePrice: '100.5' }),
      linea('EN_CURSO'),
      linea('TERMINADO', { salePrice: '0' }),
    ])
    expect(total).toEqual({ salePriceTotal: '100.5000', linesWithoutPrice: 1 })
  })

  it('R16: las canceladas ni suman ni cuentan como sin precio', () => {
    const total = orderSalePriceTotal([
      linea('PENDIENTE', { salePrice: '10' }),
      linea('CANCELADO', { salePrice: '999' }),
      linea('CANCELADO'),
    ])
    expect(total).toEqual({ salePriceTotal: '10.0000', linesWithoutPrice: 0 })
  })

  it('R16: ninguna con precio es sin precio, no 0', () => {
    expect(orderSalePriceTotal([linea('PENDIENTE'), linea('BLOQUEADO')])).toEqual({
      salePriceTotal: null,
      linesWithoutPrice: 2,
    })
  })

  it('R16: un precio 0 es un precio', () => {
    expect(orderSalePriceTotal([linea('PENDIENTE', { salePrice: '0' })])).toEqual({
      salePriceTotal: '0.0000',
      linesWithoutPrice: 0,
    })
  })
})

describe('orderTotals', () => {
  it('R18: coste estimado y real son la suma de las lineas activas', () => {
    const totales = orderTotals([
      linea('TERMINADO', { ingredientsCost: '10.1234', actualCost: '11' }),
      linea('ENTREGADO', { ingredientsCost: '5', actualCost: '4.5' }),
    ])
    expect(totales.ingredientsCostTotal).toBe('15.1234')
    expect(totales.actualCostTotal).toBe('15.5000')
  })

  it('R18: una linea activa sin coste deja el total sin coste', () => {
    const totales = orderTotals([
      linea('EN_CURSO', { ingredientsCost: '10', actualCost: null }),
      linea('BLOQUEADO', { ingredientsCost: null, actualCost: null }),
    ])
    expect(totales.ingredientsCostTotal).toBeNull()
    expect(totales.actualCostTotal).toBeNull()
  })

  it('R18: las canceladas no suman y su hueco no anula el total', () => {
    const totales = orderTotals([
      linea('TERMINADO', { ingredientsCost: '7', actualCost: '8' }),
      linea('CANCELADO', { ingredientsCost: '100', actualCost: null }),
    ])
    expect(totales.ingredientsCostTotal).toBe('7.0000')
    expect(totales.actualCostTotal).toBe('8.0000')
  })

  it('R16, R18: todas canceladas: costes 0.0000 y precio null', () => {
    const totales = orderTotals([
      linea('CANCELADO', { salePrice: '50', ingredientsCost: '9', actualCost: '10' }),
      linea('CANCELADO'),
    ])
    expect(totales.ingredientsCostTotal).toBe('0.0000')
    expect(totales.actualCostTotal).toBe('0.0000')
    expect(totales.salePriceTotal).toBeNull()
    expect(totales.linesWithoutPrice).toBe(0)
  })

  it('R16, R18, R33: devuelve precio, costes y avance juntos', () => {
    expect(
      orderTotals([
        linea('TERMINADO', { salePrice: '20', ingredientsCost: '3', actualCost: '3.5' }),
        linea('PENDIENTE', { ingredientsCost: '2' }),
        linea('CANCELADO', { salePrice: '50', ingredientsCost: '9' }),
      ]),
    ).toEqual({
      progress: { total: 2, finished: 1 },
      salePriceTotal: '20.0000',
      linesWithoutPrice: 1,
      ingredientsCostTotal: '5.0000',
      actualCostTotal: null,
    })
  })
})

describe('orderProgress', () => {
  it('R33: TERMINADO y ENTREGADO cuentan como terminadas', () => {
    expect(orderProgress([linea('TERMINADO'), linea('ENTREGADO'), linea('EN_EMPAQUE')])).toEqual({
      total: 3,
      finished: 2,
    })
  })

  it('R33: las canceladas no cuentan ni en el total ni en las terminadas', () => {
    expect(orderProgress([linea('CANCELADO'), linea('PENDIENTE'), linea('CANCELADO')])).toEqual({
      total: 1,
      finished: 0,
    })
  })

  it('R33: todas canceladas es 0 de 0', () => {
    expect(orderProgress([linea('CANCELADO')])).toEqual({ total: 0, finished: 0 })
  })
})
