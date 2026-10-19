// Lo que lee el sheet de entrega sin pedido: el caso de uso contra dobles de sus puertos.

import { describe, expect, it, vi } from 'vitest'

import { ROLE_ADMINISTRADOR, SEED_ROLE_PERMISSIONS } from '@/lib/modules/identity'
import { createGetDirectDelivery, type GetDirectDeliveryDeps } from '@/lib/modules/pedidos/domain/get-direct-delivery'
import { DIRECT_PRODUCT_ID, directDeliveryView } from '@/tests/fixtures/direct-delivery'

import type { FinishedProductForDelivery } from '@/lib/modules/inventario'
import type { Actor } from '@/lib/modules/pedidos/domain/actor'
import type { PedidosError } from '@/lib/modules/pedidos/domain/errors'
import type { WaitingOrderLineOfPair } from '@/lib/modules/pedidos/ports/direct-delivery-repository'

const EMPRESA = '33333333-3333-4333-8333-333333333333'
const SCOPE = { companyId: EMPRESA }
const RECETA = '22222222-2222-4222-8222-222222222222'
const PRESENTACION = 'f0000000-0000-4000-8000-000000000288'
const PAR = { recipeId: RECETA, presentationId: PRESENTACION }

const ENTREGADOR: Actor = { id: 'u-entrega', companyId: EMPRESA, permissions: ['entregas.modificar'] }

const VISTA = directDeliveryView()

const PRODUCTO: FinishedProductForDelivery = {
  productId: DIRECT_PRODUCT_ID,
  name: VISTA.productName,
  recipeId: RECETA,
  presentationId: PRESENTACION,
  presentationName: VISTA.presentationName,
  stockPackages: 20,
  batches: VISTA.batches,
}

/** Desordenadas a proposito: el segundo pedido llega antes, y uno ya no espera nada. */
const LINEAS: readonly WaitingOrderLineOfPair[] = [
  { orderId: VISTA.waiting[1]!.orderId, numberText: '2026-0000034', orderedPackages: 3, deliveredPackages: 0, ...PAR },
  { orderId: VISTA.waiting[0]!.orderId, numberText: '2026-0000031', orderedPackages: 6, deliveredPackages: 1, ...PAR },
  { orderId: 'o-completo', numberText: '2026-0000030', orderedPackages: 2, deliveredPackages: 2, ...PAR },
]

function montar(opciones: { producto?: FinishedProductForDelivery | null; lineas?: readonly WaitingOrderLineOfPair[] } = {}) {
  const findForDelivery = vi.fn(async () => (opciones.producto === undefined ? PRODUCTO : opciones.producto))
  const listWaitingLines = vi.fn(async () => opciones.lineas ?? LINEAS)
  const deps: GetDirectDeliveryDeps = { catalog: { findForDelivery }, waiting: { listWaitingLines } }
  return { deps, findForDelivery, listWaitingLines }
}

async function codigoDelFallo(operacion: () => Promise<unknown>): Promise<string> {
  const error = await operacion().then(
    () => null,
    (e: unknown) => e,
  )
  expect(error, 'la operacion tenia que fallar').not.toBeNull()
  return (error as PedidosError).code
}

describe('getDirectDelivery — acceso (R2, R4)', () => {
  it('R2: sin entregas.modificar responde unauthorized antes de validar el id y sin leer nada', async () => {
    const m = montar()
    const leer = createGetDirectDelivery(m.deps)
    for (const actor of [null, undefined, { ...ENTREGADOR, permissions: [] }, { ...ENTREGADOR, permissions: ['entregas.anular'] }]) {
      expect(await codigoDelFallo(() => leer(DIRECT_PRODUCT_ID, actor))).toBe('unauthorized')
      expect(await codigoDelFallo(() => leer('no-es-uuid', actor))).toBe('unauthorized')
    }
    expect(m.findForDelivery).not.toHaveBeenCalled()
    expect(m.listWaitingLines).not.toHaveBeenCalled()
  })

  it('R4: un actor con el permiso y otro rol es aceptado; un Administrador sin el permiso es rechazado', async () => {
    const m = montar()
    const leer = createGetDirectDelivery(m.deps)
    await expect(leer(DIRECT_PRODUCT_ID, { id: 'u-bodega', companyId: EMPRESA, permissions: ['inventario.consultar', 'entregas.modificar'] })).resolves.toEqual(VISTA)

    const delAdministrador = [...SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]]
    expect(delAdministrador).toContain('entregas.modificar')
    const adminSinPermiso: Actor = { id: 'u-admin', companyId: EMPRESA, permissions: delAdministrador.filter((p) => p !== 'entregas.modificar') }
    expect(await codigoDelFallo(() => leer(DIRECT_PRODUCT_ID, adminSinPermiso))).toBe('unauthorized')
  })
})

describe('getDirectDelivery — producto (R29, R30)', () => {
  it('R29: un id sin forma de uuid responde product_not_found sin leer nada', async () => {
    const m = montar()
    expect(await codigoDelFallo(() => createGetDirectDelivery(m.deps)('producto', ENTREGADOR))).toBe('product_not_found')
    expect(m.findForDelivery).not.toHaveBeenCalled()
  })

  it('R30: un producto que no vuelve del catalogo responde product_not_found sin leer los pedidos', async () => {
    const m = montar({ producto: null })
    expect(await codigoDelFallo(() => createGetDirectDelivery(m.deps)(DIRECT_PRODUCT_ID, ENTREGADOR))).toBe('product_not_found')
    expect(m.findForDelivery).toHaveBeenCalledWith(DIRECT_PRODUCT_ID, EMPRESA)
    expect(m.listWaitingLines).not.toHaveBeenCalled()
  })
})

describe('getDirectDelivery — la vista (R9, R10)', () => {
  it('R10: 20 en stock y dos pedidos que esperan 5 y 3 dan excedente 12, con los pedidos por numero', async () => {
    const m = montar()
    await expect(createGetDirectDelivery(m.deps)(DIRECT_PRODUCT_ID, ENTREGADOR)).resolves.toEqual(VISTA)
    expect(m.listWaitingLines).toHaveBeenCalledWith([PAR], SCOPE)
  })

  it('R9: sin receta o sin presentacion no espera ningun pedido y no se consultan', async () => {
    const m = montar({ producto: { ...PRODUCTO, recipeId: null, presentationId: null } })
    const vista = await createGetDirectDelivery(m.deps)(DIRECT_PRODUCT_ID, ENTREGADOR)
    expect(vista).toMatchObject({ waiting: [], waitingPackages: 0, surplusPackages: 20 })
    expect(m.listWaitingLines).not.toHaveBeenCalled()
  })

  it('R9: si esperan mas envases de los que hay, el excedente es cero', async () => {
    const m = montar({ producto: { ...PRODUCTO, stockPackages: 5 } })
    await expect(createGetDirectDelivery(m.deps)(DIRECT_PRODUCT_ID, ENTREGADOR)).resolves.toMatchObject({
      stockPackages: 5,
      waitingPackages: 8,
      surplusPackages: 0,
    })
  })
})
