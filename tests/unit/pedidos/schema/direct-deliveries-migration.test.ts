// Contrato ESTATICO del SQL de `direct_deliveries` y de los dos valores de enum que la preceden.
//
// Vigila lo que Prisma no regenera: que la entrega sin pedido viva en `order_deliveries` sin tabla
// nueva ni `updated_at`/`deleted_at`, el XOR pedido/producto, la nota, la FK compuesta hacia
// `products`, los cinco CHECK reescritos (y el de `order_id` intacto), los dos disparadores, que
// ningun indice compare `"kind"::text`, que cada `down.sql` aborte antes de tocar nada y revierta
// su `migration.sql`, y que los nombres nuevos esten en ingles.
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

const migrationsDir = join(findRepoRoot(dirname(fileURLToPath(import.meta.url))), 'db', 'migrations')

function findMigrationDir(suffix: string): string {
  const candidates = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{14}_/.test(entry.name) && entry.name.endsWith(suffix))
    .map((entry) => entry.name)
  if (candidates.length !== 1) {
    throw new Error(`se esperaba exactamente una migracion terminada en "${suffix}"; hay ${String(candidates.length)}`)
  }
  return candidates[0] as string
}

const enumName = findMigrationDir('_inventory_movement_kind_direct_delivery')
const directName = findMigrationDir('_direct_deliveries')
const lastBatchName = findMigrationDir('_products_last_batch_at')

const read = (dir: string, file: string): string => readFileSync(join(migrationsDir, dir, file), 'utf8')
const enumUpSource = read(enumName, 'migration.sql')
const enumDownSource = read(enumName, 'down.sql')
const upSource = read(directName, 'migration.sql')
const downSource = read(directName, 'down.sql')

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}

/** Sentencias ejecutables, normalizadas a un espacio; respeta los cuerpos `$$ ... $$`. */
function statements(sql: string): readonly string[] {
  const source = stripSqlComments(sql)
  const out: string[] = []
  let current = ''
  let inDollar = false
  for (let i = 0; i < source.length; i += 1) {
    if (source.slice(i, i + 2) === '$$') {
      inDollar = !inDollar
      current += '$$'
      i += 1
      continue
    }
    const char = source[i] as string
    if (char === ';' && !inDollar) {
      out.push(current)
      current = ''
    } else {
      current += char
    }
  }
  out.push(current)
  return out.map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s.length > 0)
}

const upStatements = statements(upSource)
const downStatements = statements(downSource)
const enumDownStatements = statements(enumDownSource)

/** Las cinco reescrituras de CHECK, con su texto nuevo y el previo que el DOWN repone. */
const REWRITTEN_CHECKS = {
  inventory_movements_order_delivery_id_matches_kind: {
    up: `CHECK (("kind"::text IN ('delivery', 'direct_delivery')) = ("order_delivery_id" IS NOT NULL))`,
    down: `CHECK (("kind"::text = 'delivery') = ("order_delivery_id" IS NOT NULL))`,
  },
  inventory_movements_delivery_quantity_negative: {
    up: `CHECK ("kind"::text NOT IN ('delivery', 'direct_delivery') OR "quantity" < 0)`,
    down: `CHECK ("kind"::text <> 'delivery' OR "quantity" < 0)`,
  },
  inventory_movements_order_delivery_void_id_matches_kind: {
    up: `CHECK (("kind"::text IN ('delivery_void', 'direct_delivery_void')) = ("order_delivery_void_id" IS NOT NULL))`,
    down: `CHECK (("kind"::text = 'delivery_void') = ("order_delivery_void_id" IS NOT NULL))`,
  },
  inventory_movements_delivery_void_quantity_positive: {
    up: `CHECK ("kind"::text NOT IN ('delivery_void', 'direct_delivery_void') OR "quantity" > 0)`,
    down: `CHECK ("kind"::text <> 'delivery_void' OR "quantity" > 0)`,
  },
  inventory_movements_reason_matches_kind: {
    up: `CHECK (("kind"::text = 'adjustment' AND "reason" IS NOT NULL) OR ("kind"::text IN ('opening', 'consumption', 'production', 'delivery', 'delivery_void', 'direct_delivery', 'direct_delivery_void') AND "reason" IS NULL))`,
    down: `CHECK (("kind"::text = 'adjustment' AND "reason" IS NOT NULL) OR ("kind"::text IN ('opening', 'consumption', 'production', 'delivery', 'delivery_void') AND "reason" IS NULL))`,
  },
} as const

function addCheck(name: string, body: string): string {
  return `ALTER TABLE "inventory_movements" ADD CONSTRAINT "${name}" ${body}`
}

/** ¿El SQL suelta y vuelve a crear cada CHECK con el texto de `side`? */
function rewritesChecks(sql: readonly string[], side: 'up' | 'down'): boolean {
  return Object.entries(REWRITTEN_CHECKS).every(([name, texts]) => {
    const drop = sql.indexOf(`ALTER TABLE "inventory_movements" DROP CONSTRAINT "${name}"`)
    const add = sql.indexOf(addCheck(name, texts[side]))
    return drop !== -1 && add > drop
  })
}

/** ¿El bloque `DO` que aborta va antes de cualquier DDL que no sea el parentesis de RLS? */
function abortsBeforeAnyChange(sql: readonly string[], raisePattern: RegExp): boolean {
  const abort = sql.findIndex((s) => s.startsWith('DO $$') && raisePattern.test(s))
  if (abort === -1) return false
  return sql.slice(0, abort).every((s) => /ROW LEVEL SECURITY$/.test(s))
}

const DIRECT_ABORT = /RAISE EXCEPTION[\s\S]*ROLLBACK ABORTADO/
const ENUM_ABORT = /IF EXISTS \(SELECT 1 FROM "inventory_movements" WHERE "kind"::text IN \('direct_delivery', 'direct_delivery_void'\)\) THEN RAISE EXCEPTION/

/** Identificadores que crea la migracion: columnas, restricciones, indices, funciones, disparadores y valores. */
function createdIdentifiers(up: string, enumUp: string): readonly string[] {
  const sql = stripSqlComments(up) + stripSqlComments(enumUp)
  const patterns = [
    /ADD COLUMN "(\w+)"/g,
    /ADD CONSTRAINT "(\w+)"/g,
    /CREATE (?:UNIQUE )?INDEX "(\w+)"/g,
    /CREATE FUNCTION "(\w+)"/g,
    /CREATE TRIGGER "(\w+)"/g,
    /ADD VALUE '(\w+)'/g,
  ]
  return [...new Set(patterns.flatMap((pattern) => [...sql.matchAll(pattern)].map((m) => m[1] as string)))].sort()
}

describe('inventory_movement_kind_direct_delivery', () => {
  it('R42: va detras de la ultima migracion previa y antes que direct_deliveries', () => {
    expect(lastBatchName < enumName).toBe(true)
    expect(enumName < directName).toBe(true)
  })

  it('R41: el UP solo anade los dos valores, en ingles y en este orden', () => {
    expect(statements(enumUpSource)).toEqual([
      `ALTER TYPE "InventoryMovementKind" ADD VALUE 'direct_delivery'`,
      `ALTER TYPE "InventoryMovementKind" ADD VALUE 'direct_delivery_void'`,
    ])
  })

  it('R42: el DOWN aborta si quedan asientos de los tipos nuevos ANTES de tocar el tipo, y lo recrea sin ellos', () => {
    expect(abortsBeforeAnyChange(enumDownStatements, ENUM_ABORT)).toBe(true)
    expect(enumDownStatements).toContain(
      `CREATE TYPE "InventoryMovementKind" AS ENUM ('opening', 'adjustment', 'consumption', 'production', 'delivery', 'delivery_void')`,
    )
    const rename = enumDownStatements.indexOf(`ALTER TYPE "InventoryMovementKind" RENAME TO "InventoryMovementKind_old"`)
    const drop = enumDownStatements.indexOf(`DROP TYPE "InventoryMovementKind_old"`)
    expect(rename).toBeGreaterThan(0)
    expect(drop).toBeGreaterThan(rename)
    // Los CHECK y el indice que comparan con un literal del tipo se sueltan antes y se reponen despues.
    for (const name of ['inventory_movements_order_presentation_line_id_matches_kind', 'inventory_movements_production_quantity_positive']) {
      const dropAt = enumDownStatements.indexOf(`ALTER TABLE "inventory_movements" DROP CONSTRAINT "${name}"`)
      const addAt = enumDownStatements.findIndex((s) => s.startsWith(`ALTER TABLE "inventory_movements" ADD CONSTRAINT "${name}"`))
      expect(dropAt, name).toBeGreaterThan(0)
      expect(dropAt, name).toBeLessThan(rename)
      expect(addAt, name).toBeGreaterThan(drop)
    }
    expect(enumDownStatements.indexOf(`DROP INDEX "inventory_movements_one_production_per_line"`)).toBeLessThan(rename)
    expect(enumDownStatements.at(-1)).toMatch(/^CREATE UNIQUE INDEX "inventory_movements_one_production_per_line"/)
  })

  it('R42: el predicado del DOWN detecta una mutacion que quita el aborto', () => {
    const mutated = enumDownStatements.filter((s) => !s.startsWith('DO $$'))
    expect(abortsBeforeAnyChange(mutated, ENUM_ABORT)).toBe(false)
  })
})

describe('direct_deliveries', () => {
  it('R41: no crea tablas ni columnas updated_at/deleted_at; solo anade product_id y note a order_deliveries', () => {
    const sql = stripSqlComments(upSource)
    expect(sql).not.toMatch(/CREATE TABLE/i)
    expect(sql).not.toMatch(/updated_at|deleted_at/i)
    expect(upStatements.filter((s) => /ADD COLUMN/.test(s))).toEqual([
      `ALTER TABLE "order_deliveries" ADD COLUMN "product_id" UUID`,
      `ALTER TABLE "order_deliveries" ADD COLUMN "note" TEXT`,
    ])
  })

  it('R40: la entrega es de un pedido o de un producto, la nota solo sin pedido y de 1 a 500, y el producto es de la misma empresa', () => {
    expect(upStatements).toContain(`ALTER TABLE "order_deliveries" ALTER COLUMN "order_id" DROP NOT NULL`)
    expect(upStatements).toContain(
      `ALTER TABLE "order_deliveries" ADD CONSTRAINT "order_deliveries_order_xor_product" CHECK (("order_id" IS NULL) <> ("product_id" IS NULL))`,
    )
    expect(upStatements).toContain(
      `ALTER TABLE "order_deliveries" ADD CONSTRAINT "order_deliveries_note_only_direct" CHECK ("note" IS NULL OR ("order_id" IS NULL AND length(btrim("note")) BETWEEN 1 AND 500))`,
    )
    expect(upStatements).toContain(
      `ALTER TABLE "order_deliveries" ADD CONSTRAINT "order_deliveries_product_id_fkey" FOREIGN KEY ("company_id", "product_id") REFERENCES "products"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    )
    expect(upStatements).toContain(
      `CREATE INDEX "order_deliveries_product_id_idx" ON "order_deliveries"("company_id", "product_id")`,
    )
    expect(upStatements).toContain(
      `ALTER TABLE "order_delivery_lines" ALTER COLUMN "order_presentation_line_id" DROP NOT NULL`,
    )
  })

  it('R40: reescribe los cinco CHECK de inventory_movements y deja intacto el de order_id', () => {
    expect(rewritesChecks(upStatements, 'up')).toBe(true)
    expect(upStatements.some((s) => s.includes('CONSTRAINT "inventory_movements_order_id_matches_kind"'))).toBe(false)
  })

  it('R40: el predicado de los CHECK detecta una mutacion que deja fuera direct_delivery', () => {
    const mutated = upStatements.map((s) => s.replace(`IN ('delivery', 'direct_delivery')) =`, `= 'delivery') =`))
    expect(rewritesChecks(mutated, 'up')).toBe(false)
  })

  it('R40: los dos disparadores cubren INSERT y UPDATE y comparan "kind"::text; ningun indice lo hace', () => {
    expect(upStatements).toContain(
      `CREATE TRIGGER "order_delivery_lines_check_origin" BEFORE INSERT OR UPDATE ON "order_delivery_lines" FOR EACH ROW EXECUTE FUNCTION "order_delivery_lines_check_origin"()`,
    )
    expect(upStatements).toContain(
      `CREATE TRIGGER "inventory_movements_check_delivery_origin" BEFORE INSERT OR UPDATE ON "inventory_movements" FOR EACH ROW EXECUTE FUNCTION "inventory_movements_check_delivery_origin"()`,
    )
    const lineas = upStatements.find((s) => s.startsWith('CREATE FUNCTION "order_delivery_lines_check_origin"')) ?? ''
    expect(lineas).toContain(`b."product_id" = d."product_id"`)
    expect(lineas).toContain(`ELSIF NEW."order_presentation_line_id" IS NULL THEN`)
    const asientos = upStatements.find((s) => s.startsWith('CREATE FUNCTION "inventory_movements_check_delivery_origin"')) ?? ''
    expect(asientos).toContain(`(NEW."kind"::text = 'direct_delivery')`)
    expect(asientos).toContain(`(NEW."kind"::text = 'direct_delivery_void')`)
    expect(upStatements.filter((s) => /^CREATE (UNIQUE )?INDEX/.test(s) && /::text/.test(s))).toEqual([])
  })

  it('R42: el DOWN aborta con una entrega sin pedido o un asiento de tipo nuevo ANTES de cambiar nada', () => {
    expect(abortsBeforeAnyChange(downStatements, DIRECT_ABORT)).toBe(true)
    const abort = downStatements.find((s) => s.startsWith('DO $$')) ?? ''
    expect(abort).toContain(`WHERE "order_id" IS NULL OR "product_id" IS NOT NULL OR "note" IS NOT NULL`)
    expect(abort).toContain(`WHERE "kind"::text IN ('direct_delivery', 'direct_delivery_void')`)
    const mutated = downStatements.filter((s) => !s.startsWith('DO $$'))
    expect(abortsBeforeAnyChange(mutated, DIRECT_ABORT)).toBe(false)
  })

  it('R42: el DOWN repone los cinco CHECK con su texto previo y quita disparadores, columnas, FK, indice y CHECK nuevos', () => {
    expect(rewritesChecks(downStatements, 'down')).toBe(true)
    for (const expected of [
      `DROP TRIGGER "inventory_movements_check_delivery_origin" ON "inventory_movements"`,
      `DROP FUNCTION "inventory_movements_check_delivery_origin"()`,
      `DROP TRIGGER "order_delivery_lines_check_origin" ON "order_delivery_lines"`,
      `DROP FUNCTION "order_delivery_lines_check_origin"()`,
      `ALTER TABLE "order_delivery_lines" ALTER COLUMN "order_presentation_line_id" SET NOT NULL`,
      `DROP INDEX "order_deliveries_product_id_idx"`,
      `ALTER TABLE "order_deliveries" DROP CONSTRAINT "order_deliveries_product_id_fkey"`,
      `ALTER TABLE "order_deliveries" DROP CONSTRAINT "order_deliveries_note_only_direct"`,
      `ALTER TABLE "order_deliveries" DROP CONSTRAINT "order_deliveries_order_xor_product"`,
      `ALTER TABLE "order_deliveries" DROP COLUMN "note"`,
      `ALTER TABLE "order_deliveries" DROP COLUMN "product_id"`,
      `ALTER TABLE "order_deliveries" ALTER COLUMN "order_id" SET NOT NULL`,
    ]) {
      expect(downStatements, expected).toContain(expected)
    }
    // El parentesis de RLS se cierra: las dos tablas vuelven a FORCE.
    expect(downStatements.slice(-2)).toEqual([
      `ALTER TABLE "order_deliveries" FORCE ROW LEVEL SECURITY`,
      `ALTER TABLE "inventory_movements" FORCE ROW LEVEL SECURITY`,
    ])
    expect(stripSqlComments(downSource)).not.toMatch(/CASCADE/)
  })

  it('R41: todo lo que crean las dos migraciones tiene nombre en ingles', () => {
    expect(createdIdentifiers(upSource, enumUpSource)).toEqual(
      [
        'direct_delivery',
        'direct_delivery_void',
        'inventory_movements_check_delivery_origin',
        'inventory_movements_delivery_quantity_negative',
        'inventory_movements_delivery_void_quantity_positive',
        'inventory_movements_order_delivery_id_matches_kind',
        'inventory_movements_order_delivery_void_id_matches_kind',
        'inventory_movements_reason_matches_kind',
        'note',
        'order_deliveries_note_only_direct',
        'order_deliveries_order_xor_product',
        'order_deliveries_product_id_fkey',
        'order_deliveries_product_id_idx',
        'order_delivery_lines_check_origin',
        'product_id',
      ].sort(),
    )
  })

  it('los comentarios de las cuatro piezas de SQL no citan fichas, requisitos ni el spec', () => {
    for (const sql of [enumUpSource, enumDownSource, upSource, downSource]) {
      expect(sql).not.toMatch(/QC-\d+|\bR\d+\b|\bD\d+\b|design\.md|requirements\.md/)
    }
  })
})
