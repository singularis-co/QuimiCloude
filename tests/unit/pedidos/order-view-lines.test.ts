// QT-313 T13 — La ficha y el listado devuelven las recetas del pedido, sus totales y su avance.
// Los dobles filtran por los ids pedidos, como los catalogos y el repositorio de verdad.

import { describe, expect, it, vi } from 'vitest'

import { createGetOrder } from '@/lib/modules/pedidos/domain/get-order'
import { createListOrders } from '@/lib/modules/pedidos/domain/list-orders'

import type { Actor } from '@/lib/modules/pedidos/domain/actor'
import type { OrderLineStatus, OrderStatus } from '@/lib/modules/pedidos/domain/order-classification'
import type { OrderLineRow, OrderRow } from '@/lib/modules/pedidos/domain/order-view'
import type { OrderRepository } from '@/lib/modules/pedidos/ports/order-repository'
import type { PresentationCatalog } from '@/lib/modules/inventario'
import type { RecipeCatalog, RecipeRef } from '@/lib/modules/recetas'
import type { UnitCatalog } from '@/lib/modules/unidades'
import { fakeCustomerCatalog } from '../../helpers/customer-catalog-double'
import { fakeDeliveryProgress } from '../../helpers/delivery-progress-double'
import { fakePackagingCatalog } from '../../helpers/packaging-catalog-double'

const COMPANY = '33333333-3333-4333-8333-333333333333'
const ADMIN: Actor = { id: 'admin-1', companyId: COMPANY, permissions: ['pedidos.consultar'] }

const PEDIDO = '11111111-1111-4111-8111-111111111111'
const OTRO_PEDIDO = '66666666-6666-4666-8666-666666666666'
const CREMA = '22222222-2222-4222-8222-222222222222'
const JABON = '44444444-4444-4444-8444-444444444444'
const GEL = '55555555-5555-4555-8555-555555555555'

function receta(id: string, name: string): RecipeRef {
  return { id, name, ownName: name, isDeleted: false, isUnderReview: false, original: null, imageUrl: null }
}

const RECETAS: readonly RecipeRef[] = [receta(CREMA, 'Crema base'), receta(JABON, 'Jabon neutro'), receta(GEL, 'Gel frio')]

function fila(id: string, status: OrderStatus, recipeId = CREMA): OrderRow {
  return {
    id,
    number: { year: 2026, sequence: 7 },
    recipeId,
    quantity: '10.0000',
    priority: 'MEDIA',
    status,
    cancellationReason: null,
    ingredientsCost: null,
    packagingCost: null,
    actualCost: null,
    salePrice: null,
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    updatedAt: new Date('2026-01-02T03:04:05.000Z'),
    createdBy: 'admin-0',
    updatedBy: 'admin-0',
    presentationLines: [],
    unitId: null,
    customerId: null,
  }
}

type LineaParcial = Partial<OrderLineRow> & {
  readonly position: number
  readonly status: OrderLineStatus
}

function linea(orderId: string, datos: LineaParcial): OrderLineRow {
  return {
    id: `${orderId.slice(0, 8)}-linea-${String(datos.position)}`,
    orderId,
    recipeId: CREMA,
    originalRecipeId: datos.recipeId ?? CREMA,
    quantity: '5.0000',
    unitId: null,
    cancellationReason: null,
    ingredientsCost: null,
    packagingCost: null,
    actualCost: null,
    salePrice: null,
    reservedAt: null,
    finishedAt: null,
    packedBy: null,
    conditionedBy: null,
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    updatedAt: new Date('2026-01-02T03:04:05.000Z'),
    createdBy: 'admin-0',
    updatedBy: 'admin-0',
    presentationLines: [],
    ...datos,
  }
}

function dobles(filas: readonly OrderRow[], lineas: readonly OrderLineRow[]) {
  const findAliveById = vi.fn(async (id: string) => filas.find((row) => row.id === id) ?? null)
  const findAliveLines = vi.fn(async (orderId: string) => lineas.filter((line) => line.orderId === orderId))
  const findAliveLinesByOrderIds = vi.fn(async (orderIds: readonly string[]) =>
    lineas.filter((line) => orderIds.includes(line.orderId)),
  )
  const listAlive = vi.fn(async () => ({ items: filas, total: filas.length, page: 1, pageSize: 10, totalPages: 1 }))
  const findRefsIncludingDeleted = vi.fn(async (ids: readonly string[]) => RECETAS.filter((ref) => ids.includes(ref.id)))
  return {
    findAliveLines,
    findAliveLinesByOrderIds,
    findRefsIncludingDeleted,
    deps: {
      orders: { findAliveById, findAliveLines, findAliveLinesByOrderIds, listAlive } as unknown as OrderRepository,
      recipes: { findRefsIncludingDeleted, findIdsMatchingName: vi.fn(async () => null) } as unknown as RecipeCatalog,
      presentations: { findRefs: vi.fn(async () => []) } as unknown as PresentationCatalog,
      packaging: fakePackagingCatalog(),
      units: { findRefs: vi.fn(async () => []) } as unknown as UnitCatalog,
      customerCatalog: fakeCustomerCatalog(),
      deliveryProgress: fakeDeliveryProgress(),
      log: { ignoredFields: vi.fn() },
    },
  }
}

const CONSULTA = { page: 1, sort: null, filters: {}, search: '' }

describe('getOrder — las recetas del pedido', () => {
  it('R6: devuelve las lineas por position aunque lleguen desordenadas, con su receta resuelta', async () => {
    const d = dobles(
      [fila(PEDIDO, 'PENDIENTE')],
      [
        linea(PEDIDO, { position: 2, status: 'PENDIENTE', recipeId: GEL }),
        linea(PEDIDO, { position: 0, status: 'PENDIENTE', recipeId: CREMA }),
        linea(PEDIDO, { position: 1, status: 'PENDIENTE', recipeId: JABON }),
      ],
    )

    const vista = await createGetOrder(d.deps)(PEDIDO, ADMIN)

    expect(vista.lines.map((line) => [line.position, line.recipeName])).toEqual([
      [0, 'Crema base'],
      [1, 'Jabon neutro'],
      [2, 'Gel frio'],
    ])
    expect(d.findAliveLines).toHaveBeenCalledWith(PEDIDO, { companyId: COMPANY })
    // Las recetas del pedido y de sus lineas, en una sola llamada y sin repetir.
    expect(d.findRefsIncludingDeleted).toHaveBeenCalledTimes(1)
    expect([...(d.findRefsIncludingDeleted.mock.calls[0]?.[0] ?? [])].sort()).toEqual([CREMA, GEL, JABON].sort())
  })

  it('R16: el precio total suma las lineas activas con precio y cuenta las que no lo tienen; las canceladas ni suman ni cuentan', async () => {
    const d = dobles(
      [fila(PEDIDO, 'PENDIENTE')],
      [
        linea(PEDIDO, { position: 0, status: 'PENDIENTE', salePrice: '10.1000' }),
        linea(PEDIDO, { position: 1, status: 'PENDIENTE', salePrice: '0.0005', recipeId: JABON }),
        linea(PEDIDO, { position: 2, status: 'PENDIENTE', salePrice: null, recipeId: GEL }),
        linea(PEDIDO, { position: 3, status: 'CANCELADO', salePrice: '99.0000', cancellationReason: 'sin stock' }),
      ],
    )

    const vista = await createGetOrder(d.deps)(PEDIDO, ADMIN)

    expect(vista.salePriceTotal).toBe('10.1005')
    expect(vista.linesWithoutPrice).toBe(1)
    expect(vista.lines[3]).toMatchObject({ status: 'CANCELADO', salePrice: '99.0000', cancellationReason: 'sin stock' })
  })

  it('R16: sin ninguna linea activa con precio el total es null, no 0', async () => {
    const d = dobles(
      [fila(PEDIDO, 'PENDIENTE')],
      [linea(PEDIDO, { position: 0, status: 'PENDIENTE' }), linea(PEDIDO, { position: 1, status: 'PENDIENTE', recipeId: JABON })],
    )

    const vista = await createGetOrder(d.deps)(PEDIDO, ADMIN)

    expect(vista.salePriceTotal).toBeNull()
    expect(vista.linesWithoutPrice).toBe(2)
  })

  it('R18: los costes totales suman las lineas activas exactas y dejan fuera las canceladas', async () => {
    const d = dobles(
      [fila(PEDIDO, 'PARCIAL')],
      [
        linea(PEDIDO, { position: 0, status: 'TERMINADO', ingredientsCost: '1.2345', packagingCost: '0.1000', actualCost: '1.0001' }),
        linea(PEDIDO, { position: 1, status: 'ENTREGADO', ingredientsCost: '2.0000', packagingCost: '0.0000', actualCost: '2.9999', recipeId: JABON }),
        linea(PEDIDO, { position: 2, status: 'CANCELADO', ingredientsCost: '50.0000', packagingCost: '0.0000', actualCost: null, recipeId: GEL }),
      ],
    )

    const vista = await createGetOrder(d.deps)(PEDIDO, ADMIN)

    expect(vista.ingredientsCostTotal).toBe('3.2345')
    expect(vista.actualCostTotal).toBe('4.0000')
  })

  it('R18: si una linea activa no tiene coste, el total es null', async () => {
    const d = dobles(
      [fila(PEDIDO, 'PARCIAL')],
      [
        linea(PEDIDO, { position: 0, status: 'TERMINADO', ingredientsCost: '1.0000', packagingCost: '0.0000', actualCost: '1.0000' }),
        linea(PEDIDO, { position: 1, status: 'PENDIENTE', recipeId: JABON }),
      ],
    )

    const vista = await createGetOrder(d.deps)(PEDIDO, ADMIN)

    expect(vista.ingredientsCostTotal).toBeNull()
    expect(vista.actualCostTotal).toBeNull()
  })

  it('R33: el avance cuenta las lineas activas y cuantas estan TERMINADO o ENTREGADO; las canceladas no cuentan', async () => {
    const d = dobles(
      [fila(PEDIDO, 'PARCIAL')],
      [
        linea(PEDIDO, { position: 0, status: 'TERMINADO' }),
        linea(PEDIDO, { position: 1, status: 'ENTREGADO', recipeId: JABON }),
        linea(PEDIDO, { position: 2, status: 'EN_CURSO', recipeId: GEL }),
        linea(PEDIDO, { position: 3, status: 'CANCELADO', cancellationReason: 'no va' }),
      ],
    )

    const vista = await createGetOrder(d.deps)(PEDIDO, ADMIN)

    expect(vista.progress).toEqual({ total: 3, finished: 2 })
  })

  it('R34: el pedido sale con su estado derivado PARCIAL y cada linea con el suyo', async () => {
    const d = dobles(
      [fila(PEDIDO, 'PARCIAL')],
      [linea(PEDIDO, { position: 0, status: 'EN_CURSO' }), linea(PEDIDO, { position: 1, status: 'PENDIENTE', recipeId: JABON })],
    )

    const vista = await createGetOrder(d.deps)(PEDIDO, ADMIN)

    expect(vista.status).toBe('PARCIAL')
    expect(vista.lines.map((line) => line.status)).toEqual(['EN_CURSO', 'PENDIENTE'])
  })

  it('R44: un pedido de una linea conserva los campos planos de hoy junto a la linea', async () => {
    const d = dobles(
      [{ ...fila(PEDIDO, 'PENDIENTE'), salePrice: '12.0000' }],
      [linea(PEDIDO, { position: 0, status: 'PENDIENTE', quantity: '10.0000', salePrice: '12.0000' })],
    )

    const vista = await createGetOrder(d.deps)(PEDIDO, ADMIN)

    expect(vista).toMatchObject({ recipeId: CREMA, recipeName: 'Crema base', quantity: '10.0000', salePrice: '12.0000' })
    expect(vista.lines).toHaveLength(1)
    expect(vista.salePriceTotal).toBe('12.0000')
  })
})

describe('listOrders — las recetas de cada pedido de la pagina', () => {
  it('R6, R33, R34: lee las lineas de toda la pagina en una sola llamada y da a cada pedido las suyas, por position', async () => {
    const d = dobles(
      [fila(PEDIDO, 'PARCIAL'), fila(OTRO_PEDIDO, 'PENDIENTE', JABON)],
      [
        linea(PEDIDO, { position: 1, status: 'TERMINADO', recipeId: GEL }),
        linea(OTRO_PEDIDO, { position: 0, status: 'PENDIENTE', recipeId: JABON }),
        linea(PEDIDO, { position: 0, status: 'EN_CURSO' }),
      ],
    )

    const pagina = await createListOrders(d.deps)(CONSULTA, ADMIN)

    expect(d.findAliveLinesByOrderIds).toHaveBeenCalledTimes(1)
    expect(d.findAliveLinesByOrderIds).toHaveBeenCalledWith([PEDIDO, OTRO_PEDIDO], { companyId: COMPANY })
    expect(d.findRefsIncludingDeleted).toHaveBeenCalledTimes(1)
    const [primero, segundo] = pagina.items
    expect(primero?.status).toBe('PARCIAL')
    expect(primero?.lines.map((line) => [line.position, line.recipeName, line.status])).toEqual([
      [0, 'Crema base', 'EN_CURSO'],
      [1, 'Gel frio', 'TERMINADO'],
    ])
    expect(primero?.progress).toEqual({ total: 2, finished: 1 })
    expect(segundo?.lines.map((line) => line.recipeName)).toEqual(['Jabon neutro'])
    expect(segundo?.progress).toEqual({ total: 1, finished: 0 })
  })

  it('R16, R18: cada fila del listado lleva sus totales, sin mezclar los de otro pedido', async () => {
    const d = dobles(
      [fila(PEDIDO, 'PENDIENTE'), fila(OTRO_PEDIDO, 'PENDIENTE', JABON)],
      [
        linea(PEDIDO, { position: 0, status: 'PENDIENTE', salePrice: '1.5000', ingredientsCost: '0.5000', packagingCost: '0.0000' }),
        linea(PEDIDO, { position: 1, status: 'PENDIENTE', salePrice: '2.5000', ingredientsCost: '0.2500', packagingCost: '0.0000', recipeId: GEL }),
        linea(OTRO_PEDIDO, { position: 0, status: 'PENDIENTE', salePrice: null, ingredientsCost: '7.0000', packagingCost: '0.0000', recipeId: JABON }),
      ],
    )

    const pagina = await createListOrders(d.deps)(CONSULTA, ADMIN)

    expect(pagina.items[0]).toMatchObject({ salePriceTotal: '4.0000', linesWithoutPrice: 0, ingredientsCostTotal: '0.7500' })
    expect(pagina.items[1]).toMatchObject({ salePriceTotal: null, linesWithoutPrice: 1, ingredientsCostTotal: '7.0000' })
  })

  it('una pagina vacia no pide lineas', async () => {
    const d = dobles([], [])

    await createListOrders(d.deps)(CONSULTA, ADMIN)

    expect(d.findAliveLinesByOrderIds).not.toHaveBeenCalled()
  })
})
