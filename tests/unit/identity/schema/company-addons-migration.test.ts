// Contrato estático del SQL de la migración que crea el catálogo `addons` y las excepciones por
// empresa `company_addon_overrides`.
//
// La lista del `INSERT INTO "addons"` se compara con `ADDONS`, importado del dominio, en vez de
// copiarla. Cada predicado se aplica al SQL real y a copias mutadas en memoria para demostrar que
// dispara.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { ADDONS } from '@/lib/modules/identity'

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
const carpetas = readdirSync(migrationsDir).filter((name) => /^\d{14}_company_addons$/.test(name))

/** Las sentencias del SQL, sin comentarios y con los espacios normalizados. */
function sentencias(sql: string): string[] {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((statement) => statement.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').trim())
    .filter((statement) => statement.length > 0)
}

const CREATE_ADDONS =
  'CREATE TABLE "addons" ("key" TEXT NOT NULL, ' +
  'CONSTRAINT "addons_pkey" PRIMARY KEY ("key"), ' +
  `CONSTRAINT "addons_key_format" CHECK ("key" ~ '^[a-z][a-z_]*$'))`

const CREATE_OVERRIDES =
  'CREATE TABLE "company_addon_overrides" (' +
  '"company_id" UUID NOT NULL, ' +
  '"addon_key" TEXT NOT NULL, ' +
  '"enabled" BOOLEAN NOT NULL, ' +
  `"source" TEXT NOT NULL DEFAULT 'manual', ` +
  '"created_by" UUID, ' +
  '"created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, ' +
  'CONSTRAINT "company_addon_overrides_pkey" PRIMARY KEY ("company_id", "addon_key"), ' +
  `CONSTRAINT "company_addon_overrides_source_format" CHECK ("source" ~ '^[a-z][a-z_]*$'))`

const INDICES = [
  'CREATE INDEX "company_addon_overrides_addon_key_idx" ON "company_addon_overrides" ("addon_key")',
  'CREATE INDEX "company_addon_overrides_created_by_idx" ON "company_addon_overrides" ("created_by")',
]

const FKS = [
  'ALTER TABLE "company_addon_overrides" ADD CONSTRAINT "company_addon_overrides_company_id_fkey" ' +
    'FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE',
  'ALTER TABLE "company_addon_overrides" ADD CONSTRAINT "company_addon_overrides_addon_key_fkey" ' +
    'FOREIGN KEY ("addon_key") REFERENCES "addons"("key") ON DELETE RESTRICT ON UPDATE CASCADE',
  'ALTER TABLE "company_addon_overrides" ADD CONSTRAINT "company_addon_overrides_created_by_fkey" ' +
    'FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
]

const SIEMBRA_EXCEPCIONES =
  'INSERT INTO "company_addon_overrides" ("company_id", "addon_key", "enabled", "source") ' +
  `SELECT c."id", a."key", true, 'manual' FROM "companies" c CROSS JOIN "addons" a`

const RLS = [
  'ALTER TABLE "addons" ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE "addons" FORCE ROW LEVEL SECURITY',
  'ALTER TABLE "company_addon_overrides" ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE "company_addon_overrides" FORCE ROW LEVEL SECURITY',
]

/** Las claves del `INSERT INTO "addons"`, en su orden; `null` si la sentencia no tiene esa forma. */
function clavesDelCatalogo(statement: string): string[] | null {
  const match = /^INSERT INTO "addons" \("key"\) VALUES (.+)$/.exec(statement)
  if (!match) return null
  const tuplas = match[1].split(',').map((item) => item.trim())
  const claves = tuplas.map((tupla) => /^\('([a-z_]+)'\)$/.exec(tupla)?.[1] ?? null)
  return claves.every((clave): clave is string => clave !== null) ? claves : null
}

/** El catálogo nace con su PK y su CHECK de forma, y el INSERT siembra exactamente `esperadas`. */
function upCreaElCatalogo(sql: string, esperadas: readonly string[]): boolean {
  const todas = sentencias(sql)
  return (
    todas[0] === CREATE_ADDONS &&
    JSON.stringify(clavesDelCatalogo(todas[1] ?? '')) === JSON.stringify([...esperadas])
  )
}

/** Las excepciones nacen con su PK compuesta, sus índices y sus tres FK con la acción declarada. */
function upCreaLasExcepciones(sql: string): boolean {
  const todas = sentencias(sql)
  return (
    todas[2] === CREATE_OVERRIDES &&
    JSON.stringify(todas.slice(3, 5)) === JSON.stringify(INDICES) &&
    JSON.stringify(todas.slice(5, 8)) === JSON.stringify(FKS)
  )
}

/** Una excepción prendida y sin autor por cada empresa × añadido, sin filtro. */
function upSiembraLasExcepciones(sql: string): boolean {
  return sentencias(sql)[8] === SIEMBRA_EXCEPCIONES
}

/** RLS `ENABLE` + `FORCE` en las dos tablas, al final y sin nada detrás. */
function upCierraConRls(sql: string): boolean {
  const todas = sentencias(sql)
  return todas.length === 13 && JSON.stringify(todas.slice(9)) === JSON.stringify(RLS)
}

/** El DOWN borra exactamente las dos tablas, la hija antes que el padre. */
function downBorraLasDosTablas(sql: string): boolean {
  return (
    JSON.stringify(sentencias(sql)) ===
    JSON.stringify(['DROP TABLE "company_addon_overrides"', 'DROP TABLE "addons"'])
  )
}

// Añadidos que llegaron despues, cada uno con su propia migracion: esta no los siembra.
const ANADIDOS_POSTERIORES: readonly string[] = ['agente_ia_whatsapp']
const ADDONS_DE_ESTA_MIGRACION = ADDONS.filter((addon) => !ANADIDOS_POSTERIORES.includes(addon))

describe('migración: catálogo de añadidos y excepciones por empresa', () => {
  it('existe exactamente una carpeta, con su migration.sql y su down.sql', () => {
    expect(carpetas).toHaveLength(1)
  })

  const carpeta = join(migrationsDir, carpetas[0] ?? '')
  const up = carpetas.length === 1 ? readFileSync(join(carpeta, 'migration.sql'), 'utf8') : ''
  const down = carpetas.length === 1 ? readFileSync(join(carpeta, 'down.sql'), 'utf8') : ''

  it('R6, R38 — el UP no toca la tabla companies', () => {
    expect(sentencias(up).some((s) => /^ALTER TABLE "companies"/.test(s))).toBe(false)
  })

  it('R6 — crea `addons` con PK y CHECK de forma, y el INSERT lista exactamente ADDONS menos los añadidos posteriores', () => {
    expect(upCreaElCatalogo(up, ADDONS_DE_ESTA_MIGRACION)).toBe(true)
  })

  it('R6 — crea `company_addon_overrides` con PK compuesta, índices y FK (empresa CASCADE, añadido y autor RESTRICT)', () => {
    expect(upCreaLasExcepciones(up)).toBe(true)
  })

  it('R6 — siembra una excepción enabled = true por cada empresa × añadido, sin WHERE y sin autor', () => {
    expect(upSiembraLasExcepciones(up)).toBe(true)
    expect(up).not.toMatch(/\bWHERE\b/i)
  })

  it('R6 — las dos tablas cierran con RLS ENABLE + FORCE', () => {
    expect(upCierraConRls(up)).toBe(true)
  })

  it('R38 — el DOWN borra exactamente las dos tablas, hija antes que padre', () => {
    expect(downBorraLasDosTablas(down)).toBe(true)
  })

  it('R6, R38 — los predicados disparan con copias mutadas del SQL', () => {
    const faltaUna = up.replace(", ('integraciones')", '')
    const sobraUna = up.replace("('integraciones');", "('integraciones'), ('pedidos');")
    const sinCheck = up.replace(`,\n  CONSTRAINT "addons_key_format" CHECK ("key" ~ '^[a-z][a-z_]*$')`, '')
    const empresaRestrict = up.replace(
      'REFERENCES "companies"("id") ON DELETE CASCADE',
      'REFERENCES "companies"("id") ON DELETE RESTRICT',
    )
    const sinIndiceAutor = up.replace(
      'CREATE INDEX "company_addon_overrides_created_by_idx" ON "company_addon_overrides" ("created_by");',
      '',
    )
    const conWhere = up.replace('CROSS JOIN "addons" a;', 'CROSS JOIN "addons" a WHERE c."deleted_at" IS NULL;')
    const apagadas = up.replace('a."key", true,', 'a."key", false,')
    const sinForce = up.replace('ALTER TABLE "company_addon_overrides" FORCE ROW LEVEL SECURITY;', '')
    const algoDetras = `${up}\nALTER TABLE "companies" DROP COLUMN "country";`
    const downAlReves = 'DROP TABLE "addons";\nDROP TABLE "company_addon_overrides";\n'
    const downDeMas = `${down}DROP TABLE "companies";\n`

    for (const mutado of [faltaUna, sobraUna, sinCheck]) {
      expect(mutado).not.toBe(up)
      expect(upCreaElCatalogo(mutado, ADDONS_DE_ESTA_MIGRACION)).toBe(false)
    }
    for (const mutado of [empresaRestrict, sinIndiceAutor]) {
      expect(mutado).not.toBe(up)
      expect(upCreaLasExcepciones(mutado)).toBe(false)
    }
    for (const mutado of [conWhere, apagadas]) {
      expect(mutado).not.toBe(up)
      expect(upSiembraLasExcepciones(mutado)).toBe(false)
    }
    for (const mutado of [sinForce, algoDetras]) {
      expect(upCierraConRls(mutado)).toBe(false)
    }
    expect(downBorraLasDosTablas(downAlReves)).toBe(false)
    expect(downBorraLasDosTablas(downDeMas)).toBe(false)
  })
})
