// El resumen de `processLegacyPhonesOfCompany` cuenta las filas que el `updateMany` escribio de
// verdad, no las del plan; separa convertidas de reconvertidas por el `phone_issue` LEIDO; y crea
// el vinculo principal solo de las filas escritas con numero. Y que el `UPDATE` reescribe el
// `updatedAt` LEIDO: sin el, el `@updatedAt` de Prisma lo sellaria con la hora de la corrida.
//
// HONESTIDAD: este archivo NO toca Postgres. El cliente Prisma se sustituye por un doble: aqui
// solo se fija como se suma el `count` de cada `UPDATE` y que se llama al vinculo. Que el `UPDATE`
// se salte una fila editada entre la lectura y la escritura, y que el vinculo exista de verdad, lo
// cubre `legacy-phone-backfill.int.test.ts`.

import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tx = vi.hoisted(() => ({
  customer: { findMany: vi.fn(), updateMany: vi.fn() },
  phoneNumber: { upsert: vi.fn() },
  customerPhoneNumber: { create: vi.fn() },
}))

const prismaDouble = vi.hoisted(() => ({
  $transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
}))

vi.mock('@/lib/shared/db/prisma', () => ({ prisma: prismaDouble }))

import { processLegacyPhonesOfCompany } from '@/lib/modules/clientes/adapters/driven/persistence/legacy-phone-prisma'
import type { LegacyPhoneOutcome, LegacyPhonePlan, LegacyPhoneRow } from '@/lib/modules/clientes'

const FEBRERO = new Date('2026-02-10T10:00:00Z')
const SCOPE = { companyId: '00000000-0000-4000-8000-000000000001' }

const PLAN_FIJO: readonly LegacyPhoneOutcome[] = [
  { id: 'a', phoneCountry: 'CO', phoneE164: '573001234567', phoneIssue: null },
  { id: 'b', phoneCountry: 'CO', phoneE164: '573001234568', phoneIssue: null },
  { id: 'c', phoneCountry: 'CO', phoneE164: null, phoneIssue: 'invalid_format' },
  { id: 'd', phoneCountry: 'MX', phoneE164: '525512345678', phoneIssue: null },
  { id: 'e', phoneCountry: 'MX', phoneE164: null, phoneIssue: 'invalid_format' },
]
const LEIDO: Record<string, { phoneIssue: string | null; phoneCountry: string | null }> = {
  a: { phoneIssue: null, phoneCountry: null },
  b: { phoneIssue: null, phoneCountry: null },
  c: { phoneIssue: null, phoneCountry: null },
  d: { phoneIssue: 'duplicate', phoneCountry: 'MX' },
  e: { phoneIssue: 'duplicate', phoneCountry: 'MX' },
}
let recibidas: readonly LegacyPhoneRow[] = []
const plan: LegacyPhonePlan = (rows) => {
  recibidas = rows
  return PLAN_FIJO
}

beforeEach(() => {
  recibidas = []
  prismaDouble.$transaction.mockClear()
  tx.customer.findMany.mockReset()
  tx.customer.updateMany.mockReset()
  tx.phoneNumber.upsert.mockReset()
  tx.customerPhoneNumber.create.mockReset()
  tx.phoneNumber.upsert.mockResolvedValue({ id: 'numero' })
  tx.customerPhoneNumber.create.mockResolvedValue({ id: 'vinculo' })
  tx.customer.findMany.mockResolvedValueOnce(
    PLAN_FIJO.map((o) => ({ id: o.id, phone: `tel ${o.id}`, ...LEIDO[o.id], updatedAt: FEBRERO })),
  )
})

describe('processLegacyPhonesOfCompany — candidatas', () => {
  it('R49 — lee las vivas con phone, sin phone_e164 y con phone_issue nulo o duplicate', async () => {
    tx.customer.updateMany.mockResolvedValue({ count: 1 })

    await processLegacyPhonesOfCompany(plan, SCOPE)

    expect(tx.customer.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        deletedAt: null,
        phone: { not: null },
        phoneE164: null,
        OR: [{ phoneIssue: null }, { phoneIssue: 'duplicate' }],
        companyId: SCOPE.companyId,
      },
      select: { updatedAt: true, phoneIssue: true, phoneCountry: true },
    })
  })

  it('R49 — al plan le llega el pais solo de las duplicate; la pendiente va sin pais', async () => {
    tx.customer.updateMany.mockResolvedValue({ count: 1 })

    await processLegacyPhonesOfCompany(plan, SCOPE)

    expect(recibidas.map((r) => [r.id, r.phoneCountry])).toEqual([
      ['a', null],
      ['b', null],
      ['c', null],
      ['d', 'MX'],
      ['e', 'MX'],
    ])
  })
})

describe('processLegacyPhonesOfCompany — el resumen', () => {
  it('R13, R49 — con todas las filas escritas, cuenta convertidas, invalidas y reconvertidas', async () => {
    tx.customer.updateMany.mockResolvedValue({ count: 1 })

    await expect(processLegacyPhonesOfCompany(plan, SCOPE)).resolves.toEqual({
      converted: 2,
      invalid: 2,
      reconverted: 1,
    })
  })

  it('R49 — una fila que dejo de ser candidata (count 0) no entra en el resumen ni recibe vinculo', async () => {
    tx.customer.updateMany.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      count: where.id === 'b' || where.id === 'd' ? 0 : 1,
    }))

    await expect(processLegacyPhonesOfCompany(plan, SCOPE)).resolves.toEqual({
      converted: 1,
      invalid: 2,
      reconverted: 0,
    })
    expect(tx.customer.updateMany).toHaveBeenCalledTimes(PLAN_FIJO.length)
    expect(tx.customerPhoneNumber.create).toHaveBeenCalledTimes(1)
    expect(tx.customerPhoneNumber.create.mock.calls[0]?.[0]).toMatchObject({ data: { customerId: 'a' } })
  })
})

describe('processLegacyPhonesOfCompany — vinculo principal', () => {
  it('R8, R13, R49 — cada fila escrita con numero recibe su vinculo main en la misma transaccion', async () => {
    tx.customer.updateMany.mockResolvedValue({ count: 1 })

    await processLegacyPhonesOfCompany(plan, SCOPE)

    expect(prismaDouble.$transaction).toHaveBeenCalled()
    expect(tx.phoneNumber.upsert.mock.calls.map(([args]) => args.create.e164)).toEqual([
      '573001234567',
      '573001234568',
      '525512345678',
    ])
    const vinculos = tx.customerPhoneNumber.create.mock.calls.map(([args]) => args.data)
    expect(vinculos.map((v) => [v.customerId, v.main, v.companyId])).toEqual([
      ['a', true, SCOPE.companyId],
      ['b', true, SCOPE.companyId],
      ['d', true, SCOPE.companyId],
    ])
  })
})

describe('processLegacyPhonesOfCompany — updated_at', () => {
  it('R49 — cada UPDATE reescribe el updatedAt leido y repite la condicion de candidata leida', async () => {
    tx.customer.updateMany.mockResolvedValue({ count: 1 })

    await processLegacyPhonesOfCompany(plan, SCOPE)

    expect(tx.customer.updateMany).toHaveBeenCalledTimes(PLAN_FIJO.length)
    for (const [args] of tx.customer.updateMany.mock.calls) {
      expect(args.data.updatedAt).toEqual(FEBRERO)
      expect(args.data).not.toHaveProperty('updatedBy')
      expect(args.where.updatedAt).toEqual({
        gte: FEBRERO,
        lt: new Date(FEBRERO.getTime() + 1),
      })
      expect(args.where).toMatchObject({
        phoneE164: null,
        phoneIssue: LEIDO[args.where.id]?.phoneIssue,
        deletedAt: null,
        companyId: SCOPE.companyId,
      })
    }
  })
})

/** El P2002 que Prisma da cuando dos transacciones dan de alta el mismo numero nuevo. */
function choqueEnPhoneNumbers(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`company_id`,`e164`)', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { modelName: 'PhoneNumber', target: ['company_id', 'e164'] },
  })
}

function filasLeidas() {
  return PLAN_FIJO.map((o) => ({ id: o.id, phone: `tel ${o.id}`, ...LEIDO[o.id], updatedAt: FEBRERO }))
}

describe('processLegacyPhonesOfCompany — choque en phone_numbers', () => {
  it('R13, R49 — un choque en phone_numbers reintenta UNA vez en una transaccion nueva que relee las candidatas', async () => {
    tx.customer.updateMany.mockResolvedValue({ count: 1 })
    tx.customer.findMany.mockResolvedValueOnce(filasLeidas())
    tx.phoneNumber.upsert.mockRejectedValueOnce(choqueEnPhoneNumbers())

    await expect(processLegacyPhonesOfCompany(plan, SCOPE)).resolves.toEqual({
      converted: 2,
      invalid: 2,
      reconverted: 1,
    })
    expect(prismaDouble.$transaction).toHaveBeenCalledTimes(2)
    expect(tx.customer.findMany).toHaveBeenCalledTimes(2)
  })

  it('R13, R49 — si el reintento vuelve a chocar, el error sube sin un tercer intento', async () => {
    tx.customer.updateMany.mockResolvedValue({ count: 1 })
    tx.customer.findMany.mockResolvedValueOnce(filasLeidas())
    const segundo = choqueEnPhoneNumbers()
    tx.phoneNumber.upsert.mockRejectedValueOnce(choqueEnPhoneNumbers()).mockRejectedValueOnce(segundo)

    await expect(processLegacyPhonesOfCompany(plan, SCOPE)).rejects.toBe(segundo)
    expect(prismaDouble.$transaction).toHaveBeenCalledTimes(2)
  })

  it('R13, R49 — cualquier otro error sube sin reintentar', async () => {
    tx.customer.updateMany.mockResolvedValue({ count: 1 })
    const otro = new Error('otro fallo')
    tx.phoneNumber.upsert.mockRejectedValueOnce(otro)

    await expect(processLegacyPhonesOfCompany(plan, SCOPE)).rejects.toBe(otro)
    expect(prismaDouble.$transaction).toHaveBeenCalledTimes(1)
  })
})
