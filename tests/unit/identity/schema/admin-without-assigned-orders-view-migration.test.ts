// Contrato estatico del SQL de la migracion que quita `asignaciones.consultar` al Administrador.
//
// Migracion de DATOS escrita a mano: el rol y el codigo se IMPORTAN del barril de `identity` y se
// comparan con lo que dice el SQL, en vez de copiarlos. Cada predicado se aplica al SQL real y a
// una copia mutada en memoria para demostrar que dispara; el archivo en disco no se toca.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  ADMIN_EXCLUDED_PERMISSIONS,
  ROLE_ACONDICIONAMIENTO,
  ROLE_ADMINISTRADOR,
  ROLE_EMPACADOR,
  ROLE_OPERADOR,
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

const migrationsDir = join(findRepoRoot(dirname(fileURLToPath(import.meta.url))), 'db', 'migrations')
const carpetas = readdirSync(migrationsDir).filter((name) =>
  /^\d{14}_admin_without_assigned_orders_view$/.test(name),
)

/** Las sentencias del SQL, sin comentarios y con los espacios normalizados. */
export function sentencias(sql: string): string[] {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((statement) => statement.replace(/\s+/g, ' ').trim())
    .filter((statement) => statement.length > 0)
}

const CODIGO = 'asignaciones.consultar'

/** El UP es exactamente un `DELETE` de `role_permissions` acotado al codigo y al rol por nombre. */
export function upBorraSoloLaFilaDelAdministrador(sql: string, rol: string, codigo: string): boolean {
  const todas = sentencias(sql)
  if (todas.length !== 1) return false
  const [unica] = todas
  return (
    /^DELETE FROM "role_permissions" WHERE/i.test(unica) &&
    unica.includes(`"permission_code" = '${codigo}'`) &&
    unica.includes(`SELECT "id" FROM "roles" WHERE "name" = '${rol}'`)
  )
}

/** El DOWN es exactamente un `INSERT` idempotente que devuelve el codigo al mismo rol. */
export function downDevuelveLaFila(sql: string, rol: string, codigo: string): boolean {
  const todas = sentencias(sql)
  if (todas.length !== 1) return false
  const [unica] = todas
  return (
    /^INSERT INTO "role_permissions"/i.test(unica) &&
    unica.includes(`'${codigo}'`) &&
    unica.includes(`"r"."name" = '${rol}'`) &&
    /ON CONFLICT \("role_id", "permission_code"\) DO NOTHING$/i.test(unica)
  )
}

describe('migracion: el Administrador deja de consultar «Asignación»', () => {
  it('existe exactamente una carpeta, con su migration.sql y su down.sql', () => {
    expect(carpetas).toHaveLength(1)
  })

  const carpeta = join(migrationsDir, carpetas[0] ?? '')
  const up = carpetas.length === 1 ? readFileSync(join(carpeta, 'migration.sql'), 'utf8') : ''
  const down = carpetas.length === 1 ? readFileSync(join(carpeta, 'down.sql'), 'utf8') : ''

  it('el UP borra solo asignaciones.consultar del Administrador, resuelto por nombre', () => {
    expect(upBorraSoloLaFilaDelAdministrador(up, ROLE_ADMINISTRADOR, CODIGO)).toBe(true)
    // Coherente con el dominio: el codigo que borra es un excluido del Administrador.
    expect(ADMIN_EXCLUDED_PERMISSIONS).toContain(CODIGO)
    expect(SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]).not.toContain(CODIGO)
  })

  it('el UP no nombra a ningun rol operativo, que conserva el permiso', () => {
    for (const rol of [ROLE_OPERADOR, ROLE_EMPACADOR, ROLE_ACONDICIONAMIENTO]) {
      expect(up, rol).not.toContain(`'${rol}'`)
      expect(SEED_ROLE_PERMISSIONS[rol], rol).toContain(CODIGO)
    }
  })

  it('el DOWN devuelve la fila al Administrador de forma idempotente', () => {
    expect(downDevuelveLaFila(down, ROLE_ADMINISTRADOR, CODIGO)).toBe(true)
  })

  it('los predicados disparan con copias mutadas del SQL', () => {
    const otroRol = up.replace(`'${ROLE_ADMINISTRADOR}'`, `'${ROLE_OPERADOR}'`)
    const conOtroDelete = `${up}\nDELETE FROM "permissions" WHERE "code" = '${CODIGO}';`
    const sinAcotarRol = up.replace(/AND "role_id"[\s\S]*?\)/, '')
    const sinIdempotencia = down.replace(/ON CONFLICT \("role_id"[\s\S]*?DO NOTHING/, '')

    expect(upBorraSoloLaFilaDelAdministrador(otroRol, ROLE_ADMINISTRADOR, CODIGO)).toBe(false)
    expect(upBorraSoloLaFilaDelAdministrador(conOtroDelete, ROLE_ADMINISTRADOR, CODIGO)).toBe(false)
    expect(upBorraSoloLaFilaDelAdministrador(sinAcotarRol, ROLE_ADMINISTRADOR, CODIGO)).toBe(false)
    expect(downDevuelveLaFila(sinIdempotencia, ROLE_ADMINISTRADOR, CODIGO)).toBe(false)
  })
})
