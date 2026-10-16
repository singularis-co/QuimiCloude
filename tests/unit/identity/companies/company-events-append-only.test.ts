// El historial de empresas solo crece: ningun fuente de `lib/` modifica ni borra un evento, ni por el
// cliente de Prisma ni por SQL crudo. Barrido de texto sobre el disco, como las guardias.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

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

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)))

function sourcesUnder(dir: string): string[] {
  const files: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) files.push(...sourcesUnder(path))
    else if (/\.(ts|tsx|mts|cts|js|mjs)$/.test(name)) files.push(path)
  }
  return files
}

/** Quita comentarios: la prosa que explica la regla no es una escritura. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

const PRISMA_MUTATION = /\bcompanyEvent\s*\.\s*(update\w*|delete\w*|upsert)\s*\(/
const RAW_MUTATION = /\b(UPDATE|DELETE\s+FROM|TRUNCATE(\s+TABLE)?)\s+"?company_events"?/i

function mutatesCompanyEvents(source: string): boolean {
  const code = withoutComments(source)
  return PRISMA_MUTATION.test(code) || RAW_MUTATION.test(code)
}

function offenders(entries: ReadonlyArray<{ name: string; source: string }>): string[] {
  return entries.filter((entry) => mutatesCompanyEvents(entry.source)).map((entry) => entry.name)
}

const libEntries = sourcesUnder(join(repoRoot, 'lib')).map((path) => ({
  name: relative(repoRoot, path).split(sep).join('/'),
  source: readFileSync(path, 'utf8'),
}))

describe('historial de empresas: solo se anade', () => {
  it('R38: ningun fuente de lib/ modifica ni borra un evento de company_events', () => {
    expect(libEntries.length).toBeGreaterThan(0)
    expect(offenders(libEntries)).toEqual([])
  })

  it('R38: el barrido lee de verdad los fuentes: el adaptador que escribe eventos esta entre ellos', () => {
    const adapter = libEntries.find(
      (entry) => entry.name === 'lib/modules/identity/adapters/driven/persistence/company-prisma.ts',
    )
    expect(adapter?.source).toMatch(/companyEvent\s*\.\s*create\s*\(/)
  })

  it('R38: el criterio cae ante una modificacion real y no ante un comentario ni un alta', () => {
    const sinteticos = [
      { name: 'update', source: 'await tx.companyEvent.update({ where: { id }, data })' },
      { name: 'updateMany', source: 'await db.companyEvent . updateMany({})' },
      { name: 'delete', source: 'await prisma.companyEvent.delete({ where: { id } })' },
      { name: 'deleteMany', source: 'await tx.companyEvent.deleteMany({})' },
      { name: 'upsert', source: 'await tx.companyEvent.upsert({})' },
      { name: 'raw-update', source: 'await tx.$executeRaw`UPDATE company_events SET kind = ${k}`' },
      { name: 'raw-delete', source: "await tx.$executeRawUnsafe('DELETE FROM \"company_events\"')" },
      { name: 'raw-truncate', source: "await tx.$executeRawUnsafe('truncate table company_events')" },
    ]
    const inocentes = [
      { name: 'create', source: 'await tx.companyEvent.create({ data })' },
      { name: 'comentario', source: '// nunca se llama a companyEvent.update(...)\nconst x = 1' },
      { name: 'bloque', source: '/* DELETE FROM company_events */ const y = 2' },
      { name: 'otra-tabla', source: 'await tx.$executeRaw`UPDATE companies SET name = ${n}`' },
    ]

    expect(offenders([...libEntries, ...sinteticos, ...inocentes])).toEqual(sinteticos.map((s) => s.name))
  })
})
