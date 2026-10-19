// La regla pura de la entrega: lo que falta por linea y el tope por linea y por lote. La misma
// funcion la llaman el sheet, con los lotes que leyo, y el servidor, con `batches: null`.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  DELIVERY_MAX_ALLOCATIONS,
  batchesOverAvailable,
  checkDelivery,
  checkDeliveryBlocks,
  flattenBlocks,
  packagesInLine,
  packagesLeftInBatch,
  remainingPackages,
  type DeliveryAllocation,
  type DeliveryBatchState,
  type DeliveryCustomerBlock,
  type DeliveryLineState,
} from '@/lib/modules/pedidos'

const L1 = 'line-1'
const L2 = 'line-2'
const B1 = 'batch-1'
const B2 = 'batch-2'
const B3 = 'batch-3'

const LINES: readonly DeliveryLineState[] = [
  { presentationLineId: L1, orderedPackages: 10, deliveredPackages: 4 },
  { presentationLineId: L2, orderedPackages: 5, deliveredPackages: 0 },
]

const BATCHES: readonly DeliveryBatchState[] = [
  { batchId: B1, presentationLineId: L1, availablePackages: 3 },
  { batchId: B2, presentationLineId: L1, availablePackages: 8 },
  { batchId: B3, presentationLineId: L2, availablePackages: 5 },
]

const alloc = (presentationLineId: string, batchId: string, packages: number): DeliveryAllocation => ({
  presentationLineId,
  batchId,
  packages,
})

describe('remainingPackages (R16)', () => {
  it('R16: lo que falta es pedidos menos entregados, nunca negativo', () => {
    expect(remainingPackages({ presentationLineId: L1, orderedPackages: 10, deliveredPackages: 4 })).toBe(6)
    expect(remainingPackages({ presentationLineId: L1, orderedPackages: 10, deliveredPackages: 10 })).toBe(0)
    expect(remainingPackages({ presentationLineId: L1, orderedPackages: 10, deliveredPackages: 12 })).toBe(0)
  })
})

describe('checkDelivery (R16, R11, R12, R15, R18, R20, R26, R27)', () => {
  it.each<{ caso: string; allocations: readonly DeliveryAllocation[]; batches: readonly DeliveryBatchState[] | null; esperado: unknown }>([
    { caso: 'R15: sin asignaciones es empty', allocations: [], batches: BATCHES, esperado: { kind: 'empty' } },
    {
      caso: 'R15: asignaciones todas en cero son empty',
      allocations: [alloc(L1, B1, 0), alloc(L2, B3, 0)],
      batches: BATCHES,
      esperado: { kind: 'empty' },
    },
    {
      caso: 'R11 R18: pasar de lo que falta en una linea es exceeds_remaining con esa linea',
      allocations: [alloc(L1, B2, 7), alloc(L2, B3, 1)],
      batches: BATCHES,
      esperado: { kind: 'exceeds_remaining', presentationLineIds: [L1] },
    },
    {
      caso: 'R12 R20: pasar de lo que tiene un lote es exceeds_batch con ese lote',
      allocations: [alloc(L1, B1, 4)],
      batches: BATCHES,
      esperado: { kind: 'exceeds_batch', batchIds: [B1] },
    },
    {
      caso: 'R16: el exceso por linea va antes que el exceso por lote',
      allocations: [alloc(L1, B1, 7)],
      batches: BATCHES,
      esperado: { kind: 'exceeds_remaining', presentationLineIds: [L1] },
    },
    {
      caso: 'R16: con batches null no se comprueba el tope por lote',
      allocations: [alloc(L1, B1, 6)],
      batches: null,
      esperado: { kind: 'ok', completesOrder: false },
    },
    {
      caso: 'R26: si a alguna linea le siguen faltando envases, completesOrder es false',
      allocations: [alloc(L1, B2, 6)],
      batches: BATCHES,
      esperado: { kind: 'ok', completesOrder: false },
    },
    {
      caso: 'R27: si no le falta nada a ninguna linea, completesOrder es true',
      allocations: [alloc(L1, B2, 6), alloc(L2, B3, 5)],
      batches: BATCHES,
      esperado: { kind: 'ok', completesOrder: true },
    },
    {
      caso: 'R16: varias asignaciones a la misma linea se suman',
      allocations: [alloc(L1, B1, 3), alloc(L1, B2, 3), alloc(L2, B3, 5)],
      batches: BATCHES,
      esperado: { kind: 'ok', completesOrder: true },
    },
    {
      caso: 'R11 R18: la suma de varias asignaciones a la misma linea tambien topa',
      allocations: [alloc(L1, B1, 3), alloc(L1, B2, 4)],
      batches: BATCHES,
      esperado: { kind: 'exceeds_remaining', presentationLineIds: [L1] },
    },
    {
      caso: 'R12: un lote que no esta entre los leidos no tiene envases disponibles',
      allocations: [alloc(L2, 'batch-x', 1)],
      batches: BATCHES,
      esperado: { kind: 'exceeds_batch', batchIds: ['batch-x'] },
    },
    {
      caso: 'R18: una linea que no es del pedido no tiene envases que faltan',
      allocations: [alloc('line-x', B1, 1)],
      batches: null,
      esperado: { kind: 'exceeds_remaining', presentationLineIds: ['line-x'] },
    },
  ])('$caso', ({ allocations, batches, esperado }) => {
    expect(checkDelivery(LINES, batches, allocations)).toEqual(esperado)
  })

  it('R27: una linea ya completa no impide completar el pedido', () => {
    const lines: readonly DeliveryLineState[] = [
      { presentationLineId: L1, orderedPackages: 4, deliveredPackages: 4 },
      { presentationLineId: L2, orderedPackages: 5, deliveredPackages: 2 },
    ]

    expect(checkDelivery(lines, BATCHES, [alloc(L2, B3, 3)])).toEqual({ kind: 'ok', completesOrder: true })
  })

  it('R11 R12: devuelve todas las lineas y todos los lotes que exceden, no solo el primero', () => {
    expect(checkDelivery(LINES, BATCHES, [alloc(L1, B2, 7), alloc(L2, B3, 6)])).toEqual({
      kind: 'exceeds_remaining',
      presentationLineIds: [L1, L2],
    })
    expect(checkDelivery(LINES, BATCHES, [alloc(L1, B1, 4), alloc(L2, B3, 5)])).toEqual({
      kind: 'exceeds_batch',
      batchIds: [B1],
    })
  })

  it('R16: el tope de asignaciones por entrega es 200', () => {
    expect(DELIVERY_MAX_ALLOCATIONS).toBe(200)
  })
})

// 2026-10-15: reglas de bloque y stock por lote de la entrega a varios clientes.
const CA = 'cliente-a'
const CB = 'cliente-b'

const bloque = (customerId: string | null, ...allocations: DeliveryAllocation[]): DeliveryCustomerBlock => ({
  customerId,
  allocations,
})

describe('checkDeliveryBlocks', () => {
  it('R16 R17 R18 R20: bloques bien formados no dan ningun problema', () => {
    expect(checkDeliveryBlocks([bloque(CA, alloc(L1, B1, 1)), bloque(CB, alloc(L2, B3, 2))])).toEqual(new Map())
  })

  it('R20: sin bloques no hay problemas por bloque', () => {
    expect(checkDeliveryBlocks([])).toEqual(new Map())
  })

  it('R16: un bloque sin cliente es missing_customer', () => {
    expect(checkDeliveryBlocks([bloque(CA, alloc(L1, B1, 1)), bloque(null, alloc(L1, B2, 1))])).toEqual(
      new Map([[1, 'missing_customer']]),
    )
  })

  it('R17: el cliente repetido se marca en el bloque posterior, no en el primero', () => {
    expect(
      checkDeliveryBlocks([bloque(CA, alloc(L1, B1, 1)), bloque(CB, alloc(L1, B2, 1)), bloque(CA, alloc(L2, B3, 1))]),
    ).toEqual(new Map([[2, 'duplicate_customer']]))
  })

  it('QC-282 R17 R21: el mismo uuid de cliente en distinta capitalizacion es duplicate_customer', () => {
    const uuid = 'c0000000-0000-4000-8000-00000000000a'
    expect(checkDeliveryBlocks([bloque(uuid, alloc(L1, B1, 1)), bloque(uuid.toUpperCase(), alloc(L1, B2, 1))])).toEqual(
      new Map([[1, 'duplicate_customer']]),
    )
  })

  it('R17: un tercer bloque con el mismo cliente tambien se marca', () => {
    expect(
      checkDeliveryBlocks([bloque(CA, alloc(L1, B1, 1)), bloque(CA, alloc(L1, B2, 1)), bloque(CA, alloc(L2, B3, 1))]),
    ).toEqual(
      new Map([
        [1, 'duplicate_customer'],
        [2, 'duplicate_customer'],
      ]),
    )
  })

  it('R18: un bloque con cliente sin envases es no_packages, tambien con asignaciones en cero', () => {
    expect(checkDeliveryBlocks([bloque(CA), bloque(CB, alloc(L1, B1, 0))])).toEqual(
      new Map([
        [0, 'no_packages'],
        [1, 'no_packages'],
      ]),
    )
  })

  it('R18: cada bloque lleva como mucho un problema, el primero en el orden R16, R17, R18', () => {
    const issues = checkDeliveryBlocks([bloque(CA, alloc(L1, B1, 1)), bloque(null), bloque(CA)])

    expect(issues).toEqual(
      new Map([
        [1, 'missing_customer'],
        [2, 'duplicate_customer'],
      ]),
    )
  })

  it('R17: un bloque sin cliente no cuenta como cliente visto', () => {
    expect(checkDeliveryBlocks([bloque(null, alloc(L1, B1, 1)), bloque(CA, alloc(L1, B2, 1))])).toEqual(
      new Map([[0, 'missing_customer']]),
    )
  })
})

describe('flattenBlocks', () => {
  it('R20: junta las asignaciones de todos los bloques en orden bloque y asignacion', () => {
    const a = alloc(L1, B1, 2)
    const b = alloc(L1, B1, 1)
    const c = alloc(L2, B3, 4)

    expect(flattenBlocks([bloque(CA, a), bloque(CB, b, c)])).toEqual([a, b, c])
    expect(flattenBlocks([])).toEqual([])
  })

  it('R20: checkDelivery sobre las asignaciones de todos los bloques topa por la suma de los clientes', () => {
    const bloques = [bloque(CA, alloc(L1, B2, 4)), bloque(CB, alloc(L1, B2, 3))]

    expect(checkDelivery(LINES, BATCHES, flattenBlocks(bloques))).toEqual({
      kind: 'exceeds_remaining',
      presentationLineIds: [L1],
    })
    expect(checkDelivery(LINES, BATCHES, flattenBlocks([bloque(CA, alloc(L1, B1, 2)), bloque(CB, alloc(L1, B1, 2))]))).toEqual({
      kind: 'exceeds_batch',
      batchIds: [B1],
    })
  })
})

describe('packagesLeftInBatch', () => {
  const todos = [alloc(L1, B1, 1), alloc(L1, B2, 5), alloc(L1, B1, 1)]

  it('R13: los disponibles de un lote son sus envases menos los escritos en ese lote por todos los bloques', () => {
    expect(packagesLeftInBatch(3, todos, B1)).toBe(1)
    expect(packagesLeftInBatch(8, todos, B2)).toBe(3)
  })

  it('R13: un lote sin nada escrito conserva todos sus envases', () => {
    expect(packagesLeftInBatch(5, todos, B3)).toBe(5)
  })

  it('R13 R15: nunca baja de cero aunque lo escrito supere lo disponible', () => {
    expect(packagesLeftInBatch(1, todos, B1)).toBe(0)
  })

  it('R14: con las asignaciones de los demas bloques da el tope del campo de un bloque', () => {
    const bloques = [bloque(CA, alloc(L1, B1, 2)), bloque(CB, alloc(L1, B1, 1))]
    const otros = flattenBlocks(bloques.filter((_, i) => i !== 1))

    expect(packagesLeftInBatch(3, otros, B1)).toBe(1)
  })

  it('R13: las asignaciones en cero no restan', () => {
    expect(packagesLeftInBatch(3, [alloc(L1, B1, 0)], B1)).toBe(3)
  })
})

// QC-282 2026-10-15 (m2 del reviewer): el sheet saca de aqui lo que antes sumaba a mano.
describe('batchesOverAvailable', () => {
  it('QC-282 R15: sin exceso no devuelve ningun lote', () => {
    expect(batchesOverAvailable(BATCHES, [alloc(L1, B1, 3), alloc(L1, B2, 8)])).toEqual([])
    expect(batchesOverAvailable(BATCHES, [])).toEqual([])
  })

  it('QC-282 R15: un lote repetido entre dos clientes topa por la suma de ambos', () => {
    const bloques = [bloque(CA, alloc(L1, B1, 2)), bloque(CB, alloc(L1, B1, 2))]

    expect(batchesOverAvailable(BATCHES, flattenBlocks(bloques))).toEqual([B1])
    expect(batchesOverAvailable(BATCHES, flattenBlocks([bloque(CA, alloc(L1, B1, 2)), bloque(CB, alloc(L1, B1, 1))]))).toEqual([])
  })

  it('QC-282 R15: un lote ausente de los leidos cuenta con 0 disponibles', () => {
    expect(batchesOverAvailable(BATCHES, [alloc(L2, 'batch-x', 1)])).toEqual(['batch-x'])
    expect(batchesOverAvailable([], [alloc(L1, B1, 1)])).toEqual([B1])
  })

  it('QC-282 R15: las asignaciones con packages 0 se ignoran, tambien en un lote ausente', () => {
    expect(batchesOverAvailable(BATCHES, [alloc(L1, B1, 3), alloc(L1, B1, 0)])).toEqual([])
    expect(batchesOverAvailable(BATCHES, [alloc(L2, 'batch-x', 0)])).toEqual([])
  })

  it('QC-282 R15: devuelve todos los lotes que exceden, en el orden de las asignaciones', () => {
    expect(batchesOverAvailable(BATCHES, [alloc(L2, B3, 6), alloc(L1, B2, 1), alloc(L1, B1, 4)])).toEqual([B3, B1])
  })

  it('QC-282 R15: coincide con la rama exceeds_batch de checkDelivery', () => {
    const allocations = [alloc(L1, B1, 2), alloc(L1, B1, 2), alloc(L2, 'batch-x', 1)]

    expect(checkDelivery(LINES, BATCHES, allocations)).toEqual({
      kind: 'exceeds_batch',
      batchIds: batchesOverAvailable(BATCHES, allocations),
    })
  })
})

describe('packagesInLine', () => {
  it('QC-282 R11: suma los envases de la presentacion de todos los clientes y lotes', () => {
    const bloques = [bloque(CA, alloc(L1, B1, 2), alloc(L2, B3, 1)), bloque(CB, alloc(L1, B2, 3))]

    expect(packagesInLine(flattenBlocks(bloques), L1)).toBe(5)
    expect(packagesInLine(flattenBlocks(bloques), L2)).toBe(1)
  })

  it('QC-282 R11: una presentacion sin asignaciones da 0', () => {
    expect(packagesInLine([alloc(L1, B1, 2)], L2)).toBe(0)
    expect(packagesInLine([], L1)).toBe(0)
  })

  it('QC-282 R11: las asignaciones con packages 0 no suman', () => {
    expect(packagesInLine([alloc(L1, B1, 0), alloc(L1, B2, 4)], L1)).toBe(4)
    expect(packagesInLine([alloc(L1, B1, 0)], L1)).toBe(0)
  })
})

// QC-223 2026-10-08 (TC): el sheet y el servidor no calculan el tope por su cuenta.
//
// Rutas de import aceptadas (decision del humano, 2026-10-08):
// - el sheet importa del barrel `@/lib/modules/pedidos`, como cualquier consumidor de fuera del
//   modulo;
// - `deliver-order.ts` y `get-order-delivery.ts` importan de `./order-delivery`, porque el barrel de
//   `pedidos` reexporta esos mismos casos de uso e importarlo desde ellos crearia un ciclo.
describe('una sola funcion pura en el sheet y en el servidor (R16)', () => {
  const RAIZ = join(__dirname, '..', '..', '..')
  const FUENTES = [
    { ruta: 'app/(private)/pedidos/components/order-delivery-sheet.tsx', desde: '@/lib/modules/pedidos' },
    { ruta: 'lib/modules/pedidos/domain/deliver-order.ts', desde: './order-delivery' },
    { ruta: 'lib/modules/pedidos/domain/get-order-delivery.ts', desde: './order-delivery' },
  ] as const

  function soloCodigo(texto: string): string {
    return texto
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .split('\n')
      .map((linea) => linea.replace(/\/\/.*$/, ''))
      .join('\n')
  }

  /** Origen de cada import que trae `checkDelivery` o `remainingPackages`. */
  function origenesDeLaRegla(codigo: string): string[] {
    const origenes: string[] = []
    for (const m of codigo.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
      const nombres = (m[1] ?? '').split(',').map((n) => n.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0])
      if (nombres.some((n) => n === 'checkDelivery' || n === 'remainingPackages')) origenes.push(m[2] ?? '')
    }
    return origenes
  }

  /** Restas de envases pedidos menos entregados escritas a mano. */
  const ARITMETICA_PROPIA = [
    /\b\w*ordered\w*\s*-(?!-)/i,
    /-(?!-)\s*[\w.]*delivered\w*/i,
    /\.packages\s*-(?!-)/,
    /Math\.max\(\s*0\s*,/,
  ]
  const aritmeticaPropia = (codigo: string): RegExp[] => ARITMETICA_PROPIA.filter((r) => r.test(codigo))

  it.each(FUENTES)('R16: $ruta importa la regla de $desde y no resta envases por su cuenta', ({ ruta, desde }) => {
    const codigo = soloCodigo(readFileSync(join(RAIZ, ruta), 'utf8'))

    const origenes = origenesDeLaRegla(codigo)
    expect(origenes.length, `${ruta} tiene que importar checkDelivery o remainingPackages`).toBeGreaterThan(0)
    expect(new Set(origenes)).toEqual(new Set([desde]))
    expect(aritmeticaPropia(codigo), `${ruta} calcula el tope por su cuenta`).toEqual([])
  })

  /** Nombres (sin `type`, sin alias) que un import con llaves trae desde `origen`. */
  function nombresImportadosDe(codigo: string, origen: string): string[] {
    const nombres: string[] = []
    for (const m of codigo.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
      if (m[2] !== origen) continue
      for (const n of (m[1] ?? '').split(',')) {
        const limpio = n.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0] ?? ''
        if (limpio) nombres.push(limpio)
      }
    }
    return nombres
  }

  // QC-282 2026-10-15 (decision del humano, design §12 fila R20): el sheet trae las reglas
  // puras del barrel (m2 sumo `batchesOverAvailable` y `packagesInLine`); `deliver-order.ts` trae de `./order-delivery` las dos que usa (el barrel
  // crearia un ciclo y el tope por lote lo aplica inventario con el lote bloqueado).
  const REGLAS_R20 = [
    {
      ruta: 'app/(private)/pedidos/components/order-delivery-sheet.tsx',
      desde: '@/lib/modules/pedidos',
      nombres: ['checkDelivery', 'checkDeliveryBlocks', 'packagesLeftInBatch', 'batchesOverAvailable', 'packagesInLine'],
    },
    {
      ruta: 'lib/modules/pedidos/domain/deliver-order.ts',
      desde: './order-delivery',
      nombres: ['checkDelivery', 'checkDeliveryBlocks'],
    },
  ] as const

  it.each(REGLAS_R20)('QC-282 R20: $ruta importa $nombres de $desde', ({ ruta, desde, nombres }) => {
    const codigo = soloCodigo(readFileSync(join(RAIZ, ruta), 'utf8'))
    const importados = nombresImportadosDe(codigo, desde)
    for (const nombre of nombres) {
      expect(importados, `${ruta} tiene que importar ${nombre} de ${desde}`).toContain(nombre)
    }
  })

  it('QC-282 R20: el detector no cuenta un nombre traido de otra ruta (caso sintetico)', () => {
    const sintetico = soloCodigo(
      [
        "import { checkDelivery, type DeliveryCheck } from '@/lib/modules/pedidos'",
        "import { checkDeliveryBlocks as bloques } from '@/lib/modules/pedidos/domain/order-delivery'",
        "// import { packagesLeftInBatch } from '@/lib/modules/pedidos'",
      ].join('\n'),
    )

    expect(nombresImportadosDe(sintetico, '@/lib/modules/pedidos')).toEqual(['checkDelivery', 'DeliveryCheck'])
    expect(nombresImportadosDe(sintetico, '@/lib/modules/pedidos/domain/order-delivery')).toEqual([
      'checkDeliveryBlocks',
    ])
  })

  it('R16: el detector caza una resta propia y un import de otra ruta (caso sintetico)', () => {
    const sintetico = soloCodigo(
      [
        "import { checkDelivery } from '@/lib/modules/pedidos/domain/order-delivery'",
        'const falta = line.orderedPackages - line.deliveredPackages',
      ].join('\n'),
    )

    expect(origenesDeLaRegla(sintetico)).toEqual(['@/lib/modules/pedidos/domain/order-delivery'])
    expect(aritmeticaPropia(sintetico).length).toBeGreaterThan(0)
    expect(aritmeticaPropia(soloCodigo('const x = Math.max(0, pedidos - hechos)')).length).toBeGreaterThan(0)
  })
})
