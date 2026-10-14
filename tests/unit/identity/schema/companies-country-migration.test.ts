// Contrato ESTATICO de `db/migrations/*_companies_country`: la empresa gana un pais opcional y un
// CHECK de formato (dos letras mayusculas). La lista de paises no va a la base.
//
// PATRON: predicados sobre el texto SQL, aplicados al archivo real y a una copia mutada en
// memoria. Mismo patron que `product-batch-production-date-migration.test.ts`.

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

const candidateDirs = readdirSync(migrationsDir).filter((name) => /^\d{14}_companies_country$/.test(name))
expect(candidateDirs, 'debe existir exactamente una migracion *_companies_country').toHaveLength(1)
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

const ADD_COLUMN = 'ALTER TABLE "companies" ADD COLUMN "country" VARCHAR(2)'
const ADD_CHECK =
  'ALTER TABLE "companies" ADD CONSTRAINT "companies_country_format" CHECK ("country" IS NULL OR "country" ~ \'^[A-Z]{2}$\')'
const DROP_CHECK = 'ALTER TABLE "companies" DROP CONSTRAINT "companies_country_format"'
const DROP_COLUMN = 'ALTER TABLE "companies" DROP COLUMN "country"'

/** Las dos sentencias del UP, exactas y en orden: una de mas es un cambio que nadie pidio. */
export function upEsElEsperado(sql: string): boolean {
  const found = statements(sql)
  return found.length === 2 && found[0] === ADD_COLUMN && found[1] === ADD_CHECK
}

/** Las dos sentencias del DOWN, exactas y en orden inverso al UP. */
export function downEsElEsperado(sql: string): boolean {
  const found = statements(sql)
  return found.length === 2 && found[0] === DROP_CHECK && found[1] === DROP_COLUMN
}

/** El bloque del modelo `Company` en el esquema de Prisma. */
function companyModel(schema: string): string {
  const match = /model Company \{[\s\S]*?\n\}/.exec(schema.replace(/\r\n/g, '\n'))
  if (match === null) throw new Error('no se encontro el modelo Company en db/schema.prisma')
  return match[0]
}

describe('companies.country — migration.sql (R1, R10)', () => {
  it('R1: la columna nace anulable, VARCHAR(2), sin DEFAULT ni backfill', () => {
    expect(upEsElEsperado(upSource)).toBe(true)
    const code = stripSqlComments(upSource)
    expect(code).not.toMatch(/\bUPDATE\b/i)
    expect(code).not.toMatch(/\bDEFAULT\b/i)
    expect(code).not.toMatch(/NOT NULL/i)
  })

  it('R10: existe el CHECK de formato con ^[A-Z]{2}$ y admite NULL', () => {
    expect(statements(upSource)).toContain(ADD_CHECK)
  })

  it('R1/R10: el detector muerde -NOT NULL, DEFAULT, backfill, CHECK flojo o ausente dan rojo-', () => {
    const notNull = upSource.replace('"country" VARCHAR(2);', '"country" VARCHAR(2) NOT NULL;')
    expect(notNull, 'la mutacion no se aplico').not.toBe(upSource)
    expect(upEsElEsperado(notNull)).toBe(false)

    const conDefault = upSource.replace('"country" VARCHAR(2);', '"country" VARCHAR(2) DEFAULT \'CO\';')
    expect(conDefault, 'la mutacion no se aplico').not.toBe(upSource)
    expect(upEsElEsperado(conDefault)).toBe(false)

    expect(upEsElEsperado(`${upSource}\nUPDATE "companies" SET "country" = 'CO';\n`)).toBe(false)

    const checkFlojo = upSource.replace('^[A-Z]{2}$', '^[A-Za-z]{2}$')
    expect(checkFlojo, 'la mutacion no se aplico').not.toBe(upSource)
    expect(upEsElEsperado(checkFlojo)).toBe(false)

    const sinCheck = upSource.replace(/ALTER TABLE "companies" ADD CONSTRAINT[\s\S]*?;\s*$/, '')
    expect(sinCheck, 'la mutacion no se aplico').not.toBe(upSource)
    expect(upEsElEsperado(sinCheck)).toBe(false)
  })

  it('R1: el modelo Company declara `country String? @db.VarChar(2)`, sin @default ni @map', () => {
    const lineas = companyModel(schemaSource)
      .split('\n')
      .map((linea) => linea.trim())
      .filter((linea) => linea.startsWith('country '))
    expect(lineas).toHaveLength(1)
    expect((lineas[0] as string).replace(/\s+/g, ' ')).toBe('country String? @db.VarChar(2)')
  })
})

describe('companies.country — down.sql revierte exactamente, en orden inverso (R11)', () => {
  it('R11: quita el CHECK y despues la columna, y nada mas', () => {
    expect(downEsElEsperado(downSource)).toBe(true)
  })

  it('R11: el detector muerde -el orden al reves o un DROP de menos dan rojo-', () => {
    expect(downEsElEsperado(`${DROP_COLUMN};\n${DROP_CHECK};\n`)).toBe(false)
    expect(downEsElEsperado(`${DROP_COLUMN};\n`)).toBe(false)
    expect(downEsElEsperado(`${DROP_CHECK};\n`)).toBe(false)
  })

  it('R11: no borra filas: sin DELETE ni TRUNCATE', () => {
    expect(stripSqlComments(downSource)).not.toMatch(/DELETE FROM|TRUNCATE/i)
  })
})

describe('nombres en ingles', () => {
  it('ningun caracter acentuado en el SQL de ninguno de los dos sentidos', () => {
    for (const sql of [upSource, downSource]) {
      expect(sql).not.toMatch(/[áéíóúñÁÉÍÓÚÑ]/)
    }
  })
})
