// QT-313 T3 — El estado del pedido sale de sus lineas vivas.

import { describe, expect, it } from 'vitest'

import { ORDER_STATUS_VALUES, type OrderLineStatus } from '@/lib/modules/pedidos/domain/order-classification'
import { deriveOrderStatus } from '@/lib/modules/pedidos/domain/order-status-derivation'

const LINE_STATUSES = ORDER_STATUS_VALUES.filter((status): status is OrderLineStatus => status !== 'PARCIAL')

function lineas(...statuses: OrderLineStatus[]) {
  return statuses.map((status) => ({ status }))
}

describe('deriveOrderStatus', () => {
  it('R34: con una sola linea el pedido tiene el estado de la linea', () => {
    for (const status of LINE_STATUSES) {
      expect(deriveOrderStatus(lineas(status))).toBe(status)
    }
  })

  it('R34: dos lineas activas en el mismo estado dan ese estado, BLOQUEADO incluido', () => {
    for (const status of LINE_STATUSES.filter((s) => s !== 'CANCELADO')) {
      expect(deriveOrderStatus(lineas(status, status))).toBe(status)
    }
  })

  it('R34: cada par de estados activos distintos da PARCIAL', () => {
    const activos = LINE_STATUSES.filter((s) => s !== 'CANCELADO')
    for (const a of activos) {
      for (const b of activos) {
        if (a === b) continue
        expect(deriveOrderStatus(lineas(a, b)), `${a} + ${b}`).toBe('PARCIAL')
      }
    }
  })

  it('R34: TERMINADO + ENTREGADO es PARCIAL', () => {
    expect(deriveOrderStatus(lineas('TERMINADO', 'ENTREGADO'))).toBe('PARCIAL')
  })

  it('R34: PENDIENTE + BLOQUEADO es PARCIAL', () => {
    expect(deriveOrderStatus(lineas('PENDIENTE', 'BLOQUEADO'))).toBe('PARCIAL')
  })

  it('R34: las canceladas no cuentan si queda alguna activa', () => {
    expect(deriveOrderStatus(lineas('CANCELADO', 'EN_CURSO'))).toBe('EN_CURSO')
    expect(deriveOrderStatus(lineas('PENDIENTE', 'CANCELADO', 'PENDIENTE'))).toBe('PENDIENTE')
    expect(deriveOrderStatus(lineas('CANCELADO', 'TERMINADO', 'ENTREGADO'))).toBe('PARCIAL')
  })

  it('R34: todas canceladas da CANCELADO', () => {
    expect(deriveOrderStatus(lineas('CANCELADO'))).toBe('CANCELADO')
    expect(deriveOrderStatus(lineas('CANCELADO', 'CANCELADO', 'CANCELADO'))).toBe('CANCELADO')
  })

  it('R34: sin lineas vivas no hay estado que derivar y lo dice', () => {
    expect(() => deriveOrderStatus([])).toThrow(/al menos una linea viva/)
  })
})
