// La migracion `db/migrations/*_plans_permissions/` contra Postgres real.
//
// Cada caso corre dentro de una transaccion interactiva que termina en ROLLBACK. El SQL se lee de
// los archivos, no se copia: si alguien le quita un `ON CONFLICT` o reordena el `down.sql`, esto lo
// nota aplicando el SQL real. La «base anterior a la migracion» se simula dentro de la transaccion
// borrando los dos permisos y sus asignaciones.

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Prisma } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'

import { PERMISSIONS, ROLE_MAESTRO } from '@/lib/modules/identity'
import { prisma } from '@/lib/shared/db/prisma'

class RollbackSignal extends Error {
  constructor() {
    super('rollback de aislamiento del test')
    this.name = 'RollbackSignal'
  }
}

async function inRolledBackTransaction(
  body: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await body(tx)
        throw new RollbackSignal()
      },
      { maxWait: 10_000, timeout: 30_000 },
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
  const carpetas = readdirSync(migrationsDir).filter((name) => /_plans_permissions$/.test(name))
  expect(carpetas, 'debe existir exactamente una migracion de los permisos de planes').toHaveLength(1)
  return join(migrationsDir, carpetas[0] as string)
}

function statementsOf(sql: string): readonly string[] {
  return sql
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
}

const migrationDir = locateMigrationDir()
const UP_STATEMENTS = statementsOf(readFileSync(join(migrationDir, 'migration.sql'), 'utf8'))
const DOWN_STATEMENTS = statementsOf(readFileSync(join(migrationDir, 'down.sql'), 'utf8'))

expect(UP_STATEMENTS, 'el UP son exactamente dos sentencias').toHaveLength(2)
expect(DOWN_STATEMENTS, 'el DOWN son exactamente dos sentencias').toHaveLength(2)

async function applyStatements(
  tx: Prisma.TransactionClient,
  statements: readonly string[],
): Promise<void> {
  for (const statement of statements) {
    await tx.$executeRawUnsafe(statement)
  }
}

const CODIGOS = ['planes.consultar', 'planes.modificar']

const ENTRADAS = PERMISSIONS.filter((permission) => CODIGOS.includes(permission.code))
if (ENTRADAS.length !== CODIGOS.length) {
  throw new Error('PERMISSIONS no declara los dos permisos de planes: este archivo no puede afirmar sobre sus filas')
}

async function eraseFeatureRows(tx: Prisma.TransactionClient): Promise<void> {
  await tx.rolePermission.deleteMany({ where: { permissionCode: { in: CODIGOS } } })
  await tx.permission.deleteMany({ where: { code: { in: CODIGOS } } })
}

async function fullSnapshot(tx: Prisma.TransactionClient) {
  return {
    permissions: await tx.permission.findMany({ orderBy: { code: 'asc' } }),
    rolePermissions: await tx.rolePermission.findMany({
      orderBy: [{ roleId: 'asc' }, { permissionCode: 'asc' }],
    }),
    roles: await tx.role.findMany({ orderBy: { id: 'asc' } }),
  }
}

/** Las asignaciones de todos los roles salvo el Maestro, en orden estable. */
async function assignmentsOfOtherRoles(tx: Prisma.TransactionClient) {
  return tx.rolePermission.findMany({
    where: { role: { name: { not: ROLE_MAESTRO } } },
    orderBy: [{ roleId: 'asc' }, { permissionCode: 'asc' }],
  })
}

afterAll(async () => {
  await prisma.$disconnect()
})

describe('migracion plans_permissions contra Postgres real', () => {
  it('R31: sobre una base sembrada sin los permisos, el UP crea las dos filas del catalogo y dos asignaciones, ambas al Maestro', async () => {
    await inRolledBackTransaction(async (tx) => {
      expect(await tx.role.findUnique({ where: { name: ROLE_MAESTRO } })).not.toBeNull()
      await eraseFeatureRows(tx)
      const antes = await fullSnapshot(tx)
      const otrosAntes = await assignmentsOfOtherRoles(tx)
      expect(otrosAntes.length).toBeGreaterThan(0)

      await applyStatements(tx, UP_STATEMENTS)

      const filas = await tx.permission.findMany({
        where: { code: { in: CODIGOS } },
        orderBy: { code: 'asc' },
      })
      expect(filas.map(({ code, module, action, description }) => ({ code, module, action, description }))).toEqual(
        ENTRADAS.map(({ code, module, action, description }) => ({ code, module, action, description })),
      )

      const asignaciones = await tx.rolePermission.findMany({
        where: { permissionCode: { in: CODIGOS } },
        include: { role: { select: { name: true } } },
        orderBy: { permissionCode: 'asc' },
      })
      expect(asignaciones.map((asignacion) => [asignacion.permissionCode, asignacion.role.name])).toEqual([
        ['planes.consultar', ROLE_MAESTRO],
        ['planes.modificar', ROLE_MAESTRO],
      ])

      const despues = await fullSnapshot(tx)
      expect(despues.permissions.length).toBe(antes.permissions.length + 2)
      expect(despues.rolePermissions.length).toBe(antes.rolePermissions.length + 2)
      expect(despues.roles).toEqual(antes.roles)
      expect(await assignmentsOfOtherRoles(tx)).toEqual(otrosAntes)
    })
  })

  it('R31: aplicar el UP dos veces no falla, no duplica y no reescribe ninguna fila, updated_at incluido', async () => {
    await inRolledBackTransaction(async (tx) => {
      await eraseFeatureRows(tx)
      await applyStatements(tx, UP_STATEMENTS)
      const trasLaPrimera = await fullSnapshot(tx)

      await applyStatements(tx, UP_STATEMENTS)

      expect(await fullSnapshot(tx)).toEqual(trasLaPrimera)
    })
  })

  it('R31: sobre una base que ya tiene los dos permisos y sus asignaciones, el UP no cambia nada', async () => {
    await inRolledBackTransaction(async (tx) => {
      expect(await tx.permission.count({ where: { code: { in: CODIGOS } } })).toBe(2)
      const antes = await fullSnapshot(tx)

      await applyStatements(tx, UP_STATEMENTS)

      expect(await fullSnapshot(tx)).toEqual(antes)
    })
  })

  it('R33: el DOWN, leido del archivo, deja la base exactamente como antes del UP', async () => {
    await inRolledBackTransaction(async (tx) => {
      await eraseFeatureRows(tx)
      const antesDelUp = await fullSnapshot(tx)

      await applyStatements(tx, UP_STATEMENTS)
      expect(await tx.permission.count({ where: { code: { in: CODIGOS } } })).toBe(2)

      await applyStatements(tx, DOWN_STATEMENTS)

      expect(await fullSnapshot(tx)).toEqual(antesDelUp)
      expect(await tx.permission.count({ where: { code: { in: CODIGOS } } })).toBe(0)
      expect(await tx.rolePermission.count({ where: { permissionCode: { in: CODIGOS } } })).toBe(0)
    })
  })
})
