import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, expectTypeOf, it } from 'vitest'

import { errorMessage } from '@/lib/modules/errores'
import { IntegracionesError, WhatsappOrderNotFoundError } from '@/lib/modules/integraciones/domain/errors'
import {
  contextValuesOf,
  CUSTOMER_ORDER_STAGE,
  customerDateOf,
  customerOrderOf,
  isOpenCustomerOrder,
  orderDetailTextOf,
  UNNAMED_PRESENTATION_TEXT,
  WHATSAPP_SYSTEM_CONSTANT_KEYS,
  type OpenCustomerOrderSummary,
  type WhatsappChatContext,
  type WhatsappCustomerOrder,
  type WhatsappCustomerOrderLine,
  type WhatsappCustomerOrderStatus,
} from '@/lib/modules/integraciones/domain/whatsapp-chat-context'
import {
  ORDER_STATUS_VALUES,
  ORDER_STATUSES_NOT_IN_PROGRESS,
  orderedPackages,
  remainingPackages,
  type CustomerOrderSummary,
  type OrderDeliveryProgress,
  type OrderDeliveryProgressLine,
  type OrderStatus,
} from '@/lib/modules/pedidos'

const ORDER_ID = '6f1c2b8e-3d4a-4c5b-9e6f-7a8b9c0d1e2f'
const RECIPE_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
const BIDON = '11111111-1111-4111-8111-111111111111'
const GARRAFA = '22222222-2222-4222-8222-222222222222'
const CUBETA = '33333333-3333-4333-8333-333333333333'

const OPEN_STATUSES = ORDER_STATUS_VALUES.filter(
  (status) => !(ORDER_STATUSES_NOT_IN_PROGRESS as readonly OrderStatus[]).includes(status),
) as WhatsappCustomerOrderStatus[]

function summary(overrides: Partial<OpenCustomerOrderSummary> = {}): OpenCustomerOrderSummary {
  return {
    id: ORDER_ID,
    number: { year: 2026, sequence: 128 },
    status: 'EN_CURSO',
    recipeId: RECIPE_ID,
    createdAt: new Date('2026-10-20T15:30:00.000Z'),
    ...overrides,
  }
}

function progressLine(overrides: Partial<OrderDeliveryProgressLine> = {}): OrderDeliveryProgressLine {
  return { presentationId: BIDON, packages: 10, packedPackages: null, packedSurplusPackages: 0, deliveredPackages: 0, ...overrides }
}

function progress(lines: readonly OrderDeliveryProgressLine[]): OrderDeliveryProgress {
  return { id: ORDER_ID, recipeId: RECIPE_ID, lines }
}

const PRESENTATIONS = new Map([
  [BIDON, { name: 'Bidón 20 L' }],
  [GARRAFA, { name: 'Garrafa 5 L' }],
])
const RECIPES = new Map([[RECIPE_ID, { name: 'Cloro · Concentrado' }]])

function line(overrides: Partial<WhatsappCustomerOrderLine> = {}): WhatsappCustomerOrderLine {
  return { presentationId: BIDON, presentationName: 'Bidón 20 L', ordered: 10, delivered: 6, pending: 4, ...overrides }
}

function order(overrides: Partial<WhatsappCustomerOrder> = {}): WhatsappCustomerOrder {
  return {
    id: ORDER_ID,
    number: '2026-0000128',
    status: 'EN_CURSO',
    requestedAt: '2026-10-20T15:30:00.000Z',
    total: null,
    productName: 'Cloro · Concentrado',
    lines: [line()],
    ...overrides,
  }
}

const CUSTOMER = { firstNames: 'Laura', lastNames: 'Gómez Ruiz' }

describe('tipos del contrato', () => {
  it('R51/R53: los tipos del contexto son los del contrato v2', () => {
    expectTypeOf<WhatsappCustomerOrderStatus>().toEqualTypeOf<
      'PENDIENTE' | 'EN_CURSO' | 'POR_EMPACAR' | 'EN_EMPAQUE' | 'BLOQUEADO' | 'POR_ACONDICIONAR' | 'EN_ACONDICIONAMIENTO' | 'TERMINADO'
    >()
    expectTypeOf<WhatsappCustomerOrder>().toEqualTypeOf<{
      readonly id: string
      readonly number: string
      readonly status: WhatsappCustomerOrderStatus
      readonly requestedAt: string
      readonly total: string | null
      readonly productName: string | null
      readonly lines: readonly {
        readonly presentationId: string
        readonly presentationName: string | null
        readonly ordered: number
        readonly delivered: number
        readonly pending: number
      }[]
    }>()
    expectTypeOf<WhatsappChatContext>().toEqualTypeOf<{
      readonly customer: { readonly id: string; readonly name: string }
      readonly orders: readonly WhatsappCustomerOrder[]
      readonly selectedOrderId: string | null
      readonly values: Readonly<Record<string, string | null>>
    }>()
  })
})

describe('isOpenCustomerOrder', () => {
  it.each(ORDER_STATUS_VALUES)('R54: %s es abierto solo si no es entregado ni cancelado', (status) => {
    const closed = (ORDER_STATUSES_NOT_IN_PROGRESS as readonly OrderStatus[]).includes(status)
    const candidate: CustomerOrderSummary = { ...summary(), status }
    expect(isOpenCustomerOrder(candidate)).toBe(!closed)
  })
})

describe('WhatsappOrderNotFoundError', () => {
  it('R54: lleva el código order_not_found y el texto del catálogo', () => {
    const error = new WhatsappOrderNotFoundError()
    expect(error).toBeInstanceOf(IntegracionesError)
    expect(error.code).toBe('order_not_found')
    expect(error.message).toBe(errorMessage('order_not_found'))
  })
})

describe('customerOrderOf', () => {
  it('R51/R53: número visible, estado, fecha ISO, total nulo y nombre del producto', () => {
    const result = customerOrderOf(summary(), progress([]), PRESENTATIONS, RECIPES)
    expect(result).toEqual({
      id: ORDER_ID,
      number: '2026-0000128',
      status: 'EN_CURSO',
      requestedAt: '2026-10-20T15:30:00.000Z',
      total: null,
      productName: 'Cloro · Concentrado',
      lines: [],
    })
    expect(result).not.toHaveProperty('deliveredAt')
  })

  it('R51: sin receta conocida el producto es nulo y sin progreso las líneas quedan vacías', () => {
    const result = customerOrderOf(summary(), null, PRESENTATIONS, new Map())
    expect(result.productName).toBeNull()
    expect(result.lines).toEqual([])
  })

  it('R51: las líneas salen en el orden del reparto con su presentación', () => {
    const result = customerOrderOf(
      summary(),
      progress([progressLine({ presentationId: GARRAFA, packages: 5, deliveredPackages: 5 }), progressLine()]),
      PRESENTATIONS,
      RECIPES,
    )
    expect(result.lines.map((l) => [l.presentationId, l.presentationName])).toEqual([
      [GARRAFA, 'Garrafa 5 L'],
      [BIDON, 'Bidón 20 L'],
    ])
  })

  it('R51: una presentación desconocida deja su nombre nulo', () => {
    const result = customerOrderOf(summary(), progress([progressLine({ presentationId: CUBETA })]), PRESENTATIONS, RECIPES)
    expect(result.lines[0].presentationName).toBeNull()
  })

  it('R52: pedidos usa el conteo del empaque menos el excedente; entregados y faltantes como Pedidos', () => {
    const lines = [
      progressLine({ packages: 10, packedPackages: null, packedSurplusPackages: 0, deliveredPackages: 6 }),
      progressLine({ presentationId: GARRAFA, packages: 10, packedPackages: 12, packedSurplusPackages: 2, deliveredPackages: 4 }),
      progressLine({ presentationId: CUBETA, packages: 8, packedPackages: 7, packedSurplusPackages: 0, deliveredPackages: 9 }),
    ]
    const result = customerOrderOf(summary(), progress(lines), PRESENTATIONS, RECIPES)
    expect(result.lines.map((l) => [l.ordered, l.delivered, l.pending])).toEqual([
      [10, 6, 4],
      [10, 4, 6],
      [7, 9, 0],
    ])
    for (const [index, source] of lines.entries()) {
      const ordered = orderedPackages(source)
      expect(result.lines[index].ordered).toBe(ordered)
      expect(result.lines[index].pending).toBe(
        remainingPackages({ presentationLineId: source.presentationId, orderedPackages: ordered, deliveredPackages: source.deliveredPackages }),
      )
    }
  })
})

describe('customerDateOf', () => {
  it('R61: da DD/MM/AAAA', () => {
    expect(customerDateOf(new Date('2026-03-07T12:00:00.000Z'))).toBe('07/03/2026')
  })

  it('R61: cerca de medianoche usa el día UTC', () => {
    expect(customerDateOf(new Date('2026-10-20T23:59:59.999Z'))).toBe('20/10/2026')
    expect(customerDateOf(new Date('2026-10-21T00:00:00.000Z'))).toBe('21/10/2026')
    expect(customerDateOf(new Date('2026-10-21T05:30:00.000+06:00'))).toBe('20/10/2026')
  })
})

describe('orderDetailTextOf', () => {
  it('R62: una parte por línea, en orden, unidas por «; »', () => {
    expect(
      orderDetailTextOf([
        line(),
        line({ presentationId: GARRAFA, presentationName: 'Garrafa 5 L', ordered: 5, delivered: 5, pending: 0 }),
      ]),
    ).toBe('10 × Bidón 20 L (entregado 6, faltan 4); 5 × Garrafa 5 L (entregado 5, faltan 0)')
  })

  it('R62: «falta» en singular cuando falta 1', () => {
    expect(orderDetailTextOf([line({ ordered: 3, delivered: 2, pending: 1 })])).toBe('3 × Bidón 20 L (entregado 2, falta 1)')
  })

  it('R62: sin nombre de presentación escribe «presentación sin nombre»', () => {
    expect(UNNAMED_PRESENTATION_TEXT).toBe('presentación sin nombre')
    expect(orderDetailTextOf([line({ presentationName: null })])).toBe('10 × presentación sin nombre (entregado 6, faltan 4)')
    expect(orderDetailTextOf([line({ presentationName: ' \t ' })])).toBe('10 × presentación sin nombre (entregado 6, faltan 4)')
  })

  it('R62: sin líneas el detalle es nulo', () => {
    expect(orderDetailTextOf([])).toBeNull()
  })

  it('R62: no contiene saltos de línea ni tabuladores aunque el nombre los traiga', () => {
    const text = orderDetailTextOf([line({ presentationName: 'Bidón\n20\tL     grande' })])
    expect(text).toBe('10 × Bidón 20 L grande (entregado 6, faltan 4)')
    expect(text).not.toMatch(/[\n\r\t]/)
    expect(text).not.toMatch(/ {5,}/)
  })
})

describe('CUSTOMER_ORDER_STAGE', () => {
  const STAGES = ['recibido', 'en preparación', 'entregado', 'cancelado']

  it('R60: cada estado del sistema tiene exactamente una de las cuatro etiquetas', () => {
    expect(Object.keys(CUSTOMER_ORDER_STAGE).sort()).toEqual([...ORDER_STATUS_VALUES].sort())
    for (const status of ORDER_STATUS_VALUES) expect(STAGES).toContain(CUSTOMER_ORDER_STAGE[status])
    expect(new Set(Object.values(CUSTOMER_ORDER_STAGE))).toEqual(new Set(STAGES))
  })

  it('R60: PENDIENTE va solo; los siete en curso comparten etiqueta; entregado y cancelado van aparte', () => {
    const inProgress = OPEN_STATUSES.filter((status) => status !== 'PENDIENTE')
    expect(inProgress).toHaveLength(7)
    const stageOf = (status: OrderStatus) => CUSTOMER_ORDER_STAGE[status]
    expect(new Set(inProgress.map(stageOf)).size).toBe(1)
    const distinct = new Set([stageOf('PENDIENTE'), stageOf(inProgress[0]), stageOf('ENTREGADO'), stageOf('CANCELADO')])
    expect(distinct.size).toBe(4)
    expect(stageOf('PENDIENTE')).toBe('recibido')
    expect(stageOf('EN_CURSO')).toBe('en preparación')
    expect(stageOf('ENTREGADO')).toBe('entregado')
    expect(stageOf('CANCELADO')).toBe('cancelado')
  })

  it.each(OPEN_STATUSES)('R60: pedido.estado de un pedido %s es la etiqueta del mapa', (status) => {
    const values = contextValuesOf({ customer: CUSTOMER, companyName: 'Acme', selected: order({ status }), variables: [] })
    expect(values['pedido.estado']).toBe(CUSTOMER_ORDER_STAGE[status])
  })

  it('R60: ninguna otra pieza del módulo escribe una etiqueta de estado del cliente', () => {
    const root = join(process.cwd(), 'lib/modules/integraciones')
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (path.endsWith('.ts')) files.push(path)
      }
    }
    walk(root)
    const offenders = files.filter(
      (file) => !file.endsWith('whatsapp-chat-context.ts') && /'(recibido|en preparación)'/.test(readFileSync(file, 'utf8')),
    )
    expect(offenders).toEqual([])
  })
})

describe('contextValuesOf', () => {
  it('R55/R56: una entrada por cada una de las siete constantes y por cada variable propia', () => {
    expect([...WHATSAPP_SYSTEM_CONSTANT_KEYS]).toEqual([
      'cliente.nombre',
      'empresa.nombre',
      'pedido.numero',
      'pedido.estado',
      'pedido.fecha_solicitud',
      'pedido.total',
      'pedido.detalle',
    ])
    const values = contextValuesOf({
      customer: CUSTOMER,
      companyName: 'Químicos Acme',
      selected: order(),
      variables: [
        { key: 'horario', value: 'L-V 9 a 18' },
        { key: 'telefono_soporte', value: '5555' },
      ],
    })
    expect(values).toEqual({
      'cliente.nombre': 'Laura Gómez Ruiz',
      'empresa.nombre': 'Químicos Acme',
      'pedido.numero': '2026-0000128',
      'pedido.estado': CUSTOMER_ORDER_STAGE.EN_CURSO,
      'pedido.fecha_solicitud': '20/10/2026',
      'pedido.total': null,
      'pedido.detalle': '10 × Bidón 20 L (entregado 6, faltan 4)',
      horario: 'L-V 9 a 18',
      telefono_soporte: '5555',
    })
    for (const value of Object.values(values)) expect(value === null || typeof value === 'string').toBe(true)
  })

  it('R56: sin pedido elegido las cinco pedido.* están presentes y nulas', () => {
    const values = contextValuesOf({ customer: CUSTOMER, companyName: 'Acme', selected: null, variables: [] })
    for (const key of WHATSAPP_SYSTEM_CONSTANT_KEYS) expect(values).toHaveProperty([key])
    const orderKeys = WHATSAPP_SYSTEM_CONSTANT_KEYS.filter((key) => key.startsWith('pedido.'))
    expect(orderKeys).toHaveLength(5)
    for (const key of orderKeys) expect(values[key]).toBeNull()
    expect(values['cliente.nombre']).toBe('Laura Gómez Ruiz')
  })

  it('R53/R56: pedido.total es nulo aunque haya pedido elegido', () => {
    const values = contextValuesOf({ customer: CUSTOMER, companyName: 'Acme', selected: order(), variables: [] })
    expect(values['pedido.total']).toBeNull()
  })

  it('R56/R62: un pedido elegido sin líneas deja pedido.detalle nulo', () => {
    const values = contextValuesOf({ customer: CUSTOMER, companyName: 'Acme', selected: order({ lines: [] }), variables: [] })
    expect(values['pedido.detalle']).toBeNull()
    expect(values['pedido.numero']).toBe('2026-0000128')
  })

  it('R56: un valor que no se resuelve es nulo, nunca una cadena vacía ni ausente', () => {
    const values = contextValuesOf({
      customer: { firstNames: '', lastNames: '' },
      companyName: null,
      selected: null,
      variables: [
        { key: 'vacia', value: '' },
        { key: 'espacios', value: '   ' },
      ],
    })
    expect(values['cliente.nombre']).toBeNull()
    expect(values['empresa.nombre']).toBeNull()
    expect(values).toHaveProperty('vacia', null)
    expect(values).toHaveProperty('espacios', null)
    expect(Object.values(values)).not.toContain('')
    expect(values).toHaveProperty(['empresa.nombre'], null)
  })

  it('R56: la empresa dada de baja (nombre nulo) y la cadena vacía dan empresa.nombre nulo', () => {
    for (const companyName of [null, '']) {
      const values = contextValuesOf({ customer: CUSTOMER, companyName, selected: null, variables: [] })
      expect(values['empresa.nombre']).toBeNull()
    }
  })
})
