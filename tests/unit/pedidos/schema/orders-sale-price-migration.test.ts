// Contrato ESTATICO del SQL de `orders_sale_price`.
//
// Se vigila que la columna nazca opcional y decimal(14,4) en el propio pedido, que el CHECK la ate
// a un importe no negativo dejando pasar NULL, que ninguna sentencia rellene pedidos existentes ni
// anada moneda, y que el `down.sql` revierta exactamente eso.
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

const migrationDir = findMigrationDir('_orders_sale_price')
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

const ADD_COLUMN = 'ALTER TABLE "orders" ADD COLUMN "sale_price" DECIMAL(14,4)'
const NON_NEGATIVE =
  'ALTER TABLE "orders" ADD CONSTRAINT "orders_sale_price_non_negative" CHECK ("sale_price" IS NULL OR "sale_price" >= 0)'

/** La columna nace opcional: sin NOT NULL ni DEFAULT, que rellenaria los pedidos existentes. */
function addsNullableColumn(sql: string): boolean {
  return statements(sql).includes(ADD_COLUMN)
}

function addsNonNegativeCheck(sql: string): boolean {
  return statements(sql).includes(NON_NEGATIVE)
}

/** Solo las dos sentencias: ni relleno, ni moneda, ni tabla nueva, ni indice. */
function onlyTheTwoStatements(sql: string): boolean {
  const all = statements(sql)
  return all.length === 2 && all[0] === ADD_COLUMN && all[1] === NON_NEGATIVE
}

function neverBackfills(sql: string): boolean {
  const text = normalized(sql)
  return !/\bUPDATE\b/i.test(text) && !/\bINSERT\b/i.test(text) && !/\bDEFAULT\b/i.test(text)
}

function hasNoCurrency(sql: string): boolean {
  return !/currency|moneda/i.test(normalized(sql))
}

function downRevertsExactly(sql: string): boolean {
  return (
    normalized(sql) ===
    'ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_sale_price_non_negative"; ALTER TABLE "orders" DROP COLUMN IF EXISTS "sale_price";'
  )
}

function orderModel(schema: string): string {
  const match = /model Order \{([\s\S]*?)\n\}/.exec(schema)
  if (match === null) throw new Error('db/schema.prisma no tiene model Order')
  return match[1] as string
}

const SALE_PRICE_FIELD = /^\s*salePrice\s+Decimal\?\s+@map\("sale_price"\) @db\.Decimal\(14, 4\)\s*$/m

describe('migration.sql de orders_sale_price', () => {
  it('R2, R18: la columna nace en orders, se llama sale_price, opcional, decimal(14,4) y sin default', () => {
    expect(addsNullableColumn(upSource)).toBe(true)
    const conDefault = upSource.replace('DECIMAL(14,4);', 'DECIMAL(14,4) DEFAULT 0;')
    expect(conDefault).not.toBe(upSource)
    expect(addsNullableColumn(conDefault)).toBe(false)
    const obligatoria = upSource.replace('DECIMAL(14,4);', 'DECIMAL(14,4) NOT NULL;')
    expect(addsNullableColumn(obligatoria)).toBe(false)
    const otraEscala = upSource.replace('DECIMAL(14,4);', 'DECIMAL(18,6);')
    expect(addsNullableColumn(otraEscala)).toBe(false)
    const otroNombre = upSource.replace('ADD COLUMN "sale_price"', 'ADD COLUMN "price"')
    expect(otroNombre).not.toBe(upSource)
    expect(addsNullableColumn(otroNombre)).toBe(false)
  })

  it('R9: el CHECK impide un precio negativo y deja pasar NULL y 0', () => {
    expect(addsNonNegativeCheck(upSource)).toBe(true)
    const sinNulo = upSource.replace('CHECK ("sale_price" IS NULL OR "sale_price" >= 0)', 'CHECK ("sale_price" >= 0)')
    expect(sinNulo).not.toBe(upSource)
    expect(addsNonNegativeCheck(sinNulo)).toBe(false)
    const positivoEstricto = upSource.replace('"sale_price" >= 0', '"sale_price" > 0')
    expect(positivoEstricto).not.toBe(upSource)
    expect(addsNonNegativeCheck(positivoEstricto)).toBe(false)
  })

  it('R18: ninguna sentencia rellena el precio de los pedidos existentes (ni UPDATE ni DEFAULT)', () => {
    expect(neverBackfills(upSource)).toBe(true)
    expect(onlyTheTwoStatements(upSource)).toBe(true)
    const conRelleno = `${upSource}\nUPDATE "orders" SET "sale_price" = 0;`
    expect(neverBackfills(conRelleno)).toBe(false)
    expect(onlyTheTwoStatements(conRelleno)).toBe(false)
    const conDefault = upSource.replace('DECIMAL(14,4);', 'DECIMAL(14,4) DEFAULT 0;')
    expect(neverBackfills(conDefault)).toBe(false)
  })

  it('R2: sin columna de moneda, sin tabla nueva: solo se altera orders', () => {
    expect(hasNoCurrency(upSource)).toBe(true)
    const conMoneda = `${upSource}\nALTER TABLE "orders" ADD COLUMN "sale_price_currency" TEXT;`
    expect(hasNoCurrency(conMoneda)).toBe(false)
    expect(onlyTheTwoStatements(conMoneda)).toBe(false)
    expect(/CREATE TABLE/i.test(normalized(upSource))).toBe(false)
    expect(statements(upSource).every((statement) => statement.startsWith('ALTER TABLE "orders" '))).toBe(true)
  })

  it('R18: down.sql quita la restriccion y luego la columna, y nada mas', () => {
    expect(downRevertsExactly(downSource)).toBe(true)
    const ordenInverso = downSource.replace(
      /(ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_sale_price_non_negative";)\s*(ALTER TABLE "orders" DROP COLUMN IF EXISTS "sale_price";)/,
      '$2\n$1',
    )
    expect(ordenInverso).not.toBe(downSource)
    expect(downRevertsExactly(ordenInverso)).toBe(false)
    const sinRestriccion = downSource.replace(/ALTER TABLE "orders" DROP CONSTRAINT[^;]*;/, '')
    expect(sinRestriccion).not.toBe(downSource)
    expect(downRevertsExactly(sinRestriccion)).toBe(false)
    const tocaOtraColumna = `${downSource}\nALTER TABLE "orders" DROP COLUMN "actual_cost";`
    expect(downRevertsExactly(tocaOtraColumna)).toBe(false)
  })
})

describe('db/schema.prisma > Order.salePrice', () => {
  it('R2: campo opcional en ingles, decimal(14,4), mapeado a sale_price', () => {
    const model = orderModel(schemaSource)
    expect(model).toMatch(SALE_PRICE_FIELD)
    const obligatorio = model.replace(/(salePrice\s+)Decimal\?/, '$1Decimal ')
    expect(obligatorio).not.toBe(model)
    expect(obligatorio).not.toMatch(SALE_PRICE_FIELD)
    const otraEscala = model.replace('@map("sale_price") @db.Decimal(14, 4)', '@map("sale_price") @db.Decimal(18, 6)')
    expect(otraEscala).not.toBe(model)
    expect(otraEscala).not.toMatch(SALE_PRICE_FIELD)
  })

  it('R2: el modelo no declara moneda para el precio', () => {
    expect(orderModel(schemaSource)).not.toMatch(/currency|moneda/i)
  })
})
