// Contrato estático del SQL de la migración que añade `companies.addons`.
//
// La lista del `UPDATE` se compara con `ADDONS`, importado del dominio, en vez de copiarla. Cada
// predicado se aplica al SQL real y a copias mutadas en memoria para demostrar que dispara.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { ADDONS } from '@/lib/modules/identity'

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
const carpetas = readdirSync(migrationsDir).filter((name) => /^\d{14}_company_addons$/.test(name))

/** Las sentencias del SQL, sin comentarios y con los espacios normalizados. */
function sentencias(sql: string): string[] {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((statement) => statement.replace(/\s+/g, ' ').trim())
    .filter((statement) => statement.length > 0)
}

/** Las claves del `ARRAY[...]` de una sentencia, en su orden. */
function clavesDelArray(statement: string): string[] | null {
  const match = /ARRAY\[([^\]]*)\]::TEXT\[\]/i.exec(statement)
  if (!match) return null
  if (match[1].trim() === '') return []
  return match[1].split(',').map((item) => item.trim().replace(/^'(.*)'$/, '$1'))
}

/** El UP: añade la columna con el núcleo por defecto y prende exactamente `esperadas` en todas. */
function upAnadeLaColumnaYPrende(sql: string, esperadas: readonly string[]): boolean {
  const todas = sentencias(sql)
  if (todas.length !== 2) return false
  const [alter, update] = todas
  return (
    alter === 'ALTER TABLE "companies" ADD COLUMN "addons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]' &&
    /^UPDATE "companies" SET "addons" = ARRAY\[[^\]]*\]::TEXT\[\]$/i.test(update) &&
    JSON.stringify(clavesDelArray(update)) === JSON.stringify([...esperadas])
  )
}

/** El DOWN: quita la columna y nada más. */
function downQuitaSoloLaColumna(sql: string): boolean {
  const todas = sentencias(sql)
  return todas.length === 1 && todas[0] === 'ALTER TABLE "companies" DROP COLUMN "addons"'
}

describe('migración: interruptores de añadidos por empresa', () => {
  it('existe exactamente una carpeta, con su migration.sql y su down.sql', () => {
    expect(carpetas).toHaveLength(1)
  })

  const carpeta = join(migrationsDir, carpetas[0] ?? '')
  const up = carpetas.length === 1 ? readFileSync(join(carpeta, 'migration.sql'), 'utf8') : ''
  const down = carpetas.length === 1 ? readFileSync(join(carpeta, 'down.sql'), 'utf8') : ''

  it('R5, R6 — el UP añade la columna sin añadidos por defecto y el UPDATE lista exactamente ADDONS', () => {
    expect(upAnadeLaColumnaYPrende(up, ADDONS)).toBe(true)
  })

  it('R6 — el UPDATE no tiene WHERE: alcanza también a las empresas de baja', () => {
    expect(up).not.toMatch(/\bWHERE\b/i)
  })

  it('R38 — el DOWN quita exactamente la columna y nada más', () => {
    expect(downQuitaSoloLaColumna(down)).toBe(true)
  })

  it('R6, R38 — los predicados disparan con copias mutadas del SQL', () => {
    const faltaUna = up.replace(",'integraciones'", '')
    const sobraUna = up.replace("'integraciones'", "'integraciones','pedidos'")
    const conWhere = up.replace('::TEXT[];', '::TEXT[] WHERE "deleted_at" IS NULL;')
    const sinDefault = up.replace(' DEFAULT ARRAY[]::TEXT[]', '')
    const downDeMas = `${down}\nALTER TABLE "companies" DROP COLUMN "country";`

    expect(upAnadeLaColumnaYPrende(faltaUna, ADDONS)).toBe(false)
    expect(upAnadeLaColumnaYPrende(sobraUna, ADDONS)).toBe(false)
    expect(conWhere).toMatch(/\bWHERE\b/i)
    expect(upAnadeLaColumnaYPrende(conWhere, ADDONS)).toBe(false)
    expect(upAnadeLaColumnaYPrende(sinDefault, ADDONS)).toBe(false)
    expect(downQuitaSoloLaColumna(downDeMas)).toBe(false)
  })
})
