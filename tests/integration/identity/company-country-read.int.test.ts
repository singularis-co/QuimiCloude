/**
 * La lectura del pais de la empresa (`findCountryOf` y `getCompanyCountry`) contra Postgres real.
 *
 * AISLAMIENTO — `transaccion`: cada `it` corre en una `prisma.$transaction` interactiva que termina
 * lanzando `RollbackSignal`, y el adaptador se construye sobre esa `tx`. Cada caso solo mira las
 * empresas que el mismo crea.
 */
import { randomUUID } from 'node:crypto'

import type { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import { createGetCompanyCountry, normalizeCompanyName } from '@/lib/modules/identity'
import { createCompanyCountryRepository } from '@/lib/modules/identity/adapters/driven/persistence/company-country-prisma'
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
  data: { country?: string | null; deletedAt?: Date | null } = {},
): Promise<string> {
  const name = `qc236-${randomUUID()}`
  const company = await tx.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name), ...data },
    select: { id: true },
  })
  return company.id
}

describe('lectura del pais de la empresa contra Postgres', () => {
  it('R2: una empresa viva con pais da su pais', async () => {
    await inRolledBackTransaction(async (tx) => {
      const id = await createCompany(tx, { country: 'CO' })

      expect(await createCompanyCountryRepository(tx).findCountryOf(id)).toBe('CO')
    })
  })

  it('R2: getCompanyCountry devuelve el pais que lee el adaptador', async () => {
    await inRolledBackTransaction(async (tx) => {
      const id = await createCompany(tx, { country: 'PE' })
      const getCompanyCountry = createGetCompanyCountry({
        companies: createCompanyCountryRepository(tx),
      })

      expect(await getCompanyCountry(id)).toBe('PE')
    })
  })

  it('R3: una empresa viva sin pais da null', async () => {
    await inRolledBackTransaction(async (tx) => {
      const id = await createCompany(tx)
      const getCompanyCountry = createGetCompanyCountry({
        companies: createCompanyCountryRepository(tx),
      })

      expect(await createCompanyCountryRepository(tx).findCountryOf(id)).toBeNull()
      expect(await getCompanyCountry(id)).toBeNull()
    })
  })

  it('R3: una empresa dada de baja, aunque tenga pais, da null', async () => {
    await inRolledBackTransaction(async (tx) => {
      const id = await createCompany(tx, { country: 'CO', deletedAt: new Date() })

      expect(await createCompanyCountryRepository(tx).findCountryOf(id)).toBeNull()
    })
  })

  it('R3: una empresa inexistente da null', async () => {
    await inRolledBackTransaction(async (tx) => {
      expect(await createCompanyCountryRepository(tx).findCountryOf(randomUUID())).toBeNull()
    })
  })

  it('R24: un codigo que pasa el CHECK pero libphonenumber-js no conoce da null, y el relleno cae a su defecto', async () => {
    await inRolledBackTransaction(async (tx) => {
      const id = await createCompany(tx, { country: 'ZZ' })

      expect(await createCompanyCountryRepository(tx).findCountryOf(id)).toBeNull()
    })
  })
})
