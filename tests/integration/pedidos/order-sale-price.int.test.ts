/**
 * El precio de venta del pedido contra una base Postgres REAL, con la migracion
 * `20261022120000_orders_sale_price` aplicada.
 *
 * POR QUE COMMITEA Y NO SE ENVUELVE EN UNA TRANSACCION CON ROLLBACK: el alta pasa por
 * `withOrderTransaction`, que abre SU PROPIA `prisma.$transaction` con el lock de aviso del
 * correlativo, y el resto de adaptadores (`updateAliveOrder`, `cancelAliveOrder`,
 * `softDeleteAliveOrder`, los de `order-catalog-prisma.ts`) hablan con el cliente Prisma GLOBAL.
 * Una transaccion del test correria en otra conexion del pool. Una empresa efimera nace en
 * `beforeAll` y muere en `afterAll`; cada caso siembra su pedido y lo borra en un `finally` por su
 * `id` exacto.
 *
 * El `CHECK` usa SQL crudo dentro de un `SAVEPOINT`: la escritura se espera que falle y no puede
 * dejar la conexion en un estado abortado.
 */
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { normalizeCustomerText } from '@/lib/modules/clientes/domain/customer-text'
import { normalizeCompanyName } from '@/lib/modules/identity'
import { normalizePresentationName } from '@/lib/modules/inventario'
import { findAliveOrderTargetById } from '@/lib/modules/pedidos/adapters/driven/persistence/order-catalog-prisma'
import {
  cancelAliveOrder,
  createOrderWriteRepository,
  findAliveOrderById,
  findAliveOrderLines,
  softDeleteAliveOrder,
} from '@/lib/modules/pedidos/adapters/driven/persistence/order-prisma'
import { withOrderTransaction } from '@/lib/modules/pedidos/adapters/driven/persistence/order-unit-of-work-prisma'
import { prisma } from '@/lib/shared/db/prisma'

import type { NewOrder, OrderScope } from '@/lib/modules/pedidos'
import type { OrderLineWrite } from '@/lib/modules/pedidos/ports/order-write-repository'
import { realOrderSummaries } from '../../helpers/order-summaries'
import { ensureOnlyLine } from '../../helpers/only-order-line'

/** Un ano de prueba propio, distinto de los demas archivos de `pedidos`, para no heredar secuencia. */
const YEAR = 2892

const { listAliveSummariesByIds, listAliveSummariesInCompany } = realOrderSummaries()

function token(): string {
  return randomUUID().replace(/-/gu, '')
}

let unitId: string
let documentTypeCode: string
let roleId: string
let companyId: string
let presentationId: string
let recipeId: string
let actorId: string
let customerId: string

async function seedFixtures(): Promise<void> {
  const marca = token()
  unitId = (
    await prisma.unit.create({
      data: { name: `Unidad ${marca}`, nameNormalized: `unidad${marca}`, symbol: `kg${marca}` },
      select: { id: true },
    })
  ).id
  documentTypeCode = (
    await prisma.documentType.create({
      data: { code: `DOC${marca.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
      select: { code: true },
    })
  ).code
  roleId = (
    await prisma.role.create({
      data: { name: `rol-${marca}`, description: 'Rol de prueba' },
      select: { id: true },
    })
  ).id
  companyId = (
    await prisma.company.create({
      data: { name: `Empresa ${marca}`, nameNormalized: normalizeCompanyName(`Empresa ${marca}`) },
      select: { id: true },
    })
  ).id
  presentationId = (
    await prisma.presentation.create({
      data: {
        name: `Bidon ${marca}`,
        nameNormalized: normalizePresentationName(`Bidon ${marca}`),
        unitId,
        companyId,
      },
      select: { id: true },
    })
  ).id
  recipeId = (
    await prisma.recipe.create({
      data: { name: `Receta ${marca}`, nameNormalized: `receta${marca}`, companyId },
      select: { id: true },
    })
  ).id
  actorId = (
    await prisma.user.create({
      data: {
        firstNames: 'Ana Maria',
        lastNames: 'Perez Gomez',
        birthDate: new Date('1990-05-17T00:00:00.000Z'),
        email: `ana.${marca}@quimicloude.test`,
        phone: '+57 300 111 2233',
        documentTypeCode,
        documentNumber: marca.slice(0, 12),
        username: `ana.${marca}`,
        passwordHash: 'hash-de-prueba-no-es-un-algoritmo-real',
        roleId,
        companyId,
      },
      select: { id: true },
    })
  ).id
  customerId = (
    await prisma.customer.create({
      data: {
        firstNames: 'Cliente',
        firstNamesNormalized: normalizeCustomerText('Cliente'),
        lastNames: `Precio ${marca}`,
        lastNamesNormalized: normalizeCustomerText(`Precio ${marca}`),
        city: 'Quito',
        cityNormalized: normalizeCustomerText('Quito'),
        companyId,
      },
      select: { id: true },
    })
  ).id
}

async function dropFixtures(): Promise<void> {
  await prisma.customer.delete({ where: { id: customerId } })
  await prisma.user.delete({ where: { id: actorId } })
  await prisma.recipe.delete({ where: { id: recipeId } })
  await prisma.presentation.delete({ where: { id: presentationId } })
  await prisma.company.delete({ where: { id: companyId } })
  await prisma.role.delete({ where: { id: roleId } })
  await prisma.documentType.delete({ where: { code: documentTypeCode } })
  await prisma.unit.delete({ where: { id: unitId } })
}

function scope(): OrderScope {
  return { companyId }
}

function instant(day: number): Date {
  return new Date(Date.UTC(YEAR, 5, day, 12, 0, 0, 0))
}

function baseOrder(overrides: Partial<NewOrder> = {}): NewOrder {
  return {
    salePrice: null,
    recipeId,
    quantity: '10.0000',
    priority: 'MEDIA',
    status: 'PENDIENTE',
    unitId,
    customerId: null,
    presentationLines: [],
    ...overrides,
  }
}

async function seedOrder(overrides: Partial<NewOrder> = {}): Promise<string> {
  const result = await withOrderTransaction((tx) =>
    createOrderWriteRepository(tx).create(baseOrder(overrides), YEAR, actorId, instant(1), null, scope()),
  )
  return result.id
}

/** El precio tal como lo guarda la columna, leido sin pasar por el adaptador y SIN filtrar los
 *  dados de baja: asi el borrado logico tambien se puede comprobar. */
async function storedSalePrice(id: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ sale_price: string | null }[]>`
    SELECT "sale_price"::text AS "sale_price" FROM "orders" WHERE "id" = CAST(${id} AS uuid)`
  const row = rows[0]
  if (row === undefined) throw new Error(`no existe el pedido ${id}`)
  return row.sale_price
}

const CLAVE_DE_IMPORTE = /cost|coste|importe|price|precio|amount/i

function clavesDeImporte(valor: unknown, ruta = ''): string[] {
  if (Array.isArray(valor)) return valor.flatMap((item, i) => clavesDeImporte(item, `${ruta}[${String(i)}]`))
  if (valor === null || typeof valor !== 'object' || valor instanceof Date) return []
  return Object.entries(valor).flatMap(([clave, hijo]) => [
    ...(CLAVE_DE_IMPORTE.test(clave) ? [`${ruta}.${clave}`] : []),
    ...clavesDeImporte(hijo, `${ruta}.${clave}`),
  ])
}

beforeAll(async () => {
  const columnas = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'sale_price'`
  if (columnas.length !== 1) {
    throw new Error(
      'la base de pruebas no tiene la columna `orders.sale_price`: falta la migracion ' +
        '`20261022120000_orders_sale_price`. Corre `pnpm run db:migrate`.',
    )
  }
  await seedFixtures()
})

afterAll(async () => {
  await dropFixtures()
  await prisma.$disconnect()
})

describe('R2, R6 — el alta guarda el precio como decimal(14,4) y lo lee como cadena', () => {
  it("R2: el alta con '1250.5' se lee como '1250.5000', en la fila devuelta y releida", async () => {
    const created = await withOrderTransaction((tx) =>
      createOrderWriteRepository(tx).create(baseOrder({ salePrice: '1250.5' }), YEAR, actorId, instant(2), null, scope()),
    )
    try {
      expect(created.salePrice).toBe('1250.5000')
      const read = await findAliveOrderById(created.id, scope())
      expect(read?.salePrice).toBe('1250.5000')
      expect(typeof read?.salePrice).toBe('string')
      expect(await storedSalePrice(created.id)).toBe('1250.5000')
    } finally {
      await prisma.order.delete({ where: { id: created.id } })
    }
  })

  it("R6: el alta con '0' se lee como '0.0000', no como ausencia de precio", async () => {
    const id = await seedOrder({ salePrice: '0' })
    try {
      const read = await findAliveOrderById(id, scope())
      expect(read?.salePrice).toBe('0.0000')
      expect(await storedSalePrice(id)).toBe('0.0000')
    } finally {
      await prisma.order.delete({ where: { id } })
    }
  })

  it('R2, R6: el alta sin precio se lee como null, nunca como 0', async () => {
    const id = await seedOrder({ salePrice: null })
    try {
      const read = await findAliveOrderById(id, scope())
      expect(read?.salePrice).toBeNull()
      expect(await storedSalePrice(id)).toBeNull()
    } finally {
      await prisma.order.delete({ where: { id } })
    }
  })
})

describe('R9 — la base rechaza un precio negativo aunque no pase por los casos de uso', () => {
  it('R9: un UPDATE crudo a -1 sale con 23514 y el precio guardado no cambia', async () => {
    const id = await seedOrder({ salePrice: '12.5' })
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SAVEPOINT sp_sale_price_check')
        await expect(
          tx.$executeRaw`UPDATE "orders" SET "sale_price" = -1 WHERE "id" = CAST(${id} AS uuid)`,
        ).rejects.toMatchObject({
          code: 'P2010',
          meta: expect.objectContaining({ code: '23514' }),
        })
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT sp_sale_price_check')
      })

      expect(await storedSalePrice(id)).toBe('12.5000')
    } finally {
      await prisma.order.delete({ where: { id } })
    }
  })
})

/** La unica linea del pedido, escrita por el adaptador real con su precio. */
async function seedLine(orderId: string, salePrice: string | null): Promise<string> {
  const written = await withOrderTransaction((tx) =>
    createOrderWriteRepository(tx).writeLines(
      orderId,
      {
        removedIds: [],
        edited: [],
        added: [{ ...lineOf(salePrice), status: 'PENDIENTE', cost: null }],
      },
      actorId,
      instant(2),
      scope(),
    ),
  )
  const id = written?.[0]?.id
  if (id === undefined) throw new Error(`no se escribio la linea del pedido ${orderId}`)
  return id
}

function lineOf(salePrice: string | null, presentationLines: OrderLineWrite['presentationLines'] = []): OrderLineWrite {
  return { recipeId, originalRecipeId: recipeId, quantity: '10.0000', unitId, salePrice, presentationLines }
}

/** Edita la linea como lo hace la edicion general y copia la linea al pedido, como hasta que las
 *  columnas del pedido se retiren. */
async function editLine(orderId: string, lineId: string, line: OrderLineWrite, at: Date): Promise<boolean> {
  return withOrderTransaction(async (tx) => {
    const repo = createOrderWriteRepository(tx)
    const written = await repo.writeLines(orderId, { removedIds: [], edited: [{ lineId, line, cost: 'keep' }], added: [] }, actorId, at, scope())
    await repo.mirrorFirstLine(orderId, scope())
    return written !== null
  })
}

async function dropOrder(id: string): Promise<void> {
  await prisma.orderPresentationLine.deleteMany({ where: { orderId: id } })
  await prisma.orderLine.deleteMany({ where: { orderId: id } })
  await prisma.order.delete({ where: { id } })
}

describe('R10 — la edicion general sustituye el precio guardado', () => {
  it('R10, QT-313 R15: la edicion de la linea sustituye su precio por uno nuevo, luego por 0 y luego lo quita, y el pedido lo copia', async () => {
    const id = await seedOrder({ salePrice: '100' })
    try {
      const lineId = await seedLine(id, '100')

      expect(await editLine(id, lineId, lineOf('250.75'), instant(3))).toBe(true)
      expect((await findAliveOrderById(id, scope()))?.salePrice).toBe('250.7500')

      expect(await editLine(id, lineId, lineOf('0'), instant(4))).toBe(true)
      expect((await findAliveOrderById(id, scope()))?.salePrice).toBe('0.0000')

      expect(await editLine(id, lineId, lineOf(null), instant(5))).toBe(true)
      expect((await findAliveOrderById(id, scope()))?.salePrice).toBeNull()
      expect(await storedSalePrice(id)).toBeNull()
    } finally {
      await dropOrder(id)
    }
  })
})

describe('R13 — cambiar el cliente, editar el reparto, cancelar y dar de baja conservan el precio', () => {
  it('R13: setCustomerAlive escribe el cliente y deja sale_price intacto', async () => {
    const id = await seedOrder({ salePrice: '1250.5' })
    try {
      const resultado = await createOrderWriteRepository().setCustomerAlive(id, customerId, actorId, instant(6), scope())
      expect(resultado).toBe('ok')

      const read = await findAliveOrderById(id, scope())
      expect(read?.customerId).toBe(customerId)
      expect(read?.salePrice).toBe('1250.5000')
    } finally {
      await prisma.order.delete({ where: { id } })
    }
  })

  it('R13, QT-313 R26: editar el reparto de la linea deja su sale_price y el del pedido intactos', async () => {
    const id = await seedOrder({ salePrice: '1250.5' })
    try {
      const lineId = await seedLine(id, '1250.5')
      const lines = [{ presentationId, packages: 2, content: '5.0000', packagingProductId: null }]
      expect(await editLine(id, lineId, lineOf('1250.5', lines), instant(7))).toBe(true)

      const [line] = await findAliveOrderLines(id, scope())
      expect(line?.presentationLines).toHaveLength(1)
      expect(line?.salePrice).toBe('1250.5000')
      expect((await findAliveOrderById(id, scope()))?.salePrice).toBe('1250.5000')
    } finally {
      await dropOrder(id)
    }
  })

  it('R13: cancelAliveOrder cancela y deja sale_price intacto', async () => {
    const id = await seedOrder({ salePrice: '0' })
    try {
      expect(await cancelAliveOrder(id, 'El cliente rectifico el pedido', actorId, instant(8), scope())).toBe('ok')

      const read = await findAliveOrderById(id, scope())
      expect(read?.status).toBe('CANCELADO')
      expect(read?.salePrice).toBe('0.0000')
    } finally {
      await prisma.order.delete({ where: { id } })
    }
  })

  it('R13: el borrado logico conserva la fila y su sale_price', async () => {
    const id = await seedOrder({ salePrice: '1250.5' })
    try {
      expect(await softDeleteAliveOrder(id, actorId, instant(9), scope())).toBe('ok')

      expect(await findAliveOrderById(id, scope())).toBeNull()
      const stored = await prisma.order.findUniqueOrThrow({ where: { id }, select: { deletedAt: true } })
      expect(stored.deletedAt).not.toBeNull()
      expect(await storedSalePrice(id)).toBe('1250.5000')
    } finally {
      await prisma.order.delete({ where: { id } })
    }
  })
})

describe('R17 — lo que `pedidos` entrega a `asignaciones` no lleva el precio', () => {
  it('R17: los resumenes de OrderCatalog y su findAliveById no traen ninguna clave de precio, con un pedido que si lo tiene', async () => {
    const id = await seedOrder({ salePrice: '1250.5' })
    try {
      expect(await storedSalePrice(id)).toBe('1250.5000')
      // Los resumenes son por linea, y la linea lleva su propio precio: tampoco debe salir.
      await ensureOnlyLine(prisma, id)

      const porIds = await listAliveSummariesByIds(companyId, [id], ['PENDIENTE'], 1)
      expect(porIds.items.map((item) => item.id)).toEqual([id])

      const enEmpresa = await listAliveSummariesInCompany(companyId, ['PENDIENTE'], 'work_queue', 1)
      expect(enEmpresa.items.map((item) => item.id)).toContain(id)

      const destino = await findAliveOrderTargetById(id, companyId)
      expect(destino?.id).toBe(id)

      expect(clavesDeImporte({ porIds, enEmpresa, destino })).toEqual([])
    } finally {
      await dropOrder(id)
    }
  })
})

describe('R18 — una fila escrita sin la columna queda sin precio', () => {
  it('R18: un INSERT crudo que no nombra sale_price deja la columna en NULL, no en 0', async () => {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "orders" (
        "company_id", "order_year", "order_sequence", "recipe_id", "quantity",
        "priority", "status", "created_by", "updated_by", "created_at", "updated_at", "unit_id"
      ) VALUES (
        CAST(${companyId} AS uuid), ${YEAR}::integer, 9001, CAST(${recipeId} AS uuid), 10,
        'MEDIA'::"OrderPriority", 'PENDIENTE'::"OrderStatus", CAST(${actorId} AS uuid), CAST(${actorId} AS uuid),
        ${instant(10)}::timestamptz, ${instant(10)}::timestamptz, CAST(${unitId} AS uuid)
      )
      RETURNING "id"`
    const id = rows[0]?.id
    if (id === undefined) throw new Error('el INSERT no devolvio fila')
    try {
      expect(await storedSalePrice(id)).toBeNull()
      expect((await findAliveOrderById(id, scope()))?.salePrice).toBeNull()
    } finally {
      await prisma.order.delete({ where: { id } })
    }
  })
})
