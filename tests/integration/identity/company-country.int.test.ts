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
import { NO_CREDENTIAL_SENTINEL } from '@/lib/modules/identity/domain/credential-setup-link'
import { DOCUMENT_TYPE_CC } from '@/lib/modules/identity/domain/document-type'
import { ROLE_MAESTRO } from '@/lib/modules/identity/domain/roles'
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

/** Autor de los eventos del historial: un Maestro propio de la transaccion. */
async function createActor(tx: Prisma.TransactionClient): Promise<string> {
  const tag = randomUUID()
  const role = await tx.role.findUniqueOrThrow({ where: { name: ROLE_MAESTRO }, select: { id: true } })
  const actor = await tx.user.create({
    data: {
      firstNames: 'QC162',
      lastNames: 'Pais',
      birthDate: new Date('1990-01-01T00:00:00.000Z'),
      email: `qc162.pais.${tag}@example.test`,
      phone: '000000000',
      documentTypeCode: DOCUMENT_TYPE_CC,
      documentNumber: tag.replaceAll('-', '').slice(0, 20),
      username: `qc162.pais.${tag}`,
      passwordHash: NO_CREDENTIAL_SENTINEL,
      roleId: role.id,
      companyId: null,
      accountStatus: 'active',
    },
    select: { id: true },
  })
  return actor.id
}

function eventsOf(tx: Prisma.TransactionClient, companyId: string) {
  return tx.companyEvent.findMany({
    where: { companyId },
    select: { kind: true, actorId: true, occurredAt: true, details: true },
  })
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
      const actorId = await createActor(tx)
      const antes = await readCompany(tx, id)

      const outcome = await createCompanyCountryRepository(tx).setCountryOfAlive(
        id,
        'CO',
        actorId,
        new Date(),
      )

      expect(outcome).toBe('ok')
      const despues = await readCompany(tx, id)
      expect(despues).toEqual({ ...antes, country: 'CO', updatedAt: despues.updatedAt })
      expect(despues.updatedAt.getTime()).toBeGreaterThanOrEqual(antes.updatedAt.getTime())
    })
  })

  it('R3: el valor null deja la empresa sin pais', async () => {
    await inRolledBackTransaction(async (tx) => {
      const id = await createCompany(tx)
      const actorId = await createActor(tx)
      const repo = createCompanyCountryRepository(tx)
      await repo.setCountryOfAlive(id, 'PE', actorId, new Date())

      const outcome = await repo.setCountryOfAlive(id, null, actorId, new Date())

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
      const actorId = await createActor(tx)
      const repo = createCompanyCountryRepository(tx)

      expect(await repo.setCountryOfAlive(randomUUID(), 'CO', actorId, new Date())).toBe('not_found')
      expect(await repo.setCountryOfAlive(deBaja, 'CO', actorId, new Date())).toBe('not_found')

      expect(await readCompany(tx, viva)).toEqual(vivaAntes)
      expect(await readCompany(tx, deBaja)).toEqual(deBajaAntes)
      expect(await eventsOf(tx, deBaja)).toEqual([])
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

  it('R36 (QC-162): un cambio de pais deja un evento company.updated que nombra country, con autor e instante', async () => {
    await inRolledBackTransaction(async (tx) => {
      const id = await createCompany(tx)
      const actorId = await createActor(tx)
      const now = new Date('2026-10-14T12:00:00.000Z')

      const outcome = await createCompanyCountryRepository(tx).setCountryOfAlive(id, 'CO', actorId, now)

      expect(outcome).toBe('ok')
      expect((await readCompany(tx, id)).updatedAt).toEqual(now)
      expect(await eventsOf(tx, id)).toEqual([
        { kind: 'company.updated', actorId, occurredAt: now, details: { fields: ['country'] } },
      ])
    })
  })

  it('R36 (QC-162): el mismo pais responde ok sin evento y sin tocar updated_at', async () => {
    await inRolledBackTransaction(async (tx) => {
      const id = await createCompany(tx)
      const actorId = await createActor(tx)
      const repo = createCompanyCountryRepository(tx)
      await repo.setCountryOfAlive(id, 'CO', actorId, new Date('2026-10-14T12:00:00.000Z'))
      const antes = await readCompany(tx, id)

      const outcome = await repo.setCountryOfAlive(id, 'CO', actorId, new Date('2026-10-15T12:00:00.000Z'))

      expect(outcome).toBe('ok')
      expect(await readCompany(tx, id)).toEqual(antes)
      expect(await eventsOf(tx, id)).toHaveLength(1)
    })
  })

  it('R36 (QC-162): si el evento no se puede escribir, el pais tampoco cambia', async () => {
    await inRolledBackTransaction(async (tx) => {
      const id = await createCompany(tx)
      const antes = await readCompany(tx, id)

      await expect(
        createCompanyCountryRepository(tx).setCountryOfAlive(id, 'CO', randomUUID(), new Date()),
      ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError)

      expect(await readCompany(tx, id)).toEqual(antes)
      expect(await eventsOf(tx, id)).toEqual([])
    })
  })
})
