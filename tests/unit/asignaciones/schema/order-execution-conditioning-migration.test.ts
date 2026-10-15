// Contrato estatico del SQL de las dos migraciones del acondicionamiento en el registro de
// ejecucion. Cada predicado se aplica al SQL real y a una version mutada en memoria, que tiene que
// reprobarlo. Lo que la base hace con esas restricciones lo prueba el test de integracion.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

function findRepoRoot(startDir: string): string {
  let dir = startDir
  for (;;) {
    if (existsSync(join(dir, 'package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no se encontro package.json subiendo desde ${startDir}`)
    dir = parent
  }
}

const ACTIONS_MIGRATION = '20261015120000_order_execution_conditioning_actions'
const BATCH_LINES_MIGRATION = '20261015120100_order_execution_batch_lines'
const ORIGINAL_MIGRATION = '20261006180000_order_execution_entries'
const TABLE = 'order_execution_entries'
const ENUM_TYPE = 'OrderExecutionAction'
const NEW_VALUES = ['CONDITIONING_START', 'CONDITIONING_BATCH_SAVE', 'CONDITIONING_FINISH'] as const
const ORIGINAL_VALUES = ['START', 'RESUME', 'ADVANCE', 'GO_BACK', 'CANCEL', 'FINISH', 'PACK_START', 'PACK_FINISH']

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)))
const migrationsRoot = join(repoRoot, 'db', 'migrations')

function read(migration: string, file: 'migration.sql' | 'down.sql'): string {
  return readFileSync(join(migrationsRoot, migration, file), 'utf8')
}

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}

const DO_BLOCK = /DO \$\$[\s\S]*?END \$\$;?/g

/** Sentencias normalizadas; un bloque `DO $$ ... $$` cuenta como una sola. */
function statements(sql: string): readonly string[] {
  const code = stripSqlComments(sql)
  const blocks = [...code.matchAll(DO_BLOCK)].map((m) => m[0].replace(/;$/, ''))
  const rest = code.replace(DO_BLOCK, ';__DO_BLOCK__;')
  let next = 0
  return rest
    .split(';')
    .map((statement) => statement.replace(/\s+/g, ' ').trim())
    .filter((statement) => statement.length > 0)
    .map((statement) => (statement === '__DO_BLOCK__' ? (blocks[next++] ?? '').replace(/\s+/g, ' ').trim() : statement))
}

const actionsUpSource = read(ACTIONS_MIGRATION, 'migration.sql')
const actionsDownSource = read(ACTIONS_MIGRATION, 'down.sql')
const batchUpSource = read(BATCH_LINES_MIGRATION, 'migration.sql')
const batchDownSource = read(BATCH_LINES_MIGRATION, 'down.sql')
const originalUp = statements(read(ORIGINAL_MIGRATION, 'migration.sql'))

const actionsUp = statements(actionsUpSource)
const actionsDown = statements(actionsDownSource)
const batchUp = statements(batchUpSource)
const batchDown = statements(batchDownSource)

function checkBody(source: readonly string[], constraint: string): string | undefined {
  const statement = source.find((s) =>
    new RegExp(`^ALTER TABLE "${TABLE}" ADD CONSTRAINT "${constraint}" CHECK`, 'i').test(s),
  )
  if (statement === undefined) return undefined
  return statement.slice(statement.search(/CHECK/i)).replace(/\s+/g, '')
}

function enumValuesOf(statement: string): readonly string[] {
  const body = /AS ENUM \((.*)\)$/i.exec(statement)?.[1] ?? ''
  return [...body.matchAll(/'([^']*)'/g)].map((match) => match[1] as string)
}

function mutate(source: readonly string[], from: string | RegExp, to: string): readonly string[] {
  const mutated = source.map((statement) => statement.replace(from, to))
  expect(mutated, 'la mutacion no se aplico').not.toEqual(source)
  return mutated
}

/** Ninguna sentencia escribe filas. */
function writesRows(source: readonly string[]): boolean {
  return source.some((statement) => /\b(INSERT|UPDATE)\b/i.test(statement.replace(/ON UPDATE \w+/gi, '')))
}

const BATCH_MATCHES = `CHECK(("action"::text='CONDITIONING_BATCH_SAVE')=("batch_lines"ISNOTNULL))`
const BATCH_NON_EMPTY = `CHECK("batch_lines"ISNULLOR(jsonb_typeof("batch_lines")='array'ANDjsonb_array_length("batch_lines")>=1))`
const CONDITIONING_NO_STEP = `CHECK("action"::textNOTIN('CONDITIONING_START','CONDITIONING_BATCH_SAVE','CONDITIONING_FINISH')OR"step_position"ISNULL)`

describe('migraciones del acondicionamiento — cabecera sin citas', () => {
  it('ningun archivo cita ficha, requisito ni decision', () => {
    for (const source of [actionsUpSource, actionsDownSource, batchUpSource, batchDownSource]) {
      expect(source).not.toMatch(/QC-\d+/)
      expect(source).not.toMatch(/\bR\d+(bis)?\b/)
      expect(source).not.toMatch(/design\.md/i)
      expect(source).not.toMatch(/decisi[oó]n cerrada/i)
    }
  })
})

describe('order_execution_conditioning_actions — solo los tres ADD VALUE', () => {
  it('el UP son exactamente los tres ADD VALUE IF NOT EXISTS, en orden y nada mas', () => {
    const expected = NEW_VALUES.map((value) => `ALTER TYPE "${ENUM_TYPE}" ADD VALUE IF NOT EXISTS '${value}'`)
    expect(actionsUp).toEqual(expected)

    const conCheck = [...actionsUp, `ALTER TABLE "${TABLE}" ADD CONSTRAINT "x" CHECK ("action"::text = 'CONDITIONING_START')`]
    expect(conCheck).not.toEqual(expected)
  })
})

describe('order_execution_batch_lines — columna y los tres CHECK (R7)', () => {
  it('R7: anade batch_lines como JSONB que admite nulo, y nada mas sobre columnas', () => {
    const columnas = batchUp.filter((s) => /ADD COLUMN/i.test(s))
    expect(columnas).toEqual([`ALTER TABLE "${TABLE}" ADD COLUMN "batch_lines" JSONB`])

    const noNula = mutate(batchUp, '"batch_lines" JSONB', '"batch_lines" JSONB NOT NULL')
    expect(noNula.filter((s) => /ADD COLUMN/i.test(s))).not.toEqual(columnas)
  })

  it('R7: los tres CHECK, con su texto literal, y ninguno mas', () => {
    expect(batchUp.filter((s) => /CHECK\s*\(/i.test(s))).toHaveLength(3)
    expect(checkBody(batchUp, 'order_execution_entries_batch_lines_matches_action')).toBe(BATCH_MATCHES)
    expect(checkBody(batchUp, 'order_execution_entries_batch_lines_non_empty_array')).toBe(BATCH_NON_EMPTY)
    expect(checkBody(batchUp, 'order_execution_entries_conditioning_has_no_step')).toBe(CONDITIONING_NO_STEP)
  })

  it('R7: los tres CHECK reprueban las versiones debilitadas', () => {
    const implicacion = mutate(
      batchUp,
      `("action"::text = 'CONDITIONING_BATCH_SAVE') = ("batch_lines" IS NOT NULL)`,
      `"action"::text <> 'CONDITIONING_BATCH_SAVE' OR "batch_lines" IS NOT NULL`,
    )
    expect(checkBody(implicacion, 'order_execution_entries_batch_lines_matches_action')).not.toBe(BATCH_MATCHES)

    const admiteVacio = mutate(batchUp, 'jsonb_array_length("batch_lines") >= 1', 'jsonb_array_length("batch_lines") >= 0')
    expect(checkBody(admiteVacio, 'order_execution_entries_batch_lines_non_empty_array')).not.toBe(BATCH_NON_EMPTY)
    const admiteObjeto = mutate(batchUp, `jsonb_typeof("batch_lines") = 'array' AND `, '')
    expect(checkBody(admiteObjeto, 'order_execution_entries_batch_lines_non_empty_array')).not.toBe(BATCH_NON_EMPTY)

    const sinFinish = mutate(batchUp, `,'CONDITIONING_FINISH')`, `)`)
    expect(checkBody(sinFinish, 'order_execution_entries_conditioning_has_no_step')).not.toBe(CONDITIONING_NO_STEP)
  })

  it('R7: el CHECK de QC-82 que exige motivo solo en CANCEL ya rechaza un motivo en las acciones nuevas', () => {
    expect(checkBody(originalUp, 'order_execution_entries_reason_matches_action')).toBe(
      `CHECK(("action"::text='CANCEL')=("reason"ISNOTNULL))`,
    )
  })
})

describe('migraciones del acondicionamiento — no rellenan nada (R9)', () => {
  it('R9: ninguna migracion inserta ni actualiza filas', () => {
    for (const source of [actionsUp, batchUp, actionsDown, batchDown]) {
      expect(writesRows(source)).toBe(false)
    }

    const conRelleno = [
      ...batchUp,
      `INSERT INTO "${TABLE}" ("company_id", "order_id", "user_id", "action", "occurred_at") SELECT "company_id", "id", "created_by", 'CONDITIONING_START', now() FROM "orders"`,
    ]
    expect(writesRows(conRelleno)).toBe(true)
    const conUpdate = [...batchUp, `UPDATE "${TABLE}" SET "batch_lines" = '[]'::jsonb`]
    expect(writesRows(conUpdate)).toBe(true)
  })
})

describe('down.sql de cada migracion (R34)', () => {
  it('R34: las dos migraciones tienen su down.sql', () => {
    for (const migration of [ACTIONS_MIGRATION, BATCH_LINES_MIGRATION]) {
      expect(existsSync(join(migrationsRoot, migration, 'down.sql')), migration).toBe(true)
    }
  })

  it('R34: el down de batch_lines quita los tres CHECK y despues la columna, y nada mas', () => {
    const expected = [
      `ALTER TABLE "${TABLE}" DROP CONSTRAINT "order_execution_entries_conditioning_has_no_step"`,
      `ALTER TABLE "${TABLE}" DROP CONSTRAINT "order_execution_entries_batch_lines_non_empty_array"`,
      `ALTER TABLE "${TABLE}" DROP CONSTRAINT "order_execution_entries_batch_lines_matches_action"`,
      `ALTER TABLE "${TABLE}" DROP COLUMN "batch_lines"`,
    ]
    expect(batchDown).toEqual(expected)
    expect([...batchDown].reverse()).not.toEqual(expected)
  })

  it('R34: el down de las acciones abre con una guarda RAISE EXCEPTION sobre las tres acciones nuevas', () => {
    const guarda = actionsDown[0] ?? ''
    expect(guarda).toMatch(/^DO \$\$/)
    expect(guarda).toMatch(/RAISE EXCEPTION/)
    expect(guarda).toMatch(new RegExp(`FROM "${TABLE}"`))
    for (const value of NEW_VALUES) expect(guarda).toContain(`'${value}'`)
    expect(guarda).toMatch(/IF \w+ > 0 THEN RAISE EXCEPTION/)

    const sinGuarda = actionsDown.slice(1)
    expect(sinGuarda[0] ?? '').not.toMatch(/RAISE EXCEPTION/)
    const guardaSinFinish = mutate(actionsDown, `, 'CONDITIONING_FINISH')`, ')')
    expect(guardaSinFinish[0]).not.toContain(`'CONDITIONING_FINISH'`)
  })

  it('R34: el down de las acciones recrea el tipo con los ocho valores originales y lo aplica a la columna', () => {
    const recreate = actionsDown.filter((s) => new RegExp(`^CREATE TYPE "${ENUM_TYPE}" AS ENUM`, 'i').test(s))
    expect(recreate).toHaveLength(1)
    expect(enumValuesOf(recreate[0] as string)).toEqual(ORIGINAL_VALUES)

    const originalCreate = originalUp.find((s) => new RegExp(`^CREATE TYPE "${ENUM_TYPE}" AS ENUM`, 'i').test(s))
    expect(enumValuesOf(originalCreate as string)).toEqual(ORIGINAL_VALUES)

    expect(actionsDown).toContain(`ALTER TYPE "${ENUM_TYPE}" RENAME TO "${ENUM_TYPE}_old"`)
    expect(actionsDown).toContain(
      `ALTER TABLE "${TABLE}" ALTER COLUMN "action" TYPE "${ENUM_TYPE}" USING ("action"::text::"${ENUM_TYPE}")`,
    )
    expect(actionsDown).toContain(`DROP TYPE "${ENUM_TYPE}_old"`)
  })

  it('R34: el down de las acciones tira los CHECK que nombran action antes del cambio de tipo y los recrea literales despues', () => {
    const renombre = actionsDown.findIndex((s) => /RENAME TO/i.test(s))
    const tipoViejoFuera = actionsDown.findIndex((s) => new RegExp(`^DROP TYPE "${ENUM_TYPE}_old"`).test(s))
    for (const constraint of [
      'order_execution_entries_reason_matches_action',
      'order_execution_entries_packing_has_no_step',
    ]) {
      const drop = actionsDown.findIndex((s) => s === `ALTER TABLE "${TABLE}" DROP CONSTRAINT "${constraint}"`)
      expect(drop, constraint).toBeGreaterThan(0)
      expect(drop, constraint).toBeLessThan(renombre)
      const add = actionsDown.findIndex((s) => new RegExp(`ADD CONSTRAINT "${constraint}" CHECK`).test(s))
      expect(add, constraint).toBeGreaterThan(tipoViejoFuera)
      expect(checkBody(actionsDown, constraint), constraint).toBe(checkBody(originalUp, constraint))
    }
  })
})

describe('db/migrations — orden de las dos migraciones', () => {
  const folders = readdirSync(migrationsRoot)
    .filter((entry) => statSync(join(migrationsRoot, entry)).isDirectory())
    .sort()
  const timestampOf = (folder: string) => folder.split('_')[0] ?? folder

  it('existen, su timestamp es unico y van despues del registro y una detras de la otra', () => {
    for (const migration of [ACTIONS_MIGRATION, BATCH_LINES_MIGRATION]) {
      expect(folders).toContain(migration)
      expect(folders.filter((f) => timestampOf(f) === timestampOf(migration))).toHaveLength(1)
      expect(ORIGINAL_MIGRATION < migration).toBe(true)
    }
    expect(ACTIONS_MIGRATION < BATCH_LINES_MIGRATION).toBe(true)
  })
})
