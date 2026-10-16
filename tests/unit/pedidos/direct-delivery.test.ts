// La regla pura de la entrega sin pedido: lo que esperan los pedidos, el excedente, la nota y el
// tope. La comparten el sheet y el servidor, y el ultimo bloque lo comprueba en sus fuentes.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  DIRECT_DELIVERY_NOTE_MAX_LENGTH,
  DIRECT_DELIVERY_SURPLUS_MAX_PRODUCTS,
  checkDeliveryBlocks,
  checkDirectDelivery,
  directAllocations,
  flattenBlocks,
  normalizeDeliveryNote,
  packagesLeftInBatch,
  surplusPackages,
  waitingOrders,
  waitingPackages,
  type DeliveryBatchState,
  type WaitingOrderLine,
} from '@/lib/modules/pedidos'

const PRODUCT = 'product-1'
const B1 = 'batch-1'
const B2 = 'batch-2'

const O1 = 'order-1'
const O2 = 'order-2'
const O3 = 'order-3'

function line(overrides: Partial<WaitingOrderLine> = {}): WaitingOrderLine {
  return { orderId: O1, numberText: '2026-0000001', orderedPackages: 10, deliveredPackages: 0, ...overrides }
}

const BATCHES: readonly DeliveryBatchState[] = [
  { batchId: B1, presentationLineId: PRODUCT, availablePackages: 12 },
  { batchId: B2, presentationLineId: PRODUCT, availablePackages: 8 },
]

describe('waitingOrders: los pedidos a los que les faltan envases (R23)', () => {
  it('R23: lo que falta es lo pedido menos lo entregado', () => {
    expect(waitingOrders([line({ orderedPackages: 10, deliveredPackages: 4 })])).toEqual([
      { orderId: O1, numberText: '2026-0000001', missingPackages: 6 },
    ])
  })

  it('R23: un pedido sin envases que le falten no espera', () => {
    expect(
      waitingOrders([
        line({ orderId: O1, orderedPackages: 5, deliveredPackages: 5 }),
        line({ orderId: O2, numberText: '2026-0000002', orderedPackages: 3, deliveredPackages: 1 }),
      ]),
    ).toEqual([{ orderId: O2, numberText: '2026-0000002', missingPackages: 2 }])
  })

  it('R23: lo entregado de mas no resta lo que le falta a otro pedido', () => {
    expect(
      waitingOrders([
        line({ orderId: O1, orderedPackages: 2, deliveredPackages: 5 }),
        line({ orderId: O2, numberText: '2026-0000002', orderedPackages: 3, deliveredPackages: 0 }),
      ]),
    ).toEqual([{ orderId: O2, numberText: '2026-0000002', missingPackages: 3 }])
  })

  it('R23: las lineas de un mismo pedido suman lo que le falta', () => {
    expect(
      waitingOrders([
        line({ orderId: O1, orderedPackages: 4, deliveredPackages: 1 }),
        line({ orderId: O1, orderedPackages: 2, deliveredPackages: 0 }),
      ]),
    ).toEqual([{ orderId: O1, numberText: '2026-0000001', missingPackages: 5 }])
  })

  it('R23: salen por numero ascendente, sea cual sea el orden de entrada', () => {
    const result = waitingOrders([
      line({ orderId: O3, numberText: '2026-0000034' }),
      line({ orderId: O1, numberText: '2025-0000900' }),
      line({ orderId: O2, numberText: '2026-0000031' }),
    ])
    expect(result.map((order) => order.numberText)).toEqual(['2025-0000900', '2026-0000031', '2026-0000034'])
  })

  it('R23: sin lineas no espera nadie', () => {
    expect(waitingOrders([])).toEqual([])
  })
})

describe('surplusPackages: el excedente (R23)', () => {
  it('R23: 20 en stock y 8 que esperan dejan 12', () => {
    const waiting = waitingOrders([
      line({ orderId: O1, orderedPackages: 5 }),
      line({ orderId: O2, numberText: '2026-0000002', orderedPackages: 3 }),
    ])
    expect(waitingPackages(waiting)).toBe(8)
    expect(surplusPackages(20, waiting)).toBe(12)
  })

  it('R23: no baja de cero cuando esperan mas envases de los que hay', () => {
    expect(surplusPackages(4, waitingOrders([line({ orderedPackages: 9 })]))).toBe(0)
  })

  it('R23: sin pedidos que esperen, el excedente es todo el stock', () => {
    expect(surplusPackages(7, [])).toBe(7)
  })
})

describe('normalizeDeliveryNote: la nota (R23)', () => {
  it('R23: recorta los espacios de los extremos', () => {
    expect(normalizeDeliveryNote('  Venta mostrador, factura 0012  ')).toBe('Venta mostrador, factura 0012')
  })

  it('R23: una nota vacia o solo de espacios es sin nota', () => {
    expect(normalizeDeliveryNote('')).toBeNull()
    expect(normalizeDeliveryNote('   \n\t ')).toBeNull()
    expect(normalizeDeliveryNote(null)).toBeNull()
  })

  it('R23: no recorta el tope: lo valida quien llama', () => {
    const long = 'a'.repeat(DIRECT_DELIVERY_NOTE_MAX_LENGTH + 1)
    expect(normalizeDeliveryNote(long)).toBe(long)
    expect(DIRECT_DELIVERY_NOTE_MAX_LENGTH).toBe(500)
  })
})

describe('directAllocations: la forma de la entrega de pedido, con el producto como linea (R23)', () => {
  it('R23: cada asignacion lleva el producto como presentationLineId y conserva el orden', () => {
    expect(
      directAllocations(PRODUCT, [
        { batchId: B2, packages: 3 },
        { batchId: B1, packages: 1 },
      ]),
    ).toEqual([
      { presentationLineId: PRODUCT, batchId: B2, packages: 3 },
      { presentationLineId: PRODUCT, batchId: B1, packages: 1 },
    ])
  })

  it('R23: las reglas de bloque de la entrega de pedido sirven tal cual', () => {
    const blocks = [
      { customerId: 'c-1', allocations: directAllocations(PRODUCT, [{ batchId: B1, packages: 2 }]) },
      { customerId: 'C-1', allocations: directAllocations(PRODUCT, [{ batchId: B1, packages: 1 }]) },
      { customerId: null, allocations: [] },
      { customerId: 'c-2', allocations: directAllocations(PRODUCT, [{ batchId: B2, packages: 0 }]) },
    ]
    expect([...checkDeliveryBlocks(blocks)]).toEqual([
      [1, 'duplicate_customer'],
      [2, 'missing_customer'],
      [3, 'no_packages'],
    ])
  })

  it('R23: la suma por lote entre clientes sale de la misma funcion que la entrega de pedido', () => {
    const allocations = flattenBlocks([
      { customerId: 'c-1', allocations: directAllocations(PRODUCT, [{ batchId: B1, packages: 7 }]) },
      { customerId: 'c-2', allocations: directAllocations(PRODUCT, [{ batchId: B1, packages: 3 }]) },
    ])
    expect(packagesLeftInBatch(12, allocations, B1)).toBe(2)
  })
})

describe('checkDirectDelivery: el tope (R23)', () => {
  it('R23: sin envases es empty, antes que cualquier tope', () => {
    expect(checkDirectDelivery(0, BATCHES, [])).toEqual({ kind: 'empty' })
    expect(checkDirectDelivery(0, BATCHES, directAllocations(PRODUCT, [{ batchId: B1, packages: 0 }]))).toEqual({
      kind: 'empty',
    })
  })

  it('R23: con excedente 12, 12 envases pasan', () => {
    const allocations = directAllocations(PRODUCT, [
      { batchId: B1, packages: 7 },
      { batchId: B2, packages: 5 },
    ])
    expect(checkDirectDelivery(12, BATCHES, allocations)).toEqual({ kind: 'ok' })
  })

  it('R23: con excedente 12, 13 envases superan el excedente', () => {
    const allocations = directAllocations(PRODUCT, [
      { batchId: B1, packages: 8 },
      { batchId: B2, packages: 5 },
    ])
    expect(checkDirectDelivery(12, BATCHES, allocations)).toEqual({ kind: 'exceeds_surplus', surplus: 12 })
  })

  it('R23: el excedente se mira antes que el lote', () => {
    const allocations = directAllocations(PRODUCT, [{ batchId: B2, packages: 13 }])
    expect(checkDirectDelivery(12, BATCHES, allocations).kind).toBe('exceeds_surplus')
  })

  it('R23: dentro del excedente, un lote que no alcanza es exceeds_batch, sumando entre clientes', () => {
    const allocations = flattenBlocks([
      { customerId: 'c-1', allocations: directAllocations(PRODUCT, [{ batchId: B2, packages: 5 }]) },
      { customerId: 'c-2', allocations: directAllocations(PRODUCT, [{ batchId: B2, packages: 4 }]) },
    ])
    expect(checkDirectDelivery(12, BATCHES, allocations)).toEqual({ kind: 'exceeds_batch', batchIds: [B2] })
  })

  it('R23: con batches en null no se mira el lote (lo hace quien lo tiene bloqueado)', () => {
    const allocations = directAllocations(PRODUCT, [{ batchId: B2, packages: 10 }])
    expect(checkDirectDelivery(12, null, allocations)).toEqual({ kind: 'ok' })
  })

  it('R23: un lote que no esta en batches cuenta con 0 disponibles', () => {
    const allocations = directAllocations(PRODUCT, [{ batchId: 'batch-x', packages: 1 }])
    expect(checkDirectDelivery(12, BATCHES, allocations)).toEqual({ kind: 'exceeds_batch', batchIds: ['batch-x'] })
  })
})

const SHEET_PATH = 'app/(private)/inventario/components/direct-delivery-sheet.tsx'
const SERVER_PATH = 'lib/modules/pedidos/domain/deliver-direct.ts'

/** Las reglas que el sheet y el servidor deben tomar del barrel de `pedidos`, no reescribir. */
const SHARED_RULES = [
  'checkDirectDelivery',
  'checkDeliveryBlocks',
  'flattenBlocks',
  'packagesLeftInBatch',
  'batchesOverAvailable',
  'normalizeDeliveryNote',
] as const

function sourceWithoutComments(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8')
    .split('\n')
    .filter((text) => {
      const trimmed = text.trim()
      return !(trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*'))
    })
    .join('\n')
}

function importedFromPedidos(source: string): string {
  const match = /import\s*\{([^}]*)\}\s*from\s*'@\/lib\/modules\/pedidos'/.exec(source)
  return match?.[1] ?? ''
}

describe('las mismas funciones puras en el sheet y en el servidor (R23)', () => {
  it('R23: el sheet importa del barrel de pedidos cada regla, la llama y no la redefine', () => {
    const source = sourceWithoutComments(SHEET_PATH)
    const imported = importedFromPedidos(source)

    for (const rule of SHARED_RULES) {
      expect(imported, `el sheet debe importar ${rule} de @/lib/modules/pedidos`).toMatch(new RegExp(`\\b${rule}\\b`))
      expect(source, `el sheet debe llamar a ${rule}`).toMatch(new RegExp(`\\b${rule}\\(`))
      expect(source, `el sheet no debe redefinir ${rule}`).not.toMatch(
        new RegExp(`(function\\s+${rule}\\b|const\\s+${rule}\\s*=)`),
      )
    }
  })

  // 2026-10-16: deliver-direct.ts ya es real; sustituye al it.todo de F2. Importa por ruta relativa
  // porque es parte del modulo.
  it('R23: deliver-direct.ts toma del dominio las reglas del tope y de los bloques, las llama y no las redefine', () => {
    const source = sourceWithoutComments(SERVER_PATH)
    const rules = ['checkDirectDelivery', 'directAllocations', 'normalizeDeliveryNote', 'surplusPackages', 'waitingOrders', 'checkDeliveryBlocks']
    const imported = [...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\/(?:direct-delivery|order-delivery)'/g)]
      .map((m) => m[1] ?? '')
      .join(',')

    for (const rule of rules) {
      expect(imported, `deliver-direct.ts debe importar ${rule} del dominio`).toMatch(new RegExp(`\\b${rule}\\b`))
      expect(source, `deliver-direct.ts debe llamar a ${rule}`).toMatch(new RegExp(`\\b${rule}\\(`))
      expect(source, `deliver-direct.ts no debe redefinir ${rule}`).not.toMatch(
        new RegExp(`(function\\s+${rule}\\b|const\\s+${rule}\\s*=)`),
      )
    }
  })
})

describe('el tope de productos por peticion del listado', () => {
  it('R8: son 200 productos por llamada', () => {
    expect(DIRECT_DELIVERY_SURPLUS_MAX_PRODUCTS).toBe(200)
  })
})
