/**
 * `countOpenOrdersInCompany` (`order-company-stats-prisma.ts`) contra Postgres real: cuantos pedidos
 * en curso tiene una empresa, para el impacto de su baja.
 *
 * AISLAMIENTO — `transaccion`: cada `it` corre en una `prisma.$transaction` interactiva que termina
 * lanzando `RollbackSignal`, y el contador se llama sobre esa `tx`. Cada caso solo cuenta pedidos de
 * las empresas que el mismo crea.
 */
import { randomUUID } from 'node:crypto'

import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import { normalizeCompanyName } from '@/lib/modules/identity'
import { countOpenOrdersInCompany } from '@/lib/modules/pedidos/adapters/driven/persistence/order-company-stats-prisma'
import { ORDER_STATUSES_NOT_IN_PROGRESS } from '@/lib/modules/pedidos/domain/order-classification'
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

function token(): string {
  return randomUUID().replace(/-/gu, '')
}

type Empresa = { companyId: string; recipeId: string; userId: string }

async function crearEmpresa(tx: Prisma.TransactionClient): Promise<Empresa> {
  const marca = token()
  const name = `qc162-pedidos-${marca}`
  const company = await tx.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name) },
    select: { id: true },
  })
  const documentType = await tx.documentType.create({
    data: { code: `DOC${marca.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  })
  const role = await tx.role.create({
    data: { name: `rol-${marca}`, description: 'Rol de prueba' },
    select: { id: true },
  })
  const user = await tx.user.create({
    data: {
      firstNames: 'QC162',
      lastNames: 'Pedidos',
      birthDate: new Date('1990-05-17T00:00:00.000Z'),
      email: `qc162.${marca}@quimicloude.test`,
      phone: '000000000',
      documentTypeCode: documentType.code,
      documentNumber: marca.slice(0, 12),
      username: `qc162.${marca}`,
      passwordHash: 'hash-de-prueba-no-es-un-algoritmo-real',
      roleId: role.id,
      companyId: company.id,
    },
    select: { id: true },
  })
  const recipe = await tx.recipe.create({
    data: { name: `Receta ${marca}`, nameNormalized: `receta${marca}`, companyId: company.id },
    select: { id: true },
  })
  return { companyId: company.id, recipeId: recipe.id, userId: user.id }
}

let sequence = 800_000 + Math.floor(Math.random() * 100_000)

type Estado = 'PENDIENTE' | 'EN_CURSO' | 'TERMINADO' | 'BLOQUEADO' | 'ENTREGADO' | 'CANCELADO'

async function insertarPedido(
  tx: Prisma.TransactionClient,
  empresa: Empresa,
  status: Estado,
  options: { deleted?: boolean } = {},
): Promise<void> {
  sequence += 1
  await tx.$executeRawUnsafe(
    `INSERT INTO "orders" ("id","company_id","order_year","order_sequence","recipe_id","quantity",
       "status","cancellation_reason","packed_by","conditioned_by","finished_at","deleted_at",
       "updated_at")
     VALUES ($1::uuid, $2::uuid, 2026, $3, $4::uuid, 10, $5::"OrderStatus", $6, $7::uuid, $7::uuid,
       $8::timestamptz, $9::timestamptz, CURRENT_TIMESTAMP)`,
    randomUUID(),
    empresa.companyId,
    sequence,
    empresa.recipeId,
    status,
    status === 'CANCELADO' ? 'Cancelado en la prueba' : null,
    status === 'TERMINADO' ? empresa.userId : null,
    status === 'TERMINADO' ? new Date() : null,
    options.deleted === true ? new Date() : null,
  )
}

describe('pedidos en curso de una empresa contra Postgres', () => {
  it('R20: cuenta PENDIENTE, EN_CURSO, TERMINADO y BLOQUEADO; no ENTREGADO ni CANCELADO', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await crearEmpresa(tx)
      for (const status of ['PENDIENTE', 'EN_CURSO', 'TERMINADO', 'BLOQUEADO'] as const) {
        await insertarPedido(tx, empresa, status)
      }
      await insertarPedido(tx, empresa, 'ENTREGADO')
      await insertarPedido(tx, empresa, 'CANCELADO')

      expect(await countOpenOrdersInCompany(empresa.companyId, tx)).toBe(4)
    })
  })

  it('R20: no cuenta pedidos borrados ni pedidos de otra empresa', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await crearEmpresa(tx)
      const otra = await crearEmpresa(tx)
      await insertarPedido(tx, empresa, 'PENDIENTE')
      await insertarPedido(tx, empresa, 'PENDIENTE', { deleted: true })
      await insertarPedido(tx, otra, 'PENDIENTE')
      await insertarPedido(tx, otra, 'TERMINADO')

      expect(await countOpenOrdersInCompany(empresa.companyId, tx)).toBe(1)
      expect(await countOpenOrdersInCompany(otra.companyId, tx)).toBe(2)
    })
  })

  it('R20: una empresa sin pedidos cuenta cero', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await crearEmpresa(tx)

      expect(await countOpenOrdersInCompany(empresa.companyId, tx)).toBe(0)
    })
  })

  it('R20: los estados que no estan en curso son exactamente ENTREGADO y CANCELADO', () => {
    expect([...ORDER_STATUSES_NOT_IN_PROGRESS]).toEqual(['ENTREGADO', 'CANCELADO'])
  })
})
