// Contrato ESTATICO del SQL de `finished_goods_lot_cost_optional`.
//
// Se vigila que la migracion retire solo el CHECK que exigia `unit_cost` en todo lote con
// `package_content`, que no toque `product_batches_unit_cost_positive` y que el `down.sql` lo
// recree exactamente como lo creo `finished_products_and_content_copies`.
//
// PATRON: predicados puros sobre el texto SQL, aplicados al archivo real (pasa) y a una version
// mutada en memoria (falla). El archivo en disco no se toca nunca.

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

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

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)))
const migrationsDir = join(repoRoot, 'db', 'migrations')

function findMigrationDir(suffix: string): string {
  const candidates = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(suffix))
    .map((entry) => entry.name)
  if (candidates.length !== 1) {
    throw new Error(`se esperaba exactamente una migracion terminada en "${suffix}"; hay ${String(candidates.length)}`)
  }
  return join(migrationsDir, candidates[0] as string)
}

const migrationDir = findMigrationDir('_finished_goods_lot_cost_optional')
const upSource = readFileSync(join(migrationDir, 'migration.sql'), 'utf8')
const downSource = readFileSync(join(migrationDir, 'down.sql'), 'utf8')
const originalUpSource = readFileSync(
  join(findMigrationDir('_finished_products_and_content_copies'), 'migration.sql'),
  'utf8',
)

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}

function normalized(sql: string): string {
  return stripSqlComments(sql).replace(/\s+/g, ' ').trim()
}

function statements(sql: string): string[] {
  return normalized(sql)
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
}

const DROP_REQUIRES_UNIT_COST =
  'ALTER TABLE "product_batches" DROP CONSTRAINT "product_batches_package_content_requires_unit_cost"'
const ADD_REQUIRES_UNIT_COST =
  'ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_package_content_requires_unit_cost" CHECK ("package_content" IS NULL OR "unit_cost" IS NOT NULL)'

/** Una sola sentencia: el DROP del CHECK, nada mas. */
function onlyDropsRequiresUnitCost(sql: string): boolean {
  const all = statements(sql)
  return all.length === 1 && all[0] === DROP_REQUIRES_UNIT_COST
}

function neverTouchesUnitCostPositive(sql: string): boolean {
  return !normalized(sql).includes('product_batches_unit_cost_positive')
}

function neverBackfills(sql: string): boolean {
  const text = normalized(sql)
  return !/\bUPDATE\b/i.test(text) && !/\bINSERT\b/i.test(text) && !/\bDELETE\b/i.test(text)
}

function downRecreatesExactly(sql: string): boolean {
  const all = statements(sql)
  return all.length === 1 && all[0] === ADD_REQUIRES_UNIT_COST
}

describe('migration.sql de finished_goods_lot_cost_optional', () => {
  it('R17: retira el CHECK que exigia unit_cost en todo lote con package_content, y nada mas', () => {
    expect(onlyDropsRequiresUnitCost(upSource)).toBe(true)
    const otroNombre = upSource.replace('_requires_unit_cost"', '_requires_cost"')
    expect(otroNombre).not.toBe(upSource)
    expect(onlyDropsRequiresUnitCost(otroNombre)).toBe(false)
    const conExtra = `${upSource}\nALTER TABLE "product_batches" ALTER COLUMN "unit_cost" SET DEFAULT 0;`
    expect(onlyDropsRequiresUnitCost(conExtra)).toBe(false)
  })

  it('R17: no toca product_batches_unit_cost_positive', () => {
    expect(neverTouchesUnitCostPositive(upSource)).toBe(true)
    expect(neverTouchesUnitCostPositive(downSource)).toBe(true)
    const tocaPositivo = `${upSource}\nALTER TABLE "product_batches" DROP CONSTRAINT "product_batches_unit_cost_positive";`
    expect(neverTouchesUnitCostPositive(tocaPositivo)).toBe(false)
  })

  it('P2: ninguna sentencia rellena el coste de los lotes existentes (ni 0 ni el estimado)', () => {
    expect(neverBackfills(upSource)).toBe(true)
    const conRelleno = `${upSource}\nUPDATE "product_batches" SET "unit_cost" = 0 WHERE "unit_cost" IS NULL;`
    expect(neverBackfills(conRelleno)).toBe(false)
  })
})

describe('down.sql de finished_goods_lot_cost_optional', () => {
  it('recrea el CHECK exactamente como lo creo finished_products_and_content_copies', () => {
    expect(downRecreatesExactly(downSource)).toBe(true)
    expect(statements(originalUpSource)).toContain(ADD_REQUIRES_UNIT_COST)
    const relajado = downSource.replace('"unit_cost" IS NOT NULL', '"unit_cost" >= 0')
    expect(relajado).not.toBe(downSource)
    expect(downRecreatesExactly(relajado)).toBe(false)
  })

  it('avisa de que falla si ya hay lotes con package_content y unit_cost NULL, sin rellenarlos', () => {
    expect(downSource).toMatch(/AVISO: falla \(23514\)/)
    expect(downSource).toMatch(/"package_content" y "unit_cost" NULL/)
    expect(neverBackfills(downSource)).toBe(true)
  })
})
