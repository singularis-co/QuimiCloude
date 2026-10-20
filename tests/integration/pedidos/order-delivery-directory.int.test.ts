/**
 * El directorio de entregas que `pedidos` le da a la ficha de producto terminado
 * (`order-delivery-directory-prisma.ts`) contra Postgres REAL, con dos empresas.
 *
 * AISLAMIENTO: el adaptador lee con el cliente GLOBAL, que no ve lo que una transaccion abierta no
 * confirmo. La siembra se confirma sobre dos empresas efimeras en `beforeAll` y se borra en
 * `afterAll` en orden de FK.
 */
import { randomUUID } from 'node:crypto'

import { Prisma } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { normalizeCompanyName } from '@/lib/modules/identity'
import {
  findCustomerIdsForMovements,
  listDeliveryLinesByBatchIds,
  summarizeDeliveredByBatchIds,
} from '@/lib/modules/pedidos/adapters/driven/persistence/order-delivery-directory-prisma'
import { prisma } from '@/lib/shared/db/prisma'

function token(): string {
  return randomUUID().replace(/-/gu, '')
}

function asUuid(id: string): Prisma.Sql {
  return Prisma.sql`CAST(${id} AS uuid)`
}

let nextSequence = 970_000

type Tenant = {
  readonly companyId: string
  readonly userId: string
  readonly roleId: string
  readonly documentTypeCode: string
  readonly unitId: string
  readonly customerId: string
  readonly recipeId: string
}

async function createTenant(label: string): Promise<Tenant> {
  const marca = token()
  const name = `Empresa ${label} ${marca}`
  const { id: companyId } = await prisma.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name) },
    select: { id: true },
  })
  const { code: documentTypeCode } = await prisma.documentType.create({
    data: { code: `DOC${marca.slice(0, 8)}`, name: 'Tipo de documento de prueba' },
    select: { code: true },
  })
  const { id: roleId } = await prisma.role.create({
    data: { name: `rol-${marca}`, description: 'Rol de prueba' },
    select: { id: true },
  })
  const { id: userId } = await prisma.user.create({
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
  const { id: customerId } = await prisma.customer.create({
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
  const { id: unitId } = await prisma.unit.create({
    data: { name: `Unidad ${marca}`, nameNormalized: `unidad${marca}`, symbol: `u${marca.slice(0, 8)}` },
    select: { id: true },
  })
  const { id: recipeId } = await prisma.recipe.create({
    data: { name: `Receta ${marca}`, nameNormalized: `receta${marca}`, companyId },
    select: { id: true },
  })
  return { companyId, userId, roleId, documentTypeCode, unitId, customerId, recipeId }
}

async function createPresentation(t: Tenant): Promise<string> {
  const marca = token()
  const { id } = await prisma.presentation.create({
    data: {
      name: `Presentacion ${marca}`,
      nameNormalized: `presentacion${marca}`,
      unitId: t.unitId,
      companyId: t.companyId,
      content: new Prisma.Decimal('5.0000'),
    },
    select: { id: true },
  })
  return id
}

async function createOrder(t: Tenant): Promise<string> {
  const orderId = randomUUID()
  nextSequence += 1
  await prisma.$executeRaw`
    INSERT INTO "orders" ("id", "company_id", "order_year", "order_sequence", "recipe_id", "quantity", "updated_at")
    VALUES (
      ${asUuid(orderId)}, ${asUuid(t.companyId)}, ${new Date().getUTCFullYear()}, ${nextSequence},
      ${asUuid(t.recipeId)}, CAST('10' AS decimal(14,4)), CURRENT_TIMESTAMP
    )`
  return orderId
}

async function createLine(t: Tenant, orderId: string, presentationId: string): Promise<string> {
  const { id } = await prisma.orderPresentationLine.create({
    data: { orderId, companyId: t.companyId, presentationId, packages: 10 },
    select: { id: true },
  })
  return id
}

async function createFinished(t: Tenant, presentationId: string): Promise<string> {
  const marca = token()
  const { id } = await prisma.product.create({
    data: {
      name: `Terminado ${marca}`,
      nameNormalized: `terminado${marca}`,
      type: 'FINISHED_PRODUCT',
      unitId: t.unitId,
      recipeId: t.recipeId,
      presentationId,
      companyId: t.companyId,
    },
    select: { id: true },
  })
  return id
}

async function createBatch(t: Tenant, productId: string, presentationId: string): Promise<string> {
  const { id } = await prisma.productBatch.create({
    data: {
      productId,
      presentationId,
      stock: new Prisma.Decimal('50.0000'),
      unitCost: new Prisma.Decimal('1.0000'),
      packageContent: new Prisma.Decimal('5.0000'),
      lot: `L-${token().slice(0, 16)}`,
      purchaseDate: new Date('2026-09-01T00:00:00Z'),
      companyId: t.companyId,
    },
    select: { id: true },
  })
  return id
}

// 2026-10-15 (QC-282): la entrega ya no guarda cliente; lo lleva cada linea. Cada entrega se siembra
// con su instante para fijar el orden del listado.
async function createDelivery(t: Tenant, orderId: string, createdAt: Date): Promise<string> {
  const { id } = await prisma.orderDelivery.create({
    data: {
      companyId: t.companyId,
      orderId,
      deliveryKey: randomUUID(),
      createdBy: t.userId,
      createdAt,
    },
    select: { id: true },
  })
  return id
}

async function createCustomer(t: Tenant, firstNames: string): Promise<string> {
  const { id } = await prisma.customer.create({
    data: {
      firstNames,
      firstNamesNormalized: firstNames.toLowerCase(),
      lastNames: 'Rojas',
      lastNamesNormalized: 'rojas',
      city: 'Cali',
      cityNormalized: 'cali',
      companyId: t.companyId,
    },
    select: { id: true },
  })
  return id
}

type LineSeed = {
  readonly deliveryId: string
  readonly customerId?: string
  readonly presentationLineId: string
  readonly batchId: string
  readonly packages: number
  readonly quantity: string
}

async function createDeliveryLine(t: Tenant, seed: LineSeed): Promise<string> {
  const { id } = await prisma.orderDeliveryLine.create({
    data: {
      companyId: t.companyId,
      deliveryId: seed.deliveryId,
      customerId: seed.customerId ?? t.customerId,
      orderPresentationLineId: seed.presentationLineId,
      batchId: seed.batchId,
      packages: seed.packages,
      quantity: new Prisma.Decimal(seed.quantity),
    },
    select: { id: true },
  })
  return id
}

async function voidLines(
  t: Tenant,
  deliveryId: string,
  deliveryLineIds: readonly string[],
  reason: string,
): Promise<void> {
  const { id: voidId } = await prisma.orderDeliveryVoid.create({
    data: { companyId: t.companyId, deliveryId, voidKey: randomUUID(), reason, createdBy: t.userId },
    select: { id: true },
  })
  await prisma.orderDeliveryVoidLine.createMany({
    data: deliveryLineIds.map((deliveryLineId) => ({ companyId: t.companyId, voidId, deliveryId, deliveryLineId })),
  })
}

// 2026-10-16 (QC-288): entregas sin pedido, del producto y no de un pedido.
async function createDirectDelivery(t: Tenant, productId: string, createdAt: Date, note: string | null): Promise<string> {
  const { id } = await prisma.orderDelivery.create({
    data: { companyId: t.companyId, productId, note, deliveryKey: randomUUID(), createdBy: t.userId, createdAt },
    select: { id: true },
  })
  return id
}

async function createDirectLine(
  t: Tenant,
  seed: {
    readonly deliveryId: string
    readonly customerId: string
    readonly batchId: string
    readonly packages: number
    readonly quantity: string
  },
): Promise<string> {
  const { id } = await prisma.orderDeliveryLine.create({
    data: {
      companyId: t.companyId,
      deliveryId: seed.deliveryId,
      customerId: seed.customerId,
      orderPresentationLineId: null,
      batchId: seed.batchId,
      packages: seed.packages,
      quantity: new Prisma.Decimal(seed.quantity),
    },
    select: { id: true },
  })
  return id
}

async function voidLinesReturningId(
  t: Tenant,
  deliveryId: string,
  deliveryLineIds: readonly string[],
  reason: string,
): Promise<string> {
  const { id: voidId } = await prisma.orderDeliveryVoid.create({
    data: { companyId: t.companyId, deliveryId, voidKey: randomUUID(), reason, createdBy: t.userId },
    select: { id: true },
  })
  await prisma.orderDeliveryVoidLine.createMany({
    data: deliveryLineIds.map((deliveryLineId) => ({ companyId: t.companyId, voidId, deliveryId, deliveryLineId })),
  })
  return voidId
}

async function dropTenant(t: Tenant): Promise<void> {
  const where = { companyId: t.companyId }
  await prisma.orderDeliveryVoidLine.deleteMany({ where })
  await prisma.orderDeliveryVoid.deleteMany({ where })
  await prisma.orderDeliveryLine.deleteMany({ where })
  await prisma.orderDelivery.deleteMany({ where })
  await prisma.productBatch.deleteMany({ where })
  await prisma.product.deleteMany({ where })
  await prisma.orderPresentationLine.deleteMany({ where })
  await prisma.order.deleteMany({ where })
  await prisma.customer.deleteMany({ where })
  await prisma.recipe.deleteMany({ where })
  await prisma.presentation.deleteMany({ where })
  await prisma.unit.deleteMany({ where: { id: t.unitId } })
  await prisma.user.deleteMany({ where: { id: t.userId } })
  await prisma.role.deleteMany({ where: { id: t.roleId } })
  await prisma.documentType.deleteMany({ where: { code: t.documentTypeCode } })
  await prisma.company.deleteMany({ where: { id: t.companyId } })
}

const VOID_REASON = 'Cliente devolvio la caja'
const SHARED_VOID_REASON = 'Caja golpeada'

const T1 = new Date('2026-10-01T10:00:00.000Z')
const T2 = new Date('2026-10-02T10:00:00.000Z')
const T3 = new Date('2026-10-03T10:00:00.000Z')
const T4 = new Date('2026-10-04T10:00:00.000Z')
const T5 = new Date('2026-10-05T10:00:00.000Z')
const T2_5 = new Date('2026-10-02T22:00:00.000Z')
const DIRECT_NOTE = 'Venta de mostrador'
const DIRECT_VOID_REASON = 'Cliente no recogio'

type Seed = {
  readonly a: Tenant
  readonly b: Tenant
  readonly order: string
  readonly orderB: string
  readonly otherCustomer: string
  /** Dos lotes, ninguno anulado. En T1. */
  readonly twoBatchDelivery: string
  /** Dos presentaciones; la linea de `batchOne` anulada y la de `batchOther` no. En T2. */
  readonly partiallyVoidedDelivery: string
  /** Su unica linea, la de `batchAllVoided`, anulada. En T3. */
  readonly fullyVoidedDelivery: string
  /** Dos clientes del mismo lote `batchShared`; solo la linea del segundo anulada. En T4. */
  readonly twoCustomerDelivery: string
  readonly batchOne: string
  readonly batchTwo: string
  readonly batchOther: string
  readonly batchAllVoided: string
  readonly batchShared: string
  readonly deliveryB: string
  readonly batchB: string
  /** Las lineas de A, por nombre. */
  readonly lines: {
    readonly twoBatchOne: string
    readonly twoBatchTwo: string
    readonly partialVoided: string
    readonly partialOther: string
    readonly fullyVoided: string
    readonly sharedFirst: string
    readonly sharedSecond: string
  }
  readonly lineB: string
  /** 2026-10-16 (QC-288): dos entregas sin pedido del producto de A, en lotes propios. */
  readonly direct: {
    /** En T5, con nota: dos clientes en `batchDirect` y uno en `batchDirectTwo`; anulada la del segundo cliente. */
    readonly withNote: string
    /** En T2_5, sin nota: un cliente en `batchDirectTwo`. */
    readonly withoutNote: string
    readonly batchDirect: string
    readonly batchDirectTwo: string
    readonly voidId: string
    readonly lines: {
      readonly firstCustomer: string
      readonly secondCustomer: string
      readonly otherBatch: string
      readonly withoutNote: string
    }
  }
}

const tenants: Tenant[] = []
let seed: Seed

async function seedAll(): Promise<Seed> {
  const a = await createTenant('A')
  tenants.push(a)
  const b = await createTenant('B')
  tenants.push(b)

  const presentation = await createPresentation(a)
  const otherPresentation = await createPresentation(a)
  const product = await createFinished(a, presentation)
  const otherProduct = await createFinished(a, otherPresentation)
  const order = await createOrder(a)
  const line = await createLine(a, order, presentation)
  const otherLine = await createLine(a, order, otherPresentation)
  const otherCustomer = await createCustomer(a, 'Marta')

  const batchOne = await createBatch(a, product, presentation)
  const batchTwo = await createBatch(a, product, presentation)
  const batchAllVoided = await createBatch(a, product, presentation)
  const batchOther = await createBatch(a, otherProduct, otherPresentation)
  const batchShared = await createBatch(a, product, presentation)

  const twoBatchDelivery = await createDelivery(a, order, T1)
  const twoBatchOne = await createDeliveryLine(a, {
    deliveryId: twoBatchDelivery,
    presentationLineId: line,
    batchId: batchOne,
    packages: 2,
    quantity: '10.1000',
  })
  const twoBatchTwo = await createDeliveryLine(a, {
    deliveryId: twoBatchDelivery,
    presentationLineId: line,
    batchId: batchTwo,
    packages: 1,
    quantity: '5.0001',
  })

  const partiallyVoidedDelivery = await createDelivery(a, order, T2)
  const partialVoided = await createDeliveryLine(a, {
    deliveryId: partiallyVoidedDelivery,
    presentationLineId: line,
    batchId: batchOne,
    packages: 3,
    quantity: '15.0000',
  })
  const partialOther = await createDeliveryLine(a, {
    deliveryId: partiallyVoidedDelivery,
    presentationLineId: otherLine,
    batchId: batchOther,
    packages: 4,
    quantity: '8.2500',
  })
  await voidLines(a, partiallyVoidedDelivery, [partialVoided], VOID_REASON)

  const fullyVoidedDelivery = await createDelivery(a, order, T3)
  const fullyVoided = await createDeliveryLine(a, {
    deliveryId: fullyVoidedDelivery,
    presentationLineId: line,
    batchId: batchAllVoided,
    packages: 6,
    quantity: '30.0000',
  })
  await voidLines(a, fullyVoidedDelivery, [fullyVoided], 'Entrega duplicada')

  const twoCustomerDelivery = await createDelivery(a, order, T4)
  const sharedFirst = await createDeliveryLine(a, {
    deliveryId: twoCustomerDelivery,
    presentationLineId: line,
    batchId: batchShared,
    packages: 2,
    quantity: '10.0000',
  })
  const sharedSecond = await createDeliveryLine(a, {
    deliveryId: twoCustomerDelivery,
    customerId: otherCustomer,
    presentationLineId: line,
    batchId: batchShared,
    packages: 1,
    quantity: '5.0000',
  })
  await voidLines(a, twoCustomerDelivery, [sharedSecond], SHARED_VOID_REASON)

  const presentationB = await createPresentation(b)
  const productB = await createFinished(b, presentationB)
  const orderB = await createOrder(b)
  const presentationLineB = await createLine(b, orderB, presentationB)
  const batchB = await createBatch(b, productB, presentationB)
  const deliveryB = await createDelivery(b, orderB, T1)
  const lineB = await createDeliveryLine(b, {
    deliveryId: deliveryB,
    presentationLineId: presentationLineB,
    batchId: batchB,
    packages: 5,
    quantity: '9.0000',
  })

  const batchDirect = await createBatch(a, product, presentation)
  const batchDirectTwo = await createBatch(a, product, presentation)
  const withNote = await createDirectDelivery(a, product, T5, DIRECT_NOTE)
  const firstCustomer = await createDirectLine(a, {
    deliveryId: withNote,
    customerId: a.customerId,
    batchId: batchDirect,
    packages: 2,
    quantity: '10.0000',
  })
  const secondCustomer = await createDirectLine(a, {
    deliveryId: withNote,
    customerId: otherCustomer,
    batchId: batchDirect,
    packages: 1,
    quantity: '5.0000',
  })
  const otherBatchLine = await createDirectLine(a, {
    deliveryId: withNote,
    customerId: a.customerId,
    batchId: batchDirectTwo,
    packages: 3,
    quantity: '15.0000',
  })
  const directVoidId = await voidLinesReturningId(a, withNote, [secondCustomer], DIRECT_VOID_REASON)
  const withoutNote = await createDirectDelivery(a, product, T2_5, null)
  const withoutNoteLine = await createDirectLine(a, {
    deliveryId: withoutNote,
    customerId: otherCustomer,
    batchId: batchDirectTwo,
    packages: 1,
    quantity: '2.5000',
  })

  return {
    a,
    b,
    order,
    orderB,
    otherCustomer,
    twoBatchDelivery,
    partiallyVoidedDelivery,
    fullyVoidedDelivery,
    twoCustomerDelivery,
    batchOne,
    batchTwo,
    batchOther,
    batchAllVoided,
    batchShared,
    deliveryB,
    batchB,
    lines: { twoBatchOne, twoBatchTwo, partialVoided, partialOther, fullyVoided, sharedFirst, sharedSecond },
    lineB,
    direct: {
      withNote,
      withoutNote,
      batchDirect,
      batchDirectTwo,
      voidId: directVoidId,
      lines: { firstCustomer, secondCustomer, otherBatch: otherBatchLine, withoutNote: withoutNoteLine },
    },
  }
}

beforeAll(async () => {
  seed = await seedAll()
}, 120_000)

afterAll(async () => {
  for (const t of tenants) await dropTenant(t)
  await prisma.$disconnect()
}, 120_000)

/** Los ids de una pareja de lineas de la misma entrega, en el orden del listado: id descendente. */
function idDesc(...ids: string[]): string[] {
  return [...ids].sort().reverse()
}

function allBatchesOfA(): string[] {
  return [seed.batchOne, seed.batchTwo, seed.batchOther, seed.batchAllVoided, seed.batchShared]
}

/** Todas las lineas de A, en el orden del listado: entrega mas reciente primero e id descendente. */
function expectedOrderOfA(): string[] {
  return [
    ...idDesc(seed.lines.sharedFirst, seed.lines.sharedSecond),
    seed.lines.fullyVoided,
    ...idDesc(seed.lines.partialVoided, seed.lines.partialOther),
    ...idDesc(seed.lines.twoBatchOne, seed.lines.twoBatchTwo),
  ]
}

// 2026-10-15 (QC-282): `findDeliveryDetailsByIds` (entrega -> cliente y lineas por lote) desaparece; el
// tab Entregas pagina las lineas directamente. Lo que comprobaban sus casos (cliente, envases por
// lote, motivo solo en la linea anulada, varias entregas a la vez) se comprueba ahora sobre las filas.
describe('listDeliveryLinesByBatchIds', () => {
  it('R19, R43: una fila por linea de entrega, con su entrega, pedido, instante, cliente, lote, envases y cantidad', async () => {
    const page = await listDeliveryLinesByBatchIds(seed.a.companyId, [seed.batchOne, seed.batchTwo], { page: 1 })

    expect(page.total).toBe(3)
    const porId = new Map(page.items.map((item) => [item.id, item]))
    // 2026-10-16 (QC-288): cada fila trae la nota de su entrega, nula en una de pedido.
    expect(porId.get(seed.lines.twoBatchOne)).toEqual({
      id: seed.lines.twoBatchOne,
      orderDeliveryId: seed.twoBatchDelivery,
      orderId: seed.order,
      note: null,
      createdAt: T1.toISOString(),
      customerId: seed.a.customerId,
      batchId: seed.batchOne,
      packages: 2,
      quantity: '10.1000',
      void: null,
    })
    expect(porId.get(seed.lines.twoBatchTwo)).toMatchObject({ batchId: seed.batchTwo, packages: 1, quantity: '5.0001', void: null })
  })

  it('R33, R44: en una entrega con dos presentaciones y una anulada, solo la linea anulada trae su motivo', async () => {
    const page = await listDeliveryLinesByBatchIds(seed.a.companyId, [seed.batchOne, seed.batchOther], { page: 1 })

    const deLaParcial = page.items.filter((item) => item.orderDeliveryId === seed.partiallyVoidedDelivery)
    expect(deLaParcial.map((item) => [item.batchId, item.packages, item.void])).toEqual(
      expect.arrayContaining([
        [seed.batchOne, 3, { reason: VOID_REASON }],
        [seed.batchOther, 4, null],
      ]),
    )
    expect(deLaParcial).toHaveLength(2)
  })

  it('R43, R44: dos clientes del mismo lote en una entrega son dos filas, y solo la del par anulado sale anulada', async () => {
    const page = await listDeliveryLinesByBatchIds(seed.a.companyId, [seed.batchShared], { page: 1 })

    expect(page.total).toBe(2)
    expect(page.items.map((item) => [item.id, item.customerId, item.packages, item.quantity, item.void])).toEqual(
      expect.arrayContaining([
        [seed.lines.sharedFirst, seed.a.customerId, 2, '10.0000', null],
        [seed.lines.sharedSecond, seed.otherCustomer, 1, '5.0000', { reason: SHARED_VOID_REASON }],
      ]),
    )
    expect(new Set(page.items.map((item) => item.orderDeliveryId))).toEqual(new Set([seed.twoCustomerDelivery]))
  })

  it('R44: las anuladas tambien salen, en orden createdAt desc de la entrega e id desc de la linea', async () => {
    const page = await listDeliveryLinesByBatchIds(seed.a.companyId, allBatchesOfA(), { page: 1 })

    expect(page).toMatchObject({ total: 7, page: 1, pageSize: 10, totalPages: 1 })
    expect(page.items.map((item) => item.id)).toEqual(expectedOrderOfA())
  })

  it('R44: pagina sobre las filas: el tamano pedido, la pagina y el total cuentan lineas', async () => {
    const segunda = await listDeliveryLinesByBatchIds(seed.a.companyId, allBatchesOfA(), { page: 2, pageSize: 3 })

    expect(segunda).toMatchObject({ total: 7, page: 2, pageSize: 3, totalPages: 3 })
    expect(segunda.items.map((item) => item.id)).toEqual(expectedOrderOfA().slice(3, 6))

    const ultima = await listDeliveryLinesByBatchIds(seed.a.companyId, allBatchesOfA(), { page: 3, pageSize: 3 })
    expect(ultima.items.map((item) => item.id)).toEqual(expectedOrderOfA().slice(6))
  })

  it('R44: un tamano mayor que el tope se acota a 25', async () => {
    const page = await listDeliveryLinesByBatchIds(seed.a.companyId, allBatchesOfA(), { page: 1, pageSize: 500 })

    expect(page).toMatchObject({ total: 7, pageSize: 25, totalPages: 1 })
  })

  it('con lotes vacios devuelve una pagina vacia sin consultar', async () => {
    const findMany = vi.spyOn(prisma.orderDeliveryLine, 'findMany')
    const count = vi.spyOn(prisma.orderDeliveryLine, 'count')
    try {
      const page = await listDeliveryLinesByBatchIds(seed.a.companyId, [], { page: 1 })
      expect(page).toEqual({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 1 })
      expect(findMany).not.toHaveBeenCalled()
      expect(count).not.toHaveBeenCalled()
    } finally {
      findMany.mockRestore()
      count.mockRestore()
    }
  })
})

describe('summarizeDeliveredByBatchIds', () => {
  it('R34: suma cantidad y envases solo de las lineas sin anulacion, en decimal exacto', async () => {
    const total = await summarizeDeliveredByBatchIds(seed.a.companyId, [
      seed.batchOne,
      seed.batchTwo,
      seed.batchOther,
      seed.batchAllVoided,
    ])

    expect(total).toEqual({ quantity: '23.3501', packages: 7 })
  })

  it('R34, R44: con dos clientes en un lote solo suma la linea del par sin anular', async () => {
    const total = await summarizeDeliveredByBatchIds(seed.a.companyId, [seed.batchShared])

    expect(total).toEqual({ quantity: '10.0000', packages: 2 })
  })

  it('R34: con todas las lineas de esos lotes anuladas el total es cero', async () => {
    const total = await summarizeDeliveredByBatchIds(seed.a.companyId, [seed.batchAllVoided])

    expect(total).toEqual({ quantity: '0.0000', packages: 0 })
  })

  it('R34: con lotes vacios devuelve cero sin consultar', async () => {
    const spy = vi.spyOn(prisma.orderDeliveryLine, 'aggregate')
    try {
      const total = await summarizeDeliveredByBatchIds(seed.a.companyId, [])
      expect(total).toEqual({ quantity: '0.0000', packages: 0 })
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })
})

describe('ambito de empresa', () => {
  it('R25: las lineas de B no vuelven con la empresa A aunque se pida su lote', async () => {
    const page = await listDeliveryLinesByBatchIds(seed.a.companyId, [seed.batchB, seed.batchTwo], { page: 1 })

    expect(page.total).toBe(1)
    expect(page.items.map((item) => item.id)).toEqual([seed.lines.twoBatchTwo])
  })

  it('R25: las lineas de B no suman en el total de A aunque se pase su lote', async () => {
    const total = await summarizeDeliveredByBatchIds(seed.a.companyId, [seed.batchB, seed.batchTwo])

    expect(total).toEqual({ quantity: '5.0001', packages: 1 })
  })

  it('R25: con el ambito de B, B ve lo suyo y nada de A', async () => {
    const page = await listDeliveryLinesByBatchIds(seed.b.companyId, [seed.batchB, seed.batchOne], { page: 1 })
    expect(page.total).toBe(1)
    // 2026-10-16 (QC-288): cada fila trae la nota de su entrega, nula en una de pedido.
    expect(page.items).toEqual([
      {
        id: seed.lineB,
        orderDeliveryId: seed.deliveryB,
        orderId: seed.orderB,
        note: null,
        createdAt: T1.toISOString(),
        customerId: seed.b.customerId,
        batchId: seed.batchB,
        packages: 5,
        quantity: '9.0000',
        void: null,
      },
    ])

    const total = await summarizeDeliveredByBatchIds(seed.b.companyId, [seed.batchB, seed.batchOne])
    expect(total).toEqual({ quantity: '9.0000', packages: 5 })
  })
})

// 2026-10-16 (QC-288): entregas sin pedido mezcladas con las de pedido, y los clientes por asiento.
describe('entregas sin pedido en el directorio', () => {
  it('R52: las lineas sin pedido salen mezcladas con las de pedido, en el mismo orden, con orderId nulo y su nota', async () => {
    const page = await listDeliveryLinesByBatchIds(
      seed.a.companyId,
      [seed.direct.batchDirect, seed.direct.batchDirectTwo, seed.batchShared],
      { page: 1 },
    )

    expect(page.total).toBe(6)
    expect(page.items.map((item) => item.id)).toEqual([
      ...idDesc(seed.direct.lines.firstCustomer, seed.direct.lines.secondCustomer, seed.direct.lines.otherBatch),
      ...idDesc(seed.lines.sharedFirst, seed.lines.sharedSecond),
      seed.direct.lines.withoutNote,
    ])
    const porId = new Map(page.items.map((item) => [item.id, item]))
    expect(porId.get(seed.direct.lines.secondCustomer)).toEqual({
      id: seed.direct.lines.secondCustomer,
      orderDeliveryId: seed.direct.withNote,
      orderId: null,
      note: DIRECT_NOTE,
      createdAt: T5.toISOString(),
      customerId: seed.otherCustomer,
      batchId: seed.direct.batchDirect,
      packages: 1,
      quantity: '5.0000',
      void: { reason: DIRECT_VOID_REASON },
    })
    expect(porId.get(seed.direct.lines.withoutNote)).toMatchObject({ orderId: null, note: null, void: null })
    expect(porId.get(seed.lines.sharedFirst)).toMatchObject({ orderId: seed.order, note: null })
  })

  it('R52: pagina sobre la mezcla: la segunda pagina sigue el mismo orden', async () => {
    const segunda = await listDeliveryLinesByBatchIds(
      seed.a.companyId,
      [seed.direct.batchDirect, seed.direct.batchDirectTwo, seed.batchShared],
      { page: 2, pageSize: 4 },
    )

    expect(segunda).toMatchObject({ total: 6, page: 2, pageSize: 4, totalPages: 2 })
    expect(segunda.items.map((item) => item.id)).toEqual([
      idDesc(seed.lines.sharedFirst, seed.lines.sharedSecond)[1],
      seed.direct.lines.withoutNote,
    ])
  })

  it('R53: el total entregado suma las lineas no anuladas de las entregas sin pedido', async () => {
    expect(
      await summarizeDeliveredByBatchIds(seed.a.companyId, [seed.direct.batchDirect, seed.direct.batchDirectTwo]),
    ).toEqual({ quantity: '27.5000', packages: 6 })
    expect(
      await summarizeDeliveredByBatchIds(seed.a.companyId, [
        seed.direct.batchDirect,
        seed.direct.batchDirectTwo,
        seed.batchShared,
      ]),
    ).toEqual({ quantity: '37.5000', packages: 8 })
  })

  it('R52, R53: con el ambito de B no salen ni suman las entregas sin pedido de A', async () => {
    const lotes = [seed.direct.batchDirect, seed.direct.batchDirectTwo]

    expect((await listDeliveryLinesByBatchIds(seed.b.companyId, lotes, { page: 1 })).total).toBe(0)
    expect(await summarizeDeliveredByBatchIds(seed.b.companyId, lotes)).toEqual({ quantity: '0.0000', packages: 0 })
  })
})

describe('findCustomerIdsForMovements', () => {
  it('R54: por asiento, los clientes de la entrega o de la anulacion en ese lote, ordenados y sin repetir', async () => {
    const mapa = await findCustomerIdsForMovements(seed.a.companyId, [
      { movementId: 'm-directa', batchId: seed.direct.batchDirect, deliveryId: seed.direct.withNote, voidId: null },
      { movementId: 'm-directa-otro-lote', batchId: seed.direct.batchDirectTwo, deliveryId: seed.direct.withNote, voidId: null },
      { movementId: 'm-anulacion', batchId: seed.direct.batchDirect, deliveryId: null, voidId: seed.direct.voidId },
      { movementId: 'm-pedido', batchId: seed.batchShared, deliveryId: seed.twoCustomerDelivery, voidId: null },
      { movementId: 'm-sin-lineas', batchId: seed.batchOne, deliveryId: seed.direct.withNote, voidId: null },
      { movementId: 'm-sin-referencia', batchId: seed.batchOne, deliveryId: null, voidId: null },
    ])

    expect(mapa.get('m-directa')).toEqual([seed.a.customerId, seed.otherCustomer].sort())
    expect(mapa.get('m-directa-otro-lote')).toEqual([seed.a.customerId])
    expect(mapa.get('m-anulacion')).toEqual([seed.otherCustomer])
    expect(mapa.get('m-pedido')).toEqual([seed.a.customerId, seed.otherCustomer].sort())
    expect(mapa.has('m-sin-lineas')).toBe(false)
    expect(mapa.has('m-sin-referencia')).toBe(false)
    expect(mapa.size).toBe(4)
  })

  it('R54: una consulta por tipo de referencia, nunca una por asiento', async () => {
    const lineas = vi.spyOn(prisma.orderDeliveryLine, 'findMany')
    const anulaciones = vi.spyOn(prisma.orderDeliveryVoidLine, 'findMany')
    try {
      await findCustomerIdsForMovements(seed.a.companyId, [
        { movementId: 'm1', batchId: seed.direct.batchDirect, deliveryId: seed.direct.withNote, voidId: null },
        { movementId: 'm2', batchId: seed.direct.batchDirectTwo, deliveryId: seed.direct.withNote, voidId: null },
        { movementId: 'm3', batchId: seed.direct.batchDirectTwo, deliveryId: seed.direct.withoutNote, voidId: null },
        { movementId: 'm4', batchId: seed.direct.batchDirect, deliveryId: null, voidId: seed.direct.voidId },
      ])
      expect(lineas).toHaveBeenCalledTimes(1)
      expect(anulaciones).toHaveBeenCalledTimes(1)
    } finally {
      lineas.mockRestore()
      anulaciones.mockRestore()
    }
  })

  it('R54: sin referencias no consulta', async () => {
    const lineas = vi.spyOn(prisma.orderDeliveryLine, 'findMany')
    const anulaciones = vi.spyOn(prisma.orderDeliveryVoidLine, 'findMany')
    try {
      expect((await findCustomerIdsForMovements(seed.a.companyId, [])).size).toBe(0)
      const soloSinReferencia = await findCustomerIdsForMovements(seed.a.companyId, [
        { movementId: 'm', batchId: seed.batchOne, deliveryId: null, voidId: null },
      ])
      expect(soloSinReferencia.size).toBe(0)
      expect(lineas).not.toHaveBeenCalled()
      expect(anulaciones).not.toHaveBeenCalled()
    } finally {
      lineas.mockRestore()
      anulaciones.mockRestore()
    }
  })

  it('R54: con el ambito de B no ve los clientes de las entregas ni anulaciones de A', async () => {
    const mapa = await findCustomerIdsForMovements(seed.b.companyId, [
      { movementId: 'm-directa', batchId: seed.direct.batchDirect, deliveryId: seed.direct.withNote, voidId: null },
      { movementId: 'm-anulacion', batchId: seed.direct.batchDirect, deliveryId: null, voidId: seed.direct.voidId },
    ])

    expect(mapa.size).toBe(0)
  })
})
