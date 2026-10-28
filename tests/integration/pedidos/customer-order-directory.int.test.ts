/**
 * `CustomerOrderDirectory` (`customer-order-directory-prisma.ts`) contra Postgres real: los pedidos
 * vivos de un cliente, sin los estados excluidos, del mas reciente al mas antiguo.
 *
 * AISLAMIENTO — `transaccion`: cada `it` corre en una `prisma.$transaction` interactiva que termina
 * lanzando `RollbackSignal`, y el directorio se construye sobre esa `tx`. Cada caso solo mira las
 * empresas, clientes y pedidos que el mismo crea.
 */
import { randomUUID } from 'node:crypto'

import type { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import { normalizeCompanyName } from '@/lib/modules/identity'
import { ORDER_STATUSES_NOT_IN_PROGRESS, type OrderStatus } from '@/lib/modules/pedidos'
import { createCustomerOrderDirectory } from '@/lib/modules/pedidos/adapters/driven/persistence/customer-order-directory-prisma'
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
  const name = `qc245-pedidos-${marca}`
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
      firstNames: 'QC245',
      lastNames: 'Pedidos',
      birthDate: new Date('1990-05-17T00:00:00.000Z'),
      email: `qc245.${marca}@quimicloude.test`,
      phone: '000000000',
      documentTypeCode: documentType.code,
      documentNumber: marca.slice(0, 12),
      username: `qc245.${marca}`,
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

async function crearCliente(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
  const customer = await tx.customer.create({
    data: {
      firstNames: 'Ana',
      firstNamesNormalized: 'ana',
      lastNames: 'Perez',
      lastNamesNormalized: 'perez',
      city: 'Bogota',
      cityNormalized: 'bogota',
      companyId,
    },
    select: { id: true },
  })
  return customer.id
}

let sequence = 700_000 + Math.floor(Math.random() * 100_000)

type Pedido = { id: string; sequence: number; createdAt: Date }

async function insertarPedido(
  tx: Prisma.TransactionClient,
  empresa: Empresa,
  customerId: string | null,
  status: OrderStatus,
  createdAt: Date,
  options: { deleted?: boolean; id?: string } = {},
): Promise<Pedido> {
  sequence += 1
  const id = options.id ?? randomUUID()
  await tx.$executeRawUnsafe(
    `INSERT INTO "orders" ("id","company_id","customer_id","order_year","order_sequence","recipe_id",
       "quantity","status","cancellation_reason","packed_by","conditioned_by","finished_at",
       "deleted_at","created_at","updated_at")
     VALUES ($1::uuid, $2::uuid, $3::uuid, 2026, $4, $5::uuid, 10, $6::"OrderStatus", $7, $8::uuid,
       $8::uuid, $9::timestamptz, $10::timestamptz, $11::timestamptz, CURRENT_TIMESTAMP)`,
    id,
    empresa.companyId,
    customerId,
    sequence,
    empresa.recipeId,
    status,
    status === 'CANCELADO' ? 'Cancelado en la prueba' : null,
    status === 'TERMINADO' ? empresa.userId : null,
    status === 'TERMINADO' ? new Date() : null,
    options.deleted === true ? new Date() : null,
    createdAt,
  )
  return { id, sequence, createdAt }
}

function dia(n: number): Date {
  return new Date(Date.UTC(2026, 9, n, 12, 0, 0))
}

describe('pedidos de un cliente contra Postgres', () => {
  it('R51: devuelve solo los pedidos vivos de ese cliente y esa empresa, con numero, estado, receta y fecha', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await crearEmpresa(tx)
      const cliente = await crearCliente(tx, empresa.companyId)
      const otroCliente = await crearCliente(tx, empresa.companyId)

      const propio = await insertarPedido(tx, empresa, cliente, 'EN_CURSO', dia(2))
      await insertarPedido(tx, empresa, cliente, 'PENDIENTE', dia(3), { deleted: true })
      await insertarPedido(tx, empresa, otroCliente, 'PENDIENTE', dia(4))
      await insertarPedido(tx, empresa, null, 'PENDIENTE', dia(5))

      const rows = await createCustomerOrderDirectory(tx).listAliveOfCustomer(
        empresa.companyId,
        cliente,
        ORDER_STATUSES_NOT_IN_PROGRESS,
        20,
      )

      expect(rows).toEqual([
        {
          id: propio.id,
          number: { year: 2026, sequence: propio.sequence },
          status: 'EN_CURSO',
          recipeId: empresa.recipeId,
          createdAt: dia(2),
        },
      ])
    })
  })

  it('R51, R54: con ORDER_STATUSES_NOT_IN_PROGRESS no vuelve ningun entregado ni cancelado; TERMINADO y BLOQUEADO si', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await crearEmpresa(tx)
      const cliente = await crearCliente(tx, empresa.companyId)

      await insertarPedido(tx, empresa, cliente, 'PENDIENTE', dia(1))
      await insertarPedido(tx, empresa, cliente, 'TERMINADO', dia(2))
      await insertarPedido(tx, empresa, cliente, 'BLOQUEADO', dia(3))
      await insertarPedido(tx, empresa, cliente, 'ENTREGADO', dia(4))
      await insertarPedido(tx, empresa, cliente, 'CANCELADO', dia(5))

      const directory = createCustomerOrderDirectory(tx)
      const abiertos = await directory.listAliveOfCustomer(
        empresa.companyId,
        cliente,
        ORDER_STATUSES_NOT_IN_PROGRESS,
        20,
      )
      expect(abiertos.map((row) => row.status)).toEqual(['BLOQUEADO', 'TERMINADO', 'PENDIENTE'])

      // Sin exclusiones vuelven todos: el filtro sale del argumento, no del adaptador.
      const todos = await directory.listAliveOfCustomer(empresa.companyId, cliente, [], 20)
      expect(todos.map((row) => row.status)).toEqual([
        'CANCELADO',
        'ENTREGADO',
        'BLOQUEADO',
        'TERMINADO',
        'PENDIENTE',
      ])
    })
  })

  it('R51: ordena por created_at DESC y desempata por id DESC', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await crearEmpresa(tx)
      const cliente = await crearCliente(tx, empresa.companyId)

      const antiguo = await insertarPedido(tx, empresa, cliente, 'PENDIENTE', dia(1))
      const reciente = await insertarPedido(tx, empresa, cliente, 'PENDIENTE', dia(9))
      const empateBajo = await insertarPedido(tx, empresa, cliente, 'PENDIENTE', dia(5), {
        id: '00000000-0000-4000-8000-000000000001',
      })
      const empateAlto = await insertarPedido(tx, empresa, cliente, 'PENDIENTE', dia(5), {
        id: 'ffffffff-ffff-4fff-bfff-ffffffffffff',
      })

      const rows = await createCustomerOrderDirectory(tx).listAliveOfCustomer(
        empresa.companyId,
        cliente,
        ORDER_STATUSES_NOT_IN_PROGRESS,
        20,
      )

      expect(rows.map((row) => row.id)).toEqual([
        reciente.id,
        empateAlto.id,
        empateBajo.id,
        antiguo.id,
      ])
    })
  })

  it('R54: respeta limit y se queda con los mas recientes', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await crearEmpresa(tx)
      const cliente = await crearCliente(tx, empresa.companyId)

      const pedidos: Pedido[] = []
      for (let n = 1; n <= 5; n += 1) {
        pedidos.push(await insertarPedido(tx, empresa, cliente, 'PENDIENTE', dia(n)))
      }

      const rows = await createCustomerOrderDirectory(tx).listAliveOfCustomer(
        empresa.companyId,
        cliente,
        ORDER_STATUSES_NOT_IN_PROGRESS,
        3,
      )

      expect(rows.map((row) => row.id)).toEqual([pedidos[4]?.id, pedidos[3]?.id, pedidos[2]?.id])
    })
  })

  it('R54: un cliente de otra empresa, o uno inexistente, da []', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await crearEmpresa(tx)
      const otra = await crearEmpresa(tx)
      const clienteAjeno = await crearCliente(tx, otra.companyId)
      await insertarPedido(tx, otra, clienteAjeno, 'PENDIENTE', dia(1))

      const directory = createCustomerOrderDirectory(tx)

      expect(
        await directory.listAliveOfCustomer(
          empresa.companyId,
          clienteAjeno,
          ORDER_STATUSES_NOT_IN_PROGRESS,
          20,
        ),
      ).toEqual([])
      expect(
        await directory.listAliveOfCustomer(
          empresa.companyId,
          randomUUID(),
          ORDER_STATUSES_NOT_IN_PROGRESS,
          20,
        ),
      ).toEqual([])
      // El mismo cliente, preguntado desde su empresa, si tiene el pedido: el [] es por el ambito.
      expect(
        await directory.listAliveOfCustomer(otra.companyId, clienteAjeno, ORDER_STATUSES_NOT_IN_PROGRESS, 20),
      ).toHaveLength(1)
    })
  })
})
