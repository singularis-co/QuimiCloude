// QT-313 T12 — La caducidad diaria y la revision de bloqueados, por linea.
//
// Dos lineas del mismo pedido con plazos distintos: el proceso cancela solo la vencida y libera
// solo lo suyo. Dos lineas bloqueadas y material para una: solo esa pasa a PENDIENTE y estrena su
// plazo. En los dos casos el estado del pedido se deriva de sus lineas.

import { describe, expect, it, vi } from 'vitest'

import { createExpireStaleOrders } from '@/lib/modules/pedidos/domain/expire-stale-orders'
import { EXPIRED_ORDER_REASON } from '@/lib/modules/pedidos/domain/order-expiry'
import { createReviewBlockedOrders } from '@/lib/modules/pedidos/domain/review-blocked-orders'

import { fakeOrderRow, fakeUnitOfWork, orderLineOf } from '@/tests/helpers/order-unit-of-work-double'
import { fakePackagingCatalog } from '@/tests/helpers/packaging-catalog-double'

import type { OrderLineStatus } from '@/lib/modules/pedidos/domain/order-classification'
import type { OrderLineRow } from '@/lib/modules/pedidos/domain/order-view'
import type { OrderRepository } from '@/lib/modules/pedidos/ports/order-repository'
import type { ProductCatalog, ReservationOutcome } from '@/lib/modules/inventario'
import type { RecipeCatalog } from '@/lib/modules/recetas'
import type { UnitCatalog } from '@/lib/modules/unidades'

const EMPRESA = '33333333-3333-4333-8333-333333333333'
const SCOPE = { companyId: EMPRESA }
const AHORA = new Date('2026-11-04T07:00:00.000Z')
const VENCIDO = new Date('2026-10-01T07:00:00.000Z')
const EN_PLAZO = new Date('2026-11-01T07:00:00.000Z')
const PEDIDO = fakeOrderRow({ status: 'PENDIENTE' })
const LINEA_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const LINEA_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function linea(id: string, position: number, status: OrderLineStatus, reservedAt: Date | null): OrderLineRow {
  return orderLineOf(PEDIDO, { id, position, status, reservedAt, recipeId: `receta-${id}`, originalRecipeId: `receta-${id}` })
}

describe('QT-313 T12 — expireStaleOrders por linea', () => {
  it('R51: con dos lineas PENDIENTE de plazos distintos cancela solo la vencida, libera solo lo suyo y deriva el estado del pedido', async () => {
    const lineas = new Map([
      [LINEA_A, linea(LINEA_A, 0, 'PENDIENTE', VENCIDO)],
      [LINEA_B, linea(LINEA_B, 1, 'PENDIENTE', EN_PLAZO)],
    ])
    const d = fakeUnitOfWork({
      orders: {
        lockAliveLine: vi.fn(async (_orderId: string, lineId: string) => {
          const line = lineas.get(lineId)
          return line === undefined ? null : { order: { ...PEDIDO, reservedAt: null }, line }
        }),
        cancelLine: vi.fn(async () => 'ok' as const),
        setLineReservedAt: vi.fn(async () => undefined),
        refreshStatus: vi.fn(async () => 'PENDIENTE' as const),
        mirrorFirstLine: vi.fn(async () => undefined),
      },
    })
    // El lector ya filtra por plazo: solo la linea vencida es candidata.
    const findExpirable = vi.fn(async () => [{ orderId: PEDIDO.id, lineId: LINEA_A, reservedAt: VENCIDO }])

    const resultado = await createExpireStaleOrders({
      listCompanyIds: vi.fn(async () => [EMPRESA]),
      findExpirable,
      unitOfWork: d.unitOfWork,
      now: () => AHORA,
    })()

    expect(resultado).toEqual({ expired: 1, failed: [] })
    expect(d.orders.cancelLine.mock.calls).toEqual([[PEDIDO.id, LINEA_A, EXPIRED_ORDER_REASON, null, AHORA, SCOPE]])
    expect(d.reservations.releaseForLine.mock.calls.map(([input]) => input)).toEqual([
      { orderId: PEDIDO.id, orderLineId: LINEA_A, companyId: EMPRESA, reason: 'expire', actorId: null, now: AHORA },
    ])
    expect(d.orders.setLineReservedAt.mock.calls).toEqual([[PEDIDO.id, LINEA_A, null, SCOPE]])
    expect(d.orders.refreshStatus).toHaveBeenCalledWith(PEDIDO.id, null, AHORA, SCOPE)
    expect(d.orders.cancelAlive).not.toHaveBeenCalled()
  })

  it('R51: si bajo el candado la linea ya tiene un plazo nuevo, no la cancela', async () => {
    const d = fakeUnitOfWork({
      orders: {
        lockAliveLine: vi.fn(async () => ({ order: { ...PEDIDO, reservedAt: null }, line: linea(LINEA_A, 0, 'PENDIENTE', AHORA) })),
      },
    })

    const resultado = await createExpireStaleOrders({
      listCompanyIds: vi.fn(async () => [EMPRESA]),
      findExpirable: vi.fn(async () => [{ orderId: PEDIDO.id, lineId: LINEA_A, reservedAt: VENCIDO }]),
      unitOfWork: d.unitOfWork,
      now: () => AHORA,
    })()

    expect(resultado).toEqual({ expired: 0, failed: [] })
    expect(d.orders.cancelLine).not.toHaveBeenCalled()
    expect(d.reservations.releaseForLine).not.toHaveBeenCalled()
  })
})

describe('QT-313 T12 — reviewBlockedOrders por linea', () => {
  it('R40: con dos lineas BLOQUEADO y material para una, solo esa pasa a PENDIENTE, aparta lo suyo y estrena su plazo', async () => {
    const PRODUCTO = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    const lineas = [linea(LINEA_A, 0, 'BLOQUEADO', null), linea(LINEA_B, 1, 'BLOQUEADO', null)]
    let alcanza = true
    const d = fakeUnitOfWork({
      orders: {
        lockAliveLine: vi.fn(async (_orderId: string, lineId: string) => {
          const line = lineas.find((candidate) => candidate.id === lineId)
          return line === undefined ? null : { order: { ...PEDIDO, reservedAt: null }, line }
        }),
        setLineStatus: vi.fn(async () => 'ok' as const),
        setLineIngredientsCost: vi.fn(async () => 'ok' as const),
        setLineReservedAt: vi.fn(async () => undefined),
        refreshStatus: vi.fn(async () => 'PARCIAL' as const),
        mirrorFirstLine: vi.fn(async () => undefined),
      },
      reservations: {
        syncForLine: vi.fn(async (): Promise<ReservationOutcome> => {
          if (!alcanza) return { kind: 'insufficient', productIds: [PRODUCTO] }
          alcanza = false
          return { kind: 'reserved' }
        }),
      },
      recipes: {
        findExecutionContentById: vi.fn(async (id: string) => ({
          id,
          name: 'Receta',
          isDeleted: false,
          steps: [],
          lines: [{ productId: PRODUCTO, productName: null, percentage: '100.00' }],
          tools: [],
        })),
      },
    })
    const orders = {
      findBlockedIds: vi.fn(async () => [
        { orderId: PEDIDO.id, lineId: LINEA_A },
        { orderId: PEDIDO.id, lineId: LINEA_B },
      ]),
      findAliveLines: vi.fn(async () => lineas),
    } as unknown as Pick<OrderRepository, 'findBlockedIds' | 'findAliveLines'>

    const resultado = await createReviewBlockedOrders({
      orders,
      recipes: { findExecutionContentById: vi.fn() } as unknown as RecipeCatalog,
      products: { findRefs: vi.fn(async () => []), findCostingBatches: vi.fn(async () => []) } as unknown as ProductCatalog,
      units: {
        findRefs: vi.fn(async () => []),
        findRefsSharingBaseInCompany: vi.fn(async () => []),
        findMassVolumeBridge: vi.fn(async () => null),
      } as unknown as UnitCatalog,
      packaging: fakePackagingCatalog(),
      unitOfWork: d.unitOfWork,
    })({ companyId: EMPRESA, now: AHORA })

    expect(resultado).toEqual({ unblocked: 1, failed: [] })
    // Se revisan las dos, en el orden de sus lineas; solo la primera alcanza.
    expect(d.reservations.syncForLine.mock.calls.map(([input]) => input.orderLineId)).toEqual([LINEA_A, LINEA_B])
    expect(d.orders.setLineStatus.mock.calls).toEqual([[PEDIDO.id, LINEA_A, 'BLOQUEADO', 'PENDIENTE', null, AHORA, SCOPE]])
    expect(d.orders.setLineReservedAt.mock.calls).toEqual([[PEDIDO.id, LINEA_A, AHORA, SCOPE]])
    expect(d.orders.setLineIngredientsCost.mock.calls.map((call) => call[1])).toEqual([LINEA_A])
    expect(d.orders.refreshStatus).toHaveBeenCalledTimes(1)
    expect(d.orders.setStatus).not.toHaveBeenCalled()
  })
})
