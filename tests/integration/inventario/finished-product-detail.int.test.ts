/**
 * El adaptador de lectura de la ficha de producto terminado (`finished-product-detail-prisma.ts`)
 * contra Postgres REAL, con dos empresas.
 *
 * AISLAMIENTO: el adaptador lee con el cliente GLOBAL, que no ve lo que una transaccion abierta no
 * confirmo. La siembra se confirma sobre dos empresas efimeras en `beforeAll` y se borra en
 * `afterAll` en orden de FK.
 */
import { randomUUID } from 'node:crypto'

import { Prisma } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { normalizeCompanyName } from '@/lib/modules/identity'
import {
  findAliveFinishedProduct,
  findProducedFinishedProducts,
  listFinishedProductBatches,
  listFinishedProductCosts,
  listFinishedProductMovements,
} from '@/lib/modules/inventario/adapters/driven/persistence/finished-product-detail-prisma'
import { inventario } from '@/lib/composition'
import { prisma } from '@/lib/shared/db/prisma'

import type { InventoryScope } from '@/lib/modules/inventario/domain/inventory-scope'

function token(): string {
  return randomUUID().replace(/-/gu, '')
}

function asUuid(id: string): Prisma.Sql {
  return Prisma.sql`CAST(${id} AS uuid)`
}

const BASE = Date.parse('2026-10-01T10:00:00.000Z')
function at(minutes: number): Date {
  return new Date(BASE + minutes * 60_000)
}

let nextSequence = 960_000

type Tenant = {
  readonly companyId: string
  readonly scope: InventoryScope
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
  const recipeId = await createRecipe(companyId)
  return { companyId, scope: { companyId }, userId, roleId, documentTypeCode, unitId, customerId, recipeId }
}

async function createRecipe(companyId: string): Promise<string> {
  const marca = token()
  const { id } = await prisma.recipe.create({
    data: { name: `Receta ${marca}`, nameNormalized: `receta${marca}`, companyId },
    select: { id: true },
  })
  return id
}

async function createPresentation(t: Tenant, content: string | null): Promise<string> {
  const marca = token()
  const { id } = await prisma.presentation.create({
    data: {
      name: `Presentacion ${marca}`,
      nameNormalized: `presentacion${marca}`,
      unitId: t.unitId,
      companyId: t.companyId,
      content: content === null ? null : new Prisma.Decimal(content),
    },
    select: { id: true },
  })
  return id
}

async function createOrder(t: Tenant, deletedAt: Date | null = null): Promise<string> {
  const orderId = randomUUID()
  nextSequence += 1
  await prisma.$executeRaw`
    INSERT INTO "orders" ("id", "company_id", "order_year", "order_sequence", "recipe_id", "quantity", "updated_at", "deleted_at")
    VALUES (
      ${asUuid(orderId)}, ${asUuid(t.companyId)}, ${new Date().getUTCFullYear()}, ${nextSequence},
      ${asUuid(t.recipeId)}, CAST('10' AS decimal(14,4)), CURRENT_TIMESTAMP, ${deletedAt}
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

async function createFinished(
  t: Tenant,
  presentationId: string,
  options: { readonly recipeId?: string; readonly deletedAt?: Date | null } = {},
): Promise<string> {
  const marca = token()
  const { id } = await prisma.product.create({
    data: {
      name: `Terminado ${marca}`,
      nameNormalized: `terminado${marca}`,
      type: 'FINISHED_PRODUCT',
      unitId: t.unitId,
      recipeId: options.recipeId ?? t.recipeId,
      presentationId,
      qtyAlert: new Prisma.Decimal('4.5000'),
      companyId: t.companyId,
      deletedAt: options.deletedAt ?? null,
    },
    select: { id: true },
  })
  return id
}

type BatchSeed = {
  readonly productId: string
  readonly presentationId: string
  readonly stock: string
  readonly unitCost: string
  readonly packageContent: string | null
  readonly createdAt: Date
  readonly productionDate?: string
  readonly expiryDate?: string
}

async function createBatch(t: Tenant, seed: BatchSeed): Promise<{ readonly id: string; readonly lot: string }> {
  return prisma.productBatch.create({
    data: {
      productId: seed.productId,
      presentationId: seed.presentationId,
      stock: new Prisma.Decimal(seed.stock),
      unitCost: new Prisma.Decimal(seed.unitCost),
      packageContent: seed.packageContent === null ? null : new Prisma.Decimal(seed.packageContent),
      lot: `L-${token().slice(0, 16)}`,
      purchaseDate: new Date('2026-09-01T00:00:00Z'),
      productionDate: seed.productionDate === undefined ? null : new Date(`${seed.productionDate}T00:00:00Z`),
      expiryDate: seed.expiryDate === undefined ? null : new Date(`${seed.expiryDate}T00:00:00Z`),
      companyId: t.companyId,
      createdAt: seed.createdAt,
    },
    select: { id: true, lot: true },
  })
}

async function movement(
  t: Tenant,
  data: Omit<Prisma.InventoryMovementUncheckedCreateInput, 'companyId'>,
): Promise<string> {
  const { id } = await prisma.inventoryMovement.create({
    data: { ...data, companyId: t.companyId },
    select: { id: true },
  })
  return id
}

async function dropTenant(t: Tenant): Promise<void> {
  const where = { companyId: t.companyId }
  await prisma.inventoryMovement.deleteMany({ where })
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

type Seed = {
  readonly a: Tenant
  readonly b: Tenant
  readonly presentationId: string
  readonly productId: string
  readonly deletedProductId: string
  readonly rawMaterialId: string
  readonly paginatedProductId: string
  readonly productB: string
  readonly orderLive: string
  readonly orderDeleted: string
  readonly orderOfDeletedProduct: string
  readonly orderB: string
  readonly deliveryId: string
  readonly deliveryLineId: string
  readonly voidId: string
  readonly batchProduced: { readonly id: string; readonly lot: string }
  readonly batchEmpty: { readonly id: string; readonly lot: string }
  readonly batchOpening: { readonly id: string; readonly lot: string }
  readonly paginatedBatches: readonly { readonly id: string; readonly createdAt: Date }[]
  readonly paginatedMovements: readonly { readonly id: string; readonly createdAt: Date }[]
  readonly movements: {
    readonly productionLive: string
    readonly productionDeleted: string
    readonly opening: string
    readonly adjustmentIn: string
    readonly adjustmentOut: string
    readonly delivery: string
    readonly deliveryVoid: string
  }
}

const tenants: Tenant[] = []
let seed: Seed

async function seedAll(): Promise<Seed> {
  const a = await createTenant('A')
  tenants.push(a)
  const b = await createTenant('B')
  tenants.push(b)

  const presentationId = await createPresentation(a, '5.0000')
  const otherPresentation = await createPresentation(a, null)
  const productId = await createFinished(a, presentationId)
  const deletedProductId = await createFinished(a, otherPresentation, {
    recipeId: await createRecipe(a.companyId),
    deletedAt: new Date(),
  })
  const paginatedProductId = await createFinished(a, otherPresentation)
  const marca = token()
  const { id: rawMaterialId } = await prisma.product.create({
    data: { name: `Insumo ${marca}`, nameNormalized: `insumo${marca}`, unitId: a.unitId, companyId: a.companyId },
    select: { id: true },
  })

  const orderLive = await createOrder(a)
  const orderDeleted = await createOrder(a, new Date())
  const orderOfDeletedProduct = await createOrder(a)
  const lineLive = await createLine(a, orderLive, presentationId)
  const lineDeleted = await createLine(a, orderDeleted, presentationId)
  const lineOfDeletedProduct = await createLine(a, orderOfDeletedProduct, otherPresentation)

  const batchProduced = await createBatch(a, {
    productId,
    presentationId,
    stock: '22.0000',
    unitCost: '2.5000',
    packageContent: '5.0000',
    createdAt: at(1),
    productionDate: '2026-09-28',
    expiryDate: '2027-09-28',
  })
  const batchEmpty = await createBatch(a, {
    productId,
    presentationId,
    stock: '0.0000',
    unitCost: '1.2500',
    packageContent: '5.0000',
    createdAt: at(2),
  })
  const batchOpening = await createBatch(a, {
    productId,
    presentationId,
    stock: '7.0000',
    unitCost: '1.5000',
    packageContent: null,
    createdAt: at(3),
  })
  const batchOfDeletedProduct = await createBatch(a, {
    productId: deletedProductId,
    presentationId: otherPresentation,
    stock: '3.0000',
    unitCost: '1.0000',
    packageContent: '2.0000',
    createdAt: at(4),
  })
  await createBatch(a, {
    productId: rawMaterialId,
    presentationId: otherPresentation,
    stock: '9.0000',
    unitCost: '1.0000',
    packageContent: null,
    createdAt: at(4),
  })

  const productionLive = await movement(a, {
    batchId: batchProduced.id,
    kind: 'production',
    quantity: new Prisma.Decimal('20.0000'),
    orderId: orderLive,
    orderPresentationLineId: lineLive,
    createdAt: at(1),
  })
  const productionDeleted = await movement(a, {
    batchId: batchEmpty.id,
    kind: 'production',
    quantity: new Prisma.Decimal('10.0000'),
    orderId: orderDeleted,
    orderPresentationLineId: lineDeleted,
    createdAt: at(2),
  })
  const opening = await movement(a, {
    batchId: batchOpening.id,
    kind: 'opening',
    quantity: new Prisma.Decimal('7.0000'),
    createdAt: at(3),
  })
  await movement(a, {
    batchId: batchOfDeletedProduct.id,
    kind: 'production',
    quantity: new Prisma.Decimal('3.0000'),
    orderId: orderOfDeletedProduct,
    orderPresentationLineId: lineOfDeletedProduct,
    createdAt: at(4),
  })
  const adjustmentIn = await movement(a, {
    batchId: batchProduced.id,
    kind: 'adjustment',
    quantity: new Prisma.Decimal('3.0000'),
    reason: 'conteo_fisico',
    createdAt: at(5),
  })
  const adjustmentOut = await movement(a, {
    batchId: batchEmpty.id,
    kind: 'adjustment',
    quantity: new Prisma.Decimal('-10.0000'),
    reason: 'merma',
    createdAt: at(6),
  })

  // 2026-10-15 (QC-282): el cliente va en la linea de entrega, no en la entrega.
  const { id: deliveryId } = await prisma.orderDelivery.create({
    data: {
      companyId: a.companyId,
      orderId: orderLive,
      deliveryKey: randomUUID(),
      createdBy: a.userId,
      createdAt: at(7),
    },
    select: { id: true },
  })
  const { id: deliveryLineId } = await prisma.orderDeliveryLine.create({
    data: {
      companyId: a.companyId,
      deliveryId,
      customerId: a.customerId,
      orderPresentationLineId: lineLive,
      batchId: batchProduced.id,
      packages: 1,
      quantity: new Prisma.Decimal('5.0000'),
    },
    select: { id: true },
  })
  const delivery = await movement(a, {
    batchId: batchProduced.id,
    kind: 'delivery',
    quantity: new Prisma.Decimal('-5.0000'),
    orderId: orderLive,
    orderDeliveryId: deliveryId,
    createdAt: at(7),
  })
  const { id: voidId } = await prisma.orderDeliveryVoid.create({
    data: {
      companyId: a.companyId,
      deliveryId,
      voidKey: randomUUID(),
      reason: 'Cliente devolvio el pedido',
      createdBy: a.userId,
      createdAt: at(8),
    },
    select: { id: true },
  })
  await prisma.orderDeliveryVoidLine.create({
    data: { companyId: a.companyId, voidId, deliveryId, deliveryLineId },
  })
  const deliveryVoid = await movement(a, {
    batchId: batchProduced.id,
    kind: 'delivery_void',
    quantity: new Prisma.Decimal('5.0000'),
    orderId: orderLive,
    orderDeliveryVoidId: voidId,
    createdAt: at(8),
  })

  // 27 lotes en pares de la misma fecha: el desempate por id se ve en cada par.
  const paginatedBatches: { id: string; createdAt: Date }[] = []
  const paginatedMovements: { id: string; createdAt: Date }[] = []
  for (let i = 0; i < 27; i += 1) {
    const createdAt = at(100 + Math.floor(i / 2))
    const batch = await createBatch(a, {
      productId: paginatedProductId,
      presentationId: otherPresentation,
      stock: '1.0000',
      unitCost: '1.0000',
      packageContent: null,
      createdAt,
    })
    paginatedBatches.push({ id: batch.id, createdAt })
    const id = await movement(a, { batchId: batch.id, kind: 'opening', quantity: new Prisma.Decimal('1.0000'), createdAt })
    paginatedMovements.push({ id, createdAt })
  }

  const presentationB = await createPresentation(b, '5.0000')
  const productB = await createFinished(b, presentationB)
  const orderB = await createOrder(b)
  const lineB = await createLine(b, orderB, presentationB)
  const batchB = await createBatch(b, {
    productId: productB,
    presentationId: presentationB,
    stock: '4.0000',
    unitCost: '1.0000',
    packageContent: '5.0000',
    createdAt: at(1),
  })
  await movement(b, {
    batchId: batchB.id,
    kind: 'production',
    quantity: new Prisma.Decimal('4.0000'),
    orderId: orderB,
    orderPresentationLineId: lineB,
    createdAt: at(1),
  })
  const { id: deliveryB } = await prisma.orderDelivery.create({
    data: { companyId: b.companyId, orderId: orderB, deliveryKey: randomUUID(), createdBy: b.userId },
    select: { id: true },
  })
  await movement(b, {
    batchId: batchB.id,
    kind: 'delivery',
    quantity: new Prisma.Decimal('-1.0000'),
    orderId: orderB,
    orderDeliveryId: deliveryB,
    createdAt: at(2),
  })

  return {
    a,
    b,
    presentationId,
    productId,
    deletedProductId,
    rawMaterialId,
    paginatedProductId,
    productB,
    orderLive,
    orderDeleted,
    orderOfDeletedProduct,
    orderB,
    deliveryId,
    deliveryLineId,
    voidId,
    batchProduced,
    batchEmpty,
    batchOpening,
    paginatedBatches,
    paginatedMovements,
    movements: { productionLive, productionDeleted, opening, adjustmentIn, adjustmentOut, delivery, deliveryVoid },
  }
}

function newestFirst<T extends { readonly id: string; readonly createdAt: Date }>(rows: readonly T[]): string[] {
  return [...rows]
    .sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime() || (x.id < y.id ? 1 : x.id > y.id ? -1 : 0))
    .map((row) => row.id)
}

beforeAll(async () => {
  seed = await seedAll()
}, 120_000)

afterAll(async () => {
  for (const t of tenants) await dropTenant(t)
  await prisma.$disconnect()
}, 120_000)

describe('findAliveFinishedProduct', () => {
  it('R5: devuelve null para un producto borrado, un insumo, uno de otra empresa y uno inexistente', async () => {
    const scope = seed.a.scope
    expect(await findAliveFinishedProduct(seed.deletedProductId, scope)).toBeNull()
    expect(await findAliveFinishedProduct(seed.rawMaterialId, scope)).toBeNull()
    expect(await findAliveFinishedProduct(seed.productB, scope)).toBeNull()
    expect(await findAliveFinishedProduct(randomUUID(), scope)).toBeNull()
  })

  it('R5, R11: trae el producto vivo con su presentacion y el id, la existencia y el contenido de cada lote', async () => {
    const record = await findAliveFinishedProduct(seed.productId, seed.a.scope)

    expect(record).not.toBeNull()
    expect(record?.id).toBe(seed.productId)
    expect(record?.qtyAlert).toBe('4.5000')
    expect(record?.unitId).toBe(seed.a.unitId)
    expect(record?.presentation).toEqual({
      id: seed.presentationId,
      name: expect.stringContaining('Presentacion'),
      content: '5.0000',
      unitId: seed.a.unitId,
    })
    // 2026-10-15 (QC-282): cada lote trae tambien su codigo, del que sale el lote de la fila de Entregas.
    expect(record?.batches).toEqual([
      { id: seed.batchOpening.id, lot: seed.batchOpening.lot, stock: '7.0000', packageContent: null },
      { id: seed.batchEmpty.id, lot: seed.batchEmpty.lot, stock: '0.0000', packageContent: '5.0000' },
      { id: seed.batchProduced.id, lot: seed.batchProduced.lot, stock: '22.0000', packageContent: '5.0000' },
    ])
  })
})

describe('listFinishedProductBatches', () => {
  it('R13, R14: todos los lotes, agotado incluido, con el pedido de su asiento production aunque el pedido este borrado', async () => {
    const page = await listFinishedProductBatches(seed.productId, { page: 1 }, seed.a.scope)

    expect(page.total).toBe(3)
    expect(page.items).toEqual([
      {
        id: seed.batchOpening.id,
        lot: seed.batchOpening.lot,
        orderId: null,
        purchaseDate: '2026-09-01',
        productionDate: null,
        expiryDate: null,
        packageContent: null,
        stock: '7.0000',
        createdAt: at(3).toISOString(),
      },
      {
        id: seed.batchEmpty.id,
        lot: seed.batchEmpty.lot,
        orderId: seed.orderDeleted,
        purchaseDate: '2026-09-01',
        productionDate: null,
        expiryDate: null,
        packageContent: '5.0000',
        stock: '0.0000',
        createdAt: at(2).toISOString(),
      },
      {
        id: seed.batchProduced.id,
        lot: seed.batchProduced.lot,
        orderId: seed.orderLive,
        purchaseDate: '2026-09-01',
        productionDate: '2026-09-28',
        expiryDate: '2027-09-28',
        packageContent: '5.0000',
        stock: '22.0000',
        createdAt: at(1).toISOString(),
      },
    ])
  })

  it('R23: orden createdAt desc e id desc, 10 por defecto, tope de 25 y total correcto', async () => {
    const expected = newestFirst(seed.paginatedBatches)
    const scope = seed.a.scope

    const first = await listFinishedProductBatches(seed.paginatedProductId, { page: 1 }, scope)
    expect(first.items.map((row) => row.id)).toEqual(expected.slice(0, 10))
    expect([first.total, first.pageSize, first.totalPages]).toEqual([27, 10, 3])

    const capped = await listFinishedProductBatches(seed.paginatedProductId, { page: 1, pageSize: 500 }, scope)
    expect(capped.items.map((row) => row.id)).toEqual(expected.slice(0, 25))
    expect([capped.total, capped.pageSize, capped.totalPages]).toEqual([27, 25, 2])

    const last = await listFinishedProductBatches(seed.paginatedProductId, { page: 2, pageSize: 25 }, scope)
    expect(last.items.map((row) => row.id)).toEqual(expected.slice(25))
  })
})

describe('listFinishedProductMovements', () => {
  it('R15, R16, R35: in trae solo los asientos positivos, con su origen, lote, motivo y pedido, y el delivery_void con su pedido', async () => {
    const page = await listFinishedProductMovements(seed.productId, 'in', { page: 1 }, seed.a.scope)
    const m = seed.movements

    expect(page.total).toBe(5)
    expect(page.items.map((row) => [row.id, row.kind, row.lot, row.quantity, row.packageContent, row.orderId, row.reason])).toEqual([
      [m.deliveryVoid, 'delivery_void', seed.batchProduced.lot, '5.0000', '5.0000', seed.orderLive, null],
      [m.adjustmentIn, 'adjustment', seed.batchProduced.lot, '3.0000', '5.0000', null, 'conteo_fisico'],
      [m.opening, 'opening', seed.batchOpening.lot, '7.0000', null, null, null],
      [m.productionDeleted, 'production', seed.batchEmpty.lot, '10.0000', '5.0000', seed.orderDeleted, null],
      [m.productionLive, 'production', seed.batchProduced.lot, '20.0000', '5.0000', seed.orderLive, null],
    ])
    expect(page.items.every((row) => row.batchId !== '' && row.createdAt !== '')).toBe(true)
  })

  it('R17, R18, R35: out trae solo los negativos, con signo: el ajuste que resta y la entrega anulada siguen ahi', async () => {
    const page = await listFinishedProductMovements(seed.productId, 'out', { page: 1 }, seed.a.scope)
    const m = seed.movements

    expect(page.total).toBe(2)
    expect(page.items.map((row) => [row.id, row.kind, row.batchId, row.quantity, row.orderId, row.reason])).toEqual([
      [m.delivery, 'delivery', seed.batchProduced.id, '-5.0000', seed.orderLive, null],
      [m.adjustmentOut, 'adjustment', seed.batchEmpty.id, '-10.0000', null, 'merma'],
    ])
  })

  it('R18: ningun asiento sale en los dos lados', async () => {
    const entradas = await listFinishedProductMovements(seed.productId, 'in', { page: 1, pageSize: 25 }, seed.a.scope)
    const salidas = await listFinishedProductMovements(seed.productId, 'out', { page: 1, pageSize: 25 }, seed.a.scope)
    const idsIn = new Set(entradas.items.map((row) => row.id))

    expect(salidas.items.filter((row) => idsIn.has(row.id))).toEqual([])
    expect(entradas.items.every((row) => Number(row.quantity) > 0)).toBe(true)
    expect(salidas.items.every((row) => Number(row.quantity) < 0)).toBe(true)
  })

  it('R23: los asientos tambien van en createdAt desc e id desc, con el tope de 25', async () => {
    const expected = newestFirst(seed.paginatedMovements)
    const page = await listFinishedProductMovements(seed.paginatedProductId, 'in', { page: 1, pageSize: 30 }, seed.a.scope)

    expect(page.items.map((row) => row.id)).toEqual(expected.slice(0, 25))
    expect([page.total, page.pageSize, page.totalPages]).toEqual([27, 25, 2])
  })
})

// 2026-10-15 (QC-282): `listFinishedProductDeliveryMovements` desaparece: la fila del tab Entregas es
// la linea de entrega, que lee `pedidos`. El caso pasa a la fachada con su cableado real; la entrega
// sigue anulada y su fila sigue saliendo, ahora con su cliente, su presentacion y su anulacion.
describe('inventario.listFinishedProductDeliveries con su cableado real', () => {
  const lector = () => ({ id: seed.a.userId, companyId: seed.a.companyId, permissions: ['inventario.consultar'] })

  it('R19, R43, R44: una fila por linea de entrega, con cliente, pedido, presentacion, lote, envases, cantidad y anulacion', async () => {
    const page = await inventario.listFinishedProductDeliveries(seed.productId, { page: 1 }, lector())

    expect(page).toMatchObject({ total: 1, page: 1, pageSize: 10, totalPages: 1 })
    expect(page.items).toEqual([
      {
        deliveryLineId: seed.deliveryLineId,
        orderDeliveryId: seed.deliveryId,
        createdAt: at(7).toISOString(),
        customer: { id: seed.a.customerId, firstNames: 'Luis', lastNames: 'Rojas', isDeleted: false },
        orderNumberText: expect.stringMatching(/^\d{4}-\d{7}$/u),
        presentationName: expect.stringContaining('Presentacion'),
        batchId: seed.batchProduced.id,
        lot: seed.batchProduced.lot,
        packages: 1,
        quantity: '5.0000',
        void: { reason: 'Cliente devolvio el pedido' },
      },
    ])
    expect(page.delivered).toEqual({ quantity: '0.0000', packages: 0 })
  })
})

describe('listFinishedProductCosts', () => {
  it('R21, R22: solo los lotes con asiento production, con la cantidad del asiento y el unitCost y packageContent guardados', async () => {
    const page = await listFinishedProductCosts(seed.productId, { page: 1 }, seed.a.scope)

    expect(page.total).toBe(2)
    expect(page.items).toEqual([
      {
        batchId: seed.batchEmpty.id,
        lot: seed.batchEmpty.lot,
        orderId: seed.orderDeleted,
        quantity: '10.0000',
        packageContent: '5.0000',
        unitCost: '1.2500',
        createdAt: at(2).toISOString(),
      },
      {
        batchId: seed.batchProduced.id,
        lot: seed.batchProduced.lot,
        orderId: seed.orderLive,
        quantity: '20.0000',
        packageContent: '5.0000',
        unitCost: '2.5000',
        createdAt: at(1).toISOString(),
      },
    ])
  })
})

describe('findProducedFinishedProducts', () => {
  it('R27, R28: (pedido, presentacion, producto) por los asientos production; ni producto borrado ni pedido de otra empresa', async () => {
    const links = await findProducedFinishedProducts(
      [seed.orderLive, seed.orderDeleted, seed.orderOfDeletedProduct, seed.orderB, randomUUID()],
      seed.a.scope,
    )

    expect([...links].sort((x, y) => x.orderId.localeCompare(y.orderId))).toEqual(
      [
        { orderId: seed.orderLive, presentationId: seed.presentationId, productId: seed.productId },
        { orderId: seed.orderDeleted, presentationId: seed.presentationId, productId: seed.productId },
      ].sort((x, y) => x.orderId.localeCompare(y.orderId)),
    )
    expect(await findProducedFinishedProducts([], seed.a.scope)).toEqual([])
  })
})

describe('ambito de empresa', () => {
  it('R25: con el ambito de A, nada de B aparece en ningun metodo aunque se pase un id de B', async () => {
    const scope = seed.a.scope
    const page = { page: 1, pageSize: 25 }

    expect(await findAliveFinishedProduct(seed.productB, scope)).toBeNull()
    expect((await listFinishedProductBatches(seed.productB, page, scope)).total).toBe(0)
    expect((await listFinishedProductMovements(seed.productB, 'in', page, scope)).total).toBe(0)
    expect((await listFinishedProductMovements(seed.productB, 'out', page, scope)).total).toBe(0)
    expect((await listFinishedProductCosts(seed.productB, page, scope)).total).toBe(0)
    expect(await findProducedFinishedProducts([seed.orderB], scope)).toEqual([])
  })

  it('R25: con el ambito de B, el producto de A no existe y B solo ve lo suyo', async () => {
    const scope = seed.b.scope
    const page = { page: 1, pageSize: 25 }

    expect(await findAliveFinishedProduct(seed.productId, scope)).toBeNull()
    expect((await listFinishedProductBatches(seed.productId, page, scope)).total).toBe(0)
    expect((await listFinishedProductMovements(seed.productId, 'in', page, scope)).total).toBe(0)
    expect((await listFinishedProductCosts(seed.productId, page, scope)).total).toBe(0)
    expect(await findProducedFinishedProducts([seed.orderLive], scope)).toEqual([])

    expect((await listFinishedProductBatches(seed.productB, page, scope)).total).toBe(1)
    // 2026-10-15 (QC-282): el tab Entregas ya no lee asientos de este adaptador; su ambito se comprueba
    // en `order-delivery-directory.int.test.ts`.
    expect(await findProducedFinishedProducts([seed.orderB], scope)).toHaveLength(1)
  })
})
