// Contrato estatico del SQL de la migracion de las marcas del catalogo y los pares de plataforma.
//
// Los valores esperados son las tablas aprobadas del spec, escritas aqui a mano: el SQL tambien
// las escribe con literales, y este test es el que las ata. Cada predicado se aplica al SQL real y
// a una copia MUTADA EN MEMORIA: un test que no puede fallar no vigila nada.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

function findRepoRoot(startDir: string): string {
  let dir = startDir
  for (;;) {
    if (existsSync(join(dir, 'package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no se encontro package.json subiendo desde ${startDir}`)
    dir = parent
  }
}

const migrationsDir = join(findRepoRoot(dirname(fileURLToPath(import.meta.url))), 'db', 'migrations')
const carpetas = readdirSync(migrationsDir).filter((name) => /_ai_agent_model_pairs$/.test(name))
expect(carpetas, 'debe existir exactamente una migracion de los pares de modelos').toHaveLength(1)
const migrationDir = join(migrationsDir, carpetas[0] as string)
const catalogDir = join(
  migrationsDir,
  readdirSync(migrationsDir).find((name) => /_ai_models$/.test(name)) ?? '__falta__',
)

const read = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
const upSource = read(join(migrationDir, 'migration.sql'))
const downSource = read(join(migrationDir, 'down.sql'))
const catalogUpSource = read(join(catalogDir, 'migration.sql'))

function stripSqlComments(sql: string): string {
  return sql
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

type Mark = readonly [provider: string, modelId: string, supportsTools: boolean, isEconomic: boolean]
type Pair = readonly [provider: string, role: string, primary: string, fallback: string]

const MARKS: readonly Mark[] = [
  ['ANTHROPIC', 'claude-opus-5-5', true, false],
  ['ANTHROPIC', 'claude-sonnet-5-5', true, false],
  ['ANTHROPIC', 'claude-opus-5', true, false],
  ['ANTHROPIC', 'claude-sonnet-5', true, false],
  ['ANTHROPIC', 'claude-haiku-5-5', true, true],
  ['GOOGLE', 'gemini-4-argon', true, false],
  ['GOOGLE', 'gemini-3.8-flash', true, true],
  ['GOOGLE', 'gemini-3.7-flash', true, true],
  ['GOOGLE', 'gemini-3.5-flash-lite', true, true],
  ['GOOGLE', 'gemini-3.1-flash-lite', true, false],
  ['OPENAI', 'gpt-6.1-sol', true, false],
  ['OPENAI', 'gpt-6-sol', true, false],
  ['OPENAI', 'gpt-6-luna-pro', true, false],
  ['OPENAI', 'gpt-6-luna', true, true],
  ['OPENAI', 'gpt-5.6-luna', true, true],
  ['OPENROUTER', 'anthropic/claude-sonnet-5.5', true, false],
  ['OPENROUTER', 'openai/gpt-6.1-sol', true, false],
  ['OPENROUTER', 'google/gemini-3.8-flash', true, true],
  ['OPENROUTER', 'anthropic/claude-haiku-5.5', true, true],
  ['OPENROUTER', 'openai/gpt-6-luna', true, true],
]

const PAIRS: readonly Pair[] = [
  ['ANTHROPIC', 'AGENT', 'claude-sonnet-5-5', 'claude-sonnet-5'],
  ['ANTHROPIC', 'ROUTER', 'claude-haiku-5-5', 'claude-sonnet-5-5'],
  ['OPENAI', 'AGENT', 'gpt-6.1-sol', 'gpt-6-sol'],
  ['OPENAI', 'ROUTER', 'gpt-6-luna', 'gpt-5.6-luna'],
  ['GOOGLE', 'AGENT', 'gemini-4-argon', 'gemini-3.8-flash'],
  ['GOOGLE', 'ROUTER', 'gemini-3.8-flash', 'gemini-3.5-flash-lite'],
  ['OPENROUTER', 'AGENT', 'anthropic/claude-sonnet-5.5', 'openai/gpt-6.1-sol'],
  ['OPENROUTER', 'ROUTER', 'anthropic/claude-haiku-5.5', 'google/gemini-3.8-flash'],
]

// --- Predicados puros ----------------------------------------------------------------------

/** Las marcas que escribe el `UPDATE ... FROM (VALUES ...)` sobre `ai_models`, en orden. */
export function marksInUp(sql: string): readonly Mark[] {
  const update = statements(sql).find((statement) => /^UPDATE "ai_models"/i.test(statement))
  if (update === undefined) return []
  return [...update.matchAll(/\('([A-Z]+)', '([^']+)', (true|false), (true|false)\)/g)].map(
    (m) => [m[1] as string, m[2] as string, m[3] === 'true', m[4] === 'true'] as const,
  )
}

/** El `UPDATE` cruza por proveedor Y por modelo: un id solo es unico dentro de su proveedor. */
export function updateMatchesByProviderAndModel(sql: string): boolean {
  const update = statements(sql).find((statement) => /^UPDATE "ai_models"/i.test(statement))
  if (update === undefined) return false
  const where = /WHERE (.*)$/i.exec(update)?.[1] ?? ''
  return /"m"\."provider" = "v"\."provider"/.test(where) && /"m"\."model_id" = "v"\."model_id"/.test(where)
}

/** Los pares que siembra el `INSERT` de `ai_agent_model_pairs`, en orden. */
export function pairsInUp(sql: string): readonly Pair[] {
  const insert = statements(sql).find((statement) => /^INSERT INTO "ai_agent_model_pairs"/i.test(statement))
  if (insert === undefined) return []
  if (/updated_by/i.test(insert)) return []
  return [...insert.matchAll(/\('([A-Z]+)', '([A-Z]+)', '([^']+)', '([^']+)'\)/g)].map(
    (m) => [m[1] as string, m[2] as string, m[3] as string, m[4] as string] as const,
  )
}

/** Los modelos que sembro la migracion del catalogo, como `PROVEEDOR|id`. */
function catalogIds(sql: string): readonly string[] {
  const insert = statements(sql).find((statement) => /^INSERT INTO "ai_models"/i.test(statement))
  if (insert === undefined) return []
  return [...insert.matchAll(/\('([A-Z]+)', '([^']+)', (?:true|false), \d+\)/g)].map((m) => `${m[1]}|${m[2]}`)
}

export function rlsEnabledAndForcedWithoutPolicies(sql: string): boolean {
  const todas = statements(sql)
  return (
    todas.includes('ALTER TABLE "ai_agent_model_pairs" ENABLE ROW LEVEL SECURITY') &&
    todas.includes('ALTER TABLE "ai_agent_model_pairs" FORCE ROW LEVEL SECURITY') &&
    !todas.some((statement) => /\bPOLICY\b/i.test(statement))
  )
}

const DOWN_ESPERADO = [
  'DROP TABLE "ai_agent_model_pairs"',
  'DROP TYPE "ai_model_role"',
  'ALTER TABLE "ai_models" DROP COLUMN "is_economic", DROP COLUMN "supports_tools"',
]

export function downIsTheExactInverse(sql: string): boolean {
  const todas = statements(sql)
  return todas.length === DOWN_ESPERADO.length && todas.every((statement, i) => statement === DOWN_ESPERADO[i])
}

export function downHasNoCascade(sql: string): boolean {
  return !/CASCADE/i.test(stripSqlComments(sql))
}

// --- Las marcas del catalogo ------------------------------------------------------------------

describe('migration.sql — marcas del catalogo', () => {
  it('R2: el UPDATE escribe exactamente las veinte marcas aprobadas, y cae si cambia una', () => {
    expect(marksInUp(upSource)).toEqual(MARKS)

    const otraMarca = upSource.replace(`('GOOGLE', 'gemini-3.1-flash-lite', true, false)`, `('GOOGLE', 'gemini-3.1-flash-lite', true, true)`)
    expect(otraMarca).not.toBe(upSource)
    expect(marksInUp(otraMarca)).not.toEqual(MARKS)

    const sinUna = upSource.replace(/\n\s*\('OPENAI', 'gpt-6-luna-pro', true, false\),/, '')
    expect(sinUna).not.toBe(upSource)
    expect(marksInUp(sinUna)).not.toEqual(MARKS)
  })

  it('R2: las marcas cubren los veinte modelos del catalogo sembrado, ni uno mas ni uno menos', () => {
    const ids = catalogIds(catalogUpSource)
    expect(ids).toHaveLength(20)
    expect([...MARKS.map(([provider, id]) => `${provider}|${id}`)].sort()).toEqual([...ids].sort())
  })

  it('R2: el UPDATE cruza por proveedor y por modelo, y cae si se cruza solo por modelo', () => {
    expect(updateMatchesByProviderAndModel(upSource)).toBe(true)

    const soloPorModelo = upSource.replace(`"m"."provider" = "v"."provider"::"ai_provider_code" AND `, '')
    expect(soloPorModelo).not.toBe(upSource)
    expect(updateMatchesByProviderAndModel(soloPorModelo)).toBe(false)
  })

  it('R1: las dos columnas nacen NOT NULL con false por defecto', () => {
    const alter = statements(upSource).find((statement) => /^ALTER TABLE "ai_models" ADD COLUMN/i.test(statement))
    expect(alter).toBe(
      'ALTER TABLE "ai_models" ADD COLUMN "supports_tools" BOOLEAN NOT NULL DEFAULT false, ' +
        'ADD COLUMN "is_economic" BOOLEAN NOT NULL DEFAULT false',
    )
  })
})

// --- Los pares --------------------------------------------------------------------------------

describe('migration.sql — pares de plataforma', () => {
  it('R8: el INSERT siembra exactamente los ocho pares aprobados, sin autor', () => {
    expect(pairsInUp(upSource)).toEqual(PAIRS)

    const conAutor = upSource.replace(
      `("provider", "role", "primary_model_id", "fallback_model_id")`,
      `("provider", "role", "primary_model_id", "fallback_model_id", "updated_by")`,
    )
    expect(conAutor).not.toBe(upSource)
    expect(pairsInUp(conAutor)).toEqual([])

    const otroRespaldo = upSource.replace(
      `('ANTHROPIC', 'ROUTER', 'claude-haiku-5-5', 'claude-sonnet-5-5')`,
      `('ANTHROPIC', 'ROUTER', 'claude-haiku-5-5', 'claude-sonnet-5')`,
    )
    expect(otroRespaldo).not.toBe(upSource)
    expect(pairsInUp(otroRespaldo)).not.toEqual(PAIRS)
  })

  it('R8: el respaldo del enrutador de ANTHROPIC no es economico a proposito; los principales del enrutador si; todos con herramientas', () => {
    const marca = (provider: string, id: string) => MARKS.find(([p, m]) => p === provider && m === id)
    expect(PAIRS.find(([p, r]) => p === 'ANTHROPIC' && r === 'ROUTER')?.[3]).toBe('claude-sonnet-5-5')
    expect(marca('ANTHROPIC', 'claude-sonnet-5-5')?.[3]).toBe(false)
    for (const [provider, role, primary, fallback] of PAIRS) {
      expect(primary, provider).not.toBe(fallback)
      expect(marca(provider, primary)?.[2], primary).toBe(true)
      expect(marca(provider, fallback)?.[2], fallback).toBe(true)
      if (role === 'ROUTER') expect(marca(provider, primary)?.[3], primary).toBe(true)
    }
  })

  it('R5: la tabla lleva RLS activada y forzada, sin policies, y cae si falta el FORCE o se cuela una policy', () => {
    expect(rlsEnabledAndForcedWithoutPolicies(upSource)).toBe(true)

    const sinForce = upSource.replace('ALTER TABLE "ai_agent_model_pairs" FORCE ROW LEVEL SECURITY;', '')
    expect(sinForce).not.toBe(upSource)
    expect(rlsEnabledAndForcedWithoutPolicies(sinForce)).toBe(false)

    expect(
      rlsEnabledAndForcedWithoutPolicies(`${upSource}\nCREATE POLICY "p" ON "ai_agent_model_pairs" USING (true);`),
    ).toBe(false)
  })
})

// --- El DOWN ----------------------------------------------------------------------------------

describe('down.sql — inverso exacto', () => {
  it('R3: borra la tabla, el tipo y las dos columnas en ese orden, y cae si se reordena', () => {
    expect(downIsTheExactInverse(downSource)).toBe(true)

    const invertido = statements(downSource).slice().reverse().map((statement) => `${statement};`).join('\n')
    expect(downIsTheExactInverse(invertido)).toBe(false)

    const sinUnaColumna = downSource.replace(', DROP COLUMN "supports_tools"', '')
    expect(sinUnaColumna).not.toBe(downSource)
    expect(downIsTheExactInverse(sinUnaColumna)).toBe(false)
  })

  it('R3: no lleva CASCADE', () => {
    expect(downHasNoCascade(downSource)).toBe(true)
    expect(downHasNoCascade(downSource.replace('DROP TABLE "ai_agent_model_pairs";', 'DROP TABLE "ai_agent_model_pairs" CASCADE;'))).toBe(false)
  })
})
