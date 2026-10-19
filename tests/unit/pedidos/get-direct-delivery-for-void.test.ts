// Lo que lee el dialogo de anular una entrega sin pedido: el caso de uso contra dobles de sus puertos.

import { describe, expect, it, vi } from 'vitest'

import { ROLE_ADMINISTRADOR, SEED_ROLE_PERMISSIONS } from '@/lib/modules/identity'
import {
  createGetDirectDeliveryForVoid,
  type GetDirectDeliveryForVoidDeps,
} from '@/lib/modules/pedidos/domain/get-direct-delivery-for-void'
import {
  DIRECT_DELIVERY_ID,
  DIRECT_FIRST_CUSTOMER_ID,
  DIRECT_NEWER_BATCH_ID,
  DIRECT_OLDER_BATCH_ID,
  DIRECT_PRODUCT_ID,
  DIRECT_SECOND_CUSTOMER_ID,
  directDeliveryVoidView,
} from '@/tests/fixtures/direct-delivery'

import type { CustomerRef } from '@/lib/modules/clientes'
import type { FinishedProductForDelivery } from '@/lib/modules/inventario'
import type { Actor } from '@/lib/modules/pedidos/domain/actor'
import type { PedidosError } from '@/lib/modules/pedidos/domain/errors'
import type { DeliveryForVoid, DeliveryLineForVoid } from '@/lib/modules/pedidos/ports/order-delivery-void-repository'

const EMPRESA = '33333333-3333-4333-8333-333333333333'
const SCOPE = { companyId: EMPRESA }
const ANULADO = 'c0000000-0000-4000-8000-000000000290'
const MISMO_NOMBRE = 'c0000000-0000-4000-8000-000000000287'

const ANULADOR: Actor = { id: 'u-anula', companyId: EMPRESA, permissions: ['entregas.anular'] }

const ENTREGA: DeliveryForVoid = {
  id: DIRECT_DELIVERY_ID,
  orderId: null,
  productId: DIRECT_PRODUCT_ID,
  createdAt: new Date('2026-10-16T10:30:00.000Z'),
}

function linea(id: string, customerId: string, batchId: string, packages: number, voided = false): DeliveryLineForVoid {
  return { id, customerId, presentationLineId: null, batchId, packages, quantity: `${String(packages)}.0000`, voided }
}

/** Bruno con una linea, Ana en dos lotes (3 + 1), y un tercero ya anulado. */
const LINEAS: readonly DeliveryLineForVoid[] = [
  linea('l-1', DIRECT_SECOND_CUSTOMER_ID, DIRECT_OLDER_BATCH_ID, 2),
  linea('l-2', DIRECT_FIRST_CUSTOMER_ID, DIRECT_OLDER_BATCH_ID, 3),
  linea('l-3', DIRECT_FIRST_CUSTOMER_ID, DIRECT_NEWER_BATCH_ID, 1),
  linea('l-4', ANULADO, DIRECT_OLDER_BATCH_ID, 5, true),
]

const REFS: readonly CustomerRef[] = [
  { id: DIRECT_FIRST_CUSTOMER_ID, firstNames: 'Ana', lastNames: 'Perez', isDeleted: false },
  { id: DIRECT_SECOND_CUSTOMER_ID, firstNames: 'Bruno', lastNames: 'Diaz', isDeleted: true },
  { id: ANULADO, firstNames: 'Carla', lastNames: 'Ruiz', isDeleted: false },
  { id: MISMO_NOMBRE, firstNames: 'Ana', lastNames: 'Perez', isDeleted: false },
]

const PRODUCTO = { presentationName: 'Botella 1 L' } as FinishedProductForDelivery

function montar(opciones: { entrega?: DeliveryForVoid | null; lineas?: readonly DeliveryLineForVoid[]; producto?: FinishedProductForDelivery | null } = {}) {
  const findDelivery = vi.fn(async () => (opciones.entrega === undefined ? ENTREGA : opciones.entrega))
  const findDeliveryLines = vi.fn(async () => opciones.lineas ?? LINEAS)
  const findForDelivery = vi.fn(async () => (opciones.producto === undefined ? PRODUCTO : opciones.producto))
  const findRefsIncludingDeleted = vi.fn(async (ids: readonly string[]) => REFS.filter((ref) => ids.includes(ref.id)))
  const deps: GetDirectDeliveryForVoidDeps = {
    voids: { findDelivery, findDeliveryLines },
    catalog: { findForDelivery },
    customerCatalog: { findRefsIncludingDeleted },
  }
  return { deps, findDelivery, findDeliveryLines, findForDelivery, findRefsIncludingDeleted }
}

async function codigoDelFallo(operacion: () => Promise<unknown>): Promise<string> {
  const error = await operacion().then(
    () => null,
    (e: unknown) => e,
  )
  expect(error, 'la operacion tenia que fallar').not.toBeNull()
  return (error as PedidosError).code
}

describe('getDirectDeliveryForVoid — acceso (R3, R4)', () => {
  it('R3: sin entregas.anular responde unauthorized antes de validar el id y sin leer nada', async () => {
    const m = montar()
    const leer = createGetDirectDeliveryForVoid(m.deps)
    for (const actor of [null, undefined, { ...ANULADOR, permissions: [] }, { ...ANULADOR, permissions: ['entregas.modificar'] }]) {
      expect(await codigoDelFallo(() => leer(DIRECT_DELIVERY_ID, actor))).toBe('unauthorized')
      expect(await codigoDelFallo(() => leer('entrega', actor))).toBe('unauthorized')
    }
    expect(m.findDelivery).not.toHaveBeenCalled()
  })

  it('R4: un actor con el permiso y otro rol es aceptado; un Administrador sin el permiso es rechazado', async () => {
    const m = montar()
    const leer = createGetDirectDeliveryForVoid(m.deps)
    await expect(leer(DIRECT_DELIVERY_ID, { id: 'u-bodega', companyId: EMPRESA, permissions: ['entregas.anular'] })).resolves.toMatchObject({
      deliveryId: DIRECT_DELIVERY_ID,
    })
    const delAdministrador = [...SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]]
    expect(delAdministrador).toContain('entregas.anular')
    const adminSinPermiso: Actor = { id: 'u-admin', companyId: EMPRESA, permissions: delAdministrador.filter((p) => p !== 'entregas.anular') }
    expect(await codigoDelFallo(() => leer(DIRECT_DELIVERY_ID, adminSinPermiso))).toBe('unauthorized')
  })
})

describe('getDirectDeliveryForVoid — la entrega (R48)', () => {
  it('R48: un id sin forma de uuid responde delivery_not_found sin leer nada', async () => {
    const m = montar()
    expect(await codigoDelFallo(() => createGetDirectDeliveryForVoid(m.deps)('entrega', ANULADOR))).toBe('delivery_not_found')
    expect(m.findDelivery).not.toHaveBeenCalled()
  })

  it('R48: una entrega ausente, de otra empresa o de pedido responde delivery_not_found sin leer sus lineas', async () => {
    for (const entrega of [null, { ...ENTREGA, orderId: 'd0000000-0000-4000-8000-000000000001', productId: null }]) {
      const m = montar({ entrega })
      expect(await codigoDelFallo(() => createGetDirectDeliveryForVoid(m.deps)(DIRECT_DELIVERY_ID, ANULADOR))).toBe('delivery_not_found')
      expect(m.findDelivery).toHaveBeenCalledWith(DIRECT_DELIVERY_ID, SCOPE)
      expect(m.findDeliveryLines).not.toHaveBeenCalled()
    }
  })
})

describe('getDirectDeliveryForVoid — la vista (R44)', () => {
  it('R44: fecha, presentacion y los clientes con su parte sin anular, por nombre y con sus envases', async () => {
    const m = montar()
    await expect(createGetDirectDeliveryForVoid(m.deps)(DIRECT_DELIVERY_ID, ANULADOR)).resolves.toEqual(
      directDeliveryVoidView({
        customers: [
          { customerId: DIRECT_FIRST_CUSTOMER_ID, customerName: 'Ana Perez', packages: 4 },
          { customerId: DIRECT_SECOND_CUSTOMER_ID, customerName: 'Bruno Diaz', packages: 2 },
        ],
      }),
    )
    expect(m.findForDelivery).toHaveBeenCalledWith(DIRECT_PRODUCT_ID, EMPRESA)
    expect(m.findRefsIncludingDeleted).toHaveBeenCalledWith([DIRECT_SECOND_CUSTOMER_ID, DIRECT_FIRST_CUSTOMER_ID], EMPRESA)
  })

  it('R44: con el mismo nombre desempata por id', async () => {
    const m = montar({ lineas: [linea('l-1', DIRECT_FIRST_CUSTOMER_ID, DIRECT_OLDER_BATCH_ID, 1), linea('l-2', MISMO_NOMBRE, DIRECT_OLDER_BATCH_ID, 1)] })
    const vista = await createGetDirectDeliveryForVoid(m.deps)(DIRECT_DELIVERY_ID, ANULADOR)
    expect(vista.customers.map((c) => c.customerId)).toEqual([MISMO_NOMBRE, DIRECT_FIRST_CUSTOMER_ID])
  })

  it('R44: con el producto dado de baja sale sin presentacion', async () => {
    const m = montar({ producto: null })
    await expect(createGetDirectDeliveryForVoid(m.deps)(DIRECT_DELIVERY_ID, ANULADOR)).resolves.toMatchObject({ presentationName: null })
  })

  it('R44: si todos los clientes estan anulados la lista sale vacia y no se piden nombres', async () => {
    const m = montar({ lineas: [linea('l-4', ANULADO, DIRECT_OLDER_BATCH_ID, 5, true)] })
    await expect(createGetDirectDeliveryForVoid(m.deps)(DIRECT_DELIVERY_ID, ANULADOR)).resolves.toMatchObject({ customers: [] })
    expect(m.findRefsIncludingDeleted).not.toHaveBeenCalled()
  })
})
