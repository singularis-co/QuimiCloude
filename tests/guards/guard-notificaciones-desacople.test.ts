// Guardia: ningun modulo de `lib/modules/*`, salvo `notificaciones`, importa `notificaciones`.
// Los avisos se emiten desde la composicion (`lib/composition`), que es la unica que conoce los dos
// lados; si un modulo de negocio importara `notificaciones`, quedaria acoplado a el.
//
// Patron de `tests/guards/`: detector PURO exportado, demostrado con fuentes SINTETICOS que violan
// la regla y sus simetricos correctos, y con un fuente REAL mutado para demostrar que la guardia
// muere y no solo que pasa en verde.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, posix, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/** Sube desde este archivo hasta la raiz del repo (la carpeta con `package.json`). */
function findRepoRoot(startDir: string): string {
  let dir = startDir
  for (;;) {
    if (existsSync(join(dir, 'package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no se encontro package.json subiendo desde ${startDir}`)
    dir = parent
  }
}

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)))
const MODULES_DIR = join(repoRoot, 'lib', 'modules')
const MODULO_VIGILADO = 'notificaciones'
const RUTA_VIGILADA = `lib/modules/${MODULO_VIGILADO}`

export type SourceFile = { readonly relPath: string; readonly content: string }

/** Quita comentarios de linea y de bloque: la prosa puede nombrar el modulo sin importarlo. */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/(^|[^:'"`])\/\/[^\n]*$/, '$1'))
    .join('\n')
}

/** Especificadores de `import ... from`, `export ... from`, `import '...'`, `import()` y `require()`. */
export function importSpecifiers(source: string): readonly string[] {
  const code = stripComments(source)
  const patrones = [
    /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  const salida: string[] = []
  for (const patron of patrones) {
    for (const match of code.matchAll(patron)) {
      if (match[1] !== undefined) salida.push(match[1])
    }
  }
  return salida
}

/** Ruta del repo (con `/`) a la que apunta un especificador, o `null` si es un paquete externo. */
export function resolveSpecifier(fromRelPath: string, specifier: string): string | null {
  if (specifier.startsWith('@/')) return posix.normalize(specifier.slice(2))
  if (specifier.startsWith('.')) {
    return posix.normalize(posix.join(posix.dirname(fromRelPath), specifier))
  }
  return null
}

function moduleOf(relPath: string): string | null {
  const match = /^lib\/modules\/([^/]+)\//.exec(relPath)
  return match?.[1] ?? null
}

function pointsToWatched(target: string): boolean {
  return target === RUTA_VIGILADA || target.startsWith(`${RUTA_VIGILADA}/`)
}

/** Un hallazgo por cada import de `notificaciones` desde otro modulo de `lib/modules`. */
export function findCouplingFindings(files: readonly SourceFile[]): readonly string[] {
  const findings: string[] = []
  for (const file of files) {
    const modulo = moduleOf(file.relPath)
    if (modulo === null || modulo === MODULO_VIGILADO) continue
    for (const specifier of importSpecifiers(file.content)) {
      const target = resolveSpecifier(file.relPath, specifier)
      if (target !== null && pointsToWatched(target)) {
        findings.push(`${file.relPath}: importa '${specifier}' (el modulo ${modulo} no puede depender de ${MODULO_VIGILADO})`)
      }
    }
  }
  return findings
}

function sourcesIn(absDir: string): readonly string[] {
  if (!existsSync(absDir)) return []
  const salida: string[] = []
  for (const name of readdirSync(absDir)) {
    const full = join(absDir, name)
    if (statSync(full).isDirectory()) salida.push(...sourcesIn(full))
    else if (/\.(?:ts|tsx|mts|cts|js|mjs)$/.test(name)) salida.push(full)
  }
  return salida.sort()
}

const fuentesReales: readonly SourceFile[] = sourcesIn(MODULES_DIR).map((file) => ({
  relPath: relative(repoRoot, file).split(sep).join('/'),
  content: readFileSync(file, 'utf8'),
}))

describe('ningun modulo de lib/modules importa notificaciones', () => {
  it('R5: el repo real tiene fuentes en varios modulos y ninguno fuera de notificaciones lo importa', () => {
    const modulos = new Set(fuentesReales.map((file) => moduleOf(file.relPath)))
    expect(modulos.has(MODULO_VIGILADO)).toBe(true)
    expect(modulos.size).toBeGreaterThan(1)
    expect(findCouplingFindings(fuentesReales)).toEqual([])
  })

  it('R5: MUERE con un fuente sintetico que importa el barrel por alias', () => {
    const sintetico: SourceFile = {
      relPath: 'lib/modules/documentos/application/x.ts',
      content: "import { notify } from '@/lib/modules/notificaciones';\nexport const y = notify;\n",
    }
    expect(findCouplingFindings([sintetico])).toEqual([
      "lib/modules/documentos/application/x.ts: importa '@/lib/modules/notificaciones' (el modulo documentos no puede depender de notificaciones)",
    ])
  })

  it('R5: MUERE con subrutas, rutas relativas, import de tipos, reexport, import() y require()', () => {
    const casos: readonly SourceFile[] = [
      { relPath: 'lib/modules/pedidos/a.ts', content: "import type { Notice } from '@/lib/modules/notificaciones/domain/notice';" },
      { relPath: 'lib/modules/pedidos/domain/b.ts', content: "import { x } from '../../notificaciones';" },
      { relPath: 'lib/modules/recetas/c.ts', content: "export { x } from '@/lib/modules/notificaciones';" },
      { relPath: 'lib/modules/recetas/d.ts', content: "const m = await import('@/lib/modules/notificaciones');" },
      { relPath: 'lib/modules/clientes/e.ts', content: "const m = require('@/lib/modules/notificaciones');" },
      {
        relPath: 'lib/modules/clientes/f.ts',
        content: "import {\n  a,\n  b,\n} from '@/lib/modules/notificaciones';",
      },
    ]
    for (const caso of casos) {
      expect(findCouplingFindings([caso]), caso.relPath).toHaveLength(1)
    }
  })

  it('R5: MUERE si se muta un fuente REAL de otro modulo para importar notificaciones', () => {
    const real = fuentesReales.find((file) => {
      const modulo = moduleOf(file.relPath)
      return modulo !== null && modulo !== MODULO_VIGILADO
    })
    expect(real, 'no hay fuentes de otros modulos').toBeDefined()
    const mutado: SourceFile = {
      relPath: (real as SourceFile).relPath,
      content: `import { NOTIFICATION_CATALOG } from '@/lib/modules/notificaciones';\n${(real as SourceFile).content}`,
    }
    expect(findCouplingFindings([mutado])).toHaveLength(1)
  })

  it('R5: no confunde prosa, otros modulos ni el propio notificaciones con la infraccion', () => {
    const correctos: readonly SourceFile[] = [
      {
        relPath: 'lib/modules/documentos/a.ts',
        content: "// import { notify } from '@/lib/modules/notificaciones'\n/* from '@/lib/modules/notificaciones' */\nexport const a = 1;",
      },
      { relPath: 'lib/modules/documentos/b.ts', content: "import { x } from '@/lib/modules/notificaciones-extra';" },
      { relPath: 'lib/modules/documentos/c.ts', content: "import { x } from '@/lib/modules/errores';" },
      { relPath: 'lib/modules/notificaciones/d.ts', content: "import { x } from '@/lib/modules/notificaciones/domain/notice';" },
      { relPath: 'lib/composition/e.ts', content: "import { x } from '@/lib/modules/notificaciones';" },
    ]
    expect(findCouplingFindings(correctos)).toEqual([])
  })
})
