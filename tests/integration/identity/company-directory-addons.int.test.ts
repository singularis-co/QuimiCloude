/**
 * El directorio de empresas que recorre el cron de caducidad de pedidos no mira los añadidos: una
 * empresa viva sin ninguno sale en la lista igual que una con todos.
 *
 * AISLAMIENTO — `transaccion`: cada `it` corre en una `prisma.$transaction` interactiva que termina
 * lanzando `RollbackSignal`. `listActiveCompanyIds` usa el cliente global; mientras corre un caso,
 * el cliente se sustituye por un proxy que delega en su `tx`, asi la consulta de produccion ve las
 * empresas que el caso creo sin confirmarlas.
 */
import { randomUUID } from 'node:crypto'

import { Prisma } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'

const enCurso = vi.hoisted(() => ({ tx: null as unknown }))

vi.mock('@/lib/shared/db/prisma', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/shared/db/prisma')>()
  const proxy = new Proxy(real.prisma, {
    get(target, prop) {
      const source = (enCurso.tx ?? target) as object
      const value: unknown = Reflect.get(source, prop)
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(source) : value
    },
  })
  return { ...real, prisma: proxy }
})

import { ADDONS, normalizeCompanyName } from '@/lib/modules/identity'
import { listActiveCompanyIds } from '@/lib/modules/identity/adapters/driven/persistence/company-directory-prisma'
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
        enCurso.tx = tx
        try {
          await body(tx)
        } finally {
          enCurso.tx = null
        }
        throw new RollbackSignal()
      },
      { maxWait: 10_000, timeout: 60_000 },
    )
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error
  }
}

async function seedCompany(tx: Tx, fields: { addons: string[]; deleted?: boolean }): Promise<string> {
  const name = `Directorio ${randomUUID().replaceAll('-', '')}`
  const company = await tx.company.create({
    data: {
      name,
      nameNormalized: normalizeCompanyName(name),
      addons: fields.addons,
      deletedAt: fields.deleted === true ? new Date() : null,
    },
    select: { id: true },
  })
  return company.id
}

describe('listActiveCompanyIds y los añadidos', () => {
  it('R25: una empresa viva sin añadidos sale en la lista, igual que una con todos; la de baja no', async () => {
    await inRolledBackTransaction(async (tx) => {
      const sinAnadidos = await seedCompany(tx, { addons: [] })
      const conTodos = await seedCompany(tx, { addons: [...ADDONS] })
      const deBaja = await seedCompany(tx, { addons: [...ADDONS], deleted: true })

      const ids = await listActiveCompanyIds()

      expect(ids).toContain(sinAnadidos)
      expect(ids).toContain(conTodos)
      expect(ids).not.toContain(deBaja)
    })
  })
})
