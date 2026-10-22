/**
 * El directorio de lineas empacadas que `pedidos` le da a la tab «Reparto» de la ficha de producto
 * terminado (`packed-lines-directory-prisma.ts`) contra Postgres REAL, con dos empresas.
 *
 * AISLAMIENTO: el adaptador lee con el cliente GLOBAL, que no ve lo que una transaccion abierta no
 * confirmo. La siembra se confirma sobre dos empresas efimeras en `beforeAll` y se borra en
 * `afterAll` en orden de FK.
 */
import { randomUUID } from 'node:crypto'

import { Prisma } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { normalizeCompanyName } from '@/lib/modules/identity'
import { listPackedLinesByCombination } from '@/lib/modules/pedidos/adapters/driven/persistence/packed-lines-directory-prisma'
import { prisma } from '@/lib/shared/db/prisma'

function token(): string {
  return randomUUID().replace(/-/gu, '')
}

function asUuid(id: string): Prisma.Sql {
  return Prisma.sql`CAST(${id} AS uuid)`
}

const THIS_YEAR = new Date().getUTCFullYear()
const LAST_YEAR = THIS_YEAR - 1
let nextSequence = 280_000

type Tenant = {
  readonly companyId: string
  readonly userId: string
  readonly roleId: string
  readonly documentTypeCode: string
  readonly unitId: string
  readonly recipeId: string
  readonly otherRecipeId: string
}

async function createRecipe(companyId: string): Promise<string> {
  const marca = token()
  const { id } = await prisma.recipe.create({
    data: { name: `Receta ${marca}`, nameNormalized: `receta${marca}`, companyId },
    select: { id: true },
  })
  return id
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
  const { id: unitId } = await prisma.unit.create({
    data: { name: `Unidad ${marca}`, nameNormalized: `unidad${marca}`, symbol: `u${marca.slice(0, 8)}` },
    select: { id: true },
  })
  return {
    companyId,
    userId,
    roleId,
    documentTypeCode,
    unitId,
    recipeId: await createRecipe(companyId),
    otherRecipeId: await createRecipe(companyId),
  }
}

async function createPresentation(t: Tenant): Promise<string> {
  const marca = token()
  const { id } = await prisma.presentation.create({
    data: {
      name: `Presentacion ${marca}`,
      nameNormalized: `presentacion${marca}`,
      unitId: t.unitId,
      companyId: t.companyId,
      content: new Prisma.Decimal('1.0000'),
    },
    select: { id: true },
  })
  return id
}

type Status =
  | 'PENDIENTE'
  | 'EN_EMPAQUE'
  | 'POR_ACONDICIONAR'
  | 'EN_ACONDICIONAMIENTO'
  | 'TERMINADO'
  | 'ENTREGADO'
  | 'CANCELADO'

type OrderSeed = {
  readonly status: Status
  readonly recipeId?: string
  readonly year?: number
}

/** Devuelve el id y el numero visible, `AAAA-NNNNNNN`. */
async function createOrder(t: Tenant, seed: OrderSeed): Promise<{ id: string; number: string }> {
  const id = randomUUID()
  nextSequence += 1
  const year = seed.year ?? THIS_YEAR
  const createdAt = new Date(Date.UTC(year, 5, 1))
  const packed = !['PENDIENTE', 'CANCELADO'].includes(seed.status)
  const conditioned = seed.status === 'EN_ACONDICIONAMIENTO' || seed.status === 'TERMINADO'
  const finished = seed.status === 'TERMINADO'
  await prisma.$executeRaw`
    INSERT INTO "orders" (
      "id", "company_id", "order_year", "order_sequence", "recipe_id", "quantity", "status",
      "packed_by", "conditioned_by", "finished_at", "cancellation_reason", "created_at", "updated_at"
    )
    VALUES (
      ${asUuid(id)}, ${asUuid(t.companyId)}, ${year}, ${nextSequence},
      ${asUuid(seed.recipeId ?? t.recipeId)}, CAST('100' AS decimal(14,4)), CAST(${seed.status} AS "OrderStatus"),
      ${packed ? asUuid(t.userId) : Prisma.sql`NULL`},
      ${conditioned ? asUuid(t.userId) : Prisma.sql`NULL`},
      ${finished ? Prisma.sql`CURRENT_TIMESTAMP` : Prisma.sql`NULL`},
      ${seed.status === 'CANCELADO' ? 'Cliente desistio' : null},
      ${createdAt}, CURRENT_TIMESTAMP
    )`
  return { id, number: `${String(year)}-${String(nextSequence).padStart(7, '0')}` }
}

type LineSeed = {
  readonly packages?: number
  readonly packedPackages?: number | null
  readonly packedReason?: string | null
  readonly packedReasonOther?: string | null
}

async function createLine(t: Tenant, orderId: string, presentationId: string, seed: LineSeed = {}): Promise<string> {
  const { id } = await prisma.orderPresentationLine.create({
    data: {
      orderId,
      companyId: t.companyId,
      presentationId,
      packages: seed.packages ?? 10,
      packedPackages: seed.packedPackages ?? null,
      packedReason: seed.packedReason ?? null,
      packedReasonOther: seed.packedReasonOther ?? null,
    },
    select: { id: true },
  })
  return id
}

async function dropTenant(t: Tenant): Promise<void> {
  const where = { companyId: t.companyId }
  await prisma.orderPresentationLine.deleteMany({ where })
  await prisma.order.deleteMany({ where })
  await prisma.recipe.deleteMany({ where })
  await prisma.presentation.deleteMany({ where })
  await prisma.unit.deleteMany({ where: { id: t.unitId } })
  await prisma.user.deleteMany({ where: { id: t.userId } })
  await prisma.role.deleteMany({ where: { id: t.roleId } })
  await prisma.documentType.deleteMany({ where: { code: t.documentTypeCode } })
  await prisma.company.deleteMany({ where: { id: t.companyId } })
}

type Row = { lineId: string; number: string }

type Seed = {
  readonly a: Tenant
  readonly b: Tenant
  readonly presentation: string
  readonly presentationB: string
  /** Lo que la tab debe listar, ya en orden de numero de pedido descendente. */
  readonly expected: readonly Row[]
  readonly equal: Row
  readonly fewer: Row
  readonly more: Row
  readonly other: Row
  readonly zero: Row
  readonly beforeCounting: Row
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

  async function packedRow(status: Status, line: LineSeed, year?: number): Promise<Row> {
    const order = await createOrder(a, { status, year })
    const lineId = await createLine(a, order.id, presentation, line)
    return { lineId, number: order.number }
  }

  // Un pedido del ano pasado con correlativo mayor que todos: el ano manda sobre la secuencia.
  nextSequence += 1_000
  const lastYear = await packedRow('ENTREGADO', { packedPackages: 10 }, LAST_YEAR)
  nextSequence -= 1_100

  const equal = await packedRow('POR_ACONDICIONAR', { packedPackages: 10 })
  const fewer = await packedRow('EN_ACONDICIONAMIENTO', { packedPackages: 8, packedReason: 'merma' })
  const more = await packedRow('TERMINADO', { packedPackages: 12, packedReason: 'conteo_fisico' })
  const other = await packedRow('ENTREGADO', {
    packedPackages: 9,
    packedReason: 'otro',
    packedReasonOther: 'Se cayo una caja',
  })
  const zero = await packedRow('POR_ACONDICIONAR', { packedPackages: 0, packedReason: 'rotura' })
  const beforeCounting = await packedRow('ENTREGADO', {})

  // Fuera: aun sin empacar, cancelado, otra presentacion y otra receta.
  for (const status of ['PENDIENTE', 'EN_EMPAQUE', 'CANCELADO'] as const) {
    const order = await createOrder(a, { status })
    await createLine(a, order.id, presentation)
  }
  await createLine(a, (await createOrder(a, { status: 'POR_ACONDICIONAR' })).id, otherPresentation, {
    packedPackages: 10,
  })
  await createLine(a, (await createOrder(a, { status: 'POR_ACONDICIONAR', recipeId: a.otherRecipeId })).id, presentation, {
    packedPackages: 10,
  })
  // La segunda linea de un pedido que si sale, en otra presentacion: no se cuela.
  const equalOrder = await prisma.orderPresentationLine.findUniqueOrThrow({
    where: { id: equal.lineId },
    select: { orderId: true },
  })
  await createLine(a, equalOrder.orderId, otherPresentation, { packedPackages: 10 })

  const presentationB = await createPresentation(b)
  const orderB = await createOrder(b, { status: 'POR_ACONDICIONAR' })
  await createLine(b, orderB.id, presentationB, { packedPackages: 10 })

  return {
    a,
    b,
    presentation,
    presentationB,
    expected: [beforeCounting, zero, other, more, fewer, equal, lastYear],
    equal,
    fewer,
    more,
    other,
    zero,
    beforeCounting,
  }
}

beforeAll(async () => {
  seed = await seedAll()
}, 120_000)

afterAll(async () => {
  for (const t of tenants) await dropTenant(t)
  await prisma.$disconnect()
}, 120_000)

function combinationA() {
  return { recipeId: seed.a.recipeId, presentationId: seed.presentation }
}

describe('listPackedLinesByCombination', () => {
  it('R26: solo las lineas de pedidos empacados de esa receta y presentacion, por numero de pedido descendente', async () => {
    const page = await listPackedLinesByCombination(seed.a.companyId, combinationA(), { page: 1 })

    expect(page.items.map((item) => item.lineId)).toEqual(seed.expected.map((row) => row.lineId))
    expect(page.items.map((item) => item.orderNumberText)).toEqual(seed.expected.map((row) => row.number))
    expect(page).toMatchObject({ total: seed.expected.length, page: 1, pageSize: 10, totalPages: 1 })
  })

  it('R27: cada fila trae plan, envases reales, motivo y texto de Otro tal como estan en la linea', async () => {
    const page = await listPackedLinesByCombination(seed.a.companyId, combinationA(), { page: 1 })
    const byLine = new Map(page.items.map((item) => [item.lineId, item]))

    expect(byLine.get(seed.equal.lineId)).toEqual({
      lineId: seed.equal.lineId,
      orderNumberText: seed.equal.number,
      plan: 10,
      packedPackages: 10,
      reason: null,
      reasonOther: null,
    })
    expect(byLine.get(seed.fewer.lineId)).toMatchObject({ plan: 10, packedPackages: 8, reason: 'merma', reasonOther: null })
    expect(byLine.get(seed.more.lineId)).toMatchObject({ plan: 10, packedPackages: 12, reason: 'conteo_fisico' })
    expect(byLine.get(seed.other.lineId)).toMatchObject({
      packedPackages: 9,
      reason: 'otro',
      reasonOther: 'Se cayo una caja',
    })
    expect(byLine.get(seed.zero.lineId)).toMatchObject({ plan: 10, packedPackages: 0, reason: 'rotura' })
  })

  it('R25: una linea empacada antes de contar los envases sale con packedPackages null y sin motivo', async () => {
    const page = await listPackedLinesByCombination(seed.a.companyId, combinationA(), { page: 1 })

    expect(page.items.find((item) => item.lineId === seed.beforeCounting.lineId)).toMatchObject({
      plan: 10,
      packedPackages: null,
      reason: null,
      reasonOther: null,
    })
  })

  it('R26: pagina de 10 o 25 filas y acota un tamano mayor a 25', async () => {
    const total = seed.expected.length
    for (const pageSize of [10, 25]) {
      const page = await listPackedLinesByCombination(seed.a.companyId, combinationA(), { page: 1, pageSize })
      expect(page).toMatchObject({ total, pageSize, totalPages: 1 })
      expect(page.items).toHaveLength(total)
    }

    const capped = await listPackedLinesByCombination(seed.a.companyId, combinationA(), { page: 1, pageSize: 500 })
    expect(capped.pageSize).toBe(25)
  })

  it('R26: la segunda pagina sigue el mismo orden y una pagina fuera de rango sale vacia', async () => {
    const second = await listPackedLinesByCombination(seed.a.companyId, combinationA(), { page: 2, pageSize: 3 })
    expect(second.items.map((item) => item.lineId)).toEqual(seed.expected.slice(3, 6).map((row) => row.lineId))
    expect(second).toMatchObject({ total: seed.expected.length, page: 2, pageSize: 3, totalPages: 3 })

    const beyond = await listPackedLinesByCombination(seed.a.companyId, combinationA(), { page: 9, pageSize: 10 })
    expect(beyond.items).toEqual([])
    expect(beyond.total).toBe(seed.expected.length)
  })

  it('R29: con la empresa B no ve ninguna linea de A, y A no ve las de B', async () => {
    const fromB = await listPackedLinesByCombination(seed.b.companyId, combinationA(), { page: 1 })
    expect(fromB).toMatchObject({ items: [], total: 0 })

    const bCombinationFromA = await listPackedLinesByCombination(
      seed.a.companyId,
      { recipeId: seed.b.recipeId, presentationId: seed.presentationB },
      { page: 1 },
    )
    expect(bCombinationFromA).toMatchObject({ items: [], total: 0 })

    const own = await listPackedLinesByCombination(
      seed.b.companyId,
      { recipeId: seed.b.recipeId, presentationId: seed.presentationB },
      { page: 1 },
    )
    expect(own.total).toBe(1)
  })
})
