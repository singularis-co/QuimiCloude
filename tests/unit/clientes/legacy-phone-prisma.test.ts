// El resumen de `processLegacyPhonesOfCompany` cuenta las filas que el `updateMany` escribio de
// verdad, no las del plan.
//
// HONESTIDAD: este archivo NO toca Postgres. El cliente Prisma se sustituye por un doble: aqui
// solo se fija como se suma el `count` de cada `UPDATE`. Que el `UPDATE` con `PENDING` se salte
// una fila editada entre la lectura y la escritura lo cubre `legacy-phone-backfill.int.test.ts`.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const tx = vi.hoisted(() => ({
  customer: { findMany: vi.fn(), updateMany: vi.fn() },
}))

const prismaDouble = vi.hoisted(() => ({
  $transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
}))

vi.mock('@/lib/shared/db/prisma', () => ({ prisma: prismaDouble }))

import { processLegacyPhonesOfCompany } from '@/lib/modules/clientes/adapters/driven/persistence/legacy-phone-prisma'
import type { LegacyPhoneOutcome, LegacyPhonePlan } from '@/lib/modules/clientes'

const ENERO = new Date('2026-01-10T10:00:00Z')
const SCOPE = { companyId: '00000000-0000-4000-8000-000000000001' }

const PLAN_FIJO: readonly LegacyPhoneOutcome[] = [
  { id: 'a', phoneCountry: 'CO', phoneE164: '573001234567', phoneIssue: null },
  { id: 'b', phoneCountry: 'CO', phoneE164: '573001234568', phoneIssue: null },
  { id: 'c', phoneCountry: 'CO', phoneE164: null, phoneIssue: 'invalid_format' },
  { id: 'd', phoneCountry: 'CO', phoneE164: null, phoneIssue: 'duplicate' },
]
const plan: LegacyPhonePlan = () => PLAN_FIJO

beforeEach(() => {
  tx.customer.findMany.mockReset()
  tx.customer.updateMany.mockReset()
  tx.customer.findMany
    .mockResolvedValueOnce(
      PLAN_FIJO.map((o) => ({ id: o.id, phone: `tel ${o.id}`, createdAt: ENERO })),
    )
    .mockResolvedValueOnce([])
})

describe('processLegacyPhonesOfCompany — el resumen', () => {
  it('R24, R25, R26 — con todas las filas escritas, cuenta convertidas, invalidas y duplicadas', async () => {
    tx.customer.updateMany.mockResolvedValue({ count: 1 })

    await expect(processLegacyPhonesOfCompany(plan, SCOPE)).resolves.toEqual({
      converted: 2,
      invalid: 1,
      duplicate: 1,
    })
  })

  it('R24 — una fila que dejo de estar pendiente (count 0) no entra en el resumen', async () => {
    tx.customer.updateMany.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      count: where.id === 'b' || where.id === 'c' ? 0 : 1,
    }))

    await expect(processLegacyPhonesOfCompany(plan, SCOPE)).resolves.toEqual({
      converted: 1,
      invalid: 0,
      duplicate: 1,
    })
    expect(tx.customer.updateMany).toHaveBeenCalledTimes(PLAN_FIJO.length)
  })
})
