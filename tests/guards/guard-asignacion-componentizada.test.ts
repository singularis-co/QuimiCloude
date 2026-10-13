// Guardia: lo que la componentización de `/asignacion` quitó no vuelve (R3, R7, R9, R16, R19; y R14, R42 del rediseño del operario).
//
// Vigila, sobre el código de producción (`app/`, `components/`, `hooks/`, `lib/`):
//
//   1. `archivo-borrado`     — un archivo retirado vuelve a existir.
//   2. `simbolo-borrado`     — se vuelve a declarar o reexportar un símbolo retirado.
//   3. `vacio-con-tabla`     — un vacío o esqueleto de la ruta importa `Table`, `Skeleton` o
//                              `next/link` (deben componer `AssignmentListEmpty` / `AssignmentListSkeleton`).
//   4. `helper-duplicado`    — `groupResponsiblesByOrigin` o `filterByDisplayName` se definen fuera de
//                              `lib/shared/ui/responsible-groups.ts`.
//   5. `boton-duplicado`     — `CountdownGatedButton` se define fuera de `components/shared`.
//
// Misma forma que `guard-piezas-base`: funciones puras que reciben ruta y texto, analizadas con el
// compilador de TypeScript (un comentario o una cadena que nombra el símbolo no cuenta), una muestra
// que viola cada regla y otra que la cumple, y casos que las alimentan con el repositorio real.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as ts from 'typescript'
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

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)))

// ---------------------------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------------------------

export type Regla =
  | 'archivo-borrado'
  | 'simbolo-borrado'
  | 'vacio-con-tabla'
  | 'helper-duplicado'
  | 'boton-duplicado'

export type Hallazgo = { readonly archivo: string; readonly regla: Regla; readonly detalle: string }

const CARPETAS = ['app', 'components', 'hooks', 'lib'] as const
const CARPETAS_IGNORADAS = new Set(['node_modules', '.next', 'generated'])

const RUTA = 'app/(private)/asignacion/'

export const ARCHIVOS_BORRADOS = [
  'app/(private)/asignacion/components/conditioning-orders-href.ts',
  'app/(private)/asignacion/components/packed-order-notice.tsx',
  'app/(private)/asignacion/components/conditioned-order-notice.tsx',
  'app/(private)/asignacion/acondicionamiento/[id]/components/countdown-gated-button.tsx',
  'app/(private)/asignacion/components/assigned-order-delivered-notice.tsx',
  'app/(private)/asignacion/components/assigned-order-cancelled-notice.tsx',
  'app/(private)/asignacion/components/assigned-orders-error.tsx',
] as const

export const SIMBOLOS_BORRADOS = [
  'finishedOrdersHref',
  'packingOrdersHref',
  'BACK_HREF',
  'conditioningOrdersHref',
  'conditionedOrdersHref',
  'deliveredConditionedOrdersHref',
  'ConditioningListView',
  'PackedOrderNotice',
  'ConditionedOrderNotice',
  'AssignedOrderDeliveredNotice',
  'AssignedOrderCancelledNotice',
  'AssignedOrdersError',
] as const

/** Los cuatro avisos de `/asignacion` salen de esta pieza, y el error de lista de esta otra. */
const HOGAR_AVISO = 'app/(private)/asignacion/components/order-outcome-notice.tsx'
const AVISO = 'OrderOutcomeNotice'
const HOGAR_ERROR_DE_LISTA = 'app/(private)/asignacion/components/assignment-list-parts.tsx'
const ERROR_DE_LISTA = 'AssignmentListError'

const MODULOS_PROHIBIDOS_EN_VACIOS = ['next/link', '@/components/ui/table', '@/components/ui/skeleton']
const NOMBRES_PROHIBIDOS_EN_VACIOS = ['Table', 'Skeleton', 'Link']

const HOGAR_HELPERS = 'lib/shared/ui/responsible-groups.ts'
export const HELPERS_UNICOS = ['groupResponsiblesByOrigin', 'filterByDisplayName'] as const

const HOGAR_BOTON = 'components/shared/countdown-gated-button.tsx'
const BOTON = 'CountdownGatedButton'

// ---------------------------------------------------------------------------------------------
// Análisis
// ---------------------------------------------------------------------------------------------

export function esVacioOEsqueletoDeLaRuta(archivo: string): boolean {
  return archivo.startsWith(RUTA) && /-(empty|skeleton)\.tsx$/.test(archivo)
}

/**
 * Nombres que el archivo define en su nivel superior y, con `conReexportaciones`, también los que
 * reexporta desde otro módulo.
 */
export function nombresDeclarados(archivo: string, fuente: string, conReexportaciones = true): string[] {
  const sf = ts.createSourceFile(archivo, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const nombres: string[] = []
  for (const sentencia of sf.statements) {
    if (
      (ts.isFunctionDeclaration(sentencia) ||
        ts.isClassDeclaration(sentencia) ||
        ts.isTypeAliasDeclaration(sentencia) ||
        ts.isInterfaceDeclaration(sentencia) ||
        ts.isEnumDeclaration(sentencia)) &&
      sentencia.name !== undefined
    ) {
      nombres.push(sentencia.name.text)
    } else if (ts.isVariableStatement(sentencia)) {
      for (const decl of sentencia.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) nombres.push(decl.name.text)
      }
    } else if (
      conReexportaciones &&
      ts.isExportDeclaration(sentencia) &&
      sentencia.moduleSpecifier !== undefined &&
      sentencia.exportClause !== undefined &&
      ts.isNamedExports(sentencia.exportClause)
    ) {
      for (const el of sentencia.exportClause.elements) nombres.push(el.name.text)
    }
  }
  return nombres
}

/** Módulos y nombres que el archivo importa. */
function importaciones(archivo: string, fuente: string): { modulos: string[]; nombres: string[] } {
  const sf = ts.createSourceFile(archivo, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const modulos: string[] = []
  const nombres: string[] = []
  for (const sentencia of sf.statements) {
    if (!ts.isImportDeclaration(sentencia) || !ts.isStringLiteral(sentencia.moduleSpecifier)) continue
    modulos.push(sentencia.moduleSpecifier.text)
    const clausula = sentencia.importClause
    if (clausula === undefined) continue
    if (clausula.name !== undefined) nombres.push(clausula.name.text)
    if (clausula.namedBindings !== undefined && ts.isNamedImports(clausula.namedBindings)) {
      for (const el of clausula.namedBindings.elements) {
        nombres.push((el.propertyName ?? el.name).text)
      }
    }
  }
  return { modulos, nombres }
}

/** Reglas 2 a 5 sobre un archivo. */
export function analizar(archivo: string, fuente: string): Hallazgo[] {
  const hallazgos: Hallazgo[] = []
  const declarados = nombresDeclarados(archivo, fuente)

  for (const simbolo of SIMBOLOS_BORRADOS) {
    if (declarados.includes(simbolo)) {
      hallazgos.push({ archivo, regla: 'simbolo-borrado', detalle: simbolo })
    }
  }

  const definidos = nombresDeclarados(archivo, fuente, false)

  if (archivo !== HOGAR_HELPERS) {
    for (const helper of HELPERS_UNICOS) {
      if (definidos.includes(helper)) {
        hallazgos.push({ archivo, regla: 'helper-duplicado', detalle: helper })
      }
    }
  }

  if (archivo !== HOGAR_BOTON && definidos.includes(BOTON)) {
    hallazgos.push({ archivo, regla: 'boton-duplicado', detalle: BOTON })
  }

  if (esVacioOEsqueletoDeLaRuta(archivo)) {
    const { modulos, nombres } = importaciones(archivo, fuente)
    for (const modulo of modulos) {
      if (MODULOS_PROHIBIDOS_EN_VACIOS.includes(modulo)) {
        hallazgos.push({ archivo, regla: 'vacio-con-tabla', detalle: modulo })
      }
    }
    for (const nombre of nombres) {
      if (NOMBRES_PROHIBIDOS_EN_VACIOS.includes(nombre)) {
        hallazgos.push({ archivo, regla: 'vacio-con-tabla', detalle: nombre })
      }
    }
  }

  return hallazgos
}

/** Regla 1 sobre una lista de rutas existentes. */
export function archivosQueVolvieron(existentes: readonly string[]): Hallazgo[] {
  return ARCHIVOS_BORRADOS.filter((a) => existentes.includes(a)).map((archivo) => ({
    archivo,
    regla: 'archivo-borrado' as const,
    detalle: archivo,
  }))
}

// ---------------------------------------------------------------------------------------------
// Repositorio real
// ---------------------------------------------------------------------------------------------

function listarProduccion(): string[] {
  const salida: string[] = []
  const recorrer = (dir: string) => {
    for (const entrada of readdirSync(dir)) {
      if (CARPETAS_IGNORADAS.has(entrada)) continue
      const abs = join(dir, entrada)
      if (statSync(abs).isDirectory()) recorrer(abs)
      else if (/\.tsx?$/.test(entrada) && !/\.d\.ts$/.test(entrada)) {
        salida.push(relative(repoRoot, abs).split('\\').join('/'))
      }
    }
  }
  for (const carpeta of CARPETAS) {
    const abs = join(repoRoot, carpeta)
    if (existsSync(abs)) recorrer(abs)
  }
  return salida
}

const PRODUCCION = listarProduccion()

function analizarRepo(): Hallazgo[] {
  return PRODUCCION.flatMap((archivo) =>
    analizar(archivo, readFileSync(join(repoRoot, archivo), 'utf8')),
  )
}

// ---------------------------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------------------------

describe('guard-asignacion-componentizada — muestras', () => {
  const VACIO = 'app/(private)/asignacion/components/x-orders-empty.tsx'
  const ESQUELETO = 'app/(private)/asignacion/components/x-orders-skeleton.tsx'

  it('R3 R16 R19 — un archivo retirado que vuelve es hallazgo; sin él, nada', () => {
    for (const archivo of ARCHIVOS_BORRADOS) {
      expect(archivosQueVolvieron([archivo, 'app/otro.ts'])).toEqual([
        { archivo, regla: 'archivo-borrado', detalle: archivo },
      ])
    }
    expect(archivosQueVolvieron(['app/otro.ts'])).toEqual([])
  })

  it('R3 R16 — declarar o reexportar un símbolo retirado es hallazgo', () => {
    const muestras = [
      'export function PackedOrderNotice() { return null }',
      'export const conditioningOrdersHref = () => "/x"',
      'export type ConditioningListView = "a" | "b"',
      "export { BACK_HREF } from './hrefs'",
    ]
    for (const fuente of muestras) {
      expect(analizar('app/(private)/asignacion/components/a.tsx', fuente).map((h) => h.regla)).toEqual(
        ['simbolo-borrado'],
      )
    }
  })

  it('R3 R16 — nombrarlo en un comentario o en una cadena no es hallazgo', () => {
    const fuente = [
      '// PackedOrderNotice ya no existe',
      "export const nota = 'conditioningOrdersHref'",
      'export function OrderOutcomeNotice() { return null }',
    ].join('\n')
    expect(analizar('app/(private)/asignacion/components/a.tsx', fuente)).toEqual([])
  })

  it('R7 — un vacío o esqueleto de la ruta que importa Table, Skeleton o next/link es hallazgo', () => {
    expect(analizar(VACIO, "import Link from 'next/link'").map((h) => h.detalle)).toEqual([
      'next/link',
      'Link',
    ])
    expect(
      analizar(ESQUELETO, "import { Skeleton } from '@/components/ui/skeleton'").map((h) => h.detalle),
    ).toEqual(['@/components/ui/skeleton', 'Skeleton'])
    expect(analizar(VACIO, "import { Table, TableBody } from '@/components/ui/table'").map((h) => h.regla))
      .toEqual(['vacio-con-tabla', 'vacio-con-tabla'])
  })

  it('R7 — el vacío que compone la pieza de la ruta cumple; fuera de la ruta no se mira', () => {
    expect(analizar(VACIO, "import { AssignmentListEmpty } from './assignment-list-parts'")).toEqual([])
    expect(analizar('app/(private)/pedidos/components/x-empty.tsx', "import Link from 'next/link'")).toEqual(
      [],
    )
  })

  it('R9 — definir un helper de responsables fuera de su hogar es hallazgo', () => {
    const fuente = 'export function groupResponsiblesByOrigin() { return [] }\nconst filterByDisplayName = () => []'
    expect(analizar('app/(private)/asignacion/components/b.ts', fuente).map((h) => h.detalle)).toEqual([
      'groupResponsiblesByOrigin',
      'filterByDisplayName',
    ])
  })

  it('R9 — en su hogar, o reexportado desde otro módulo, cumple', () => {
    expect(analizar(HOGAR_HELPERS, 'export function groupResponsiblesByOrigin() { return [] }')).toEqual([])
    expect(
      analizar(
        'app/x/components/index.ts',
        "export { filterByDisplayName } from '@/lib/shared/ui/responsible-groups'",
      ),
    ).toEqual([])
  })

  it('R19 — definir CountdownGatedButton fuera de components/shared es hallazgo', () => {
    const fuente = 'export function CountdownGatedButton() { return null }'
    expect(analizar('app/(private)/asignacion/acondicionamiento/[id]/components/c.tsx', fuente)).toEqual([
      {
        archivo: 'app/(private)/asignacion/acondicionamiento/[id]/components/c.tsx',
        regla: 'boton-duplicado',
        detalle: BOTON,
      },
    ])
    expect(analizar(HOGAR_BOTON, fuente)).toEqual([])
    expect(
      analizar(
        'app/x/components/index.ts',
        "export { CountdownGatedButton } from '@/components/shared/countdown-gated-button'",
      ),
    ).toEqual([])
  })
})

describe('guard-asignacion-componentizada — avisos y error de lista en una pieza', () => {
  it('R14 (rediseño del operario) — definir AssignedOrderDeliveredNotice o AssignedOrderCancelledNotice es hallazgo', () => {
    for (const simbolo of ['AssignedOrderDeliveredNotice', 'AssignedOrderCancelledNotice']) {
      expect(
        analizar('app/(private)/asignacion/components/a.tsx', `export function ${simbolo}() { return null }`),
      ).toEqual([{ archivo: 'app/(private)/asignacion/components/a.tsx', regla: 'simbolo-borrado', detalle: simbolo }])
    }
    expect(
      archivosQueVolvieron(['app/(private)/asignacion/components/assigned-order-delivered-notice.tsx']),
    ).toHaveLength(1)
  })

  it('R42 (rediseño del operario) — volver a definir AssignedOrdersError junto a AssignmentListError es hallazgo', () => {
    const fuente = 'export function AssignedOrdersError() { return null }'
    expect(analizar('app/(private)/asignacion/components/b.tsx', fuente).map((h) => h.detalle)).toEqual([
      'AssignedOrdersError',
    ])
    expect(archivosQueVolvieron(['app/(private)/asignacion/components/assigned-orders-error.tsx'])).toHaveLength(1)
  })
})

describe('guard-asignacion-componentizada — repositorio', () => {
  it('R3 R16 R19 — ningún archivo retirado vuelve', () => {
    expect(archivosQueVolvieron(PRODUCCION)).toEqual([])
  })

  it('R3 R7 R9 R16 R19 — ningún hallazgo en el código de producción', () => {
    expect(analizarRepo()).toEqual([])
  })

  it('R7 — la guardia ve los vacíos y esqueletos de la ruta (no pasa por no mirar)', () => {
    expect(PRODUCCION.filter(esVacioOEsqueletoDeLaRuta).length).toBeGreaterThanOrEqual(5)
  })

  it('R9 R19 — cada pieza única tiene exactamente una definición, en su hogar', () => {
    const definiciones = (nombre: string) =>
      PRODUCCION.filter((archivo) => {
        const fuente = readFileSync(join(repoRoot, archivo), 'utf8')
        return nombresDeclarados(archivo, fuente, false).includes(nombre)
      })
    for (const helper of HELPERS_UNICOS) expect(definiciones(helper)).toEqual([HOGAR_HELPERS])
    expect(definiciones(BOTON)).toEqual([HOGAR_BOTON])
  })

  it('R14 (rediseño del operario) — los avisos de /asignacion salen de una sola pieza', () => {
    const definiciones = (nombre: string) =>
      PRODUCCION.filter((archivo) =>
        nombresDeclarados(archivo, readFileSync(join(repoRoot, archivo), 'utf8'), false).includes(nombre),
      )
    expect(definiciones(AVISO)).toEqual([HOGAR_AVISO])
    expect(definiciones('AssignedOrderDeliveredNotice')).toEqual([])
    expect(definiciones('AssignedOrderCancelledNotice')).toEqual([])
  })

  it('R42 (rediseño del operario) — /asignacion tiene una sola pieza de error de lista', () => {
    const definiciones = (nombre: string) =>
      PRODUCCION.filter((archivo) =>
        nombresDeclarados(archivo, readFileSync(join(repoRoot, archivo), 'utf8'), false).includes(nombre),
      )
    expect(definiciones(ERROR_DE_LISTA)).toEqual([HOGAR_ERROR_DE_LISTA])
    expect(definiciones('AssignedOrdersError')).toEqual([])
  })
})
