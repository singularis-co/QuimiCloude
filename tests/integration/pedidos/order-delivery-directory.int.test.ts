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
  findDeliveryDetailsByIds,
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

async function createDelivery(t: Tenant, orderId: string): Promise<string> {
  const { id } = await prisma.orderDelivery.create({
    data: {
      companyId: t.companyId,
      orderId,
      customerId: t.customerId,
      deliveryKey: randomUUID(),
      createdBy: t.userId,
    },
    select: { id: true },
  })
  return id
}

type LineSeed = {
  readonly deliveryId: string
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

type Seed = {
  readonly a: Tenant
  readonly b: Tenant
  /** Dos lotes, ninguno anulado. */
  readonly twoBatchDelivery: string
  /** Dos presentaciones; la linea de `batchOne` anulada y la de `batchOther` no. */
  readonly partiallyVoidedDelivery: string
  /** Su unica linea, la de `batchAllVoided`, anulada. */
  readonly fullyVoidedDelivery: string
  readonly batchOne: string
  readonly batchTwo: string
  readonly batchOther: string
  readonly batchAllVoided: string
  readonly deliveryB: string
  readonly batchB: string
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

  const batchOne = await createBatch(a, product, presentation)
  const batchTwo = await createBatch(a, product, presentation)
  const batchAllVoided = await createBatch(a, product, presentation)
  const batchOther = await createBatch(a, otherProduct, otherPresentation)

  const twoBatchDelivery = await createDelivery(a, order)
  await createDeliveryLine(a, {
    deliveryId: twoBatchDelivery,
    presentationLineId: line,
    batchId: batchOne,
    packages: 2,
    quantity: '10.1000',
  })
  await createDeliveryLine(a, {
    deliveryId: twoBatchDelivery,
    presentationLineId: line,
    batchId: batchTwo,
    packages: 1,
    quantity: '5.0001',
  })

  const partiallyVoidedDelivery = await createDelivery(a, order)
  const voidedLine = await createDeliveryLine(a, {
    deliveryId: partiallyVoidedDelivery,
    presentationLineId: line,
    batchId: batchOne,
    packages: 3,
    quantity: '15.0000',
  })
  await createDeliveryLine(a, {
    deliveryId: partiallyVoidedDelivery,
    presentationLineId: otherLine,
    batchId: batchOther,
    packages: 4,
    quantity: '8.2500',
  })
  await voidLines(a, partiallyVoidedDelivery, [voidedLine], VOID_REASON)

  const fullyVoidedDelivery = await createDelivery(a, order)
  const onlyLine = await createDeliveryLine(a, {
    deliveryId: fullyVoidedDelivery,
    presentationLineId: line,
    batchId: batchAllVoided,
    packages: 6,
    quantity: '30.0000',
  })
  await voidLines(a, fullyVoidedDelivery, [onlyLine], 'Entrega duplicada')

  const presentationB = await createPresentation(b)
  const productB = await createFinished(b, presentationB)
  const orderB = await createOrder(b)
  const lineB = await createLine(b, orderB, presentationB)
  const batchB = await createBatch(b, productB, presentationB)
  const deliveryB = await createDelivery(b, orderB)
  await createDeliveryLine(b, {
    deliveryId: deliveryB,
    presentationLineId: lineB,
    batchId: batchB,
    packages: 5,
    quantity: '9.0000',
  })

  return {
    a,
    b,
    twoBatchDelivery,
    partiallyVoidedDelivery,
    fullyVoidedDelivery,
    batchOne,
    batchTwo,
    batchOther,
    batchAllVoided,
    deliveryB,
    batchB,
  }
}

beforeAll(async () => {
  seed = await seedAll()
}, 120_000)

afterAll(async () => {
  for (const t of tenants) await dropTenant(t)
  await prisma.$disconnect()
}, 120_000)

describe('findDeliveryDetailsByIds', () => {
  it('R19: trae el cliente de la entrega y los envases de cada uno de sus dos lotes', async () => {
    const details = await findDeliveryDetailsByIds(seed.a.companyId, [seed.twoBatchDelivery])

    expect([...details.keys()]).toEqual([seed.twoBatchDelivery])
    const detail = details.get(seed.twoBatchDelivery)
    expect(detail?.customerId).toBe(seed.a.customerId)
    expect(detail?.linesByBatch.size).toBe(2)
    expect(detail?.linesByBatch.get(seed.batchOne)).toEqual({ packages: 2, void: null })
    expect(detail?.linesByBatch.get(seed.batchTwo)).toEqual({ packages: 1, void: null })
  })

  it('R33: en una entrega con dos presentaciones y una anulada, solo la linea anulada trae su motivo', async () => {
    const details = await findDeliveryDetailsByIds(seed.a.companyId, [seed.partiallyVoidedDelivery])

    const lines = details.get(seed.partiallyVoidedDelivery)?.linesByBatch
    expect(lines?.size).toBe(2)
    expect(lines?.get(seed.batchOne)).toEqual({ packages: 3, void: { reason: VOID_REASON } })
    expect(lines?.get(seed.batchOther)).toEqual({ packages: 4, void: null })
  })

  it('R19, R33: resuelve varias entregas en una llamada y omite el id que no existe', async () => {
    const details = await findDeliveryDetailsByIds(seed.a.companyId, [
      seed.twoBatchDelivery,
      seed.fullyVoidedDelivery,
      randomUUID(),
    ])

    expect(new Set(details.keys())).toEqual(new Set([seed.twoBatchDelivery, seed.fullyVoidedDelivery]))
    expect(details.get(seed.fullyVoidedDelivery)?.linesByBatch.get(seed.batchAllVoided)).toEqual({
      packages: 6,
      void: { reason: 'Entrega duplicada' },
    })
  })

  it('con ids vacios devuelve un mapa vacio sin consultar', async () => {
    const spy = vi.spyOn(prisma.orderDelivery, 'findMany')
    try {
      const details = await findDeliveryDetailsByIds(seed.a.companyId, [])
      expect(details.size).toBe(0)
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
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
  it('R25: una entrega de B no vuelve con la empresa A aunque se pida su id', async () => {
    const details = await findDeliveryDetailsByIds(seed.a.companyId, [seed.deliveryB, seed.twoBatchDelivery])

    expect([...details.keys()]).toEqual([seed.twoBatchDelivery])
  })

  it('R25: las lineas de B no suman en el total de A aunque se pase su lote', async () => {
    const total = await summarizeDeliveredByBatchIds(seed.a.companyId, [seed.batchB, seed.batchTwo])

    expect(total).toEqual({ quantity: '5.0001', packages: 1 })
  })

  it('R25: con el ambito de B, B ve lo suyo y nada de A', async () => {
    const details = await findDeliveryDetailsByIds(seed.b.companyId, [seed.deliveryB, seed.twoBatchDelivery])
    expect([...details.keys()]).toEqual([seed.deliveryB])
    expect(details.get(seed.deliveryB)?.linesByBatch.get(seed.batchB)).toEqual({ packages: 5, void: null })

    const total = await summarizeDeliveredByBatchIds(seed.b.companyId, [seed.batchB, seed.batchOne])
    expect(total).toEqual({ quantity: '9.0000', packages: 5 })
  })
})
