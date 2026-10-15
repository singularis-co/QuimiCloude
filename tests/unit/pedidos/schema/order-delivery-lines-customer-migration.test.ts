// La migracion que mueve el cliente de la entrega a sus lineas esta escrita a mano (la FK hacia
// `customers` es drift), asi que nada generado avisa si una edicion cambia el orden, pierde un
// aborto o toca otra tabla. Cada predicado se aplica al SQL real y a una version mutada en memoria,
// y cada mutacion comprueba con `not.toBe(...)` que muto de verdad. Que el SQL funcione sobre datos
// lo prueba la integracion (`order-delivery-lines-customer-migration.int.test.ts`).

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
const carpetas = readdirSync(migrationsDir).filter((name) => name.endsWith('_order_delivery_lines_customer'))
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

function matchesInOrder(sql: string, expected: readonly RegExp[]): boolean {
  const s = statements(sql)
  return s.length === expected.length && expected.every((pattern, i) => pattern.test(s[i] ?? ''))
}

const NO_FORCE_DELIVERIES = /^ALTER TABLE "order_deliveries" NO FORCE ROW LEVEL SECURITY$/
const NO_FORCE_LINES = /^ALTER TABLE "order_delivery_lines" NO FORCE ROW LEVEL SECURITY$/
const FORCE_DELIVERIES = /^ALTER TABLE "order_deliveries" FORCE ROW LEVEL SECURITY$/
const FORCE_LINES = /^ALTER TABLE "order_delivery_lines" FORCE ROW LEVEL SECURITY$/
const DO_BLOCK = /^DO \$\$/

const LINES_ADD_COLUMN = /^ALTER TABLE "order_delivery_lines" ADD COLUMN "customer_id" UUID$/
const LINES_BACKFILL =
  /^UPDATE "order_delivery_lines" AS l SET "customer_id" = d\."customer_id" FROM "order_deliveries" AS d WHERE d\."id" = l\."delivery_id" AND d\."company_id" = l\."company_id"$/
const LINES_NOT_NULL = /^ALTER TABLE "order_delivery_lines" ALTER COLUMN "customer_id" SET NOT NULL$/
const LINES_FK =
  /^ALTER TABLE "order_delivery_lines" ADD CONSTRAINT "order_delivery_lines_customer_id_fkey" FOREIGN KEY \("company_id", "customer_id"\) REFERENCES "customers"\("company_id", "id"\) ON DELETE RESTRICT ON UPDATE CASCADE$/
const LINES_INDEX =
  /^CREATE INDEX "order_delivery_lines_customer_id_idx" ON "order_delivery_lines"\("company_id", "customer_id"\)$/
const DROP_OLD_UNIQUE = /^ALTER TABLE "order_delivery_lines" DROP CONSTRAINT "order_delivery_lines_delivery_batch_unique"$/
const ADD_NEW_UNIQUE =
  /^ALTER TABLE "order_delivery_lines" ADD CONSTRAINT "order_delivery_lines_delivery_customer_batch_unique" UNIQUE \("delivery_id", "customer_id", "batch_id"\)$/
const DROP_DELIVERIES_INDEX = /^DROP INDEX "order_deliveries_customer_id_idx"$/
const DROP_DELIVERIES_FK = /^ALTER TABLE "order_deliveries" DROP CONSTRAINT "order_deliveries_customer_id_fkey"$/
const DROP_DELIVERIES_COLUMN = /^ALTER TABLE "order_deliveries" DROP COLUMN "customer_id"$/

const DELIVERIES_ADD_COLUMN = /^ALTER TABLE "order_deliveries" ADD COLUMN "customer_id" UUID$/
const DELIVERIES_BACKFILL =
  /^UPDATE "order_deliveries" AS d SET "customer_id" = l\."customer_id" FROM \(SELECT DISTINCT "delivery_id", "company_id", "customer_id" FROM "order_delivery_lines"\) AS l WHERE l\."delivery_id" = d\."id" AND l\."company_id" = d\."company_id"$/
const DELIVERIES_NOT_NULL = /^ALTER TABLE "order_deliveries" ALTER COLUMN "customer_id" SET NOT NULL$/
const DELIVERIES_FK =
  /^ALTER TABLE "order_deliveries" ADD CONSTRAINT "order_deliveries_customer_id_fkey" FOREIGN KEY \("company_id", "customer_id"\) REFERENCES "customers"\("company_id", "id"\) ON DELETE RESTRICT ON UPDATE CASCADE$/
const DELIVERIES_INDEX =
  /^CREATE INDEX "order_deliveries_customer_id_idx" ON "order_deliveries"\("company_id", "customer_id"\)$/
const DROP_NEW_UNIQUE =
  /^ALTER TABLE "order_delivery_lines" DROP CONSTRAINT "order_delivery_lines_delivery_customer_batch_unique"$/
const ADD_OLD_UNIQUE =
  /^ALTER TABLE "order_delivery_lines" ADD CONSTRAINT "order_delivery_lines_delivery_batch_unique" UNIQUE \("delivery_id", "batch_id"\)$/
const DROP_LINES_INDEX = /^DROP INDEX "order_delivery_lines_customer_id_idx"$/
const DROP_LINES_FK = /^ALTER TABLE "order_delivery_lines" DROP CONSTRAINT "order_delivery_lines_customer_id_fkey"$/
const DROP_LINES_COLUMN = /^ALTER TABLE "order_delivery_lines" DROP COLUMN "customer_id"$/

// --- Predicados ------------------------------------------------------------------------------

/**
 * El UP abre la RLS, aborta si hay entregas sin lineas ANTES de cualquier cambio, rellena el
 * cliente de las lineas, lo hace obligatorio con FK compuesta e indice, cambia la unicidad, quita
 * el cliente de la entrega y cierra la RLS.
 */
export function upInOrder(sql: string): boolean {
  return matchesInOrder(sql, [
    NO_FORCE_DELIVERIES,
    NO_FORCE_LINES,
    DO_BLOCK,
    LINES_ADD_COLUMN,
    LINES_BACKFILL,
    LINES_NOT_NULL,
    LINES_FK,
    LINES_INDEX,
    DROP_OLD_UNIQUE,
    ADD_NEW_UNIQUE,
    DROP_DELIVERIES_INDEX,
    DROP_DELIVERIES_FK,
    DROP_DELIVERIES_COLUMN,
    FORCE_DELIVERIES,
    FORCE_LINES,
  ])
}

/** El aborto del UP busca entregas sin ninguna linea y lanza con su conteo. */
export function upGuard(block: string): boolean {
  return (
    DO_BLOCK.test(block) &&
    /FROM "order_deliveries" AS d WHERE NOT EXISTS \(SELECT 1 FROM "order_delivery_lines" AS l WHERE l\."delivery_id" = d\."id"\)/.test(
      block,
    ) &&
    /IF deliveries_without_lines > 0 THEN RAISE EXCEPTION/.test(block) &&
    /MIGRACION ABORTADA: hay % entrega\(s\) sin lineas/.test(block)
  )
}

/** El DOWN es el UP al reves, con su propio aborto delante de cualquier cambio. */
export function downInOrder(sql: string): boolean {
  return matchesInOrder(sql, [
    NO_FORCE_DELIVERIES,
    NO_FORCE_LINES,
    DO_BLOCK,
    DELIVERIES_ADD_COLUMN,
    DELIVERIES_BACKFILL,
    DELIVERIES_NOT_NULL,
    DELIVERIES_FK,
    DELIVERIES_INDEX,
    DROP_NEW_UNIQUE,
    ADD_OLD_UNIQUE,
    DROP_LINES_INDEX,
    DROP_LINES_FK,
    DROP_LINES_COLUMN,
    FORCE_DELIVERIES,
    FORCE_LINES,
  ])
}

/** El aborto del DOWN cuenta entregas con mas de un cliente y entregas sin lineas, y lanza. */
export function downGuard(block: string): boolean {
  return (
    DO_BLOCK.test(block) &&
    /FROM "order_delivery_lines" GROUP BY "delivery_id" HAVING count\(DISTINCT "customer_id"\) > 1/.test(block) &&
    /IF deliveries_with_several_customers > 0 THEN RAISE EXCEPTION/.test(block) &&
    /ROLLBACK ABORTADO: hay % entrega\(s\) con lineas de mas de un cliente/.test(block) &&
    /WHERE NOT EXISTS \(SELECT 1 FROM "order_delivery_lines" AS l WHERE l\."delivery_id" = d\."id"\)/.test(block) &&
    /IF deliveries_without_lines > 0 THEN RAISE EXCEPTION/.test(block)
  )
}

/** Solo escribe en las dos tablas de la entrega: ni anulaciones, ni asientos, ni lotes. */
export function touchesOnlyDeliveryTables(sql: string): boolean {
  const code = stripSqlComments(sql)
  const named = new Set([...code.matchAll(/(?:TABLE|UPDATE|FROM|REFERENCES|ON|INTO)\s+"([a-z_]+)"/g)].map((m) => m[1]))
  const allowed = new Set(['order_deliveries', 'order_delivery_lines', 'customers'])
  const onlyAllowed = [...named].every((name) => name !== undefined && allowed.has(name))
  const writesOtherTable = /\b(INSERT\s+INTO|DELETE\s+FROM|TRUNCATE)\b/i.test(code)
  const customersOnlyReferenced = !/(TABLE|UPDATE)\s+"customers"/.test(code)
  return onlyAllowed && !writesOtherTable && customersOnlyReferenced
}

// --- Tests ----------------------------------------------------------------------------------

describe('QC-282 — migracion order_delivery_lines_customer (lectura del SQL)', () => {
  it('R31, R32: existe exactamente una carpeta de la migracion, con UP y DOWN', () => {
    expect(carpetas).toHaveLength(1)
    expect(upSource.trim()).not.toBe('')
    expect(downSource.trim()).not.toBe('')
  })

  it('R31: el UP rellena el cliente de cada linea desde su entrega, lo exige y despues lo quita de la entrega', () => {
    expect(upInOrder(upSource)).toBe(true)

    const quitarAntesDeRellenar = upSource
      .replace('ALTER TABLE "order_deliveries" DROP COLUMN "customer_id";', '')
      .replace(
        'ALTER TABLE "order_delivery_lines" ADD COLUMN "customer_id" UUID;',
        'ALTER TABLE "order_deliveries" DROP COLUMN "customer_id";\nALTER TABLE "order_delivery_lines" ADD COLUMN "customer_id" UUID;',
      )
    expect(quitarAntesDeRellenar).not.toBe(upSource)
    expect(upInOrder(quitarAntesDeRellenar), 'quitar la columna de la entrega antes de copiarla pierde el dato').toBe(false)

    const sinEmpresaEnElCruce = upSource.replace(' AND d."company_id" = l."company_id"', '')
    expect(sinEmpresaEnElCruce).not.toBe(upSource)
    expect(upInOrder(sinEmpresaEnElCruce)).toBe(false)

    const anulable = upSource.replace('ALTER TABLE "order_delivery_lines" ALTER COLUMN "customer_id" SET NOT NULL;', '')
    expect(anulable).not.toBe(upSource)
    expect(upInOrder(anulable), 'sin NOT NULL una linea podria quedar sin cliente').toBe(false)
  })

  it('R30: la FK del cliente de la linea es compuesta con la empresa y la unicidad pasa a (entrega, cliente, lote)', () => {
    const fkSinEmpresa = upSource.replace(
      'FOREIGN KEY ("company_id", "customer_id") REFERENCES "customers"("company_id", "id")',
      'FOREIGN KEY ("customer_id") REFERENCES "customers"("id")',
    )
    expect(fkSinEmpresa).not.toBe(upSource)
    expect(upInOrder(fkSinEmpresa), 'sin la empresa, una linea podria apuntar al cliente de otra').toBe(false)

    const unicidadSinCliente = upSource.replace(
      'UNIQUE ("delivery_id", "customer_id", "batch_id")',
      'UNIQUE ("delivery_id", "batch_id")',
    )
    expect(unicidadSinCliente).not.toBe(upSource)
    expect(upInOrder(unicidadSinCliente), 'sin el cliente, dos clientes no podrian llevarse el mismo lote').toBe(false)
  })

  it('R32: el UP aborta con entregas sin lineas antes de cualquier cambio de esquema o de filas', () => {
    const guard = statements(upSource)[2] ?? ''
    expect(upGuard(guard)).toBe(true)

    const guardDetras = upSource
      .replace('ALTER TABLE "order_delivery_lines" ADD COLUMN "customer_id" UUID;', '')
      .replace('END $$;', 'END $$;\nALTER TABLE "order_delivery_lines" ADD COLUMN "customer_id" UUID;')
      .replace(
        'ALTER TABLE "order_delivery_lines" NO FORCE ROW LEVEL SECURITY;',
        'ALTER TABLE "order_delivery_lines" NO FORCE ROW LEVEL SECURITY;\nALTER TABLE "order_delivery_lines" ADD COLUMN "customer_id" UUID;',
      )
    expect(guardDetras).not.toBe(upSource)
    expect(upInOrder(guardDetras), 'el aborto debe ir antes del primer cambio').toBe(false)

    const sinNotExists = guard.replace('WHERE NOT EXISTS', 'WHERE EXISTS')
    expect(sinNotExists).not.toBe(guard)
    expect(upGuard(sinNotExists)).toBe(false)
  })

  it('R32: el DOWN aborta con entregas de varios clientes o sin lineas, y despues devuelve el cliente a la entrega', () => {
    expect(downInOrder(downSource)).toBe(true)
    const guard = statements(downSource)[2] ?? ''
    expect(downGuard(guard)).toBe(true)

    const contarTodas = guard.replace('HAVING count(DISTINCT "customer_id") > 1', 'HAVING count(*) > 1')
    expect(contarTodas).not.toBe(guard)
    expect(downGuard(contarTodas), 'contar lineas en vez de clientes aborta entregas de un solo cliente con dos lotes').toBe(false)

    const sinAbortoDeVacias = guard.replace(/IF deliveries_without_lines > 0 THEN RAISE EXCEPTION/, 'IF false THEN RAISE NOTICE')
    expect(sinAbortoDeVacias).not.toBe(guard)
    expect(downGuard(sinAbortoDeVacias)).toBe(false)

    const quitarLineasPrimero = downSource
      .replace('ALTER TABLE "order_delivery_lines" DROP COLUMN "customer_id";', '')
      .replace(
        'ALTER TABLE "order_deliveries" ADD COLUMN "customer_id" UUID;',
        'ALTER TABLE "order_delivery_lines" DROP COLUMN "customer_id";\nALTER TABLE "order_deliveries" ADD COLUMN "customer_id" UUID;',
      )
    expect(quitarLineasPrimero).not.toBe(downSource)
    expect(downInOrder(quitarLineasPrimero), 'quitar el cliente de las lineas antes de copiarlo pierde el dato').toBe(false)

    const otroNombre = downSource.replace('"order_deliveries_customer_id_fkey"', '"order_deliveries_customer_fkey"')
    expect(otroNombre).not.toBe(downSource)
    expect(downInOrder(otroNombre), 'el DOWN repone los nombres que tenia la entrega').toBe(false)

    const sinForce = downSource.replace('ALTER TABLE "order_delivery_lines" FORCE ROW LEVEL SECURITY;', '')
    expect(sinForce).not.toBe(downSource)
    expect(downInOrder(sinForce)).toBe(false)
  })

  it('R31: ni el UP ni el DOWN tocan anulaciones, asientos, lotes ni la tabla de clientes', () => {
    expect(touchesOnlyDeliveryTables(upSource)).toBe(true)
    expect(touchesOnlyDeliveryTables(downSource)).toBe(true)

    const conAsientos = `${upSource}\nUPDATE "inventory_movements" SET "quantity" = "quantity";`
    expect(touchesOnlyDeliveryTables(conAsientos)).toBe(false)
    const conAnulaciones = `${downSource}\nDELETE FROM "order_delivery_void_lines";`
    expect(touchesOnlyDeliveryTables(conAnulaciones)).toBe(false)
    const alterandoClientes = `${upSource}\nALTER TABLE "customers" ADD COLUMN "x" INT;`
    expect(touchesOnlyDeliveryTables(alterandoClientes)).toBe(false)
  })

  it('R31, R32: los comentarios de produccion de la migracion no citan la ficha ni requisitos', () => {
    for (const source of [upSource, downSource]) {
      const comments = source
        .split(/\r?\n/)
        .filter((line) => line.trimStart().startsWith('--'))
        .join('\n')
      expect(comments).not.toMatch(/QC-\d+|\bR\d+\b|\bD\d+\b|design\.md|requirements\.md/)
    }
  })
})
