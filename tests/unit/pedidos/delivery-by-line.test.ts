// QT-313 T12 — Entregar y anular la entrega de un pedido con varias recetas.
//
// Cada receta del pedido tiene su reparto; una entrega pasa a ENTREGADO solo la linea cuyo
// reparto completa, la anulacion devuelve a TERMINADO solo la que deja de estar completa, y el
// estado del pedido se deriva. El asiento de cada lote lleva la linea de su reparto.

import { describe, expect, it, vi } from 'vitest'

import { createDeliverOrder } from '@/lib/modules/pedidos/domain/deliver-order'
import { createVoidDelivery } from '@/lib/modules/pedidos/domain/void-delivery'

import { fakeOrderRow, orderLineOf } from '@/tests/helpers/order-unit-of-work-double'

import type { FinishedGoodsDispatchInput, FinishedGoodsReturnInput } from '@/lib/modules/inventario'
import type { Actor } from '@/lib/modules/pedidos/domain/actor'
import type { OrderLineStatus } from '@/lib/modules/pedidos/domain/order-classification'
import type { OrderLineRow } from '@/lib/modules/pedidos/domain/order-view'
import type { OrderDeliveryTransactionScope } from '@/lib/modules/pedidos/ports/order-delivery-unit-of-work'
import type { DeliveryLineForVoid } from '@/lib/modules/pedidos/ports/order-delivery-void-repository'
import type { OrderDeliveryVoidTransactionScope } from '@/lib/modules/pedidos/ports/order-delivery-void-unit-of-work'
import type { OrderRepository } from '@/lib/modules/pedidos/ports/order-repository'
import type { FinishPackingLine } from '@/lib/modules/pedidos/ports/order-write-repository'

const COMPANY_ID = '33333333-3333-4333-8333-333333333333'
const SCOPE = { companyId: COMPANY_ID }
const AHORA = new Date('2026-11-04T12:00:00.000Z')
const ENTREGADOR: Actor = { id: 'entregador-1', companyId: COMPANY_ID, permissions: ['entregas.modificar', 'entregas.anular'] }
const PEDIDO = fakeOrderRow({ status: 'TERMINADO' })
const CLIENTE = '44444444-4444-4444-8444-444444444444'
const LOTE_A = '55555555-5555-4555-8555-555555555551'
const LOTE_B = '55555555-5555-4555-8555-555555555552'
const LINEA_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const LINEA_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const RECETA_A = 'a0000000-0000-4000-8000-00000000000a'
const RECETA_B = 'b0000000-0000-4000-8000-00000000000b'
const REPARTO_A = 'a1111111-1111-4111-8111-111111111111'
const REPARTO_B = 'b1111111-1111-4111-8111-111111111111'
const ENTREGA = '66666666-6666-4666-8666-666666666666'
const ANULACION = '77777777-7777-4777-8777-777777777777'

function linea(id: string, recipeId: string, position: number, status: OrderLineStatus): OrderLineRow {
  return orderLineOf(PEDIDO, { id, recipeId, originalRecipeId: recipeId, position, status })
}

function reparto(id: string, orderLineId: string, packages: number): FinishPackingLine {
  return {
    id,
    presentationId: `presentacion-${id}`,
    packages,
    presentationContent: '1.0000',
    packagingProductId: null,
    packedPackages: null,
    packedSurplusPackages: 0,
    orderLineId,
  }
}

const REPARTOS = [reparto(REPARTO_A, LINEA_A, 4), reparto(REPARTO_B, LINEA_B, 6)]

function montarEntrega(lineas: readonly OrderLineRow[], entregados: ReadonlyMap<string, number> = new Map()) {
  const tx = {
    orders: {
      lockAliveLines: vi.fn(async () => ({ order: { ...PEDIDO, reservedAt: null }, lines: lineas })),
      findPresentationLinesForFinish: vi.fn(async () => REPARTOS),
      setStatus: vi.fn(() => {
        throw new Error('el estado del pedido no se escribe: se deriva')
      }),
      setLineStatus: vi.fn(async () => 'ok' as const),
      refreshStatus: vi.fn(async () => 'PARCIAL' as const),
    },
    deliveries: {
      findByKey: vi.fn(async () => null),
      create: vi.fn(async () => ({ kind: 'created' as const, id: ENTREGA })),
      addLines: vi.fn(async () => undefined),
      sumDeliveredPackages: vi.fn(async () => entregados),
    },
    finishedGoods: {
      dispatchForDelivery: vi.fn(async (input: FinishedGoodsDispatchInput) => ({
        kind: 'dispatched' as const,
        lines: input.allocations.map((a) => ({ batchId: a.batchId, packages: a.packages, quantity: `${String(a.packages)}.0000` })),
      })),
    },
  }
  const deliver = createDeliverOrder({
    customerCatalog: { findAliveRefById: vi.fn(async () => ({ id: CLIENTE, firstNames: 'C', lastNames: 'L', isDeleted: false })) },
    unitOfWork: { run: (work) => work(tx as unknown as OrderDeliveryTransactionScope) },
    deliveries: { findByKey: vi.fn(async () => null) },
    orders: {} as OrderRepository,
    now: () => AHORA,
  })
  return { tx, deliver }
}

function entrada(allocations: readonly { presentationLineId: string; batchId: string; packages: number }[]) {
  return {
    orderId: PEDIDO.id,
    deliveryKey: '88888888-8888-4888-8888-888888888888',
    customers: [{ customerId: CLIENTE, allocations }],
  }
}

describe('QT-313 T12 — deliverOrder por linea', () => {
  it('R39: entregar todo el reparto de una linea pasa a ENTREGADO solo esa linea y deriva el pedido', async () => {
    const m = montarEntrega([linea(LINEA_A, RECETA_A, 0, 'TERMINADO'), linea(LINEA_B, RECETA_B, 1, 'TERMINADO')])

    const resultado = await m.deliver(entrada([{ presentationLineId: REPARTO_A, batchId: LOTE_A, packages: 4 }]), ENTREGADOR)

    expect(m.tx.orders.setLineStatus.mock.calls).toEqual([
      [PEDIDO.id, LINEA_A, 'TERMINADO', 'ENTREGADO', ENTREGADOR.id, AHORA, SCOPE],
    ])
    expect(m.tx.orders.refreshStatus).toHaveBeenCalledWith(PEDIDO.id, ENTREGADOR.id, AHORA, SCOPE)
    expect(resultado).toEqual({ status: 'delivered', orderStatus: 'PARCIAL' })
    expect(m.tx.orders.setStatus).not.toHaveBeenCalled()
  })

  it('R39: una entrega parcial de una linea no cambia el estado de ninguna', async () => {
    const m = montarEntrega([linea(LINEA_A, RECETA_A, 0, 'TERMINADO'), linea(LINEA_B, RECETA_B, 1, 'TERMINADO')])
    m.tx.orders.refreshStatus.mockResolvedValue('TERMINADO' as never)

    const resultado = await m.deliver(
      entrada([
        { presentationLineId: REPARTO_A, batchId: LOTE_A, packages: 3 },
        { presentationLineId: REPARTO_B, batchId: LOTE_B, packages: 5 },
      ]),
      ENTREGADOR,
    )

    expect(m.tx.orders.setLineStatus).not.toHaveBeenCalled()
    expect(resultado).toEqual({ status: 'delivered', orderStatus: 'TERMINADO' })
  })

  it('R39: con entregas previas, la que completa la segunda linea solo mueve esa', async () => {
    const m = montarEntrega(
      [linea(LINEA_A, RECETA_A, 0, 'ENTREGADO'), linea(LINEA_B, RECETA_B, 1, 'TERMINADO')],
      new Map([
        [REPARTO_A, 4],
        [REPARTO_B, 2],
      ]),
    )
    m.tx.orders.refreshStatus.mockResolvedValue('ENTREGADO' as never)

    const resultado = await m.deliver(entrada([{ presentationLineId: REPARTO_B, batchId: LOTE_B, packages: 4 }]), ENTREGADOR)

    expect(m.tx.orders.setLineStatus.mock.calls.map((call) => (call as unknown[])[1])).toEqual([LINEA_B])
    expect(resultado).toEqual({ status: 'delivered', orderStatus: 'ENTREGADO' })
  })

  it('R39: el reparto de una linea que no esta TERMINADO no se entrega y no se escribe nada', async () => {
    const m = montarEntrega([linea(LINEA_A, RECETA_A, 0, 'TERMINADO'), linea(LINEA_B, RECETA_B, 1, 'EN_CURSO')])

    await expect(
      m.deliver(entrada([{ presentationLineId: REPARTO_B, batchId: LOTE_B, packages: 1 }]), ENTREGADOR),
    ).rejects.toMatchObject({ code: 'action_not_allowed' })
    expect(m.tx.deliveries.create).not.toHaveBeenCalled()
    expect(m.tx.finishedGoods.dispatchForDelivery).not.toHaveBeenCalled()
  })

  it('R37: cada salida de producto terminado lleva la linea y la receta de su reparto', async () => {
    const m = montarEntrega([linea(LINEA_A, RECETA_A, 0, 'TERMINADO'), linea(LINEA_B, RECETA_B, 1, 'TERMINADO')])

    await m.deliver(
      entrada([
        { presentationLineId: REPARTO_A, batchId: LOTE_A, packages: 1 },
        { presentationLineId: REPARTO_B, batchId: LOTE_B, packages: 1 },
      ]),
      ENTREGADOR,
    )

    expect(
      m.tx.finishedGoods.dispatchForDelivery.mock.calls.map(([input]) => [input.orderLineId, input.recipeId]),
    ).toEqual([
      [LINEA_A, RECETA_A],
      [LINEA_B, RECETA_B],
    ])
  })
})

function entregadas(): readonly DeliveryLineForVoid[] {
  return [
    { id: 'e-a', customerId: CLIENTE, presentationLineId: REPARTO_A, orderLineId: LINEA_A, batchId: LOTE_A, packages: 4, quantity: '4.0000', voided: false },
    { id: 'e-b', customerId: CLIENTE, presentationLineId: REPARTO_B, orderLineId: LINEA_B, batchId: LOTE_B, packages: 6, quantity: '6.0000', voided: false },
  ]
}

function montarAnulacion(lineas: readonly OrderLineRow[]) {
  const tx = {
    orders: {
      lockAliveLines: vi.fn(async () => ({ order: { ...PEDIDO, reservedAt: null }, lines: lineas })),
      setStatus: vi.fn(() => {
        throw new Error('el estado del pedido no se escribe: se deriva')
      }),
      setLineStatus: vi.fn(async () => 'ok' as const),
      refreshStatus: vi.fn(async () => 'PARCIAL' as const),
    },
    voids: {
      findByKey: vi.fn(async () => null),
      findDelivery: vi.fn(),
      findDeliveryLines: vi.fn(async () => entregadas()),
      create: vi.fn(async () => ({ kind: 'created' as const, id: ANULACION })),
      addLines: vi.fn(async () => 'ok' as const),
    },
    finishedGoods: {
      returnForDeliveryVoid: vi.fn(async (input: FinishedGoodsReturnInput) => {
        void input
        return { kind: 'returned' as const }
      }),
    },
  }
  const anular = createVoidDelivery({
    unitOfWork: { run: (work) => work(tx as unknown as OrderDeliveryVoidTransactionScope) },
    voids: {
      findByKey: vi.fn(async () => null),
      findDelivery: vi.fn(async () => ({ id: ENTREGA, orderId: PEDIDO.id, productId: null, createdAt: AHORA })),
    },
    orders: {} as OrderRepository,
    now: () => AHORA,
  })
  return { tx, anular }
}

function anulacion(presentationLineIds: readonly string[]) {
  return {
    deliveryId: ENTREGA,
    voidKey: '99999999-9999-4999-8999-999999999999',
    items: presentationLineIds.map((presentationLineId) => ({ customerId: CLIENTE, presentationLineId })),
    reason: 'Error de despacho',
  }
}

describe('QT-313 T12 — voidDelivery por linea', () => {
  it('R39: anular la entrega de una linea ENTREGADO la devuelve a TERMINADO y no toca la otra', async () => {
    const m = montarAnulacion([linea(LINEA_A, RECETA_A, 0, 'ENTREGADO'), linea(LINEA_B, RECETA_B, 1, 'ENTREGADO')])

    const resultado = await m.anular(anulacion([REPARTO_A]), ENTREGADOR)

    expect(m.tx.orders.setLineStatus.mock.calls).toEqual([
      [PEDIDO.id, LINEA_A, 'ENTREGADO', 'TERMINADO', ENTREGADOR.id, AHORA, SCOPE],
    ])
    expect(m.tx.orders.refreshStatus).toHaveBeenCalledWith(PEDIDO.id, ENTREGADOR.id, AHORA, SCOPE)
    expect(resultado).toEqual({ status: 'voided', orderStatus: 'PARCIAL' })
  })

  it('R39: anular la de una linea que sigue TERMINADO no cambia ningun estado de linea', async () => {
    const m = montarAnulacion([linea(LINEA_A, RECETA_A, 0, 'TERMINADO'), linea(LINEA_B, RECETA_B, 1, 'ENTREGADO')])

    await m.anular(anulacion([REPARTO_A]), ENTREGADOR)

    expect(m.tx.orders.setLineStatus).not.toHaveBeenCalled()
  })

  it('R37: cada devolucion lleva la linea del asiento de entrega que anula', async () => {
    const m = montarAnulacion([linea(LINEA_A, RECETA_A, 0, 'ENTREGADO'), linea(LINEA_B, RECETA_B, 1, 'ENTREGADO')])

    await m.anular(anulacion([REPARTO_A, REPARTO_B]), ENTREGADOR)

    const input = m.tx.finishedGoods.returnForDeliveryVoid.mock.calls[0]?.[0]
    expect(input?.lines).toEqual([
      { batchId: LOTE_A, quantity: '4.0000', orderLineId: LINEA_A },
      { batchId: LOTE_B, quantity: '6.0000', orderLineId: LINEA_B },
    ])
  })

  it('R39: el reparto de una linea que no esta TERMINADO ni ENTREGADO no se anula y no se escribe nada', async () => {
    const m = montarAnulacion([linea(LINEA_A, RECETA_A, 0, 'EN_CURSO'), linea(LINEA_B, RECETA_B, 1, 'ENTREGADO')])

    await expect(m.anular(anulacion([REPARTO_A]), ENTREGADOR)).rejects.toMatchObject({ code: 'action_not_allowed' })
    expect(m.tx.voids.create).not.toHaveBeenCalled()
  })
})
