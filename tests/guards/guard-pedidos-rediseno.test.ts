// Guardia de la pantalla de pedidos tras el rediseño.
//
// El estado, la prioridad y la cobertura de un pedido se pintan con `StatusBadge` y `PriorityMark`
// sobre el mapa único de `lib/shared/ui/order-status.ts`. Esta guardia recorre el código de
// producción de `app/(private)/pedidos/` y falla si algún archivo vuelve a importar el `Badge` de
// `components/ui` o declara su propio mapa de estado, prioridad o cobertura a variante, tono o
// nivel. El detector se prueba primero con un fuente inventado, para que el verde del barrido real
// no sea un falso verde.

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

const CARPETA = 'app/(private)/pedidos'

/** Si el barrido devolviera pocos archivos, el `toEqual([])` de abajo seria un falso verde. */
const ARCHIVOS_MINIMOS = 30

const IMPORTA_BADGE = /['"](?:@\/|(?:\.\.?\/)+)components\/ui\/badge['"]/

const CLAVES_DE_ESTADO = [
  'PENDIENTE',
  'EN_CURSO',
  'POR_EMPACAR',
  'EN_EMPAQUE',
  'ENTREGADO',
  'CANCELADO',
  'BLOQUEADO',
  'POR_ACONDICIONAR',
  'EN_ACONDICIONAMIENTO',
  'TERMINADO',
]
const CLAVES_DE_PRIORIDAD = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA']
const CLAVES_DE_COBERTURA = ['full', 'none', 'partial']

// Tonos de `StatusBadge` y variantes de `Badge`.
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

function clave(nombres: readonly string[]): string {
  return `['"]?\\b(?:${nombres.join('|')})\\b['"]?`
}

const MAPA_A_TONO = new RegExp(
  `${clave([...CLAVES_DE_ESTADO, ...CLAVES_DE_PRIORIDAD, ...CLAVES_DE_COBERTURA])}\\s*:\\s*['"](?:${TONOS_Y_VARIANTES.join('|')})['"]`,
)

const PRIORIDAD_A_NIVEL = new RegExp(`${clave(CLAVES_DE_PRIORIDAD)}\\s*:\\s*[1-4]\\b`)

function archivosDeProduccion(): string[] {
  return readdirSync(join(repoRoot, CARPETA), { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
    .map((e) => relative(repoRoot, join(e.parentPath, e.name)).split('\\').join('/'))
}

function hallazgos(ruta: string, fuente: string): string[] {
  return fuente.split(/\r?\n/).flatMap((linea, i) => {
    const donde = `${ruta}:${i + 1}`
    const encontrados: string[] = []
    if (IMPORTA_BADGE.test(linea)) encontrados.push(`${donde} importa Badge`)
    if (MAPA_A_TONO.test(linea) || PRIORIDAD_A_NIVEL.test(linea)) {
      encontrados.push(`${donde} mapa propio`)
    }
    return encontrados
  })
}

describe('guardia: la pantalla de pedidos no pinta estados con Badge ni con mapas propios', () => {
  it('R8: el detector muerde el import de Badge y los mapas propios, y deja pasar lo de hoy', () => {
    const fuente = [
      "import { Badge } from '@/components/ui/badge';",
      "import { Badge as B } from '../../../../components/ui/badge';",
      "  EN_CURSO: 'info',",
      "  CRITICA: 'destructive',",
      "  'partial': 'waiting',",
      '  ALTA: 3,',
      "import { StatusBadge } from '@/components/shared/status-badge';",
      "import { ORDER_STATUS_TONES } from '@/lib/shared/ui/order-status';",
      '  ENTREGADO: true,',
      "  return choice.kind === 'none' ? 'none' : choice.customer.id;",
      "  label: 'Alta',",
    ].join('\n')

    expect(hallazgos('inventado.tsx', fuente)).toEqual([
      'inventado.tsx:1 importa Badge',
      'inventado.tsx:2 importa Badge',
      'inventado.tsx:3 mapa propio',
      'inventado.tsx:4 mapa propio',
      'inventado.tsx:5 mapa propio',
      'inventado.tsx:6 mapa propio',
    ])
  })

  it('R8: ningun archivo de produccion de app/(private)/pedidos/ importa Badge ni declara un mapa propio', () => {
    const rutas = archivosDeProduccion()
    expect(rutas.length).toBeGreaterThanOrEqual(ARCHIVOS_MINIMOS)
    expect(rutas).toContain(`${CARPETA}/components/order-status-badge.tsx`)

    const encontrados = rutas.flatMap((ruta) =>
      hallazgos(ruta, readFileSync(join(repoRoot, ruta), 'utf8')),
    )
    expect(encontrados).toEqual([])
  })
})
