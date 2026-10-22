/**
 * `*_conditioning_steps` contra Postgres real: el UP deja toda receta existente con
 * `conditioning_steps = []` y sus `steps` y `packing_steps` intactos; el DOWN quita las dos columnas,
 * los tres CHECK y el indice, y nada mas. Ademas, lo que la base HACE con las anotaciones de pasos
 * de acondicionamiento: los CHECK de responsables y posicion y el indice de «un paso, una vez».
 *
 * AISLAMIENTO: cada `it` corre en una transaccion interactiva que termina en `RollbackSignal`. Los
 * casos de migracion aplican el `down.sql` y el `migration.sql` reales dentro de la transaccion;
 * Postgres deshace tambien ese DDL. Cada operacion que se espera rechazada va en un SAVEPOINT. Las
 * filas se escriben con SQL crudo: sin las columnas el cliente Prisma no puede escribir `recipes`, y
 * solo asi llega el SQLSTATE en `meta.code` (se afirma sobre el SQLSTATE, nunca sobre el texto).
 */
import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Prisma } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'

import { normalizeCompanyName } from '@/lib/modules/identity'
import { normalizeRecipeName } from '@/lib/modules/recetas'
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
      { maxWait: 20_000, timeout: 60_000 },
    )
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error
  }
}

function findRepoRoot(startDir: string): string {
  let dir = startDir
  for (;;) {
    try {
      readFileSync(join(dir, 'package.json'))
      return dir
    } catch {
      const parent = dirname(dir)
      if (parent === dir) throw new Error(`no se encontro package.json subiendo desde ${startDir}`)
      dir = parent
    }
  }
}

const migrationsDir = join(findRepoRoot(dirname(fileURLToPath(import.meta.url))), 'db', 'migrations')
const migrationDir = join(
  migrationsDir,
  readdirSync(migrationsDir).find((name) => name.endsWith('_conditioning_steps')) ?? 'missing',
)
const upSource = readFileSync(join(migrationDir, 'migration.sql'), 'utf8')
const downSource = readFileSync(join(migrationDir, 'down.sql'), 'utf8')

/** `$executeRawUnsafe` manda una sola sentencia por llamada: el archivo se parte por `;`. */
function statementsOf(source: string): string[] {
  return source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
}

async function runSql(tx: Prisma.TransactionClient, source: string): Promise<void> {
  for (const statement of statementsOf(source)) {
    await tx.$executeRawUnsafe(statement)
  }
}

const CHECK_VIOLATION = '23514'
const UNIQUE_VIOLATION = '23505'

const NEW_CONSTRAINTS = [
  'order_execution_entries_conditioning_step_has_position',
  'order_execution_entries_responsibles_matches_action',
  'order_execution_entries_responsibles_non_empty_array',
] as const
const NEW_INDEX = 'order_execution_entries_conditioning_step_once'

const OPERATOR_STEPS = [
  { blocks: [{ kind: 'paragraph', spans: [{ text: 'Mezclar en frio', marks: ['bold'] }] }] },
  { blocks: [{ kind: 'checklist', items: [{ spans: [{ text: 'Guantes puestos' }] }] }] },
]
const PACKING_STEPS = [{ blocks: [{ kind: 'paragraph', spans: [{ text: 'Envasar en garrafas de 5 L' }] }] }]
const CONDITIONING_STEPS = [{ blocks: [{ kind: 'paragraph', spans: [{ text: 'Etiquetar cada garrafa' }] }] }]

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
  const savepoint = `sp_conditioning_steps_${String(savepointSeq)}`
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

async function seedCompany(tx: Prisma.TransactionClient): Promise<string> {
  const name = `Empresa acondicionamiento ${token()}`
  const company = await tx.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name) },
    select: { id: true },
  })
  return company.id
}

/** Original, version y receta dada de baja, escritas sin nombrar `conditioning_steps`. */
async function insertRecipes(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
  const insert = async (name: string, parentId: string | null, deleted: boolean): Promise<string> => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO "recipes" ("name", "name_normalized", "description", "steps", "packing_steps",
                             "company_id", "updated_at", "deleted_at", "parent_recipe_id")
      VALUES (${name}, ${normalizeRecipeName(name)}, 'Base', ${JSON.stringify(OPERATOR_STEPS)}::jsonb,
              ${JSON.stringify(PACKING_STEPS)}::jsonb, ${companyId}::uuid, now(),
              ${deleted ? new Date() : null}::timestamptz, ${parentId}::uuid)
      RETURNING "id"::text AS "id"`
    const id = rows[0]?.id
    if (id === undefined) throw new Error('el INSERT no devolvio id')
    return id
  }
  const originalId = await insert(`Crema ${token()}`, null, false)
  await insert(`Crema version ${token()}`, originalId, false)
  await insert(`Crema baja ${token()}`, null, true)
  return originalId
}

async function createUser(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
  const marca = token()
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
  return user.id
}

let nextSequence = 870_000

async function createOrder(tx: Prisma.TransactionClient, companyId: string, recipeId: string): Promise<string> {
  nextSequence += 1
  const order = await tx.order.create({
    data: {
      companyId,
      orderYear: new Date().getUTCFullYear(),
      orderSequence: nextSequence,
      recipeId,
      quantity: new Prisma.Decimal('10'),
    },
    select: { id: true },
  })
  return order.id
}

interface Fixture {
  readonly companyId: string
  readonly orderId: string
  readonly otherOrderId: string
  readonly userId: string
}

async function seedFixture(tx: Prisma.TransactionClient): Promise<Fixture> {
  const companyId = await seedCompany(tx)
  const recipeId = await insertRecipes(tx, companyId)
  const userId = await createUser(tx, companyId)
  return {
    companyId,
    orderId: await createOrder(tx, companyId, recipeId),
    otherOrderId: await createOrder(tx, companyId, recipeId),
    userId,
  }
}

interface EntryValues {
  readonly orderId?: string
  readonly action: string
  readonly stepPosition: number | null
  /** `undefined` = columna nula; cualquier otro valor se escribe como JSON. */
  readonly responsibles?: unknown
}

function rawInsertEntry(tx: Prisma.TransactionClient, f: Fixture, v: EntryValues): Promise<number> {
  const responsibles = v.responsibles === undefined ? null : JSON.stringify(v.responsibles)
  return tx.$executeRaw`
    INSERT INTO "order_execution_entries"
      ("company_id", "order_id", "user_id", "action", "step_position", "responsible_user_ids", "occurred_at")
    VALUES (
      CAST(${f.companyId} AS uuid),
      CAST(${v.orderId ?? f.orderId} AS uuid),
      CAST(${f.userId} AS uuid),
      CAST(${v.action} AS "OrderExecutionAction"),
      CAST(${v.stepPosition} AS integer),
      CAST(${responsibles} AS jsonb),
      CURRENT_TIMESTAMP
    )`
}

/** Cada receta de la empresa como JSON completo, sin la columna nueva, ordenada por id. */
async function recipesWithoutConditioningSteps(
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<unknown[]> {
  const rows = await tx.$queryRaw<{ row: unknown }[]>`
    SELECT to_jsonb(r) - 'conditioning_steps' AS "row" FROM "recipes" r
     WHERE r."company_id" = ${companyId}::uuid ORDER BY r."id"`
  return rows.map((r) => r.row)
}

async function entriesWithoutResponsibles(tx: Prisma.TransactionClient, companyId: string): Promise<unknown[]> {
  const rows = await tx.$queryRaw<{ row: unknown }[]>`
    SELECT to_jsonb(e) - 'responsible_user_ids' AS "row" FROM "order_execution_entries" e
     WHERE e."company_id" = ${companyId}::uuid ORDER BY e."id"`
  return rows.map((r) => r.row)
}

interface Shape {
  readonly recipeColumns: string[]
  readonly entryColumns: string[]
  readonly entryConstraints: string[]
  readonly entryIndexes: string[]
  readonly enums: string[]
}

async function shapeOf(tx: Prisma.TransactionClient): Promise<Shape> {
  const columns = async (table: string): Promise<string[]> => {
    const rows = await tx.$queryRaw<{ name: string }[]>`
      SELECT column_name AS "name" FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = ${table} ORDER BY column_name`
    return rows.map((r) => r.name)
  }
  const constraints = await tx.$queryRaw<{ name: string }[]>`
    SELECT conname AS "name" FROM pg_constraint
     WHERE conrelid = '"order_execution_entries"'::regclass ORDER BY conname`
  const indexes = await tx.$queryRaw<{ name: string }[]>`
    SELECT indexname AS "name" FROM pg_indexes
     WHERE schemaname = current_schema() AND tablename = 'order_execution_entries' ORDER BY indexname`
  const enums = await tx.$queryRaw<{ name: string }[]>`
    SELECT t.typname || '.' || e.enumlabel AS "name" FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname IN ('OrderExecutionAction', 'evidence_phase') ORDER BY 1`
  return {
    recipeColumns: await columns('recipes'),
    entryColumns: await columns('order_execution_entries'),
    entryConstraints: constraints.map((r) => r.name),
    entryIndexes: indexes.map((r) => r.name),
    enums: enums.map((r) => r.name),
  }
}

afterAll(async () => {
  await prisma.$disconnect()
})

describe('migracion conditioning_steps', () => {
  it('R1: el UP deja conditioning_steps = [] en toda receta existente y steps y packing_steps sin cambios', async () => {
    await inRolledBackTransaction(async (tx) => {
      await runSql(tx, downSource)
      const companyId = await seedCompany(tx)
      await insertRecipes(tx, companyId)
      const before = await recipesWithoutConditioningSteps(tx, companyId)
      expect(before).toHaveLength(3)

      await runSql(tx, upSource)

      const rows = await tx.$queryRaw<{ conditioning_steps: unknown; packing_steps: unknown; steps: unknown }[]>`
        SELECT "conditioning_steps", "packing_steps", "steps" FROM "recipes"
         WHERE "company_id" = ${companyId}::uuid`
      expect(rows).toHaveLength(3)
      for (const row of rows) {
        expect(row.conditioning_steps).toEqual([])
        expect(row.steps).toEqual(OPERATOR_STEPS)
        expect(row.packing_steps).toEqual(PACKING_STEPS)
      }
      expect(await recipesWithoutConditioningSteps(tx, companyId)).toEqual(before)
    })
  })

  it('R1: el DOWN quita las dos columnas, los tres CHECK y el indice, y deja intacto lo demas', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seedFixture(tx)
      await tx.$executeRaw`
        UPDATE "recipes" SET "conditioning_steps" = ${JSON.stringify(CONDITIONING_STEPS)}::jsonb
         WHERE "company_id" = ${f.companyId}::uuid`
      await rawInsertEntry(tx, f, { action: 'START', stepPosition: 1 })
      await rawInsertEntry(tx, f, { action: 'CONDITIONING_START', stepPosition: null })
      const shapeBefore = await shapeOf(tx)
      expect(shapeBefore.recipeColumns).toContain('conditioning_steps')
      expect(shapeBefore.entryColumns).toContain('responsible_user_ids')
      expect(shapeBefore.entryConstraints).toEqual(expect.arrayContaining([...NEW_CONSTRAINTS]))
      expect(shapeBefore.entryIndexes).toContain(NEW_INDEX)
      const recipesBefore = await recipesWithoutConditioningSteps(tx, f.companyId)
      const entriesBefore = await entriesWithoutResponsibles(tx, f.companyId)

      await runSql(tx, downSource)

      const shapeAfter = await shapeOf(tx)
      expect(shapeAfter.recipeColumns).toEqual(
        shapeBefore.recipeColumns.filter((name) => name !== 'conditioning_steps'),
      )
      expect(shapeAfter.entryColumns).toEqual(
        shapeBefore.entryColumns.filter((name) => name !== 'responsible_user_ids'),
      )
      expect(shapeAfter.entryConstraints).toEqual(
        shapeBefore.entryConstraints.filter((name) => !(NEW_CONSTRAINTS as readonly string[]).includes(name)),
      )
      expect(shapeAfter.entryIndexes).toEqual(shapeBefore.entryIndexes.filter((name) => name !== NEW_INDEX))
      // Los valores de los enums son de la otra migracion: este DOWN no los toca.
      expect(shapeAfter.enums).toEqual(shapeBefore.enums)
      expect(await recipesWithoutConditioningSteps(tx, f.companyId)).toEqual(recipesBefore)
      expect(await entriesWithoutResponsibles(tx, f.companyId)).toEqual(entriesBefore)
    })
  })
})

describe('order_execution_entries — anotaciones de pasos de acondicionamiento', () => {
  it('R27: rechaza responsables en una accion que no es de pasos de acondicionamiento, con 23514', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seedFixture(tx)
      for (const action of ['ADVANCE', 'CONDITIONING_START', 'CONDITIONING_FINISH']) {
        const estado = await expectRejectedByDatabase(
          tx,
          () => rawInsertEntry(tx, f, { action, stepPosition: action === 'ADVANCE' ? 1 : null, responsibles: [f.userId] }),
          `${action} con responsables`,
        )
        expect(estado, action).toBe(CHECK_VIOLATION)
      }
    })
  })

  it('R27: rechaza una lista de responsables vacia o que no es lista, con 23514', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seedFixture(tx)
      for (const responsibles of [[], { id: f.userId }]) {
        const estado = await expectRejectedByDatabase(
          tx,
          () => rawInsertEntry(tx, f, { action: 'CONDITIONING_STEP_ADVANCE', stepPosition: 1, responsibles }),
          `responsables ${JSON.stringify(responsibles)}`,
        )
        expect(estado).toBe(CHECK_VIOLATION)
      }
    })
  })

  it('R27: rechaza el cambio de responsables sin responsables, con 23514', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seedFixture(tx)
      const estado = await expectRejectedByDatabase(
        tx,
        () => rawInsertEntry(tx, f, { action: 'CONDITIONING_RESPONSIBLES_CHANGE', stepPosition: 1 }),
        'cambio de responsables sin responsables',
      )
      expect(estado).toBe(CHECK_VIOLATION)
    })
  })

  it('R27: rechaza las tres anotaciones de paso sin posicion, con 23514', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seedFixture(tx)
      for (const action of ['CONDITIONING_STEP_ADVANCE', 'CONDITIONING_STEPS_COMPLETE', 'CONDITIONING_RESPONSIBLES_CHANGE']) {
        const estado = await expectRejectedByDatabase(
          tx,
          () => rawInsertEntry(tx, f, { action, stepPosition: null, responsibles: [f.userId] }),
          `${action} sin posicion`,
        )
        expect(estado, action).toBe(CHECK_VIOLATION)
      }
    })
  })

  it('R27: acepta las tres anotaciones de paso con posicion, con y sin responsables donde se permite', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seedFixture(tx)
      expect(await rawInsertEntry(tx, f, { action: 'CONDITIONING_STEP_ADVANCE', stepPosition: 1 })).toBe(1)
      expect(
        await rawInsertEntry(tx, f, { action: 'CONDITIONING_STEP_ADVANCE', stepPosition: 2, responsibles: [f.userId] }),
      ).toBe(1)
      expect(
        await rawInsertEntry(tx, f, { action: 'CONDITIONING_RESPONSIBLES_CHANGE', stepPosition: 1, responsibles: [f.userId] }),
      ).toBe(1)
      expect(await rawInsertEntry(tx, f, { action: 'CONDITIONING_STEPS_COMPLETE', stepPosition: 3 })).toBe(1)
    })
  })

  it('R27: el indice rechaza completar dos veces la misma posicion del mismo pedido, con 23505', async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await seedFixture(tx)
      expect(await rawInsertEntry(tx, f, { action: 'CONDITIONING_STEP_ADVANCE', stepPosition: 1 })).toBe(1)

      for (const action of ['CONDITIONING_STEP_ADVANCE', 'CONDITIONING_STEPS_COMPLETE']) {
        const estado = await expectRejectedByDatabase(
          tx,
          () => rawInsertEntry(tx, f, { action, stepPosition: 1 }),
          `${action} repetido en la posicion 1`,
        )
        expect(estado, action).toBe(UNIQUE_VIOLATION)
      }

      // El cambio de responsables no completa: se puede repetir sobre un paso ya completado.
      for (let i = 0; i < 2; i += 1) {
        expect(
          await rawInsertEntry(tx, f, { action: 'CONDITIONING_RESPONSIBLES_CHANGE', stepPosition: 1, responsibles: [f.userId] }),
        ).toBe(1)
      }
      // La misma posicion en otro pedido es otro paso.
      expect(
        await rawInsertEntry(tx, f, { orderId: f.otherOrderId, action: 'CONDITIONING_STEP_ADVANCE', stepPosition: 1 }),
      ).toBe(1)
    })
  })
})
