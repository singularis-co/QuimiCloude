// QT-313 T6 — Los esquemas de entrada del pedido con lineas.

import { describe, expect, it } from 'vitest'

import {
  cancelOrderLineSchema,
  createOrderWithLinesSchema,
  orderLineInputSchema,
  updateOrderLineDistributionSchema,
  updateOrderWithLinesSchema,
} from '@/lib/modules/pedidos/domain/order-input'

const RECETA_X = '22222222-2222-4222-8222-222222222222'
const RECETA_Y = '33333333-3333-4333-8333-333333333333'
const VERSION_X = '55555555-5555-4555-8555-555555555555'
const UNIDAD = '66666666-6666-4666-8666-666666666666'
const CLIENTE = '88888888-8888-4888-8888-888888888888'
const LINEA_A = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'
const ENVASE = 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1'

function linea(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { recipeId: RECETA_X, quantity: '10', unitId: UNIDAD, ...overrides }
}

function pedido(lines: unknown[], overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { lines, ...overrides }
}

describe('createOrderWithLinesSchema y updateOrderWithLinesSchema', () => {
  it('R3: sin lineas se rechaza', () => {
    expect(createOrderWithLinesSchema.safeParse(pedido([])).success).toBe(false)
    expect(updateOrderWithLinesSchema.safeParse(pedido([])).success).toBe(false)
    expect(createOrderWithLinesSchema.safeParse({}).success).toBe(false)
  })

  it('R3: con una o varias lineas se admite y aplica los defectos del pedido', () => {
    const parsed = createOrderWithLinesSchema.parse(pedido([linea(), linea({ recipeId: RECETA_Y })]))
    expect(parsed.lines).toHaveLength(2)
    expect(parsed.priority).toBe('BAJA')
    expect(parsed.customerId).toBeNull()
    expect(parsed.confirmBlocked).toBe(false)
    expect(parsed.lines[0]).toMatchObject({ recipeVersionId: null, presentationLines: [], salePrice: null })
  })

  it('R3: una linea en el alta no trae id', () => {
    expect(createOrderWithLinesSchema.safeParse(pedido([linea({ id: LINEA_A })])).success).toBe(false)
  })

  it('R20: en la edicion una linea con id es la edicion de esa linea y sin id es nueva', () => {
    const parsed = updateOrderWithLinesSchema.parse(pedido([linea({ id: LINEA_A }), linea({ recipeId: RECETA_Y })]))
    expect(parsed.lines[0]?.id).toBe(LINEA_A)
    expect(parsed.lines[1]?.id).toBeUndefined()
  })

  it('R20: el mismo id dos veces en la edicion se rechaza', () => {
    expect(
      updateOrderWithLinesSchema.safeParse(pedido([linea({ id: LINEA_A }), linea({ id: LINEA_A })])).success,
    ).toBe(false)
  })

  it('R20: un id sin forma de UUID se rechaza', () => {
    expect(updateOrderWithLinesSchema.safeParse(pedido([linea({ id: 'no-uuid' })])).success).toBe(false)
  })

  it('R42: prioridad y cliente son del pedido', () => {
    const parsed = createOrderWithLinesSchema.parse(pedido([linea()], { priority: 'ALTA', customerId: CLIENTE }))
    expect(parsed.priority).toBe('ALTA')
    expect(parsed.customerId).toBe(CLIENTE)
  })

  it('R42: prioridad y cliente dentro de una linea se descartan', () => {
    const parsed = createOrderWithLinesSchema.parse(
      pedido([linea({ priority: 'CRITICA', customerId: CLIENTE })]),
    )
    expect(parsed.lines[0]).not.toHaveProperty('priority')
    expect(parsed.lines[0]).not.toHaveProperty('customerId')
    expect(parsed.priority).toBe('BAJA')
    expect(parsed.customerId).toBeNull()
  })
})

describe('orderLineInputSchema', () => {
  it('R15: el precio ausente, vacio o solo espacios es sin precio', () => {
    expect(orderLineInputSchema.parse(linea()).salePrice).toBeNull()
    expect(orderLineInputSchema.parse(linea({ salePrice: '' })).salePrice).toBeNull()
    expect(orderLineInputSchema.parse(linea({ salePrice: '   ' })).salePrice).toBeNull()
  })

  it('R15: el 0 es un precio, distinto de vacio', () => {
    expect(orderLineInputSchema.parse(linea({ salePrice: '0' })).salePrice).toBe('0')
    expect(orderLineInputSchema.parse(linea({ salePrice: ' 12.5 ' })).salePrice).toBe('12.5')
  })

  it('R15: un negativo o un decimal mal formado se rechaza', () => {
    for (const salePrice of ['-1', '1.23456', 'abc', '12345678901', '1,5']) {
      expect(orderLineInputSchema.safeParse(linea({ salePrice })).success, salePrice).toBe(false)
    }
  })

  it('R15: cada linea lleva su propio precio', () => {
    const parsed = createOrderWithLinesSchema.parse(
      pedido([linea({ salePrice: '10' }), linea({ recipeId: RECETA_Y })]),
    )
    expect(parsed.lines.map((line) => line.salePrice)).toEqual(['10', null])
  })

  it('R15: un precio invalido en una linea rechaza el pedido entero', () => {
    expect(
      createOrderWithLinesSchema.safeParse(pedido([linea(), linea({ recipeId: RECETA_Y, salePrice: '-3' })]))
        .success,
    ).toBe(false)
  })

  it('R11: cantidad, unidad y receta de la linea con las reglas de hoy', () => {
    expect(orderLineInputSchema.safeParse(linea({ quantity: '0' })).success).toBe(false)
    expect(orderLineInputSchema.safeParse(linea({ unitId: undefined })).success).toBe(false)
    expect(orderLineInputSchema.safeParse(linea({ recipeId: 'x' })).success).toBe(false)
    expect(orderLineInputSchema.parse(linea({ recipeVersionId: '' })).recipeVersionId).toBeNull()
    expect(orderLineInputSchema.parse(linea({ recipeVersionId: VERSION_X })).recipeVersionId).toBe(VERSION_X)
  })
})

describe('cancelOrderLineSchema y updateOrderLineDistributionSchema', () => {
  it('R27: el motivo de cancelar una linea tiene las reglas del de cancelar el pedido', () => {
    expect(cancelOrderLineSchema.parse({ reason: '  sin material  ' }).reason).toBe('sin material')
    expect(cancelOrderLineSchema.safeParse({ reason: '   ' }).success).toBe(false)
    expect(cancelOrderLineSchema.safeParse({ reason: 'x'.repeat(501) }).success).toBe(false)
  })

  it('R26: la edicion acotada del reparto nombra la linea y rechaza claves de mas', () => {
    const valida = { lineId: LINEA_A, unitId: UNIDAD, presentationLines: [{ packagingProductId: ENVASE, packages: 2 }] }
    expect(updateOrderLineDistributionSchema.parse(valida).lineId).toBe(LINEA_A)
    expect(updateOrderLineDistributionSchema.safeParse({ ...valida, lineId: undefined }).success).toBe(false)
    expect(updateOrderLineDistributionSchema.safeParse({ ...valida, quantity: '3' }).success).toBe(false)
  })
})
