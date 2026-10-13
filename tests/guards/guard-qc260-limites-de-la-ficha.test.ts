// QC-260 T9 — Guardia: los limites de ESTA ficha (R27, R29).
//
//   R27 — la ficha es solo presentacion: su diff no toca `lib/`, `db/` ni `middleware.ts`.
//   R29 — el unico campo de contraseña con ojo es `PasswordField`: ningun archivo de `app/` pinta
//         un `<input>` de tipo `password` ni un boton propio de mostrar u ocultar.
//
// R27 es un censo del DIFF DE RAMA, y se acota a su rama por la misma leccion que
// `guard-qc102-limites-de-la-ficha` y `guard-piezas-base`: fuera de
// `feature/QC-260-rediseno-acceso` hace `ctx.skip` RUIDOSO diciendo que no ha comprobado nada, en
// vez de ponerse rojo sobre el trabajo legitimo de la ficha siguiente. El rango es el merge-base de
// la rama con `origin/dev` (o `dev`), no la punta de `dev`.
//
// R29 es un censo del ARBOL, no del diff, y corre en toda rama: si una ficha futura vuelve a pintar
// su propio campo de contraseña, debe ponerse roja.
//
// El detector de R29 lee el AST de TypeScript, no el texto: un comentario que diga
// `type="password"` o `aria-pressed` no es un hallazgo. `aria-pressed` por si solo tampoco lo es
// (`app/` lo usa con razon en filtros y barras de herramientas): lo es cuando el mismo archivo pinta
// un icono de ojo (`Eye`, `EyeOff`, `EyeClosed`...), que es la firma de un mostrar/ocultar propio.

import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
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
const RAMA_DE_LA_FICHA = 'feature/QC-260-rediseno-acceso'

/** Candidatos de rama base, en orden. El worktree puede no tener remoto configurado. */
const BASES = ['origin/dev', 'dev'] as const

/** Lo que R27 prohibe tocar. `middleware.ts` es un archivo, no una carpeta: se compara exacto. */
const PREFIJOS_PROHIBIDOS = ['lib/', 'db/'] as const
const ARCHIVOS_PROHIBIDOS = ['middleware.ts'] as const

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

/** R27: los de `archivos` que caen en `lib/`, `db/` o son `middleware.ts`. Pura. */
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
        `la rama actual es '${rama}' y no '${RAMA_DE_LA_FICHA}': R27 habla de lo que hace ESTA ` +
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
// R29 — detector sobre el AST
// ---------------------------------------------------------------------------------------------

export type HallazgoR29 = { archivo: string; motivo: 'type-password' | 'ojo-propio' }

/** ¿Hay un literal de texto `password` en `nodo` o debajo? Cubre `'password'` y ternarios. */
function contieneLiteralPassword(nodo: ts.Node): boolean {
  if (
    (ts.isStringLiteral(nodo) || ts.isNoSubstitutionTemplateLiteral(nodo)) &&
    nodo.text === 'password'
  ) {
    return true
  }
  return ts.forEachChild(nodo, (hijo) => (contieneLiteralPassword(hijo) ? true : undefined)) ?? false
}

function nombreDePropiedad(nombre: ts.PropertyName): string | null {
  if (ts.isIdentifier(nombre) || ts.isStringLiteral(nombre)) return nombre.text
  return null
}

const ICONO_DE_OJO = /^Eye(Off|Closed|Icon|OffIcon|ClosedIcon|Slash)?$/

/**
 * R29: analiza un fuente. Pura (no lee disco). Devuelve los motivos encontrados, sin repetir.
 *   - `type-password`: un atributo JSX `type` o una propiedad `type:` cuyo valor contiene el
 *     literal `'password'` (`type="password"`, `type={'password'}`, `type={v ? 'text' : 'password'}`,
 *     `{ type: 'password' }`).
 *   - `ojo-propio`: `aria-pressed` (atributo JSX o propiedad) en un archivo que pinta o importa un
 *     icono de ojo.
 */
export function analizarFuente(nombre: string, fuente: string): readonly HallazgoR29['motivo'][] {
  const sf = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let typePassword = false
  let ariaPressed = false
  let iconoDeOjo = false

  const visitar = (nodo: ts.Node): void => {
    if (ts.isJsxAttribute(nodo)) {
      const attr = nodo.name.getText(sf)
      if (attr === 'type' && nodo.initializer !== undefined && contieneLiteralPassword(nodo.initializer)) {
        typePassword = true
      }
      if (attr === 'aria-pressed') ariaPressed = true
    } else if (ts.isPropertyAssignment(nodo)) {
      const prop = nombreDePropiedad(nodo.name)
      if (prop === 'type' && contieneLiteralPassword(nodo.initializer)) typePassword = true
      if (prop === 'aria-pressed') ariaPressed = true
    } else if (ts.isJsxOpeningElement(nodo) || ts.isJsxSelfClosingElement(nodo)) {
      if (ICONO_DE_OJO.test(nodo.tagName.getText(sf))) iconoDeOjo = true
    } else if (ts.isImportSpecifier(nodo)) {
      if (ICONO_DE_OJO.test((nodo.propertyName ?? nodo.name).text)) iconoDeOjo = true
    }
    ts.forEachChild(nodo, visitar)
  }
  visitar(sf)

  const motivos: HallazgoR29['motivo'][] = []
  if (typePassword) motivos.push('type-password')
  if (ariaPressed && iconoDeOjo) motivos.push('ojo-propio')
  return motivos
}

/** `.ts`/`.tsx` bajo `dir`, rutas relativas a la raiz con `/`. */
function listarFuentes(dir: string): string[] {
  const salida: string[] = []
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada)
    if (statSync(ruta).isDirectory()) {
      if (entrada === 'node_modules') continue
      salida.push(...listarFuentes(ruta))
    } else if (/\.tsx?$/.test(entrada) && !entrada.endsWith('.d.ts')) {
      salida.push(relative(repoRoot, ruta).split('\\').join('/'))
    }
  }
  return salida.sort()
}

/** Censo de `app/`: los archivos leidos y los hallazgos. */
export function censoDeApp(): { leidos: readonly string[]; hallazgos: readonly HallazgoR29[] } {
  const leidos = listarFuentes(join(repoRoot, 'app'))
  const hallazgos: HallazgoR29[] = []
  for (const archivo of leidos) {
    for (const motivo of analizarFuente(archivo, readFileSync(join(repoRoot, archivo), 'utf8'))) {
      hallazgos.push({ archivo, motivo })
    }
  }
  return { leidos, hallazgos }
}

const rama = ramaActual()
const base = mergeBaseDeLaRama()

describe('QC-260 — R27: la ficha no toca `lib/`, `db/` ni `middleware.ts`', () => {
  it('R27: el diff de esta rama contra el merge-base no trae nada bajo `lib/`, `db/` ni `middleware.ts`', (ctx) => {
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
      `QC-260 R27: esta ficha es solo presentacion (C5) y el diff toca:\n${tocados.join('\n')}\n` +
        'Si el diseño exige logica nueva, va a preguntas abiertas, no a esta rama.',
    ).toEqual([])
  })

  it('R27 (caso sintetico): un diff con `lib/x.ts`, `db/...` o `middleware.ts` da rojo', () => {
    const diff = [
      'app/(public)/login/page.tsx',
      'components/shared/password-field.tsx',
      'lib/x.ts',
      'db/migrations/20261012000000_algo/migration.sql',
      'middleware.ts',
      'libreria-que-no-es-lib.md',
      'app/middleware.ts',
    ]
    expect(fueraDeLimites(diff)).toEqual([
      'lib/x.ts',
      'db/migrations/20261012000000_algo/migration.sql',
      'middleware.ts',
    ])
    expect(fueraDeLimites(['app/(public)/login/page.tsx'])).toEqual([])
  })

  it('R27: la precondicion se salta RUIDOSAMENTE fuera de esta rama, y nunca en ella', () => {
    const enDev = preparar('dev', 'abc123')
    expect((enDev as { motivo: string }).motivo).toContain('NO ha comprobado nada')
    expect((enDev as { motivo: string }).motivo).toContain("la rama actual es 'dev'")
    expect('motivo' in preparar('feature/QC-999-lo-que-venga', 'abc123')).toBe(true)
    expect((preparar(null, 'abc123') as { motivo: string }).motivo).toContain('NO ha comprobado nada')
    expect((preparar(RAMA_DE_LA_FICHA, null) as { motivo: string }).motivo).toContain('merge-base')
    expect(preparar(RAMA_DE_LA_FICHA, 'abc123')).toEqual({ mergeBase: 'abc123' })
  })
})

describe('QC-260 — R29: `PasswordField` es el unico campo de contraseña con ojo', () => {
  it('R29: ningun archivo de `app/` pinta un `type="password"` ni un ojo propio con `aria-pressed`', () => {
    const { hallazgos } = censoDeApp()
    expect(
      hallazgos,
      'QC-260 R29: estos archivos de `app/` pintan su propio campo de contraseña o su propio ' +
        `mostrar/ocultar:\n${hallazgos.map((h) => `${h.archivo} (${h.motivo})`).join('\n')}\n` +
        'Usa `PasswordField` de `components/shared/password-field.tsx` (D12).',
    ).toEqual([])
  })

  it('R29 (ancla): el censo leyo archivos de verdad, y el detector de `aria-pressed` los vio', () => {
    const { leidos } = censoDeApp()
    expect(leidos.length, 'el censo de `app/` no leyo ningun archivo').toBeGreaterThan(20)
    expect(leidos).toContain('app/layout.tsx')
    // `aria-pressed` legitimo (un filtro sin ojo) existe en disco: el censo lo ve y NO lo marca.
    const conAriaPressed = leidos.filter((archivo) =>
      readFileSync(join(repoRoot, archivo), 'utf8').includes('aria-pressed={'),
    )
    expect(conAriaPressed.length, 'no hay ningun `aria-pressed` real en `app/`').toBeGreaterThan(0)
    // Y el detector, aplicado al propio `PasswordField`, SI lo reconoce como campo con ojo.
    const pieza = readFileSync(join(repoRoot, 'components/shared/password-field.tsx'), 'utf8')
    expect(analizarFuente('password-field.tsx', pieza)).toEqual(['type-password', 'ojo-propio'])
  })

  it('R29 (caso sintetico): un `type="password"` en cualquiera de sus formas da rojo', () => {
    expect(analizarFuente('a.tsx', 'export const A = () => <input type="password" />')).toEqual([
      'type-password',
    ])
    expect(analizarFuente('b.tsx', "export const B = () => <input type={'password'} />")).toEqual([
      'type-password',
    ])
    expect(
      analizarFuente('c.tsx', "export const C = ({ v }: { v: boolean }) => <input type={v ? 'text' : 'password'} />"),
    ).toEqual(['type-password'])
    expect(analizarFuente('d.ts', "export const props = { type: 'password', name: 'x' }")).toEqual([
      'type-password',
    ])
  })

  it('R29 (caso sintetico): un boton de ojo propio con `aria-pressed` da rojo', () => {
    const ojo = [
      "import { Eye, EyeOff } from 'lucide-react'",
      'export const Ojo = ({ v }: { v: boolean }) => (',
      '  <button type="button" aria-pressed={v}>{v ? <EyeOff /> : <Eye />}</button>',
      ')',
    ].join('\n')
    expect(analizarFuente('ojo.tsx', ojo)).toEqual(['ojo-propio'])
  })

  it('R29: sin falsos positivos por comentarios, `autoComplete` ni `aria-pressed` sin ojo', () => {
    const limpio = [
      '// <input type="password" /> y un ojo con aria-pressed: solo un comentario',
      '/* type: \'password\' */',
      'export const F = ({ on }: { on: boolean }) => (',
      '  <>',
      '    <input type="email" autoComplete="current-password" />',
      '    <button type="button" aria-pressed={on}>Filtro</button>',
      '  </>',
      ')',
    ].join('\n')
    expect(analizarFuente('limpio.tsx', limpio)).toEqual([])
  })
})
