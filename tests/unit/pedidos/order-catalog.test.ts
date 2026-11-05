// QC-87 T2 (R45, R46) — `OrderCatalog`: la consulta por id que `pedidos` publica para que
// `asignaciones` sepa el ESTADO de un pedido sin tocar `prisma.order`.
//
// HONESTIDAD: este archivo NO toca Postgres. El cliente Prisma esta sustituido por un DOBLE
// que se comporta como la base —aplica el `where` que le llega— y guarda los argumentos; lo
// que se prueba es el CONTRATO (que exista `findAliveById`, que `OrderAssignmentTarget` lleve
// solo `id` y `status`), el MAPEO y la FORMA de la consulta —en particular el
// `deleted_at IS NULL` en el `where`, que es lo que hace que «dado de baja» y «no existe»
// sean el mismo `null` (QC-34 R33)—. Que la base respete ese filtro lo cubren los tests de
// integracion de `pedidos`.
//
// MUTACION COMPROBADA (2026-09-13): quitando `deletedAt: null` del `where` del adaptador, el
// caso «pedido dado de baja -> null» se pone ROJO, porque el doble deja de recibir el filtro y
// devuelve entonces la fila del pedido de baja. Salida anotada en la bitacora.
//
// Es un cambio ADITIVO en `pedidos`: el ultimo bloque afirma que los seis casos de uso de
// QC-34 y su tabla de transiciones siguen ahi y que el barrel no perdio nada.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { OrderAssignmentTarget } from '@/lib/modules/pedidos'

/** Doble del cliente Prisma. */
const findFirst = vi.fn()
const updateMany = vi.fn()
const findMany = vi.fn()
const count = vi.fn()
/** Los resumenes salen de las lineas: una fila por linea, y su reparto en una segunda consulta. */
const lineFindMany = vi.fn()
const lineCount = vi.fn()
const distributionFindMany = vi.fn()
vi.mock('@/lib/shared/db/prisma', () => ({
  prisma: {
    order: { findFirst, updateMany, findMany, count },
    orderLine: { findMany: lineFindMany, count: lineCount },
    orderPresentationLine: { findMany: distributionFindMany },
  },
}))

/** Una fila de `order_lines` con su pedido, como la pide el resumen. */
function filaDeLinea(overrides: Record<string, unknown> = {}) {
  return {
    id: 'l-1',
    orderId: 'o-1',
    recipeId: 'r-1',
    quantity: { toFixed: () => '10.0000' },
    status: 'POR_EMPACAR',
    unitId: null,
    finishedAt: null,
    packedBy: null,
    conditionedBy: null,
    order: { orderYear: 2026, orderSequence: 1, priority: 'MEDIA', createdAt: new Date('2026-01-01T00:00:00.000Z') },
    ...overrides,
  }
}

const {
  findAliveOrderTargetById,
  listAliveOrderSummariesByIds: listAliveRecordsByIds,
  listAliveOrderSummariesInCompany,
  listOrderDeliveryProgressByIdsIncludingDeleted,
  toOrderSummaryRecord,
  toOrderAssignmentTarget,
} = await import('@/lib/modules/pedidos/adapters/driven/persistence/order-catalog-prisma')
const { createListAliveSummariesByIds, createListAliveSummariesInCompany } = await import('@/lib/modules/pedidos')

/** Doble del catalogo de envases de `inventario`: solo devuelve los ids que conoce. */
const findPackagingRefs = vi.fn(async (ids: readonly string[]) =>
  ids.filter((id) => id === 'env-1').map((id) => ({ id, name: 'Envase PET 1L' })),
)
const summaryDeps = {
  summaries: { listAliveByIds: listAliveRecordsByIds, listAliveInCompany: listAliveOrderSummariesInCompany },
  packaging: { findRefs: findPackagingRefs, findCostingBatches: async () => [] },
} as unknown as Parameters<typeof createListAliveSummariesByIds>[0]
const listAliveOrderSummariesByIds = createListAliveSummariesByIds(summaryDeps)
const listAliveSummariesInCompany = createListAliveSummariesInCompany(summaryDeps)

// `transitionAliveOrder` se retiro -sin llamantes
// desde que `createTransitionOrder` cablea el Finalizar sobre la unidad de trabajo-, y con ella
// su `describe` de aqui abajo. El `UPDATE` condicional que movia `status` (y `finishedAt` a
// ENTREGADO) sigue vivo en `setAliveOrderStatus`, tras `createOrderWriteRepository(tx).setStatus`.
const { createOrderWriteRepository } = await import(
  '@/lib/modules/pedidos/adapters/driven/persistence/order-prisma'
)

/** Sube desde este archivo hasta la raiz del repo (la carpeta con `package.json`). */
function findRepoRoot(startDir: string): string {
  let dir = startDir
  for (;;) {
    try {
      readFileSync(join(dir, 'package.json'))
      return dir
    } catch {
      const parent = dirname(dir)
      if (parent === dir) throw new Error(`no se encontro package.json subiendo desde ${startDir}`)
      dir = parent
    }
  }
}

/** Fuente SIN comentarios: lo que se vigila es el codigo, no la prosa (mismo helper y misma
 *  razon que `tests/unit/recetas/recipe-catalog.test.ts`). */
function read(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)))
const pedidosDir = join(repoRoot, 'lib', 'modules', 'pedidos')
const contratoFuente = read(join(pedidosDir, 'index.ts'))
const catalogoFuente = read(join(pedidosDir, 'domain', 'order-catalog.ts'))
const adaptadorFuente = read(
  join(pedidosDir, 'adapters', 'driven', 'persistence', 'order-catalog-prisma.ts'),
)

// Los dos dobles van TIPADOS a `OrderAssignmentTarget`: su `status` es el `OrderStatus` del
// dominio, no un `string`. Antes eran objetos literales sin tipo y por eso el estado
// inventado `'EN_PROCESO'` -que NO esta en `ORDER_STATUS_VALUES`- compilaba sin queja. Atado
// asi, un estado que no exista en el enum pone el typecheck en rojo.
/** QC-60: el catalogo se acota por empresa, asi que el doble recibe una y el `where` la lleva. */
const EMPRESA = 'c-1'

const PEDIDO_VIVO: OrderAssignmentTarget = {
  id: 'o-viva',
  status: 'PARCIAL',
  activeLineStatuses: ['PENDIENTE', 'TERMINADO'],
}
const PEDIDO_DE_BAJA: OrderAssignmentTarget = {
  id: 'o-baja',
  status: 'EN_CURSO',
  activeLineStatuses: ['EN_CURSO'],
}

/**
 * Doble que se comporta como la base: aplica el `where` que le llega. Si el adaptador pide
 * `deletedAt: null`, el pedido de baja no aparece; si dejara de pedirlo, aparece —y ahi es
 * donde el test cae al mutar—.
 */
function baseConUnPedidoVivoYUnoDeBaja(): void {
  findFirst.mockImplementation(async (args: { where: Record<string, unknown> }) => {
    const filas = [
      { fila: PEDIDO_VIVO, borrado: null as Date | null },
      { fila: PEDIDO_DE_BAJA, borrado: new Date('2026-03-03') },
    ]
    // QC-60: el ambito entra como termino propio de un `AND`, nunca fundido con lo demas, asi
    // que el doble aplana los terminos antes de decidir -igual que hace Postgres-.
    const terminos = Array.isArray(args.where.AND)
      ? (args.where.AND as readonly Record<string, unknown>[])
      : [args.where]
    const where: Record<string, unknown> = Object.assign({}, ...terminos)
    const encontrada = filas.find((candidata) => candidata.fila.id === where.id)
    if (encontrada === undefined) return null
    const filtraBorrados = 'deletedAt' in where && where.deletedAt === null
    if (filtraBorrados && encontrada.borrado !== null) return null
    // La fila de Prisma: las lineas activas llegan anidadas como `lines: [{ status }]`.
    const { id, status, activeLineStatuses } = encontrada.fila
    return { id, status, lines: activeLineStatuses.map((linea) => ({ status: linea })) }
  })
}

beforeEach(() => {
  findFirst.mockReset()
  updateMany.mockReset()
  findMany.mockReset()
  count.mockReset()
  lineFindMany.mockReset()
  lineCount.mockReset()
  distributionFindMany.mockReset()
  distributionFindMany.mockResolvedValue([])
})

describe('contrato OrderCatalog', () => {
  it('el dominio declara findAliveById y un OrderAssignmentTarget con SOLO id, status y los estados de sus lineas activas (QT-313 R55)', () => {
    // Se afirma sobre el TEXTO y no en ejecucion a proposito: `OrderCatalog` y
    // `OrderAssignmentTarget` son SOLO TIPOS y desaparecen al compilar.
    expect(catalogoFuente).toMatch(/export interface OrderCatalog \{/)
    expect(catalogoFuente).toMatch(
      /findAliveById\(id: string, companyId: string\): Promise<OrderAssignmentTarget \| null>/,
    )
    expect(catalogoFuente).toMatch(/export type OrderAssignmentTarget = \{/)
    // El estado es el enum de QC-34 IMPORTADO, no una segunda lista copiada. La asercion tolera
    // cualquier orden de nombres dentro del mismo `import type { ... } from`.
    expect(catalogoFuente).toMatch(
      /import type \{ [^}]*\bOrderStatus\b[^}]* \} from '\.\/order-classification'/,
    )
    // Ni el numero, ni la receta, ni las cantidades: lo que no esta en el tipo no se filtra.
    // Acotado al bloque de `OrderAssignmentTarget`: `AssignedOrderSummary`, mas abajo en el MISMO
    // archivo, SI lleva `recipeId`/`quantity`/`priority` a proposito, asi que buscar en el archivo
    // entero daria un falso rojo.
    const bloqueOrderAssignmentTarget = catalogoFuente.slice(
      catalogoFuente.indexOf('export type OrderAssignmentTarget'),
      catalogoFuente.indexOf('export interface OrderCatalog'),
    )
    for (const campo of ['orderYear', 'orderSequence', 'recipeId', 'quantity', 'priority']) {
      expect(bloqueOrderAssignmentTarget, `OrderAssignmentTarget expone ${campo}`).not.toMatch(
        new RegExp(`\\b${campo}\\b`),
      )
    }
    // Contrato puro: ni Prisma ni implementacion en el dominio.
    expect(catalogoFuente).not.toMatch(/@prisma\/client|prisma\./)
  })

  it('el barrel de pedidos reexporta los dos simbolos como TIPO y no el adaptador (R46)', () => {
    expect(contratoFuente).toMatch(
      /export type \{[^}]*\bOrderCatalog\b[^}]*\} from '\.\/domain\/order-catalog'/,
    )
    expect(contratoFuente).toMatch(/export type \{[^}]*\bOrderAssignmentTarget\b[^}]*\}/)
    // Son tipos: `export type`, nunca un `export {` de valor que arrastrara codigo.
    expect(contratoFuente).not.toMatch(/export \{[^}]*\bOrderCatalog\b/)
    // Y el adaptador NO se nombra en el barrel: arrastraria `@prisma/client` a su cierre.
    expect(contratoFuente).not.toMatch(/order-catalog-prisma/)
    expect(contratoFuente).not.toMatch(/@prisma\/client/)
  })

  it('NO se reutiliza OrderRepository: el catalogo es un contrato hacia fuera', () => {
    expect(catalogoFuente).not.toMatch(/order-repository|OrderRepository/)
    expect(adaptadorFuente).not.toMatch(/order-repository|OrderRepository/)
  })

  it("[D2'] OrderCatalog NO gana ningun metodo que escriba el reparto o la unidad", () => {
    // F1.2 proponia `updatePresentationLinesAliveById` para la puerta del Empacador; `[D2']` la
    // retira: quien tiene `pedidos.modificar` edita por `updateOrderPresentationLines` (T9), no
    // por este contrato. Se afirma por NEGACION del nombre, no de la lista completa de metodos,
    // para que un metodo de lectura nuevo manana no rompa este test sin motivo.
    expect(catalogoFuente).not.toMatch(/updatePresentationLines|updateDistribution|writeDistribution/)
    for (const metodo of catalogoFuente.matchAll(/^\s{2}(\w+)\(/gm)) {
      expect(metodo[1], 'ningun metodo de OrderCatalog escribe el reparto').not.toMatch(
        /presentationLine|[Dd]istribution/,
      )
    }
  })
})

describe('toOrderAssignmentTarget', () => {
  it('QT-313 R55: devuelve el id, el estado y los estados de sus lineas activas, y nada mas', () => {
    const fila = { id: 'o-1', status: 'PARCIAL', lines: [{ status: 'ENTREGADO' }, { status: 'POR_EMPACAR' }] }
    expect(toOrderAssignmentTarget(fila)).toEqual({
      id: 'o-1',
      status: 'PARCIAL',
      activeLineStatuses: ['ENTREGADO', 'POR_EMPACAR'],
    })
    expect(Object.keys(toOrderAssignmentTarget(fila))).toEqual(['id', 'status', 'activeLineStatuses'])
  })
})

type FilaPlana = Omit<Parameters<typeof toOrderSummaryRecord>[0], 'orderId' | 'order'> & {
  readonly orderYear: number
  readonly orderSequence: number
  readonly priority: string
  readonly createdAt: Date
  readonly presentationLines: readonly Omit<Parameters<typeof toOrderSummaryRecord>[1][number], 'orderLineId'>[]
}

/** La fila plana de antes, vista como su unica linea: el pedido es `id` y la linea, `linea-<id>`. */
function resumenPlano(fila: FilaPlana) {
  const { id, orderYear, orderSequence, priority, createdAt, presentationLines, ...linea } = fila
  const lineId = `linea-${id}`
  return toOrderSummaryRecord(
    { ...linea, id: lineId, orderId: id, order: { orderYear, orderSequence, priority, createdAt } },
    presentationLines.map((reparto) => ({ ...reparto, orderLineId: lineId })),
  )
}

describe('toOrderSummaryRecord — el resumen publicado lleva el reparto, la unidad y la fecha de terminado', () => {
  it('QT-313 R45: la fila es la de la linea, con el id del pedido y el de la linea', () => {
    const resumen = resumenPlano({
      id: 'o-0',
      orderYear: 2026,
      orderSequence: 6,
      recipeId: 'r-1',
      quantity: { toFixed: () => '10.0000' },
      priority: 'MEDIA',
      status: 'EN_CURSO',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      unitId: null,
      presentationLines: [],
      finishedAt: null,
      packedBy: null,
      conditionedBy: null,
    })
    expect(resumen.id).toBe('o-0')
    expect(resumen.lineId).toBe('linea-o-0')
    expect(resumen.status).toBe('EN_CURSO')
  })

  it('T10: copia presentationLines EN EL ORDEN de la fila (createdAt, desempate id), con y sin reparto', () => {
    const conReparto = resumenPlano({
      id: 'o-1',
      orderYear: 2026,
      orderSequence: 7,
      recipeId: 'r-1',
      quantity: { toFixed: () => '10.0000' },
      priority: 'MEDIA',
      status: 'PENDIENTE',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      unitId: 'u-1',
      presentationLines: [
        { id: 'lp-1', presentationId: 'p-1', packages: 5, packedPackages: null, presentationContent: null, packagingProductId: null },
        { id: 'lp-2', presentationId: 'p-2', packages: 1, packedPackages: null, presentationContent: null, packagingProductId: null },
      ],
      finishedAt: null,
      packedBy: null,
      conditionedBy: null,
    })
    expect(conReparto.presentationLines).toEqual([
      { id: 'lp-1', presentationId: 'p-1', packages: 5, packedPackages: null, presentationContent: null, packagingProductId: null },
      { id: 'lp-2', presentationId: 'p-2', packages: 1, packedPackages: null, presentationContent: null, packagingProductId: null },
    ])

    const sinReparto = resumenPlano({
      id: 'o-2',
      orderYear: 2026,
      orderSequence: 8,
      recipeId: 'r-1',
      quantity: { toFixed: () => '10.0000' },
      priority: 'MEDIA',
      status: 'PENDIENTE',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      unitId: null,
      presentationLines: [],
      finishedAt: null,
      packedBy: null,
      conditionedBy: null,
    })
    expect(sinReparto.presentationLines).toEqual([])
  })

  it('T10: copia unitId tal cual, con y sin unidad (R43)', () => {
    const filaBase = {
      id: 'o-1b',
      orderYear: 2026,
      orderSequence: 7,
      recipeId: 'r-1',
      quantity: { toFixed: () => '10.0000' },
      priority: 'MEDIA',
      status: 'PENDIENTE',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      presentationLines: [],
      finishedAt: null,
      packedBy: null,
      conditionedBy: null,
    } as const

    expect(resumenPlano({ ...filaBase, unitId: 'u-1' }).unitId).toBe('u-1')
    expect(resumenPlano({ ...filaBase, id: 'o-1c', unitId: null }).unitId).toBeNull()
  })

  it('copia la prioridad y la fecha de solicitud (createdAt) tal cual', () => {
    const solicitado = new Date('2026-03-04T05:06:07.000Z')
    const resumen = resumenPlano({
      id: 'o-1d',
      orderYear: 2026,
      orderSequence: 8,
      recipeId: 'r-1',
      quantity: { toFixed: () => '10.0000' },
      priority: 'CRITICA',
      status: 'POR_EMPACAR',
      createdAt: solicitado,
      unitId: null,
      presentationLines: [],
      finishedAt: null,
      packedBy: null,
      conditionedBy: null,
    })

    expect(resumen.priority).toBe('CRITICA')
    expect(resumen.createdAt).toBe(solicitado)
  })

  it('R20: copia finishedAt tal cual, con y sin fecha', () => {
    const fecha = new Date('2026-09-23T10:00:00.000Z')
    const conFecha = resumenPlano({
      id: 'o-3',
      orderYear: 2026,
      orderSequence: 9,
      recipeId: 'r-1',
      quantity: { toFixed: () => '10.0000' },
      priority: 'MEDIA',
      status: 'ENTREGADO',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      unitId: null,
      presentationLines: [],
      finishedAt: fecha,
      packedBy: null,
      conditionedBy: null,
    })
    expect(conFecha.finishedAt).toBe(fecha)

    const sinFecha = resumenPlano({
      id: 'o-4',
      orderYear: 2026,
      orderSequence: 10,
      recipeId: 'r-1',
      quantity: { toFixed: () => '10.0000' },
      priority: 'MEDIA',
      status: 'ENTREGADO',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      unitId: null,
      presentationLines: [],
      finishedAt: null,
      packedBy: null,
      conditionedBy: null,
    })
    expect(sinFecha.finishedAt).toBeNull()
  })

  it('R14, R17: copia packedBy tal cual, con y sin empacador', () => {
    const conEmpacador = resumenPlano({
      id: 'o-5',
      orderYear: 2026,
      orderSequence: 11,
      recipeId: 'r-1',
      quantity: { toFixed: () => '10.0000' },
      priority: 'MEDIA',
      status: 'EN_EMPAQUE',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      unitId: null,
      presentationLines: [],
      finishedAt: null,
      packedBy: 'u-1',
      conditionedBy: null,
    })
    expect(conEmpacador.packedBy).toBe('u-1')

    const sinEmpacador = resumenPlano({
      id: 'o-6',
      orderYear: 2026,
      orderSequence: 12,
      recipeId: 'r-1',
      quantity: { toFixed: () => '10.0000' },
      priority: 'MEDIA',
      status: 'POR_EMPACAR',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      unitId: null,
      presentationLines: [],
      finishedAt: null,
      packedBy: null,
      conditionedBy: null,
    })
    expect(sinEmpacador.packedBy).toBeNull()
  })

  it('R7: copia conditionedBy tal cual, con y sin quien acondiciona', () => {
    const filaBase = {
      orderYear: 2026,
      orderSequence: 13,
      recipeId: 'r-1',
      quantity: { toFixed: () => '10.0000' },
      priority: 'MEDIA',
      unitId: null,
      presentationLines: [],
      finishedAt: null,
      packedBy: 'u-1',
    } as const

    const conAcondicionador = resumenPlano({
      ...filaBase,
      id: 'o-7',
      status: 'EN_ACONDICIONAMIENTO',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      conditionedBy: 'u-2',
    })
    expect(conAcondicionador.conditionedBy).toBe('u-2')

    const sinAcondicionador = resumenPlano({
      ...filaBase,
      id: 'o-8',
      status: 'POR_ACONDICIONAR',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      conditionedBy: null,
    })
    expect(sinAcondicionador.conditionedBy).toBeNull()
  })
})

describe('findAliveOrderTargetById', () => {
  it('QT-313 R55: un pedido vivo vuelve como {id, status, activeLineStatuses}', async () => {
    baseConUnPedidoVivoYUnoDeBaja()

    await expect(findAliveOrderTargetById('o-viva', EMPRESA)).resolves.toEqual({
      id: 'o-viva',
      status: 'PARCIAL',
      activeLineStatuses: ['PENDIENTE', 'TERMINADO'],
    })
  })

  it('un pedido dado de baja vuelve como null, igual que uno que no existe (QC-34 R33)', async () => {
    baseConUnPedidoVivoYUnoDeBaja()

    // MUTACION: si el adaptador quitara `deletedAt: null` del `where`, el doble devolveria la
    // fila de baja y esta asercion se pondria roja.
    await expect(findAliveOrderTargetById('o-baja', EMPRESA)).resolves.toBeNull()
    await expect(findAliveOrderTargetById('o-fantasma', EMPRESA)).resolves.toBeNull()
  })

  it('el filtro de vida va en el WHERE, no en un if posterior (R40)', async () => {
    baseConUnPedidoVivoYUnoDeBaja()

    await findAliveOrderTargetById('o-viva', EMPRESA)

    const args = findFirst.mock.calls[0]?.[0]
    expect(args.where).toEqual({
      AND: [{ companyId: EMPRESA }, { id: 'o-viva', deletedAt: null }],
    })
    // Y el `select` pide DOS columnas y el estado de las lineas ACTIVAS (QT-313 R55): una linea
    // de baja o cancelada no llega y no cuenta.
    expect(args.select).toEqual({
      id: true,
      status: true,
      lines: { where: { deletedAt: null, status: { not: 'CANCELADO' } }, select: { status: true } },
    })
  })

  it('hace UNA sola consulta', async () => {
    baseConUnPedidoVivoYUnoDeBaja()

    await findAliveOrderTargetById('o-viva', EMPRESA)

    expect(findFirst).toHaveBeenCalledTimes(1)
  })
})

describe('el cambio es ADITIVO: pedidos no gano ningun caso de uso ni perdio nada', () => {
  it('las SEIS factories de QC-34 y la tabla de transiciones siguen publicadas', () => {
    const anteriores = [
      'createCreateOrder',
      'createGetOrder',
      'createListOrders',
      'createUpdateOrder',
      'createCancelOrder',
      'createDeleteOrder',
      'assertTransition',
      'isAllowedTransition',
      'requirePermission',
      'ORDER_STATUS_VALUES',
    ]
    for (const simbolo of anteriores) {
      expect(contratoFuente, `el barrel dejo de exportar ${simbolo}`).toMatch(
        new RegExp(`\\b${simbolo}\\b`),
      )
    }
  })

  it('el catalogo no anade ninguna factory: es un tipo y una interfaz', () => {
    expect(catalogoFuente).not.toMatch(/export (async )?function|export const create/)
  })
})

describe('setAliveOrderStatus (createOrderWriteRepository(tx).setStatus), el camino vivo tras retirar transitionAliveOrder (Tm2)', () => {
  const AHORA = new Date('2026-09-17T12:00:00Z')
  const setStatus = createOrderWriteRepository().setStatus

  it('T1(a) - mueve PENDIENTE->EN_CURSO y EN_CURSO->ENTREGADO', async () => {
    updateMany.mockResolvedValue({ count: 1 })

    await expect(
      setStatus('o-1', 'PENDIENTE', 'EN_CURSO', 'actor-1', AHORA, { companyId: EMPRESA }),
    ).resolves.toBe('ok')
    await expect(
      setStatus('o-1', 'EN_CURSO', 'ENTREGADO', 'actor-1', AHORA, { companyId: EMPRESA }),
    ).resolves.toBe('ok')

    expect(updateMany).toHaveBeenCalledTimes(2)
    const primeraLlamada = updateMany.mock.calls[0]?.[0]
    expect(primeraLlamada.where).toEqual({
      AND: [{ companyId: EMPRESA }, { id: 'o-1', deletedAt: null, status: 'PENDIENTE' }],
    })
    expect(primeraLlamada.data).toEqual({
      status: 'EN_CURSO',
      updatedAt: AHORA,
      updatedBy: 'actor-1',
    })
  })

  it('R33 (QC-215): ni a ENTREGADO ni a EN_CURSO escribe finishedAt', async () => {
    updateMany.mockResolvedValue({ count: 1 })

    await setStatus('o-1', 'PENDIENTE', 'EN_CURSO', 'actor-1', AHORA, { companyId: EMPRESA })
    await setStatus('o-1', 'TERMINADO', 'ENTREGADO', 'actor-1', AHORA, { companyId: EMPRESA })

    const [aEnCurso, aEntregado] = updateMany.mock.calls
    expect(aEnCurso?.[0]?.data).not.toHaveProperty('finishedAt')
    expect(aEntregado?.[0]?.data).toEqual({
      status: 'ENTREGADO',
      updatedAt: AHORA,
      updatedBy: 'actor-1',
    })
  })

  // El caso de `transitionAliveOrder` (ENTREGADO->EN_CURSO lanza `InvalidTransitionError` SIN
  // escribir) no tiene equivalente AQUI: `setAliveOrderStatus` corre DENTRO de
  // `unitOfWork.run`, sobre la fila que ya bloqueo `lockAliveById`, y la transicion la valida
  // `assertTransition` en el dominio ANTES de llegar aqui (`transition-order.ts`), no el
  // adaptador. Esa comprobacion -que una transicion ilegal no abre la unidad de trabajo ni
  // escribe- la prueba `tests/unit/pedidos/transition-order.test.ts`.

  it('T1(c) - devuelve not_found cuando el pedido es de otra empresa', async () => {
    updateMany.mockResolvedValue({ count: 0 })
    findFirst.mockResolvedValue(null)

    await expect(
      setStatus('o-ajeno', 'PENDIENTE', 'EN_CURSO', 'actor-1', AHORA, { companyId: EMPRESA }),
    ).resolves.toBe('not_found')
  })

  it('T1(d) - devuelve stale si el from ya no coincide con el estado actual', async () => {
    updateMany.mockResolvedValue({ count: 0 })
    findFirst.mockResolvedValue({ id: 'o-1', status: 'EN_CURSO' })

    await expect(
      setStatus('o-1', 'PENDIENTE', 'EN_CURSO', 'actor-1', AHORA, { companyId: EMPRESA }),
    ).resolves.toBe('stale')
  })
})

describe('listAliveSummariesInCompany — R17, R20, R22, R24', () => {
  beforeEach(() => {
    lineFindMany.mockResolvedValue([])
    lineCount.mockResolvedValue(0)
  })

  /** Las lineas vivas de pedidos vivos de la empresa: el ambito va en la linea y en su pedido. */
  const vivas = (statuses: readonly string[]) => ({
    companyId: EMPRESA,
    status: { in: statuses },
    deletedAt: null,
    order: { AND: [{ companyId: EMPRESA }, { deletedAt: null }] },
  })

  it('QT-313 R45: el WHERE acota por empresa y estado de la LINEA, SIN filtro de ids (R17, R22)', async () => {
    await listAliveSummariesInCompany(EMPRESA, ['ENTREGADO'], 'finished_recent_first', 1)

    const llamada = lineFindMany.mock.calls[0]?.[0]
    expect(llamada.where).toEqual(vivas(['ENTREGADO']))
    expect(llamada.where).not.toHaveProperty('orderId')
  })

  it('R20: con `packedBy`, el WHERE de la pagina y el del total llevan empresa, estado y ese empacador', async () => {
    await listAliveSummariesInCompany(EMPRESA, ['ENTREGADO'], 'finished_recent_first', 2, 10, { packedBy: 'emp-1' })

    const esperado = { ...vivas(['ENTREGADO']), packedBy: 'emp-1' }
    const llamada = lineFindMany.mock.calls[0]?.[0]
    expect(llamada.where).toEqual(esperado)
    expect(llamada.skip).toBe(10)
    expect(llamada.take).toBe(10)
    expect(lineCount.mock.calls[0]?.[0]?.where).toEqual(esperado)
  })

  it('R20: con `packedBy`, el total y las paginas salen del recuento ya filtrado', async () => {
    lineCount.mockResolvedValue(3)

    const pagina = await listAliveSummariesInCompany(EMPRESA, ['ENTREGADO'], 'finished_recent_first', 1, 2, {
      packedBy: 'emp-1',
    })

    expect(pagina.total).toBe(3)
    expect(pagina.totalPages).toBe(2)
  })

  it('R20: sin filtro, o con un filtro vacio, el WHERE no cambia y no acota por empacador', async () => {
    await listAliveSummariesInCompany(EMPRESA, ['ENTREGADO'], 'finished_recent_first', 1)
    await listAliveSummariesInCompany(EMPRESA, ['ENTREGADO'], 'finished_recent_first', 1, undefined, {})

    expect(lineFindMany.mock.calls[0]?.[0]?.where).toEqual(vivas(['ENTREGADO']))
    expect(lineFindMany.mock.calls[1]?.[0]?.where).toEqual(vivas(['ENTREGADO']))
    expect(JSON.stringify(lineFindMany.mock.calls[1]?.[0]?.where)).not.toContain('packedBy')
  })

  it('R11: con `conditionedBy`, el WHERE de la pagina y el del total llevan empresa, estado y quien acondiciona', async () => {
    await listAliveSummariesInCompany(EMPRESA, ['TERMINADO'], 'finished_recent_first', 2, 10, {
      conditionedBy: 'acon-1',
    })

    const esperado = { ...vivas(['TERMINADO']), conditionedBy: 'acon-1' }
    const llamada = lineFindMany.mock.calls[0]?.[0]
    expect(llamada.where).toEqual(esperado)
    expect(llamada.skip).toBe(10)
    expect(llamada.take).toBe(10)
    expect(lineCount.mock.calls[0]?.[0]?.where).toEqual(esperado)
  })

  it('R11: sin `conditionedBy` el WHERE no acota por quien acondiciona', async () => {
    await listAliveSummariesInCompany(EMPRESA, ['TERMINADO'], 'finished_recent_first', 1, undefined, {})

    expect(JSON.stringify(lineFindMany.mock.calls[0]?.[0]?.where)).not.toContain('conditionedBy')
  })

  it('R7: el SELECT del resumen pide `conditionedBy`', async () => {
    await listAliveSummariesInCompany(EMPRESA, ['POR_ACONDICIONAR'], 'work_queue', 1)

    expect(lineFindMany.mock.calls[0]?.[0]?.select).toHaveProperty('conditionedBy', true)
  })

  it('con `work_queue`, el ORDER BY es IDENTICO al de listAliveSummariesByIds', async () => {
    await listAliveSummariesInCompany(EMPRESA, ['PENDIENTE', 'EN_CURSO'], 'work_queue', 1)
    const deTodaLaEmpresa = lineFindMany.mock.calls[0]?.[0]?.orderBy

    lineFindMany.mockClear()
    await listAliveOrderSummariesByIds(EMPRESA, ['o-1'], ['PENDIENTE', 'EN_CURSO'], 1)
    const porIds = lineFindMany.mock.calls[0]?.[0]?.orderBy

    expect(deTodaLaEmpresa).toEqual(porIds)
    expect(deTodaLaEmpresa).toEqual([
      { order: { priority: 'desc' } },
      { order: { createdAt: 'asc' } },
      { order: { orderYear: 'asc' } },
      { order: { orderSequence: 'asc' } },
      { position: 'asc' },
      { id: 'asc' },
    ])
  })

  it('con `finished_recent_first`, ordena por finishedAt DESC con nulls "last" explicito y desempata por numero DESC (R20, D14)', async () => {
    await listAliveSummariesInCompany(EMPRESA, ['ENTREGADO'], 'finished_recent_first', 1)

    expect(lineFindMany.mock.calls[0]?.[0]?.orderBy).toEqual([
      { finishedAt: { sort: 'desc', nulls: 'last' } },
      { order: { orderYear: 'desc' } },
      { order: { orderSequence: 'desc' } },
      { position: 'asc' },
      { id: 'asc' },
    ])
  })

  it('con `unfinished_then_recent`, pone los sin finishedAt PRIMERO, luego finishedAt DESC, y desempata por numero DESC e id', async () => {
    await listAliveSummariesInCompany(
      EMPRESA,
      ['POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO'],
      'unfinished_then_recent',
      1,
      undefined,
      { packedBy: 'emp-1' },
    )

    expect(lineFindMany.mock.calls[0]?.[0]?.orderBy).toEqual([
      { finishedAt: { sort: 'desc', nulls: 'first' } },
      { order: { orderYear: 'desc' } },
      { order: { orderSequence: 'desc' } },
      { position: 'asc' },
      { id: 'asc' },
    ])
  })

  it('el resumen paginado incluye finishedAt (R20, R21, R31)', async () => {
    lineFindMany.mockResolvedValue([filaDeLinea({ status: 'ENTREGADO', finishedAt: new Date('2026-09-23T10:00:00.000Z') })])
    lineCount.mockResolvedValue(1)

    const pagina = await listAliveSummariesInCompany(EMPRESA, ['ENTREGADO'], 'finished_recent_first', 1)

    expect(pagina.items[0]?.finishedAt).toEqual(new Date('2026-09-23T10:00:00.000Z'))
    expect(pagina.items[0]).toMatchObject({ id: 'o-1', lineId: 'l-1' })
  })

  it('T10, QT-313 R45: el select pide unitId, y el reparto de las lineas de la pagina sale en UNA consulta en el orden de alta', async () => {
    lineFindMany.mockResolvedValue([filaDeLinea({ id: 'l-1' }), filaDeLinea({ id: 'l-2', orderId: 'o-2' })])
    lineCount.mockResolvedValue(2)

    await listAliveSummariesInCompany(EMPRESA, ['PENDIENTE'], 'work_queue', 1)

    expect(lineFindMany.mock.calls[0]?.[0]?.select.unitId).toBe(true)
    expect(distributionFindMany).toHaveBeenCalledTimes(1)
    const reparto = distributionFindMany.mock.calls[0]?.[0]
    expect(reparto.where).toEqual({ companyId: EMPRESA, orderLineId: { in: ['l-1', 'l-2'] } })
    expect(reparto.select).toEqual({
      id: true,
      orderLineId: true,
      presentationId: true,
      packages: true,
      packedPackages: true,
      presentationContent: true,
      packagingProductId: true,
    })
    expect(reparto.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }])
  })

  it('QT-313 R45: una pagina sin lineas no consulta el reparto', async () => {
    await listAliveSummariesInCompany(EMPRESA, ['PENDIENTE'], 'work_queue', 1)

    expect(distributionFindMany).not.toHaveBeenCalled()
  })
})

describe('listAliveSummariesByIds — el nombre del envase de cada linea', () => {
  beforeEach(() => {
    findPackagingRefs.mockClear()
    lineCount.mockResolvedValue(1)
  })

  it('QT-313 R45: acota por los pedidos pedidos, la empresa y el estado de la linea', async () => {
    lineFindMany.mockResolvedValue([])
    lineCount.mockResolvedValue(0)

    await listAliveOrderSummariesByIds(EMPRESA, ['o-1'], ['EN_CURSO'], 1)

    expect(lineFindMany.mock.calls[0]?.[0]?.where).toEqual({
      companyId: EMPRESA,
      status: { in: ['EN_CURSO'] },
      deletedAt: null,
      order: { AND: [{ companyId: EMPRESA }, { deletedAt: null }] },
      orderId: { in: ['o-1'] },
    })
  })

  it('R44, R33: la linea con envase lleva su nombre, la antigua y la de un envase que no vuelve llevan null, en una sola llamada', async () => {
    lineFindMany.mockResolvedValue([filaDeLinea()])
    distributionFindMany.mockResolvedValue([
      { orderLineId: 'l-1', presentationId: 'p-1', packages: 4, presentationContent: { toFixed: () => '1.0000' }, packagingProductId: 'env-1' },
      { orderLineId: 'l-1', presentationId: 'p-2', packages: 2, presentationContent: null, packagingProductId: null },
      { orderLineId: 'l-1', presentationId: 'p-3', packages: 1, presentationContent: null, packagingProductId: 'env-de-baja' },
    ])

    const pagina = await listAliveOrderSummariesByIds(EMPRESA, ['o-1'], ['POR_EMPACAR'], 1)

    expect(findPackagingRefs).toHaveBeenCalledTimes(1)
    expect(findPackagingRefs).toHaveBeenCalledWith(['env-1', 'env-de-baja'], EMPRESA)
    expect(pagina.items[0]?.presentationLines).toEqual([
      { presentationId: 'p-1', packages: 4, presentationContent: '1.0000', packagingProductId: 'env-1', packagingName: 'Envase PET 1L', packagingImageUrl: null },
      { presentationId: 'p-2', packages: 2, presentationContent: null, packagingProductId: null, packagingName: null, packagingImageUrl: null },
      { presentationId: 'p-3', packages: 1, presentationContent: null, packagingProductId: 'env-de-baja', packagingName: null, packagingImageUrl: null },
    ])
  })

  it('R33: una pagina sin envases no consulta el catalogo de envases', async () => {
    lineFindMany.mockResolvedValue([])
    lineCount.mockResolvedValue(0)

    await listAliveSummariesInCompany(EMPRESA, ['ENTREGADO'], 'finished_recent_first', 1)

    expect(findPackagingRefs).not.toHaveBeenCalled()
  })

  it('imagen del envase: la linea lleva la URL que devuelve el catalogo, con una sola llamada por pagina', async () => {
    const findRefsConImagen = vi.fn(async (ids: readonly string[]) =>
      ids
        .filter((id) => id === 'env-1' || id === 'env-2')
        .map((id) =>
          id === 'env-1'
            ? { id, name: 'Envase PET 1L', imageUrl: 'https://cdn.test/productos/env-1.png' }
            : { id, name: 'Galon', imageUrl: null },
        ),
    )
    const listarConImagen = createListAliveSummariesInCompany({
      ...summaryDeps,
      packaging: { findRefs: findRefsConImagen, findCostingBatches: async () => [] },
    } as unknown as Parameters<typeof createListAliveSummariesInCompany>[0])
    lineFindMany.mockResolvedValue([
      filaDeLinea({ id: 'l-1', orderId: 'o-1' }),
      filaDeLinea({ id: 'l-2', orderId: 'o-2' }),
      filaDeLinea({ id: 'l-3', orderId: 'o-3' }),
    ])
    const reparto = (orderLineId: string, packagingProductId: string) => ({
      orderLineId,
      presentationId: 'p-1',
      packages: 1,
      presentationContent: null,
      packagingProductId,
    })
    distributionFindMany.mockResolvedValue([reparto('l-1', 'env-1'), reparto('l-2', 'env-2'), reparto('l-3', 'env-1')])
    lineCount.mockResolvedValue(3)

    const pagina = await listarConImagen(EMPRESA, ['POR_EMPACAR'], 'work_queue', 1)

    expect(findRefsConImagen).toHaveBeenCalledTimes(1)
    expect(findRefsConImagen).toHaveBeenCalledWith(['env-1', 'env-2'], EMPRESA)
    expect(pagina.items.map((item) => item.presentationLines[0]?.packagingImageUrl)).toEqual([
      'https://cdn.test/productos/env-1.png',
      null,
      'https://cdn.test/productos/env-1.png',
    ])
  })
})

describe('listOrderDeliveryProgressByIdsIncludingDeleted — receta, reparto y lo entregado de una pagina', () => {
  it('una sola consulta, acotada por empresa, sin filtrar los dados de baja y sin contar lo anulado', async () => {
    findMany.mockResolvedValue([
      {
        id: 'o-1',
        recipeId: 'r-1',
        presentationLines: [
          { presentationId: 'p-1', packages: 10, packedPackages: 8, deliveryLines: [{ packages: 2 }, { packages: 1 }] },
          { presentationId: 'p-2', packages: 5, packedPackages: null, deliveryLines: [] },
        ],
      },
    ])

    const progreso = await listOrderDeliveryProgressByIdsIncludingDeleted(EMPRESA, ['o-1', 'o-2'])

    expect(findMany).toHaveBeenCalledTimes(1)
    const args = findMany.mock.calls[0]![0] as {
      where: { AND: readonly Record<string, unknown>[] }
      select: { presentationLines: { select: { deliveryLines: { where: unknown } } } }
    }
    expect(args.where.AND).toEqual([{ companyId: EMPRESA }, { id: { in: ['o-1', 'o-2'] } }])
    expect(args.where.AND.some((termino) => 'deletedAt' in termino)).toBe(false)
    // Lo anulado no cuenta como entregado.
    expect(args.select.presentationLines.select.deliveryLines.where).toEqual({ voidLine: { is: null } })
    expect(progreso).toEqual([
      {
        id: 'o-1',
        recipeId: 'r-1',
        lines: [
          { presentationId: 'p-1', packages: 10, packedPackages: 8, deliveredPackages: 3 },
          { presentationId: 'p-2', packages: 5, packedPackages: null, deliveredPackages: 0 },
        ],
      },
    ])
  })

  it('con ids vacio no consulta', async () => {
    await expect(listOrderDeliveryProgressByIdsIncludingDeleted(EMPRESA, [])).resolves.toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })
})

describe('listOrderDeliveryProgressByIdsIncludingDeleted — receta, reparto y lo entregado de una pagina', () => {
  it('una sola consulta, acotada por empresa, sin filtrar los dados de baja y sin contar lo anulado', async () => {
    findMany.mockResolvedValue([
      {
        id: 'o-1',
        recipeId: 'r-1',
        presentationLines: [
          { presentationId: 'p-1', packages: 10, packedPackages: 8, deliveryLines: [{ packages: 2 }, { packages: 1 }] },
          { presentationId: 'p-2', packages: 5, packedPackages: null, deliveryLines: [] },
        ],
      },
    ])

    const progreso = await listOrderDeliveryProgressByIdsIncludingDeleted(EMPRESA, ['o-1', 'o-2'])

    expect(findMany).toHaveBeenCalledTimes(1)
    const args = findMany.mock.calls[0]![0] as {
      where: { AND: readonly Record<string, unknown>[] }
      select: { presentationLines: { select: { deliveryLines: { where: unknown } } } }
    }
    expect(args.where.AND).toEqual([{ companyId: EMPRESA }, { id: { in: ['o-1', 'o-2'] } }])
    expect(args.where.AND.some((termino) => 'deletedAt' in termino)).toBe(false)
    // Lo anulado no cuenta como entregado.
    expect(args.select.presentationLines.select.deliveryLines.where).toEqual({ voidLine: { is: null } })
    expect(progreso).toEqual([
      {
        id: 'o-1',
        recipeId: 'r-1',
        lines: [
          { presentationId: 'p-1', packages: 10, packedPackages: 8, deliveredPackages: 3 },
          { presentationId: 'p-2', packages: 5, packedPackages: null, deliveredPackages: 0 },
        ],
      },
    ])
  })

  it('con ids vacio no consulta', async () => {
    await expect(listOrderDeliveryProgressByIdsIncludingDeleted(EMPRESA, [])).resolves.toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })
})
