// Contrato ESTATICO de `db/migrations/*_companies_management`: la empresa gana identificacion
// fiscal y contacto, y nace la tabla `company_events` (historial que solo crece) con RLS forzada.
//
// PATRON: predicados sobre el texto SQL, aplicados al archivo real y a una copia mutada en
// memoria. Mismo patron que `companies-country-migration.test.ts`.

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

const candidateDirs = readdirSync(migrationsDir).filter((name) =>
  /^\d{14}_companies_management$/.test(name),
)
expect(candidateDirs, 'debe existir exactamente una migracion *_companies_management').toHaveLength(1)
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

/** La forma del tipo de evento, tal como la escribe el CHECK de la tabla. */
const KIND_FORMAT_SQL = String.raw`^[a-z][a-z_]*\.[a-z][a-z_]*$`

const ADD_COLUMNS =
  'ALTER TABLE "companies" ADD COLUMN "tax_id" TEXT, ADD COLUMN "tax_id_normalized" TEXT, ' +
  'ADD COLUMN "contact_email" TEXT, ADD COLUMN "contact_phone" TEXT'
const ADD_TAX_ID_PAIR =
  'ALTER TABLE "companies" ADD CONSTRAINT "companies_tax_id_pair" ' +
  'CHECK (("tax_id" IS NULL) = ("tax_id_normalized" IS NULL))'
const ADD_TAX_ID_FORMAT =
  'ALTER TABLE "companies" ADD CONSTRAINT "companies_tax_id_normalized_format" ' +
  'CHECK ("tax_id_normalized" IS NULL OR "tax_id_normalized" ~ \'^[a-z0-9]+$\')'
const CREATE_TAX_ID_UNIQUE =
  'CREATE UNIQUE INDEX "companies_tax_id_unique" ON "companies" ("tax_id_normalized") ' +
  'WHERE "deleted_at" IS NULL AND "tax_id_normalized" IS NOT NULL'
const CREATE_EVENTS_TABLE =
  'CREATE TABLE "company_events" ( "id" UUID NOT NULL DEFAULT gen_random_uuid(), ' +
  '"company_id" UUID NOT NULL, "kind" TEXT NOT NULL, "actor_id" UUID NOT NULL, ' +
  '"occurred_at" TIMESTAMPTZ(6) NOT NULL, "details" JSONB, ' +
  '"created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, ' +
  'CONSTRAINT "company_events_pkey" PRIMARY KEY ("id"), ' +
  `CONSTRAINT "company_events_kind_format" CHECK ("kind" ~ '${KIND_FORMAT_SQL}') )`
const CREATE_EVENTS_ORDER_INDEX =
  'CREATE INDEX "company_events_company_id_occurred_at_idx" ' +
  'ON "company_events" ("company_id", "occurred_at" DESC, "id" DESC)'
const CREATE_EVENTS_ACTOR_INDEX =
  'CREATE INDEX "company_events_actor_id_idx" ON "company_events" ("actor_id")'
const ADD_EVENTS_COMPANY_FK =
  'ALTER TABLE "company_events" ADD CONSTRAINT "company_events_company_id_fkey" ' +
  'FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE'
const ADD_EVENTS_ACTOR_FK =
  'ALTER TABLE "company_events" ADD CONSTRAINT "company_events_actor_id_fkey" ' +
  'FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE'
const ENABLE_RLS = 'ALTER TABLE "company_events" ENABLE ROW LEVEL SECURITY'
const FORCE_RLS = 'ALTER TABLE "company_events" FORCE ROW LEVEL SECURITY'

const EXPECTED_UP = [
  ADD_COLUMNS,
  ADD_TAX_ID_PAIR,
  ADD_TAX_ID_FORMAT,
  CREATE_TAX_ID_UNIQUE,
  CREATE_EVENTS_TABLE,
  CREATE_EVENTS_ORDER_INDEX,
  CREATE_EVENTS_ACTOR_INDEX,
  ADD_EVENTS_COMPANY_FK,
  ADD_EVENTS_ACTOR_FK,
  ENABLE_RLS,
  FORCE_RLS,
] as const

const EXPECTED_DOWN = [
  'DROP TABLE "company_events"',
  'DROP INDEX "companies_tax_id_unique"',
  'ALTER TABLE "companies" DROP CONSTRAINT "companies_tax_id_normalized_format"',
  'ALTER TABLE "companies" DROP CONSTRAINT "companies_tax_id_pair"',
  'ALTER TABLE "companies" DROP COLUMN "contact_phone", DROP COLUMN "contact_email", ' +
    'DROP COLUMN "tax_id_normalized", DROP COLUMN "tax_id"',
] as const

function sameStatements(sql: string, expected: readonly string[]): boolean {
  const found = statements(sql)
  return found.length === expected.length && found.every((statement, i) => statement === expected[i])
}

/** Las sentencias del UP, exactas y en orden: una de mas es un cambio que nadie pidio. */
export function upEsElEsperado(sql: string): boolean {
  return sameStatements(sql, EXPECTED_UP)
}

/** Las sentencias del DOWN, exactas y en orden inverso al UP. */
export function downEsElEsperado(sql: string): boolean {
  return sameStatements(sql, EXPECTED_DOWN)
}

function modelBlock(schema: string, model: string): string {
  const match = new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`).exec(schema.replace(/\r\n/g, '\n'))
  if (match === null) throw new Error(`no se encontro el modelo ${model} en db/schema.prisma`)
  return match[0]
}

function fieldLines(block: string): readonly string[] {
  return block
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter((line) => line.length > 0 && !line.startsWith('//') && !line.startsWith('@@'))
}

function mutate(source: string, from: string | RegExp, to: string): string {
  const mutated = source.replace(from, to)
  expect(mutated, `la mutacion ${String(from)} no se aplico`).not.toBe(source)
  return mutated
}

describe('companies_management — migration.sql: columnas de la empresa (R4)', () => {
  it('R4: las cuatro columnas nacen anulables, TEXT, sin DEFAULT ni backfill', () => {
    expect(upEsElEsperado(upSource)).toBe(true)
    expect(statements(upSource)[0]).toBe(ADD_COLUMNS)
    const code = stripSqlComments(upSource)
    expect(code).not.toMatch(/^\s*UPDATE\b/im)
    expect(code).not.toMatch(/"companies"[^;]*\bDEFAULT\b/i)
  })

  it('R4: el detector muerde -NOT NULL, DEFAULT o backfill en las columnas dan rojo-', () => {
    expect(upEsElEsperado(mutate(upSource, '"tax_id" TEXT,', '"tax_id" TEXT NOT NULL,'))).toBe(false)
    expect(
      upEsElEsperado(mutate(upSource, '"contact_phone" TEXT;', '"contact_phone" TEXT DEFAULT \'\';')),
    ).toBe(false)
    expect(upEsElEsperado(`${upSource}\nUPDATE "companies" SET "contact_email" = 'x';\n`)).toBe(false)
  })

  it('R4: el modelo Company declara las cuatro columnas opcionales, mapeadas y sin @default', () => {
    const lines = fieldLines(modelBlock(schemaSource, 'Company'))
    for (const expected of [
      'taxId String? @map("tax_id")',
      'taxIdNormalized String? @map("tax_id_normalized")',
      'contactEmail String? @map("contact_email")',
      'contactPhone String? @map("contact_phone")',
      'events CompanyEvent[]',
    ]) {
      expect(lines, expected).toContain(expected)
    }
  })
})

describe('companies_management — migration.sql: identificacion unica entre vivas (R10)', () => {
  it('R10: el CHECK de par impide una identificacion sin su forma normalizada o al reves', () => {
    expect(statements(upSource)).toContain(ADD_TAX_ID_PAIR)
  })

  it('R10: el CHECK de formato solo admite minusculas y digitos, y admite NULL', () => {
    expect(statements(upSource)).toContain(ADD_TAX_ID_FORMAT)
  })

  it('R10: el indice unico es parcial sobre vivas y con identificacion', () => {
    expect(statements(upSource)).toContain(CREATE_TAX_ID_UNIQUE)
  })

  it('R10: el detector muerde -indice total, CHECK flojo o ausente dan rojo-', () => {
    expect(
      upEsElEsperado(mutate(upSource, 'WHERE "deleted_at" IS NULL AND "tax_id_normalized" IS NOT NULL', '')),
    ).toBe(false)
    expect(upEsElEsperado(mutate(upSource, "'^[a-z0-9]+$'", "'^[A-Za-z0-9]+$'"))).toBe(false)
    expect(
      upEsElEsperado(mutate(upSource, /ALTER TABLE "companies" ADD CONSTRAINT "companies_tax_id_pair"[\s\S]*?;/, '')),
    ).toBe(false)
  })
})

describe('companies_management — migration.sql: tabla company_events (R39, R44)', () => {
  it('R39: la tabla vigila la forma del tipo con un CHECK y no con un enum', () => {
    expect(statements(upSource)).toContain(CREATE_EVENTS_TABLE)
    expect(stripSqlComments(upSource)).not.toMatch(/CREATE TYPE/i)
  })

  it('R39: la forma admite tipos nuevos `<ambito>.<accion>` y rechaza lo que no la tiene', () => {
    const format = new RegExp(KIND_FORMAT_SQL)
    for (const kind of ['company.created', 'company.updated', 'module.enabled', 'company_module.turned_off']) {
      expect(format.test(kind), kind).toBe(true)
    }
    for (const kind of ['Bad Kind', 'company', 'Company.created', 'company.', '.created', 'a.b.c', '1x.y']) {
      expect(format.test(kind), kind).toBe(false)
    }
  })

  it('R39: sin updated_at ni deleted_at: un evento no se corrige ni se borra', () => {
    expect(CREATE_EVENTS_TABLE).not.toMatch(/updated_at|deleted_at/)
    const lines = fieldLines(modelBlock(schemaSource, 'CompanyEvent'))
    expect(lines.some((line) => /^(updatedAt|deletedAt)\b/.test(line))).toBe(false)
  })

  it('R39: las dos FK son RESTRICT: borrar una empresa o un usuario con eventos falla', () => {
    const fks = statements(upSource).filter((statement) => /FOREIGN KEY/.test(statement))
    expect(fks).toEqual([ADD_EVENTS_COMPANY_FK, ADD_EVENTS_ACTOR_FK])
    for (const fk of fks) expect(fk).toMatch(/ON DELETE RESTRICT/)
  })

  it('R39: el detector muerde -FK en CASCADE o columna de borrado dan rojo-', () => {
    expect(
      upEsElEsperado(mutate(upSource, /("users"\("id"\)) ON DELETE RESTRICT/, '$1 ON DELETE CASCADE')),
    ).toBe(false)
    expect(
      upEsElEsperado(mutate(upSource, '"details" JSONB,', '"details" JSONB, "deleted_at" TIMESTAMPTZ(6),')),
    ).toBe(false)
  })

  it('R39: el modelo CompanyEvent es de identity y User tiene su lado inverso', () => {
    const normalized = schemaSource.replace(/\r\n/g, '\n')
    expect(normalized).toMatch(/\/\/\/ @module identity\nmodel CompanyEvent \{/)
    expect(fieldLines(modelBlock(schemaSource, 'User'))).toContain('companyEvents CompanyEvent[]')
    expect(modelBlock(schemaSource, 'CompanyEvent')).toContain('@@map("company_events")')
  })

  it('R44: ENABLE y FORCE ROW LEVEL SECURITY son las dos ultimas sentencias', () => {
    const found = statements(upSource)
    expect(found.slice(-2)).toEqual([ENABLE_RLS, FORCE_RLS])
    expect(stripSqlComments(upSource)).not.toMatch(/CREATE POLICY/i)
  })

  it('R44: el detector muerde -sin FORCE o con RLS antes de la tabla da rojo-', () => {
    expect(upEsElEsperado(mutate(upSource, /ALTER TABLE "company_events" FORCE ROW LEVEL SECURITY;/, ''))).toBe(
      false,
    )
    const rlsFirst = `${ENABLE_RLS};\n${FORCE_RLS};\n${upSource.replace(/ALTER TABLE "company_events" (ENABLE|FORCE) ROW LEVEL SECURITY;/g, '')}`
    expect(upEsElEsperado(rlsFirst)).toBe(false)
  })
})

describe('companies_management — down.sql revierte exactamente, en orden inverso (R43)', () => {
  it('R43: borra la tabla, el indice, los dos CHECK y las cuatro columnas, y nada mas', () => {
    expect(downEsElEsperado(downSource)).toBe(true)
  })

  it('R43: cada objeto que crea el UP lo quita el DOWN', () => {
    const down = statements(downSource).join('\n')
    for (const name of [
      'company_events',
      'companies_tax_id_unique',
      'companies_tax_id_normalized_format',
      'companies_tax_id_pair',
      'tax_id',
      'tax_id_normalized',
      'contact_email',
      'contact_phone',
    ]) {
      expect(down, name).toContain(`"${name}"`)
    }
  })

  it('R43: el detector muerde -el orden al reves o un DROP de menos dan rojo-', () => {
    const [first, ...rest] = EXPECTED_DOWN
    expect(downEsElEsperado(`${[...rest, first].join(';\n')};\n`)).toBe(false)
    expect(downEsElEsperado(`${EXPECTED_DOWN.slice(1).join(';\n')};\n`)).toBe(false)
    expect(downEsElEsperado(mutate(downSource, /DROP COLUMN "tax_id";/, ';'))).toBe(false)
  })

  it('R43: no borra filas: sin DELETE ni TRUNCATE', () => {
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
