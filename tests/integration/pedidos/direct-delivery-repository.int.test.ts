/**
 * `createDirectDeliveryRepository` y `createWaitingOrdersReader` contra Postgres REAL: el alta de la
 * entrega sin pedido y su clave compartida con las entregas de pedido, sus lineas sin linea del
 * reparto, y las lineas del reparto que esperan producto (pedidos vivos en TERMINADO de la misma
 * receta y presentacion, con lo entregado sin las lineas anuladas).
 *
 * AISLAMIENTO: cada `it` corre dentro de `prisma.$transaction` interactiva y termina lanzando
 * `RollbackSignal`. Lo que se espera que falle (la clave repetida) va en su propio `SAVEPOINT`.
 */
import { randomUUID } from 'node:crypto'

import { Prisma, type OrderStatus } from '@prisma/client'
import { afterAll, describe, expect, it, vi } from 'vitest'

import { normalizeCompanyName } from '@/lib/modules/identity'
import {
  createDirectDeliveryRepository,
  createWaitingOrdersReader,
} from '@/lib/modules/pedidos/adapters/driven/persistence/direct-delivery-prisma'
import { createOrderDeliveryRepository } from '@/lib/modules/pedidos/adapters/driven/persistence/order-delivery-prisma'
import { formatOrderNumber } from '@/lib/modules/pedidos/domain/order-number'
import { prisma } from '@/lib/shared/db/prisma'

class RollbackSignal extends Error {
  constructor() {
    super('rollback de aislamiento del test')
    this.name = 'RollbackSignal'
  }
}

async function inRolledBackTransaction(body: (tx: Prisma.TransactionClient) => Promise<void>): Promise<void> {
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

let savepointSeq = 0

async function inSavepoint<T>(tx: Prisma.TransactionClient, run: () => Promise<T>): Promise<T> {
  savepointSeq += 1
  const savepoint = `direct_delivery_repo_sp_${String(savepointSeq)}`
  await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`)
  try {
    return await run()
  } finally {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`)
  }
}

function token(): string {
  return randomUUID().replace(/-/gu, '')
}

const ENTREGA = new Date('2026-10-16T10:00:00.000Z')
const ANIO = 2026

// --- Fixtures -------------------------------------------------------------------------------

type Tenant = {
  readonly companyId: string
  readonly userId: string
  readonly customerId: string
  readonly unitId: string
  readonly recipeId: string
  readonly presentationId: string
}

let nextSequence = 940_000
function freshSequence(): number {
  nextSequence += 1
  return nextSequence
}

async function createRecipe(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
  const marca = token()
  const { id } = await tx.recipe.create({
    data: { name: `Receta ${marca}`, nameNormalized: `receta${marca}`, companyId },
    select: { id: true },
  })
  return id
}

async function createPresentation(tx: Prisma.TransactionClient, companyId: string, unitId: string): Promise<string> {
  const marca = token()
  const { id } = await tx.presentation.create({
    data: {
      name: `Presentacion ${marca}`,
      nameNormalized: `presentacion${marca}`,
      unitId,
      companyId,
      content: new Prisma.Decimal('5.0000'),
    },
    select: { id: true },
  })
  return id
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
  const role = await tx.role.create({ data: { name: `rol-${marca}`, description: 'Rol de prueba' }, select: { id: true } })
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
  const { id: unitId } = await tx.unit.create({
    data: { name: `Unidad ${marca}`, nameNormalized: `unidad${marca}`, symbol: `u${marca.slice(0, 8)}` },
    select: { id: true },
  })
  const recipeId = await createRecipe(tx, companyId)
  const presentationId = await createPresentation(tx, companyId, unitId)
  return { companyId, userId, customerId, unitId, recipeId, presentationId }
}

type OrderSeed = {
  readonly status?: OrderStatus
  readonly recipeId?: string
  readonly deletedAt?: Date | null
  readonly lines: readonly {
    readonly presentationId: string
    readonly packages: number
    readonly packedPackages?: number
  }[]
}

/** Un pedido con las columnas que exigen sus CHECK por estado. */
async function createOrder(
  tx: Prisma.TransactionClient,
  t: Tenant,
  seed: OrderSeed,
): Promise<{ orderId: string; sequence: number; lineIds: readonly string[] }> {
  const status = seed.status ?? 'TERMINADO'
  const empacado = ['EN_EMPAQUE', 'POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO', 'ENTREGADO'].includes(status)
  const acondicionado = ['EN_ACONDICIONAMIENTO', 'TERMINADO', 'ENTREGADO'].includes(status)
  const sequence = freshSequence()
  const { id: orderId } = await tx.order.create({
    data: {
      companyId: t.companyId,
      orderYear: ANIO,
      orderSequence: sequence,
      recipeId: seed.recipeId ?? t.recipeId,
      quantity: new Prisma.Decimal('10'),
      status,
      packedBy: empacado ? t.userId : null,
      conditionedBy: acondicionado ? t.userId : null,
      finishedAt: status === 'TERMINADO' || status === 'ENTREGADO' ? new Date('2026-10-01T10:00:00Z') : null,
      deletedAt: seed.deletedAt ?? null,
    },
    select: { id: true },
  })
  const lineIds: string[] = []
  for (const line of seed.lines) {
    const counted = line.packedPackages !== undefined && line.packedPackages !== line.packages
    const { id } = await tx.orderPresentationLine.create({
      data: {
        orderId,
        companyId: t.companyId,
        presentationId: line.presentationId,
        packages: line.packages,
        packedPackages: line.packedPackages ?? null,
        packedReason: counted ? 'merma' : null,
      },
      select: { id: true },
    })
    lineIds.push(id)
  }
  return { orderId, sequence, lineIds }
}

async function createFinished(tx: Prisma.TransactionClient, t: Tenant): Promise<string> {
  const marca = token()
  const { id } = await tx.product.create({
    data: {
      name: `Terminado ${marca}`,
      nameNormalized: `terminado${marca}`,
      type: 'FINISHED_PRODUCT',
      unitId: t.unitId,
      recipeId: t.recipeId,
      presentationId: t.presentationId,
      companyId: t.companyId,
    },
    select: { id: true },
  })
  return id
}

async function createBatch(tx: Prisma.TransactionClient, t: Tenant, productId: string): Promise<string> {
  const { id } = await tx.productBatch.create({
    data: {
      productId,
      presentationId: t.presentationId,
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

/** Una entrega de pedido con una linea por (linea del reparto, envases); devuelve los ids de sus lineas. */
async function deliverOrder(
  tx: Prisma.TransactionClient,
  t: Tenant,
  orderId: string,
  lines: readonly { readonly presentationLineId: string; readonly batchId: string; readonly packages: number }[],
): Promise<{ deliveryId: string; lineIds: readonly string[] }> {
  const repo = createOrderDeliveryRepository(tx)
  const scope = { companyId: t.companyId }
  const outcome = await repo.create({ deliveryKey: randomUUID(), orderId, actorId: t.userId, now: ENTREGA }, scope)
  if (outcome.kind !== 'created') throw new Error('se esperaba una entrega de pedido creada')
  await repo.addLines(
    outcome.id,
    lines.map((line) => ({
      customerId: t.customerId,
      presentationLineId: line.presentationLineId,
      batchId: line.batchId,
      packages: line.packages,
      quantity: `${String(line.packages * 5)}.0000`,
    })),
    scope,
  )
  const rows = await tx.orderDeliveryLine.findMany({ where: { deliveryId: outcome.id }, select: { id: true, batchId: true } })
  return { deliveryId: outcome.id, lineIds: lines.map((line) => rows.find((r) => r.batchId === line.batchId)?.id ?? '') }
}

async function voidDeliveryLines(
  tx: Prisma.TransactionClient,
  t: Tenant,
  deliveryId: string,
  deliveryLineIds: readonly string[],
): Promise<void> {
  const { id: voidId } = await tx.orderDeliveryVoid.create({
    data: { companyId: t.companyId, deliveryId, voidKey: randomUUID(), reason: 'Devuelto', createdBy: t.userId },
    select: { id: true },
  })
  await tx.orderDeliveryVoidLine.createMany({
    data: deliveryLineIds.map((deliveryLineId) => ({ companyId: t.companyId, voidId, deliveryId, deliveryLineId })),
  })
}

function newDirect(t: Tenant, productId: string, deliveryKey: string = randomUUID(), note: string | null = null) {
  return { deliveryKey, productId, note, actorId: t.userId, now: ENTREGA }
}

afterAll(async () => {
  await prisma.$disconnect()
})

// --- Casos ----------------------------------------------------------------------------------

describe('DirectDeliveryRepository contra Postgres real', () => {
  it('R36, R37: create guarda la entrega sin pedido con su empresa, producto, nota, clave, autor e instante', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await createTenant(tx, 'A')
      const productId = await createFinished(tx, a)
      const key = randomUUID()

      const outcome = await createDirectDeliveryRepository(tx).create(
        newDirect(a, productId, key, 'Venta de mostrador'),
        { companyId: a.companyId },
      )

      expect(outcome.kind).toBe('created')
      const id = outcome.kind === 'created' ? outcome.id : ''
      expect(await tx.orderDelivery.findUniqueOrThrow({ where: { id } })).toMatchObject({
        companyId: a.companyId,
        orderId: null,
        productId,
        note: 'Venta de mostrador',
        deliveryKey: key,
        createdBy: a.userId,
        createdAt: ENTREGA,
      })
    })
  })

  it('R38: la misma clave en la misma empresa da duplicate_key y no deja una segunda fila', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await createTenant(tx, 'A')
      const productId = await createFinished(tx, a)
      const repo = createDirectDeliveryRepository(tx)
      const key = randomUUID()
      await repo.create(newDirect(a, productId, key), { companyId: a.companyId })

      const segunda = await inSavepoint(tx, () => repo.create(newDirect(a, productId, key), { companyId: a.companyId }))

      expect(segunda).toEqual({ kind: 'duplicate_key' })
      expect(await tx.orderDelivery.count({ where: { companyId: a.companyId, deliveryKey: key } })).toBe(1)
    })
  })

  it('R38: la clave de una entrega de pedido de la empresa tambien da duplicate_key', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await createTenant(tx, 'A')
      const productId = await createFinished(tx, a)
      const { orderId } = await createOrder(tx, a, { lines: [{ presentationId: a.presentationId, packages: 4 }] })
      const key = randomUUID()
      await createOrderDeliveryRepository(tx).create(
        { deliveryKey: key, orderId, actorId: a.userId, now: ENTREGA },
        { companyId: a.companyId },
      )

      const directa = await inSavepoint(tx, () =>
        createDirectDeliveryRepository(tx).create(newDirect(a, productId, key), { companyId: a.companyId }),
      )

      expect(directa).toEqual({ kind: 'duplicate_key' })
    })
  })

  it('R38: la clave es unica por empresa: otra empresa puede usar la misma', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await createTenant(tx, 'A')
      const b = await createTenant(tx, 'B')
      const repo = createDirectDeliveryRepository(tx)
      const key = randomUUID()
      await repo.create(newDirect(a, await createFinished(tx, a), key), { companyId: a.companyId })

      const enB = await repo.create(newDirect(b, await createFinished(tx, b), key), { companyId: b.companyId })

      expect(enB.kind).toBe('created')
    })
  })

  it('R38: findByKey devuelve orderId nulo para la sin pedido y el pedido para la de pedido; la de otra empresa no se ve', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await createTenant(tx, 'A')
      const b = await createTenant(tx, 'B')
      const productId = await createFinished(tx, a)
      const { orderId } = await createOrder(tx, a, { lines: [{ presentationId: a.presentationId, packages: 4 }] })
      const directKey = randomUUID()
      const orderKey = randomUUID()
      const repo = createDirectDeliveryRepository(tx)
      const directa = await repo.create(newDirect(a, productId, directKey), { companyId: a.companyId })
      const dePedido = await createOrderDeliveryRepository(tx).create(
        { deliveryKey: orderKey, orderId, actorId: a.userId, now: ENTREGA },
        { companyId: a.companyId },
      )
      if (directa.kind !== 'created' || dePedido.kind !== 'created') throw new Error('se esperaban dos entregas')

      expect(await repo.findByKey(directKey, { companyId: a.companyId })).toEqual({ id: directa.id, orderId: null })
      expect(await repo.findByKey(orderKey, { companyId: a.companyId })).toEqual({ id: dePedido.id, orderId })
      expect(await repo.findByKey(directKey, { companyId: b.companyId })).toBeNull()
      expect(await repo.findByKey(randomUUID(), { companyId: a.companyId })).toBeNull()
    })
  })

  it('R38: findByKey de la entrega de pedido devuelve orderId nulo con la clave de una entrega sin pedido', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await createTenant(tx, 'A')
      const productId = await createFinished(tx, a)
      const key = randomUUID()
      const directa = await createDirectDeliveryRepository(tx).create(newDirect(a, productId, key), { companyId: a.companyId })
      if (directa.kind !== 'created') throw new Error('se esperaba una entrega sin pedido')

      expect(await createOrderDeliveryRepository(tx).findByKey(key, { companyId: a.companyId })).toEqual({
        id: directa.id,
        orderId: null,
      })
    })
  })

  it('R36, R40: addLines guarda las lineas con su cliente, lote, envases y cantidad, sin linea del reparto', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await createTenant(tx, 'A')
      const productId = await createFinished(tx, a)
      const lote1 = await createBatch(tx, a, productId)
      const lote2 = await createBatch(tx, a, productId)
      const repo = createDirectDeliveryRepository(tx)
      const scope = { companyId: a.companyId }
      const outcome = await repo.create(newDirect(a, productId), scope)
      if (outcome.kind !== 'created') throw new Error('se esperaba una entrega sin pedido')

      await repo.addLines(
        outcome.id,
        [
          { customerId: a.customerId, batchId: lote1, packages: 2, quantity: '10.0000' },
          { customerId: a.customerId, batchId: lote2, packages: 1, quantity: '4.5000' },
        ],
        scope,
      )
      await repo.addLines(outcome.id, [], scope)

      const filas = await tx.orderDeliveryLine.findMany({ where: { deliveryId: outcome.id }, orderBy: { packages: 'desc' } })
      expect(filas.map((f) => [f.companyId, f.customerId, f.orderPresentationLineId, f.batchId, f.packages, f.quantity.toFixed(4)])).toEqual([
        [a.companyId, a.customerId, null, lote1, 2, '10.0000'],
        [a.companyId, a.customerId, null, lote2, 1, '4.5000'],
      ])
    })
  })
})

describe('WaitingOrdersReader contra Postgres real', () => {
  it('R9: solo cuentan los pedidos vivos de la empresa en TERMINADO de esa receta y presentacion, con lo anulado otra vez pendiente', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await createTenant(tx, 'A')
      const b = await createTenant(tx, 'B')
      const otraReceta = await createRecipe(tx, a.companyId)
      const otraPresentacion = await createPresentation(tx, a.companyId, a.unitId)
      const productId = await createFinished(tx, a)
      const lote1 = await createBatch(tx, a, productId)
      const lote2 = await createBatch(tx, a, productId)
      const lote3 = await createBatch(tx, a, productId)

      // El que cuenta: 10 envases planificados, 8 contados; 3 entregados y 2 entregados y anulados.
      const vale = await createOrder(tx, a, { lines: [{ presentationId: a.presentationId, packages: 10, packedPackages: 8 }] })
      const valeLinea = vale.lineIds[0] as string
      await deliverOrder(tx, a, vale.orderId, [{ presentationLineId: valeLinea, batchId: lote1, packages: 3 }])
      const anulada = await deliverOrder(tx, a, vale.orderId, [{ presentationLineId: valeLinea, batchId: lote2, packages: 2 }])
      await voidDeliveryLines(tx, a, anulada.deliveryId, anulada.lineIds)
      // Otro que cuenta, sin entregas ni conteo.
      const vale2 = await createOrder(tx, a, { lines: [{ presentationId: a.presentationId, packages: 4 }] })
      // Los que no cuentan.
      await createOrder(tx, a, { recipeId: otraReceta, lines: [{ presentationId: a.presentationId, packages: 5 }] })
      const otraPres = await createOrder(tx, a, { lines: [{ presentationId: otraPresentacion, packages: 6 }] })
      await deliverOrder(tx, a, otraPres.orderId, [{ presentationLineId: otraPres.lineIds[0] as string, batchId: lote3, packages: 1 }])
      await createOrder(tx, a, { status: 'EN_ACONDICIONAMIENTO', lines: [{ presentationId: a.presentationId, packages: 7 }] })
      await createOrder(tx, a, { status: 'ENTREGADO', lines: [{ presentationId: a.presentationId, packages: 7 }] })
      // La base no admite un pedido TERMINADO borrado (`orders_delivered_not_deleted`): el borrado
      // posible es uno anterior al empaque.
      await createOrder(tx, a, {
        status: 'PENDIENTE',
        deletedAt: new Date('2026-10-10T00:00:00Z'),
        lines: [{ presentationId: a.presentationId, packages: 9 }],
      })
      const recetaB = await createRecipe(tx, b.companyId)
      await createOrder(tx, b, { recipeId: recetaB, lines: [{ presentationId: b.presentationId, packages: 3 }] })

      const filas = await createWaitingOrdersReader(tx).listWaitingLines(
        [{ recipeId: a.recipeId, presentationId: a.presentationId }],
        { companyId: a.companyId },
      )

      expect(filas).toEqual([
        {
          orderId: vale.orderId,
          numberText: formatOrderNumber({ year: ANIO, sequence: vale.sequence }),
          orderedPackages: 8,
          deliveredPackages: 3,
          recipeId: a.recipeId,
          presentationId: a.presentationId,
        },
        {
          orderId: vale2.orderId,
          numberText: formatOrderNumber({ year: ANIO, sequence: vale2.sequence }),
          orderedPackages: 4,
          deliveredPackages: 0,
          recipeId: a.recipeId,
          presentationId: a.presentationId,
        },
      ])
    })
  })

  it('R9: varios pares en una sola consulta; cada linea trae su par', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await createTenant(tx, 'A')
      const otraPresentacion = await createPresentation(tx, a.companyId, a.unitId)
      const uno = await createOrder(tx, a, { lines: [{ presentationId: a.presentationId, packages: 2 }] })
      const dos = await createOrder(tx, a, { lines: [{ presentationId: otraPresentacion, packages: 3 }] })
      const findMany = vi.spyOn(tx.orderPresentationLine, 'findMany')

      try {
        const filas = await createWaitingOrdersReader(tx).listWaitingLines(
          [
            { recipeId: a.recipeId, presentationId: a.presentationId },
            { recipeId: a.recipeId, presentationId: otraPresentacion },
          ],
          { companyId: a.companyId },
        )

        expect(findMany).toHaveBeenCalledTimes(1)
        expect(filas.map((f) => [f.orderId, f.presentationId, f.orderedPackages])).toEqual([
          [uno.orderId, a.presentationId, 2],
          [dos.orderId, otraPresentacion, 3],
        ])
      } finally {
        findMany.mockRestore()
      }
    })
  })

  it('R9: con el ambito de B no ve los pedidos de A aunque se pida su par; B ve los suyos', async () => {
    await inRolledBackTransaction(async (tx) => {
      const a = await createTenant(tx, 'A')
      const b = await createTenant(tx, 'B')
      await createOrder(tx, a, { lines: [{ presentationId: a.presentationId, packages: 2 }] })
      const deB = await createOrder(tx, b, { lines: [{ presentationId: b.presentationId, packages: 5 }] })
      const reader = createWaitingOrdersReader(tx)

      expect(
        await reader.listWaitingLines([{ recipeId: a.recipeId, presentationId: a.presentationId }], { companyId: b.companyId }),
      ).toEqual([])
      expect(
        (await reader.listWaitingLines([{ recipeId: b.recipeId, presentationId: b.presentationId }], { companyId: b.companyId })).map(
          (f) => f.orderId,
        ),
      ).toEqual([deB.orderId])
    })
  })

  it('R9: sin pares devuelve vacio sin consultar', async () => {
    await inRolledBackTransaction(async (tx) => {
      const findMany = vi.spyOn(tx.orderPresentationLine, 'findMany')
      try {
        expect(await createWaitingOrdersReader(tx).listWaitingLines([], { companyId: randomUUID() })).toEqual([])
        expect(findMany).not.toHaveBeenCalled()
      } finally {
        findMany.mockRestore()
      }
    })
  })
})
