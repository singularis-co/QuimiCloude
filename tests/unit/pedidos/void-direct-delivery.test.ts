// Anular una entrega sin pedido: el caso de uso contra dobles de sus puertos. La transaccion real, la
// base y la concurrencia van en los `.int`.

import { describe, expect, it, vi } from 'vitest'

import { ROLE_ADMINISTRADOR, SEED_ROLE_PERMISSIONS } from '@/lib/modules/identity'
import { DELIVERY_MAX_ALLOCATIONS } from '@/lib/modules/pedidos/domain/order-delivery'
import { createVoidDirectDelivery, type VoidDirectDeliveryDeps } from '@/lib/modules/pedidos/domain/void-direct-delivery'
import {
  DIRECT_DELIVERY_ID,
  DIRECT_FIRST_CUSTOMER_ID,
  DIRECT_NEWER_BATCH_ID,
  DIRECT_OLDER_BATCH_ID,
  DIRECT_PRODUCT_ID,
  DIRECT_SECOND_CUSTOMER_ID,
  DIRECT_VOID_KEY,
} from '@/tests/fixtures/direct-delivery'

import type { FinishedGoodsReturnOutcome } from '@/lib/modules/inventario'
import type { VoidDirectDeliveryInput } from '@/lib/modules/pedidos/adapters/driving/order-actions'
import type { Actor } from '@/lib/modules/pedidos/domain/actor'
import type { PedidosError } from '@/lib/modules/pedidos/domain/errors'
import type { DirectDeliveryVoidTransactionScope } from '@/lib/modules/pedidos/ports/direct-delivery-unit-of-work'
import type {
  DeliveryForVoid,
  DeliveryLineForVoid,
  RegisteredDeliveryVoid,
} from '@/lib/modules/pedidos/ports/order-delivery-void-repository'

const EMPRESA = '33333333-3333-4333-8333-333333333333'
const SCOPE = { companyId: EMPRESA }
const AHORA = new Date('2026-10-16T12:00:00.000Z')
const VOID_ID = '99999999-9999-4999-8999-999999999999'
const ORDER_ID = 'd0000000-0000-4000-8000-000000000001'
const TERCER_CLIENTE = 'c0000000-0000-4000-8000-000000000290'

const ANULADOR: Actor = { id: 'u-anula', companyId: EMPRESA, permissions: ['entregas.anular'] }

const ENTREGA: DeliveryForVoid = {
  id: DIRECT_DELIVERY_ID,
  orderId: null,
  productId: DIRECT_PRODUCT_ID,
  createdAt: new Date('2026-10-16T10:30:00.000Z'),
}

/** El primer cliente en dos lotes; el segundo en uno; el tercero ya anulado. */
const LINEAS: readonly DeliveryLineForVoid[] = [
  { id: 'l-1', customerId: DIRECT_FIRST_CUSTOMER_ID, presentationLineId: null, batchId: DIRECT_OLDER_BATCH_ID, packages: 4, quantity: '4.0000', voided: false },
  { id: 'l-2', customerId: DIRECT_FIRST_CUSTOMER_ID, presentationLineId: null, batchId: DIRECT_NEWER_BATCH_ID, packages: 1, quantity: '1.0000', voided: false },
  { id: 'l-3', customerId: DIRECT_SECOND_CUSTOMER_ID, presentationLineId: null, batchId: DIRECT_OLDER_BATCH_ID, packages: 2, quantity: '2.0000', voided: false },
  { id: 'l-4', customerId: TERCER_CLIENTE, presentationLineId: null, batchId: DIRECT_OLDER_BATCH_ID, packages: 3, quantity: '3.0000', voided: true },
]

function entrada(overrides: Partial<VoidDirectDeliveryInput> = {}): VoidDirectDeliveryInput {
  return {
    deliveryId: DIRECT_DELIVERY_ID,
    voidKey: DIRECT_VOID_KEY,
    customerIds: [DIRECT_FIRST_CUSTOMER_ID],
    reason: 'Devolucion del cliente',
    ...overrides,
  }
}

type Fn = ReturnType<typeof vi.fn>

type Montaje = {
  readonly deps: VoidDirectDeliveryDeps
  readonly tx: {
    readonly voids: { readonly findByKey: Fn; readonly findDeliveryLines: Fn; readonly create: Fn; readonly addLines: Fn }
    readonly finishedGoods: { readonly returnForDeliveryVoid: Fn }
  }
  readonly run: Fn
  readonly findByKey: Fn
  readonly findDelivery: Fn
  readonly lanzoDentro: () => unknown
}

function montar(
  opciones: {
    entrega?: DeliveryForVoid | null
    lineas?: readonly DeliveryLineForVoid[]
    registrada?: RegisteredDeliveryVoid | null
    registradaDentro?: RegisteredDeliveryVoid | null
    releida?: RegisteredDeliveryVoid | null
    creada?: { kind: 'created'; id: string } | { kind: 'duplicate_key' }
    agregadas?: 'ok' | 'already_voided'
    devolucion?: FinishedGoodsReturnOutcome
  } = {},
): Montaje {
  const tx = {
    voids: {
      findByKey: vi.fn(async () => opciones.registradaDentro ?? null),
      findDeliveryLines: vi.fn(async () => opciones.lineas ?? LINEAS),
      create: vi.fn(async () => opciones.creada ?? { kind: 'created', id: VOID_ID }),
      addLines: vi.fn(async () => opciones.agregadas ?? 'ok'),
    },
    finishedGoods: {
      returnForDeliveryVoid: vi.fn(async (): Promise<FinishedGoodsReturnOutcome> => opciones.devolucion ?? { kind: 'returned' }),
    },
  }
  let lanzado: unknown = null
  const run = vi.fn(async (work: (scope: DirectDeliveryVoidTransactionScope) => Promise<unknown>) => {
    try {
      return await work(tx as unknown as DirectDeliveryVoidTransactionScope)
    } catch (error) {
      lanzado = error
      throw error
    }
  })
  let lecturasDeClave = 0
  const findByKey = vi.fn(async () => {
    lecturasDeClave += 1
    if (lecturasDeClave === 1) return opciones.registrada ?? null
    return opciones.releida === undefined ? { id: VOID_ID, orderId: null } : opciones.releida
  })
  const findDelivery = vi.fn(async () => (opciones.entrega === undefined ? ENTREGA : opciones.entrega))
  return {
    deps: {
      unitOfWork: { run } as unknown as VoidDirectDeliveryDeps['unitOfWork'],
      voids: { findByKey, findDelivery },
      now: () => AHORA,
    },
    tx,
    run,
    findByKey,
    findDelivery,
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
  expect(m.tx.voids.create).not.toHaveBeenCalled()
  expect(m.tx.voids.addLines).not.toHaveBeenCalled()
  expect(m.tx.finishedGoods.returnForDeliveryVoid).not.toHaveBeenCalled()
}

function ningunPuerto(m: Montaje): void {
  expect(m.findByKey).not.toHaveBeenCalled()
  expect(m.findDelivery).not.toHaveBeenCalled()
  expect(m.run).not.toHaveBeenCalled()
  nadaEscrito(m)
}

describe('voidDirectDelivery — acceso (R3, R4)', () => {
  it('R3: sin entregas.anular responde unauthorized antes de validar, y ningun puerto se llama', async () => {
    const m = montar()
    const anular = createVoidDirectDelivery(m.deps)
    const soloEntregar: Actor = { ...ANULADOR, permissions: ['entregas.modificar'] }

    for (const actor of [null, undefined, { ...ANULADOR, permissions: [] }, soloEntregar]) {
      expect(await codigoDelFallo(() => anular(entrada(), actor))).toBe('unauthorized')
      expect(await codigoDelFallo(() => anular({ basura: true }, actor))).toBe('unauthorized')
    }
    ningunPuerto(m)
  })

  it('R4: un actor con entregas.anular y un rol distinto de Administrador es aceptado', async () => {
    const m = montar()
    const deOtroRol: Actor = { id: 'u-bodega', companyId: EMPRESA, permissions: ['inventario.consultar', 'entregas.anular'] }
    await expect(createVoidDirectDelivery(m.deps)(entrada(), deOtroRol)).resolves.toEqual({ status: 'voided' })
  })

  it('R4: un Administrador sin entregas.anular en su conjunto es rechazado', async () => {
    const m = montar()
    const delAdministrador = [...SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]]
    expect(delAdministrador).toContain('entregas.anular')
    const adminSinPermiso: Actor = { id: 'u-admin', companyId: EMPRESA, permissions: delAdministrador.filter((p) => p !== 'entregas.anular') }

    expect(await codigoDelFallo(() => createVoidDirectDelivery(m.deps)(entrada(), adminSinPermiso))).toBe('unauthorized')
    ningunPuerto(m)
  })
})

describe('voidDirectDelivery — forma de la entrada (R47)', () => {
  const sinMotivo: Record<string, unknown> = { ...entrada() }
  delete sinMotivo.reason
  const invalidas: ReadonlyArray<readonly [string, unknown]> = [
    ['la entrega sin forma de uuid', entrada({ deliveryId: 'entrega' })],
    ['la clave sin forma de uuid', entrada({ voidKey: 'clave' })],
    ['ningun cliente', entrada({ customerIds: [] })],
    ['un cliente repetido (sin distinguir mayusculas)', entrada({ customerIds: [DIRECT_FIRST_CUSTOMER_ID, DIRECT_FIRST_CUSTOMER_ID.toUpperCase()] })],
    ['un cliente sin forma de uuid', entrada({ customerIds: ['cliente'] })],
    [
      'mas clientes que el tope',
      entrada({ customerIds: Array.from({ length: DELIVERY_MAX_ALLOCATIONS + 1 }, (_, i) => `c0000000-0000-4000-8000-${String(i).padStart(12, '0')}`) }),
    ],
    ['un motivo vacio tras recortar', entrada({ reason: '    ' })],
    ['un motivo de 501 caracteres', entrada({ reason: 'm'.repeat(501) })],
    ['un campo de mas', { ...entrada(), items: [] }],
    ['el motivo ausente', sinMotivo],
  ]

  for (const [caso, valor] of invalidas) {
    it(`R47: ${caso} responde invalid_input sin leer ni escribir nada`, async () => {
      const m = montar()
      expect(await codigoDelFallo(() => createVoidDirectDelivery(m.deps)(valor, ANULADOR))).toBe('invalid_input')
      ningunPuerto(m)
    })
  }

  it('R47: un cliente sin lineas en esa entrega responde invalid_input sin escribir', async () => {
    const m = montar()
    const ajeno = 'c0000000-0000-4000-8000-000000000999'
    expect(await codigoDelFallo(() => createVoidDirectDelivery(m.deps)(entrada({ customerIds: [DIRECT_FIRST_CUSTOMER_ID, ajeno] }), ANULADOR))).toBe(
      'invalid_input',
    )
    expect(m.lanzoDentro()).not.toBeNull()
    nadaEscrito(m)
  })
})

describe('voidDirectDelivery — la entrega (R48)', () => {
  it('R48: la entrega ausente o de otra empresa responde delivery_not_found sin abrir la transaccion', async () => {
    const m = montar({ entrega: null })
    expect(await codigoDelFallo(() => createVoidDirectDelivery(m.deps)(entrada(), ANULADOR))).toBe('delivery_not_found')
    expect(m.findDelivery).toHaveBeenCalledWith(DIRECT_DELIVERY_ID, SCOPE)
    expect(m.run).not.toHaveBeenCalled()
  })

  it('R48: una entrega de pedido responde delivery_not_found sin abrir la transaccion', async () => {
    const m = montar({ entrega: { ...ENTREGA, orderId: ORDER_ID, productId: null } })
    expect(await codigoDelFallo(() => createVoidDirectDelivery(m.deps)(entrada(), ANULADOR))).toBe('delivery_not_found')
    expect(m.run).not.toHaveBeenCalled()
  })
})

describe('voidDirectDelivery — clientes ya anulados (R49)', () => {
  it('R49: si la parte de un cliente pedido ya esta anulada responde delivery_already_voided y no anula la de los otros', async () => {
    const m = montar()
    expect(
      await codigoDelFallo(() => createVoidDirectDelivery(m.deps)(entrada({ customerIds: [DIRECT_FIRST_CUSTOMER_ID, TERCER_CLIENTE] }), ANULADOR)),
    ).toBe('delivery_already_voided')
    expect(m.lanzoDentro()).not.toBeNull()
    nadaEscrito(m)
  })

  it('R49: addLines con already_voided (respaldo de la base) es delivery_already_voided y deshace', async () => {
    const m = montar({ agregadas: 'already_voided' })
    expect(await codigoDelFallo(() => createVoidDirectDelivery(m.deps)(entrada(), ANULADOR))).toBe('delivery_already_voided')
    expect(m.lanzoDentro()).not.toBeNull()
    expect(m.tx.finishedGoods.returnForDeliveryVoid).not.toHaveBeenCalled()
  })
})

describe('voidDirectDelivery — registro (R50)', () => {
  it('R50: guarda la anulacion con la entrega, el motivo recortado, el autor y el instante', async () => {
    const m = montar()
    await createVoidDirectDelivery(m.deps)(entrada({ reason: `  ${'m'.repeat(500)}  ` }), ANULADOR)
    expect(m.tx.voids.create).toHaveBeenCalledWith(
      { voidKey: DIRECT_VOID_KEY, deliveryId: DIRECT_DELIVERY_ID, reason: 'm'.repeat(500), actorId: ANULADOR.id, now: AHORA },
      SCOPE,
    )
  })

  it('R50: anula todas las lineas de los clientes pedidos, en todos sus lotes, y ninguna otra', async () => {
    const m = montar()
    await createVoidDirectDelivery(m.deps)(entrada({ customerIds: [DIRECT_SECOND_CUSTOMER_ID, DIRECT_FIRST_CUSTOMER_ID.toUpperCase()] }), ANULADOR)
    expect(m.tx.voids.addLines).toHaveBeenCalledWith(VOID_ID, DIRECT_DELIVERY_ID, ['l-1', 'l-2', 'l-3'], SCOPE)
  })

  it('R50: devuelve a inventario cada linea anulada, sin pedido y con la anulacion', async () => {
    const m = montar()
    await expect(createVoidDirectDelivery(m.deps)(entrada(), ANULADOR)).resolves.toEqual({ status: 'voided' })
    expect(m.tx.finishedGoods.returnForDeliveryVoid).toHaveBeenCalledWith({
      companyId: EMPRESA,
      orderId: null,
      orderDeliveryVoidId: VOID_ID,
      lines: [
        { batchId: DIRECT_OLDER_BATCH_ID, quantity: '4.0000' },
        { batchId: DIRECT_NEWER_BATCH_ID, quantity: '1.0000' },
      ],
      actorId: ANULADOR.id,
      now: AHORA,
    })
  })

  it('R51: batch_not_found en la devolucion falla dentro de la transaccion', async () => {
    const m = montar({ devolucion: { kind: 'batch_not_found', batchId: DIRECT_OLDER_BATCH_ID } })
    await expect(createVoidDirectDelivery(m.deps)(entrada(), ANULADOR)).rejects.toThrow(/no aparece/)
    expect(m.lanzoDentro()).not.toBeNull()
  })
})

describe('voidDirectDelivery — clave ya registrada (R51)', () => {
  it('R51: la clave de una anulacion sin pedido ya registrada responde already_registered sin leer la entrega ni escribir', async () => {
    const m = montar({ registrada: { id: VOID_ID, orderId: null }, entrega: null })
    await expect(createVoidDirectDelivery(m.deps)(entrada(), ANULADOR)).resolves.toEqual({ status: 'already_registered' })
    expect(m.findDelivery).not.toHaveBeenCalled()
    expect(m.run).not.toHaveBeenCalled()
  })

  it('R51: la clave de la anulacion de una entrega de pedido responde invalid_input sin escribir', async () => {
    const m = montar({ registrada: { id: VOID_ID, orderId: ORDER_ID } })
    expect(await codigoDelFallo(() => createVoidDirectDelivery(m.deps)(entrada(), ANULADOR))).toBe('invalid_input')
    expect(m.run).not.toHaveBeenCalled()
  })

  it('R51: la clave vista dentro de la transaccion deshace y responde already_registered', async () => {
    const m = montar({ registradaDentro: { id: VOID_ID, orderId: null } })
    await expect(createVoidDirectDelivery(m.deps)(entrada(), ANULADOR)).resolves.toEqual({ status: 'already_registered' })
    expect(m.lanzoDentro()).not.toBeNull()
    nadaEscrito(m)
  })

  it('R51: duplicate_key al crear deshace, relee la clave y responde already_registered', async () => {
    const m = montar({ creada: { kind: 'duplicate_key' } })
    await expect(createVoidDirectDelivery(m.deps)(entrada(), ANULADOR)).resolves.toEqual({ status: 'already_registered' })
    expect(m.findByKey).toHaveBeenCalledTimes(2)
    expect(m.tx.voids.addLines).not.toHaveBeenCalled()
  })

  it('R51: si la clave que gano la carrera es de una anulacion de pedido, responde invalid_input', async () => {
    const m = montar({ creada: { kind: 'duplicate_key' }, releida: { id: VOID_ID, orderId: ORDER_ID } })
    expect(await codigoDelFallo(() => createVoidDirectDelivery(m.deps)(entrada(), ANULADOR))).toBe('invalid_input')
  })
})
