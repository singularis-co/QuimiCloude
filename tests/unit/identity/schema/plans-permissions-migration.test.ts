// Contrato estatico del SQL de la migracion de los permisos de planes.
//
// Es una migracion de DATOS escrita a mano: Prisma no la regenera. Los literales del SQL no se
// copian aqui; se comparan con `PERMISSIONS`, `SEED_ROLE_PERMISSIONS` y `ROLE_MAESTRO` importados
// del barril.
//
// Cada predicado se aplica al SQL real y a una copia MUTADA EN MEMORIA: un test que no puede
// fallar no vigila nada. El archivo en disco no se toca.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { PERMISSIONS, ROLE_MAESTRO, SEED_ROLE_PERMISSIONS } from '@/lib/modules/identity'

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

const CODIGOS = ['planes.consultar', 'planes.modificar'] as const

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)))
const migrationsDir = join(repoRoot, 'db', 'migrations')

const plansPermissionDirs = readdirSync(migrationsDir).filter((name) =>
  /_plans_permissions$/.test(name),
)
expect(
  plansPermissionDirs,
  'debe existir exactamente una migracion de los permisos de planes',
).toHaveLength(1)
const migrationDirName = plansPermissionDirs[0] as string
const migrationDir = join(migrationsDir, migrationDirName)

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}

function statements(sql: string): readonly string[] {
  return stripSqlComments(sql)
    .split(';')
    .map((statement) => statement.replace(/\s+/g, ' ').trim())
    .filter((statement) => statement.length > 0)
}

const upSource = readFileSync(join(migrationDir, 'migration.sql'), 'utf8').replace(/\r\n/g, '\n')
const downSource = readFileSync(join(migrationDir, 'down.sql'), 'utf8').replace(/\r\n/g, '\n')

const ENTRADAS = PERMISSIONS.filter((permission) => permission.module === 'planes')

type PermissionRow = {
  code: string
  module: string
  action: string
  description: string
  updatedAt: string
}

const lista = CODIGOS.map((codigo) => `'${codigo}'`).join(', ')

// --- Predicados puros ----------------------------------------------------------------------

/** El UP son exactamente dos `INSERT`: el primero sobre `permissions` y el segundo sobre `role_permissions`. */
export function upIsTwoInsertsInOrder(sql: string): boolean {
  const todas = statements(sql)
  return (
    todas.length === 2 &&
    /^INSERT INTO "permissions"/i.test(todas[0] as string) &&
    /^INSERT INTO "role_permissions"/i.test(todas[1] as string)
  )
}

export function everyInsertIgnoresConflicts(sql: string): boolean {
  const inserts = statements(sql).filter((statement) => /^INSERT INTO/i.test(statement))
  if (inserts.length !== 2) return false
  return inserts.every((insert) => /ON CONFLICT \([^)]*\) DO NOTHING$/i.test(insert))
}

/** Las filas que el primer `INSERT` escribe, en orden. */
export function permissionRowsInUp(sql: string): readonly PermissionRow[] {
  const insert = statements(sql).find((statement) => /^INSERT INTO "permissions"/i.test(statement))
  if (insert === undefined) return []
  const cuerpo = /VALUES\s*(.*?)\s*ON CONFLICT/i.exec(insert)?.[1]
  if (cuerpo === undefined) return []
  return [...cuerpo.matchAll(/\(([^()]*)\)/g)].map((match) => {
    const fila = match[1] as string
    const campos = [...fila.matchAll(/'((?:[^']|'')*)'/g)].map((campo) =>
      (campo[1] as string).replace(/''/g, "'"),
    )
    return {
      code: campos[0] ?? '',
      module: campos[1] ?? '',
      action: campos[2] ?? '',
      description: campos[3] ?? '',
      updatedAt: /CURRENT_TIMESTAMP/i.test(fila) ? 'CURRENT_TIMESTAMP' : '',
    }
  })
}

/** Las filas insertadas son exactamente las entradas `planes.*` de `PERMISSIONS`, en su orden. */
export function permissionRowsMatchTheDomain(sql: string): boolean {
  const filas = permissionRowsInUp(sql)
  if (ENTRADAS.length !== CODIGOS.length || filas.length !== ENTRADAS.length) return false
  return ENTRADAS.every((entrada, i) => {
    const fila = filas[i] as PermissionRow
    return (
      fila.code === entrada.code &&
      fila.module === entrada.module &&
      fila.action === entrada.action &&
      fila.description === entrada.description &&
      fila.updatedAt === 'CURRENT_TIMESTAMP'
    )
  })
}

/** Los codigos que el `INSERT` de `role_permissions` reparte, en orden. */
export function assignedCodes(sql: string): readonly string[] {
  const insert = statements(sql).find((statement) => /^INSERT INTO "role_permissions"/i.test(statement))
  if (insert === undefined) return []
  const valores = /\(VALUES\s*(.*?)\)\s*AS "p"/i.exec(insert)?.[1]
  if (valores === undefined) return []
  return [...valores.matchAll(/\('((?:[^']|'')*)'\)/g)].map((match) => match[1] as string)
}

/**
 * El `INSERT` de `role_permissions` da los dos codigos solo al rol Maestro, resuelto por nombre y
 * sin heredar de otra asignacion: el unico `JOIN` admitido es el `CROSS JOIN` con la lista de
 * codigos.
 */
export function onlyTheMaestroGetsTheCodes(sql: string): boolean {
  const insert = statements(sql).find((statement) => /^INSERT INTO "role_permissions"/i.test(statement))
  if (insert === undefined) return false
  const nombres = [...insert.matchAll(/"r"\."name"\s*=\s*'([^']*)'/gi)].map((match) => match[1])
  const sinElCrossJoin = insert.replace(/CROSS JOIN \(VALUES (\('[^']*'\)(, )?)+\) AS "p"\("code"\)/i, '')
  return (
    nombres.length === 1 &&
    nombres[0] === ROLE_MAESTRO &&
    !/"role_permissions" AS/i.test(insert) &&
    !/\bJOIN\b/i.test(sinElCrossJoin)
  )
}

export function schemaStatements(sql: string): readonly string[] {
  return statements(sql).filter((statement) =>
    /(^(ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE|COMMENT)\b)|(\bDROP (CONSTRAINT|COLUMN|INDEX|TABLE|TYPE|POLICY|FUNCTION|TRIGGER)\b)|(\bADD (CONSTRAINT|COLUMN)\b)|(\bROW LEVEL SECURITY\b)/i.test(
      statement,
    ),
  )
}

/** Sentencias que escriben en `roles`: la migracion solo puede leerla. */
export function writesToRoles(sql: string): readonly string[] {
  return statements(sql).filter((statement) =>
    /^(INSERT INTO|UPDATE|DELETE FROM|TRUNCATE)\s+"?roles"?\b/i.test(statement),
  )
}

/** El DOWN son exactamente los dos `DELETE` acotados, las asignaciones antes que los permisos. */
export function downDeletesAssignmentsBeforeCatalog(sql: string): boolean {
  const sentencias = statements(sql)
  return (
    sentencias.length === 2 &&
    sentencias[0] === `DELETE FROM "role_permissions" WHERE "permission_code" IN (${lista})` &&
    sentencias[1] === `DELETE FROM "permissions" WHERE "code" IN (${lista})`
  )
}

export function downHasOnlyBareDeletes(sql: string): boolean {
  const ejecutable = stripSqlComments(sql)
  if (/CASCADE/i.test(ejecutable)) return false
  return statements(sql).every(
    (statement) => /^DELETE FROM/i.test(statement) && !/^(INSERT|UPDATE|ALTER)\b/i.test(statement),
  )
}

export function everyDeleteIsScopedToTheCodes(sql: string): boolean {
  return statements(sql).every((statement) => statement.endsWith(` IN (${lista})`))
}

function withReversedStatements(sql: string): string {
  return statements(sql)
    .slice()
    .reverse()
    .map((statement) => `${statement};`)
    .join('\n')
}

// --- Solo migracion y seed --------------------------------------------------------------------

describe('los permisos de planes solo llegan por esta migracion y por el seed', () => {
  it('R27: ninguna otra migracion nombra planes.consultar ni planes.modificar', () => {
    const queLosNombran = readdirSync(migrationsDir)
      .filter((name) => statSync(join(migrationsDir, name)).isDirectory())
      .filter((name) =>
        ['migration.sql', 'down.sql'].some((file) => {
          const path = join(migrationsDir, name, file)
          try {
            const sql = readFileSync(path, 'utf8')
            return CODIGOS.some((codigo) => sql.includes(codigo))
          } catch {
            return false
          }
        }),
      )

    expect(queLosNombran).toEqual([migrationDirName])
  })
})

// --- El UP ------------------------------------------------------------------------------------

describe('migration.sql — dos INSERT, solo datos', () => {
  it('R31: el UP son dos INSERT, sobre permissions y role_permissions en ese orden, y cae si se invierten', () => {
    expect(upIsTwoInsertsInOrder(upSource)).toBe(true)

    const invertido = withReversedStatements(upSource)
    expect(invertido).not.toBe(upSource)
    expect(upIsTwoInsertsInOrder(invertido)).toBe(false)
    expect(upIsTwoInsertsInOrder(`${upSource}\nDELETE FROM "permissions" WHERE "code" = 'x';`)).toBe(
      false,
    )
  })

  it('R27: las filas insertadas son exactamente las dos entradas de planes de PERMISSIONS, en orden y con updated_at explicito', () => {
    expect(ENTRADAS.map((entrada) => entrada.code)).toEqual([...CODIGOS])
    expect(permissionRowsMatchTheDomain(upSource)).toBe(true)

    const otraDescripcion = upSource.replace(ENTRADAS[1]!.description, 'Otra cosa.')
    expect(otraDescripcion).not.toBe(upSource)
    expect(permissionRowsMatchTheDomain(otraDescripcion)).toBe(false)

    const otroModulo = upSource.replace(`'planes', 'consultar'`, `'empresas', 'consultar'`)
    expect(otroModulo).not.toBe(upSource)
    expect(permissionRowsMatchTheDomain(otroModulo)).toBe(false)

    const sinUpdatedAt = upSource.replace('CURRENT_TIMESTAMP)', 'DEFAULT)')
    expect(sinUpdatedAt).not.toBe(upSource)
    expect(permissionRowsMatchTheDomain(sinUpdatedAt)).toBe(false)

    const soloUna = upSource.replace(
      /,\s*\('planes\.modificar'[^\n]*CURRENT_TIMESTAMP\)/,
      '',
    )
    expect(soloUna).not.toBe(upSource)
    expect(permissionRowsMatchTheDomain(soloUna)).toBe(false)
  })

  it('R28: la asignacion reparte los dos codigos de planes del Maestro, y cae si falta uno', () => {
    const delMaestro = (SEED_ROLE_PERMISSIONS[ROLE_MAESTRO] ?? []).filter((codigo) =>
      codigo.startsWith('planes.'),
    )
    expect(delMaestro).toEqual([...CODIGOS])
    expect(assignedCodes(upSource)).toEqual(delMaestro)

    const soloUno = upSource.replace(", ('planes.modificar')", '')
    expect(soloUno).not.toBe(upSource)
    expect(assignedCodes(soloUno)).not.toEqual(delMaestro)
  })

  it('R28: la asignacion va solo al Maestro, por nombre y sin heredar de otro permiso', () => {
    expect(onlyTheMaestroGetsTheCodes(upSource)).toBe(true)

    const otroRol = upSource.replace(`= '${ROLE_MAESTRO}'`, `= 'Administrador'`)
    expect(otroRol).not.toBe(upSource)
    expect(onlyTheMaestroGetsTheCodes(otroRol)).toBe(false)

    const heredando = upSource.replace(
      `FROM "roles" AS "r"`,
      `FROM "roles" AS "r" JOIN "role_permissions" AS "rp" ON "rp"."role_id" = "r"."id"`,
    )
    expect(heredando).not.toBe(upSource)
    expect(onlyTheMaestroGetsTheCodes(heredando)).toBe(false)

    const sinFiltro = upSource.replace(`WHERE "r"."name" = '${ROLE_MAESTRO}'`, '')
    expect(sinFiltro).not.toBe(upSource)
    expect(onlyTheMaestroGetsTheCodes(sinFiltro)).toBe(false)
  })

  it('R31: los dos INSERT llevan ON CONFLICT ... DO NOTHING, y cae si se quita uno o pasa a DO UPDATE', () => {
    expect(everyInsertIgnoresConflicts(upSource)).toBe(true)

    const sinConflictoDelCatalogo = upSource.replace(/\s*ON CONFLICT \("code"\) DO NOTHING/i, '')
    expect(sinConflictoDelCatalogo).not.toBe(upSource)
    expect(everyInsertIgnoresConflicts(sinConflictoDelCatalogo)).toBe(false)

    const sinConflictoDeAsignacion = upSource.replace(
      /\s*ON CONFLICT \("role_id", "permission_code"\) DO NOTHING/i,
      '',
    )
    expect(sinConflictoDeAsignacion).not.toBe(upSource)
    expect(everyInsertIgnoresConflicts(sinConflictoDeAsignacion)).toBe(false)

    const conDoUpdate = upSource.replace(
      /ON CONFLICT \("code"\) DO NOTHING/i,
      'ON CONFLICT ("code") DO UPDATE SET "description" = EXCLUDED."description"',
    )
    expect(conDoUpdate).not.toBe(upSource)
    expect(everyInsertIgnoresConflicts(conDoUpdate)).toBe(false)
  })

  it('R31: el UP no toca el esquema ni escribe en roles, y cae si se cuela una de las dos cosas', () => {
    expect(schemaStatements(upSource)).toEqual([])
    expect(writesToRoles(upSource)).toEqual([])

    expect(schemaStatements(`${upSource}\nALTER TABLE "permissions" ADD COLUMN "x" TEXT;`)).toHaveLength(1)
    expect(schemaStatements(`${upSource}\nCREATE INDEX "x_idx" ON "permissions"("module");`)).toHaveLength(1)
    expect(
      schemaStatements(`${upSource}\nALTER TABLE "permissions" NO FORCE ROW LEVEL SECURITY;`),
    ).toHaveLength(1)
    expect(
      writesToRoles(`${upSource}\nUPDATE "roles" SET "description" = 'x' WHERE "name" = 'Maestro';`),
    ).toHaveLength(1)
    expect(writesToRoles(`${upSource}\nINSERT INTO "roles" ("name") VALUES ('Maestro');`)).toHaveLength(1)
  })
})

// --- El DOWN ----------------------------------------------------------------------------------

describe('down.sql — dos DELETE acotados', () => {
  it('R33: borra primero las asignaciones y despues los permisos, y cae si se invierte', () => {
    expect(downDeletesAssignmentsBeforeCatalog(downSource)).toBe(true)

    const invertido = withReversedStatements(downSource)
    expect(invertido).not.toBe(downSource)
    expect(downDeletesAssignmentsBeforeCatalog(invertido)).toBe(false)
  })

  it('R33: cada DELETE va acotado a los dos codigos, y cae si se le quita el WHERE a uno o se le quita un codigo', () => {
    expect(everyDeleteIsScopedToTheCodes(downSource)).toBe(true)

    const sinWhere = downSource.replace(
      `DELETE FROM "role_permissions" WHERE "permission_code" IN (${lista});`,
      `DELETE FROM "role_permissions";`,
    )
    expect(sinWhere).not.toBe(downSource)
    expect(everyDeleteIsScopedToTheCodes(sinWhere)).toBe(false)
    expect(downDeletesAssignmentsBeforeCatalog(sinWhere)).toBe(false)

    const unCodigoMenos = downSource.replace(
      `DELETE FROM "permissions" WHERE "code" IN (${lista});`,
      `DELETE FROM "permissions" WHERE "code" IN ('planes.consultar');`,
    )
    expect(unCodigoMenos).not.toBe(downSource)
    expect(downDeletesAssignmentsBeforeCatalog(unCodigoMenos)).toBe(false)
  })

  it('R33: no lleva CASCADE, INSERT, UPDATE ni ALTER, ni toca el esquema', () => {
    expect(downHasOnlyBareDeletes(downSource)).toBe(true)
    expect(schemaStatements(downSource)).toEqual([])

    const conCascade = downSource.replace(`IN (${lista});\n`, `IN (${lista}) CASCADE;\n`)
    expect(conCascade).not.toBe(downSource)
    expect(downHasOnlyBareDeletes(conCascade)).toBe(false)

    expect(
      downHasOnlyBareDeletes(`${downSource}\nUPDATE "permissions" SET "description" = 'x';`),
    ).toBe(false)
  })
})
