// Contrato ESTATICO del SQL de `orders_actual_cost`.
//
// Se vigila que la columna nazca opcional y decimal(14,4) en el propio pedido, que los dos CHECK
// la aten a un importe no negativo y a un pedido que ya paso por Terminar, que ninguna sentencia
// rellene pedidos existentes y que el `down.sql` revierta exactamente eso.
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

const migrationDir = findMigrationDir('_orders_actual_cost')
const upSource = readFileSync(join(migrationDir, 'migration.sql'), 'utf8')
const downSource = readFileSync(join(migrationDir, 'down.sql'), 'utf8')
const schemaSource = readFileSync(join(repoRoot, 'db', 'schema.prisma'), 'utf8')

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

const ADD_COLUMN = 'ALTER TABLE "orders" ADD COLUMN "actual_cost" DECIMAL(14,4)'
const NON_NEGATIVE =
  'ALTER TABLE "orders" ADD CONSTRAINT "orders_actual_cost_non_negative" CHECK ("actual_cost" IS NULL OR "actual_cost" >= 0)'
const REQUIRES_PACKED =
  'ALTER TABLE "orders" ADD CONSTRAINT "orders_actual_cost_requires_packed" CHECK ("actual_cost" IS NULL OR "status"::text IN (\'POR_ACONDICIONAR\', \'EN_ACONDICIONAMIENTO\', \'TERMINADO\', \'ENTREGADO\'))'

/** La columna nace opcional: sin NOT NULL ni DEFAULT, que rellenaria los pedidos existentes. */
function addsNullableColumn(sql: string): boolean {
  return statements(sql).includes(ADD_COLUMN)
}

function addsNonNegativeCheck(sql: string): boolean {
  return statements(sql).includes(NON_NEGATIVE)
}

function addsRequiresPackedCheck(sql: string): boolean {
  return statements(sql).includes(REQUIRES_PACKED)
}

/** Solo las tres sentencias de la ficha: ni relleno, ni tabla nueva, ni otra columna. */
function onlyTheThreeStatements(sql: string): boolean {
  const all = statements(sql)
  return all.length === 3 && all[0] === ADD_COLUMN && all[1] === NON_NEGATIVE && all[2] === REQUIRES_PACKED
}

function neverBackfills(sql: string): boolean {
  const text = normalized(sql)
  return !/\bUPDATE\b/i.test(text) && !/\bINSERT\b/i.test(text)
}

function downRevertsExactly(sql: string): boolean {
  return (
    normalized(sql) ===
    'ALTER TABLE "orders" DROP CONSTRAINT "orders_actual_cost_requires_packed"; ALTER TABLE "orders" DROP CONSTRAINT "orders_actual_cost_non_negative"; ALTER TABLE "orders" DROP COLUMN "actual_cost";'
  )
}

function orderModel(schema: string): string {
  const match = /model Order \{([\s\S]*?)\n\}/.exec(schema)
  if (match === null) throw new Error('db/schema.prisma no tiene model Order')
  return match[1] as string
}

describe('migration.sql de orders_actual_cost', () => {
  it('R25: la columna nace en orders, opcional, decimal(14,4) y sin default', () => {
    expect(addsNullableColumn(upSource)).toBe(true)
    const conDefault = upSource.replace('DECIMAL(14,4);', 'DECIMAL(14,4) DEFAULT 0;')
    expect(conDefault).not.toBe(upSource)
    expect(addsNullableColumn(conDefault)).toBe(false)
    const obligatoria = upSource.replace('DECIMAL(14,4);', 'DECIMAL(14,4) NOT NULL;')
    expect(addsNullableColumn(obligatoria)).toBe(false)
    const otraEscala = upSource.replace('DECIMAL(14,4);', 'DECIMAL(18,6);')
    expect(addsNullableColumn(otraEscala)).toBe(false)
  })

  it('R7: el CHECK impide un coste real negativo y deja pasar NULL', () => {
    expect(addsNonNegativeCheck(upSource)).toBe(true)
    const sinNulo = upSource.replace('CHECK ("actual_cost" IS NULL OR "actual_cost" >= 0)', 'CHECK ("actual_cost" >= 0)')
    expect(sinNulo).not.toBe(upSource)
    expect(addsNonNegativeCheck(sinNulo)).toBe(false)
    const positivoEstricto = upSource.replace('"actual_cost" >= 0', '"actual_cost" > 0')
    expect(addsNonNegativeCheck(positivoEstricto)).toBe(false)
  })

  it('R10: el CHECK solo admite coste real en un pedido que ya paso por Terminar el empaque', () => {
    expect(addsRequiresPackedCheck(upSource)).toBe(true)
    const conEnEmpaque = upSource.replace("('POR_ACONDICIONAR',", "('EN_EMPAQUE', 'POR_ACONDICIONAR',")
    expect(conEnEmpaque).not.toBe(upSource)
    expect(addsRequiresPackedCheck(conEnEmpaque)).toBe(false)
    const sinEntregado = upSource.replace(", 'ENTREGADO'", '')
    expect(sinEntregado).not.toBe(upSource)
    expect(addsRequiresPackedCheck(sinEntregado)).toBe(false)
  })

  it('R10: ninguna sentencia rellena el coste real de los pedidos existentes', () => {
    expect(neverBackfills(upSource)).toBe(true)
    expect(onlyTheThreeStatements(upSource)).toBe(true)
    const conRelleno = `${upSource}\nUPDATE "orders" SET "actual_cost" = "ingredients_cost" WHERE "status" = 'ENTREGADO';`
    expect(neverBackfills(conRelleno)).toBe(false)
    expect(onlyTheThreeStatements(conRelleno)).toBe(false)
  })

  it('R25: sin tabla nueva: solo se altera orders', () => {
    expect(/CREATE TABLE/i.test(normalized(upSource))).toBe(false)
    expect(statements(upSource).every((statement) => statement.startsWith('ALTER TABLE "orders" '))).toBe(true)
  })

  it('R25: down.sql quita los dos CHECK y la columna, en orden inverso, y nada mas', () => {
    expect(downRevertsExactly(downSource)).toBe(true)
    const ordenDirecto = downSource.replace(
      /(ALTER TABLE "orders" DROP CONSTRAINT "orders_actual_cost_requires_packed";)\s*(ALTER TABLE "orders" DROP CONSTRAINT "orders_actual_cost_non_negative";)/,
      '$2\n$1',
    )
    expect(ordenDirecto).not.toBe(downSource)
    expect(downRevertsExactly(ordenDirecto)).toBe(false)
    const tocaElEstimado = `${downSource}\nUPDATE "orders" SET "ingredients_cost" = NULL;`
    expect(downRevertsExactly(tocaElEstimado)).toBe(false)
  })
})

describe('db/schema.prisma > Order.actualCost', () => {
  it('R23, R25: campo opcional en ingles, decimal(14,4), mapeado a actual_cost', () => {
    expect(orderModel(schemaSource)).toMatch(/^\s*actualCost\s+Decimal\?\s+@map\("actual_cost"\) @db\.Decimal\(14, 4\)\s*$/m)
  })

  it('R25: orders conserva su borrado logico y sus marcas de tiempo', () => {
    const model = orderModel(schemaSource)
    expect(model).toMatch(/^\s*createdAt\s+DateTime\s/m)
    expect(model).toMatch(/^\s*updatedAt\s+DateTime\s/m)
    expect(model).toMatch(/^\s*deletedAt\s+DateTime\?\s/m)
  })
})
