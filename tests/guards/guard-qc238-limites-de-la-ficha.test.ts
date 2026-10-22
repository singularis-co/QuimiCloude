// QC-238 — Guardia: los limites de ESTA ficha (R33).
//
//   R33 — la ficha no añade dependencias, permisos, entradas de menu, variables de entorno ni
//         codigos al catalogo de errores. Las guardias de coherencia (`guard-dependencias-aprobadas`,
//         `guard-variables-por-entorno`, `guard-permisos-sembrados`, `guard-catalogo-de-errores`)
//         dejan pasar cualquiera de esas cosas si viene con su fila: ninguna prueba AUSENCIA. Esta
//         si: su diff no puede tocar los archivos donde viven.
//
//   - dependencias          → `package.json`, `pnpm-lock.yaml`
//   - variables de entorno  → `.env.example`
//   - permisos              → `lib/modules/identity/domain/permissions.ts`
//   - menu                  → `lib/shared/navigation/private-nav.ts`
//   - catalogo de errores   → `lib/modules/errores/domain/error-codes.ts` (los codigos) y
//                             `lib/modules/errores/domain/error-catalog.ts` (sus mensajes), los
//                             dos que lee `guard-catalogo-de-errores` por el barrel `@/lib/modules/errores`.
//
// Es un censo del DIFF DE RAMA y se acota a su rama, como `guard-qc260-limites-de-la-ficha` y
// `guard-qc261-limites-de-la-ficha`: fuera de `feature/QC-238-recepcion-webhook-whatsapp` hace
// `ctx.skip` RUIDOSO diciendo que no ha comprobado nada. El rango es el merge-base de la rama con
// `origin/dev` (o `dev`), no la punta de `dev`.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
const RAMA_DE_LA_FICHA = 'feature/QC-238-recepcion-webhook-whatsapp'

/** Candidatos de rama base, en orden. El worktree puede no tener remoto configurado. */
const BASES = ['origin/dev', 'dev'] as const

/** Lo que R33 prohibe tocar. Rutas exactas, relativas a la raiz y con `/`. */
export const ARCHIVOS_PROHIBIDOS = [
  'package.json',
  'pnpm-lock.yaml',
  '.env.example',
  'lib/modules/identity/domain/permissions.ts',
  'lib/shared/navigation/private-nav.ts',
  'lib/modules/errores/domain/error-codes.ts',
  'lib/modules/errores/domain/error-catalog.ts',
] as const

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

/** R33: los de `archivos` que son alguno de los prohibidos. Pura. */
export function fueraDeLimites(archivos: readonly string[]): readonly string[] {
  return archivos.filter((archivo) => (ARCHIVOS_PROHIBIDOS as readonly string[]).includes(archivo))
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
        `la rama actual es '${rama}' y no '${RAMA_DE_LA_FICHA}': R33 habla de lo que hace ESTA ` +
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

const rama = ramaActual()
const base = mergeBaseDeLaRama()

describe('QC-238 — R33: la ficha no añade dependencias, permisos, menu, variables ni codigos de error', () => {
  it('R33: el diff de esta rama contra el merge-base no toca ninguno de los archivos prohibidos', (ctx) => {
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
      `QC-238 R33: el diff toca archivos que esta ficha no puede cambiar:\n${tocados.join('\n')}\n` +
        'Una dependencia, un permiso, una entrada de menu, una variable o un codigo de error nuevo ' +
        'va a preguntas abiertas del spec, no a esta rama.',
    ).toEqual([])
  })

  it('R33 (caso sintetico): cada archivo prohibido da rojo y uno permitido pasa', () => {
    for (const prohibido of ARCHIVOS_PROHIBIDOS) {
      expect(fueraDeLimites(['lib/modules/integraciones/index.ts', prohibido])).toEqual([prohibido])
    }
    const diff = [
      'app/api/integraciones/whatsapp/[conexionId]/webhook/route.ts',
      'lib/modules/integraciones/domain/receive-whatsapp-webhook.ts',
      'tests/fixtures/package.json',
      'lib/modules/identity/domain/permissions.test.ts',
      'lib/modules/errores/domain/error-message.ts',
      '.env.example.bak',
    ]
    expect(fueraDeLimites(diff)).toEqual([])
    expect(fueraDeLimites([...diff, ...ARCHIVOS_PROHIBIDOS])).toEqual([...ARCHIVOS_PROHIBIDOS])
  })

  it('R33: los archivos prohibidos existen (si alguno se mueve, la guardia no miraria nada)', () => {
    for (const archivo of ARCHIVOS_PROHIBIDOS) {
      expect(() => readFileSync(join(repoRoot, archivo)), `no existe ${archivo}`).not.toThrow()
    }
  })

  it('R33: la precondicion se salta RUIDOSAMENTE fuera de esta rama, y nunca en ella', () => {
    const enDev = preparar('dev', 'abc123')
    expect((enDev as { motivo: string }).motivo).toContain('NO ha comprobado nada')
    expect((enDev as { motivo: string }).motivo).toContain("la rama actual es 'dev'")
    expect('motivo' in preparar('feature/QC-999-lo-que-venga', 'abc123')).toBe(true)
    expect((preparar(null, 'abc123') as { motivo: string }).motivo).toContain('NO ha comprobado nada')
    expect((preparar(RAMA_DE_LA_FICHA, null) as { motivo: string }).motivo).toContain('merge-base')
    expect(preparar(RAMA_DE_LA_FICHA, 'abc123')).toEqual({ mergeBase: 'abc123' })
  })
})
