// La migracion de datos `db/migrations/*_whatsapp_agent_permissions/` contra Postgres real.
//
// AISLAMIENTO — `transaccion`: cada caso corre dentro de una transaccion interactiva que termina en
// ROLLBACK. El SQL se lee de los archivos, no se copia. La base de la corrida ya tiene la migracion
// aplicada; «antes de migrar» se simula aplicando su DOWN dentro de la transaccion, sembrando las
// empresas y aplicando despues el UP.

import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Prisma } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'

import { ADDONS, PERMISSIONS, ROLE_ADMINISTRADOR, normalizeCompanyName } from '@/lib/modules/identity'
import { prisma } from '@/lib/shared/db/prisma'

type Tx = Prisma.TransactionClient

class RollbackSignal extends Error {
  constructor() {
    super('rollback de aislamiento del test')
    this.name = 'RollbackSignal'
  }
}

async function inRolledBackTransaction(body: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await body(tx)
        throw new RollbackSignal()
      },
      { maxWait: 10_000, timeout: 60_000 },
    )
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error
  }
}

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

function locateMigrationDir(suffix: string): string {
  const pattern = new RegExp(`^\\d{14}_${suffix}$`)
  const carpetas = readdirSync(migrationsDir).filter((name) => pattern.test(name))
  expect(carpetas, `debe existir exactamente una migracion *_${suffix}`).toHaveLength(1)
  return join(migrationsDir, carpetas[0] as string)
}

function statementsOf(sql: string): readonly string[] {
  return sql
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
}

const dir = locateMigrationDir('whatsapp_agent_permissions')
const UP = statementsOf(readFileSync(join(dir, 'migration.sql'), 'utf8'))
const DOWN = statementsOf(readFileSync(join(dir, 'down.sql'), 'utf8'))

async function apply(tx: Tx, statements: readonly string[]): Promise<void> {
  for (const statement of statements) await tx.$executeRawUnsafe(statement)
}

const ADDON = 'agente_ia_whatsapp'
const CODIGOS = ['agente_ia.consultar', 'agente_ia.modificar'] as const

function tag(): string {
  return randomUUID().replaceAll('-', '')
}

async function createCompany(
  tx: Tx,
  overrides: Readonly<Record<string, boolean>>,
  deleted = false,
): Promise<string> {
  const name = `Agente IA ${tag()}`
  const company = await tx.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name), deletedAt: deleted ? new Date() : null },
    select: { id: true },
  })
  for (const [addonKey, enabled] of Object.entries(overrides)) {
    await tx.companyAddonOverride.create({ data: { companyId: company.id, addonKey, enabled, source: 'manual' } })
  }
  return company.id
}

async function agentOverride(tx: Tx, companyId: string) {
  return tx.companyAddonOverride.findUnique({
    where: { companyId_addonKey: { companyId, addonKey: ADDON } },
    select: { enabled: true, source: true, createdBy: true },
  })
}

/** Todas las excepciones que no son del agente, para comprobar que la migracion no las toca. */
async function otherOverrides(tx: Tx) {
  return tx.companyAddonOverride.findMany({
    where: { addonKey: { not: ADDON } },
    orderBy: [{ companyId: 'asc' }, { addonKey: 'asc' }],
  })
}

async function settingsRows(tx: Tx, companyId: string): Promise<number> {
  const filas = await tx.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM "whatsapp_agent_settings" WHERE "company_id" = ${companyId}::uuid`
  return Number(filas[0]?.n ?? 0)
}

type Escenario = { a: string; b: string; c: string; baja: string }

/** Deja la base como antes de migrar y siembra A (integraciones prendido), B (apagado), C (sin
 *  excepcion) y una empresa de baja con integraciones prendido. */
async function seedBeforeMigration(tx: Tx): Promise<Escenario> {
  await apply(tx, DOWN)
  return {
    a: await createCompany(tx, { integraciones: true, dashboard: true }),
    b: await createCompany(tx, { integraciones: false, proveedores: true }),
    c: await createCompany(tx, { dashboard: false }),
    baja: await createCompany(tx, { integraciones: true }, true),
  }
}

afterAll(async () => {
  await prisma.$disconnect()
})

describe('migracion whatsapp_agent_permissions contra Postgres real', () => {
  it('R1, R3, R5: tras las migraciones existen el añadido, los dos permisos y solo el Administrador los tiene', async () => {
    await inRolledBackTransaction(async (tx) => {
      expect((await tx.addon.findMany({ select: { key: true } })).map((fila) => fila.key).sort()).toEqual(
        [...ADDONS].sort(),
      )

      const permisos = await tx.permission.findMany({
        where: { code: { in: [...CODIGOS] } },
        select: { code: true, module: true, action: true, description: true },
        orderBy: { code: 'asc' },
      })
      expect(permisos).toEqual(
        PERMISSIONS.filter((permiso) => permiso.module === 'agente_ia').map((permiso) => ({ ...permiso })),
      )

      const asignaciones = await tx.rolePermission.findMany({
        where: { permissionCode: { in: [...CODIGOS] } },
        select: { permissionCode: true, role: { select: { name: true } } },
        orderBy: { permissionCode: 'asc' },
      })
      expect(asignaciones.map((fila) => [fila.role.name, fila.permissionCode])).toEqual(
        CODIGOS.map((codigo) => [ROLE_ADMINISTRADOR, codigo]),
      )
    })
  })

  it('R6: prende el agente en las empresas con integraciones prendido, también las de baja, y en ninguna otra', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { a, b, c, baja } = await seedBeforeMigration(tx)
      const antes = await otherOverrides(tx)

      await apply(tx, UP)

      expect(await agentOverride(tx, a)).toEqual({ enabled: true, source: 'manual', createdBy: null })
      expect(await agentOverride(tx, baja)).toEqual({ enabled: true, source: 'manual', createdBy: null })
      expect(await agentOverride(tx, b)).toBeNull()
      expect(await agentOverride(tx, c)).toBeNull()
      expect(await otherOverrides(tx)).toEqual(antes)

      // Ninguna empresa sin integraciones prendido queda con el agente.
      const sinIntegraciones = await tx.companyAddonOverride.findMany({
        where: { addonKey: ADDON, company: { addonOverrides: { none: { addonKey: 'integraciones', enabled: true } } } },
      })
      expect(sinIntegraciones).toEqual([])
    })
  })

  it('R6, R8: la empresa con el agente prendido sigue sin configuración guardada del agente', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { a } = await seedBeforeMigration(tx)
      await apply(tx, UP)

      expect(await agentOverride(tx, a)).toEqual({ enabled: true, source: 'manual', createdBy: null })
      expect(await settingsRows(tx, a)).toBe(0)
    })
  })

  it('R6: aplicar el UP dos veces no duplica ni cambia nada', async () => {
    await inRolledBackTransaction(async (tx) => {
      await seedBeforeMigration(tx)
      await apply(tx, UP)
      const unaVez = {
        overrides: await tx.companyAddonOverride.findMany({ orderBy: [{ companyId: 'asc' }, { addonKey: 'asc' }] }),
        asignaciones: await tx.rolePermission.findMany({ orderBy: [{ roleId: 'asc' }, { permissionCode: 'asc' }] }),
        permisos: await tx.permission.findMany({ orderBy: { code: 'asc' } }),
        addons: await tx.addon.findMany({ orderBy: { key: 'asc' } }),
      }

      await apply(tx, UP)

      expect({
        overrides: await tx.companyAddonOverride.findMany({ orderBy: [{ companyId: 'asc' }, { addonKey: 'asc' }] }),
        asignaciones: await tx.rolePermission.findMany({ orderBy: [{ roleId: 'asc' }, { permissionCode: 'asc' }] }),
        permisos: await tx.permission.findMany({ orderBy: { code: 'asc' } }),
        addons: await tx.addon.findMany({ orderBy: { key: 'asc' } }),
      }).toEqual(unaVez)
    })
  })

  it('R6: el UP no pisa una excepción del agente que ya existía apagada', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { a } = await seedBeforeMigration(tx)
      await tx.addon.create({ data: { key: ADDON } })
      await tx.companyAddonOverride.create({ data: { companyId: a, addonKey: ADDON, enabled: false, source: 'manual' } })

      await apply(tx, UP)

      expect((await agentOverride(tx, a))?.enabled).toBe(false)
    })
  })

  it('R6: el DOWN quita todas las excepciones del agente, sus permisos y su clave, y deja las demás', async () => {
    await inRolledBackTransaction(async (tx) => {
      const { b } = await seedBeforeMigration(tx)
      await apply(tx, UP)
      // Una excepcion puesta despues a mano, apagada, tambien cae.
      await tx.companyAddonOverride.create({ data: { companyId: b, addonKey: ADDON, enabled: false, source: 'manual' } })
      const otras = await otherOverrides(tx)
      const otrasAsignaciones = await tx.rolePermission.findMany({
        where: { permissionCode: { notIn: [...CODIGOS] } },
        orderBy: [{ roleId: 'asc' }, { permissionCode: 'asc' }],
      })

      await apply(tx, DOWN)

      expect(await tx.companyAddonOverride.count({ where: { addonKey: ADDON } })).toBe(0)
      expect(await tx.rolePermission.count({ where: { permissionCode: { in: [...CODIGOS] } } })).toBe(0)
      expect(await tx.permission.count({ where: { code: { in: [...CODIGOS] } } })).toBe(0)
      expect(await tx.addon.count({ where: { key: ADDON } })).toBe(0)
      expect(await otherOverrides(tx)).toEqual(otras)
      expect(
        await tx.rolePermission.findMany({
          where: { permissionCode: { notIn: [...CODIGOS] } },
          orderBy: [{ roleId: 'asc' }, { permissionCode: 'asc' }],
        }),
      ).toEqual(otrasAsignaciones)
    })
  })

  it('R6: el DOWN funciona con un plan que incluye el añadido: quita esa fila del plan y deja el plan y sus otros añadidos', async () => {
    await inRolledBackTransaction(async (tx) => {
      await seedBeforeMigration(tx)
      await apply(tx, UP)
      const plan = await tx.plan.create({
        data: {
          name: `Plan agente ${tag()}`,
          currency: 'USD',
          monthlyPrice: new Prisma.Decimal('10'),
          active: true,
          addons: { create: [{ addonKey: ADDON }, { addonKey: 'integraciones' }] },
        },
        select: { id: true },
      })

      await apply(tx, DOWN)

      expect(await tx.addon.count({ where: { key: ADDON } })).toBe(0)
      expect(await tx.planAddon.count({ where: { addonKey: ADDON } })).toBe(0)
      expect(
        (await tx.planAddon.findMany({ where: { planId: plan.id }, select: { addonKey: true } })).map((f) => f.addonKey),
      ).toEqual(['integraciones'])
      expect(await tx.plan.count({ where: { id: plan.id } })).toBe(1)
    })
  })
})
