// Guardia de la ruta de formulas tras el rediseno (QC-264 D16).
//
// Las marcas de version (igual, cambiado, anadido, quitado) y el «Por revisar» se pintan con
// `StatusBadge` sobre el mapa unico `recipe-version-tones.ts` (D14). Esta guardia recorre el codigo
// de produccion de `app/(private)/produccion/formulas/` y falla si algun archivo vuelve a importar el
// `Badge` de `components/ui` o declara, fuera de ese mapa, su propio `Record` de marcas a tono o
// variante (R44). Ademas, ni `app/` ni `components/` pueden volver a decir los textos sin tilde que
// corrigio la ficha (R45). Cada detector se prueba primero con un fuente inventado, para que el
// verde del barrido real no sea un falso verde.

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
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

const CARPETA = 'app/(private)/produccion/formulas'
const MAPA_UNICO = `${CARPETA}/components/recipe-version-tones.ts`

/** Si el barrido devolviera pocos archivos, el `toEqual([])` de abajo seria un falso verde. */
const ARCHIVOS_MINIMOS_RUTA = 25
const ARCHIVOS_MINIMOS_APP_Y_COMPONENTES = 300

const IMPORTA_BADGE = /['"](?:@\/|(?:\.\.?\/)+)components\/ui\/badge['"]/

const CLAVES_DE_MARCA = ['same', 'changed', 'added', 'removed']

// Tonos de `StatusBadge` (`lib/shared/ui/status-tone.ts`) y variantes de `Badge`.
const TONOS_Y_VARIANTES = [
  'neutral',
  'progress',
  'waiting',
  'success',
  'danger',
  'info',
  'muted',
  'warning',
  'destructive',
  'default',
  'secondary',
  'outline',
  'ghost',
  'link',
]

const MARCA_A_TONO = new RegExp(
  `['"]?\\b(?:${CLAVES_DE_MARCA.join('|')})\\b['"]?\\s*:\\s*['"](?:${TONOS_Y_VARIANTES.join('|')})['"]`,
)

/** Los textos sin tilde que R45 prohibe; se buscan sin distinguir mayusculas. */
const TEXTOS_SIN_TILDE = [
  'Asi se leera',
  'aqui se guarda',
  'Quitar la seleccion',
  'ya no esta disponible',
]

function archivosDe(carpeta: string): string[] {
  return readdirSync(join(repoRoot, carpeta), { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
    .map((e) => relative(repoRoot, join(e.parentPath, e.name)).split('\\').join('/'))
}

function hallazgosDeTono(ruta: string, fuente: string): string[] {
  return fuente.split(/\r?\n/).flatMap((linea, i) => {
    const donde = `${ruta}:${i + 1}`
    const encontrados: string[] = []
    if (IMPORTA_BADGE.test(linea)) encontrados.push(`${donde} importa Badge`)
    if (ruta !== MAPA_UNICO && MARCA_A_TONO.test(linea)) encontrados.push(`${donde} mapa propio`)
    return encontrados
  })
}

function hallazgosDeTexto(ruta: string, fuente: string): string[] {
  return fuente.split(/\r?\n/).flatMap((linea, i) => {
    const minusculas = linea.toLowerCase()
    return TEXTOS_SIN_TILDE.filter((texto) => minusculas.includes(texto.toLowerCase())).map(
      (texto) => `${ruta}:${i + 1} «${texto}»`,
    )
  })
}

function leer(ruta: string): string {
  return readFileSync(join(repoRoot, ruta), 'utf8')
}

describe('guardia: la ruta de formulas no pinta marcas con Badge ni con mapas propios', () => {
  it('R44: el detector muerde el import de Badge y los mapas de marcas propios, y deja pasar lo de hoy', () => {
    const fuente = [
      "import { Badge } from '@/components/ui/badge';",
      "import { Badge as B } from '../../../../components/ui/badge';",
      "  same: 'secondary',",
      "  changed: 'waiting',",
      "  'added': 'success',",
      "  removed: 'destructive',",
      "import { StatusBadge } from '@/components/shared/status-badge';",
      "import { RECIPE_VERSION_MARK_TONES } from './recipe-version-tones';",
      "  same: 'Igual',",
      "  changed: 'border-warning-border bg-warning-subtle/45',",
      '  const counts = { same: 0, changed: 0, added: 0 };',
    ].join('\n')

    expect(hallazgosDeTono('inventado.tsx', fuente)).toEqual([
      'inventado.tsx:1 importa Badge',
      'inventado.tsx:2 importa Badge',
      'inventado.tsx:3 mapa propio',
      'inventado.tsx:4 mapa propio',
      'inventado.tsx:5 mapa propio',
      'inventado.tsx:6 mapa propio',
    ])
  })

  it('R44: el mapa unico existe y es el unico sitio que pone tono a las marcas', () => {
    const mapa = leer(MAPA_UNICO)
    expect(mapa).toContain('export const RECIPE_VERSION_MARK_TONES')
    expect(mapa.split(/\r?\n/).filter((linea) => MARCA_A_TONO.test(linea))).toHaveLength(4)
  })

  it('R44: ningun archivo de app/(private)/produccion/formulas/ importa Badge ni declara un mapa de marcas propio', () => {
    const rutas = archivosDe(CARPETA)
    expect(rutas.length).toBeGreaterThanOrEqual(ARCHIVOS_MINIMOS_RUTA)
    expect(rutas).toContain(MAPA_UNICO)
    expect(rutas).toContain(`${CARPETA}/components/recipe-lines-field.tsx`)

    const encontrados = rutas.flatMap((ruta) => hallazgosDeTono(ruta, leer(ruta)))
    expect(encontrados).toEqual([])
  })
})

describe('guardia: app/ y components/ no vuelven a los textos sin tilde', () => {
  it('R45: el detector muerde los cuatro textos sin tilde y deja pasar los corregidos', () => {
    const fuente = [
      "const PREVIEW_DESCRIPTION = 'Asi se leera esta receta en planta.';",
      "  'La imagen aqui se guarda',",
      "const CLEAR_LABEL = 'Quitar la seleccion';",
      "const UNKNOWN_BATCH_LABEL = 'La tanda ya no esta disponible.';",
      "const PREVIEW_DESCRIPTION = 'Así se leerá esta receta en planta.';",
      "const CLEAR_LABEL = 'Quitar la selección';",
      "const UNKNOWN_BATCH_LABEL = 'La tanda ya no está disponible.';",
    ].join('\n')

    expect(hallazgosDeTexto('inventado.tsx', fuente)).toEqual([
      'inventado.tsx:1 «Asi se leera»',
      'inventado.tsx:2 «aqui se guarda»',
      'inventado.tsx:3 «Quitar la seleccion»',
      'inventado.tsx:4 «ya no esta disponible»',
    ])
  })

  it('R45: ningun archivo de app/ ni de components/ contiene los textos sin tilde', () => {
    const rutas = [...archivosDe('app'), ...archivosDe('components')]
    expect(rutas.length).toBeGreaterThanOrEqual(ARCHIVOS_MINIMOS_APP_Y_COMPONENTES)
    expect(rutas).toContain(`${CARPETA}/components/recipe-form.tsx`)

    const encontrados = rutas.flatMap((ruta) => hallazgosDeTexto(ruta, leer(ruta)))
    expect(encontrados).toEqual([])
  })
})
