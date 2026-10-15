// La migracion de la unicidad del lote por producto + presentacion esta escrita a mano: Prisma no
// modela indices parciales, asi que nada generado avisa si una edicion cambia el orden o pierde el
// aborto del DOWN. Cada predicado se aplica al SQL real y a una version mutada en memoria, y cada
// mutacion comprueba con `not.toBe(...)` que muto de verdad. Que los indices muerdan en la base lo
// prueba la integracion (`product-batch-lot-per-presentation-migration.int.test.ts`).

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

const migrationsDir = join(findRepoRoot(dirname(fileURLToPath(import.meta.url))), 'db', 'migrations')
const carpetas = readdirSync(migrationsDir).filter((name) =>
  name.endsWith('_product_batches_lot_per_presentation'),
)
const migrationDir = join(migrationsDir, carpetas[0] ?? '__no_existe__')
const upSource = readFileSync(join(migrationDir, 'migration.sql'), 'utf8')
const downSource = readFileSync(join(migrationDir, 'down.sql'), 'utf8')

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}

/** Sentencias ejecutables, con el bloque `DO $$ ... $$` entero como una sola. */
function statements(sql: string): readonly string[] {
  const flat = stripSqlComments(sql).replace(/\s+/g, ' ')
  const out: string[] = []
  let rest = flat
  for (;;) {
    const doStart = rest.indexOf('DO $$')
    const head = doStart === -1 ? rest : rest.slice(0, doStart)
    out.push(...head.split(';'))
    if (doStart === -1) break
    const end = rest.indexOf('$$;', doStart + 5)
    if (end === -1) {
      out.push(rest.slice(doStart))
      break
    }
    out.push(rest.slice(doStart, end + 2))
    rest = rest.slice(end + 3)
  }
  return out.map((s) => s.trim()).filter((s) => s.length > 0)
}

const CREATE_WITH_PRESENTATION =
  /^CREATE UNIQUE INDEX "product_batches_product_presentation_lot_unique" ON "product_batches" \("company_id", "product_id", "presentation_id", "lot"\) WHERE "presentation_id" IS NOT NULL$/
const CREATE_WITHOUT_PRESENTATION =
  /^CREATE UNIQUE INDEX "product_batches_product_lot_unique" ON "product_batches" \("company_id", "product_id", "lot"\) WHERE "presentation_id" IS NULL$/
const DROP_OLD = /^DROP INDEX "product_batches_company_lot_unique"$/
const CREATE_OLD =
  /^CREATE UNIQUE INDEX "product_batches_company_lot_unique" ON "product_batches" \("company_id", "lot"\)$/
const DROP_WITH_PRESENTATION = /^DROP INDEX "product_batches_product_presentation_lot_unique"$/
const DROP_WITHOUT_PRESENTATION = /^DROP INDEX "product_batches_product_lot_unique"$/
const NO_FORCE = /^ALTER TABLE "product_batches" NO FORCE ROW LEVEL SECURITY$/
const ENABLE = /^ALTER TABLE "product_batches" ENABLE ROW LEVEL SECURITY$/
const FORCE = /^ALTER TABLE "product_batches" FORCE ROW LEVEL SECURITY$/

// --- Predicados ------------------------------------------------------------------------------

/** El UP es exactamente: crear con presentacion, crear sin ella, quitar el viejo. */
export function upInOrder(sql: string): boolean {
  const s = statements(sql)
  return (
    s.length === 3 &&
    CREATE_WITH_PRESENTATION.test(s[0] ?? '') &&
    CREATE_WITHOUT_PRESENTATION.test(s[1] ?? '') &&
    DROP_OLD.test(s[2] ?? '')
  )
}

/** El UP no escribe filas: ni DML ni bloques procedurales. */
export function upTouchesNoRows(sql: string): boolean {
  const code = stripSqlComments(sql)
  return !/\b(INSERT|UPDATE|DELETE|TRUNCATE)\b/i.test(code) && !/\bDO \$\$/.test(code)
}

/**
 * El DOWN abre la RLS, aborta si hay codigos repetidos en una empresa ANTES de cualquier indice,
 * recrea el viejo, quita los dos nuevos y cierra la RLS con ENABLE + FORCE.
 */
export function downInOrder(sql: string): boolean {
  const s = statements(sql)
  if (s.length !== 7) return false
  const [noForce, guard, createOld, dropA, dropB, enable, force] = s as [
    string, string, string, string, string, string, string,
  ]
  const drops = [dropA, dropB]
  return (
    NO_FORCE.test(noForce) &&
    abortGuard(guard) &&
    CREATE_OLD.test(createOld) &&
    drops.some((d) => DROP_WITH_PRESENTATION.test(d)) &&
    drops.some((d) => DROP_WITHOUT_PRESENTATION.test(d)) &&
    ENABLE.test(enable) &&
    FORCE.test(force)
  )
}

/** El bloque cuenta por (empresa, codigo), sin filtrar producto ni presentacion, y aborta. */
export function abortGuard(block: string): boolean {
  return (
    block.startsWith('DO $$') &&
    /GROUP BY "company_id", "lot" HAVING count\(\*\) > 1/.test(block) &&
    !/product_id|presentation_id/.test(block) &&
    /IF duplicated_lots > 0 THEN RAISE EXCEPTION/.test(block) &&
    /renombra esos lotes antes de revertir/.test(block) &&
    /codigo\(s\) de lote repetido\(s\)/.test(block)
  )
}

// --- Tests ----------------------------------------------------------------------------------

describe('QC-284 — migracion product_batches_lot_per_presentation (lectura del SQL)', () => {
  it('R28: existe exactamente una carpeta de la migracion, con UP y DOWN', () => {
    expect(carpetas).toHaveLength(1)
    expect(upSource.trim()).not.toBe('')
    expect(downSource.trim()).not.toBe('')
  })

  it('R1, R2, R28: el UP crea los dos indices parciales y despues quita el de (empresa, codigo)', () => {
    expect(upInOrder(upSource)).toBe(true)

    const quitarPrimero = `DROP INDEX "product_batches_company_lot_unique";\n${upSource.replace(
      'DROP INDEX "product_batches_company_lot_unique";',
      '',
    )}`
    expect(quitarPrimero).not.toBe(upSource)
    expect(upInOrder(quitarPrimero), 'quitar el viejo antes de crear los nuevos deja la tabla sin unicidad').toBe(false)

    const sinParcial = upSource.replace('WHERE "presentation_id" IS NULL', '')
    expect(sinParcial).not.toBe(upSource)
    expect(upInOrder(sinParcial), 'sin el WHERE, el indice de tres columnas prohibe lo que R3 admite').toBe(false)

    const sinEmpresa = upSource.replace('("company_id", "product_id", "presentation_id", "lot")', '("product_id", "presentation_id", "lot")')
    expect(sinEmpresa).not.toBe(upSource)
    expect(upInOrder(sinEmpresa)).toBe(false)
  })

  it('R28: el UP solo es DDL y no modifica ninguna fila', () => {
    expect(upTouchesNoRows(upSource)).toBe(true)
    const conUpdate = `${upSource}\nUPDATE "product_batches" SET "lot" = "lot";`
    expect(upTouchesNoRows(conUpdate)).toBe(false)
  })

  it('R29: el DOWN aborta con codigos repetidos antes de tocar indices, recrea el viejo y quita los nuevos', () => {
    expect(downInOrder(downSource)).toBe(true)

    const recrearAntesDelAborto = downSource.replace(
      'CREATE UNIQUE INDEX "product_batches_company_lot_unique" ON "product_batches" ("company_id", "lot");',
      '',
    ).replace(
      'ALTER TABLE "product_batches" NO FORCE ROW LEVEL SECURITY;',
      'ALTER TABLE "product_batches" NO FORCE ROW LEVEL SECURITY;\nCREATE UNIQUE INDEX "product_batches_company_lot_unique" ON "product_batches" ("company_id", "lot");',
    )
    expect(recrearAntesDelAborto).not.toBe(downSource)
    expect(downInOrder(recrearAntesDelAborto)).toBe(false)

    const quitarAntesDeRecrear = downSource
      .replace('DROP INDEX "product_batches_product_lot_unique";', '')
      .replace(
        'CREATE UNIQUE INDEX "product_batches_company_lot_unique"',
        'DROP INDEX "product_batches_product_lot_unique";\nCREATE UNIQUE INDEX "product_batches_company_lot_unique"',
      )
    expect(quitarAntesDeRecrear).not.toBe(downSource)
    expect(downInOrder(quitarAntesDeRecrear), 'si el viejo falla, no debe haberse quitado nada').toBe(false)

    const sinForce = downSource.replace('ALTER TABLE "product_batches" FORCE ROW LEVEL SECURITY;', '')
    expect(sinForce).not.toBe(downSource)
    expect(downInOrder(sinForce)).toBe(false)
  })

  it('R29: el aborto cuenta por (empresa, codigo), dice cuantos y que hacer', () => {
    const guard = statements(downSource)[1] ?? ''
    expect(abortGuard(guard)).toBe(true)
    expect(guard).toContain('product_batches_company_lot_unique')

    const porProducto = guard.replace('GROUP BY "company_id", "lot"', 'GROUP BY "company_id", "product_id", "lot"')
    expect(porProducto).not.toBe(guard)
    expect(abortGuard(porProducto), 'contar por producto deja pasar lo que el indice viejo rechaza').toBe(false)

    const sinInstruccion = guard.replace('renombra esos lotes antes de revertir', 'revisa')
    expect(sinInstruccion).not.toBe(guard)
    expect(abortGuard(sinInstruccion)).toBe(false)
  })

  it('R28: los comentarios de produccion de la migracion no citan la ficha ni requisitos', () => {
    for (const source of [upSource, downSource]) {
      const comments = source.split(/\r?\n/).filter((line) => line.trimStart().startsWith('--')).join('\n')
      expect(comments).not.toMatch(/QC-\d+|\bR\d+\b|design\.md/)
    }
  })
})
