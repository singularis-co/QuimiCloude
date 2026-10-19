// Contrato ESTATICO de `db/migrations/*_customers_phone_e164`: tres columnas nulas, cuatro CHECK y
// un indice unico parcial, sin tocar `phone` ni ninguna fila.
//
// PATRON: predicados sobre el texto SQL, aplicados al archivo real y a una copia mutada en memoria.
// Mismo patron que `companies-country-migration.test.ts`.

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

const candidateDirs = readdirSync(migrationsDir).filter((name) => /^\d{14}_customers_phone_e164$/.test(name))
expect(candidateDirs, 'debe existir exactamente una migracion *_customers_phone_e164').toHaveLength(1)
const migrationDir = join(migrationsDir, candidateDirs[0] as string)

const upSource = readFileSync(join(migrationDir, 'migration.sql'), 'utf8')
const downSource = readFileSync(join(migrationDir, 'down.sql'), 'utf8')
const schemaSource = readFileSync(join(repoRoot, 'db', 'schema.prisma'), 'utf8')

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}

function statements(sql: string): readonly string[] {
  return stripSqlComments(sql)
    .split(';')
    .map((statement) => statement.replace(/\s+/g, ' ').trim())
    .filter((statement) => statement.length > 0)
}

const ADD_COLUMNS = [
  'ALTER TABLE "customers" ADD COLUMN "phone_country" VARCHAR(2)',
  'ALTER TABLE "customers" ADD COLUMN "phone_e164" VARCHAR(15)',
  'ALTER TABLE "customers" ADD COLUMN "phone_issue" VARCHAR(20)',
] as const

const ADD_CHECKS = [
  'ALTER TABLE "customers" ADD CONSTRAINT "customers_phone_country_format_check" CHECK ("phone_country" IS NULL OR "phone_country" ~ \'^[A-Z]{2}$\')',
  'ALTER TABLE "customers" ADD CONSTRAINT "customers_phone_e164_format_check" CHECK ("phone_e164" IS NULL OR "phone_e164" ~ \'^[1-9][0-9]{6,14}$\')',
  'ALTER TABLE "customers" ADD CONSTRAINT "customers_phone_issue_check" CHECK ("phone_issue" IS NULL OR "phone_issue" IN (\'invalid_format\', \'duplicate\'))',
  'ALTER TABLE "customers" ADD CONSTRAINT "customers_phone_coherence_check" CHECK ( ("phone_e164" IS NULL OR ("phone_country" IS NOT NULL AND "phone_issue" IS NULL)) AND ("phone_issue" IS NULL OR ("phone" IS NOT NULL AND "phone_e164" IS NULL)) )',
] as const

const CREATE_INDEX =
  'CREATE UNIQUE INDEX "customers_company_phone_e164_key" ON "customers" ("company_id", "phone_e164") WHERE "deleted_at" IS NULL AND "phone_e164" IS NOT NULL'

const DOWN = [
  'DROP INDEX "customers_company_phone_e164_key"',
  'ALTER TABLE "customers" DROP CONSTRAINT "customers_phone_coherence_check"',
  'ALTER TABLE "customers" DROP CONSTRAINT "customers_phone_issue_check"',
  'ALTER TABLE "customers" DROP CONSTRAINT "customers_phone_e164_format_check"',
  'ALTER TABLE "customers" DROP CONSTRAINT "customers_phone_country_format_check"',
  'ALTER TABLE "customers" DROP COLUMN "phone_issue"',
  'ALTER TABLE "customers" DROP COLUMN "phone_e164"',
  'ALTER TABLE "customers" DROP COLUMN "phone_country"',
] as const

/** Las ocho sentencias del UP, exactas y en orden: una de mas es un cambio que nadie pidio. */
export function upEsElEsperado(sql: string): boolean {
  const esperado = [...ADD_COLUMNS, ...ADD_CHECKS, CREATE_INDEX]
  const found = statements(sql)
  return found.length === esperado.length && found.every((statement, i) => statement === esperado[i])
}

/** Las ocho sentencias del DOWN, exactas y en orden inverso al UP. */
export function downEsElEsperado(sql: string): boolean {
  const found = statements(sql)
  return found.length === DOWN.length && found.every((statement, i) => statement === DOWN[i])
}

/** Ninguna sentencia altera, borra, renombra o reescribe la columna `phone` ni ninguna fila. */
export function noTocaPhoneNiFilas(sql: string): boolean {
  const code = stripSqlComments(sql)
  if (/\b(UPDATE|DELETE|INSERT|TRUNCATE)\b/i.test(code)) return false
  if (/(ALTER|DROP|RENAME)\s+COLUMN\s+"phone"(?!_)/i.test(code)) return false
  if (/ADD\s+COLUMN\s+"phone"(?!_)/i.test(code)) return false
  return true
}

function customerModel(schema: string): string {
  const match = /model Customer \{[\s\S]*?\n\}/.exec(schema.replace(/\r\n/g, '\n'))
  if (match === null) throw new Error('no se encontro el modelo Customer en db/schema.prisma')
  return match[0]
}

describe('customers.phone_* — migration.sql (R23, R15, R16, R14)', () => {
  it('R23: tres ADD COLUMN nulos, sin DEFAULT; los cuatro CHECK; un unico indice unico parcial; nada mas', () => {
    expect(upEsElEsperado(upSource)).toBe(true)
    const code = stripSqlComments(upSource)
    expect(code).not.toMatch(/\bDEFAULT\b/i)
    expect(code.match(/CREATE UNIQUE INDEX/g)).toHaveLength(1)
  })

  it('R23: ningun UPDATE y la columna `phone` no se altera', () => {
    expect(noTocaPhoneNiFilas(upSource)).toBe(true)
    expect(noTocaPhoneNiFilas(downSource)).toBe(true)
  })

  it('R14: el indice es UNIQUE sobre (company_id, phone_e164) solo entre vivos con numero', () => {
    expect(statements(upSource)).toContain(CREATE_INDEX)
  })

  it('R15: phone_country solo admite dos letras mayusculas', () => {
    expect(statements(upSource)).toContain(ADD_CHECKS[0])
  })

  it('R16: phone_e164 solo digitos, 7 a 15, sin empezar por 0, y nunca sin phone_country', () => {
    expect(statements(upSource)).toContain(ADD_CHECKS[1])
    expect(statements(upSource)).toContain(ADD_CHECKS[3])
  })

  it('R23: el detector muerde -DEFAULT, NOT NULL, backfill, indice sin WHERE o CHECK flojo dan rojo-', () => {
    const conDefault = upSource.replace('"phone_country" VARCHAR(2);', '"phone_country" VARCHAR(2) DEFAULT \'CO\';')
    expect(conDefault, 'la mutacion no se aplico').not.toBe(upSource)
    expect(upEsElEsperado(conDefault)).toBe(false)

    const notNull = upSource.replace('"phone_e164" VARCHAR(15);', '"phone_e164" VARCHAR(15) NOT NULL;')
    expect(notNull, 'la mutacion no se aplico').not.toBe(upSource)
    expect(upEsElEsperado(notNull)).toBe(false)

    const backfill = `${upSource}\nUPDATE "customers" SET "phone_country" = 'CO';\n`
    expect(upEsElEsperado(backfill)).toBe(false)
    expect(noTocaPhoneNiFilas(backfill)).toBe(false)

    const tocaPhone = `${upSource}\nALTER TABLE "customers" ALTER COLUMN "phone" TYPE VARCHAR(40);\n`
    expect(noTocaPhoneNiFilas(tocaPhone)).toBe(false)

    const sinWhere = upSource.replace(
      /\s*WHERE "deleted_at" IS NULL AND "phone_e164" IS NOT NULL;/,
      ';',
    )
    expect(sinWhere, 'la mutacion no se aplico').not.toBe(upSource)
    expect(upEsElEsperado(sinWhere)).toBe(false)

    const checkFlojo = upSource.replace('^[1-9][0-9]{6,14}$', '^[0-9]{1,15}$')
    expect(checkFlojo, 'la mutacion no se aplico').not.toBe(upSource)
    expect(upEsElEsperado(checkFlojo)).toBe(false)
  })

  it('R23: el modelo Customer declara las tres columnas anulables, con su VarChar y su @map', () => {
    const lineas = customerModel(schemaSource)
      .split('\n')
      .map((linea) => linea.trim().replace(/\s+/g, ' '))
    expect(lineas).toContain('phoneCountry String? @map("phone_country") @db.VarChar(2)')
    expect(lineas).toContain('phoneE164 String? @map("phone_e164") @db.VarChar(15)')
    expect(lineas).toContain('phoneIssue String? @map("phone_issue") @db.VarChar(20)')
  })
})

describe('customers.phone_* — down.sql revierte exactamente, en orden inverso (R23)', () => {
  it('R23: quita el indice, los cuatro CHECK y las tres columnas, y nada mas', () => {
    expect(downEsElEsperado(downSource)).toBe(true)
  })

  it('R23: el detector muerde -orden al reves o un DROP de menos dan rojo-', () => {
    expect(downEsElEsperado([...DOWN].reverse().join(';\n'))).toBe(false)
    expect(downEsElEsperado(DOWN.slice(1).join(';\n'))).toBe(false)
  })
})

describe('sin citas ni acentos', () => {
  it('ni migration.sql ni down.sql citan fichas o requisitos, ni llevan acentos', () => {
    for (const fuente of [upSource, downSource]) {
      expect(fuente).not.toMatch(/\bR\d+\b/)
      expect(fuente).not.toMatch(/\bQC-\d+\b/)
      expect(fuente).not.toMatch(/design\.md/)
      expect(fuente).not.toMatch(/[áéíóúñÁÉÍÓÚÑ]/)
    }
  })
})
