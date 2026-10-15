/**
 * `recordPackedCounts` y la lectura de `packed_packages` de `findPresentationLinesForFinish`,
 * contra Postgres REAL, y los CHECK de las columnas del conteo.
 *
 * AISLAMIENTO: cada `it` corre en una transaccion que siempre termina en `ROLLBACK`; el
 * adaptador recibe ese `tx`, igual que dentro de `OrderUnitOfWork`. Lo que se espera que la base
 * rechace va con `$executeRaw` dentro de un SAVEPOINT: solo el SQL crudo deja el SQLSTATE en
 * `meta.code`, y el SAVEPOINT permite seguir afirmando despues del rechazo.
 */
import { randomUUID } from 'node:crypto'

import { Prisma } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'

import { normalizeCompanyName } from '@/lib/modules/identity'
import { createOrderWriteRepository } from '@/lib/modules/pedidos/adapters/driven/persistence/order-prisma'
import { prisma } from '@/lib/shared/db/prisma'

import type { PackedLineCount } from '@/lib/modules/pedidos'

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
      { maxWait: 10_000, timeout: 30_000 },
    )
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error
  }
}

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
  const savepoint = `sp_packed_${String(savepointSeq)}`
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

let nextSequence = 760_000
function freshSequence(): number {
  nextSequence += 1
  return nextSequence
}

type Company = {
  readonly companyId: string
  readonly recipeId: string
  readonly unitId: string
}

async function seedCompany(tx: Prisma.TransactionClient, label: string): Promise<Company> {
  const marca = token()
  const name = `Empresa ${label} ${marca}`
  const company = await tx.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name) },
    select: { id: true },
  })
  const recipe = await tx.recipe.create({
    data: { name: `Receta ${marca}`, nameNormalized: `receta${marca}`, companyId: company.id },
    select: { id: true },
  })
  const unit = await tx.unit.create({
    data: { name: `unidad ${marca}`, nameNormalized: `unidad${marca}`, symbol: `u${marca}` },
    select: { id: true },
  })
  return { companyId: company.id, recipeId: recipe.id, unitId: unit.id }
}

async function seedOrder(tx: Prisma.TransactionClient, company: Company): Promise<string> {
  const order = await tx.order.create({
    data: {
      companyId: company.companyId,
      orderYear: new Date().getUTCFullYear(),
      orderSequence: freshSequence(),
      recipeId: company.recipeId,
      quantity: new Prisma.Decimal('100'),
    },
    select: { id: true },
  })
  return order.id
}

async function seedLine(
  tx: Prisma.TransactionClient,
  company: Company,
  orderId: string,
  packages: number,
): Promise<string> {
  const nombre = `Presentacion ${token()}`
  const presentation = await tx.presentation.create({
    data: {
      name: nombre,
      nameNormalized: nombre.toLowerCase().replace(/[^a-z0-9]/gu, ''),
      unitId: company.unitId,
      companyId: company.companyId,
      content: '1',
    },
    select: { id: true },
  })
  const line = await tx.orderPresentationLine.create({
    data: {
      orderId,
      companyId: company.companyId,
      presentationId: presentation.id,
      packages,
      presentationContent: '1',
    },
    select: { id: true },
  })
  return line.id
}

type StoredCount = {
  readonly packages: number
  readonly packedPackages: number | null
  readonly packedReason: string | null
  readonly packedReasonOther: string | null
}

async function storedCount(tx: Prisma.TransactionClient, lineId: string): Promise<StoredCount> {
  return tx.orderPresentationLine.findUniqueOrThrow({
    where: { id: lineId },
    select: { packages: true, packedPackages: true, packedReason: true, packedReasonOther: true },
  })
}

const SIN_CONTAR: Omit<StoredCount, 'packages'> = { packedPackages: null, packedReason: null, packedReasonOther: null }

function count(lineId: string, packedPackages: number, reason: PackedLineCount['reason'] = null, reasonOther: string | null = null): PackedLineCount {
  return { lineId, packedPackages, reason, reasonOther }
}

/** `UPDATE` a mano, sin pasar por el dominio: lo unico que puede frenarlo son los CHECK. */
function rawSetCount(
  tx: Prisma.TransactionClient,
  lineId: string,
  packed: number,
  reason: string | null,
  reasonOther: string | null,
): Promise<number> {
  return tx.$executeRaw(Prisma.sql`
    UPDATE "order_presentation_lines"
       SET "packed_packages" = ${packed}::integer,
           "packed_reason" = ${reason}::text,
           "packed_reason_other" = ${reasonOther}::text
     WHERE "id" = ${lineId}::uuid
  `)
}

afterAll(async () => {
  await prisma.$disconnect()
})

describe('recordPackedCounts — escribe el conteo en las lineas del pedido', () => {
  it('R16: guarda envases reales, motivo y texto de «Otro» recortado; el plan (packages) no cambia', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx, 'propia')
      const orderId = await seedOrder(tx, empresa)
      const igual = await seedLine(tx, empresa, orderId, 4)
      const menos = await seedLine(tx, empresa, orderId, 10)
      const mas = await seedLine(tx, empresa, orderId, 2)
      const repo = createOrderWriteRepository(tx)

      await repo.recordPackedCounts(
        orderId,
        [count(igual, 4), count(menos, 7, 'rotura'), count(mas, 3, 'otro', '  sobraron del lote anterior  ')],
        { companyId: empresa.companyId },
      )

      expect(await storedCount(tx, igual)).toEqual({ packages: 4, packedPackages: 4, packedReason: null, packedReasonOther: null })
      expect(await storedCount(tx, menos)).toEqual({ packages: 10, packedPackages: 7, packedReason: 'rotura', packedReasonOther: null })
      expect(await storedCount(tx, mas)).toEqual({
        packages: 2,
        packedPackages: 3,
        packedReason: 'otro',
        packedReasonOther: 'sobraron del lote anterior',
      })
    })
  })

  it('R16: una linea en 0 se guarda como 0, no como sin contar', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx, 'propia')
      const orderId = await seedOrder(tx, empresa)
      const linea = await seedLine(tx, empresa, orderId, 5)

      await createOrderWriteRepository(tx).recordPackedCounts(orderId, [count(linea, 0, 'merma')], {
        companyId: empresa.companyId,
      })

      expect(await storedCount(tx, linea)).toEqual({ packages: 5, packedPackages: 0, packedReason: 'merma', packedReasonOther: null })
    })
  })

  it('R16: findPresentationLinesForFinish devuelve packedPackages null antes de contar y el conteo despues', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx, 'propia')
      const orderId = await seedOrder(tx, empresa)
      const linea = await seedLine(tx, empresa, orderId, 6)
      const repo = createOrderWriteRepository(tx)
      const scope = { companyId: empresa.companyId }

      expect((await repo.findPresentationLinesForFinish(orderId, scope)).map((l) => [l.id, l.packages, l.packedPackages])).toEqual([
        [linea, 6, null],
      ])

      await repo.recordPackedCounts(orderId, [count(linea, 5, 'conteo_fisico')], scope)

      expect((await repo.findPresentationLinesForFinish(orderId, scope)).map((l) => [l.id, l.packages, l.packedPackages])).toEqual([
        [linea, 6, 5],
      ])
    })
  })
})

describe('recordPackedCounts — ambito de pedido y empresa', () => {
  it('R29: una linea de OTRO pedido de la misma empresa no se escribe aunque venga en los conteos', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx, 'propia')
      const orderId = await seedOrder(tx, empresa)
      const otroPedido = await seedOrder(tx, empresa)
      const propia = await seedLine(tx, empresa, orderId, 3)
      const ajena = await seedLine(tx, empresa, otroPedido, 3)

      await createOrderWriteRepository(tx).recordPackedCounts(
        orderId,
        [count(propia, 2, 'merma'), count(ajena, 1, 'merma')],
        { companyId: empresa.companyId },
      )

      expect(await storedCount(tx, propia)).toEqual({ packages: 3, packedPackages: 2, packedReason: 'merma', packedReasonOther: null })
      expect(await storedCount(tx, ajena)).toEqual({ packages: 3, ...SIN_CONTAR })
    })
  })

  it('R29: una linea de OTRA empresa no se escribe aunque venga en los conteos', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx, 'propia')
      const otraEmpresa = await seedCompany(tx, 'ajena')
      const orderId = await seedOrder(tx, empresa)
      const pedidoAjeno = await seedOrder(tx, otraEmpresa)
      const propia = await seedLine(tx, empresa, orderId, 3)
      const ajena = await seedLine(tx, otraEmpresa, pedidoAjeno, 3)

      await createOrderWriteRepository(tx).recordPackedCounts(
        orderId,
        [count(propia, 3), count(ajena, 0, 'rotura')],
        { companyId: empresa.companyId },
      )

      expect(await storedCount(tx, propia)).toEqual({ packages: 3, packedPackages: 3, packedReason: null, packedReasonOther: null })
      expect(await storedCount(tx, ajena)).toEqual({ packages: 3, ...SIN_CONTAR })
    })
  })

  it('R29: con el ambito de otra empresa no se escribe ninguna linea del pedido', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx, 'propia')
      const otraEmpresa = await seedCompany(tx, 'ajena')
      const orderId = await seedOrder(tx, empresa)
      const linea = await seedLine(tx, empresa, orderId, 4)

      await createOrderWriteRepository(tx).recordPackedCounts(orderId, [count(linea, 2, 'rotura')], {
        companyId: otraEmpresa.companyId,
      })

      expect(await storedCount(tx, linea)).toEqual({ packages: 4, ...SIN_CONTAR })
      expect(
        await createOrderWriteRepository(tx).findPresentationLinesForFinish(orderId, { companyId: otraEmpresa.companyId }),
      ).toEqual([])
    })
  })
})

describe('CHECK de las columnas del conteo, con UPDATE escrito a mano', () => {
  it('R16: rechaza un motivo incoherente con el conteo', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx, 'propia')
      const orderId = await seedOrder(tx, empresa)
      const linea = await seedLine(tx, empresa, orderId, 5)

      const casos: ReadonlyArray<readonly [string, number, string | null, string | null]> = [
        ['menos sin motivo', 4, null, null],
        ['igual con motivo', 5, 'rotura', null],
        ['mas con merma', 6, 'merma', null],
        ['mas con rotura', 6, 'rotura', null],
        ['motivo fuera del catalogo', 4, 'robo', null],
        ['negativo', -1, 'merma', null],
        ['texto de otro sin motivo otro', 4, 'merma', 'texto'],
        ['otro sin texto', 4, 'otro', null],
        ['otro con solo espacios', 4, 'otro', '   '],
      ]
      for (const [que, packed, reason, other] of casos) {
        expect(await expectRejectedByDatabase(tx, () => rawSetCount(tx, linea, packed, reason, other), que), que).toBe(
          CHECK_VIOLATION,
        )
      }
      expect(await storedCount(tx, linea)).toEqual({ packages: 5, ...SIN_CONTAR })

      expect(await rawSetCount(tx, linea, 6, 'conteo_fisico', null)).toBe(1)
    })
  })

  it('R16: rechaza un texto de «Otro» de 201 caracteres y acepta uno de 200', async () => {
    await inRolledBackTransaction(async (tx) => {
      const empresa = await seedCompany(tx, 'propia')
      const orderId = await seedOrder(tx, empresa)
      const linea = await seedLine(tx, empresa, orderId, 5)

      expect(
        await expectRejectedByDatabase(tx, () => rawSetCount(tx, linea, 4, 'otro', 'x'.repeat(201)), 'otro de 201'),
      ).toBe(CHECK_VIOLATION)
      expect(await storedCount(tx, linea)).toEqual({ packages: 5, ...SIN_CONTAR })

      expect(await rawSetCount(tx, linea, 4, 'otro', 'x'.repeat(200))).toBe(1)
      expect((await storedCount(tx, linea)).packedReasonOther).toHaveLength(200)
    })
  })
})
