// Contrato estatico del SQL de la migracion de datos del añadido y los permisos del agente de IA.
//
// Los literales del SQL no se copian aqui: se comparan con `ADDONS`, `ADDON_REQUIRES`,
// `PERMISSIONS`, `SEED_ROLE_PERMISSIONS` y `ROLE_ADMINISTRADOR` importados del barril.
//
// Cada predicado se aplica al SQL real y a una copia MUTADA EN MEMORIA: un test que no puede
// fallar no vigila nada. El archivo en disco no se toca.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  ADDONS,
  ADDON_REQUIRES,
  PERMISSIONS,
  ROLE_ADMINISTRADOR,
  SEED_ROLE_PERMISSIONS,
} from '@/lib/modules/identity'

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

const ADDON = 'agente_ia_whatsapp'
const CODIGOS = ['agente_ia.consultar', 'agente_ia.modificar'] as const

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)))
const migrationsDir = join(repoRoot, 'db', 'migrations')
const MIGRATION_DIR_NAME = '20261030120100_whatsapp_agent_permissions'
const migrationDir = join(migrationsDir, MIGRATION_DIR_NAME)

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

const ENTRADAS = PERMISSIONS.filter((permission) => permission.module === 'agente_ia')
const lista = CODIGOS.map((codigo) => `'${codigo}'`).join(', ')

type PermissionRow = { code: string; module: string; action: string; description: string; updatedAt: string }

// --- Predicados puros ----------------------------------------------------------------------

const ORDEN_DEL_UP = ['addons', 'permissions', 'role_permissions', 'company_addon_overrides'] as const

/** El UP son exactamente cuatro `INSERT`, uno por tabla, en el orden de `ORDEN_DEL_UP`. */
export function upIsFourInsertsInOrder(sql: string): boolean {
  const todas = statements(sql)
  return (
    todas.length === ORDEN_DEL_UP.length &&
    ORDEN_DEL_UP.every((tabla, i) => new RegExp(`^INSERT INTO "${tabla}"`, 'i').test(todas[i] as string))
  )
}

export function everyInsertIgnoresConflicts(sql: string): boolean {
  const inserts = statements(sql).filter((statement) => /^INSERT INTO/i.test(statement))
  if (inserts.length !== ORDEN_DEL_UP.length) return false
  return inserts.every((insert) => /ON CONFLICT \([^)]*\) DO NOTHING$/i.test(insert))
}

function insertInto(sql: string, tabla: string): string | undefined {
  return statements(sql).find((statement) => new RegExp(`^INSERT INTO "${tabla}"`, 'i').test(statement))
}

/** Las claves que siembra el `INSERT INTO "addons"`. */
export function seededAddonKeys(sql: string): readonly string[] {
  const insert = insertInto(sql, 'addons')
  if (insert === undefined) return []
  const valores = /VALUES\s*(.*?)\s*ON CONFLICT/i.exec(insert)?.[1] ?? ''
  return [...valores.matchAll(/\('([^']*)'\)/g)].map((match) => match[1] as string)
}

export function permissionRowsInUp(sql: string): readonly PermissionRow[] {
  const insert = insertInto(sql, 'permissions')
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

/** Las filas insertadas son exactamente las entradas `agente_ia.*` de `PERMISSIONS`, en su orden. */
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

export function assignedCodes(sql: string): readonly string[] {
  const insert = insertInto(sql, 'role_permissions')
  if (insert === undefined) return []
  const valores = /\(VALUES\s*(.*?)\)\s*AS "p"/i.exec(insert)?.[1]
  if (valores === undefined) return []
  return [...valores.matchAll(/\('((?:[^']|'')*)'\)/g)].map((match) => match[1] as string)
}

/** La asignacion va solo al Administrador, por nombre, sin heredar de otra asignacion. */
export function onlyTheAdministratorGetsTheCodes(sql: string): boolean {
  const insert = insertInto(sql, 'role_permissions')
  if (insert === undefined) return false
  const nombres = [...insert.matchAll(/"r"\."name"\s*=\s*'([^']*)'/gi)].map((match) => match[1])
  const sinElCrossJoin = insert.replace(/CROSS JOIN \(VALUES (\('[^']*'\)(, )?)+\) AS "p"\("code"\)/i, '')
  return (
    nombres.length === 1 &&
    nombres[0] === ROLE_ADMINISTRADOR &&
    !/\bIN\s*\(/i.test(insert) &&
    !/"role_permissions" AS/i.test(insert) &&
    !/\bJOIN\b/i.test(sinElCrossJoin)
  )
}

/**
 * El `INSERT` de excepciones siembra el añadido prendido, como `manual` y sin autor, solo desde las
 * excepciones de `integraciones` prendidas: ni de `companies` ni de otro añadido ni de las apagadas.
 */
export function overridesComeOnlyFromEnabledIntegrations(sql: string): boolean {
  const insert = insertInto(sql, 'company_addon_overrides')
  if (insert === undefined) return false
  const esperado =
    `INSERT INTO "company_addon_overrides" ("company_id", "addon_key", "enabled", "source") ` +
    `SELECT "o"."company_id", '${ADDON}', true, 'manual' FROM "company_addon_overrides" AS "o" ` +
    `WHERE "o"."addon_key" = '${ADDON_REQUIRES[ADDON][0]}' AND "o"."enabled" ` +
    `ON CONFLICT ("company_id", "addon_key") DO NOTHING`
  return insert === esperado
}

export function schemaStatements(sql: string): readonly string[] {
  return statements(sql).filter((statement) =>
    /(^(ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE|COMMENT)\b)|(\bDROP (CONSTRAINT|COLUMN|INDEX|TABLE|TYPE|POLICY|FUNCTION|TRIGGER)\b)|(\bADD (CONSTRAINT|COLUMN)\b)|(\bROW LEVEL SECURITY\b)/i.test(
      statement,
    ),
  )
}

/** Sentencias que actualizan, borran o escriben en `roles` o `companies`: el UP solo inserta. */
export function nonInsertWrites(sql: string): readonly string[] {
  return statements(sql).filter(
    (statement) =>
      /^(UPDATE|DELETE FROM|TRUNCATE|MERGE)\b/i.test(statement) ||
      /^INSERT INTO\s+"?(roles|companies)"?\b/i.test(statement),
  )
}

const DOWN_ESPERADO = [
  `DELETE FROM "company_addon_overrides" WHERE "addon_key" = '${ADDON}'`,
  `DELETE FROM "plan_addons" WHERE "addon_key" = '${ADDON}'`,
  `DELETE FROM "role_permissions" WHERE "permission_code" IN (${lista})`,
  `DELETE FROM "permissions" WHERE "code" IN (${lista})`,
  `DELETE FROM "addons" WHERE "key" = '${ADDON}'`,
]

/** El DOWN son exactamente los cinco `DELETE` acotados, las hijas antes que sus catalogos. */
export function downDeletesChildrenBeforeCatalogs(sql: string): boolean {
  const sentencias = statements(sql)
  return sentencias.length === DOWN_ESPERADO.length && DOWN_ESPERADO.every((s, i) => sentencias[i] === s)
}

export function downHasOnlyBareDeletes(sql: string): boolean {
  if (/CASCADE/i.test(stripSqlComments(sql))) return false
  return statements(sql).every((statement) => /^DELETE FROM/i.test(statement))
}

function withReversedStatements(sql: string): string {
  return statements(sql)
    .slice()
    .reverse()
    .map((statement) => `${statement};`)
    .join('\n')
}

function migrationsNaming(fragmentos: readonly string[]): readonly string[] {
  return readdirSync(migrationsDir)
    .filter((name) => statSync(join(migrationsDir, name)).isDirectory())
    .filter((name) =>
      ['migration.sql', 'down.sql'].some((file) => {
        try {
          const sql = readFileSync(join(migrationsDir, name, file), 'utf8')
          return fragmentos.some((fragmento) => sql.includes(fragmento))
        } catch {
          return false
        }
      }),
    )
}

// --- Solo esta migracion ----------------------------------------------------------------------

describe('el añadido y los permisos del agente solo llegan por esta migracion', () => {
  it('R1, R3: ninguna otra migracion nombra agente_ia_whatsapp, agente_ia.consultar ni agente_ia.modificar', () => {
    expect(migrationsNaming([`'${ADDON}'`, ...CODIGOS])).toEqual([MIGRATION_DIR_NAME])
  })

  it('R6: la migracion va despues de la del esquema del agente', () => {
    const esquema = readdirSync(migrationsDir).filter((name) => /^\d{14}_whatsapp_agent$/.test(name))
    expect(esquema).toHaveLength(1)
    expect(MIGRATION_DIR_NAME > (esquema[0] as string)).toBe(true)
  })
})

// --- El UP ------------------------------------------------------------------------------------

describe('migration.sql — cuatro INSERT, solo datos', () => {
  it('R6: el UP son cuatro INSERT, sobre addons, permissions, role_permissions y company_addon_overrides en ese orden', () => {
    expect(upIsFourInsertsInOrder(upSource)).toBe(true)

    const invertido = withReversedStatements(upSource)
    expect(invertido).not.toBe(upSource)
    expect(upIsFourInsertsInOrder(invertido)).toBe(false)
    expect(upIsFourInsertsInOrder(`${upSource}\nDELETE FROM "addons" WHERE "key" = 'x';`)).toBe(false)
  })

  it('R1: siembra en addons exactamente la clave del catalogo del codigo, que es la ultima de ADDONS', () => {
    expect(ADDONS.at(-1)).toBe(ADDON)
    expect(seededAddonKeys(upSource)).toEqual([ADDON])

    const otraClave = upSource.replace(`VALUES ('${ADDON}')`, `VALUES ('agente_ia')`)
    expect(otraClave).not.toBe(upSource)
    expect(seededAddonKeys(otraClave)).not.toEqual([ADDON])
  })

  it('R3: las filas de permissions son exactamente las dos entradas agente_ia de PERMISSIONS, en orden y con updated_at', () => {
    expect(ENTRADAS.map((entrada) => entrada.code)).toEqual([...CODIGOS])
    expect(permissionRowsMatchTheDomain(upSource)).toBe(true)

    const otraDescripcion = upSource.replace(ENTRADAS[1]!.description, 'Otra cosa.')
    expect(otraDescripcion).not.toBe(upSource)
    expect(permissionRowsMatchTheDomain(otraDescripcion)).toBe(false)

    const otroModulo = upSource.replace(`'agente_ia', 'consultar'`, `'integraciones', 'consultar'`)
    expect(otroModulo).not.toBe(upSource)
    expect(permissionRowsMatchTheDomain(otroModulo)).toBe(false)

    const sinUpdatedAt = upSource.replace('CURRENT_TIMESTAMP)', 'DEFAULT)')
    expect(sinUpdatedAt).not.toBe(upSource)
    expect(permissionRowsMatchTheDomain(sinUpdatedAt)).toBe(false)
  })

  it('R5: la asignacion reparte los dos codigos que el seed da al Administrador, y cae si falta uno', () => {
    const delAdministrador = (SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR] ?? []).filter((codigo) =>
      codigo.startsWith('agente_ia.'),
    )
    expect(delAdministrador).toEqual([...CODIGOS])
    expect(assignedCodes(upSource)).toEqual(delAdministrador)

    const soloUno = upSource.replace(", ('agente_ia.modificar')", '')
    expect(soloUno).not.toBe(upSource)
    expect(assignedCodes(soloUno)).not.toEqual(delAdministrador)
  })

  it('R5: la asignacion va solo al Administrador, por nombre y sin heredar de otro permiso', () => {
    expect(onlyTheAdministratorGetsTheCodes(upSource)).toBe(true)

    const otroRol = upSource.replace(`= '${ROLE_ADMINISTRADOR}'`, `= 'Operador'`)
    expect(otroRol).not.toBe(upSource)
    expect(onlyTheAdministratorGetsTheCodes(otroRol)).toBe(false)

    const variosRoles = upSource.replace(
      `"r"."name" = '${ROLE_ADMINISTRADOR}'`,
      `"r"."name" IN ('${ROLE_ADMINISTRADOR}', 'Operador')`,
    )
    expect(variosRoles).not.toBe(upSource)
    expect(onlyTheAdministratorGetsTheCodes(variosRoles)).toBe(false)

    const heredando = upSource.replace(
      `FROM "roles" AS "r"`,
      `FROM "roles" AS "r" JOIN "role_permissions" AS "rp" ON "rp"."role_id" = "r"."id"`,
    )
    expect(heredando).not.toBe(upSource)
    expect(onlyTheAdministratorGetsTheCodes(heredando)).toBe(false)
  })

  it('R6: las excepciones salen solo de integraciones prendido, nacen prendidas y no tocan otras filas', () => {
    expect(ADDON_REQUIRES[ADDON]).toEqual(['integraciones'])
    expect(overridesComeOnlyFromEnabledIntegrations(upSource)).toBe(true)

    const todasLasEmpresas = upSource.replace(
      `FROM "company_addon_overrides" AS "o"\nWHERE "o"."addon_key" = 'integraciones' AND "o"."enabled"`,
      `FROM "companies" AS "o"`,
    )
    expect(todasLasEmpresas).not.toBe(upSource)
    expect(overridesComeOnlyFromEnabledIntegrations(todasLasEmpresas)).toBe(false)

    const tambienApagadas = upSource.replace(` AND "o"."enabled"`, '')
    expect(tambienApagadas).not.toBe(upSource)
    expect(overridesComeOnlyFromEnabledIntegrations(tambienApagadas)).toBe(false)

    const nacenApagadas = upSource.replace(`'${ADDON}', true, 'manual'`, `'${ADDON}', false, 'manual'`)
    expect(nacenApagadas).not.toBe(upSource)
    expect(overridesComeOnlyFromEnabledIntegrations(nacenApagadas)).toBe(false)

    const pisando = upSource.replace(
      `ON CONFLICT ("company_id", "addon_key") DO NOTHING`,
      `ON CONFLICT ("company_id", "addon_key") DO UPDATE SET "enabled" = true`,
    )
    expect(pisando).not.toBe(upSource)
    expect(overridesComeOnlyFromEnabledIntegrations(pisando)).toBe(false)
  })

  it('R6: los cuatro INSERT llevan ON CONFLICT ... DO NOTHING, y cae si se quita uno o pasa a DO UPDATE', () => {
    expect(everyInsertIgnoresConflicts(upSource)).toBe(true)

    const sinConflicto = upSource.replace(/\s*ON CONFLICT \("key"\) DO NOTHING/i, '')
    expect(sinConflicto).not.toBe(upSource)
    expect(everyInsertIgnoresConflicts(sinConflicto)).toBe(false)

    const conDoUpdate = upSource.replace(
      /ON CONFLICT \("code"\) DO NOTHING/i,
      'ON CONFLICT ("code") DO UPDATE SET "description" = EXCLUDED."description"',
    )
    expect(conDoUpdate).not.toBe(upSource)
    expect(everyInsertIgnoresConflicts(conDoUpdate)).toBe(false)
  })

  it('R6: el UP no toca el esquema ni actualiza, borra o escribe en roles o companies', () => {
    expect(schemaStatements(upSource)).toEqual([])
    expect(nonInsertWrites(upSource)).toEqual([])

    expect(schemaStatements(`${upSource}\nALTER TABLE "addons" ADD COLUMN "x" TEXT;`)).toHaveLength(1)
    expect(
      nonInsertWrites(`${upSource}\nUPDATE "company_addon_overrides" SET "enabled" = true;`),
    ).toHaveLength(1)
    expect(nonInsertWrites(`${upSource}\nINSERT INTO "roles" ("name") VALUES ('x');`)).toHaveLength(1)
  })
})

// --- El DOWN ----------------------------------------------------------------------------------

describe('down.sql — cinco DELETE acotados', () => {
  it('R6: borra excepciones, filas de planes, asignaciones, permisos y la clave del añadido, en ese orden', () => {
    expect(downDeletesChildrenBeforeCatalogs(downSource)).toBe(true)

    const invertido = withReversedStatements(downSource)
    expect(invertido).not.toBe(downSource)
    expect(downDeletesChildrenBeforeCatalogs(invertido)).toBe(false)
  })

  it('R6: cada DELETE va acotado al añadido o a sus dos codigos, y cae si se le quita el WHERE', () => {
    const sinWhere = downSource.replace(
      `DELETE FROM "company_addon_overrides" WHERE "addon_key" = '${ADDON}';`,
      `DELETE FROM "company_addon_overrides";`,
    )
    expect(sinWhere).not.toBe(downSource)
    expect(downDeletesChildrenBeforeCatalogs(sinWhere)).toBe(false)

    const otroAnadido = downSource.replace(
      `WHERE "addon_key" = '${ADDON}'`,
      `WHERE "addon_key" = 'integraciones'`,
    )
    expect(otroAnadido).not.toBe(downSource)
    expect(downDeletesChildrenBeforeCatalogs(otroAnadido)).toBe(false)
  })

  it('R6: no lleva CASCADE, INSERT, UPDATE ni ALTER, ni toca el esquema', () => {
    expect(downHasOnlyBareDeletes(downSource)).toBe(true)
    expect(schemaStatements(downSource)).toEqual([])

    const conCascade = downSource.replace(`WHERE "key" = '${ADDON}';`, `WHERE "key" = '${ADDON}' CASCADE;`)
    expect(conCascade).not.toBe(downSource)
    expect(downHasOnlyBareDeletes(conCascade)).toBe(false)

    expect(downHasOnlyBareDeletes(`${downSource}\nUPDATE "addons" SET "key" = 'x';`)).toBe(false)
  })
})
