// El excedente de una pagina del listado: el caso de uso contra dobles de sus puertos.

import { describe, expect, it, vi } from 'vitest'

import { ROLE_ADMINISTRADOR, SEED_ROLE_PERMISSIONS } from '@/lib/modules/identity'
import { DIRECT_DELIVERY_SURPLUS_MAX_PRODUCTS } from '@/lib/modules/pedidos/domain/direct-delivery'
import {
  createListDirectDeliverySurplus,
  type ListDirectDeliverySurplusDeps,
} from '@/lib/modules/pedidos/domain/list-direct-delivery-surplus'

import type { FinishedProductSurplusBase } from '@/lib/modules/inventario'
import type { Actor } from '@/lib/modules/pedidos/domain/actor'
import type { PedidosError } from '@/lib/modules/pedidos/domain/errors'
import type { WaitingOrderLineOfPair, WaitingOrderPair } from '@/lib/modules/pedidos/ports/direct-delivery-repository'

const EMPRESA = '33333333-3333-4333-8333-333333333333'
const SCOPE = { companyId: EMPRESA }
const RECETA = '22222222-2222-4222-8222-222222222222'
const OTRA_RECETA = '22222222-2222-4222-8222-222222222223'
const PRESENTACION = 'f0000000-0000-4000-8000-000000000288'

const ENTREGADOR: Actor = { id: 'u-entrega', companyId: EMPRESA, permissions: ['entregas.modificar'] }

function productId(i: number): string {
  return `a0000000-0000-4000-8000-${String(i).padStart(12, '0')}`
}

/** El producto `i` es de la receta `RECETA` si es par y de `OTRA_RECETA` si es impar; 10 envases. */
function base(id: string, i: number): FinishedProductSurplusBase {
  return { productId: id, recipeId: i % 2 === 0 ? RECETA : OTRA_RECETA, presentationId: PRESENTACION, stockPackages: 10 }
}

/** A la receta par le esperan 4; a la impar, 15 (mas de lo que hay). */
const LINEAS: readonly WaitingOrderLineOfPair[] = [
  { orderId: 'o-1', numberText: '2026-0000001', orderedPackages: 4, deliveredPackages: 0, recipeId: RECETA, presentationId: PRESENTACION },
  { orderId: 'o-2', numberText: '2026-0000002', orderedPackages: 20, deliveredPackages: 5, recipeId: OTRA_RECETA, presentationId: PRESENTACION },
]

function montar(opciones: { bases?: (ids: readonly string[]) => readonly FinishedProductSurplusBase[] } = {}) {
  const findSurplusBases = vi.fn(async (ids: readonly string[]) => (opciones.bases ?? ((xs) => xs.map(base)))(ids))
  const listWaitingLines = vi.fn<(pairs: readonly WaitingOrderPair[], scope: unknown) => Promise<readonly WaitingOrderLineOfPair[]>>(async () => LINEAS)
  const deps: ListDirectDeliverySurplusDeps = { catalog: { findSurplusBases }, waiting: { listWaitingLines } }
  return { deps, findSurplusBases, listWaitingLines }
}

async function codigoDelFallo(operacion: () => Promise<unknown>): Promise<string> {
  const error = await operacion().then(
    () => null,
    (e: unknown) => e,
  )
  expect(error, 'la operacion tenia que fallar').not.toBeNull()
  return (error as PedidosError).code
}

describe('listDirectDeliverySurplus — acceso (R2, R4)', () => {
  it('R2: sin entregas.modificar responde unauthorized antes de validar y sin leer nada', async () => {
    const m = montar()
    const listar = createListDirectDeliverySurplus(m.deps)
    for (const actor of [null, undefined, { ...ENTREGADOR, permissions: [] }, { ...ENTREGADOR, permissions: ['entregas.anular'] }]) {
      expect(await codigoDelFallo(() => listar([productId(1)], actor))).toBe('unauthorized')
      expect(await codigoDelFallo(() => listar('basura', actor))).toBe('unauthorized')
    }
    expect(m.findSurplusBases).not.toHaveBeenCalled()
    expect(m.listWaitingLines).not.toHaveBeenCalled()
  })

  it('R4: un actor con el permiso y otro rol es aceptado; un Administrador sin el permiso es rechazado', async () => {
    const m = montar()
    const listar = createListDirectDeliverySurplus(m.deps)
    await expect(listar([productId(0)], { id: 'u-bodega', companyId: EMPRESA, permissions: ['inventario.consultar', 'entregas.modificar'] })).resolves.toEqual(
      new Map([[productId(0), 6]]),
    )
    const delAdministrador = [...SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]]
    const adminSinPermiso: Actor = { id: 'u-admin', companyId: EMPRESA, permissions: delAdministrador.filter((p) => p !== 'entregas.modificar') }
    expect(await codigoDelFallo(() => listar([productId(0)], adminSinPermiso))).toBe('unauthorized')
  })
})

describe('listDirectDeliverySurplus — forma (R8)', () => {
  const invalidas: ReadonlyArray<readonly [string, unknown]> = [
    ['no es una lista', productId(1)],
    ['un id sin forma de uuid', [productId(1), 'producto']],
    ['mas productos que el tope', Array.from({ length: DIRECT_DELIVERY_SURPLUS_MAX_PRODUCTS + 1 }, (_, i) => productId(i))],
  ]
  for (const [caso, valor] of invalidas) {
    it(`R8: ${caso} responde invalid_input sin leer nada`, async () => {
      const m = montar()
      expect(await codigoDelFallo(() => createListDirectDeliverySurplus(m.deps)(valor, ENTREGADOR))).toBe('invalid_input')
      expect(m.findSurplusBases).not.toHaveBeenCalled()
    })
  }

  it('R8: con la lista vacia devuelve un mapa vacio sin consultar', async () => {
    const m = montar()
    await expect(createListDirectDeliverySurplus(m.deps)([], ENTREGADOR)).resolves.toEqual(new Map())
    expect(m.findSurplusBases).not.toHaveBeenCalled()
    expect(m.listWaitingLines).not.toHaveBeenCalled()
  })
})

describe('listDirectDeliverySurplus — dos lecturas por pagina (R8)', () => {
  for (const filas of [1, 25, DIRECT_DELIVERY_SURPLUS_MAX_PRODUCTS]) {
    it(`R8: con ${String(filas)} productos son una lectura del catalogo y una de los pedidos`, async () => {
      const m = montar()
      const ids = Array.from({ length: filas }, (_, i) => productId(i))
      const surplus = await createListDirectDeliverySurplus(m.deps)(ids, ENTREGADOR)

      expect(m.findSurplusBases).toHaveBeenCalledTimes(1)
      expect(m.findSurplusBases).toHaveBeenCalledWith(ids, EMPRESA)
      expect(m.listWaitingLines).toHaveBeenCalledTimes(1)
      expect(surplus.size).toBe(filas)
    })
  }

  it('R8: los pares que pide a los pedidos son los distintos de la pagina', async () => {
    const m = montar()
    await createListDirectDeliverySurplus(m.deps)([productId(0), productId(1), productId(2), productId(3)], ENTREGADOR)
    expect(m.listWaitingLines).toHaveBeenCalledWith(
      [
        { recipeId: RECETA, presentationId: PRESENTACION },
        { recipeId: OTRA_RECETA, presentationId: PRESENTACION },
      ],
      SCOPE,
    )
  })

  it('R8: los ids repetidos se piden una vez', async () => {
    const m = montar()
    await createListDirectDeliverySurplus(m.deps)([productId(0), productId(0)], ENTREGADOR)
    expect(m.findSurplusBases).toHaveBeenCalledWith([productId(0)], EMPRESA)
  })
})

describe('listDirectDeliverySurplus — el mapa (R9)', () => {
  it('R9: cada producto resta solo lo que esperan los pedidos de su receta y presentacion, sin bajar de cero', async () => {
    const m = montar()
    const surplus = await createListDirectDeliverySurplus(m.deps)([productId(0), productId(1)], ENTREGADOR)
    expect(surplus).toEqual(
      new Map([
        [productId(0), 6],
        [productId(1), 0],
      ]),
    )
  })

  it('R9: un id que no vuelve del catalogo no aparece en el mapa', async () => {
    const m = montar({ bases: (ids) => ids.slice(0, 1).map(base) })
    const surplus = await createListDirectDeliverySurplus(m.deps)([productId(0), productId(1)], ENTREGADOR)
    expect([...surplus.keys()]).toEqual([productId(0)])
  })

  it('R9: un producto sin receta ni presentacion tiene todo su stock de excedente, y sin pares no se consultan los pedidos', async () => {
    const m = montar({ bases: (ids) => ids.map((id) => ({ productId: id, recipeId: null, presentationId: null, stockPackages: 7 })) })
    await expect(createListDirectDeliverySurplus(m.deps)([productId(0)], ENTREGADOR)).resolves.toEqual(new Map([[productId(0), 7]]))
    expect(m.listWaitingLines).not.toHaveBeenCalled()
  })
})
