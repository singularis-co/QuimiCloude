// La migracion `db/migrations/*_notifications_addon_removal/` contra Postgres real, junto con la de
// datos que deshace (`*_notifications_addon`, que se queda en el repo sin editar).
//
// AISLAMIENTO — `transaccion`: cada caso corre dentro de una transaccion interactiva que termina en
// ROLLBACK. El SQL se lee de los archivos, no se copia. «La de datos se llego a aplicar» se simula
// aplicando su UP dentro de la transaccion; «no se llego a aplicar», sin aplicarlo.

import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Prisma } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'

import { ADDONS, PERMISSIONS, normalizeCompanyName } from '@/lib/modules/identity'
import { NO_CREDENTIAL_SENTINEL } from '@/lib/modules/identity/domain/credential-setup-link'
import { DOCUMENT_TYPE_CC } from '@/lib/modules/identity/domain/document-type'
import { ROLE_MAESTRO, ROLE_OPERADOR } from '@/lib/modules/identity/domain/roles'
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

function readStatements(dir: string, file: string): readonly string[] {
  return statementsOf(readFileSync(join(dir, file), 'utf8'))
}

const addonDir = locateMigrationDir('notifications_addon')
const removalDir = locateMigrationDir('notifications_addon_removal')
const ADDON_UP = readStatements(addonDir, 'migration.sql')
const REMOVAL_UP = readStatements(removalDir, 'migration.sql')

expect(REMOVAL_UP, 'la retirada son exactamente cuatro sentencias').toHaveLength(4)
// La migracion ya commiteada no se edita: su DOWN y el UP de la retirada son el mismo SQL.
expect(REMOVAL_UP).toEqual(readStatements(addonDir, 'down.sql'))
// Y el DOWN de la retirada vuelve a escribir exactamente lo que escribe la de datos.
expect(readStatements(removalDir, 'down.sql')).toEqual(ADDON_UP)
// La retirada esta despues de la de datos, asi que en una base nueva corre detras de ella.
expect(removalDir > addonDir).toBe(true)

async function apply(tx: Tx, statements: readonly string[]): Promise<void> {
  for (const statement of statements) await tx.$executeRawUnsafe(statement)
}

const ADDON = 'notificaciones'
const CODIGO = 'notificaciones.consultar'

function tag(): string {
  return randomUUID().replaceAll('-', '')
}

async function createCompany(tx: Tx, deleted = false): Promise<string> {
  const name = `Retirada avisos ${tag()}`
  const company = await tx.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name), deletedAt: deleted ? new Date() : null },
    select: { id: true },
  })
  return company.id
}

async function createMaestro(tx: Tx): Promise<string> {
  const marca = tag()
  const role = await tx.role.findUniqueOrThrow({ where: { name: ROLE_MAESTRO }, select: { id: true } })
  const user = await tx.user.create({
    data: {
      firstNames: 'Ana',
      lastNames: 'Maestra',
      birthDate: new Date('1990-01-01T00:00:00.000Z'),
      email: `qc137.retirada.${marca}@example.test`,
      phone: '000000000',
      documentTypeCode: DOCUMENT_TYPE_CC,
      documentNumber: marca.slice(0, 20),
      username: `qc137.retirada.${marca}`,
      passwordHash: NO_CREDENTIAL_SENTINEL,
      roleId: role.id,
      companyId: null,
      accountStatus: 'active',
    },
    select: { id: true },
  })
  return user.id
}

/** Lo que la retirada vigila: las cuatro filas del permiso y el añadido. */
async function featureRows(tx: Tx) {
  return {
    permissions: await tx.permission.count({ where: { code: CODIGO } }),
    rolePermissions: await tx.rolePermission.count({ where: { permissionCode: CODIGO } }),
    addons: await tx.addon.count({ where: { key: ADDON } }),
    overrides: await tx.companyAddonOverride.count({ where: { addonKey: ADDON } }),
  }
}

const NONE = { permissions: 0, rolePermissions: 0, addons: 0, overrides: 0 }

/** Todo lo demas de las mismas tablas, para comprobar que la retirada no lo toca. */
async function restOfTables(tx: Tx) {
  return {
    permissions: await tx.permission.findMany({ where: { code: { not: CODIGO } }, orderBy: { code: 'asc' } }),
    rolePermissions: await tx.rolePermission.findMany({
      where: { permissionCode: { not: CODIGO } },
      orderBy: [{ roleId: 'asc' }, { permissionCode: 'asc' }],
    }),
    addons: await tx.addon.findMany({ where: { key: { not: ADDON } }, orderBy: { key: 'asc' } }),
    overrides: await tx.companyAddonOverride.findMany({
      where: { addonKey: { not: ADDON } },
      orderBy: [{ companyId: 'asc' }, { addonKey: 'asc' }],
    }),
    companies: await tx.company.findMany({ orderBy: { id: 'asc' } }),
  }
}

afterAll(async () => {
  await prisma.$disconnect()
})

describe('migracion notifications_addon_removal contra Postgres real', () => {
  it('QC-137 R54: tras las migraciones no queda permiso, asignación, añadido ni excepción', async () => {
    await inRolledBackTransaction(async (tx) => {
      // La base de la corrida ya tiene todas las migraciones aplicadas, la de datos y la retirada.
      expect(await featureRows(tx)).toEqual(NONE)
      expect((await tx.addon.findMany({ select: { key: true } })).map((fila) => fila.key).sort()).toEqual(
        [...ADDONS].sort(),
      )
      expect(PERMISSIONS.map((permiso) => permiso.code)).not.toContain(CODIGO)

      // Una base donde la de datos si llego a escribir, con empresas vivas y de baja.
      await createCompany(tx)
      await createCompany(tx, true)
      const before = await restOfTables(tx)
      await apply(tx, ADDON_UP)
      const written = await featureRows(tx)
      expect(written.permissions).toBe(1)
      expect(written.rolePermissions).toBe(4)
      expect(written.addons).toBe(1)
      expect(written.overrides).toBeGreaterThanOrEqual(2)

      await apply(tx, REMOVAL_UP)

      expect(await featureRows(tx)).toEqual(NONE)
      expect(await restOfTables(tx)).toEqual(before)
    })
  })

  it('QC-137 R54: aplicar la retirada dos veces no falla ni cambia nada', async () => {
    await inRolledBackTransaction(async (tx) => {
      await createCompany(tx)
      const before = await restOfTables(tx)

      // Sin la de datos aplicada: las filas no existen y la retirada no falla.
      await apply(tx, REMOVAL_UP)
      expect(await featureRows(tx)).toEqual(NONE)
      expect(await restOfTables(tx)).toEqual(before)

      // Con la de datos aplicada, la segunda corrida deja lo mismo que la primera.
      await apply(tx, ADDON_UP)
      await apply(tx, REMOVAL_UP)
      const once = await restOfTables(tx)
      await apply(tx, REMOVAL_UP)

      expect(await featureRows(tx)).toEqual(NONE)
      expect(await restOfTables(tx)).toEqual(once)
      expect(once).toEqual(before)
    })
  })

  it('QC-137 R54: la retirada limpia también filas que la migración de datos no escribió (asignación o excepción a mano)', async () => {
    await inRolledBackTransaction(async (tx) => {
      await apply(tx, ADDON_UP)
      const maestro = await createMaestro(tx)
      // Una empresa dada de alta despues de la de datos no tiene excepcion; se la pone un Maestro a mano.
      const posterior = await createCompany(tx)
      await tx.companyAddonOverride.create({
        data: { companyId: posterior, addonKey: ADDON, enabled: false, source: 'manual', createdBy: maestro },
      })
      // Y una asignacion del permiso a un rol que la de datos no toca.
      const maestroRole = await tx.role.findUniqueOrThrow({ where: { name: ROLE_MAESTRO }, select: { id: true } })
      await tx.rolePermission.create({ data: { roleId: maestroRole.id, permissionCode: CODIGO } })
      // Y una asignacion que la de datos ya escribio y que alguien borro y volvio a poner.
      const operador = await tx.role.findUniqueOrThrow({ where: { name: ROLE_OPERADOR }, select: { id: true } })
      await tx.rolePermission.delete({
        where: { roleId_permissionCode: { roleId: operador.id, permissionCode: CODIGO } },
      })
      await tx.rolePermission.create({ data: { roleId: operador.id, permissionCode: CODIGO } })
      expect((await featureRows(tx)).rolePermissions).toBe(5)

      await apply(tx, REMOVAL_UP)

      expect(await featureRows(tx)).toEqual(NONE)
    })
  })
})
