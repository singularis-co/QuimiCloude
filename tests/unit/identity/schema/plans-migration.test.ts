// Contrato estático de la migración que crea los planes de la plataforma (`plans`) y sus módulos
// (`plan_addons`), y de sus dos modelos en `db/schema.prisma`.
//
// La lista del `CHECK` de moneda se compara con `PLAN_CURRENCIES`, importada del barril, en vez
// de copiarla. Cada predicado se aplica al texto real y a copias mutadas en memoria para demostrar
// que dispara; los archivos en disco no se tocan.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { PLAN_CURRENCIES } from '@/lib/modules/identity'

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
const carpetas = readdirSync(migrationsDir).filter((name) => /^\d{14}_plans$/.test(name))
const schemaReal = readFileSync(join(repoRoot, 'db', 'schema.prisma'), 'utf8').replace(/\r\n/g, '\n')

/** Las sentencias del SQL, sin comentarios y con los espacios normalizados. */
function sentencias(sql: string): string[] {
  return sql
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((statement) => statement.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').trim())
    .filter((statement) => statement.length > 0)
}

/** El cuerpo entre paréntesis del `CREATE TABLE "<tabla>"`, o `null` si no está. */
function cuerpoDeCreate(sql: string, tabla: string): string | null {
  const prefijo = `CREATE TABLE "${tabla}" (`
  const sentencia = sentencias(sql).find((s) => s.startsWith(prefijo))
  if (!sentencia || !sentencia.endsWith(')')) return null
  return sentencia.slice(prefijo.length, -1)
}

/** Las columnas del `CREATE TABLE`, en su orden, con su definición; `null` si no está la tabla. */
function columnasDe(sql: string, tabla: string): { nombre: string; definicion: string }[] | null {
  const cuerpo = cuerpoDeCreate(sql, tabla)
  if (cuerpo === null) return null
  return cuerpo
    .split(/, (?=")/)
    .map((parte) => /^"([^"]+)" (.+)$/.exec(parte.trim()))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({ nombre: match[1] as string, definicion: match[2] as string }))
}

/** El cuerpo de un `model <Nombre> { ... }` de `db/schema.prisma`, o `null` si no está. */
function cuerpoDeModelo(schema: string, modelo: string): string | null {
  const match = new RegExp(String.raw`^model ${modelo} \{\n([\s\S]*?)\n\}`, 'm').exec(schema)
  return match ? (match[1] as string) : null
}

const COLUMNAS_PLANS = [
  'id',
  'name',
  'description',
  'currency',
  'monthly_price',
  'annual_price',
  'active',
  'created_at',
  'updated_at',
  'deleted_at',
]
const COLUMNAS_PLAN_ADDONS = ['plan_id', 'addon_key']
const SNAKE_CASE_EN_INGLES = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/

/** Ninguna de las dos tablas lleva empresa: ni columna, ni FK a `companies`, en el SQL ni en Prisma. */
function sinEmpresa(sql: string, schema: string): boolean {
  const columnas = [...(columnasDe(sql, 'plans') ?? []), ...(columnasDe(sql, 'plan_addons') ?? [])]
  const modelos = [cuerpoDeModelo(schema, 'Plan'), cuerpoDeModelo(schema, 'PlanAddon')]
  return (
    columnas.length === COLUMNAS_PLANS.length + COLUMNAS_PLAN_ADDONS.length &&
    columnas.every((columna) => !/company/.test(columna.nombre)) &&
    !sentencias(sql).some((s) => /REFERENCES "companies"/.test(s)) &&
    modelos.every((cuerpo) => cuerpo !== null && !/company/i.test(cuerpo))
  )
}

/** Las tablas se llaman `plans` y `plan_addons`, y sus columnas son exactamente las esperadas, en inglés y `snake_case`. */
function nombresEnInglesYSnakeCase(sql: string, schema: string): boolean {
  const plans = columnasDe(sql, 'plans')?.map((columna) => columna.nombre)
  const planAddons = columnasDe(sql, 'plan_addons')?.map((columna) => columna.nombre)
  const plan = cuerpoDeModelo(schema, 'Plan') ?? ''
  const planAddon = cuerpoDeModelo(schema, 'PlanAddon') ?? ''
  return (
    JSON.stringify(plans) === JSON.stringify(COLUMNAS_PLANS) &&
    JSON.stringify(planAddons) === JSON.stringify(COLUMNAS_PLAN_ADDONS) &&
    [...COLUMNAS_PLANS, ...COLUMNAS_PLAN_ADDONS].every((nombre) => SNAKE_CASE_EN_INGLES.test(nombre)) &&
    plan.includes('@@map("plans")') &&
    planAddon.includes('@@map("plan_addons")')
  )
}

/** Las monedas del `CHECK` `plans_currency_allowed`, en su orden; `null` si el CHECK no tiene esa forma. */
function monedasDelCheck(sql: string): string[] | null {
  const cuerpo = cuerpoDeCreate(sql, 'plans') ?? ''
  const match = /CONSTRAINT "plans_currency_allowed" CHECK \("currency" IN \(([^)]*)\)\)/.exec(cuerpo)
  if (!match) return null
  const literales = (match[1] as string).split(',').map((item) => /^'([^']*)'$/.exec(item.trim())?.[1] ?? null)
  return literales.every((literal): literal is string => literal !== null) ? literales : null
}

/** La columna `currency` es obligatoria y el CHECK admite exactamente `esperadas`. */
function monedaCerrada(sql: string, esperadas: readonly string[]): boolean {
  const currency = columnasDe(sql, 'plans')?.find((columna) => columna.nombre === 'currency')
  return (
    currency?.definicion === 'VARCHAR(3) NOT NULL' &&
    JSON.stringify(monedasDelCheck(sql)) === JSON.stringify([...esperadas])
  )
}

/** Los dos precios son `DECIMAL(14,4)` anulables en el SQL y `Decimal(14, 4)` en Prisma. */
function preciosDecimalExacto(sql: string, schema: string): boolean {
  const columnas = columnasDe(sql, 'plans') ?? []
  const plan = cuerpoDeModelo(schema, 'Plan') ?? ''
  return (
    ['monthly_price', 'annual_price'].every(
      (nombre) => columnas.find((columna) => columna.nombre === nombre)?.definicion === 'DECIMAL(14,4)',
    ) &&
    /^\s+monthlyPrice\s+Decimal\?\s+@map\("monthly_price"\) @db\.Decimal\(14, 4\)$/m.test(plan) &&
    /^\s+annualPrice\s+Decimal\?\s+@map\("annual_price"\) @db\.Decimal\(14, 4\)$/m.test(plan)
  )
}

const RLS = [
  'ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE "plans" FORCE ROW LEVEL SECURITY',
  'ALTER TABLE "plan_addons" ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE "plan_addons" FORCE ROW LEVEL SECURITY',
]

/** RLS `ENABLE` + `FORCE` en las dos tablas, al final, sin nada detrás y sin ninguna policy. */
function rlsForzadaSinPolicies(sql: string): boolean {
  const todas = sentencias(sql)
  return (
    JSON.stringify(todas.slice(-RLS.length)) === JSON.stringify(RLS) &&
    !todas.some((s) => /\bPOLICY\b/i.test(s))
  )
}

/** El DOWN borra exactamente las dos tablas, la hija antes que el padre. */
function downBorraLasDosTablas(sql: string): boolean {
  return (
    JSON.stringify(sentencias(sql)) === JSON.stringify(['DROP TABLE "plan_addons"', 'DROP TABLE "plans"'])
  )
}

describe('migración: planes de la plataforma y sus módulos', () => {
  it('existe exactamente una carpeta *_plans', () => {
    expect(carpetas).toHaveLength(1)
  })

  const carpeta = join(migrationsDir, carpetas[0] ?? '')
  const up = carpetas.length === 1 ? readFileSync(join(carpeta, 'migration.sql'), 'utf8') : ''
  const down = carpetas.length === 1 ? readFileSync(join(carpeta, 'down.sql'), 'utf8') : ''

  it('R1 — ni `plans` ni `plan_addons` tienen empresa, en el SQL ni en db/schema.prisma', () => {
    expect(sinEmpresa(up, schemaReal)).toBe(true)
  })

  it('R3 — tablas y columnas exactas, en inglés y snake_case', () => {
    expect(nombresEnInglesYSnakeCase(up, schemaReal)).toBe(true)
  })

  it('R7 — la moneda es obligatoria y el CHECK admite exactamente PLAN_CURRENCIES', () => {
    expect(PLAN_CURRENCIES).toEqual(['CRC', 'USD'])
    expect(monedaCerrada(up, PLAN_CURRENCIES)).toBe(true)
  })

  it('R13 — los dos precios son DECIMAL(14,4) en el SQL y Decimal(14, 4) en Prisma', () => {
    expect(preciosDecimalExacto(up, schemaReal)).toBe(true)
  })

  it('R26 — las dos tablas cierran con RLS ENABLE + FORCE y sin policies', () => {
    expect(rlsForzadaSinPolicies(up)).toBe(true)
  })

  it('R33 — el DOWN borra exactamente las dos tablas, hija antes que padre', () => {
    expect(downBorraLasDosTablas(down)).toBe(true)
  })

  it('R1, R3, R7, R13, R26, R33 — los predicados disparan con copias mutadas', () => {
    const conEmpresa = up.replace(
      '"deleted_at"    TIMESTAMPTZ(6),',
      '"deleted_at"    TIMESTAMPTZ(6),\n  "company_id"    UUID,',
    )
    const conFkEmpresa = `${up}\nALTER TABLE "plans" ADD CONSTRAINT "x" FOREIGN KEY ("id") REFERENCES "companies"("id");`
    const modeloConEmpresa = schemaReal.replace(
      'model PlanAddon {\n',
      'model PlanAddon {\n  companyId String @map("company_id") @db.Uuid\n',
    )
    const enEspanol = up.replace('"monthly_price" DECIMAL(14,4),', '"precio_mensual" DECIMAL(14,4),')
    const camelCase = up.replace('"addon_key" TEXT NOT NULL,\n  CONSTRAINT', '"addonKey" TEXT NOT NULL,\n  CONSTRAINT')
    const otraTabla = schemaReal.replace('@@map("plans")', '@@map("planes")')
    const monedaDeMas = up.replace("('CRC', 'USD')", "('CRC', 'USD', 'EUR')")
    const monedaMinuscula = up.replace("('CRC', 'USD')", "('crc', 'USD')")
    const monedaOpcional = up.replace('"currency"      VARCHAR(3) NOT NULL,', '"currency"      VARCHAR(3),')
    const precioFloat = up.replace('"annual_price"  DECIMAL(14,4),', '"annual_price"  DOUBLE PRECISION,')
    const precioCorto = up.replace('"monthly_price" DECIMAL(14,4),', '"monthly_price" DECIMAL(10,2),')
    const prismaCorto = schemaReal.replace(
      '@map("annual_price") @db.Decimal(14, 4)',
      '@map("annual_price") @db.Decimal(12, 2)',
    )
    const sinForce = up.replace('ALTER TABLE "plan_addons" FORCE ROW LEVEL SECURITY;', '')
    const conPolicy = up.replace(
      'ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;',
      'CREATE POLICY "p" ON "plans" USING (true);\nALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;',
    )
    const algoDetras = `${up}\nALTER TABLE "companies" DROP COLUMN "country";`
    const downAlReves = 'DROP TABLE "plans";\nDROP TABLE "plan_addons";\n'
    const downDeMas = `${down}DROP TABLE "addons";\n`

    for (const mutado of [conEmpresa, conFkEmpresa]) {
      expect(mutado).not.toBe(up)
      expect(sinEmpresa(mutado, schemaReal)).toBe(false)
    }
    expect(modeloConEmpresa).not.toBe(schemaReal)
    expect(sinEmpresa(up, modeloConEmpresa)).toBe(false)

    for (const mutado of [enEspanol, camelCase]) {
      expect(mutado).not.toBe(up)
      expect(nombresEnInglesYSnakeCase(mutado, schemaReal)).toBe(false)
    }
    expect(otraTabla).not.toBe(schemaReal)
    expect(nombresEnInglesYSnakeCase(up, otraTabla)).toBe(false)

    for (const mutado of [monedaDeMas, monedaMinuscula, monedaOpcional]) {
      expect(mutado).not.toBe(up)
      expect(monedaCerrada(mutado, PLAN_CURRENCIES)).toBe(false)
    }
    expect(monedaCerrada(up, ['CRC'])).toBe(false)

    for (const mutado of [precioFloat, precioCorto]) {
      expect(mutado).not.toBe(up)
      expect(preciosDecimalExacto(mutado, schemaReal)).toBe(false)
    }
    expect(prismaCorto).not.toBe(schemaReal)
    expect(preciosDecimalExacto(up, prismaCorto)).toBe(false)

    for (const mutado of [sinForce, conPolicy, algoDetras]) {
      expect(mutado).not.toBe(up)
      expect(rlsForzadaSinPolicies(mutado)).toBe(false)
    }

    expect(downBorraLasDosTablas(downAlReves)).toBe(false)
    expect(downBorraLasDosTablas(downDeMas)).toBe(false)
  })
})
