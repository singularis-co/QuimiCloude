// Guardia de la pantalla de inventario tras el rediseño.
//
// Recorre el código de producción de `app/(private)/inventario/` y falla si vuelve algo que el
// rediseño retiró:
//
//   1. `texto-retirado`              — «Elegi un motivo», «Conteo fisico», «Mostrando todos los
//                                      tipos» o «Filtrando por» en un literal o un texto JSX.
//   2. `existencia-en-rojo`          — `text-destructive` en el cuerpo de `stockAmountCell` o de
//                                      `packagedStockCell`, o en lo que esos cuerpos nombran. Solo
//                                      el cuerpo: el error de la sub-fila de lotes, en el mismo
//                                      archivo, se pinta en rojo con derecho.
//   3. `vencimiento-en-rojo`         — `text-destructive` en `EXPIRING_CLASS`: un lote por vencer va
//                                      en ámbar; «Vencido» es un `StatusBadge`.
//   4. `volver-como-enlace`          — «Volver a inventario» dentro de un `Link` o un `a`, o la
//                                      página de importar sin su `ArrowLink`.
//   5. `plantilla-fuera-de-cabecera` — `ImportTemplateButton` fuera de las `actions` de un
//                                      `PageHeader`, o «Descargar plantilla» fuera de su botón.
//   6. `motivo-derivado`             — `movementReasonLabel` que calcula la etiqueta a partir del
//                                      valor en vez de leerla de un mapa exhaustivo con tildes.
//   7. `tactil-propia`               — `batch-history.tsx` con su propio par `min-h-11 min-w-11`.
//
// Analiza con el compilador de TypeScript (ya en `devDependencies`): un comentario que cite un
// texto retirado no cuenta. Cada regla se prueba primero con un fuente inventado, para que el
// verde del barrido real no sea un falso verde.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as ts from 'typescript'
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

const CARPETA = 'app/(private)/inventario'

/** Si el barrido devolviera pocos archivos, el `toEqual([])` de abajo seria un falso verde. */
const ARCHIVOS_MINIMOS = 50

export type Regla =
  | 'texto-retirado'
  | 'existencia-en-rojo'
  | 'vencimiento-en-rojo'
  | 'volver-como-enlace'
  | 'plantilla-fuera-de-cabecera'
  | 'motivo-derivado'
  | 'tactil-propia'

export type Hallazgo = { readonly archivo: string; readonly regla: Regla; readonly detalle: string }

const TEXTOS_RETIRADOS = ['Elegi un motivo', 'Conteo fisico', 'Mostrando todos los tipos', 'Filtrando por'] as const

const ROJO = 'text-destructive'

/** `Record` entero, no `Partial`: un motivo nuevo no compila hasta tener su texto. */
const MAPA_EXHAUSTIVO = /^(?:Readonly<\s*)?Record<\s*MovementReason\s*,\s*string\s*>(?:\s*>)?$/

const CELDAS_DE_EXISTENCIA: Readonly<Record<string, readonly string[]>> = {
  [`${CARPETA}/components/product-columns.tsx`]: ['stockAmountCell'],
  [`${CARPETA}/components/finished-stock-columns.tsx`]: ['packagedStockCell'],
}

const EXPIRY_DATE = `${CARPETA}/components/expiry-date.tsx`
const IMPORT_PAGE = `${CARPETA}/importar/page.tsx`
const MOVEMENT_REASON_LABEL = `${CARPETA}/components/movement-reason-label.ts`
const BATCH_HISTORY = `${CARPETA}/components/batch-history.tsx`

const BACK_LABEL = 'Volver a inventario'
const BACK_LABEL_SYMBOL = 'IMPORT_BACK_LABEL'
const TEMPLATE_LABEL = 'Descargar plantilla'
const TEMPLATE_LABEL_SYMBOL = 'TEMPLATE_BUTTON_LABEL'

/** Donde «Descargar plantilla» SI puede aparecer: su texto y su botón. */
const DUENOS_DE_LA_PLANTILLA = [
  `${CARPETA}/importar/components/import-texts.ts`,
  `${CARPETA}/importar/components/import-template-button.tsx`,
]

/** Las etiquetas con tilde de cada motivo de ajuste (R24). */
const MOTIVOS_CON_TILDE: Readonly<Record<string, string>> = {
  merma: 'Merma',
  rotura: 'Rotura',
  conteo_fisico: 'Conteo físico',
  error_de_carga: 'Error de carga',
}

// ---------------------------------------------------------------------------------------------
// Detector
// ---------------------------------------------------------------------------------------------

export type Leer = (archivo: string) => string | null

function fuente(archivo: string, texto: string): ts.SourceFile {
  const kind = archivo.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(archivo, texto, ts.ScriptTarget.Latest, true, kind)
}

function recorrer(nodo: ts.Node, visita: (n: ts.Node) => void): void {
  visita(nodo)
  ts.forEachChild(nodo, (hijo) => recorrer(hijo, visita))
}

/** Los textos que se pintan o se pasan: literales, trozos de plantilla y texto JSX. */
function literales(nodo: ts.Node): string[] {
  const textos: string[] = []
  recorrer(nodo, (n) => {
    if (
      ts.isStringLiteral(n) ||
      ts.isNoSubstitutionTemplateLiteral(n) ||
      ts.isTemplateHead(n) ||
      ts.isTemplateMiddle(n) ||
      ts.isTemplateTail(n) ||
      ts.isJsxText(n)
    ) {
      textos.push(n.text)
    }
  })
  return textos
}

function nombra(nodo: ts.Node, simbolo: string): boolean {
  let encontrado = false
  recorrer(nodo, (n) => {
    if (ts.isIdentifier(n) && n.text === simbolo) encontrado = true
  })
  return encontrado
}

function etiquetaJsx(nodo: ts.Node): string | null {
  if (ts.isJsxElement(nodo)) return nodo.openingElement.tagName.getText()
  if (ts.isJsxSelfClosingElement(nodo)) return nodo.tagName.getText()
  return null
}

type Declaraciones = {
  readonly locales: ReadonlyMap<string, ts.Node>
  readonly importadas: ReadonlyMap<string, { readonly archivo: string; readonly nombre: string }>
}

function resolverRelativo(desde: string, especificador: string, leer: Leer): string | null {
  const base = posix.join(posix.dirname(desde), especificador)
  for (const candidato of [`${base}.tsx`, `${base}.ts`, `${base}/index.ts`]) {
    if (leer(candidato) !== null) return candidato
  }
  return null
}

function declaraciones(archivo: string, sf: ts.SourceFile, leer: Leer): Declaraciones {
  const locales = new Map<string, ts.Node>()
  const importadas = new Map<string, { archivo: string; nombre: string }>()
  for (const sentencia of sf.statements) {
    if (ts.isFunctionDeclaration(sentencia) && sentencia.name) locales.set(sentencia.name.text, sentencia)
    if (ts.isVariableStatement(sentencia)) {
      for (const d of sentencia.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) locales.set(d.name.text, d)
      }
    }
    if (
      ts.isImportDeclaration(sentencia) &&
      ts.isStringLiteral(sentencia.moduleSpecifier) &&
      sentencia.moduleSpecifier.text.startsWith('.')
    ) {
      const destino = resolverRelativo(archivo, sentencia.moduleSpecifier.text, leer)
      const enlaces = sentencia.importClause?.namedBindings
      if (destino === null || enlaces === undefined || !ts.isNamedImports(enlaces)) continue
      for (const e of enlaces.elements) {
        importadas.set(e.name.text, { archivo: destino, nombre: (e.propertyName ?? e.name).text })
      }
    }
  }
  return { locales, importadas }
}

/**
 * La declaracion de `nombre` en `archivo` y, de forma transitiva, lo que nombra en su archivo o en
 * un archivo hermano importado por ruta relativa. `null` si no se encuentra.
 */
function cuerpoConLoQueNombra(archivo: string, nombre: string, leer: Leer): ts.Node[] | null {
  const vistos = new Set<string>()
  const nodos: ts.Node[] = []
  const pendientes: { archivo: string; nombre: string }[] = [{ archivo, nombre }]
  const cache = new Map<string, Declaraciones>()
  let raiz = true
  while (pendientes.length > 0) {
    const actual = pendientes.pop()!
    const clave = `${actual.archivo}#${actual.nombre}`
    if (vistos.has(clave)) continue
    vistos.add(clave)
    const texto = leer(actual.archivo)
    if (texto === null) {
      if (raiz) return null
      continue
    }
    let decl = cache.get(actual.archivo)
    if (decl === undefined) {
      decl = declaraciones(actual.archivo, fuente(actual.archivo, texto), leer)
      cache.set(actual.archivo, decl)
    }
    const nodo = decl.locales.get(actual.nombre)
    if (nodo === undefined) {
      if (raiz) return null
      continue
    }
    raiz = false
    nodos.push(nodo)
    const conocidas = decl
    recorrer(nodo, (n) => {
      if (!ts.isIdentifier(n) || n.text === actual.nombre) return
      if (conocidas.locales.has(n.text)) pendientes.push({ archivo: actual.archivo, nombre: n.text })
      const importada = conocidas.importadas.get(n.text)
      if (importada !== undefined) pendientes.push(importada)
    })
  }
  return nodos
}

function textosRetirados(archivo: string, sf: ts.SourceFile): Hallazgo[] {
  const hallazgos: Hallazgo[] = []
  for (const texto of literales(sf)) {
    for (const retirado of TEXTOS_RETIRADOS) {
      if (texto.includes(retirado)) hallazgos.push({ archivo, regla: 'texto-retirado', detalle: retirado })
    }
  }
  return hallazgos
}

function existenciaEnRojo(archivo: string, leer: Leer): Hallazgo[] {
  const funciones = CELDAS_DE_EXISTENCIA[archivo]
  if (funciones === undefined) return []
  return funciones.flatMap((funcion): Hallazgo[] => {
    const nodos = cuerpoConLoQueNombra(archivo, funcion, leer)
    if (nodos === null) return [{ archivo, regla: 'existencia-en-rojo', detalle: `no se encontro ${funcion}` }]
    return nodos.some((n) => literales(n).some((t) => t.includes(ROJO)))
      ? [{ archivo, regla: 'existencia-en-rojo', detalle: funcion }]
      : []
  })
}

function vencimientoEnRojo(archivo: string, leer: Leer): Hallazgo[] {
  if (archivo !== EXPIRY_DATE) return []
  const nodos = cuerpoConLoQueNombra(archivo, 'EXPIRING_CLASS', leer)
  if (nodos === null) return [{ archivo, regla: 'vencimiento-en-rojo', detalle: 'no se encontro EXPIRING_CLASS' }]
  return nodos.some((n) => literales(n).some((t) => t.includes(ROJO)))
    ? [{ archivo, regla: 'vencimiento-en-rojo', detalle: 'EXPIRING_CLASS' }]
    : []
}

function nombraVolver(nodo: ts.Node): boolean {
  return nombra(nodo, BACK_LABEL_SYMBOL) || literales(nodo).some((t) => t.includes(BACK_LABEL))
}

function volverComoEnlace(archivo: string, sf: ts.SourceFile): Hallazgo[] {
  const hallazgos: Hallazgo[] = []
  let conFlecha = false
  recorrer(sf, (n) => {
    const etiqueta = etiquetaJsx(n)
    if (etiqueta === null || !nombraVolver(n)) return
    if (etiqueta === 'Link' || etiqueta === 'a') {
      hallazgos.push({ archivo, regla: 'volver-como-enlace', detalle: `<${etiqueta}>` })
    }
    if (etiqueta === 'ArrowLink') conFlecha = true
  })
  if (archivo === IMPORT_PAGE && !conFlecha) {
    hallazgos.push({ archivo, regla: 'volver-como-enlace', detalle: 'sin ArrowLink' })
  }
  return hallazgos
}

function dentroDeLaCabecera(nodo: ts.Node): boolean {
  for (let n: ts.Node | undefined = nodo.parent; n !== undefined; n = n.parent) {
    if (ts.isJsxAttribute(n) && n.name.getText() === 'actions') {
      const elemento = n.parent.parent
      return etiquetaJsx(elemento) === 'PageHeader' || (ts.isJsxOpeningElement(elemento) && elemento.tagName.getText() === 'PageHeader')
    }
  }
  return false
}

function plantillaFueraDeCabecera(archivo: string, sf: ts.SourceFile): Hallazgo[] {
  const hallazgos: Hallazgo[] = []
  recorrer(sf, (n) => {
    if (etiquetaJsx(n) === 'ImportTemplateButton' && !dentroDeLaCabecera(n)) {
      hallazgos.push({ archivo, regla: 'plantilla-fuera-de-cabecera', detalle: '<ImportTemplateButton>' })
    }
  })
  if (!DUENOS_DE_LA_PLANTILLA.includes(archivo)) {
    if (literales(sf).some((t) => t.includes(TEMPLATE_LABEL)) || nombra(sf, TEMPLATE_LABEL_SYMBOL)) {
      hallazgos.push({ archivo, regla: 'plantilla-fuera-de-cabecera', detalle: TEMPLATE_LABEL })
    }
  }
  return hallazgos
}

function motivoDerivado(archivo: string, sf: ts.SourceFile): Hallazgo[] {
  if (archivo !== MOVEMENT_REASON_LABEL) return []
  const hallazgo = (detalle: string): Hallazgo => ({ archivo, regla: 'motivo-derivado', detalle })
  const funcion = sf.statements.find(
    (s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === 'movementReasonLabel',
  )
  if (funcion?.body === undefined) return [hallazgo('no se encontro movementReasonLabel')]
  const hallazgos: Hallazgo[] = []
  recorrer(funcion.body, (n) => {
    if (ts.isCallExpression(n)) hallazgos.push(hallazgo(`calcula la etiqueta: ${n.getText()}`))
  })
  const mapa = sf.statements
    .flatMap((s) => (ts.isVariableStatement(s) ? [...s.declarationList.declarations] : []))
    .find((d) => d.type !== undefined && MAPA_EXHAUSTIVO.test(d.type.getText()))
  if (mapa?.initializer === undefined || !ts.isObjectLiteralExpression(mapa.initializer)) {
    return [...hallazgos, hallazgo('sin Record<MovementReason, string>')]
  }
  const entradas = new Map<string, string>()
  for (const p of mapa.initializer.properties) {
    if (ts.isPropertyAssignment(p) && ts.isStringLiteral(p.initializer)) {
      entradas.set(p.name.getText().replace(/['"]/g, ''), p.initializer.text)
    }
  }
  for (const [motivo, etiqueta] of Object.entries(MOTIVOS_CON_TILDE)) {
    if (entradas.get(motivo) !== etiqueta) hallazgos.push(hallazgo(`${motivo} no dice «${etiqueta}»`))
  }
  return hallazgos
}

function tactilPropia(archivo: string, sf: ts.SourceFile): Hallazgo[] {
  if (archivo !== BATCH_HISTORY) return []
  return literales(sf).some((t) => t.includes('min-h-11') && t.includes('min-w-11'))
    ? [{ archivo, regla: 'tactil-propia', detalle: 'min-h-11 min-w-11' }]
    : []
}

export function analizar(archivo: string, texto: string, leer: Leer): Hallazgo[] {
  const sf = fuente(archivo, texto)
  return [
    ...textosRetirados(archivo, sf),
    ...existenciaEnRojo(archivo, leer),
    ...vencimientoEnRojo(archivo, leer),
    ...volverComoEnlace(archivo, sf),
    ...plantillaFueraDeCabecera(archivo, sf),
    ...motivoDerivado(archivo, sf),
    ...tactilPropia(archivo, sf),
  ]
}

// ---------------------------------------------------------------------------------------------
// Barrido
// ---------------------------------------------------------------------------------------------

function esProduccion(nombre: string): boolean {
  return /\.tsx?$/.test(nombre) && !/\.test\.tsx?$/.test(nombre) && !nombre.endsWith('.d.ts')
}

function archivosDe(carpeta: string): string[] {
  const salida: string[] = []
  for (const nombre of readdirSync(join(repoRoot, carpeta))) {
    const ruta = posix.join(carpeta, nombre)
    if (statSync(join(repoRoot, ruta)).isDirectory()) salida.push(...archivosDe(ruta))
    else if (esProduccion(nombre)) salida.push(ruta)
  }
  return salida
}

const leerDelRepo: Leer = (archivo) => {
  const ruta = join(repoRoot, archivo)
  return existsSync(ruta) ? readFileSync(ruta, 'utf8') : null
}

/** Un repo de mentira para los casos en negativo: solo los archivos que se le dan. */
function repoDeMentira(archivos: Readonly<Record<string, string>>): Leer {
  return (archivo) => archivos[archivo] ?? null
}

function reglasDe(archivo: string, texto: string, otros: Readonly<Record<string, string>> = {}): Regla[] {
  const leer = repoDeMentira({ ...otros, [archivo]: texto })
  return analizar(archivo, texto, leer).map((h) => h.regla)
}

// ---------------------------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------------------------

const PRODUCT_COLUMNS = `${CARPETA}/components/product-columns.tsx`
const FINISHED_STOCK_COLUMNS = `${CARPETA}/components/finished-stock-columns.tsx`
const CUALQUIERA = `${CARPETA}/components/x.tsx`

const CELDA_AMBAR = `
export const BELOW_ALERT_CLASS = 'font-semibold text-warning-text'
export function stockAmountCell(stock: string) {
  return <span className={BELOW_ALERT_CLASS}>{stock}</span>
}
function BatchRowError() {
  return <p className="text-sm text-destructive">Error</p>
}
`

const MOTIVOS_BIEN = `
const MOVEMENT_REASON_LABELS: Readonly<Record<MovementReason, string>> = {
  merma: 'Merma',
  rotura: 'Rotura',
  conteo_fisico: 'Conteo físico',
  error_de_carga: 'Error de carga',
}
export function movementReasonLabel(reason: MovementReason): string {
  return MOVEMENT_REASON_LABELS[reason]
}
`

const PAGINA_BIEN = `
export default function Page() {
  return (
    <div>
      <ArrowLink direction="back" href="/inventario">{IMPORT_BACK_LABEL}</ArrowLink>
      <PageHeader title="Importar inventario" actions={<ImportTemplateButton />} />
    </div>
  )
}
`

describe('guardia del rediseño de inventario: el detector', () => {
  it('R4, R46 — un texto retirado en un literal o en JSX cuenta; en un comentario, no', () => {
    expect(reglasDe(CUALQUIERA, `const a = 'Elegi un motivo.'`)).toEqual(['texto-retirado'])
    expect(reglasDe(CUALQUIERA, `const a = <p>Mostrando todos los tipos</p>`)).toEqual(['texto-retirado'])
    expect(reglasDe(CUALQUIERA, 'const a = `Filtrando por: ${tipo}`')).toEqual(['texto-retirado'])
    expect(reglasDe(CUALQUIERA, `const a = { conteo_fisico: 'Conteo fisico' }`)).toEqual(['texto-retirado'])
    expect(reglasDe(CUALQUIERA, `// antes decia «Conteo fisico»\nconst a = 'Conteo físico'`)).toEqual([])
  })

  it('R7 — `text-destructive` en el cuerpo de la celda de existencia, o en lo que nombra, cuenta', () => {
    expect(reglasDe(PRODUCT_COLUMNS, CELDA_AMBAR)).toEqual([])
    expect(reglasDe(PRODUCT_COLUMNS, CELDA_AMBAR.replace("'font-semibold text-warning-text'", "'text-destructive'"))).toEqual([
      'existencia-en-rojo',
    ])
    expect(
      reglasDe(PRODUCT_COLUMNS, `export function stockAmountCell() { return <span className="text-destructive" /> }`),
    ).toEqual(['existencia-en-rojo'])
    expect(reglasDe(PRODUCT_COLUMNS, `export function otraCosa() {}`)).toEqual(['existencia-en-rojo'])
  })

  it('R7 — la celda empaquetada sigue lo que importa de un archivo hermano', () => {
    const empaquetada = `
import { BELOW_ALERT_CLASS } from './product-columns'
function packagedStockCell() { return <span className={BELOW_ALERT_CLASS} /> }
`
    const enRojo = `export const BELOW_ALERT_CLASS = 'font-semibold text-destructive'\nexport function stockAmountCell() {}`
    expect(reglasDe(FINISHED_STOCK_COLUMNS, empaquetada, { [PRODUCT_COLUMNS]: CELDA_AMBAR })).toEqual([])
    expect(reglasDe(FINISHED_STOCK_COLUMNS, empaquetada, { [PRODUCT_COLUMNS]: enRojo })).toEqual(['existencia-en-rojo'])
  })

  it('R48 — `EXPIRING_CLASS` con `text-destructive` cuenta; sin la constante, también', () => {
    expect(reglasDe(EXPIRY_DATE, `export const EXPIRING_CLASS = 'font-semibold text-warning-text'`)).toEqual([])
    expect(reglasDe(EXPIRY_DATE, `export const EXPIRING_CLASS = 'font-semibold text-destructive'`)).toEqual([
      'vencimiento-en-rojo',
    ])
    expect(reglasDe(EXPIRY_DATE, `export const OTRA = ''`)).toEqual(['vencimiento-en-rojo'])
  })

  it('R30 — «Volver a inventario» dentro de un `Link` o un `a` cuenta; la página sin `ArrowLink`, también', () => {
    expect(reglasDe(IMPORT_PAGE, PAGINA_BIEN)).toEqual([])
    expect(reglasDe(CUALQUIERA, `const a = <Link href="/inventario">{IMPORT_BACK_LABEL}</Link>`)).toEqual([
      'volver-como-enlace',
    ])
    expect(reglasDe(CUALQUIERA, `const a = <a href="/inventario">Volver a inventario</a>`)).toEqual([
      'volver-como-enlace',
    ])
    expect(reglasDe(IMPORT_PAGE, PAGINA_BIEN.replace(/ArrowLink direction="back"/, 'Link').replace('</ArrowLink>', '</Link>'))).toEqual([
      'volver-como-enlace',
      'volver-como-enlace',
    ])
  })

  it('R30 — «Descargar plantilla» fuera de las `actions` de `PageHeader` o fuera de su botón cuenta', () => {
    expect(reglasDe(CUALQUIERA, `const a = <div><ImportTemplateButton /></div>`)).toEqual(['plantilla-fuera-de-cabecera'])
    expect(reglasDe(CUALQUIERA, `const a = <PageHeader title="x" description={<ImportTemplateButton />} />`)).toEqual([
      'plantilla-fuera-de-cabecera',
    ])
    expect(reglasDe(CUALQUIERA, `const a = <Button>Descargar plantilla</Button>`)).toEqual(['plantilla-fuera-de-cabecera'])
    expect(reglasDe(CUALQUIERA, `const a = <Button>{TEMPLATE_BUTTON_LABEL}</Button>`)).toEqual(['plantilla-fuera-de-cabecera'])
    expect(reglasDe(DUENOS_DE_LA_PLANTILLA[0]!, `export const TEMPLATE_BUTTON_LABEL = 'Descargar plantilla'`)).toEqual([])
  })

  it('R46 — `movementReasonLabel` que deriva la etiqueta del valor, o un mapa sin tildes, cuenta', () => {
    expect(reglasDe(MOVEMENT_REASON_LABEL, MOTIVOS_BIEN)).toEqual([])
    const derivada = `
export function movementReasonLabel(reason: MovementReason): string {
  return reason.charAt(0).toUpperCase() + reason.slice(1).replaceAll('_', ' ')
}
`
    expect(reglasDe(MOVEMENT_REASON_LABEL, derivada)).toContain('motivo-derivado')
    expect(reglasDe(MOVEMENT_REASON_LABEL, MOTIVOS_BIEN.replace("'Error de carga'", "'Error de Carga'"))).toEqual([
      'motivo-derivado',
    ])
    expect(reglasDe(MOVEMENT_REASON_LABEL, MOTIVOS_BIEN.replace('Record<MovementReason, string>', 'Partial<Record<MovementReason, string>>'))).toEqual([
      'motivo-derivado',
    ])
  })

  it('R46 — `batch-history.tsx` con su propio par táctil cuenta', () => {
    expect(reglasDe(BATCH_HISTORY, `const TOUCH_TARGET = 'min-h-11 min-w-11'`)).toEqual(['tactil-propia'])
    expect(reglasDe(BATCH_HISTORY, `const a = <Button touch />`)).toEqual([])
  })
})

describe('guardia del rediseño de inventario: el barrido', () => {
  it('R4, R7, R30, R46, R48 — el código de producción de /inventario no tiene ningún hallazgo', () => {
    const archivos = archivosDe(CARPETA)
    expect(archivos.length).toBeGreaterThanOrEqual(ARCHIVOS_MINIMOS)
    for (const vigilado of [
      ...Object.keys(CELDAS_DE_EXISTENCIA),
      EXPIRY_DATE,
      IMPORT_PAGE,
      MOVEMENT_REASON_LABEL,
      BATCH_HISTORY,
      ...DUENOS_DE_LA_PLANTILLA,
    ]) {
      expect(archivos, `${vigilado} no esta en el barrido`).toContain(vigilado)
    }

    const hallazgos = archivos.flatMap((archivo) => analizar(archivo, leerDelRepo(archivo) ?? '', leerDelRepo))
    expect(hallazgos.map((h) => `${h.archivo} [${h.regla}] ${h.detalle}`)).toEqual([])
  })

  it('R7 — el error de la sub-fila de lotes conserva su rojo y la regla no lo ve', () => {
    const texto = leerDelRepo(PRODUCT_COLUMNS) ?? ''
    expect(texto).toContain('product-batches-row-error-message')
    expect(texto).toContain(ROJO)
    expect(analizar(PRODUCT_COLUMNS, texto, leerDelRepo)).toEqual([])
  })
})
