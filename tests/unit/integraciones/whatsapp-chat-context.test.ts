import { describe, expect, it } from 'vitest'

import {
  CUSTOMER_ORDER_STAGE,
  isOpenCustomerOrder,
} from '@/lib/modules/integraciones/domain/whatsapp-chat-context'
import type { CustomerOrderSummary } from '@/lib/modules/pedidos'

describe('el pedido PARCIAL en el texto del cliente', () => {
  it('R53: un pedido PARCIAL se lee «en preparación»', () => {
    expect(CUSTOMER_ORDER_STAGE.PARCIAL).toBe('en preparación')
  })

  it('R50: un pedido PARCIAL cuenta como abierto en el contexto de chat', () => {
    const summary = { status: 'PARCIAL' } as CustomerOrderSummary
    expect(isOpenCustomerOrder(summary)).toBe(true)
  })
})
