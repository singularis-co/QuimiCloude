// QT-313 T11 — Cancelar una linea, cancelar el pedido y darlo de baja, con varias recetas.
//
// Dobles de los puertos de la transaccion: lo que se afirma es que cada operacion escribe por
// linea, libera solo lo de las lineas que toca y deriva el estado del pedido, sin pasar por los
// metodos que escriben el estado del pedido (el doble explota si se les llama).

import { describe, expect, it, vi } from 'vitest'

import { createCancelOrder } from '@/lib/modules/pedidos/domain/cancel-order'
import { createCancelOrderLine } from '@/lib/modules/pedidos/domain/cancel-order-line'
import { createCancelAliveOrder } from '@/lib/modules/pedidos/domain/order-cancellation'
import { createDeleteOrder } from '@/lib/modules/pedidos/domain/delete-order'
import type { PedidosError } from '@/lib/modules/pedidos/domain/errors'

import { fakeOrderRow, fakeUnitOfWork, orderLineOf } from '@/tests/helpers/order-unit-of-work-double'

import type { Actor } from '@/lib/modules/pedidos/domain/actor'
import type { OrderLineStatus } from '@/lib/modules/pedidos/domain/order-classification'
import type { OrderLineRow, OrderRow } from '@/lib/modules/pedidos/domain/order-view'
import type { OrderRepository } from '@/lib/modules/pedidos/ports/order-repository'
import type { OrderUnitOfWork } from '@/lib/modules/pedidos/ports/order-unit-of-work'

const ADMIN: Actor = {
  id: 'admin-1',
  companyId: '33333333-3333-4333-8333-333333333333',
  permissions: ['pedidos.consultar', 'pedidos.modificar'],
}
const SIN_PERMISO: Actor = { id: 'u-1', companyId: ADMIN.companyId, permissions: ['pedidos.consultar'] }
const SCOPE = { companyId: ADMIN.companyId }
const AHORA = new Date('2026-11-04T12:00:00.000Z')
const PEDIDO = fakeOrderRow({ status: 'PARCIAL' })
const LINEA_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const LINEA_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function linea(id: string, position: number, status: OrderLineStatus): OrderLineRow {
  return orderLineOf(fakeOrderRow({ status: 'PENDIENTE' }), {
    id,
    position,
    status,
    cancellationReason: status === 'CANCELADO' ? 'motivo previo' : null,
  })
}

/** Dobles de un pedido con esas lineas; registra el orden de las escrituras en `orden`. */
function dobles(lineas: readonly OrderLineRow[], opciones: { pedido?: OrderRow | null } = {}) {
  const pedido = opciones.pedido === undefined ? PEDIDO : opciones.pedido
  const orden: string[] = []
  const anota =
    <T,>(nombre: string, valor: T) =>
    async (...args: unknown[]) => {
      orden.push(`${nombre}:${String(args[1] ?? '')}`)
      return valor
    }
  const { unitOfWork, orders, reservations } = fakeUnitOfWork({
    orders: {
      lockAliveLines: vi.fn(async () => (pedido === null ? null : { order: { ...pedido, reservedAt: null }, lines: lineas })),
      lockAliveLine: vi.fn(async (_orderId: string, lineId: string) => {
        const encontrada = lineas.find((l) => l.id === lineId)
        return pedido === null || encontrada === undefined
          ? null
          : { order: { ...pedido, reservedAt: null }, line: encontrada }
      }),
      cancelLine: vi.fn(anota('cancelLine', 'ok' as const)),
      setLineReservedAt: vi.fn(anota('setLineReservedAt', undefined)),
      refreshStatus: vi.fn(async () => {
        orden.push('refreshStatus')
        return 'PARCIAL' as const
      }),
      mirrorFirstLine: vi.fn(async () => {
        orden.push('mirrorFirstLine')
      }),
      softDeleteAlive: vi.fn(async () => {
        orden.push('softDeleteAlive')
        return 'ok' as const
      }),
    },
    reservations: {
      releaseForLine: vi.fn(async (input: { orderLineId: string | null }) => {
        orden.push(`releaseForLine:${String(input.orderLineId)}`)
      }),
    },
  })
  const lectura = {
    findAliveById: vi.fn(async () => pedido),
    findAliveLines: vi.fn(async () => lineas),
    listAlive: vi.fn(),
    findBlockedIds: vi.fn(),
  } as unknown as OrderRepository & Record<'findAliveById' | 'findAliveLines', ReturnType<typeof vi.fn>>
  return { unitOfWork, orders, reservations, lectura, orden, now: () => AHORA }
}

async function codigo(operacion: () => Promise<unknown>): Promise<string> {
  const error = await operacion().then(
    () => null,
    (e: unknown) => e,
  )
  expect(error, 'la operacion tenia que fallar').not.toBeNull()
  return (error as PedidosError).code
}

/** Un `OrderUnitOfWork` que explota si se abre. */
function sinTransaccion(): OrderUnitOfWork & { run: ReturnType<typeof vi.fn> } {
  return {
    run: vi.fn(() => {
      throw new Error('la unidad de trabajo no deberia abrirse')
    }),
  }
}

describe('QT-313 T11 — cancelOrderLine', () => {
  it('R27: cancela la linea con su motivo recortado, libera solo lo suyo, vacia su plazo y deriva el pedido, sin tocar la otra', async () => {
    const d = dobles([linea(LINEA_A, 0, 'PENDIENTE'), linea(LINEA_B, 1, 'EN_CURSO')])

    await createCancelOrderLine(d)(PEDIDO.id, LINEA_B, { reason: '  sin stock  ' }, ADMIN)

    expect(d.orders.lockAliveLine).toHaveBeenCalledWith(PEDIDO.id, LINEA_B, SCOPE)
    expect(d.orders.cancelLine).toHaveBeenCalledTimes(1)
    expect(d.orders.cancelLine.mock.calls[0]).toEqual([PEDIDO.id, LINEA_B, 'sin stock', ADMIN.id, AHORA, SCOPE])
    expect(d.reservations.releaseForLine).toHaveBeenCalledTimes(1)
    expect(d.reservations.releaseForLine.mock.calls[0]?.[0]).toEqual({
      orderId: PEDIDO.id,
      orderLineId: LINEA_B,
      companyId: ADMIN.companyId,
      reason: 'release',
      actorId: ADMIN.id,
      now: AHORA,
    })
    expect(d.orders.setLineReservedAt).toHaveBeenCalledWith(PEDIDO.id, LINEA_B, null, SCOPE)
    expect(d.orden).toEqual([
      `cancelLine:${LINEA_B}`,
      `releaseForLine:${LINEA_B}`,
      `setLineReservedAt:${LINEA_B}`,
      'refreshStatus',
      'mirrorFirstLine',
    ])
    // Ninguna escritura del estado del pedido: se deriva de las lineas.
    expect(d.orders.cancelAlive).not.toHaveBeenCalled()
    expect(d.orders.setStatus).not.toHaveBeenCalled()
  })

  it('R27: cancela una linea BLOQUEADO, que no tiene nada apartado, igual que una PENDIENTE', async () => {
    const d = dobles([linea(LINEA_A, 0, 'BLOQUEADO'), linea(LINEA_B, 1, 'PENDIENTE')])

    await createCancelOrderLine(d)(PEDIDO.id, LINEA_A, { reason: 'ya no' }, ADMIN)

    expect(d.orders.cancelLine.mock.calls.map((call) => call[1])).toEqual([LINEA_A])
  })

  it('R28: una linea en estado no cancelable responde not_cancellable sin escribir nada', async () => {
    for (const status of ['POR_EMPACAR', 'EN_EMPAQUE', 'POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO', 'ENTREGADO', 'CANCELADO'] as const) {
      const d = dobles([linea(LINEA_A, 0, status), linea(LINEA_B, 1, 'PENDIENTE')])

      expect(await codigo(() => createCancelOrderLine(d)(PEDIDO.id, LINEA_A, { reason: 'sin stock' }, ADMIN)), status).toBe(
        'not_cancellable',
      )
      expect(d.orden, status).toEqual([])
      expect(d.reservations.releaseForLine, status).not.toHaveBeenCalled()
    }
  })

  it('R28: sin motivo, vacio, de solo espacios o de mas de 500 caracteres responde invalid_input sin abrir la transaccion', async () => {
    for (const entrada of [{}, { reason: '' }, { reason: '   ' }, { reason: 'x'.repeat(501) }, null]) {
      const unitOfWork = sinTransaccion()
      expect(await codigo(() => createCancelOrderLine({ unitOfWork })(PEDIDO.id, LINEA_A, entrada, ADMIN))).toBe('invalid_input')
      expect(unitOfWork.run).not.toHaveBeenCalled()
    }
    const d = dobles([linea(LINEA_A, 0, 'PENDIENTE')])
    await createCancelOrderLine(d)(PEDIDO.id, LINEA_A, { reason: 'x'.repeat(500) }, ADMIN)
    expect(d.orders.cancelLine).toHaveBeenCalledTimes(1)
  })

  it('R28, R43: una linea de otro pedido, quitada o de otra empresa responde order_not_found sin escribir', async () => {
    const d = dobles([linea(LINEA_A, 0, 'PENDIENTE')])

    expect(await codigo(() => createCancelOrderLine(d)(PEDIDO.id, LINEA_B, { reason: 'sin stock' }, ADMIN))).toBe('order_not_found')
    expect(d.orden).toEqual([])
  })

  it('R30: sin pedidos.modificar responde unauthorized antes de validar el motivo y sin abrir la transaccion', async () => {
    const unitOfWork = sinTransaccion()
    const cancelar = createCancelOrderLine({ unitOfWork })

    expect(await codigo(() => cancelar(PEDIDO.id, LINEA_A, { reason: '' }, SIN_PERMISO))).toBe('unauthorized')
    expect(await codigo(() => cancelar(PEDIDO.id, LINEA_A, { reason: 'sin stock' }, null))).toBe('unauthorized')
    expect(unitOfWork.run).not.toHaveBeenCalled()
  })
})

describe('QT-313 T11 — cancelOrder con varias lineas', () => {
  it('R29: cancela con el mismo motivo todas las lineas cancelables, en orden, y deja intacta la POR_EMPACAR', async () => {
    const LINEA_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    const d = dobles([linea(LINEA_A, 0, 'PENDIENTE'), linea(LINEA_B, 1, 'POR_EMPACAR'), linea(LINEA_C, 2, 'BLOQUEADO')])

    await createCancelOrder(d)(PEDIDO.id, { reason: 'El cliente anulo' }, ADMIN)

    expect(d.orders.lockAliveLines).toHaveBeenCalledWith(PEDIDO.id, SCOPE)
    expect(d.orders.cancelLine.mock.calls.map((call) => [call[1], call[2]])).toEqual([
      [LINEA_A, 'El cliente anulo'],
      [LINEA_C, 'El cliente anulo'],
    ])
    expect(d.reservations.releaseForLine.mock.calls.map((call) => call[0].orderLineId)).toEqual([LINEA_A, LINEA_C])
    expect(d.orden.slice(-2)).toEqual(['refreshStatus', 'mirrorFirstLine'])
    expect(d.orders.refreshStatus).toHaveBeenCalledWith(PEDIDO.id, ADMIN.id, AHORA, SCOPE)
    expect(d.orders.cancelAlive).not.toHaveBeenCalled()
  })

  it('R29: si ninguna linea es cancelable responde not_cancellable sin escribir nada', async () => {
    const d = dobles([linea(LINEA_A, 0, 'TERMINADO'), linea(LINEA_B, 1, 'CANCELADO')])

    expect(await codigo(() => createCancelOrder(d)(PEDIDO.id, { reason: 'sin stock' }, ADMIN))).toBe('not_cancellable')
    expect(d.orden).toEqual([])
  })

  it('R29: un pedido que no existe, esta borrado o es de otra empresa responde order_not_found', async () => {
    const d = dobles([], { pedido: null })

    expect(await codigo(() => createCancelOrder(d)(PEDIDO.id, { reason: 'sin stock' }, ADMIN))).toBe('order_not_found')
    expect(d.orden).toEqual([])
  })

  it('R29: cancelar por encargo de otro modulo sigue la misma regla y devuelve su resultado', async () => {
    const d = dobles([linea(LINEA_A, 0, 'EN_CURSO'), linea(LINEA_B, 1, 'TERMINADO')])
    const cancelar = createCancelAliveOrder({ unitOfWork: d.unitOfWork })

    expect(await cancelar(PEDIDO.id, ADMIN.companyId, 'motivo', ADMIN.id, AHORA)).toBe('ok')
    expect(d.orders.cancelLine.mock.calls.map((call) => call[1])).toEqual([LINEA_A])

    const ninguna = dobles([linea(LINEA_A, 0, 'TERMINADO')])
    expect(await createCancelAliveOrder({ unitOfWork: ninguna.unitOfWork })(PEDIDO.id, ADMIN.companyId, 'm', null as unknown as string, AHORA)).toBe(
      'not_cancellable',
    )
    expect(ninguna.orden).toEqual([])
  })

  it('R30: cancelar el pedido sin pedidos.modificar responde unauthorized antes de validar y sin abrir la transaccion', async () => {
    const unitOfWork = sinTransaccion()

    expect(await codigo(() => createCancelOrder({ unitOfWork })(PEDIDO.id, {}, SIN_PERMISO))).toBe('unauthorized')
    expect(unitOfWork.run).not.toHaveBeenCalled()
  })
})

describe('QT-313 T11 — deleteOrder con varias lineas', () => {
  it('R47: libera el material de cada linea y vacia su plazo, y despues da de baja el pedido con sus lineas', async () => {
    const d = dobles([linea(LINEA_A, 0, 'PENDIENTE'), linea(LINEA_B, 1, 'BLOQUEADO')], {
      pedido: fakeOrderRow({ status: 'PARCIAL' }),
    })

    await createDeleteOrder({ orders: d.lectura, unitOfWork: d.unitOfWork, now: d.now })(PEDIDO.id, ADMIN)

    expect(d.orden).toEqual([
      `releaseForLine:${LINEA_A}`,
      `setLineReservedAt:${LINEA_A}`,
      `releaseForLine:${LINEA_B}`,
      `setLineReservedAt:${LINEA_B}`,
      'mirrorFirstLine',
      'softDeleteAlive',
    ])
    expect(d.orders.softDeleteAlive).toHaveBeenCalledWith(PEDIDO.id, ADMIN.id, AHORA, SCOPE)
    expect(d.orders.setReservedAt).not.toHaveBeenCalled()
  })

  it('R47: con una linea ya consumida (POR_EMPACAR en adelante), entregada o cancelada rechaza con not_deletable sin escribir', async () => {
    for (const status of ['POR_EMPACAR', 'TERMINADO', 'ENTREGADO', 'CANCELADO'] as const) {
      const d = dobles([linea(LINEA_A, 0, 'PENDIENTE'), linea(LINEA_B, 1, status)])

      expect(await codigo(() => createDeleteOrder({ orders: d.lectura, unitOfWork: d.unitOfWork })(PEDIDO.id, ADMIN)), status).toBe(
        'not_deletable',
      )
      expect(d.orden, status).toEqual([])
    }
  })

  it('R47: si una linea se consumio entre la lectura y el candado, rechaza bajo el candado sin escribir', async () => {
    const d = dobles([linea(LINEA_A, 0, 'PENDIENTE'), linea(LINEA_B, 1, 'POR_EMPACAR')])
    d.lectura.findAliveLines.mockResolvedValue([linea(LINEA_A, 0, 'PENDIENTE'), linea(LINEA_B, 1, 'EN_CURSO')])

    expect(await codigo(() => createDeleteOrder({ orders: d.lectura, unitOfWork: d.unitOfWork })(PEDIDO.id, ADMIN))).toBe(
      'not_deletable',
    )
    expect(d.orden).toEqual([])
  })
})
