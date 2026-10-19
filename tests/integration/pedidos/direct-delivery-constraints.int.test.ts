/**
 * Las restricciones de la entrega sin pedido contra Postgres REAL: `order_deliveries` sin pedido y
 * con producto, sus lineas sin linea del reparto y los asientos `direct_delivery` y
 * `direct_delivery_void` de `inventory_movements`. Un `INSERT` crudo por cada caso, rechazado con
 * su SQLSTATE, y un caso de control que la fila valida se acepta.
 *
 * AISLAMIENTO: cada `it` corre dentro de `prisma.$transaction` interactiva y termina lanzando
 * `RollbackSignal`, asi que ninguna fila sobrevive. Lo que se espera que la base rechace va en su
 * propio `SAVEPOINT` y con `$executeRaw`: solo el SQL crudo propaga el SQLSTATE en `meta.code`.
 */
import { randomUUID } from 'node:crypto'

import { Prisma } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'

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
      { maxWait: 10_000, timeout: 60_000 },
    )
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error
  }
}

const FOREIGN_KEY_VIOLATION = '23503'
const CHECK_VIOLATION = '23514'

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
  const savepoint = `direct_delivery_sp_${String(savepointSeq)}`
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

function token(): string {
  return randomUUID().replace(/-/gu, '')
}

function asUuid(id: string): Prisma.Sql {
  return Prisma.sql`CAST(${id} AS uuid)`
}

function asNullableUuid(id: string | null | undefined): Prisma.Sql {
  return id === null || id === undefined ? Prisma.sql`NULL::uuid` : asUuid(id)
}

// --- Fixtures -------------------------------------------------------------------------------

type Tenant = {
  readonly companyId: string
  readonly userId: string
  readonly customerId: string
  readonly orderId: string
  readonly presentationLineId: string
  /** Producto terminado de la entrega sin pedido, con su lote. */
  readonly productId: string
  readonly batchId: string
  /** Otro producto de la misma empresa, con su lote. */
  readonly otherProductId: string
  readonly otherProductBatchId: string
}

let nextSequence = 980_000 + Math.floor(Math.random() * 10_000)
function freshSequence(): number {
  nextSequence += 1
  return nextSequence
}

async function createTenant(tx: Prisma.TransactionClient, label: string): Promise<Tenant> {
  const marca = token()
  const name = `Empresa ${label} ${marca}`
  const { id: companyId } = await tx.company.create({
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
  const { id: userId } = await tx.user.create({
    data: {
      firstNames: 'Ana Maria',
      lastNames: 'Perez Gomez',
      birthDate: new Date('1990-05-17T00:00:00.000Z'),
      email: `ana.${marca}@quimicloude.test`,
      phone: '+57 300 111 2233',
      documentTypeCode: documentType.code,
      documentNumber: marca.slice(0, 12),
      username: `ana.${marca}`,
      passwordHash: 'hash-de-prueba-no-es-un-algoritmo-real',
      roleId: role.id,
      companyId,
    },
    select: { id: true },
  })

  const { id: customerId } = await tx.customer.create({
    data: {
      firstNames: 'Luis',
      firstNamesNormalized: 'luis',
      lastNames: 'Rojas',
      lastNamesNormalized: 'rojas',
      city: 'Cali',
      cityNormalized: 'cali',
      companyId,
    },
    select: { id: true },
  })

  const { id: recipeId } = await tx.recipe.create({
    data: { name: `Receta ${marca}`, nameNormalized: `receta${marca}`, companyId },
    select: { id: true },
  })
  const orderId = randomUUID()
  await tx.$executeRaw`
    INSERT INTO "orders" ("id", "company_id", "order_year", "order_sequence", "recipe_id", "quantity", "updated_at")
    VALUES (
      ${asUuid(orderId)}, ${asUuid(companyId)}, ${new Date().getUTCFullYear()}, ${freshSequence()},
      ${asUuid(recipeId)}, CAST('10' AS decimal(14,4)), CURRENT_TIMESTAMP
    )`

  const { id: unitId } = await tx.unit.create({
    data: { name: `Unidad ${marca}`, nameNormalized: `unidad${marca}`, symbol: `u${marca.slice(0, 8)}` },
    select: { id: true },
  })
  const { id: presentationId } = await tx.presentation.create({
    data: { name: `Presentacion ${marca}`, nameNormalized: `presentacion${marca}`, unitId, companyId },
    select: { id: true },
  })
  const { id: presentationLineId } = await tx.orderPresentationLine.create({
    data: { orderId, companyId, presentationId, packages: 10 },
    select: { id: true },
  })

  const productWithBatch = async (suffix: string) => {
    const { id: productId } = await tx.product.create({
      data: { name: `Producto ${suffix} ${marca}`, nameNormalized: `producto${suffix}${marca}`, companyId, unitId },
      select: { id: true },
    })
    const { id: batchId } = await tx.productBatch.create({
      data: {
        productId,
        presentationId,
        stock: 10,
        unitCost: new Prisma.Decimal('1.0000'),
        lot: `L-${randomUUID()}`,
        purchaseDate: new Date('2026-09-01T00:00:00Z'),
        companyId,
      },
      select: { id: true },
    })
    return { productId, batchId }
  }
  const own = await productWithBatch('a')
  const other = await productWithBatch('b')

  return {
    companyId,
    userId,
    customerId,
    orderId,
    presentationLineId,
    productId: own.productId,
    batchId: own.batchId,
    otherProductId: other.productId,
    otherProductBatchId: other.batchId,
  }
}

// --- INSERT crudos --------------------------------------------------------------------------

type DeliveryRow = {
  companyId: string
  orderId: string | null
  productId: string | null
  note?: string | null
  createdBy: string
}

async function rawInsertDelivery(tx: Prisma.TransactionClient, row: DeliveryRow): Promise<string> {
  const id = randomUUID()
  await tx.$executeRaw`
    INSERT INTO "order_deliveries" ("id", "company_id", "order_id", "product_id", "note", "delivery_key", "created_by")
    VALUES (
      ${asUuid(id)}, ${asUuid(row.companyId)}, ${asNullableUuid(row.orderId)}, ${asNullableUuid(row.productId)},
      ${row.note ?? null}, ${asUuid(randomUUID())}, ${asUuid(row.createdBy)}
    )`
  return id
}

function directDeliveryOf(t: Tenant, note: string | null = 'Venta de mostrador'): DeliveryRow {
  return { companyId: t.companyId, orderId: null, productId: t.productId, note, createdBy: t.userId }
}

function orderDeliveryOf(t: Tenant): DeliveryRow {
  return { companyId: t.companyId, orderId: t.orderId, productId: null, createdBy: t.userId }
}

type LineRow = {
  companyId: string
  deliveryId: string
  customerId: string
  presentationLineId: string | null
  batchId: string
}

async function rawInsertLine(tx: Prisma.TransactionClient, row: LineRow): Promise<string> {
  const id = randomUUID()
  await tx.$executeRaw`
    INSERT INTO "order_delivery_lines" ("id", "company_id", "delivery_id", "customer_id", "order_presentation_line_id", "batch_id", "packages", "quantity")
    VALUES (
      ${asUuid(id)}, ${asUuid(row.companyId)}, ${asUuid(row.deliveryId)}, ${asUuid(row.customerId)},
      ${asNullableUuid(row.presentationLineId)}, ${asUuid(row.batchId)}, 2, CAST('2' AS decimal(14,4))
    )`
  return id
}

async function rawInsertVoid(
  tx: Prisma.TransactionClient,
  t: Tenant,
  deliveryId: string,
  deliveryLineIds: readonly string[],
): Promise<string> {
  const id = randomUUID()
  await tx.$executeRaw`
    INSERT INTO "order_delivery_voids" ("id", "company_id", "delivery_id", "void_key", "reason", "created_by")
    VALUES (
      ${asUuid(id)}, ${asUuid(t.companyId)}, ${asUuid(deliveryId)}, ${asUuid(randomUUID())},
      'Se entrego al cliente equivocado', ${asUuid(t.userId)}
    )`
  for (const deliveryLineId of deliveryLineIds) {
    await tx.$executeRaw`
      INSERT INTO "order_delivery_void_lines" ("company_id", "void_id", "delivery_id", "delivery_line_id")
      VALUES (${asUuid(t.companyId)}, ${asUuid(id)}, ${asUuid(deliveryId)}, ${asUuid(deliveryLineId)})`
  }
  return id
}

type MovementRow = {
  companyId: string
  batchId: string
  kind: string
  quantity: string
  orderId: string | null
  orderDeliveryId: string | null
  orderDeliveryVoidId: string | null
  reason?: string | null
}

async function rawInsertMovement(tx: Prisma.TransactionClient, row: MovementRow): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO "inventory_movements" ("batch_id", "kind", "quantity", "reason", "order_id", "order_delivery_id", "order_delivery_void_id", "company_id")
    VALUES (
      ${asUuid(row.batchId)}, CAST(${row.kind} AS "InventoryMovementKind"), CAST(${row.quantity} AS decimal(14,4)),
      ${row.reason ?? null}, ${asNullableUuid(row.orderId)}, ${asNullableUuid(row.orderDeliveryId)},
      ${asNullableUuid(row.orderDeliveryVoidId)}, ${asUuid(row.companyId)}
    )`
}

/** Una entrega sin pedido de un lote del producto, con su linea; sin asiento. */
async function directDeliveryWithLine(
  tx: Prisma.TransactionClient,
  t: Tenant,
): Promise<{ deliveryId: string; lineId: string }> {
  const deliveryId = await rawInsertDelivery(tx, directDeliveryOf(t))
  const lineId = await rawInsertLine(tx, {
    companyId: t.companyId,
    deliveryId,
    customerId: t.customerId,
    presentationLineId: null,
    batchId: t.batchId,
  })
  return { deliveryId, lineId }
}

/** Una entrega de pedido de un lote, con su linea; sin asiento. */
async function orderDeliveryWithLine(
  tx: Prisma.TransactionClient,
  t: Tenant,
): Promise<{ deliveryId: string; lineId: string }> {
  const deliveryId = await rawInsertDelivery(tx, orderDeliveryOf(t))
  const lineId = await rawInsertLine(tx, {
    companyId: t.companyId,
    deliveryId,
    customerId: t.customerId,
    presentationLineId: t.presentationLineId,
    batchId: t.batchId,
  })
  return { deliveryId, lineId }
}

async function expectAllRejected(
  tx: Prisma.TransactionClient,
  casos: ReadonlyArray<readonly [string, () => Promise<unknown>]>,
  code: string,
): Promise<void> {
  for (const [what, run] of casos) {
    expect(await expectRejectedByDatabase(tx, run, what), what).toBe(code)
  }
}

afterAll(async () => {
  await prisma.$disconnect()
})

// --- Casos ----------------------------------------------------------------------------------

describe('la entrega sin pedido contra Postgres real', () => {
  it('R40: control positivo: una entrega sin pedido con su linea, su asiento, su anulacion y su devolucion se acepta', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await createTenant(tx, 'A')
      const { deliveryId, lineId } = await directDeliveryWithLine(tx, a)
      await rawInsertMovement(tx, {
        companyId: a.companyId,
        batchId: a.batchId,
        kind: 'direct_delivery',
        quantity: '-2',
        orderId: null,
        orderDeliveryId: deliveryId,
        orderDeliveryVoidId: null,
      })
      const voidId = await rawInsertVoid(tx, a, deliveryId, [lineId])
      await rawInsertMovement(tx, {
        companyId: a.companyId,
        batchId: a.batchId,
        kind: 'direct_delivery_void',
        quantity: '2',
        orderId: null,
        orderDeliveryId: null,
        orderDeliveryVoidId: voidId,
      })

      const entrega = await tx.orderDelivery.findUniqueOrThrow({
        where: { id: deliveryId },
        select: { orderId: true, productId: true, note: true },
      })
      expect(entrega).toEqual({ orderId: null, productId: a.productId, note: 'Venta de mostrador' })
      expect(
        await tx.orderDeliveryLine.findMany({ where: { deliveryId }, select: { orderPresentationLineId: true } }),
      ).toEqual([{ orderPresentationLineId: null }])
      const asientos = await tx.inventoryMovement.findMany({
        where: { OR: [{ orderDeliveryId: deliveryId }, { orderDeliveryVoidId: voidId }] },
        orderBy: { quantity: 'asc' },
      })
      expect(asientos.map((m) => [m.kind, m.quantity.toString(), m.orderId, m.reason])).toEqual([
        ['direct_delivery', '-2', null, null],
        ['direct_delivery_void', '2', null, null],
      ])

      // Una nota de 500 caracteres cabe; sin nota tambien.
      await rawInsertDelivery(tx, directDeliveryOf(a, 'x'.repeat(500)))
      await rawInsertDelivery(tx, directDeliveryOf(a, null))
    })
  })

  it('R40: la entrega es de un pedido o de un producto, nunca de ninguno ni de los dos', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await createTenant(tx, 'A')
      await expectAllRejected(
        tx,
        [
          ['sin pedido y sin producto', () => rawInsertDelivery(tx, { ...directDeliveryOf(a, null), productId: null })],
          ['con pedido y con producto', () => rawInsertDelivery(tx, { ...orderDeliveryOf(a), productId: a.productId })],
        ],
        CHECK_VIOLATION,
      )
    })
  })

  it('R40: la nota solo va en la entrega sin pedido, y no vacia ni de mas de 500 caracteres', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await createTenant(tx, 'A')
      await expectAllRejected(
        tx,
        [
          ['nota en una entrega de pedido', () => rawInsertDelivery(tx, { ...orderDeliveryOf(a), note: 'Venta' })],
          ['nota vacia', () => rawInsertDelivery(tx, directDeliveryOf(a, ''))],
          ['nota en blanco', () => rawInsertDelivery(tx, directDeliveryOf(a, '   '))],
          ['nota de 501 caracteres', () => rawInsertDelivery(tx, directDeliveryOf(a, 'x'.repeat(501)))],
        ],
        CHECK_VIOLATION,
      )
    })
  })

  it('R40: la base rechaza una entrega sin pedido con el producto de otra empresa o inexistente', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await createTenant(tx, 'A')
      const b = await createTenant(tx, 'B')
      await expectAllRejected(
        tx,
        [
          ['producto de B en una entrega de A', () => rawInsertDelivery(tx, { ...directDeliveryOf(a), productId: b.productId })],
          ['producto inexistente', () => rawInsertDelivery(tx, { ...directDeliveryOf(a), productId: randomUUID() })],
        ],
        FOREIGN_KEY_VIOLATION,
      )
    })
  })

  it('R40: la linea de una entrega sin pedido no lleva linea del reparto y su lote es del producto; la de pedido exige linea del reparto', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await createTenant(tx, 'A')
      const b = await createTenant(tx, 'B')
      const directa = await rawInsertDelivery(tx, directDeliveryOf(a))
      const dePedido = await rawInsertDelivery(tx, orderDeliveryOf(a))
      const base: LineRow = {
        companyId: a.companyId,
        deliveryId: directa,
        customerId: a.customerId,
        presentationLineId: null,
        batchId: a.batchId,
      }

      await expectAllRejected(
        tx,
        [
          ['sin pedido con linea del reparto', () => rawInsertLine(tx, { ...base, presentationLineId: a.presentationLineId })],
          ['sin pedido con el lote de otro producto', () => rawInsertLine(tx, { ...base, batchId: a.otherProductBatchId })],
          ['de pedido sin linea del reparto', () => rawInsertLine(tx, { ...base, deliveryId: dePedido })],
          // El lote de otra empresa no es del producto de la entrega: lo para el disparador antes que la FK.
          ['sin pedido con el lote de B', () => rawInsertLine(tx, { ...base, batchId: b.batchId })],
        ],
        CHECK_VIOLATION,
      )
      await expectAllRejected(
        tx,
        [
          [
            'linea de B sobre la entrega sin pedido de A',
            () => rawInsertLine(tx, { ...base, companyId: b.companyId, customerId: b.customerId, batchId: b.batchId }),
          ],
        ],
        FOREIGN_KEY_VIOLATION,
      )

      await rawInsertLine(tx, base)
      await rawInsertLine(tx, { ...base, deliveryId: dePedido, presentationLineId: a.presentationLineId })
      expect(await tx.orderDeliveryLine.count({ where: { deliveryId: { in: [directa, dePedido] } } })).toBe(2)
    })
  })

  it('R40: direct_delivery exige su entrega sin pedido, ningun pedido, ningun motivo y cantidad negativa', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await createTenant(tx, 'A')
      const { deliveryId: directa } = await directDeliveryWithLine(tx, a)
      const { deliveryId: dePedido } = await orderDeliveryWithLine(tx, a)
      const base: MovementRow = {
        companyId: a.companyId,
        batchId: a.batchId,
        kind: 'direct_delivery',
        quantity: '-2',
        orderId: null,
        orderDeliveryId: directa,
        orderDeliveryVoidId: null,
      }

      await expectAllRejected(
        tx,
        [
          ['direct_delivery con pedido', () => rawInsertMovement(tx, { ...base, orderId: a.orderId })],
          ['direct_delivery sin entrega', () => rawInsertMovement(tx, { ...base, orderDeliveryId: null })],
          ['direct_delivery con motivo', () => rawInsertMovement(tx, { ...base, reason: 'merma' })],
          ['direct_delivery con cantidad positiva', () => rawInsertMovement(tx, { ...base, quantity: '2' })],
          ['direct_delivery sobre una entrega de pedido', () => rawInsertMovement(tx, { ...base, orderDeliveryId: dePedido })],
          [
            'delivery sobre una entrega sin pedido',
            () => rawInsertMovement(tx, { ...base, kind: 'delivery', orderId: a.orderId }),
          ],
        ],
        CHECK_VIOLATION,
      )

      await rawInsertMovement(tx, base)
      await rawInsertMovement(tx, { ...base, kind: 'delivery', orderId: a.orderId, orderDeliveryId: dePedido })
      expect(await tx.inventoryMovement.count({ where: { orderDeliveryId: { in: [directa, dePedido] } } })).toBe(2)
    })
  })

  it('R40: direct_delivery_void exige la anulacion de una entrega sin pedido, ningun pedido, ningun motivo y cantidad positiva', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await createTenant(tx, 'A')
      const directa = await directDeliveryWithLine(tx, a)
      const dePedido = await orderDeliveryWithLine(tx, a)
      const anulacionDirecta = await rawInsertVoid(tx, a, directa.deliveryId, [directa.lineId])
      const anulacionDePedido = await rawInsertVoid(tx, a, dePedido.deliveryId, [dePedido.lineId])
      const base: MovementRow = {
        companyId: a.companyId,
        batchId: a.batchId,
        kind: 'direct_delivery_void',
        quantity: '2',
        orderId: null,
        orderDeliveryId: null,
        orderDeliveryVoidId: anulacionDirecta,
      }

      await expectAllRejected(
        tx,
        [
          ['direct_delivery_void con pedido', () => rawInsertMovement(tx, { ...base, orderId: a.orderId })],
          ['direct_delivery_void sin anulacion', () => rawInsertMovement(tx, { ...base, orderDeliveryVoidId: null })],
          ['direct_delivery_void con motivo', () => rawInsertMovement(tx, { ...base, reason: 'merma' })],
          ['direct_delivery_void con cantidad cero', () => rawInsertMovement(tx, { ...base, quantity: '0' })],
          ['direct_delivery_void con cantidad negativa', () => rawInsertMovement(tx, { ...base, quantity: '-2' })],
          [
            'direct_delivery_void sobre la anulacion de una entrega de pedido',
            () => rawInsertMovement(tx, { ...base, orderDeliveryVoidId: anulacionDePedido }),
          ],
          [
            'delivery_void sobre la anulacion de una entrega sin pedido',
            () => rawInsertMovement(tx, { ...base, kind: 'delivery_void', orderId: a.orderId }),
          ],
        ],
        CHECK_VIOLATION,
      )

      await rawInsertMovement(tx, base)
      await rawInsertMovement(tx, { ...base, kind: 'delivery_void', orderId: a.orderId, orderDeliveryVoidId: anulacionDePedido })
      expect(
        await tx.inventoryMovement.count({ where: { orderDeliveryVoidId: { in: [anulacionDirecta, anulacionDePedido] } } }),
      ).toBe(2)
    })
  })

  it('R40: los asientos de tipo nuevo no pueden apuntar a la entrega ni a la anulacion de otra empresa', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await createTenant(tx, 'A')
      const b = await createTenant(tx, 'B')
      const directaB = await directDeliveryWithLine(tx, b)
      const anulacionB = await rawInsertVoid(tx, b, directaB.deliveryId, [directaB.lineId])

      await expectAllRejected(
        tx,
        [
          [
            'direct_delivery de A con la entrega de B',
            () =>
              rawInsertMovement(tx, {
                companyId: a.companyId,
                batchId: a.batchId,
                kind: 'direct_delivery',
                quantity: '-1',
                orderId: null,
                orderDeliveryId: directaB.deliveryId,
                orderDeliveryVoidId: null,
              }),
          ],
          [
            'direct_delivery_void de A con la anulacion de B',
            () =>
              rawInsertMovement(tx, {
                companyId: a.companyId,
                batchId: a.batchId,
                kind: 'direct_delivery_void',
                quantity: '1',
                orderId: null,
                orderDeliveryId: null,
                orderDeliveryVoidId: anulacionB,
              }),
          ],
        ],
        FOREIGN_KEY_VIOLATION,
      )
    })
  })

  it('R41: las cuatro tablas siguen con RLS activada y forzada y sin updated_at ni deleted_at', async () => {
    const filas = await prisma.$queryRaw<Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>>`
      SELECT relname::text, relrowsecurity, relforcerowsecurity FROM pg_class
      WHERE relname IN ('order_deliveries', 'order_delivery_lines', 'order_delivery_voids', 'order_delivery_void_lines')
        AND relkind = 'r'
      ORDER BY relname`
    expect(filas).toEqual([
      { relname: 'order_deliveries', relrowsecurity: true, relforcerowsecurity: true },
      { relname: 'order_delivery_lines', relrowsecurity: true, relforcerowsecurity: true },
      { relname: 'order_delivery_void_lines', relrowsecurity: true, relforcerowsecurity: true },
      { relname: 'order_delivery_voids', relrowsecurity: true, relforcerowsecurity: true },
    ])
    const columnas = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name IN ('updated_at', 'deleted_at')
        AND table_name IN ('order_deliveries', 'order_delivery_lines', 'order_delivery_voids', 'order_delivery_void_lines')`
    expect(Number(columnas[0]?.n)).toBe(0)
  })
})
