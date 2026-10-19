/**
 * `createCompanyMembershipReader` (adaptador de `company-prisma.ts`) contra Postgres real.
 *
 * AISLAMIENTO — `transaccion`: cada caso corre en una `prisma.$transaction` interactiva que termina
 * lanzando `RollbackSignal`, y el adaptador se construye sobre esa `tx`.
 */
import { randomUUID } from 'node:crypto'

import { Prisma } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'

import { createIsUserInCompany, normalizeCompanyName } from '@/lib/modules/identity'
import { createCompanyMembershipReader } from '@/lib/modules/identity/adapters/driven/persistence/company-prisma'
import { NO_CREDENTIAL_SENTINEL } from '@/lib/modules/identity/domain/credential-setup-link'
import { DOCUMENT_TYPE_CC } from '@/lib/modules/identity/domain/document-type'
import { ROLE_MAESTRO, ROLE_OPERADOR } from '@/lib/modules/identity/domain/roles'
import { prisma } from '@/lib/shared/db/prisma'

type Tx = Prisma.TransactionClient

class RollbackSignal extends Error {
  constructor() {
    super('rollback de aislamiento del test')
    this.name = 'RollbackSignal'
  }
}

async function inRolledBackTransaction(body: (tx: Tx) => Promise<void>): Promise<void> {
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

function tag(): string {
  return randomUUID().replaceAll('-', '')
}

async function createCompany(tx: Tx): Promise<string> {
  const name = `Pertenencia ${tag()}`
  const company = await tx.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name) },
    select: { id: true },
  })
  return company.id
}

async function createUser(
  tx: Tx,
  fields: { role: string; companyId: string | null; deleted?: boolean },
): Promise<string> {
  const marca = tag()
  const role = await tx.role.findUniqueOrThrow({ where: { name: fields.role }, select: { id: true } })
  const user = await tx.user.create({
    data: {
      firstNames: 'Ana',
      lastNames: 'Prueba',
      birthDate: new Date('1990-01-01T00:00:00.000Z'),
      email: `qc137.${marca}@example.test`,
      phone: '000000000',
      documentTypeCode: DOCUMENT_TYPE_CC,
      documentNumber: marca.slice(0, 20),
      username: `qc137.${marca}`,
      passwordHash: NO_CREDENTIAL_SENTINEL,
      roleId: role.id,
      companyId: fields.companyId,
      accountStatus: 'active',
      deletedAt: fields.deleted === true ? new Date() : null,
    },
    select: { id: true },
  })
  return user.id
}

afterAll(async () => {
  await prisma.$disconnect()
})

describe('isUserInCompany sobre el adaptador real', () => {
  it('QC-137 R12: true para un usuario vivo de esa empresa; false si es de otra empresa', async () => {
    await inRolledBackTransaction(async (tx) => {
      const isUserInCompany = createIsUserInCompany({ members: createCompanyMembershipReader(tx) })
      const companyA = await createCompany(tx)
      const companyB = await createCompany(tx)
      const userA = await createUser(tx, { role: ROLE_OPERADOR, companyId: companyA })

      expect(await isUserInCompany(userA, companyA)).toBe(true)
      expect(await isUserInCompany(userA, companyB)).toBe(false)
    })
  })

  it('QC-137 R12: false para un usuario dado de baja, para el Maestro y para ids que no existen', async () => {
    await inRolledBackTransaction(async (tx) => {
      const isUserInCompany = createIsUserInCompany({ members: createCompanyMembershipReader(tx) })
      const companyId = await createCompany(tx)
      const deBaja = await createUser(tx, { role: ROLE_OPERADOR, companyId, deleted: true })
      const maestro = await createUser(tx, { role: ROLE_MAESTRO, companyId: null })

      expect(await isUserInCompany(deBaja, companyId)).toBe(false)
      expect(await isUserInCompany(maestro, companyId)).toBe(false)
      expect(await isUserInCompany(randomUUID(), companyId)).toBe(false)
      expect(await isUserInCompany(maestro, randomUUID())).toBe(false)
    })
  })
})
