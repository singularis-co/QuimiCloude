// QT-313 T5 — Editar, añadir y quitar lineas, receta repetida y lineas no editables.

import { describe, expect, it } from 'vitest'

import { ERROR_CODES, errorMessage } from '@/lib/modules/errores'
import {
  DuplicateOrderRecipeError,
  InvalidTransitionError,
  OrderLineNotRemovableError,
  OrderNotFoundError,
  PedidosError,
  ValidationError,
} from '@/lib/modules/pedidos/domain/errors'
import { ORDER_STATUS_VALUES, type OrderLineStatus } from '@/lib/modules/pedidos/domain/order-classification'
import { isUnchangedOrderLine, type ComparableOrderLine } from '@/lib/modules/pedidos/domain/order-edit-change'
import {
  assertNoDuplicateOrderRecipe,
  assertOrderLineEditable,
  diffOrderLines,
} from '@/lib/modules/pedidos/domain/order-line-diff'
import {
  assertOrderLinesRemovable,
  isRemovableOrderLineStatus,
} from '@/lib/modules/pedidos/domain/order-line-removal'

const LINEA_A = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'
const LINEA_B = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2'
const LINEA_C = 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3'
const AJENA = 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4'
const RECETA_X = '22222222-2222-4222-8222-222222222222'
const RECETA_Y = '33333333-3333-4333-8333-333333333333'
const VERSION_X = '55555555-5555-4555-8555-555555555555'
const UNIDAD = '66666666-6666-4666-8666-666666666666'
const ENVASE = 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1'
const PRES = '77777777-7777-4777-8777-777777777777'

const LINE_STATUSES = ORDER_STATUS_VALUES.filter((status): status is OrderLineStatus => status !== 'PARCIAL')

function guardada(id: string, status: OrderLineStatus) {
  return { id, status }
}

describe('diffOrderLines', () => {
  it('R20: con id es editar esa linea, sin id es nueva y la viva que falta se quita', () => {
    const vivas = [guardada(LINEA_A, 'PENDIENTE'), guardada(LINEA_B, 'BLOQUEADO')]
    const entrada = [{ id: LINEA_A, n: 1 }, { n: 2 }]

    const diff = diffOrderLines(entrada, vivas)

    expect(diff.edited).toEqual([{ input: entrada[0], saved: vivas[0] }])
    expect(diff.added).toEqual([entrada[1]])
    expect(diff.removed).toEqual([vivas[1]])
  })

  it('R20: una linea cancelada que no llega no es una peticion de quitarla', () => {
    const vivas = [guardada(LINEA_A, 'EN_CURSO'), guardada(LINEA_B, 'CANCELADO')]

    const diff = diffOrderLines([{ id: LINEA_A }], vivas)

    expect(diff.removed).toEqual([])
    expect(diff.edited).toHaveLength(1)
  })

  it('R20: una linea cancelada que llega con su id se trata como edicion de esa linea', () => {
    const vivas = [guardada(LINEA_A, 'CANCELADO')]
    expect(diffOrderLines([{ id: LINEA_A }], vivas).edited).toEqual([{ input: { id: LINEA_A }, saved: vivas[0] }])
  })

  it('R20, R43: un id que no es de una linea viva del pedido responde order_not_found', () => {
    const vivas = [guardada(LINEA_A, 'PENDIENTE')]
    expect(() => diffOrderLines([{ id: AJENA }], vivas)).toThrow(OrderNotFoundError)
  })

  it('R20: el mismo id dos veces en la entrada es entrada invalida', () => {
    const vivas = [guardada(LINEA_A, 'PENDIENTE')]
    expect(() => diffOrderLines([{ id: LINEA_A }, { id: LINEA_A }], vivas)).toThrow(ValidationError)
  })

  it('R20: un alta (sin lineas guardadas) son todas nuevas', () => {
    const diff = diffOrderLines([{}, {}], [])
    expect(diff).toEqual({ edited: [], added: [{}, {}], removed: [] })
  })
})

describe('quitar lineas', () => {
  it('R22: PENDIENTE y BLOQUEADO se pueden quitar', () => {
    expect(isRemovableOrderLineStatus('PENDIENTE')).toBe(true)
    expect(isRemovableOrderLineStatus('BLOQUEADO')).toBe(true)
    expect(() =>
      assertOrderLinesRemovable([guardada(LINEA_A, 'PENDIENTE'), guardada(LINEA_B, 'BLOQUEADO')]),
    ).not.toThrow()
  })

  it('R23: ningun otro estado se puede quitar', () => {
    for (const status of LINE_STATUSES.filter((s) => s !== 'PENDIENTE' && s !== 'BLOQUEADO')) {
      expect(isRemovableOrderLineStatus(status), status).toBe(false)
    }
  })

  it('R23: quitar una EN_CURSO rechaza con order_line_not_removable aunque las demas se puedan quitar', () => {
    let error: unknown
    try {
      assertOrderLinesRemovable([guardada(LINEA_A, 'PENDIENTE'), guardada(LINEA_B, 'EN_CURSO')])
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(OrderLineNotRemovableError)
    expect((error as OrderLineNotRemovableError).code).toBe('order_line_not_removable')
    expect((error as OrderLineNotRemovableError).diagnostic).toContain(LINEA_B)
  })

  it('R23: quitar una BLOQUEADO se admite', () => {
    expect(() => assertOrderLinesRemovable([guardada(LINEA_C, 'BLOQUEADO')])).not.toThrow()
  })
})

describe('assertNoDuplicateOrderRecipe', () => {
  it('R4: dos lineas con la misma receta original rechazan con duplicate_order_recipe', () => {
    expect(() =>
      assertNoDuplicateOrderRecipe([{ originalRecipeId: RECETA_X }, { originalRecipeId: RECETA_X }]),
    ).toThrow(DuplicateOrderRecipeError)
  })

  it('R4: la original y una version suya son la misma receta', () => {
    // La entrada nombra la version aparte; `originalRecipeId` es la original en las dos lineas.
    const entrada = [
      { originalRecipeId: RECETA_X, recipeVersionId: null },
      { originalRecipeId: RECETA_X, recipeVersionId: VERSION_X },
    ]
    expect(() => assertNoDuplicateOrderRecipe(entrada)).toThrow(DuplicateOrderRecipeError)
  })

  it('R4: dos versiones de la misma original son la misma receta', () => {
    const entrada = [
      { originalRecipeId: RECETA_X, recipeVersionId: VERSION_X },
      { originalRecipeId: RECETA_X, recipeVersionId: '56565656-5656-4565-8565-565656565656' },
    ]
    expect(() => assertNoDuplicateOrderRecipe(entrada)).toThrow(DuplicateOrderRecipeError)
  })

  it('R4: recetas distintas se admiten', () => {
    expect(() =>
      assertNoDuplicateOrderRecipe([{ originalRecipeId: RECETA_X }, { originalRecipeId: RECETA_Y }]),
    ).not.toThrow()
  })

  it('R4: una linea editada que pasa a la receta de otra activa choca con ella', () => {
    const vivas = [guardada(LINEA_A, 'EN_CURSO'), guardada(LINEA_B, 'PENDIENTE')]
    const entrada = [
      { id: LINEA_A, originalRecipeId: RECETA_X },
      { id: LINEA_B, originalRecipeId: RECETA_X },
    ]
    expect(() => assertNoDuplicateOrderRecipe(entrada, vivas)).toThrow(DuplicateOrderRecipeError)
  })

  it('R4: volver a añadir la receta de una linea cancelada se admite', () => {
    const vivas = [guardada(LINEA_A, 'CANCELADO'), guardada(LINEA_B, 'PENDIENTE')]
    const entrada = [
      { id: LINEA_A, originalRecipeId: RECETA_X },
      { id: LINEA_B, originalRecipeId: RECETA_Y },
      { originalRecipeId: RECETA_X },
    ]
    expect(() => assertNoDuplicateOrderRecipe(entrada, vivas)).not.toThrow()
    expect(() => assertNoDuplicateOrderRecipe(entrada.slice(1), vivas)).not.toThrow()
  })

  it('R4: el diagnostico lleva las posiciones y el mensaje sale del catalogo', () => {
    let error: unknown
    try {
      assertNoDuplicateOrderRecipe([
        { originalRecipeId: RECETA_X },
        { originalRecipeId: RECETA_Y },
        { originalRecipeId: RECETA_X },
      ])
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(PedidosError)
    const duplicado = error as DuplicateOrderRecipeError
    expect(duplicado.code).toBe('duplicate_order_recipe')
    expect(duplicado.message).toBe(errorMessage('duplicate_order_recipe'))
    expect(duplicado.diagnostic).toContain('0 y 2')
  })
})

describe('R4, R23: los codigos nuevos estan en el catalogo', () => {
  it('duplicate_order_recipe y order_line_not_removable tienen codigo y texto propio', () => {
    expect(ERROR_CODES).toContain('duplicate_order_recipe')
    expect(ERROR_CODES).toContain('order_line_not_removable')
    expect(new OrderLineNotRemovableError().message).toBe(errorMessage('order_line_not_removable'))
    expect(errorMessage('duplicate_order_recipe')).not.toBe(errorMessage('order_line_not_removable'))
  })
})

describe('linea no editable con cambios', () => {
  function lineaGuardada(overrides: Partial<ComparableOrderLine> = {}): ComparableOrderLine {
    return {
      recipeId: RECETA_X,
      quantity: '10.0000',
      unitId: UNIDAD,
      salePrice: '12.5000',
      presentationLines: [
        { presentationId: PRES, packages: 4, presentationContent: '2.5000', packagingProductId: ENVASE },
      ],
      ...overrides,
    }
  }

  const sinCambios = {
    recipeId: RECETA_X,
    quantity: '10',
    unitId: UNIDAD,
    salePrice: '12.5',
    presentationLines: [{ packagingProductId: ENVASE, packages: 4 }],
  }

  it('R24: la misma linea escrita de otra forma no es un cambio', () => {
    expect(isUnchangedOrderLine(lineaGuardada(), sinCambios)).toBe(true)
  })

  it('R24: cambiar receta, cantidad, unidad, precio o reparto es un cambio', () => {
    expect(isUnchangedOrderLine(lineaGuardada(), { ...sinCambios, recipeId: VERSION_X })).toBe(false)
    expect(isUnchangedOrderLine(lineaGuardada(), { ...sinCambios, quantity: '11' })).toBe(false)
    expect(isUnchangedOrderLine(lineaGuardada(), { ...sinCambios, unitId: AJENA })).toBe(false)
    expect(isUnchangedOrderLine(lineaGuardada(), { ...sinCambios, salePrice: null })).toBe(false)
    expect(isUnchangedOrderLine(lineaGuardada(), { ...sinCambios, presentationLines: [] })).toBe(false)
    expect(isUnchangedOrderLine(lineaGuardada({ unitId: null }), sinCambios)).toBe(false)
  })

  it('R24: una linea en estado no editable con cambios rechaza con invalid_transition', () => {
    for (const status of ['POR_EMPACAR', 'TERMINADO', 'ENTREGADO', 'CANCELADO'] as const) {
      expect(() => assertOrderLineEditable(status, true), status).toThrow(InvalidTransitionError)
    }
  })

  it('R24: una linea en estado no editable sin cambios no impide la edicion', () => {
    for (const status of LINE_STATUSES) {
      expect(() => assertOrderLineEditable(status, false), status).not.toThrow()
    }
  })

  it('R24: una linea editable con cambios se admite', () => {
    for (const status of ['PENDIENTE', 'EN_CURSO', 'BLOQUEADO'] as const) {
      expect(() => assertOrderLineEditable(status, true), status).not.toThrow()
    }
  })
})
