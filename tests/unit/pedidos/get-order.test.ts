// QC-172 T9 — La ficha del pedido con una version de receta: nombre mostrado y `recipeVersion`.
// Los dobles filtran por los ids pedidos, como los catalogos de verdad.

import { describe, expect, it, vi } from 'vitest'

import { OrderNotFoundError, UnauthorizedError } from '@/lib/modules/pedidos/domain/errors'
import { createGetOrder, toOrderView } from '@/lib/modules/pedidos/domain/get-order'

import type { Actor } from '@/lib/modules/pedidos/domain/actor'
import type { OrderRow } from '@/lib/modules/pedidos/domain/order-view'
import type { OrderRepository } from '@/lib/modules/pedidos/ports/order-repository'
import type { CustomerRef } from '@/lib/modules/clientes'
import type { PresentationCatalog } from '@/lib/modules/inventario'
import type { RecipeCatalog, RecipeRef } from '@/lib/modules/recetas'
import type { UnitCatalog } from '@/lib/modules/unidades'
import { fakePackagingCatalog, packagingRef } from '../../helpers/packaging-catalog-double'

const COMPANY = '33333333-3333-4333-8333-333333333333'
const ADMIN: Actor = { id: 'admin-1', companyId: COMPANY, permissions: ['pedidos.consultar'] }

const ORDER_ID = '11111111-1111-4111-8111-111111111111'
const ORIGINAL = '22222222-2222-4222-8222-222222222222'
const VERSION = '55555555-5555-4555-8555-555555555555'

const REF_ORIGINAL: RecipeRef = {
  id: ORIGINAL,
  name: 'Crema base',
  ownName: 'Crema base',
  isDeleted: false,
  isUnderReview: false,
  original: null,
  imageUrl: null,
}
const REF_VERSION: RecipeRef = {
  id: VERSION,
  name: 'Crema base · Sin perfume',
  ownName: 'Sin perfume',
  isDeleted: false,
  isUnderReview: false,
  original: { id: ORIGINAL, name: 'Crema base' },
  imageUrl: null,
}

function fila(recipeId: string): OrderRow {
  return {
    id: ORDER_ID,
    number: { year: 2026, sequence: 7 },
    recipeId,
    quantity: '10.0000',
    priority: 'BAJA',
    status: 'PENDIENTE',
    cancellationReason: null,
    ingredientsCost: null,
    packagingCost: null,
    actualCost: null,
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    updatedAt: new Date('2026-01-02T03:04:05.000Z'),
    createdBy: 'admin-0',
    updatedBy: 'admin-0',
    presentationLines: [],
    unitId: null,
    customerId: null,
  }
}

function dobles(
  row: OrderRow | null,
  refs: readonly RecipeRef[] = [REF_ORIGINAL, REF_VERSION],
  customerRefs: readonly CustomerRef[] = [],
) {
  const findRefsIncludingDeleted = vi.fn(async (ids: readonly string[], companyId: string) => {
    void companyId
    return refs.filter((ref) => ids.includes(ref.id))
  })
  const findRefs = vi.fn(async () => [])
  const findCustomerRefs = vi.fn(async (ids: readonly string[], companyId: string) => {
    void companyId
    return customerRefs.filter((ref) => ids.includes(ref.id))
  })
  return {
    customerCatalog: { findRefsIncludingDeleted: findCustomerRefs },
    findCustomerRefs,
    orders: { findAliveById: vi.fn(async () => row) } as unknown as OrderRepository,
    recipes: { findRefsIncludingDeleted } as unknown as RecipeCatalog,
    presentations: { findRefs } as unknown as PresentationCatalog,
    packaging: fakePackagingCatalog(),
    units: { findRefs: vi.fn(async () => []) } as unknown as UnitCatalog,
    findRefsIncludingDeleted,
  }
}

describe('getOrder — pedido con version de receta', () => {
  it('R11: la ficha de un pedido con version da el nombre compuesto y recipeVersion con original y version', async () => {
    const d = dobles(fila(VERSION))

    const vista = await createGetOrder(d)(ORDER_ID, ADMIN)

    expect(vista.recipeId).toBe(VERSION)
    expect(vista.recipeName).toBe('Crema base · Sin perfume')
    expect(vista.recipeVersion).toEqual({
      originalId: ORIGINAL,
      originalName: 'Crema base',
      versionName: 'Sin perfume',
    })
    expect(d.findRefsIncludingDeleted).toHaveBeenCalledTimes(1)
    expect(d.findRefsIncludingDeleted).toHaveBeenCalledWith([VERSION], COMPANY)
  })

  it('R11: la ficha de un pedido con original sigue dando su nombre y recipeVersion null', async () => {
    const vista = await createGetOrder(dobles(fila(ORIGINAL)))(ORDER_ID, ADMIN)

    expect(vista.recipeName).toBe('Crema base')
    expect(vista.recipeVersion).toBeNull()
  })

  it('R25: una version dada de baja sigue saliendo con su nombre compuesto', async () => {
    const vista = await createGetOrder(dobles(fila(VERSION), [{ ...REF_VERSION, isDeleted: true }]))(
      ORDER_ID,
      ADMIN,
    )

    expect(vista.recipeName).toBe('Crema base · Sin perfume')
    expect(vista.recipeVersion?.versionName).toBe('Sin perfume')
  })

  it('si el id no vuelve del catalogo, nombre y recipeVersion son null', async () => {
    const vista = await createGetOrder(dobles(fila(VERSION), []))(ORDER_ID, ADMIN)

    expect(vista.recipeName).toBeNull()
    expect(vista.recipeVersion).toBeNull()
  })

  it('un pedido que no existe sigue respondiendo no encontrado sin preguntar al catalogo', async () => {
    const d = dobles(null)

    await expect(createGetOrder(d)(ORDER_ID, ADMIN)).rejects.toBeInstanceOf(OrderNotFoundError)
    expect(d.findRefsIncludingDeleted).not.toHaveBeenCalled()
    expect(d.findCustomerRefs).not.toHaveBeenCalled()
  })
})

describe('getOrder — el cliente del pedido (QC-156)', () => {
  const CLIENTE = '99999999-9999-4999-8999-999999999999'
  const REF_CLIENTE: CustomerRef = { id: CLIENTE, firstNames: 'Ana Maria', lastNames: 'Perez Soto', isDeleted: false }

  it('R19: la ficha trae el cliente como id, nombre y marca de baja, con una sola llamada', async () => {
    const d = dobles({ ...fila(ORIGINAL), customerId: CLIENTE }, undefined, [REF_CLIENTE])

    const vista = await createGetOrder(d)(ORDER_ID, ADMIN)

    expect(vista.customer).toEqual({ id: CLIENTE, name: 'Ana Maria Perez Soto', isDeleted: false })
    expect(d.findCustomerRefs).toHaveBeenCalledTimes(1)
    expect(d.findCustomerRefs).toHaveBeenCalledWith([CLIENTE], COMPANY)
  })

  it('R20: un cliente dado de baja sigue saliendo con su nombre y isDeleted', async () => {
    const d = dobles({ ...fila(ORIGINAL), customerId: CLIENTE }, undefined, [{ ...REF_CLIENTE, isDeleted: true }])

    const vista = await createGetOrder(d)(ORDER_ID, ADMIN)

    expect(vista.customer).toEqual({ id: CLIENTE, name: 'Ana Maria Perez Soto', isDeleted: true })
  })

  it('R21: un pedido sin cliente no consulta el catalogo de clientes y sale con customer null', async () => {
    const d = dobles(fila(ORIGINAL))

    const vista = await createGetOrder(d)(ORDER_ID, ADMIN)

    expect(vista.customer).toBeNull()
    expect(d.findCustomerRefs).not.toHaveBeenCalled()
  })

  it('R19: un id que no vuelve del catalogo se pinta sin cliente y la ficha sigue saliendo', async () => {
    const d = dobles({ ...fila(ORIGINAL), customerId: CLIENTE }, undefined, [])

    const vista = await createGetOrder(d)(ORDER_ID, ADMIN)

    expect(vista.customer).toBeNull()
    expect(vista.id).toBe(ORDER_ID)
  })
})

describe('toOrderView — recibe el Map de RecipeRef', () => {
  it('R11: compone recipeVersion desde la referencia y no desde la fila', () => {
    const vista = toOrderView(fila(VERSION), new Map([[VERSION, REF_VERSION]]))

    expect(vista.recipeName).toBe('Crema base · Sin perfume')
    expect(vista.recipeVersion).toEqual({
      originalId: ORIGINAL,
      originalName: 'Crema base',
      versionName: 'Sin perfume',
    })
  })
})

describe('QC-195 R33 — la ficha y el listado nombran el envase de cada linea', () => {
  const PRESENTACION_ANTIGUA = '66666666-6666-4666-8666-666666666666'
  const PRESENTACION_ENVASE = '77777777-7777-4777-8777-777777777777'
  const ENVASE = 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1'
  const ENVASE_DE_BAJA = 'e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2'

  function filaConReparto(): OrderRow {
    return {
      ...fila(ORIGINAL),
      presentationLines: [
        { presentationId: PRESENTACION_ANTIGUA, packages: 3, packagingProductId: null, presentationContent: null },
        { presentationId: PRESENTACION_ENVASE, packages: 40, packagingProductId: ENVASE, presentationContent: null },
        { presentationId: '88888888-8888-4888-8888-888888888888', packages: 1, packagingProductId: ENVASE_DE_BAJA, presentationContent: null },
      ],
    }
  }

  it('R33: la linea antigua sale con su presentacion y envase null; la de envase, con su id y su nombre', async () => {
    const packaging = fakePackagingCatalog([packagingRef({ id: ENVASE, name: 'Botella PET 500 ml' })])
    const d = { ...dobles(filaConReparto()), packaging }

    const vista = await createGetOrder(d)(ORDER_ID, ADMIN)

    expect(vista.presentationLines.map((line) => [line.packagingProductId, line.packagingName])).toEqual([
      [null, null],
      [ENVASE, 'Botella PET 500 ml'],
      // Un envase que ya no vuelve del catalogo conserva su id y se queda sin nombre.
      [ENVASE_DE_BAJA, null],
    ])
    expect(vista.presentationLines[0]?.presentationId).toBe(PRESENTACION_ANTIGUA)
    expect(packaging.findRefs).toHaveBeenCalledTimes(1)
    expect(packaging.findRefs).toHaveBeenCalledWith([ENVASE, ENVASE_DE_BAJA], COMPANY)
  })

  it('R33: un pedido solo con lineas antiguas no consulta el catalogo de envases', async () => {
    const packaging = fakePackagingCatalog()
    const d = {
      ...dobles({
        ...fila(ORIGINAL),
        presentationLines: [{ presentationId: PRESENTACION_ANTIGUA, packages: 3, packagingProductId: null, presentationContent: null }],
      }),
      packaging,
    }

    const vista = await createGetOrder(d)(ORDER_ID, ADMIN)

    expect(vista.presentationLines).toHaveLength(1)
    expect(packaging.findRefs).not.toHaveBeenCalled()
  })

  it('R33: toOrderView sin nombres de envase deja packagingName en null y conserva el id', () => {
    const vista = toOrderView(filaConReparto(), new Map([[ORIGINAL, REF_ORIGINAL]]))

    expect(vista.presentationLines[1]).toMatchObject({ packagingProductId: ENVASE, packagingName: null })
  })
})

describe('la ficha lleva el contenido y la unidad de la presentacion de cada linea', () => {
  const LITRO = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'
  const MILILITRO = 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2'
  const BOTELLA = '66666666-6666-4666-8666-666666666666'
  const GARRAFA = '77777777-7777-4777-8777-777777777777'
  const PERDIDA = '88888888-8888-4888-8888-888888888888'

  it('la copia de la linea manda; sin copia vale la vigente; la etiqueta es la de la unidad de la presentacion', async () => {
    const row: OrderRow = {
      ...fila(ORIGINAL),
      unitId: LITRO,
      presentationLines: [
        { presentationId: BOTELLA, packages: 9, packagingProductId: null, presentationContent: '300.0000' },
        { presentationId: GARRAFA, packages: 2, packagingProductId: null, presentationContent: null },
        { presentationId: PERDIDA, packages: 1, packagingProductId: null, presentationContent: '5.0000' },
      ],
    }
    const unitsFindRefs = vi.fn(async () => [
      { id: LITRO, name: 'Litro', symbol: 'L', baseUnitId: null, factor: null },
      { id: MILILITRO, name: 'Mililitro', symbol: 'ml', baseUnitId: LITRO, factor: '0.001' },
    ])
    const d = {
      ...dobles(row),
      presentations: {
        findRefs: vi.fn(async () => [
          { id: BOTELLA, name: 'Botella 300', content: '250.0000', unitId: MILILITRO },
          { id: GARRAFA, name: 'Garrafa 5 L', content: '5.0000', unitId: LITRO },
        ]),
      } as unknown as PresentationCatalog,
      units: { findRefs: unitsFindRefs } as unknown as UnitCatalog,
    }

    const vista = await createGetOrder(d)(ORDER_ID, ADMIN)

    expect(vista.presentationLines.map((line) => [line.presentationContent, line.presentationUnitLabel])).toEqual([
      ['300.0000', 'ml'],
      ['5.0000', 'L'],
      // La presentacion no vuelve: conserva la copia de la linea, pero sin unidad no hay etiqueta.
      ['5.0000', null],
    ])
    expect(vista.unitLabel).toBe('L')
    // La unidad del pedido y las de las presentaciones, en una sola llamada y sin repetir.
    expect(unitsFindRefs).toHaveBeenCalledTimes(1)
    expect(unitsFindRefs).toHaveBeenCalledWith([LITRO, MILILITRO], COMPANY)
  })

  it('toOrderView sin presentaciones resueltas deja contenido de la copia y unidad en null', () => {
    const vista = toOrderView(
      { ...fila(ORIGINAL), presentationLines: [{ presentationId: BOTELLA, packages: 1, packagingProductId: null, presentationContent: null }] },
      new Map([[ORIGINAL, REF_ORIGINAL]]),
    )

    expect(vista.presentationLines[0]).toMatchObject({ presentationContent: null, presentationUnitLabel: null })
  })
})

describe('la ficha lleva la imagen de la receta', () => {
  it('la de la receta del pedido; sin receta en el catalogo, null', async () => {
    const conImagen = dobles(fila(VERSION), [{ ...REF_VERSION, imageUrl: 'https://cdn.test/recetas/crema.png' }])

    expect((await createGetOrder(conImagen)(ORDER_ID, ADMIN)).recipeImageUrl).toBe('https://cdn.test/recetas/crema.png')
    expect((await createGetOrder(dobles(fila(VERSION), []))(ORDER_ID, ADMIN)).recipeImageUrl).toBeNull()
  })
})

describe('getOrder — el importe y su parte de envases', () => {
  it('la ficha devuelve ingredientsCost y packagingCost tal como vienen de la fila', async () => {
    const conImporte = { ...fila(ORIGINAL), ingredientsCost: '30.0000', packagingCost: '4.5000' }

    const vista = await createGetOrder(dobles(conImporte))(ORDER_ID, ADMIN)

    expect(vista.ingredientsCost).toBe('30.0000')
    expect(vista.packagingCost).toBe('4.5000')
  })

  it('sin importe, los dos salen null y no "0.0000"', async () => {
    const vista = await createGetOrder(dobles(fila(ORIGINAL)))(ORDER_ID, ADMIN)

    expect(vista.ingredientsCost).toBeNull()
    expect(vista.packagingCost).toBeNull()
  })
})

// QC-305 T6 — el coste real sale por la ficha, que exige `pedidos.consultar`, y por ninguna otra
// puerta: sin el permiso, el rechazo llega antes que el repositorio y los catalogos.
describe('QC-305 — getOrder: el coste real y quien lo ve (R24)', () => {
  it('R24: con pedidos.consultar la ficha trae actualCost como cadena de 4 decimales, tal como viene de la fila', async () => {
    const d = dobles({ ...fila(ORIGINAL), status: 'TERMINADO', ingredientsCost: '30.0000', actualCost: '27.1250' })

    const vista = await createGetOrder(d)(ORDER_ID, ADMIN)

    expect(vista.actualCost).toBe('27.1250')
    expect(vista.actualCost).toMatch(/^\d+\.\d{4}$/)
    // El real no pisa el estimado: los dos viajan juntos y distintos.
    expect(vista.ingredientsCost).toBe('30.0000')
  })

  it('R24: un pedido sin coste real sale con actualCost null, no "0.0000" ni ausente', async () => {
    const vista = await createGetOrder(dobles(fila(ORIGINAL)))(ORDER_ID, ADMIN)

    expect(vista).toHaveProperty('actualCost')
    expect(vista.actualCost).toBeNull()
  })

  for (const [etiqueta, actor] of [
    ['un actor sin pedidos.consultar', { id: 'operador-1', companyId: COMPANY, permissions: ['asignaciones.consultar'] }],
    ['un actor ausente', null],
  ] as const) {
    it(`R24: ${etiqueta} se rechaza como hoy, sin llegar al repositorio ni a los catalogos`, async () => {
      const d = dobles({ ...fila(ORIGINAL), actualCost: '27.1250' })

      await expect(createGetOrder(d)(ORDER_ID, actor)).rejects.toBeInstanceOf(UnauthorizedError)
      expect(d.orders.findAliveById).not.toHaveBeenCalled()
      expect(d.findRefsIncludingDeleted).not.toHaveBeenCalled()
      expect(d.findCustomerRefs).not.toHaveBeenCalled()
    })
  }
})
