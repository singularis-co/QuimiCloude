/**
 * Las restricciones de `plans` y `plan_addons` contra Postgres real: lo que la propia base
 * garantiza escriba quien escriba, sin casos de uso por delante.
 *
 * AISLAMIENTO — `transaccion`: cada `it` corre en una `prisma.$transaction` interactiva que termina
 * lanzando `RollbackSignal`. Ningún plan, empresa ni excepción sobrevive al caso. Los nombres de
 * plan llevan un `randomUUID` porque la unicidad del nombre es global entre los planes no borrados.
 *
 * LO QUE SE ESPERA QUE FALLE va en SQL crudo —omitir una columna obligatoria no compila con la API
 * tipada— y pasa por una función PL/pgSQL efímera de `pg_temp`, creada dentro de la transacción:
 * su bloque `EXCEPTION` abre un savepoint implícito y devuelve `RETURNED_SQLSTATE`,
 * `CONSTRAINT_NAME` y `COLUMN_NAME` como campos, no como el texto traducido del servidor. Así cada
 * caso afirma contra la restricción concreta y no contra «algo falló». Mismo patrón que
 * `work-groups-constraints.int.test.ts`. Los caminos felices y las lecturas van con Prisma.
 */
import { randomUUID } from 'node:crypto'

import { Prisma } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'

import { ADDONS, normalizeCompanyName } from '@/lib/modules/identity'
import { prisma } from '@/lib/shared/db/prisma'

type Tx = Prisma.TransactionClient

class RollbackSignal extends Error {
  constructor() {
    super('rollback de aislamiento del test')
    this.name = 'RollbackSignal'
  }
}

const CREATE_TRY_FUNCTION = `
  CREATE OR REPLACE FUNCTION pg_temp.qc182_try(stmt text) RETURNS text AS $qc182fn$
  DECLARE
    v_state text; v_constraint text; v_column text;
  BEGIN
    EXECUTE stmt;
    RETURN 'ACEPTADO||';
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS
      v_state = RETURNED_SQLSTATE, v_constraint = CONSTRAINT_NAME, v_column = COLUMN_NAME;
    RETURN v_state || '|' || coalesce(v_constraint, '') || '|' || coalesce(v_column, '');
  END $qc182fn$ LANGUAGE plpgsql`

async function inRolledBackTransaction(body: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(CREATE_TRY_FUNCTION)
        await body(tx)
        throw new RollbackSignal()
      },
      { maxWait: 10_000, timeout: 60_000 },
    )
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error
  }
}

afterAll(async () => {
  await prisma.$disconnect()
})

/** SQLSTATE de Postgres usados aquí. Son estables y no dependen del idioma del servidor. */
const NOT_NULL_VIOLATION = '23502'
const FOREIGN_KEY_VIOLATION = '23503'
const UNIQUE_VIOLATION = '23505'
const CHECK_VIOLATION = '23514'
const STRING_DATA_RIGHT_TRUNCATION = '22001'
const NUMERIC_VALUE_OUT_OF_RANGE = '22003'

interface Outcome {
  readonly sqlState: string
  readonly constraint: string | null
  readonly column: string | null
}

/** Corre `sql` y devuelve lo que respondió la base; `ACEPTADO` si no falló. */
async function attempt(tx: Tx, sql: string): Promise<Outcome> {
  const rows = await tx.$queryRawUnsafe<{ r: string }[]>(
    `SELECT pg_temp.qc182_try($qc182stmt$${sql}$qc182stmt$) AS r`,
  )
  const [sqlState = '', constraint = '', column = ''] = (rows[0]?.r ?? '').split('|')
  return {
    sqlState,
    constraint: constraint === '' ? null : constraint,
    column: column === '' ? null : column,
  }
}

async function expectRejected(tx: Tx, sql: string, what: string): Promise<Outcome> {
  const outcome = await attempt(tx, sql)
  if (outcome.sqlState === 'ACEPTADO') {
    throw new Error(`se esperaba que la base rechazara la operacion, pero la acepto: ${what}`)
  }
  return outcome
}

async function expectAccepted(tx: Tx, sql: string, what: string): Promise<void> {
  const outcome = await attempt(tx, sql)
  expect(outcome, `se esperaba que la base aceptara: ${what}`).toEqual({
    sqlState: 'ACEPTADO',
    constraint: null,
    column: null,
  })
}

/** Literal SQL de un texto. Los valores los fabrica el propio test; solo hay que escapar `'`. */
function lit(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function uniqueName(prefix = 'Plan'): string {
  return `${prefix} qc182 ${randomUUID()}`
}

/**
 * `INSERT` crudo de un plan. Cada columna lleva un literal SQL por defecto válido; `columns` lo
 * cambia (p. ej. `'NULL'`) y `omit` quita la columna del `INSERT`.
 */
function insertPlanSql(
  columns: Readonly<Record<string, string>> = {},
  omit: readonly string[] = [],
): string {
  const values: Record<string, string> = {
    name: lit(uniqueName()),
    currency: lit('CRC'),
    monthly_price: '10',
    active: 'true',
    updated_at: 'CURRENT_TIMESTAMP',
    ...columns,
  }
  const names = Object.keys(values).filter((name) => !omit.includes(name))
  return (
    `INSERT INTO "plans" (${names.map((name) => `"${name}"`).join(', ')}) ` +
    `VALUES (${names.map((name) => values[name]).join(', ')})`
  )
}

function insertPlanAddonSql(planId: string, addonKey: string): string {
  return `INSERT INTO "plan_addons" ("plan_id", "addon_key") VALUES (CAST(${lit(planId)} AS uuid), ${lit(addonKey)})`
}

interface PlanData {
  readonly name?: string
  readonly description?: string | null
  readonly currency?: string
  readonly monthlyPrice?: string | null
  readonly annualPrice?: string | null
  readonly active?: boolean
}

async function createPlan(tx: Tx, data: PlanData = {}): Promise<string> {
  const plan = await tx.plan.create({
    data: {
      name: data.name ?? uniqueName(),
      description: data.description === undefined ? 'Plan de prueba' : data.description,
      currency: data.currency ?? 'USD',
      monthlyPrice: data.monthlyPrice === undefined ? new Prisma.Decimal('10') : decimalOrNull(data.monthlyPrice),
      annualPrice: data.annualPrice === undefined ? null : decimalOrNull(data.annualPrice),
      active: data.active ?? true,
    },
    select: { id: true },
  })
  return plan.id
}

function decimalOrNull(value: string | null): Prisma.Decimal | null {
  return value === null ? null : new Prisma.Decimal(value)
}

async function addonsOf(tx: Tx, planId: string): Promise<string[]> {
  const rows = await tx.planAddon.findMany({ where: { planId }, select: { addonKey: true } })
  return rows.map((row) => row.addonKey).sort()
}

async function createCompany(tx: Tx): Promise<string> {
  const name = `qc182-${randomUUID()}`
  const company = await tx.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name) },
    select: { id: true },
  })
  return company.id
}

function allOverrides(tx: Tx) {
  return tx.companyAddonOverride.findMany({ orderBy: [{ companyId: 'asc' }, { addonKey: 'asc' }] })
}

describe('plans y plan_addons contra Postgres', () => {
  it('R2: guarda nombre, descripción, moneda, los dos precios, activo y las tres fechas', async () => {
    await inRolledBackTransaction(async (tx) => {
      const name = uniqueName()
      const id = await createPlan(tx, {
        name,
        description: 'Todo lo del núcleo',
        currency: 'CRC',
        monthlyPrice: '15000',
        annualPrice: '150000',
        active: false,
      })
      const deletedAt = new Date('2026-10-28T12:00:00.000Z')
      await tx.plan.update({ where: { id }, data: { deletedAt } })

      const plan = await tx.plan.findUniqueOrThrow({ where: { id } })

      expect(plan.name).toBe(name)
      expect(plan.description).toBe('Todo lo del núcleo')
      expect(plan.currency).toBe('CRC')
      expect(plan.monthlyPrice?.toFixed(4)).toBe('15000.0000')
      expect(plan.annualPrice?.toFixed(4)).toBe('150000.0000')
      expect(plan.active).toBe(false)
      expect(plan.createdAt).toBeInstanceOf(Date)
      expect(plan.updatedAt).toBeInstanceOf(Date)
      expect(plan.deletedAt).toEqual(deletedAt)
    })
  })

  it('R4: rechaza un plan sin nombre, con nombre vacío o con solo espacios', async () => {
    await inRolledBackTransaction(async (tx) => {
      expect(await expectRejected(tx, insertPlanSql({ name: 'NULL' }), 'nombre NULL')).toEqual({
        sqlState: NOT_NULL_VIOLATION,
        constraint: null,
        column: 'name',
      })
      expect(await expectRejected(tx, insertPlanSql({}, ['name']), 'sin columna nombre')).toMatchObject({
        sqlState: NOT_NULL_VIOLATION,
        column: 'name',
      })
      for (const blank of ['', ' ', '    ']) {
        expect(await expectRejected(tx, insertPlanSql({ name: lit(blank) }), `nombre '${blank}'`)).toMatchObject({
          sqlState: CHECK_VIOLATION,
          constraint: 'plans_name_not_blank',
        })
      }
    })
  })

  it('R5: rechaza un plan sin indicar si está activo', async () => {
    await inRolledBackTransaction(async (tx) => {
      for (const sql of [insertPlanSql({}, ['active']), insertPlanSql({ active: 'NULL' })]) {
        expect(await expectRejected(tx, sql, 'sin activo')).toEqual({
          sqlState: NOT_NULL_VIOLATION,
          constraint: null,
          column: 'active',
        })
      }
    })
  })

  it('R6: admite un plan sin descripción', async () => {
    await inRolledBackTransaction(async (tx) => {
      await expectAccepted(tx, insertPlanSql({ description: 'NULL' }), 'descripcion NULL')
      await expectAccepted(tx, insertPlanSql(), 'sin columna descripcion')
      const id = await createPlan(tx, { description: null })
      expect((await tx.plan.findUniqueOrThrow({ where: { id } })).description).toBeNull()
    })
  })

  it('R8: rechaza un plan sin moneda o con una moneda distinta de CRC y USD, también en minúsculas', async () => {
    await inRolledBackTransaction(async (tx) => {
      for (const sql of [insertPlanSql({}, ['currency']), insertPlanSql({ currency: 'NULL' })]) {
        expect(await expectRejected(tx, sql, 'sin moneda')).toEqual({
          sqlState: NOT_NULL_VIOLATION,
          constraint: null,
          column: 'currency',
        })
      }
      for (const currency of ['crc', 'usd', 'Usd', 'EUR', 'COP', '']) {
        expect(
          await expectRejected(tx, insertPlanSql({ currency: lit(currency) }), `moneda '${currency}'`),
        ).toMatchObject({ sqlState: CHECK_VIOLATION, constraint: 'plans_currency_allowed' })
      }
      expect(
        (await expectRejected(tx, insertPlanSql({ currency: lit('USDX') }), 'moneda de cuatro letras')).sqlState,
      ).toBe(STRING_DATA_RIGHT_TRUNCATION)
      await expectAccepted(tx, insertPlanSql({ currency: lit('CRC') }), 'moneda CRC')
      await expectAccepted(tx, insertPlanSql({ currency: lit('USD') }), 'moneda USD')
    })
  })

  it('R9: rechaza un plan sin precio mensual y sin precio anual', async () => {
    await inRolledBackTransaction(async (tx) => {
      const sqls = [
        insertPlanSql({ monthly_price: 'NULL', annual_price: 'NULL' }),
        insertPlanSql({}, ['monthly_price']),
      ]
      for (const sql of sqls) {
        expect(await expectRejected(tx, sql, 'sin precios')).toMatchObject({
          sqlState: CHECK_VIOLATION,
          constraint: 'plans_has_price',
        })
      }

      const id = await createPlan(tx, { monthlyPrice: '10', annualPrice: '100' })
      const sinPrecios = await expectRejected(
        tx,
        `UPDATE "plans" SET "monthly_price" = NULL, "annual_price" = NULL WHERE "id" = CAST(${lit(id)} AS uuid)`,
        'quitar los dos precios',
      )
      expect(sinPrecios).toMatchObject({ sqlState: CHECK_VIOLATION, constraint: 'plans_has_price' })
    })
  })

  it('R10: admite solo mensual, solo anual y los dos', async () => {
    await inRolledBackTransaction(async (tx) => {
      await expectAccepted(tx, insertPlanSql({ monthly_price: '10', annual_price: 'NULL' }), 'solo mensual')
      await expectAccepted(tx, insertPlanSql({ monthly_price: 'NULL', annual_price: '100' }), 'solo anual')
      await expectAccepted(tx, insertPlanSql({ monthly_price: '10', annual_price: '100' }), 'los dos')

      const soloAnual = await createPlan(tx, { monthlyPrice: null, annualPrice: '120' })
      const plan = await tx.plan.findUniqueOrThrow({ where: { id: soloAnual } })
      expect(plan.monthlyPrice).toBeNull()
      expect(plan.annualPrice?.toFixed(4)).toBe('120.0000')
    })
  })

  it('R11: rechaza un precio mensual o anual negativo', async () => {
    await inRolledBackTransaction(async (tx) => {
      const casos = [
        { sql: insertPlanSql({ monthly_price: '-0.0001' }), constraint: 'plans_monthly_price_non_negative' },
        { sql: insertPlanSql({ monthly_price: '-1' }), constraint: 'plans_monthly_price_non_negative' },
        {
          sql: insertPlanSql({ monthly_price: 'NULL', annual_price: '-0.0001' }),
          constraint: 'plans_annual_price_non_negative',
        },
        { sql: insertPlanSql({ monthly_price: '10', annual_price: '-50' }), constraint: 'plans_annual_price_non_negative' },
      ]
      for (const caso of casos) {
        expect(await expectRejected(tx, caso.sql, caso.constraint)).toMatchObject({
          sqlState: CHECK_VIOLATION,
          constraint: caso.constraint,
        })
      }
    })
  })

  it('R12: admite 0 como precio mensual y anual, y distingue 0 de ausente', async () => {
    await inRolledBackTransaction(async (tx) => {
      const ceroMensual = await createPlan(tx, { monthlyPrice: '0', annualPrice: null })
      const ceroAnual = await createPlan(tx, { monthlyPrice: null, annualPrice: '0' })
      const ceroLosDos = await createPlan(tx, { monthlyPrice: '0', annualPrice: '0' })

      const leidos = await tx.plan.findMany({
        where: { id: { in: [ceroMensual, ceroAnual, ceroLosDos] } },
        select: { id: true, monthlyPrice: true, annualPrice: true },
      })
      const porId = new Map(leidos.map((plan) => [plan.id, plan]))

      expect(porId.get(ceroMensual)?.monthlyPrice?.toFixed(4)).toBe('0.0000')
      expect(porId.get(ceroMensual)?.annualPrice).toBeNull()
      expect(porId.get(ceroAnual)?.monthlyPrice).toBeNull()
      expect(porId.get(ceroAnual)?.annualPrice?.toFixed(4)).toBe('0.0000')
      expect(porId.get(ceroLosDos)?.monthlyPrice?.toFixed(4)).toBe('0.0000')
      expect(porId.get(ceroLosDos)?.annualPrice?.toFixed(4)).toBe('0.0000')

      const nulos = await tx.$queryRaw<{ id: string; monthly_null: boolean; annual_null: boolean }[]>`
        SELECT id::text AS id, monthly_price IS NULL AS monthly_null, annual_price IS NULL AS annual_null
        FROM plans WHERE id = ${ceroMensual}::uuid`
      expect(nulos).toEqual([{ id: ceroMensual, monthly_null: false, annual_null: true }])
    })
  })

  it('R13: guarda los precios como decimal exacto de diez enteros y cuatro decimales, sin pérdida', async () => {
    await inRolledBackTransaction(async (tx) => {
      const id = await createPlan(tx, { monthlyPrice: '1234567890.1234', annualPrice: '0.3' })

      const plan = await tx.plan.findUniqueOrThrow({ where: { id } })
      expect(plan.monthlyPrice?.toFixed(4)).toBe('1234567890.1234')
      expect(plan.annualPrice?.toFixed(4)).toBe('0.3000')
      expect(plan.annualPrice?.equals(new Prisma.Decimal('0.3'))).toBe(true)

      const texto = await tx.$queryRaw<{ monthly: string; annual: string }[]>`
        SELECT monthly_price::text AS monthly, annual_price::text AS annual FROM plans WHERE id = ${id}::uuid`
      expect(texto).toEqual([{ monthly: '1234567890.1234', annual: '0.3000' }])

      const suma = await tx.$queryRaw<{ total: string }[]>`
        SELECT (monthly_price + annual_price)::text AS total FROM plans WHERE id = ${id}::uuid`
      expect(suma).toEqual([{ total: '1234567890.4234' }])

      expect(
        (await expectRejected(tx, insertPlanSql({ monthly_price: '12345678901' }), 'once enteros')).sqlState,
      ).toBe(NUMERIC_VALUE_OUT_OF_RANGE)
    })
  })

  it('R14: guarda los módulos de un plan como claves del catálogo de añadidos', async () => {
    await inRolledBackTransaction(async (tx) => {
      const id = await createPlan(tx)
      await tx.planAddon.createMany({ data: ADDONS.map((addonKey) => ({ planId: id, addonKey })) })

      expect(await addonsOf(tx, id)).toEqual([...ADDONS].sort())
      const conCatalogo = await tx.planAddon.findMany({ where: { planId: id }, select: { addon: true } })
      expect(conCatalogo.map((fila) => fila.addon.key).sort()).toEqual([...ADDONS].sort())
    })
  })

  it('R15: rechaza un módulo fuera del catálogo de añadidos, incluidos los nombres del núcleo', async () => {
    await inRolledBackTransaction(async (tx) => {
      const id = await createPlan(tx)
      for (const addonKey of ['pedidos', 'inventario', 'x', 'Dashboard']) {
        expect(await expectRejected(tx, insertPlanAddonSql(id, addonKey), `modulo ${addonKey}`)).toMatchObject({
          sqlState: FOREIGN_KEY_VIOLATION,
          constraint: 'plan_addons_addon_key_fkey',
        })
      }
      expect(await addonsOf(tx, id)).toEqual([])
    })
  })

  it('R16: rechaza el mismo módulo dos veces en el mismo plan', async () => {
    await inRolledBackTransaction(async (tx) => {
      const id = await createPlan(tx)
      const otro = await createPlan(tx)
      await expectAccepted(tx, insertPlanAddonSql(id, 'dashboard'), 'primera vez')

      expect(await expectRejected(tx, insertPlanAddonSql(id, 'dashboard'), 'segunda vez')).toMatchObject({
        sqlState: UNIQUE_VIOLATION,
        constraint: 'plan_addons_pkey',
      })
      await expectAccepted(tx, insertPlanAddonSql(otro, 'dashboard'), 'mismo modulo en otro plan')
      expect(await addonsOf(tx, id)).toEqual(['dashboard'])
    })
  })

  it('R17: admite un plan sin ningún módulo', async () => {
    await inRolledBackTransaction(async (tx) => {
      const id = await createPlan(tx)
      expect(await tx.plan.count({ where: { id } })).toBe(1)
      expect(await addonsOf(tx, id)).toEqual([])
    })
  })

  it('R18: mientras un plan trae un módulo, ese módulo no se puede borrar del catálogo', async () => {
    await inRolledBackTransaction(async (tx) => {
      const addonKey = 'importacion_excel'
      // Las excepciones por empresa también frenan el borrado; se quitan para que solo quede el plan.
      await tx.companyAddonOverride.deleteMany({ where: { addonKey } })
      const id = await createPlan(tx)
      await tx.planAddon.create({ data: { planId: id, addonKey } })
      const borrar = `DELETE FROM "addons" WHERE "key" = ${lit(addonKey)}`

      expect(await expectRejected(tx, borrar, 'borrar un modulo que trae un plan')).toMatchObject({
        sqlState: FOREIGN_KEY_VIOLATION,
        constraint: 'plan_addons_addon_key_fkey',
      })
      expect(await tx.addon.count({ where: { key: addonKey } })).toBe(1)

      // Un plan dado de baja también lo frena: su fila y sus módulos se conservan.
      await tx.plan.update({ where: { id }, data: { deletedAt: new Date() } })
      expect((await expectRejected(tx, borrar, 'con el plan de baja')).constraint).toBe('plan_addons_addon_key_fkey')

      // Testigo: sin el módulo en el plan, el mismo borrado pasa.
      await tx.planAddon.deleteMany({ where: { planId: id } })
      await expectAccepted(tx, borrar, 'sin planes que lo traigan')
    })
  })

  it('R19: cambia los precios y los módulos de un plan conservando su identidad', async () => {
    await inRolledBackTransaction(async (tx) => {
      const id = await createPlan(tx, { monthlyPrice: '10', annualPrice: null })
      await tx.planAddon.createMany({
        data: [
          { planId: id, addonKey: 'dashboard' },
          { planId: id, addonKey: 'proveedores' },
        ],
      })

      await tx.plan.update({
        where: { id },
        data: { monthlyPrice: new Prisma.Decimal('12.5'), annualPrice: new Prisma.Decimal('120') },
      })
      await tx.planAddon.deleteMany({ where: { planId: id, addonKey: 'dashboard' } })
      await tx.planAddon.create({ data: { planId: id, addonKey: 'integraciones' } })

      const plan = await tx.plan.findUniqueOrThrow({ where: { id } })
      expect(plan.id).toBe(id)
      expect(plan.monthlyPrice?.toFixed(4)).toBe('12.5000')
      expect(plan.annualPrice?.toFixed(4)).toBe('120.0000')
      expect(await addonsOf(tx, id)).toEqual(['integraciones', 'proveedores'])
    })
  })

  it('R20: guardar, cambiar o dar de baja un plan deja iguales las excepciones de añadidos de las empresas', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await createCompany(tx)
      await tx.companyAddonOverride.createMany({
        data: [
          { companyId, addonKey: 'dashboard', enabled: true },
          { companyId, addonKey: 'lectura_pdf', enabled: false },
        ],
      })
      const antes = await allOverrides(tx)
      expect(antes.filter((fila) => fila.companyId === companyId)).toHaveLength(2)

      const id = await createPlan(tx)
      await tx.planAddon.createMany({
        data: [
          { planId: id, addonKey: 'dashboard' },
          { planId: id, addonKey: 'lectura_pdf' },
        ],
      })
      expect(await allOverrides(tx)).toEqual(antes)

      await tx.plan.update({ where: { id }, data: { monthlyPrice: new Prisma.Decimal('99'), active: false } })
      await tx.planAddon.deleteMany({ where: { planId: id, addonKey: 'lectura_pdf' } })
      expect(await allOverrides(tx)).toEqual(antes)

      await tx.plan.update({ where: { id }, data: { deletedAt: new Date() } })
      expect(await allOverrides(tx)).toEqual(antes)
    })
  })

  it('R21: al guardar fija alta y última modificación; al cambiar mueve solo la última modificación', async () => {
    await inRolledBackTransaction(async (tx) => {
      const nombreCrudo = uniqueName('Plan crudo')
      await expectAccepted(tx, insertPlanSql({ name: lit(nombreCrudo) }), 'alta por SQL sin created_at')
      const crudo = await tx.$queryRaw<{ created: boolean; updated: boolean }[]>`
        SELECT created_at IS NOT NULL AS created, updated_at IS NOT NULL AS updated
        FROM plans WHERE name = ${nombreCrudo}`
      expect(crudo).toEqual([{ created: true, updated: true }])

      const id = await createPlan(tx)
      const alta = await tx.plan.findUniqueOrThrow({ where: { id } })
      expect(alta.createdAt).toBeInstanceOf(Date)
      expect(alta.updatedAt).toBeInstanceOf(Date)

      await new Promise((resolve) => setTimeout(resolve, 20))
      await tx.plan.update({ where: { id }, data: { monthlyPrice: new Prisma.Decimal('11') } })

      const cambio = await tx.plan.findUniqueOrThrow({ where: { id } })
      expect(cambio.createdAt).toEqual(alta.createdAt)
      expect(cambio.updatedAt.getTime()).toBeGreaterThan(alta.updatedAt.getTime())
    })
  })

  it('R22: activo y borrado van por separado', async () => {
    await inRolledBackTransaction(async (tx) => {
      const inactivo = await createPlan(tx, { active: false })
      const activo = await createPlan(tx, { active: true })
      const borradoActivo = await createPlan(tx, { active: true })
      await tx.plan.update({ where: { id: borradoActivo }, data: { deletedAt: new Date() } })

      const leidos = await tx.plan.findMany({
        where: { id: { in: [inactivo, activo, borradoActivo] } },
        select: { id: true, active: true, deletedAt: true },
      })
      const porId = new Map(leidos.map((plan) => [plan.id, plan]))
      expect(porId.get(inactivo)).toMatchObject({ active: false, deletedAt: null })
      expect(porId.get(activo)).toMatchObject({ active: true, deletedAt: null })
      expect(porId.get(borradoActivo)?.active).toBe(true)
      expect(porId.get(borradoActivo)?.deletedAt).toBeInstanceOf(Date)
    })
  })

  it('R23: dar de baja un plan conserva su fila y sus módulos y fija la fecha de borrado', async () => {
    await inRolledBackTransaction(async (tx) => {
      const id = await createPlan(tx)
      await tx.planAddon.createMany({
        data: [
          { planId: id, addonKey: 'dashboard' },
          { planId: id, addonKey: 'integraciones' },
        ],
      })
      const antes = await tx.plan.findUniqueOrThrow({ where: { id } })
      const deletedAt = new Date('2026-10-28T15:00:00.000Z')

      await tx.plan.update({ where: { id }, data: { deletedAt } })

      const despues = await tx.plan.findUniqueOrThrow({ where: { id } })
      expect(despues).toEqual({ ...antes, deletedAt, updatedAt: despues.updatedAt })
      expect(await addonsOf(tx, id)).toEqual(['dashboard', 'integraciones'])
    })
  })

  it('R24 [P1]: rechaza un nombre que coincide sin distinguir mayúsculas con otro plan no borrado, también inactivo', async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = uniqueName('Plan Pro')
      await createPlan(tx, { name: base, active: true })

      for (const name of [base, base.toUpperCase(), base.toLowerCase()]) {
        expect(await expectRejected(tx, insertPlanSql({ name: lit(name) }), `nombre ${name}`)).toMatchObject({
          sqlState: UNIQUE_VIOLATION,
          constraint: 'plans_name_unique',
        })
      }

      const inactivo = uniqueName('Plan Inactivo')
      await createPlan(tx, { name: inactivo, active: false })
      expect(
        await expectRejected(tx, insertPlanSql({ name: lit(inactivo.toUpperCase()) }), 'nombre de un plan inactivo'),
      ).toMatchObject({ sqlState: UNIQUE_VIOLATION, constraint: 'plans_name_unique' })

      const otro = await createPlan(tx)
      const renombrar = `UPDATE "plans" SET "name" = ${lit(base.toUpperCase())} WHERE "id" = CAST(${lit(otro)} AS uuid)`
      expect(await expectRejected(tx, renombrar, 'renombrar a un nombre tomado')).toMatchObject({
        sqlState: UNIQUE_VIOLATION,
        constraint: 'plans_name_unique',
      })
    })
  })

  it('R25 [P1]: admite un plan con el nombre de otro plan ya borrado', async () => {
    await inRolledBackTransaction(async (tx) => {
      const name = uniqueName('Plan Viejo')
      const viejo = await createPlan(tx, { name })
      await tx.plan.update({ where: { id: viejo }, data: { deletedAt: new Date() } })

      const otroBorrado = await createPlan(tx, { name })
      await tx.plan.update({ where: { id: otroBorrado }, data: { deletedAt: new Date() } })
      await expectAccepted(tx, insertPlanSql({ name: lit(name.toUpperCase()) }), 'mismo nombre que dos borrados')

      const conEseNombre = await tx.$queryRaw<{ vivos: bigint; borrados: bigint }[]>`
        SELECT count(*) FILTER (WHERE deleted_at IS NULL) AS vivos,
               count(*) FILTER (WHERE deleted_at IS NOT NULL) AS borrados
        FROM plans WHERE lower(name) = lower(${name})`
      expect(Number(conEseNombre[0]?.vivos)).toBe(1)
      expect(Number(conEseNombre[0]?.borrados)).toBe(2)
    })
  })
})
