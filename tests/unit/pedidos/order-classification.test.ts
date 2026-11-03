import { describe, expect, it } from 'vitest'

import {
  ORDER_STATUS_FLOW,
  ORDER_STATUS_VALUES,
  ORDER_STATUSES_NOT_IN_PROGRESS,
  type OrderStatus,
} from '@/lib/modules/pedidos'
import { isCancellableStatus } from '@/lib/modules/pedidos/domain/order-cancellation'
import { isAllowedTransition } from '@/lib/modules/pedidos/domain/order-transitions'

describe('el estado PARCIAL del pedido', () => {
  it('R52: PARCIAL es el primero de la lista que se publica para filtros y columnas', () => {
    expect(ORDER_STATUS_FLOW[0]).toBe('PARCIAL')
    expect(ORDER_STATUS_FLOW.indexOf('PARCIAL')).toBeLessThan(ORDER_STATUS_FLOW.indexOf('PENDIENTE'))
  })

  it('R52: PARCIAL va delante de PENDIENTE en el orden del enum, que es el de la base', () => {
    expect(ORDER_STATUS_VALUES[0]).toBe('PARCIAL')
    expect(ORDER_STATUS_VALUES[1]).toBe('PENDIENTE')
  })

  it('R50: PARCIAL no esta entre los estados que dejan de estar en curso', () => {
    expect((ORDER_STATUSES_NOT_IN_PROGRESS as readonly OrderStatus[]).includes('PARCIAL')).toBe(false)
    expect([...ORDER_STATUSES_NOT_IN_PROGRESS]).toEqual(['ENTREGADO', 'CANCELADO'])
  })

  it('R48: PARCIAL no es origen ni destino de ninguna transicion ni se cancela como estado', () => {
    for (const other of ORDER_STATUS_VALUES) {
      expect(isAllowedTransition('PARCIAL', other)).toBe(false)
      expect(isAllowedTransition(other, 'PARCIAL')).toBe(false)
    }
    expect(isCancellableStatus('PARCIAL')).toBe(false)
  })
})
