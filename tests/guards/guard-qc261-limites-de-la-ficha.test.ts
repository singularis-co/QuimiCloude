// QC-261 T7 — Guardia: los limites de ESTA ficha (R22, R7, R18, R23; `design.md > 7`).
//
//   R22 — la ficha es solo presentacion: su diff no toca `lib/`, `db/`, `middleware.ts` ni
//         `package.json` (ninguna dependencia nueva).
//   R7  — ninguna celda de la lista enlaza «Ver recorrido»: `execution-trace-columns.tsx` no
//         importa `next/link` (el enlace vive en el menu de fila, no en la celda).
//   R18 — el 404 del dashboard y de su detalle sigue saliendo con codigo 404: no hay ningun
//         `loading.tsx` bajo `app/(private)/dashboard/`, que haria empezar el streaming antes de
//         `requirePagePermission` y de `notFound()` (`design.md > 8`, riesgo 1).
//   R23 — la pieza nueva del detalle, `execution-timeline.tsx`, vive en la carpeta `components/`
//         de su ruta y el `index.ts` de esa carpeta la reexporta (`ExecutionTimeline`).
//
// R22 es un censo del DIFF DE RAMA y se acota a su rama, como `guard-qc260-limites-de-la-ficha`:
// fuera de `feature/QC-261-rediseno-dashboard` hace `ctx.skip` RUIDOSO diciendo que no ha
// comprobado nada, en vez de ponerse rojo sobre el trabajo legitimo de la ficha siguiente. El rango
// es el merge-base de la rama con `origin/dev` (o `dev`), no la punta de `dev`.
//
// R7, R18 y R23 son censos del ARBOL, no del diff, y corren en toda rama: si una ficha futura vuelve a
// poner el enlace en la celda o un esqueleto de ruta, debe ponerse roja.
//
// El detector de R7 lee el AST de TypeScript, no el texto: un comentario que diga `next/link` no es
// un hallazgo; un `import`, un `export ... from`, un `import()` o un `require()` si.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as ts from 'typescript'
import { describe, expect, it } from 'vitest'

/** Sube desde este archivo hasta la raiz del repo (la carpeta con `package.json`). */
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

/** La rama de ESTA ficha. Fuera de ella, el caso de diff se salta: no tiene nada que decir. */
const RAMA_DE_LA_FICHA = 'feature/QC-261-rediseno-dashboard'

/** Candidatos de rama base, en orden. El worktree puede no tener remoto configurado. */
const BASES = ['origin/dev', 'dev'] as const

/** Lo que R22 prohibe tocar. Los archivos se comparan exactos (solo los de la raiz). */
const PREFIJOS_PROHIBIDOS = ['lib/', 'db/'] as const
const ARCHIVOS_PROHIBIDOS = ['middleware.ts', 'package.json'] as const

/** R7: el archivo de columnas de la lista. */
const ARCHIVO_DE_COLUMNAS = 'app/(private)/dashboard/components/execution-trace-columns.tsx'

/** R18: la carpeta donde no puede haber `loading.*`. */
const CARPETA_DEL_DASHBOARD = 'app/(private)/dashboard'
const LOADING = /^loading\.(tsx|ts|jsx|js)$/

/** R23: la carpeta de componentes del detalle, su barrel y la pieza nueva que debe reexportar. */
const CARPETA_DEL_RECORRIDO = 'app/(private)/dashboard/recorrido/[id]/components'
const PIEZA_NUEVA = 'execution-timeline'
const NOMBRE_EXPORTADO = 'ExecutionTimeline'

function git(args: readonly string[]): string | null {
  try {
    return execFileSync('git', [...args], { cwd: repoRoot, encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

export function ramaActual(): string | null {
  const rama = git(['rev-parse', '--abbrev-ref', 'HEAD'])
  return rama === null || rama.length === 0 ? null : rama
}

/** El merge-base de MI rama con la base, o `null` si no hay ninguna base disponible. */
export function mergeBaseDeLaRama(): string | null {
  for (const base of BASES) {
    const sha = git(['merge-base', base, 'HEAD'])
    if (sha !== null && sha.length > 0) return sha
  }
  return null
}

/** Archivos tocados por los commits de esta rama Y por el arbol de trabajo, desde el merge-base. */
export function archivosDeLaFicha(mergeBase: string): readonly string[] {
  const salida = git(['diff', '--name-only', mergeBase])
  if (salida === null) return []
  return salida
    .split('\n')
    .map((linea) => linea.trim())
    .filter((linea) => linea.length > 0)
    .sort()
}

/** R22: los de `archivos` que caen en `lib/`, `db/` o son `middleware.ts` o `package.json`. Pura. */
export function fueraDeLimites(archivos: readonly string[]): readonly string[] {
  return archivos.filter(
    (archivo) =>
      PREFIJOS_PROHIBIDOS.some((prefijo) => archivo.startsWith(prefijo)) ||
      (ARCHIVOS_PROHIBIDOS as readonly string[]).includes(archivo),
  )
}

/**
 * La precondicion, en un solo sitio: o devuelve el merge-base, o devuelve el MOTIVO por el que el
 * caso de diff no puede comprobar nada. Nunca las dos cosas, y nunca falla en silencio.
 */
export function preparar(
  rama: string | null,
  mergeBase: string | null,
): { mergeBase: string } | { motivo: string } {
  if (rama === null) {
    return { motivo: 'no se pudo leer la rama actual con git: este caso NO ha comprobado nada.' }
  }
  if (rama !== RAMA_DE_LA_FICHA) {
    return {
      motivo:
        `la rama actual es '${rama}' y no '${RAMA_DE_LA_FICHA}': R22 habla de lo que hace ESTA ` +
        'ficha, no de lo que haya hecho quien pase despues. Este caso NO ha comprobado nada.',
    }
  }
  if (mergeBase === null) {
    return {
      motivo:
        `no se pudo calcular el merge-base con ${BASES.join(' ni con ')}: este caso NO ha ` +
        'comprobado nada.',
    }
  }
  return { mergeBase }
}

// ---------------------------------------------------------------------------------------------
// R7 — detector sobre el AST
// ---------------------------------------------------------------------------------------------

function esNextLink(nodo: ts.Node | undefined): boolean {
  return (
    nodo !== undefined &&
    (ts.isStringLiteral(nodo) || ts.isNoSubstitutionTemplateLiteral(nodo)) &&
    nodo.text === 'next/link'
  )
}

/** R7: ¿el fuente importa `next/link` por cualquier via? Pura (no lee disco). */
export function importaNextLink(nombre: string, fuente: string): boolean {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let encontrado = false
  const visitar = (nodo: ts.Node): void => {
    if (encontrado) return
    if (
      (ts.isImportDeclaration(nodo) || ts.isExportDeclaration(nodo)) &&
      esNextLink(nodo.moduleSpecifier)
    ) {
      encontrado = true
      return
    }
    if (ts.isCallExpression(nodo)) {
      const esImportDinamico = nodo.expression.kind === ts.SyntaxKind.ImportKeyword
      const esRequire = ts.isIdentifier(nodo.expression) && nodo.expression.text === 'require'
      if ((esImportDinamico || esRequire) && esNextLink(nodo.arguments[0])) {
        encontrado = true
        return
      }
    }
    ts.forEachChild(nodo, visitar)
  }
  visitar(sf)
  return encontrado
}

// ---------------------------------------------------------------------------------------------
// R18 — censo de `loading.*`
// ---------------------------------------------------------------------------------------------

/** Rutas (relativas a la raiz, con `/`) de todos los archivos bajo `dir`. */
function listarArchivos(dir: string): string[] {
  const salida: string[] = []
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada)
    if (statSync(ruta).isDirectory()) {
      salida.push(...listarArchivos(ruta))
    } else {
      salida.push(relative(repoRoot, ruta).split('\\').join('/'))
    }
  }
  return salida.sort()
}

/** R18: los de `archivos` cuyo nombre es `loading.{tsx,ts,jsx,js}`. Pura. */
export function archivosDeCarga(archivos: readonly string[]): readonly string[] {
  return archivos.filter((archivo) => LOADING.test(archivo.split('/').pop() ?? ''))
}

// ---------------------------------------------------------------------------------------------
// R23 — el barrel reexporta la pieza
// ---------------------------------------------------------------------------------------------

/**
 * R23: ¿el barrel reexporta `nombre` desde `./<modulo>`? Lee el AST: vale `export { X } from`,
 * `export { X as X } from` y `export * from`; un comentario o un import sin reexportar no. Pura.
 */
export function barrelReexporta(fuente: string, modulo: string, nombre: string): boolean {
  const sf = ts.createSourceFile('index.ts', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  return sf.statements.some((sentencia) => {
    if (!ts.isExportDeclaration(sentencia) || sentencia.isTypeOnly) return false
    const origen = sentencia.moduleSpecifier
    if (origen === undefined || !ts.isStringLiteral(origen) || origen.text !== `./${modulo}`) return false
    const clausula = sentencia.exportClause
    if (clausula === undefined) return true
    if (!ts.isNamedExports(clausula)) return false
    return clausula.elements.some((el) => !el.isTypeOnly && el.name.text === nombre)
  })
}

const rama = ramaActual()
const base = mergeBaseDeLaRama()

describe('QC-261 — R22: la ficha no toca `lib/`, `db/`, `middleware.ts` ni `package.json`', () => {
  it('R22: el diff de esta rama contra el merge-base no trae nada bajo `lib/`, `db/`, ni `middleware.ts` ni `package.json`', (ctx) => {
    const listo = preparar(rama, base)
    if ('motivo' in listo) {
      ctx.skip(listo.motivo)
      return
    }

    const archivos = archivosDeLaFicha(listo.mergeBase)
    expect(
      archivos.length,
      `el rango ${listo.mergeBase}..arbol no trae ningun archivo: la ficha no se ha escrito todavia, ` +
        'o el rango esta mal calculado. Sin archivos, este caso pasaria en verde sin mirar nada.',
    ).toBeGreaterThan(0)

    const tocados = fueraDeLimites(archivos)
    expect(
      tocados,
      `QC-261 R22: esta ficha es solo presentacion (C5) y el diff toca:\n${tocados.join('\n')}\n` +
        'Si el diseño exige logica nueva o una dependencia, va a preguntas abiertas, no a esta rama.',
    ).toEqual([])
  })

  it('R22 (caso sintetico): un diff con `lib/`, `db/`, `middleware.ts` o `package.json` da rojo', () => {
    const diff = [
      'app/(private)/dashboard/page.tsx',
      'components/shared/empty-state.tsx',
      'lib/x.ts',
      'db/migrations/20261012000000_algo/migration.sql',
      'middleware.ts',
      'package.json',
      'libreria-que-no-es-lib.md',
      'app/middleware.ts',
      'tests/fixtures/package.json',
    ]
    expect(fueraDeLimites(diff)).toEqual([
      'lib/x.ts',
      'db/migrations/20261012000000_algo/migration.sql',
      'middleware.ts',
      'package.json',
    ])
    expect(fueraDeLimites(['app/(private)/dashboard/page.tsx'])).toEqual([])
  })

  it('R22: la precondicion se salta RUIDOSAMENTE fuera de esta rama, y nunca en ella', () => {
    const enDev = preparar('dev', 'abc123')
    expect((enDev as { motivo: string }).motivo).toContain('NO ha comprobado nada')
    expect((enDev as { motivo: string }).motivo).toContain("la rama actual es 'dev'")
    expect('motivo' in preparar('feature/QC-999-lo-que-venga', 'abc123')).toBe(true)
    expect((preparar(null, 'abc123') as { motivo: string }).motivo).toContain('NO ha comprobado nada')
    expect((preparar(RAMA_DE_LA_FICHA, null) as { motivo: string }).motivo).toContain('merge-base')
    expect(preparar(RAMA_DE_LA_FICHA, 'abc123')).toEqual({ mergeBase: 'abc123' })
  })
})

describe('QC-261 — R7: ninguna celda de la lista enlaza «Ver recorrido»', () => {
  it('R7: `execution-trace-columns.tsx` no importa `next/link`', () => {
    const ruta = join(repoRoot, ARCHIVO_DE_COLUMNAS)
    expect(existsSync(ruta), `no existe ${ARCHIVO_DE_COLUMNAS}: la guardia no miraria nada`).toBe(true)
    expect(
      importaNextLink(ARCHIVO_DE_COLUMNAS, readFileSync(ruta, 'utf8')),
      `QC-261 R7: ${ARCHIVO_DE_COLUMNAS} importa \`next/link\`. El enlace «Ver recorrido» va en el ` +
        'menu de acciones de la fila (C2), nunca en una celda.',
    ).toBe(false)
  })

  it('R7 (caso sintetico): `next/link` por import, re-export, `import()` o `require()` da rojo', () => {
    expect(importaNextLink('a.tsx', "import Link from 'next/link'")).toBe(true)
    expect(importaNextLink('b.tsx', "import { default as L } from 'next/link'")).toBe(true)
    expect(importaNextLink('c.ts', "export { default } from 'next/link'")).toBe(true)
    expect(importaNextLink('d.ts', "const L = await import('next/link')")).toBe(true)
    expect(importaNextLink('e.ts', "const L = require('next/link')")).toBe(true)
  })

  it('R7: sin falsos positivos por comentarios ni por otros modulos', () => {
    const limpio = [
      "// import Link from 'next/link' — solo un comentario",
      "import { useRouter } from 'next/navigation'",
      "export const texto = 'next/link'",
    ].join('\n')
    expect(importaNextLink('limpio.tsx', limpio)).toBe(false)
  })
})

describe('QC-261 — R18: sin `loading.tsx` bajo `app/(private)/dashboard/`', () => {
  it('R18: ningun archivo `loading.*` bajo `app/(private)/dashboard/`', () => {
    const carpeta = join(repoRoot, CARPETA_DEL_DASHBOARD)
    expect(existsSync(carpeta), `no existe ${CARPETA_DEL_DASHBOARD}: la guardia no miraria nada`).toBe(true)
    const archivos = listarArchivos(carpeta)
    expect(archivos, 'el censo no vio la pagina del dashboard').toContain(
      `${CARPETA_DEL_DASHBOARD}/page.tsx`,
    )
    expect(archivos).toContain(`${CARPETA_DEL_DASHBOARD}/recorrido/[id]/page.tsx`)

    const hallados = archivosDeCarga(archivos)
    expect(
      hallados,
      `QC-261 R18: estos esqueletos de ruta harian empezar la respuesta antes de ` +
        `\`requirePagePermission\` y de \`notFound()\`, y el 404 saldria con 200:\n${hallados.join('\n')}`,
    ).toEqual([])
  })

  it('R18 (caso sintetico): un `loading.tsx` en la ruta o en el detalle da rojo', () => {
    expect(
      archivosDeCarga([
        'app/(private)/dashboard/page.tsx',
        'app/(private)/dashboard/loading.tsx',
        'app/(private)/dashboard/recorrido/[id]/loading.js',
        'app/(private)/dashboard/components/loading-state.tsx',
        'app/(private)/dashboard/components/execution-trace-table.tsx',
      ]),
    ).toEqual([
      'app/(private)/dashboard/loading.tsx',
      'app/(private)/dashboard/recorrido/[id]/loading.js',
    ])
  })
})

describe('QC-261 — R23: la pieza nueva del detalle vive en su ruta y la exporta su barrel', () => {
  it('R23: `execution-timeline.tsx` vive en `recorrido/[id]/components/` y su `index.ts` reexporta `ExecutionTimeline`', () => {
    const pieza = join(repoRoot, CARPETA_DEL_RECORRIDO, `${PIEZA_NUEVA}.tsx`)
    const barrel = join(repoRoot, CARPETA_DEL_RECORRIDO, 'index.ts')
    expect(existsSync(pieza), `no existe ${CARPETA_DEL_RECORRIDO}/${PIEZA_NUEVA}.tsx`).toBe(true)
    expect(existsSync(barrel), `no existe ${CARPETA_DEL_RECORRIDO}/index.ts`).toBe(true)
    expect(
      barrelReexporta(readFileSync(barrel, 'utf8'), PIEZA_NUEVA, NOMBRE_EXPORTADO),
      `QC-261 R23: ${CARPETA_DEL_RECORRIDO}/index.ts no reexporta \`${NOMBRE_EXPORTADO}\` desde ` +
        `\`./${PIEZA_NUEVA}\`. Toda pieza nueva sale por el barrel de su carpeta.`,
    ).toBe(true)
  })

  it('R23 (caso sintetico): un barrel sin la reexportacion da rojo', () => {
    expect(barrelReexporta("export { ExecutionTraceDetail } from './execution-trace-detail'", PIEZA_NUEVA, NOMBRE_EXPORTADO)).toBe(false)
    expect(barrelReexporta("// export { ExecutionTimeline } from './execution-timeline'", PIEZA_NUEVA, NOMBRE_EXPORTADO)).toBe(false)
    expect(barrelReexporta("import { ExecutionTimeline } from './execution-timeline'", PIEZA_NUEVA, NOMBRE_EXPORTADO)).toBe(false)
    expect(barrelReexporta("export type { ExecutionTimelineProps } from './execution-timeline'", PIEZA_NUEVA, NOMBRE_EXPORTADO)).toBe(false)
    expect(barrelReexporta("export { ExecutionTimeline } from './otra-pieza'", PIEZA_NUEVA, NOMBRE_EXPORTADO)).toBe(false)
  })

  it('R23: el detector acepta las formas validas de reexportar', () => {
    expect(barrelReexporta("export { ExecutionTimeline, type ExecutionTimelineProps } from './execution-timeline'", PIEZA_NUEVA, NOMBRE_EXPORTADO)).toBe(true)
    expect(barrelReexporta("export * from './execution-timeline'", PIEZA_NUEVA, NOMBRE_EXPORTADO)).toBe(true)
  })
})
