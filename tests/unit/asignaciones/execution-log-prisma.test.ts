// Los dos adaptadores driven del registro de ejecucion, contra un doble del cliente Prisma. Lo que
// hacen contra Postgres lo prueban los tests de integracion; aqui, la forma de lo que envian.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { PrismaClient } from '@prisma/client'
import { OrderExecutionAction } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { transaction } = vi.hoisted(() => ({ transaction: vi.fn() }))
vi.mock('@/lib/shared/db/prisma', () => ({ prisma: { $transaction: transaction } }))

import {
  EXECUTION_ACTION_FROM_PRISMA,
  EXECUTION_ACTION_TO_PRISMA,
  createExecutionLogRepository,
} from '@/lib/modules/asignaciones/adapters/driven/persistence/execution-log-prisma'
import { withExecutionTransaction } from '@/lib/modules/asignaciones/adapters/driven/persistence/execution-transaction-prisma'
import type { ConditioningBatchSnapshotLine } from '@/lib/modules/asignaciones/domain/conditioning-trace'
import { EXECUTION_ACTIONS, type NewExecutionEntry } from '@/lib/modules/asignaciones/domain/execution-entry'

const COMPANY = '11111111-1111-4111-8111-111111111111'
const ORDER = '22222222-2222-4222-8222-222222222222'
const USER = '33333333-3333-4333-8333-333333333333'
const NOW = new Date('2026-10-06T12:00:00.000Z')

const base = { companyId: COMPANY, orderId: ORDER, userId: USER, occurredAt: NOW } as const

const REGISTRO_ABS = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../lib/modules/asignaciones/adapters/driven/persistence/execution-log-prisma.ts',
)

function clienteDoble() {
  const create = vi.fn().mockResolvedValue({})
  const findFirst = vi.fn().mockResolvedValue(null)
  const db = { orderExecutionEntry: { create, findFirst } } as unknown as PrismaClient
  return { db, create, findFirst }
}

const BATCH = '44444444-4444-4444-8444-444444444444'
const PRESENTATION = '55555555-5555-4555-8555-555555555555'

const FOTO: readonly ConditioningBatchSnapshotLine[] = [
  {
    batchId: BATCH,
    presentationId: PRESENTATION,
    presentationName: 'Frasco 1 L',
    lot: 'L-2026-001',
    expiryDate: '2027-10-14',
    productionDate: '2026-10-14',
  },
]

function entradaDe(action: (typeof EXECUTION_ACTIONS)[number]): NewExecutionEntry {
  if (action === 'cancel') return { ...base, action, stepPosition: 2, reason: 'sin material' }
  if (action === 'conditioning_batch_save') return { ...base, action, stepPosition: null, batchLines: FOTO }
  if (
    action === 'pack_start' ||
    action === 'pack_finish' ||
    action === 'conditioning_start' ||
    action === 'conditioning_finish'
  ) {
    return { ...base, action, stepPosition: null }
  }
  return { ...base, action, stepPosition: 3 }
}

// Enmendado el 2026-10-14 (QC-283): el enum gana las tres acciones del acondicionamiento; el mapa
// pasa de ocho a once pares y sigue cubriendo exactamente el dominio y el enum.
describe('execution-log-prisma: el mapa al enum (R1)', () => {
  it('R1: el mapa tiene exactamente once pares, uno por accion del dominio', () => {
    expect(Object.keys(EXECUTION_ACTION_TO_PRISMA)).toHaveLength(11)
    expect(Object.keys(EXECUTION_ACTION_TO_PRISMA).sort()).toEqual([...EXECUTION_ACTIONS].sort())
  })

  it('R1: los once valores del mapa son los once del enum de Prisma, sin repetir', () => {
    expect(new Set(Object.values(EXECUTION_ACTION_TO_PRISMA)).size).toBe(11)
    expect(Object.values(EXECUTION_ACTION_TO_PRISMA).sort()).toEqual(
      [...Object.values(OrderExecutionAction)].sort(),
    )
  })

  it.each(EXECUTION_ACTIONS)('R1: append de %s escribe su valor del enum', async (action) => {
    const { db, create } = clienteDoble()
    await createExecutionLogRepository(db).append(entradaDe(action))
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0].data.action).toBe(action.toUpperCase())
  })
})

describe('execution-log-prisma: append', () => {
  it('R8: cancel escribe su motivo, con occurredAt explicito y la posicion recibida', async () => {
    const { db, create } = clienteDoble()
    await createExecutionLogRepository(db).append({ ...base, action: 'cancel', stepPosition: 2, reason: 'sin material' })
    expect(create).toHaveBeenCalledWith({
      data: {
        companyId: COMPANY,
        orderId: ORDER,
        userId: USER,
        action: 'CANCEL',
        stepPosition: 2,
        reason: 'sin material',
        occurredAt: NOW,
      },
    })
  })

  it('R8: una accion que no es cancel escribe reason null', async () => {
    const { db, create } = clienteDoble()
    await createExecutionLogRepository(db).append({ ...base, action: 'advance', stepPosition: 4 })
    expect(create.mock.calls[0][0].data).toMatchObject({ action: 'ADVANCE', stepPosition: 4, reason: null, occurredAt: NOW })
  })

  it('R5bis: pack_finish escribe stepPosition null', async () => {
    const { db, create } = clienteDoble()
    await createExecutionLogRepository(db).append({ ...base, action: 'pack_finish', stepPosition: null })
    expect(create.mock.calls[0][0].data).toMatchObject({ action: 'PACK_FINISH', stepPosition: null, reason: null })
  })
})

describe('execution-log-prisma: findLastStepPosition (R14)', () => {
  it('R14: la ultima fila con posicion de ese pedido en esa empresa, ordenada por instante e id', async () => {
    const { db, findFirst } = clienteDoble()
    findFirst.mockResolvedValue({ stepPosition: 5 })
    await expect(createExecutionLogRepository(db).findLastStepPosition(COMPANY, ORDER)).resolves.toBe(5)
    expect(findFirst).toHaveBeenCalledWith({
      where: { companyId: COMPANY, orderId: ORDER, stepPosition: { not: null } },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      select: { stepPosition: true },
    })
  })

  it('R14: sin anotaciones con posicion devuelve null', async () => {
    const { db } = clienteDoble()
    await expect(createExecutionLogRepository(db).findLastStepPosition(COMPANY, ORDER)).resolves.toBeNull()
  })
})

describe('execution-log-prisma: solo anexar (R31)', () => {
  it('R31: el archivo del registro no contiene update, upsert ni delete sobre ningun modelo', () => {
    const fuente = readFileSync(REGISTRO_ABS, 'utf8')
    expect(fuente).not.toMatch(/\.\s*(update|updateMany|upsert|delete|deleteMany)\s*\(/)
    expect(fuente).not.toMatch(/\$executeRaw|\$queryRaw|\bUPDATE\b|\bDELETE\b/)
  })

  // Enmendado el 2026-10-07 (QC-167): el registro gana tres lecturas (`findMany`, `groupBy`); la
  // unica escritura sigue siendo `create`.
  it('R31 / R22: las unicas operaciones sobre orderExecutionEntry son create y tres de lectura', () => {
    const fuente = readFileSync(REGISTRO_ABS, 'utf8')
    const operaciones = [...fuente.matchAll(/orderExecutionEntry\s*\.\s*(\w+)/g)].map((m) => m[1])
    expect([...new Set(operaciones)].sort()).toEqual(['create', 'findFirst', 'findMany', 'groupBy'])
  })
})

describe('execution-log-prisma: el mapa inverso del enum (QC-167 T4a)', () => {
  it.each(EXECUTION_ACTIONS)('R14: %s va al enum y vuelve igual', (action) => {
    expect(EXECUTION_ACTION_FROM_PRISMA[EXECUTION_ACTION_TO_PRISMA[action]]).toBe(action)
  })

  it.each(Object.values(OrderExecutionAction))('R14: el valor %s del enum vuelve a su accion y de ahi a si mismo', (value) => {
    const action = EXECUTION_ACTION_FROM_PRISMA[value]
    expect(EXECUTION_ACTIONS).toContain(action)
    expect(EXECUTION_ACTION_TO_PRISMA[action]).toBe(value)
  })

  it('R14: el mapa inverso tiene exactamente once pares', () => {
    expect(Object.keys(EXECUTION_ACTION_FROM_PRISMA).sort()).toEqual([...Object.values(OrderExecutionAction)].sort())
    expect(new Set(Object.values(EXECUTION_ACTION_FROM_PRISMA)).size).toBe(11)
  })

  it('R14: el inverso se deriva del mapa de ida, no se escribe a mano', () => {
    const fuente = readFileSync(REGISTRO_ABS, 'utf8')
    expect(fuente.match(/'PACK_FINISH'/g)).toHaveLength(1)
  })
})

function clienteDeLectura() {
  const findMany = vi.fn()
  const groupBy = vi.fn()
  const db = { orderExecutionEntry: { findMany, groupBy } } as unknown as PrismaClient
  return { db, findMany, groupBy }
}

describe('execution-log-prisma: las tres lecturas', () => {
  const FROM = new Date('2026-09-01T00:00:00.000Z')
  const BEFORE = new Date('2026-09-03T00:00:00.000Z')

  it('R23: listExecutedOrderIds sin filtro agrupa por pedido solo con la empresa', async () => {
    const { db, groupBy } = clienteDeLectura()
    groupBy.mockResolvedValue([{ orderId: ORDER }])
    await expect(createExecutionLogRepository(db).listExecutedOrderIds(COMPANY, {})).resolves.toEqual([ORDER])
    expect(groupBy).toHaveBeenCalledWith({ by: ['orderId'], where: { companyId: COMPANY } })
  })

  it('R7 / R8: listExecutedOrderIds lleva la persona y el rango gte / lt en el where', async () => {
    const { db, groupBy } = clienteDeLectura()
    groupBy.mockResolvedValue([])
    await createExecutionLogRepository(db).listExecutedOrderIds(COMPANY, {
      userId: USER,
      occurredFrom: FROM,
      occurredBefore: BEFORE,
    })
    expect(groupBy).toHaveBeenCalledWith({
      by: ['orderId'],
      where: { companyId: COMPANY, userId: USER, occurredAt: { gte: FROM, lt: BEFORE } },
    })
  })

  it('R8: un extremo ausente no aparece en el where', async () => {
    const { db, groupBy } = clienteDeLectura()
    groupBy.mockResolvedValue([])
    await createExecutionLogRepository(db).listExecutedOrderIds(COMPANY, { occurredBefore: BEFORE })
    expect(groupBy.mock.calls[0][0].where).toEqual({ companyId: COMPANY, occurredAt: { lt: BEFORE } })
  })

  it('R23: listEntriesForOrders filtra por empresa, ordena por pedido, instante e id y traduce la accion', async () => {
    const { db, findMany } = clienteDeLectura()
    findMany.mockResolvedValue([
      {
        id: 'e1',
        orderId: ORDER,
        userId: USER,
        action: 'GO_BACK',
        stepPosition: 2,
        reason: null,
        batchLines: null,
        occurredAt: NOW,
      },
    ])
    const entries = await createExecutionLogRepository(db).listEntriesForOrders(COMPANY, [ORDER])
    expect(entries).toEqual([
      {
        id: 'e1',
        orderId: ORDER,
        userId: USER,
        action: 'go_back',
        stepPosition: 2,
        reason: null,
        batchLines: null,
        occurredAt: NOW,
      },
    ])
    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: { companyId: COMPANY, orderId: { in: [ORDER] } },
      orderBy: [{ orderId: 'asc' }, { occurredAt: 'asc' }, { id: 'asc' }],
    })
  })

  it('R23: listUserIdsWithEntries agrupa por persona solo con la empresa', async () => {
    const { db, groupBy } = clienteDeLectura()
    groupBy.mockResolvedValue([{ userId: USER }])
    await expect(createExecutionLogRepository(db).listUserIdsWithEntries(COMPANY)).resolves.toEqual([USER])
    expect(groupBy).toHaveBeenCalledWith({ by: ['userId'], where: { companyId: COMPANY } })
  })
})

describe('execution-log-prisma: la foto del guardado de lote', () => {
  const fila = (batchLines: unknown) => ({
    id: 'e9',
    orderId: ORDER,
    userId: USER,
    action: 'CONDITIONING_BATCH_SAVE',
    stepPosition: null,
    reason: null,
    batchLines,
    occurredAt: NOW,
  })

  it('R7: conditioning_batch_save escribe su foto en batchLines, sin posicion ni motivo', async () => {
    const { db, create } = clienteDoble()
    await createExecutionLogRepository(db).append(entradaDe('conditioning_batch_save'))
    expect(create.mock.calls[0][0].data).toMatchObject({
      action: 'CONDITIONING_BATCH_SAVE',
      stepPosition: null,
      reason: null,
      batchLines: FOTO,
    })
  })

  it.each(['conditioning_start', 'conditioning_finish', 'pack_start', 'advance', 'cancel'] as const)(
    'R7: %s no manda batchLines, asi que la columna queda en NULL',
    async (action) => {
      const { db, create } = clienteDoble()
      await createExecutionLogRepository(db).append(entradaDe(action))
      expect(create.mock.calls[0][0].data).not.toHaveProperty('batchLines')
    },
  )

  it('R33: append valida la foto con zod y no escribe una corrupta ni una vacia', async () => {
    const { db, create } = clienteDoble()
    const repo = createExecutionLogRepository(db)
    const corrupta = [{ ...FOTO[0], expiryDate: '14/10/2027' }] as unknown as readonly ConditioningBatchSnapshotLine[]
    await expect(
      repo.append({ ...base, action: 'conditioning_batch_save', stepPosition: null, batchLines: corrupta }),
    ).rejects.toThrow()
    await expect(
      repo.append({ ...base, action: 'conditioning_batch_save', stepPosition: null, batchLines: [] }),
    ).rejects.toThrow()
    expect(create).not.toHaveBeenCalled()
  })

  it('R33: listEntriesForOrders selecciona batchLines y devuelve la foto validada', async () => {
    const { db, findMany } = clienteDeLectura()
    findMany.mockResolvedValue([fila(FOTO)])
    const entries = await createExecutionLogRepository(db).listEntriesForOrders(COMPANY, [ORDER])
    expect(findMany.mock.calls[0][0].select).toMatchObject({ batchLines: true })
    expect(entries[0]).toMatchObject({ action: 'conditioning_batch_save', batchLines: FOTO })
  })

  it.each([
    ['un objeto en vez de un array', { ...FOTO[0] }],
    ['un array vacio', []],
    ['un campo de mas', [{ ...FOTO[0], quantity: 3 }]],
    ['un campo de menos', [{ ...FOTO[0], productionDate: undefined }]],
    ['una fecha que no es AAAA-MM-DD', [{ ...FOTO[0], expiryDate: '14/10/2027' }]],
    ['un batchId que no es uuid', [{ ...FOTO[0], batchId: 'lote-1' }]],
    ['un lote vacio', [{ ...FOTO[0], lot: '' }]],
  ])('R33: foto corrupta lanza al leer (%s)', async (_caso, batchLines) => {
    const { db, findMany } = clienteDeLectura()
    findMany.mockResolvedValue([fila(batchLines)])
    await expect(createExecutionLogRepository(db).listEntriesForOrders(COMPANY, [ORDER])).rejects.toThrow(/e9/)
  })

  it('R33: una foto con presentationName null es valida', async () => {
    const { db, findMany } = clienteDeLectura()
    const sinNombre = [{ ...FOTO[0], presentationName: null }]
    findMany.mockResolvedValue([fila(sinNombre)])
    const entries = await createExecutionLogRepository(db).listEntriesForOrders(COMPANY, [ORDER])
    expect(entries[0]?.batchLines).toEqual(sinNombre)
  })
})

describe('execution-transaction-prisma: withExecutionTransaction (R24)', () => {
  beforeEach(() => {
    transaction.mockReset()
  })

  it('R24: abre prisma.$transaction con maxWait 10_000 y timeout 30_000 y devuelve lo que devuelve run', async () => {
    const tx = { marca: 'tx' }
    transaction.mockImplementation((run: (t: unknown) => Promise<unknown>) => run(tx))
    const run = vi.fn().mockResolvedValue('hecho')

    await expect(withExecutionTransaction(run)).resolves.toBe('hecho')
    expect(run).toHaveBeenCalledWith(tx)
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(transaction.mock.calls[0][1]).toEqual({ maxWait: 10_000, timeout: 30_000 })
  })

  it('R24: si run lanza, el error sale tal cual de la transaccion', async () => {
    const fallo = new Error('aborta')
    transaction.mockImplementation((run: (t: unknown) => Promise<unknown>) => run({}))
    await expect(withExecutionTransaction(() => Promise.reject(fallo))).rejects.toBe(fallo)
  })
})
