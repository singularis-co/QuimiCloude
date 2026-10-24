/**
 * La lectura del nombre de la empresa (`findNameOf` y `getCompanyName`) contra Postgres real.
 *
 * AISLAMIENTO — `transaccion`: cada `it` corre en una `prisma.$transaction` interactiva que termina
 * lanzando `RollbackSignal`, y el adaptador se construye sobre esa `tx`. Cada caso solo mira las
 * empresas que el mismo crea.
 */
import { randomUUID } from 'node:crypto'

import type { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import { createGetCompanyName, normalizeCompanyName } from '@/lib/modules/identity'
import { createCompanyNameReader } from '@/lib/modules/identity/adapters/driven/persistence/company-name-prisma'
import { prisma } from '@/lib/shared/db/prisma'

class RollbackSignal extends Error {
  constructor() {
    super('rollback de aislamiento del test')
    this.name = 'RollbackSignal'
  }
}

async function inRolledBackTransaction(
  body: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await body(tx)
        throw new RollbackSignal()
      },
      { maxWait: 10_000, timeout: 30_000 },
    )
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error
  }
}

async function createCompany(
  tx: Prisma.TransactionClient,
  data: { deletedAt?: Date | null } = {},
): Promise<{ id: string; name: string }> {
  const name = `qc245-${randomUUID()}`
  const company = await tx.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name), ...data },
    select: { id: true },
  })
  return { id: company.id, name }
}

describe('lectura del nombre de la empresa contra Postgres', () => {
  it('R56: una empresa viva da su nombre', async () => {
    await inRolledBackTransaction(async (tx) => {
      const company = await createCompany(tx)

      expect(await createCompanyNameReader(tx).findNameOf(company.id)).toBe(company.name)
    })
  })

  it('R56: getCompanyName devuelve el nombre que lee el adaptador, y no el de otra empresa', async () => {
    await inRolledBackTransaction(async (tx) => {
      const company = await createCompany(tx)
      const other = await createCompany(tx)
      const getCompanyName = createGetCompanyName({ companies: createCompanyNameReader(tx) })

      expect(await getCompanyName(company.id)).toBe(company.name)
      expect(await getCompanyName(other.id)).toBe(other.name)
    })
  })

  it('R56: una empresa dada de baja da null', async () => {
    await inRolledBackTransaction(async (tx) => {
      const company = await createCompany(tx, { deletedAt: new Date() })

      expect(await createCompanyNameReader(tx).findNameOf(company.id)).toBeNull()
    })
  })

  it('R56: una empresa inexistente da null', async () => {
    await inRolledBackTransaction(async (tx) => {
      expect(await createCompanyNameReader(tx).findNameOf(randomUUID())).toBeNull()
    })
  })
})
