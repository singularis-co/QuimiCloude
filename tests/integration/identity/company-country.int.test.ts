/**
 * El adaptador `company-country-prisma.ts` y la restriccion `companies_country_format` contra
 * Postgres real.
 *
 * AISLAMIENTO — `transaccion`: cada `it` corre en una `prisma.$transaction` interactiva que termina
 * lanzando `RollbackSignal`, y el adaptador se construye sobre esa `tx`. Lo que se espera que la
 * base rechace va bajo `SAVEPOINT`. Cada caso solo mira las empresas que el mismo crea.
 */
import { randomUUID } from 'node:crypto'

import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import { createCompanyCountryRepository } from '@/lib/modules/identity/adapters/driven/persistence/company-country-prisma'
import { normalizeCompanyName } from '@/lib/modules/identity'
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

const CHECK_VIOLATION = '23514'
/** Tres letras no llegan al CHECK: las corta antes el `VARCHAR(2)` de la columna. */
const STRING_DATA_RIGHT_TRUNCATION = '22001'

let savepointSeq = 0

function sqlStateOf(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta: unknown = error.meta
    if (typeof meta === 'object' && meta !== null && 'code' in meta) {
      const code: unknown = (meta as { code: unknown }).code
      if (typeof code === 'string') return code
    }
    return error.code
  }
  return error instanceof Error ? error.message : String(error)
}

async function expectRejectedByDatabase(
  tx: Prisma.TransactionClient,
  run: () => Promise<unknown>,
  what: string,
): Promise<string> {
  savepointSeq += 1
  const savepoint = `qc235_sp_${String(savepointSeq)}`
  await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`)
  try {
    await run()
  } catch (error) {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`)
    return sqlStateOf(error)
  }
  await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`)
  throw new Error(`se esperaba que la base rechazara la operacion, pero la acepto: ${what}`)
}

async function createCompany(tx: Prisma.TransactionClient): Promise<string> {
  const name = `qc235-${randomUUID()}`
  const company = await tx.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name) },
    select: { id: true },
  })
  return company.id
}

const COMPANY_COLUMNS = {
  id: true,
  name: true,
  nameNormalized: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  country: true,
} satisfies Prisma.CompanySelect

function readCompany(tx: Prisma.TransactionClient, id: string) {
  return tx.company.findUniqueOrThrow({ where: { id }, select: COMPANY_COLUMNS })
}

describe('pais de la empresa contra Postgres', () => {
  it('R1: una empresa recien creada no tiene pais', async () => {
    await inRolledBackTransaction(async (tx) => {
      const id = await createCompany(tx)

      const rows = await tx.$queryRaw<Array<{ country: string | null }>>`
        SELECT country FROM companies WHERE id = ${id}::uuid`

      expect(rows).toEqual([{ country: null }])
    })
  })

  it('R2: fija el pais sin tocar nombre, forma normalizada, alta ni baja', async () => {
    await inRolledBackTransaction(async (tx) => {
      const id = await createCompany(tx)
      const antes = await readCompany(tx, id)

      const outcome = await createCompanyCountryRepository(tx).setCountryOfAlive(id, 'CO')

      expect(outcome).toBe('ok')
      const despues = await readCompany(tx, id)
      expect(despues).toEqual({ ...antes, country: 'CO', updatedAt: despues.updatedAt })
      expect(despues.updatedAt.getTime()).toBeGreaterThanOrEqual(antes.updatedAt.getTime())
    })
  })

  it('R3: el valor null deja la empresa sin pais', async () => {
    await inRolledBackTransaction(async (tx) => {
      const id = await createCompany(tx)
      const repo = createCompanyCountryRepository(tx)
      await repo.setCountryOfAlive(id, 'PE')

      const outcome = await repo.setCountryOfAlive(id, null)

      expect(outcome).toBe('ok')
      expect((await readCompany(tx, id)).country).toBeNull()
    })
  })

  it('R8: empresa inexistente o dada de baja → not_found y ninguna fila cambia', async () => {
    await inRolledBackTransaction(async (tx) => {
      const viva = await createCompany(tx)
      const deBaja = await createCompany(tx)
      await tx.company.update({ where: { id: deBaja }, data: { deletedAt: new Date() } })
      const vivaAntes = await readCompany(tx, viva)
      const deBajaAntes = await readCompany(tx, deBaja)
      const repo = createCompanyCountryRepository(tx)

      expect(await repo.setCountryOfAlive(randomUUID(), 'CO')).toBe('not_found')
      expect(await repo.setCountryOfAlive(deBaja, 'CO')).toBe('not_found')

      expect(await readCompany(tx, viva)).toEqual(vivaAntes)
      expect(await readCompany(tx, deBaja)).toEqual(deBajaAntes)
    })
  })

  it('R10: la base rechaza por SQL crudo un pais que no son dos mayusculas A-Z', async () => {
    await inRolledBackTransaction(async (tx) => {
      const id = await createCompany(tx)

      const casos = [
        { country: 'co', sqlState: CHECK_VIOLATION },
        { country: 'C1', sqlState: CHECK_VIOLATION },
        { country: 'COL', sqlState: STRING_DATA_RIGHT_TRUNCATION },
      ]
      for (const caso of casos) {
        const sqlState = await expectRejectedByDatabase(
          tx,
          () =>
            tx.$executeRaw`UPDATE companies SET country = ${caso.country} WHERE id = ${id}::uuid`,
          `pais ${caso.country}`,
        )
        expect(sqlState, `el pais ${caso.country} deberia caer`).toBe(caso.sqlState)
      }

      expect((await readCompany(tx, id)).country).toBeNull()
    })
  })
})
