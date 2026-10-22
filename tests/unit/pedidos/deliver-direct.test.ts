// Registrar una entrega sin pedido: el caso de uso contra dobles de sus puertos. La transaccion real,
// la base y la concurrencia van en los `.int`.
//
// La unidad de trabajo doblada ejecuta el trabajo con el scope que se le da y recuerda si el trabajo
// lanzo: un error que sale de `run` es lo que, con la transaccion real, lo deshace todo.

import { describe, expect, it, vi } from 'vitest'

import { ROLE_ADMINISTRADOR, SEED_ROLE_PERMISSIONS } from '@/lib/modules/identity'
import { createDeliverDirect, type DeliverDirectDeps } from '@/lib/modules/pedidos/domain/deliver-direct'
import { DELIVERY_MAX_ALLOCATIONS } from '@/lib/modules/pedidos/domain/order-delivery'
import {
  DIRECT_DELIVERY_KEY,
  DIRECT_FIRST_CUSTOMER_ID,
  DIRECT_NEWER_BATCH_ID,
  DIRECT_OLDER_BATCH_ID,
  DIRECT_PRODUCT_ID,
  DIRECT_SECOND_CUSTOMER_ID,
  deliverDirectInput,
} from '@/tests/fixtures/direct-delivery'

import type { CustomerRef } from '@/lib/modules/clientes'
import type {
  FinishedGoodsDirectDispatchInput,
  FinishedGoodsDispatchOutcome,
  FinishedProductDeliveryLock,
  FinishedProductSurplusBase,
} from '@/lib/modules/inventario'
import type { Actor } from '@/lib/modules/pedidos/domain/actor'
import type { PedidosError } from '@/lib/modules/pedidos/domain/errors'
import type { RegisteredDelivery, WaitingOrderLineOfPair } from '@/lib/modules/pedidos/ports/direct-delivery-repository'
import type { DirectDeliveryTransactionScope } from '@/lib/modules/pedidos/ports/direct-delivery-unit-of-work'

const EMPRESA = '33333333-3333-4333-8333-333333333333'
const SCOPE = { companyId: EMPRESA }
const AHORA = new Date('2026-10-16T10:00:00.000Z')
const RECETA = '22222222-2222-4222-8222-222222222222'
const PRESENTACION = 'f0000000-0000-4000-8000-000000000288'
const OTRA_PRESENTACION = 'f0000000-0000-4000-8000-000000000999'
const DELIVERY_ID = '99999999-9999-4999-8999-999999999999'
const PAR = { recipeId: RECETA, presentationId: PRESENTACION }

const ENTREGADOR: Actor = { id: 'u-entrega', companyId: EMPRESA, permissions: ['entregas.modificar'] }

const BASE: FinishedProductSurplusBase = { productId: DIRECT_PRODUCT_ID, recipeId: RECETA, presentationId: PRESENTACION, stockPackages: 20 }

const BLOQUEO: FinishedProductDeliveryLock = { recipeId: RECETA, presentationId: PRESENTACION, stockPackages: 20 }

/** Como el tablero: dos pedidos que esperan 5 y 3; con 20 en stock, el excedente es 12. */
const ESPERAN: readonly WaitingOrderLineOfPair[] = [
  { orderId: 'o-1', numberText: '2026-0000031', orderedPackages: 5, deliveredPackages: 0, ...PAR },
  { orderId: 'o-2', numberText: '2026-0000034', orderedPackages: 4, deliveredPackages: 1, ...PAR },
]

function cliente(id: string): CustomerRef {
  return { id, firstNames: 'Ana', lastNames: 'Perez', isDeleted: false }
}

function despachado(input: FinishedGoodsDirectDispatchInput): FinishedGoodsDispatchOutcome {
  return {
    kind: 'dispatched',
    lines: input.allocations.map((a) => ({ batchId: a.batchId, packages: a.packages, quantity: `${String(a.packages)}.5000` })),
  }
}

/** `n` envases repartidos entre los dos clientes y los dos lotes del fixture. */
function entradaDe(n: number) {
  return deliverDirectInput({
    customers: [
      { customerId: DIRECT_FIRST_CUSTOMER_ID, allocations: [{ batchId: DIRECT_OLDER_BATCH_ID, packages: n - 1 }] },
      { customerId: DIRECT_SECOND_CUSTOMER_ID, allocations: [{ batchId: DIRECT_NEWER_BATCH_ID, packages: 1 }] },
    ],
  })
}

type Fn = ReturnType<typeof vi.fn>

type Montaje = {
  readonly deps: DeliverDirectDeps
  readonly tx: {
    readonly deliveries: { readonly findByKey: Fn; readonly create: Fn; readonly addLines: Fn }
    readonly waiting: { readonly listWaitingLines: Fn }
    readonly waitingLock: { readonly lockWaitingCandidates: Fn }
    readonly finishedGoods: { readonly lockForDirectDelivery: Fn; readonly dispatchDirect: Fn }
  }
  readonly run: Fn
  readonly findByKey: Fn
  readonly findAliveRefById: Fn
  readonly findSurplusBases: Fn
  readonly lanzoDentro: () => unknown
}

function montar(
  opciones: {
    base?: FinishedProductSurplusBase | null
    bloqueo?: FinishedProductDeliveryLock | null
    esperan?: readonly WaitingOrderLineOfPair[]
    clientes?: ReadonlyMap<string, CustomerRef | null>
    /** La lectura previa de la clave; sin el, `null`. */
    registrada?: RegisteredDelivery | null
    /** La lectura de la clave ya con el producto bloqueado; sin el, `null`. */
    registradaDentro?: RegisteredDelivery | null
    /** La relectura tras la senal de clave ya registrada. */
    releida?: RegisteredDelivery | null
    creada?: { kind: 'created'; id: string } | { kind: 'duplicate_key' }
    despacho?: (input: FinishedGoodsDirectDispatchInput) => FinishedGoodsDispatchOutcome
  } = {},
): Montaje {
  const tx = {
    deliveries: {
      findByKey: vi.fn(async () => opciones.registradaDentro ?? null),
      create: vi.fn(async () => opciones.creada ?? { kind: 'created', id: DELIVERY_ID }),
      addLines: vi.fn(async () => undefined),
    },
    waiting: { listWaitingLines: vi.fn(async () => opciones.esperan ?? ESPERAN) },
    waitingLock: { lockWaitingCandidates: vi.fn(async () => undefined) },
    finishedGoods: {
      lockForDirectDelivery: vi.fn(async () => (opciones.bloqueo === undefined ? BLOQUEO : opciones.bloqueo)),
      dispatchDirect: vi.fn(async (input: FinishedGoodsDirectDispatchInput) => (opciones.despacho ?? despachado)(input)),
    },
  }
  let lanzado: unknown = null
  const run = vi.fn(async (work: (scope: DirectDeliveryTransactionScope) => Promise<unknown>) => {
    try {
      return await work(tx as unknown as DirectDeliveryTransactionScope)
    } catch (error) {
      lanzado = error
      throw error
    }
  })
  let lecturasDeClave = 0
  const findByKey = vi.fn(async () => {
    lecturasDeClave += 1
    if (lecturasDeClave === 1) return opciones.registrada ?? null
    return opciones.releida === undefined ? { id: DELIVERY_ID, orderId: null } : opciones.releida
  })
  const findAliveRefById = vi.fn(async (id: string) =>
    opciones.clientes?.has(id) === true ? (opciones.clientes.get(id) ?? null) : cliente(id),
  )
  const findSurplusBases = vi.fn(async () => {
    const base = opciones.base === undefined ? BASE : opciones.base
    return base === null ? [] : [base]
  })
  return {
    deps: {
      customerCatalog: { findAliveRefById },
      catalog: { findSurplusBases },
      unitOfWork: { run } as unknown as DeliverDirectDeps['unitOfWork'],
      deliveries: { findByKey },
      now: () => AHORA,
    },
    tx,
    run,
    findByKey,
    findAliveRefById,
    findSurplusBases,
    lanzoDentro: () => lanzado,
  }
}

async function codigoDelFallo(operacion: () => Promise<unknown>): Promise<string> {
  const error = await operacion().then(
    () => null,
    (e: unknown) => e,
  )
  expect(error, 'la operacion tenia que fallar').not.toBeNull()
  return (error as PedidosError).code
}

function nadaEscrito(m: Montaje): void {
  expect(m.tx.deliveries.create).not.toHaveBeenCalled()
  expect(m.tx.finishedGoods.dispatchDirect).not.toHaveBeenCalled()
  expect(m.tx.deliveries.addLines).not.toHaveBeenCalled()
}

function ningunPuerto(m: Montaje): void {
  expect(m.findByKey).not.toHaveBeenCalled()
  expect(m.findAliveRefById).not.toHaveBeenCalled()
  expect(m.findSurplusBases).not.toHaveBeenCalled()
  expect(m.run).not.toHaveBeenCalled()
  nadaEscrito(m)
}

describe('deliverDirect — acceso (R2, R4)', () => {
  it('R2: sin entregas.modificar responde unauthorized antes de validar, y ningun puerto se llama', async () => {
    const m = montar()
    const entregar = createDeliverDirect(m.deps)
    const soloAnular: Actor = { ...ENTREGADOR, permissions: ['entregas.anular', 'inventario.consultar'] }

    for (const actor of [null, undefined, { ...ENTREGADOR, permissions: [] }, soloAnular]) {
      expect(await codigoDelFallo(() => entregar(deliverDirectInput(), actor))).toBe('unauthorized')
      expect(await codigoDelFallo(() => entregar({ basura: true }, actor))).toBe('unauthorized')
    }
    ningunPuerto(m)
  })

  it('R4: un actor con entregas.modificar y un rol distinto de Administrador es aceptado', async () => {
    const m = montar()
    const deOtroRol: Actor = { id: 'u-bodega', companyId: EMPRESA, permissions: ['inventario.consultar', 'entregas.modificar'] }

    await expect(createDeliverDirect(m.deps)(deliverDirectInput(), deOtroRol)).resolves.toEqual({ status: 'delivered' })
  })

  it('R4: un Administrador sin entregas.modificar en su conjunto es rechazado', async () => {
    const m = montar()
    const delAdministrador = [...SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]]
    expect(delAdministrador).toContain('entregas.modificar')
    const adminSinPermiso: Actor = { id: 'u-admin', companyId: EMPRESA, permissions: delAdministrador.filter((p) => p !== 'entregas.modificar') }

    expect(await codigoDelFallo(() => createDeliverDirect(m.deps)(deliverDirectInput(), adminSinPermiso))).toBe('unauthorized')
    ningunPuerto(m)
  })
})

describe('deliverDirect — forma de la entrada (R29)', () => {
  const unLote = (packages: unknown) => [{ customerId: DIRECT_FIRST_CUSTOMER_ID, allocations: [{ batchId: DIRECT_OLDER_BATCH_ID, packages }] }]
  const demasiadas = Array.from({ length: DELIVERY_MAX_ALLOCATIONS + 1 }, (_, i) => ({
    customerId: `c0000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    allocations: [{ batchId: DIRECT_OLDER_BATCH_ID, packages: 1 }],
  }))
  const sinNota: Record<string, unknown> = { ...deliverDirectInput() }
  delete sinNota.note
  const invalidas: ReadonlyArray<readonly [string, unknown]> = [
    ['ningun cliente', deliverDirectInput({ customers: [] })],
    ['un cliente sin envases', deliverDirectInput({ customers: [{ customerId: DIRECT_FIRST_CUSTOMER_ID, allocations: [] }] })],
    [
      'el mismo cliente dos veces (sin distinguir mayusculas)',
      deliverDirectInput({
        customers: [
          { customerId: DIRECT_FIRST_CUSTOMER_ID, allocations: [{ batchId: DIRECT_OLDER_BATCH_ID, packages: 1 }] },
          { customerId: DIRECT_FIRST_CUSTOMER_ID.toUpperCase(), allocations: [{ batchId: DIRECT_NEWER_BATCH_ID, packages: 1 }] },
        ],
      }),
    ],
    [
      'el mismo lote repetido dentro de un cliente',
      deliverDirectInput({
        customers: [
          {
            customerId: DIRECT_FIRST_CUSTOMER_ID,
            allocations: [
              { batchId: DIRECT_OLDER_BATCH_ID, packages: 1 },
              { batchId: DIRECT_OLDER_BATCH_ID, packages: 2 },
            ],
          },
        ],
      }),
    ],
    ['envases no enteros', { ...deliverDirectInput(), customers: unLote(1.5) }],
    ['envases en cero', { ...deliverDirectInput(), customers: unLote(0) }],
    ['envases negativos', { ...deliverDirectInput(), customers: unLote(-1) }],
    ['envases como texto', { ...deliverDirectInput(), customers: unLote('2') }],
    ['mas asignaciones que el tope', deliverDirectInput({ customers: demasiadas })],
    ['una nota de 501 caracteres sin los espacios', deliverDirectInput({ note: `  ${'n'.repeat(501)}  ` })],
    ['una clave sin forma de uuid', deliverDirectInput({ deliveryKey: 'clave' })],
    ['un lote sin forma de uuid', deliverDirectInput({ customers: [{ customerId: DIRECT_FIRST_CUSTOMER_ID, allocations: [{ batchId: 'lote', packages: 1 }] }] })],
    ['un campo de mas', { ...deliverDirectInput(), orderId: DIRECT_PRODUCT_ID }],
    ['un campo de mas en un cliente', deliverDirectInput({ customers: [{ ...unLote(1)[0], extra: 1 } as never] })],
    ['la nota ausente', sinNota],
    ['no es un objeto', 'entrega'],
  ]

  for (const [caso, entrada] of invalidas) {
    it(`R29: ${caso} responde invalid_input sin leer ni escribir nada`, async () => {
      const m = montar()
      expect(await codigoDelFallo(() => createDeliverDirect(m.deps)(entrada, ENTREGADOR))).toBe('invalid_input')
      ningunPuerto(m)
    })
  }

  it('R29: un producto sin forma de uuid responde product_not_found sin leer nada', async () => {
    const m = montar()
    expect(await codigoDelFallo(() => createDeliverDirect(m.deps)(deliverDirectInput({ productId: 'producto' }), ENTREGADOR))).toBe(
      'product_not_found',
    )
    ningunPuerto(m)
  })

  it('R29: un cliente sin forma de uuid responde customer_not_found sin consultar el catalogo', async () => {
    const m = montar()
    const entrada = deliverDirectInput({ customers: [{ customerId: 'cliente', allocations: [{ batchId: DIRECT_OLDER_BATCH_ID, packages: 1 }] }] })
    expect(await codigoDelFallo(() => createDeliverDirect(m.deps)(entrada, ENTREGADOR))).toBe('customer_not_found')
    expect(m.findAliveRefById).not.toHaveBeenCalled()
    expect(m.run).not.toHaveBeenCalled()
  })

  it('R29: una nota de 500 caracteres con espacios alrededor se acepta y se guarda recortada', async () => {
    const m = montar()
    const nota = 'n'.repeat(500)
    await createDeliverDirect(m.deps)(deliverDirectInput({ note: `  ${nota}  ` }), ENTREGADOR)
    expect(m.tx.deliveries.create).toHaveBeenCalledWith(expect.objectContaining({ note: nota }), SCOPE)
  })

  it('R36: una nota vacia o de solo espacios se guarda sin nota', async () => {
    for (const note of [null, '', '   ']) {
      const m = montar()
      await createDeliverDirect(m.deps)(deliverDirectInput({ note }), ENTREGADOR)
      expect(m.tx.deliveries.create).toHaveBeenCalledWith(expect.objectContaining({ note: null }), SCOPE)
    }
  })
})

describe('deliverDirect — producto y clientes (R30, R31)', () => {
  it('R30: un producto que no vuelve del catalogo (ausente, de baja, no terminado o ajeno) es product_not_found sin abrir la transaccion', async () => {
    const m = montar({ base: null })
    expect(await codigoDelFallo(() => createDeliverDirect(m.deps)(deliverDirectInput(), ENTREGADOR))).toBe('product_not_found')
    expect(m.findSurplusBases).toHaveBeenCalledWith([DIRECT_PRODUCT_ID], EMPRESA)
    expect(m.run).not.toHaveBeenCalled()
  })

  it('R30: un producto que ya no vuelve del bloqueo es product_not_found dentro de la transaccion, sin escribir', async () => {
    const m = montar({ bloqueo: null })
    expect(await codigoDelFallo(() => createDeliverDirect(m.deps)(deliverDirectInput(), ENTREGADOR))).toBe('product_not_found')
    expect(m.tx.finishedGoods.lockForDirectDelivery).toHaveBeenCalledWith(DIRECT_PRODUCT_ID, EMPRESA)
    expect(m.lanzoDentro()).not.toBeNull()
    nadaEscrito(m)
  })

  it('R31: si el segundo cliente no vuelve del catalogo es customer_not_found, sin abrir la transaccion', async () => {
    const m = montar({ clientes: new Map([[DIRECT_SECOND_CUSTOMER_ID, null]]) })
    expect(await codigoDelFallo(() => createDeliverDirect(m.deps)(deliverDirectInput(), ENTREGADOR))).toBe('customer_not_found')
    expect(m.findAliveRefById.mock.calls).toEqual([
      [DIRECT_FIRST_CUSTOMER_ID, EMPRESA],
      [DIRECT_SECOND_CUSTOMER_ID, EMPRESA],
    ])
    expect(m.run).not.toHaveBeenCalled()
  })

  it('R31: si falla el primer cliente no se consulta el segundo', async () => {
    const m = montar({ clientes: new Map([[DIRECT_FIRST_CUSTOMER_ID, null]]) })
    expect(await codigoDelFallo(() => createDeliverDirect(m.deps)(deliverDirectInput(), ENTREGADOR))).toBe('customer_not_found')
    expect(m.findAliveRefById).toHaveBeenCalledTimes(1)
  })
})

describe('deliverDirect — bloqueos y excedente (R33, R35)', () => {
  it('R35: bloquea los pedidos de la receta y la presentacion antes que el producto, y lee lo que esperan despues', async () => {
    const m = montar()
    await createDeliverDirect(m.deps)(deliverDirectInput(), ENTREGADOR)

    expect(m.tx.waitingLock.lockWaitingCandidates).toHaveBeenCalledWith(PAR, SCOPE)
    const [pedidos] = m.tx.waitingLock.lockWaitingCandidates.mock.invocationCallOrder
    const [producto] = m.tx.finishedGoods.lockForDirectDelivery.mock.invocationCallOrder
    const [esperan] = m.tx.waiting.listWaitingLines.mock.invocationCallOrder
    expect(pedidos).toBeLessThan(producto as number)
    expect(producto).toBeLessThan(esperan as number)
    expect(m.tx.waiting.listWaitingLines).toHaveBeenCalledWith([PAR], SCOPE)
  })

  it('R35: si la receta o la presentacion del bloqueo no son las leidas antes, falla sin escribir', async () => {
    const m = montar({ bloqueo: { ...BLOQUEO, presentationId: OTRA_PRESENTACION } })
    await expect(createDeliverDirect(m.deps)(deliverDirectInput(), ENTREGADOR)).rejects.toThrow(/cambio/)
    expect(m.lanzoDentro()).not.toBeNull()
    nadaEscrito(m)
  })

  it('R33: con 20 en stock y 8 que esperan, 12 envases pasan', async () => {
    const m = montar()
    await expect(createDeliverDirect(m.deps)(entradaDe(12), ENTREGADOR)).resolves.toEqual({ status: 'delivered' })
  })

  it('R33: con 20 en stock y 8 que esperan, 13 envases son delivery_exceeds_surplus sin escribir', async () => {
    const m = montar()
    expect(await codigoDelFallo(() => createDeliverDirect(m.deps)(entradaDe(13), ENTREGADOR))).toBe('delivery_exceeds_surplus')
    expect(m.lanzoDentro()).not.toBeNull()
    nadaEscrito(m)
  })

  it('R33: el excedente sale de los envases leidos con el producto bloqueado, no de la lectura previa', async () => {
    const m = montar({ base: { ...BASE, stockPackages: 100 }, bloqueo: { ...BLOQUEO, stockPackages: 10 } })
    expect(await codigoDelFallo(() => createDeliverDirect(m.deps)(entradaDe(3), ENTREGADOR))).toBe('delivery_exceeds_surplus')
  })

  it('R33: sin receta ni presentacion ningun pedido espera: ni bloqueo de pedidos ni lectura, y el excedente es el stock', async () => {
    const m = montar({
      base: { ...BASE, recipeId: null, presentationId: null },
      bloqueo: { recipeId: null, presentationId: null, stockPackages: 6 },
    })
    await expect(createDeliverDirect(m.deps)(entradaDe(6), ENTREGADOR)).resolves.toEqual({ status: 'delivered' })
    expect(m.tx.waitingLock.lockWaitingCandidates).not.toHaveBeenCalled()
    expect(m.tx.waiting.listWaitingLines).not.toHaveBeenCalled()
  })
})

describe('deliverDirect — lotes (R32, R34)', () => {
  it('R32: batch_not_found de inventario es batch_not_found y no guarda lineas', async () => {
    const m = montar({ despacho: () => ({ kind: 'batch_not_found', batchId: DIRECT_NEWER_BATCH_ID }) })
    expect(await codigoDelFallo(() => createDeliverDirect(m.deps)(deliverDirectInput(), ENTREGADOR))).toBe('batch_not_found')
    expect(m.lanzoDentro()).not.toBeNull()
    expect(m.tx.deliveries.addLines).not.toHaveBeenCalled()
  })

  it('R34: insufficient de inventario es delivery_batch_insufficient y no guarda lineas', async () => {
    const m = montar({ despacho: () => ({ kind: 'insufficient', batchId: DIRECT_OLDER_BATCH_ID, availablePackages: 2 }) })
    expect(await codigoDelFallo(() => createDeliverDirect(m.deps)(deliverDirectInput(), ENTREGADOR))).toBe('delivery_batch_insufficient')
    expect(m.lanzoDentro()).not.toBeNull()
    expect(m.tx.deliveries.addLines).not.toHaveBeenCalled()
  })
})

describe('deliverDirect — escritura (R36, R37, R39)', () => {
  it('R36: crea una sola entrega con el producto, la clave, la nota recortada, el autor y el instante', async () => {
    const m = montar()
    await createDeliverDirect(m.deps)(deliverDirectInput({ note: '  Venta mostrador  ' }), ENTREGADOR)
    expect(m.tx.deliveries.create).toHaveBeenCalledTimes(1)
    expect(m.tx.deliveries.create).toHaveBeenCalledWith(
      { deliveryKey: DIRECT_DELIVERY_KEY, productId: DIRECT_PRODUCT_ID, note: 'Venta mostrador', actorId: ENTREGADOR.id, now: AHORA },
      SCOPE,
    )
  })

  it('R37: despacha una vez con las asignaciones de todos los clientes en orden cliente -> asignacion, y la entrega creada', async () => {
    const m = montar()
    await createDeliverDirect(m.deps)(deliverDirectInput(), ENTREGADOR)
    expect(m.tx.finishedGoods.dispatchDirect).toHaveBeenCalledTimes(1)
    expect(m.tx.finishedGoods.dispatchDirect).toHaveBeenCalledWith({
      companyId: EMPRESA,
      productId: DIRECT_PRODUCT_ID,
      orderDeliveryId: DELIVERY_ID,
      allocations: [
        { batchId: DIRECT_OLDER_BATCH_ID, packages: 4 },
        { batchId: DIRECT_OLDER_BATCH_ID, packages: 1 },
        { batchId: DIRECT_NEWER_BATCH_ID, packages: 1 },
      ],
      actorId: ENTREGADOR.id,
      now: AHORA,
    })
  })

  it('R36: guarda una linea por asignacion con su cliente y la cantidad que devolvio inventario en la misma posicion', async () => {
    const m = montar()
    await createDeliverDirect(m.deps)(deliverDirectInput(), ENTREGADOR)
    expect(m.tx.deliveries.addLines).toHaveBeenCalledWith(
      DELIVERY_ID,
      [
        { customerId: DIRECT_FIRST_CUSTOMER_ID, batchId: DIRECT_OLDER_BATCH_ID, packages: 4, quantity: '4.5000' },
        { customerId: DIRECT_SECOND_CUSTOMER_ID, batchId: DIRECT_OLDER_BATCH_ID, packages: 1, quantity: '1.5000' },
        { customerId: DIRECT_SECOND_CUSTOMER_ID, batchId: DIRECT_NEWER_BATCH_ID, packages: 1, quantity: '1.5000' },
      ],
      SCOPE,
    )
  })

  it('R39: si inventario no devuelve una linea por asignacion, falla dentro de la transaccion sin guardar lineas', async () => {
    const m = montar({ despacho: () => ({ kind: 'dispatched', lines: [] }) })
    await expect(createDeliverDirect(m.deps)(deliverDirectInput(), ENTREGADOR)).rejects.toThrow(/una linea por asignacion/)
    expect(m.lanzoDentro()).not.toBeNull()
    expect(m.tx.deliveries.addLines).not.toHaveBeenCalled()
  })

  it('R39: si falla la escritura de las lineas, el error sale de la transaccion', async () => {
    const m = montar()
    m.tx.deliveries.addLines.mockRejectedValueOnce(new Error('fallo de la base'))
    await expect(createDeliverDirect(m.deps)(deliverDirectInput(), ENTREGADOR)).rejects.toThrow('fallo de la base')
    expect(m.lanzoDentro()).not.toBeNull()
  })
})

describe('deliverDirect — clave ya registrada (R38)', () => {
  it('R38: la clave de una entrega sin pedido ya registrada responde already_registered sin consultar clientes ni abrir la transaccion', async () => {
    const m = montar({ registrada: { id: DELIVERY_ID, orderId: null } })
    await expect(createDeliverDirect(m.deps)(deliverDirectInput(), ENTREGADOR)).resolves.toEqual({ status: 'already_registered' })
    expect(m.findByKey).toHaveBeenCalledWith(DIRECT_DELIVERY_KEY, SCOPE)
    expect(m.findAliveRefById).not.toHaveBeenCalled()
    expect(m.run).not.toHaveBeenCalled()
  })

  it('R38: la clave de una entrega de pedido responde invalid_input sin escribir', async () => {
    const m = montar({ registrada: { id: DELIVERY_ID, orderId: 'd0000000-0000-4000-8000-000000000001' } })
    expect(await codigoDelFallo(() => createDeliverDirect(m.deps)(deliverDirectInput(), ENTREGADOR))).toBe('invalid_input')
    expect(m.run).not.toHaveBeenCalled()
  })

  it('R38: la clave vista ya con el producto bloqueado deshace y responde already_registered, antes del tope', async () => {
    const m = montar({ registradaDentro: { id: DELIVERY_ID, orderId: null } })
    await expect(createDeliverDirect(m.deps)(entradaDe(13), ENTREGADOR)).resolves.toEqual({ status: 'already_registered' })
    expect(m.lanzoDentro()).not.toBeNull()
    expect(m.findByKey).toHaveBeenCalledTimes(2)
    expect(m.tx.waiting.listWaitingLines).not.toHaveBeenCalled()
    nadaEscrito(m)
  })

  it('R38: duplicate_key al crear deshace, relee la clave y responde already_registered sin despachar', async () => {
    const m = montar({ creada: { kind: 'duplicate_key' } })
    await expect(createDeliverDirect(m.deps)(deliverDirectInput(), ENTREGADOR)).resolves.toEqual({ status: 'already_registered' })
    expect(m.lanzoDentro()).not.toBeNull()
    expect(m.tx.finishedGoods.dispatchDirect).not.toHaveBeenCalled()
  })

  it('R38: si la clave que gano la carrera es de una entrega de pedido, responde invalid_input', async () => {
    const m = montar({ creada: { kind: 'duplicate_key' }, releida: { id: DELIVERY_ID, orderId: 'd0000000-0000-4000-8000-000000000001' } })
    expect(await codigoDelFallo(() => createDeliverDirect(m.deps)(deliverDirectInput(), ENTREGADOR))).toBe('invalid_input')
  })

  it('R38: duplicate_key sin entrega al releer es un error interno', async () => {
    const m = montar({ creada: { kind: 'duplicate_key' }, releida: null })
    await expect(createDeliverDirect(m.deps)(deliverDirectInput(), ENTREGADOR)).rejects.toThrow(/duplicate_key sin entrega/)
  })
})
