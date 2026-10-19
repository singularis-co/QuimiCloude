// La migracion `db/migrations/*_notifications_addon/` contra Postgres real.
//
// AISLAMIENTO — `transaccion`: cada caso corre dentro de una transaccion interactiva que termina en
// ROLLBACK. El SQL se lee de los archivos, no se copia. La «base anterior a la migracion» se simula
// dentro de la transaccion borrando las filas que la migracion escribe.

import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Prisma } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'

import {
  ADDONS,
  ADDON_PERMISSIONS,
  PERMISSIONS,
  SEED_ROLE_PERMISSIONS,
  normalizeCompanyName,
} from '@/lib/modules/identity'
import { createCompanyAddonRepository } from '@/lib/modules/identity/adapters/driven/persistence/company-addons-prisma'
import { createCompanyRepository } from '@/lib/modules/identity/adapters/driven/persistence/company-prisma'
import { NO_CREDENTIAL_SENTINEL } from '@/lib/modules/identity/domain/credential-setup-link'
import { DOCUMENT_TYPE_CC } from '@/lib/modules/identity/domain/document-type'
import { createIsCompanyAddonActive } from '@/lib/modules/identity/domain/is-company-addon-active'
import { ROLE_MAESTRO } from '@/lib/modules/identity/domain/roles'
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

function locateMigrationDir(): string {
  const migrationsDir = join(findRepoRoot(dirname(fileURLToPath(import.meta.url))), 'db', 'migrations')
  const carpetas = readdirSync(migrationsDir).filter((name) => /^\d{14}_notifications_addon$/.test(name))
  expect(carpetas, 'debe existir exactamente una migracion del añadido de notificaciones').toHaveLength(1)
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

const migrationDir = locateMigrationDir()
const UP = statementsOf(readFileSync(join(migrationDir, 'migration.sql'), 'utf8'))
const DOWN = statementsOf(readFileSync(join(migrationDir, 'down.sql'), 'utf8'))

expect(UP, 'el UP son exactamente cuatro sentencias').toHaveLength(4)
expect(DOWN, 'el DOWN son exactamente cuatro sentencias').toHaveLength(4)

async function apply(tx: Tx, statements: readonly string[]): Promise<void> {
  for (const statement of statements) await tx.$executeRawUnsafe(statement)
}

const ADDON = 'notificaciones'
const CODIGO = 'notificaciones.consultar'
const ENTRADA = PERMISSIONS.find((permission) => permission.code === CODIGO)
if (ENTRADA === undefined) throw new Error(`PERMISSIONS no declara ${CODIGO}`)

const ROLES_CON_EL_PERMISO = Object.entries(SEED_ROLE_PERMISSIONS)
  .filter(([, codes]) => (codes as readonly string[]).includes(CODIGO))
  .map(([role]) => role)
  .sort()

function tag(): string {
  return randomUUID().replaceAll('-', '')
}

async function createCompany(tx: Tx, deleted = false): Promise<string> {
  const name = `Migracion avisos ${tag()}`
  const company = await tx.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name), deletedAt: deleted ? new Date() : null },
    select: { id: true },
  })
  return company.id
}

async function eraseFeatureRows(tx: Tx): Promise<void> {
  await tx.companyAddonOverride.deleteMany({ where: { addonKey: ADDON } })
  await tx.addon.deleteMany({ where: { key: ADDON } })
  await tx.rolePermission.deleteMany({ where: { permissionCode: CODIGO } })
  await tx.permission.deleteMany({ where: { code: CODIGO } })
}

async function snapshot(tx: Tx) {
  return {
    permissions: await tx.permission.findMany({ orderBy: { code: 'asc' } }),
    rolePermissions: await tx.rolePermission.findMany({ orderBy: [{ roleId: 'asc' }, { permissionCode: 'asc' }] }),
    roles: await tx.role.findMany({ orderBy: { id: 'asc' } }),
    addons: await tx.addon.findMany({ orderBy: { key: 'asc' } }),
    overrides: await tx.companyAddonOverride.findMany({ orderBy: [{ companyId: 'asc' }, { addonKey: 'asc' }] }),
    companies: await tx.company.findMany({ orderBy: { id: 'asc' } }),
  }
}

async function createMaestro(tx: Tx): Promise<string> {
  const marca = tag()
  const role = await tx.role.findUniqueOrThrow({ where: { name: ROLE_MAESTRO }, select: { id: true } })
  const user = await tx.user.create({
    data: {
      firstNames: 'Ana',
      lastNames: 'Maestra',
      birthDate: new Date('1990-01-01T00:00:00.000Z'),
      email: `qc137.maestro.${marca}@example.test`,
      phone: '000000000',
      documentTypeCode: DOCUMENT_TYPE_CC,
      documentNumber: marca.slice(0, 20),
      username: `qc137.maestro.${marca}`,
      passwordHash: NO_CREDENTIAL_SENTINEL,
      roleId: role.id,
      companyId: null,
      accountStatus: 'active',
    },
    select: { id: true },
  })
  return user.id
}

afterAll(async () => {
  await prisma.$disconnect()
})

describe('migracion notifications_addon contra Postgres real', () => {
  it('QC-137 R52: tras aplicarla, cada empresa que ya existia, viva o de baja, tiene notificaciones prendido y sin autor', async () => {
    await inRolledBackTransaction(async (tx) => {
      const viva = await createCompany(tx)
      const deBaja = await createCompany(tx, true)
      await eraseFeatureRows(tx)
      const otrasAntes = await tx.companyAddonOverride.findMany({
        where: { addonKey: { not: ADDON } },
        orderBy: [{ companyId: 'asc' }, { addonKey: 'asc' }],
      })

      await apply(tx, UP)

      const empresas = await tx.company.findMany({ select: { id: true } })
      expect(empresas.map((empresa) => empresa.id)).toEqual(expect.arrayContaining([viva, deBaja]))
      const excepciones = await tx.companyAddonOverride.findMany({
        where: { addonKey: ADDON },
        select: { companyId: true, enabled: true, source: true, createdBy: true },
      })
      expect(excepciones.map((fila) => fila.companyId).sort()).toEqual(empresas.map((empresa) => empresa.id).sort())
      for (const fila of excepciones) {
        expect(fila, fila.companyId).toMatchObject({ enabled: true, source: 'manual', createdBy: null })
      }
      const isActive = createIsCompanyAddonActive({ addons: createCompanyAddonRepository(tx) })
      expect(await isActive(viva, ADDON)).toBe(true)
      expect(
        await tx.companyAddonOverride.findMany({
          where: { addonKey: { not: ADDON } },
          orderBy: [{ companyId: 'asc' }, { addonKey: 'asc' }],
        }),
      ).toEqual(otrasAntes)
    })
  })

  it('QC-137 R52, R20: una empresa dada de alta despues de la migracion no tiene el añadido', async () => {
    await inRolledBackTransaction(async (tx) => {
      await eraseFeatureRows(tx)
      await apply(tx, UP)
      const actorId = await createMaestro(tx)
      const marca = tag()
      const name = `Posterior ${marca}`

      const created = await createCompanyRepository(tx).createWithAdministrator({
        company: {
          name,
          nameNormalized: normalizeCompanyName(name),
          taxId: null,
          taxIdNormalized: null,
          contactEmail: null,
          contactPhone: null,
        },
        administrator: {
          firstNames: 'Ana',
          lastNames: 'Admin',
          birthDate: new Date('1990-01-01T00:00:00.000Z'),
          email: `qc137.posterior.${marca}@example.test`,
          phone: '3001112233',
          documentTypeCode: DOCUMENT_TYPE_CC,
          documentNumber: marca.slice(0, 20),
          username: `qc137.posterior.${marca}`,
        },
        actorId,
        now: new Date(),
      })
      if (typeof created === 'string') throw new Error(`el alta no debia fallar: ${created}`)

      expect(
        await tx.companyAddonOverride.count({ where: { companyId: created.companyId, addonKey: ADDON } }),
      ).toBe(0)
      const isActive = createIsCompanyAddonActive({ addons: createCompanyAddonRepository(tx) })
      expect(await isActive(created.companyId, ADDON)).toBe(false)
    })
  })

  it('QC-137 R18, R21: las filas que escribe coinciden con las constantes de la app', async () => {
    await inRolledBackTransaction(async (tx) => {
      await eraseFeatureRows(tx)

      await apply(tx, UP)

      expect(await tx.permission.findUnique({ where: { code: CODIGO } })).toMatchObject({
        code: ENTRADA.code,
        module: ENTRADA.module,
        action: ENTRADA.action,
        description: ENTRADA.description,
      })
      const asignaciones = await tx.rolePermission.findMany({
        where: { permissionCode: CODIGO },
        include: { role: { select: { name: true } } },
      })
      expect(asignaciones.map((fila) => fila.role.name).sort()).toEqual(ROLES_CON_EL_PERMISO)
      expect(ROLES_CON_EL_PERMISO).not.toContain(ROLE_MAESTRO)
      expect(ROLES_CON_EL_PERMISO).toHaveLength(4)
      expect(ADDON_PERMISSIONS.notificaciones).toEqual([CODIGO])
      expect((await tx.addon.findMany({ select: { key: true } })).map((fila) => fila.key).sort()).toEqual(
        [...ADDONS].sort(),
      )
    })
  })

  it('QC-137 R52: aplicarla dos veces no falla, no duplica y no reescribe ninguna fila', async () => {
    await inRolledBackTransaction(async (tx) => {
      await createCompany(tx)
      await eraseFeatureRows(tx)
      await apply(tx, UP)
      const trasLaPrimera = await snapshot(tx)

      await apply(tx, UP)

      expect(await snapshot(tx)).toEqual(trasLaPrimera)
    })
  })

  it('QC-137 R52: el DOWN deja la base exactamente como antes del UP', async () => {
    await inRolledBackTransaction(async (tx) => {
      await createCompany(tx)
      await eraseFeatureRows(tx)
      const antes = await snapshot(tx)

      await apply(tx, UP)
      expect(await tx.companyAddonOverride.count({ where: { addonKey: ADDON } })).toBeGreaterThan(0)

      await apply(tx, DOWN)

      expect(await snapshot(tx)).toEqual(antes)
    })
  })
})
