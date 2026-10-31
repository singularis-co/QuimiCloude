// GUARDIA — el ambito de empresa de `integraciones`, comprobado FUNCION POR FUNCION.
//
// Calcada de `guard-ambito-empresa-clientes.test.ts`, y por el mismo motivo: el puerto exige
// `scope: IntegracionesScope` en cada firma, asi que una LLAMADA que lo omita no compila; pero una
// IMPLEMENTACION que lo omita SI compila, porque TypeScript acepta una funcion de menor aridad donde
// se espera una de mayor. Un `findFirst` sin ambito se cablea y lee las conexiones de TODAS las
// empresas, con sus secretos cifrados.
//
// De cada funcion de persistencia del modulo comprueba las dos mitades: que DECLARA el ambito y que
// ese valor LLEGA hasta una envoltura de `./company-scope`. Dos excepciones con nombre, cada una con
// su forma fijada aqui mismo: el resolutor de empresa del webhook (QC-238 P1, design.md > 5.1) y,
// desde el 2026-10-20 (QC-239, decision del humano), la funcion que solo abre la transaccion de los
// contactos, con la forma estricta de `order-unit-of-work-prisma.ts` (QC-141 D21).
//
// Como en la de `clientes`, el puerto se ata a su adaptador LEYENDO `lib/composition`: lo que se
// comprueba es la funcion que de verdad se cablea, no una tabla escrita aqui. Un puerto que vive
// dentro de una transaccion se ata en su propia fabrica `create…(db)` del adaptador: ahi se lee su
// cableado, y cada miembro tiene que delegar en una funcion con nombre que recibe `db` y el ambito.
//
// TECNICA: barrido de TEXTO sobre el disco, como el resto de `tests/guards/`.

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

function findRepoRoot(startDir: string): string {
  let dir = startDir
  for (let i = 0; i < 10; i += 1) {
    try {
      readFileSync(join(dir, 'package.json'), 'utf8')
      return dir
    } catch {
      dir = dirname(dir)
    }
  }
  throw new Error('no se encontro la raiz del repo')
}

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)))
const MODULE_ROOT = join(repoRoot, 'lib', 'modules', 'integraciones')
const PERSISTENCE_ROOT = join(MODULE_ROOT, 'adapters', 'driven', 'persistence')

const PUNTO_UNICO = 'company-scope.ts'
const ADAPTADOR = 'whatsapp-connection-prisma.ts'
const ADAPTADOR_INBOX = 'whatsapp-inbox-prisma.ts'
const ADAPTADOR_CONTACTOS = 'whatsapp-contact-prisma.ts'
const ADAPTADOR_PLANTILLAS = 'whatsapp-template-prisma.ts'
const ADAPTADOR_VARIABLES = 'whatsapp-variable-key-prisma.ts'
const ADAPTADOR_SALIDA = 'whatsapp-outbox-prisma.ts'

const FORMA_DE_AMBITO = {
  identificador: 'scope',
  declaracion: /\bscope\s*:\s*IntegracionesScope\b/,
} as const
const LITERAL = 'scope: IntegracionesScope'

type PuertoVigilado = {
  readonly nombre: string
  readonly ruta: string
  readonly constante: string
  readonly metodosEsperados: number
  readonly adaptador: string
  /** Funciones del adaptador que tocan la base sin estar cableadas: ayudantes privados, vigilados igual. */
  readonly ayudantes: readonly string[]
  /** Si existe, el cableado se lee de esta fabrica del adaptador y no de `lib/composition`. */
  readonly fabrica?: string
  /** El unico parametro de la fabrica, que cada miembro reenvia primero. Sin el, `db: PrismaLike`. */
  readonly parametroDeFabrica?: ParametroDeFabrica
}

type ParametroDeFabrica = { readonly nombre: string; readonly tipo: string }

const PARAMETRO_DB: ParametroDeFabrica = { nombre: 'db', tipo: 'PrismaLike(?:\\s*=\\s*prisma)?' }

const PUERTO: PuertoVigilado = {
  nombre: 'WhatsappConnectionRepository',
  ruta: join(MODULE_ROOT, 'ports', 'whatsapp-connection-repository.ts'),
  constante: 'whatsappConnectionRepository',
  metodosEsperados: 5,
  adaptador: ADAPTADOR,
  ayudantes: [],
}

const PUERTO_INBOX: PuertoVigilado = {
  nombre: 'WhatsappInboxRepository',
  ruta: join(MODULE_ROOT, 'ports', 'whatsapp-inbox-repository.ts'),
  constante: 'whatsappInboxRepository',
  metodosEsperados: 1,
  adaptador: ADAPTADOR_INBOX,
  ayudantes: ['applyStatus', 'findBlockedWaIds', 'upsertContact'],
  fabrica: 'createWhatsappInboxRecorder',
  parametroDeFabrica: { nombre: 'deps', tipo: 'WhatsappInboxRecorderDeps' },
}

const PUERTO_CONTACTOS: PuertoVigilado = {
  nombre: 'WhatsappContactRepository',
  ruta: join(MODULE_ROOT, 'ports', 'whatsapp-contact-repository.ts'),
  constante: 'whatsappContactRepository',
  metodosEsperados: 6,
  adaptador: ADAPTADOR_CONTACTOS,
  ayudantes: [],
  fabrica: 'createWhatsappContactRepository',
}

const PUERTO_PLANTILLAS: PuertoVigilado = {
  nombre: 'WhatsappTemplateRepository',
  ruta: join(MODULE_ROOT, 'ports', 'whatsapp-template-repository.ts'),
  constante: 'whatsappTemplateRepository',
  metodosEsperados: 10,
  adaptador: ADAPTADOR_PLANTILLAS,
  ayudantes: ['variablesByTemplate', 'lockIfUnchanged'],
}

const PUERTO_VARIABLES: PuertoVigilado = {
  nombre: 'WhatsappVariableKeyRepository',
  ruta: join(MODULE_ROOT, 'ports', 'whatsapp-variable-key-repository.ts'),
  constante: 'whatsappVariableKeyRepository',
  metodosEsperados: 6,
  adaptador: ADAPTADOR_VARIABLES,
  ayudantes: ['liveUsage', 'lockedKey'],
}

// 2026-10-23, QC-240: el repositorio de salida de un envio (contactos y mensajes salientes). Se
// cablea en su propia fabrica `create…(db)`, como el de contactos, y entra en el barrido sin exencion.
const PUERTO_SALIDA: PuertoVigilado = {
  nombre: 'WhatsappOutboxRepository',
  ruta: join(MODULE_ROOT, 'ports', 'whatsapp-outbox-repository.ts'),
  constante: 'whatsappOutboxRepository',
  metodosEsperados: 9,
  adaptador: ADAPTADOR_SALIDA,
  ayudantes: [],
  fabrica: 'createWhatsappOutboxRepository',
}

// 2026-10-23, QC-245: las lecturas de conversaciones y la marca de lectura. Se lee en su fabrica
// `create…(db)` (la composicion la cablea despues) y entra en el barrido sin exencion.
const ADAPTADOR_CONVERSACIONES = 'whatsapp-conversation-prisma.ts'
const PUERTO_CONVERSACIONES: PuertoVigilado = {
  nombre: 'WhatsappConversationRepository',
  ruta: join(MODULE_ROOT, 'ports', 'whatsapp-conversation-repository.ts'),
  constante: 'whatsappConversationRepository',
  metodosEsperados: 8,
  adaptador: ADAPTADOR_CONVERSACIONES,
  ayudantes: [],
  fabrica: 'createWhatsappConversationRepository',
}

const PUERTOS: readonly PuertoVigilado[] = [
  PUERTO,
  PUERTO_INBOX,
  PUERTO_CONTACTOS,
  PUERTO_PLANTILLAS,
  PUERTO_VARIABLES,
  PUERTO_SALIDA,
  PUERTO_CONVERSACIONES,
]

/**
 * Archivos exentos por NOMBRE del barrido de ambito, como en la guardia de `pedidos`. Cada entrada la
 * aprobo un humano en un spec, y ninguna es un cheque en blanco: su forma fija lo unico que ese
 * archivo puede hacer.
 *
 * - El resolutor de empresa del webhook (QC-238 P1, R32): la URL solo trae el id de la conexion y
 *   hasta saber su empresa no hay ambito con que filtrar. Forma: `formaDeLaExencion`.
 * - La transaccion de los contactos (QC-239, decision del humano del 2026-10-20): solo abre
 *   `prisma.$transaction` y la reintenta una vez; las consultas las hacen, con su ambito, los
 *   repositorios que la composicion construye sobre su `tx`. Forma: `formaDeLaTransaccion`.
 */
const EXENTOS_DEL_AMBITO: ReadonlyMap<string, string> = new Map([
  [
    'whatsapp-webhook-directory-prisma.ts',
    'resuelve la empresa de la conexion de la URL del webhook y devuelve solo su companyId de una ' +
      'fila viva; la fila se lee despues con su ambito. Excepcion aprobada por el humano en QC-238, ' +
      'decision P1 (design.md > 5.1, R32)',
  ],
  [
    'whatsapp-contact-unit-of-work-prisma.ts',
    'solo abre la transaccion de vincular y desvincular (prisma.$transaction) y la reintenta una vez; ' +
      'no lee ni escribe tablas. Excepcion aprobada por el humano en QC-239 (2026-10-20), con la forma ' +
      'de QC-141 D21',
  ],
])

/** La unica funcion que el exento de la transaccion de los contactos puede declarar. */
const FUNCION_TRANSACCION_EXENTA = 'withWhatsappContactTransaction'

/** Lo unico que el resolutor exento puede ser: su funcion, su consulta, su `select` y su `where`. */
const FORMA_EXENTA = {
  funcion: 'companyOfWhatsappConnection',
  acceso: /^prisma\s*\.\s*whatsappConnection\s*\.\s*findFirst\s*\($/,
  select: '{companyId:true}',
  where: /\bdeletedAt\s*:\s*null\b/,
  puerto: { constante: 'whatsappWebhookDirectory', nombre: 'WhatsappWebhookDirectory', metodo: 'companyOfConnection' },
} as const

// --- Lectura y troceado del texto -------------------------------------------------------------

function sinComentarios(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (match) => ' '.repeat(match.length))
}

function vaciarCadenas(source: string): string {
  const vaciar = (match: string): string =>
    match.charAt(0) + match.slice(1, -1).replace(/[^\n]/g, ' ') + match.charAt(match.length - 1)
  return source
    .replace(/'(?:\\.|[^'\\\n])*'/g, vaciar)
    .replace(/"(?:\\.|[^"\\\n])*"/g, vaciar)
    .replace(/`(?:\\.|[^`\\])*`/g, vaciar)
}

function cierreEquilibrado(source: string, open: number, abre: string, cierra: string): number {
  let nivel = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === abre) nivel += 1
    else if (source[i] === cierra) {
      nivel -= 1
      if (nivel === 0) return i
    }
  }
  return -1
}

type FuncionDeclarada = {
  readonly nombre: string
  readonly parametros: string
  readonly cuerpo: string
  readonly inicio: number
  readonly fin: number
}

/** La primera llave que termina la linea despues de los parametros: la del cuerpo, no la de un tipo. */
function inicioDelCuerpo(codigo: string, desde: number): number {
  for (let i = desde; i < codigo.length; i += 1) {
    if (codigo[i] !== '{') continue
    if (/^[ \t]*\r?\n/.test(codigo.slice(i + 1))) return i
  }
  return -1
}

function funcionesDe(codigo: string): readonly FuncionDeclarada[] {
  const declaraciones = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm
  const funciones: FuncionDeclarada[] = []

  for (const match of codigo.matchAll(declaraciones)) {
    const abreParams = codigo.indexOf('(', match.index)
    const cierraParams = cierreEquilibrado(codigo, abreParams, '(', ')')
    if (cierraParams === -1) continue
    const abreCuerpo = inicioDelCuerpo(codigo, cierraParams)
    const cierraCuerpo = cierreEquilibrado(codigo, abreCuerpo, '{', '}')
    if (abreCuerpo === -1 || cierraCuerpo === -1) continue

    funciones.push({
      nombre: match[1] ?? '',
      parametros: codigo.slice(abreParams + 1, cierraParams),
      cuerpo: codigo.slice(abreCuerpo + 1, cierraCuerpo),
      inicio: match.index,
      fin: cierraCuerpo,
    })
  }

  return funciones
}

function declaraElAmbito(funcion: FuncionDeclarada): boolean {
  return FORMA_DE_AMBITO.declaracion.test(funcion.parametros)
}

/** ¿Alguna llamada a `nombre` en `cuerpo` recibe el ambito, directo o por una variable local? */
function lePasaElAmbito(cuerpo: string, nombre: string): boolean {
  const llamada = new RegExp(`\\b${nombre}\\s*\\(`, 'g')
  const valor = new RegExp(`\\b${FORMA_DE_AMBITO.identificador}\\b`)

  const variablesConAmbito = new Set<string>()
  for (const m of cuerpo.matchAll(/\b(?:const|let)\s+(\w+)\s*(?::[^=]+)?=\s*([^;]+);/g)) {
    if (valor.test(m[2] ?? '')) variablesConAmbito.add(m[1] ?? '')
  }

  for (const match of cuerpo.matchAll(llamada)) {
    const abre = cuerpo.indexOf('(', match.index)
    const cierra = cierreEquilibrado(cuerpo, abre, '(', ')')
    if (cierra === -1) continue
    const argumentos = cuerpo.slice(abre + 1, cierra)
    if (valor.test(argumentos)) return true
    for (const variable of variablesConAmbito) {
      if (new RegExp(`\\b${variable}\\b`).test(argumentos)) return true
    }
  }
  return false
}

function envolturasImportadas(source: string): readonly string[] {
  const importacion = /import\s*\{([^}]*)\}\s*from\s*'\.\/company-scope'/.exec(source)
  if (importacion === null) return []
  return (importacion[1] ?? '')
    .split(',')
    .map((nombre) => nombre.trim())
    .filter((nombre) => nombre.length > 0)
}

// El acento grave cubre `prisma.$queryRaw` usado como plantilla etiquetada, sin parentesis.
const TOCA_LA_BASE = /\b(?:prisma|tx|db)\s*\.\s*(?:\$\w+|\w+\s*\.\s*\w+)\s*[(<`]/g
const tocaLaBase = (cuerpo: string): boolean => new RegExp(TOCA_LA_BASE.source).test(cuerpo)

const LECTURA_SUELTA: readonly RegExp[] = [
  /\bscope\s*\??\.\s*companyId\b/,
  /\bscope\s*\[/,
  /\{[^{}]*\bcompanyId\b[^{}]*\}\s*=\s*scope\b/,
]

type ArchivoAnalizado = {
  readonly codigo: string
  readonly funciones: readonly FuncionDeclarada[]
  readonly envolturas: readonly string[]
  readonly consumidoras: ReadonlySet<string>
}

/** Trabaja sobre el TEXTO para que los casos de sensibilidad puedan darle un fuente sintetico. */
function analizarFuente(source: string): ArchivoAnalizado {
  const codigo = vaciarCadenas(sinComentarios(source))
  const funciones = funcionesDe(codigo)
  const envolturas = envolturasImportadas(source)

  const consumidoras = new Set<string>(envolturas)
  let crecio = true
  while (crecio) {
    crecio = false
    for (const funcion of funciones) {
      if (consumidoras.has(funcion.nombre)) continue
      if (!declaraElAmbito(funcion)) continue
      for (const consumidora of consumidoras) {
        if (lePasaElAmbito(funcion.cuerpo, consumidora)) {
          consumidoras.add(funcion.nombre)
          crecio = true
          break
        }
      }
    }
  }

  return { codigo, funciones, envolturas, consumidoras }
}

function analizar(archivo: string): ArchivoAnalizado {
  return analizarFuente(readFileSync(join(PERSISTENCE_ROOT, archivo), 'utf8'))
}

/** Los hallazgos de un archivo de persistencia: lo que la guardia rechaza, en una lista. */
function hallazgosDe(nombre: string, analizado: ArchivoAnalizado, esPuntoUnico: boolean): readonly string[] {
  const hallazgos: string[] = []

  for (const match of analizado.codigo.matchAll(TOCA_LA_BASE)) {
    const dentro = analizado.funciones.some((f) => match.index > f.inicio && match.index < f.fin)
    if (!dentro) {
      const linea = analizado.codigo.slice(0, match.index).split('\n').length
      hallazgos.push(`${nombre}:${String(linea)} consulta fuera de una \`function\` declarada`)
    }
  }

  for (const funcion of analizado.funciones) {
    if (!tocaLaBase(funcion.cuerpo)) continue
    if (!declaraElAmbito(funcion)) {
      hallazgos.push(`${nombre}:${funcion.nombre} consulta la base sin declarar \`${LITERAL}\``)
    } else if (!analizado.consumidoras.has(funcion.nombre)) {
      hallazgos.push(`${nombre}:${funcion.nombre} declara el ambito pero no lo lleva a \`./company-scope\``)
    }
  }

  if (!esPuntoUnico) {
    for (const patron of LECTURA_SUELTA) {
      const match = patron.exec(analizado.codigo)
      if (match !== null) {
        const linea = analizado.codigo.slice(0, match.index).split('\n').length
        hallazgos.push(`${nombre}:${String(linea)} lee la empresa del ambito a mano`)
      }
    }
  }

  return hallazgos
}

/** El texto del objeto que sigue a `clave:` dentro de `argumentos`, o `null` si no esta. */
function objetoDeLaClave(argumentos: string, clave: string): string | null {
  const match = new RegExp(`\\b${clave}\\s*:\\s*\\{`).exec(argumentos)
  if (match === null) return null
  const abre = argumentos.indexOf('{', match.index)
  const cierra = cierreEquilibrado(argumentos, abre, '{', '}')
  return cierra === -1 ? null : argumentos.slice(abre, cierra + 1)
}

/** Los hallazgos de un archivo EXENTO: todo lo que se sale de la forma aprobada en design.md > 5.1. */
function formaDeLaExencion(nombre: string, analizado: ArchivoAnalizado): readonly string[] {
  const hallazgos: string[] = []

  const nombres = analizado.funciones.map((f) => f.nombre)
  if (nombres.length !== 1 || nombres[0] !== FORMA_EXENTA.funcion) {
    hallazgos.push(
      `${nombre}: tiene que declarar exactamente una funcion, \`${FORMA_EXENTA.funcion}\`; declara [${nombres.join(', ')}]`,
    )
  }

  const accesos = [...analizado.codigo.matchAll(TOCA_LA_BASE)]
  if (accesos.length !== 1) {
    hallazgos.push(`${nombre}: tiene que tocar la base exactamente una vez; lo hace ${String(accesos.length)} veces`)
  }
  if (/\$(?:queryRaw|executeRaw|queryRawUnsafe|executeRawUnsafe|transaction)\b/.test(analizado.codigo)) {
    hallazgos.push(`${nombre}: no puede abrir SQL crudo ni transacciones`)
  }
  if (/\bprisma\s+as\b/.test(analizado.codigo)) {
    hallazgos.push(`${nombre}: importa \`prisma\` con un alias que la guardia no ve`)
  }

  const acceso = accesos[0]
  if (acceso !== undefined) {
    if (!FORMA_EXENTA.acceso.test(acceso[0])) {
      hallazgos.push(`${nombre}: su unico acceso tiene que ser \`prisma.whatsappConnection.findFirst\`; es \`${acceso[0]}\``)
    }
    const abre = analizado.codigo.indexOf('(', acceso.index)
    const argumentos = analizado.codigo.slice(abre + 1, cierreEquilibrado(analizado.codigo, abre, '(', ')'))
    const select = objetoDeLaClave(argumentos, 'select')
    const normalizado = (select ?? '').replace(/\s+/g, '').replace(/,\}$/, '}')
    if (normalizado !== FORMA_EXENTA.select) {
      hallazgos.push(`${nombre}: su \`select\` tiene que ser exactamente \`{ companyId: true }\`; es \`${select ?? 'nada'}\``)
    }
    const where = objetoDeLaClave(argumentos, 'where')
    if (where === null || !FORMA_EXENTA.where.test(where)) {
      hallazgos.push(`${nombre}: su \`where\` tiene que llevar \`deletedAt: null\` (solo filas vivas)`)
    }
  }

  return hallazgos
}

/**
 * La forma estricta de `order-unit-of-work-prisma.ts` (QC-141 D21): una sola funcion con su nombre,
 * todo `prisma.` es `prisma.$transaction`, ningun `tx.<algo>` (ni `db.<algo>`), sin SQL crudo y sin
 * alias de `prisma`. Trabaja sobre el codigo ya vaciado de comentarios y cadenas.
 */
function formaDeLaTransaccion(nombre: string, analizado: ArchivoAnalizado): readonly string[] {
  const hallazgos: string[] = []

  // Toda declaracion `function`, a cualquier nivel y con genericos: el troceador general no ve
  // `function f<T>(`, y aqui no puede escaparse ninguna.
  const nombres = [...analizado.codigo.matchAll(/\bfunction\s*\*?\s*(\w+)/g)].map((m) => m[1] ?? '')
  if (nombres.length !== 1 || nombres[0] !== FUNCION_TRANSACCION_EXENTA) {
    hallazgos.push(
      `${nombre}: tiene que declarar exactamente una funcion, \`${FUNCION_TRANSACCION_EXENTA}\`; declara [${nombres.join(', ')}]`,
    )
  }
  const prismaSuelto = (analizado.codigo.match(/\bprisma\s*\.\s*\$?\w+/g) ?? []).filter(
    (acceso) => !/^prisma\s*\.\s*\$transaction\b/.test(acceso.replace(/\s+/g, ' ')),
  )
  for (const acceso of prismaSuelto) {
    hallazgos.push(`${nombre}: \`${acceso}\` no es \`prisma.$transaction\`: el exento no consulta ninguna tabla`)
  }
  for (const acceso of analizado.codigo.match(/\b(?:tx|db)\s*\.\s*\$?\w+/g) ?? []) {
    hallazgos.push(`${nombre}: \`${acceso}\` consulta por la transaccion; el exento solo la abre y reenvia \`run\``)
  }
  if (/\$(?:queryRaw|executeRaw)\w*/.test(analizado.codigo)) {
    hallazgos.push(`${nombre}: no puede ejecutar SQL crudo`)
  }
  // Las cadenas ya estan vaciadas: un import de namespace no deja ver de que modulo es, asi que en
  // el exento no se admite ninguno.
  if (/\bprisma\s+as\b/.test(analizado.codigo) || /\bimport\s*\*\s*as\s+\w+/.test(analizado.codigo)) {
    hallazgos.push(`${nombre}: importa \`prisma\` con un alias que la guardia no ve`)
  }

  return hallazgos
}

/** Un archivo exento por NOMBRE pasa por SU forma; cualquier otro, por la regla general. */
function hallazgosDelArchivo(nombre: string, analizado: ArchivoAnalizado): readonly string[] {
  if (nombre === 'whatsapp-contact-unit-of-work-prisma.ts' && EXENTOS_DEL_AMBITO.has(nombre)) {
    return formaDeLaTransaccion(nombre, analizado)
  }
  if (EXENTOS_DEL_AMBITO.has(nombre)) return formaDeLaExencion(nombre, analizado)
  return hallazgosDe(nombre, analizado, nombre === PUNTO_UNICO)
}

function metodosDeLaInterfaz(ruta: string, interfaz: string): ReadonlyMap<string, string> {
  const source = vaciarCadenas(sinComentarios(readFileSync(ruta, 'utf8')))
  const inicio = source.indexOf(`export interface ${interfaz} {`)
  expect(inicio, `no se encontro la interfaz ${interfaz} en ${ruta}`).toBeGreaterThan(-1)
  const abre = source.indexOf('{', inicio)
  const cuerpo = source.slice(abre + 1, cierreEquilibrado(source, abre, '{', '}'))

  const metodos = new Map<string, string>()
  for (const match of cuerpo.matchAll(/^\s{2}(\w+)\s*\(/gm)) {
    const abreM = cuerpo.indexOf('(', match.index)
    metodos.set(match[1] ?? '', cuerpo.slice(abreM + 1, cierreEquilibrado(cuerpo, abreM, '(', ')')))
  }
  return metodos
}

/** Trocea un texto por sus comas de NIVEL CERO (fuera de parentesis, llaves y corchetes). */
function porComasDeNivelCero(texto: string): readonly string[] {
  const trozos: string[] = []
  let nivel = 0
  let actual = ''
  for (const caracter of texto) {
    if ('({['.includes(caracter)) nivel += 1
    if (')}]'.includes(caracter)) nivel -= 1
    if (caracter === ',' && nivel === 0) {
      trozos.push(actual)
      actual = ''
      continue
    }
    actual += caracter
  }
  trozos.push(actual)
  return trozos.map((trozo) => trozo.trim()).filter((trozo) => trozo.length > 0)
}

/** El objeto que un fuente ata al puerto: `{ metodoDelPuerto -> funcionDelAdaptador }`, o `null`. */
function cableadoEnFuente(
  fuente: string,
  constante: string,
  interfaz: string,
): ReadonlyMap<string, string> | null {
  const source = vaciarCadenas(sinComentarios(fuente))
  const inicio = source.indexOf(`const ${constante}: ${interfaz} = {`)
  if (inicio === -1) return null
  const abre = source.indexOf('{', inicio)
  const cuerpo = source.slice(abre + 1, cierreEquilibrado(source, abre, '{', '}'))

  const cableado = new Map<string, string>()
  for (const entrada of porComasDeNivelCero(cuerpo)) {
    const conNombre = /^(\w+)\s*:\s*(\w+)$/.exec(entrada)
    if (conNombre !== null) {
      cableado.set(conNombre[1] ?? '', conNombre[2] ?? '')
      continue
    }
    const abreviado = /^(\w+)$/.exec(entrada)
    if (abreviado !== null) {
      cableado.set(abreviado[1] ?? '', abreviado[1] ?? '')
      continue
    }
    cableado.set(entrada, '')
  }
  return cableado
}

function cableadoDe(constante: string, interfaz: string): ReadonlyMap<string, string> {
  const fuente = readFileSync(join(repoRoot, 'lib', 'composition', 'index.ts'), 'utf8')
  const cableado = cableadoEnFuente(fuente, constante, interfaz)
  expect(cableado, `lib/composition no ata ${constante}: ${interfaz}`).not.toBeNull()
  return cableado ?? new Map<string, string>()
}

/**
 * El objeto que devuelve la fabrica `fabrica(db: PrismaLike [= prisma]): interfaz` del fuente (o la
 * de otro parametro unico, como `deps: WhatsappInboxRecorderDeps`): `{ metodo -> funcion }`. Solo
 * cuenta un miembro `metodo: (a, b) => funcion(db, a, b)`, con ese parametro primero y los demas
 * reenviados tal cual y en orden; cualquier otra forma queda con un valor que no es un nombre.
 * `null` si la fabrica no esta, no tiene esa firma o no devuelve un objeto.
 */
function cableadoEnFabrica(
  fuente: string,
  fabrica: string,
  interfaz: string,
  parametro: ParametroDeFabrica = PARAMETRO_DB,
): ReadonlyMap<string, string> | null {
  const source = vaciarCadenas(sinComentarios(fuente))
  const firma = new RegExp(
    `^export\\s+function\\s+${fabrica}\\s*\\(\\s*${parametro.nombre}\\s*:\\s*${parametro.tipo}\\s*\\)\\s*:\\s*${interfaz}\\s*\\{`,
    'm',
  ).exec(source)
  if (firma === null) return null
  const abreCuerpo = firma.index + firma[0].length - 1
  const cuerpo = source.slice(abreCuerpo + 1, cierreEquilibrado(source, abreCuerpo, '{', '}')).trim()
  if (!/^return\s*\{/.test(cuerpo)) return null
  const abre = cuerpo.indexOf('{')
  const cierra = cierreEquilibrado(cuerpo, abre, '{', '}')
  if (!/^\s*;?\s*$/.test(cuerpo.slice(cierra + 1))) return null
  const objeto = cuerpo.slice(abre + 1, cierra)

  const cableado = new Map<string, string>()
  for (const entrada of porComasDeNivelCero(objeto)) {
    const delegada = /^(\w+)\s*:\s*\(([^()]*)\)\s*=>\s*(\w+)\s*\(([^()]*)\)$/.exec(entrada)
    if (delegada === null) {
      cableado.set(/^(\w+)\s*:/.exec(entrada)?.[1] ?? entrada, '')
      continue
    }
    const parametros = porComasDeNivelCero(delegada[2] ?? '')
    const argumentos = porComasDeNivelCero(delegada[4] ?? '')
    const reenvia = argumentos.join(',') === [parametro.nombre, ...parametros].join(',')
    const funcion = delegada[3] ?? ''
    cableado.set(delegada[1] ?? '', reenvia ? funcion : `${funcion}(${argumentos.join(', ')})`)
  }
  return cableado
}

function cableadoDelPuerto(puerto: PuertoVigilado): ReadonlyMap<string, string> {
  if (puerto.fabrica === undefined) return cableadoDe(puerto.constante, puerto.nombre)
  const fuente = readFileSync(join(PERSISTENCE_ROOT, puerto.adaptador), 'utf8')
  const parametro = puerto.parametroDeFabrica ?? PARAMETRO_DB
  const cableado = cableadoEnFabrica(fuente, puerto.fabrica, puerto.nombre, parametro)
  expect(
    cableado,
    `${puerto.adaptador} no declara \`export function ${puerto.fabrica}(${parametro.nombre}: ...): ${puerto.nombre}\` que devuelva un objeto`,
  ).not.toBeNull()
  return cableado ?? new Map<string, string>()
}

// --- Casos -------------------------------------------------------------------------------------

describe('R2 — el punto unico de integraciones es de verdad UNA definicion', () => {
  it('company-scope.ts: `companyScope` es privada, es la unica lectura del ambito y las siete envolturas delegan en ella', () => {
    const analizado = analizar(PUNTO_UNICO)
    const exportadas = analizado.funciones.filter((f) =>
      new RegExp(`^export\\s+function\\s+${f.nombre}\\b`, 'm').test(analizado.codigo),
    )
    expect(exportadas.map((f) => f.nombre).sort()).toEqual([
      'companyScopeColumns',
      'whatsappConnectionCompanyScope',
      'whatsappContactCompanyScope',
      'whatsappMessageCompanyScope',
      'whatsappTemplateCompanyScope',
      'whatsappTemplateVariableCompanyScope',
      'whatsappVariableKeyCompanyScope',
    ])

    for (const envoltura of exportadas) {
      expect(
        envoltura.cuerpo.trim(),
        `${envoltura.nombre} tiene que delegar en \`companyScope\` y en nada mas`,
      ).toMatch(/^return\s+companyScope\s*\(\s*scope\s*\)\s*;?$/)
    }

    const privada = analizado.funciones.find((f) => f.nombre === 'companyScope')
    expect(privada, 'company-scope.ts tiene que declarar la funcion `companyScope`').toBeTruthy()
    expect(analizado.codigo).not.toMatch(/export\s+function\s+companyScope\b/)

    const lecturas = [...analizado.codigo.matchAll(/\bscope\s*\.\s*companyId\b/g)]
    expect(lecturas, 'el punto unico lee `scope.companyId` una sola vez').toHaveLength(1)
    const posicion = lecturas[0]?.index ?? -1
    expect(privada !== undefined && posicion > privada.inicio && posicion < privada.fin).toBe(true)
  })
})

describe.each(PUERTOS)('R2 — cada metodo de $nombre declara Y consume el ambito de empresa', (PUERTO) => {
  const ADAPTADOR = PUERTO.adaptador
  const metodos = metodosDeLaInterfaz(PUERTO.ruta, PUERTO.nombre)
  const cableado = cableadoDelPuerto(PUERTO)
  const adaptador = analizar(ADAPTADOR)
  const dondeSeCablea = PUERTO.fabrica === undefined ? 'lib/composition' : `su fabrica ${PUERTO.fabrica}`

  it(`${PUERTO.nombre}: los ${String(PUERTO.metodosEsperados)} metodos estan cableados en ${dondeSeCablea}, con nombre, y ninguno se queda fuera`, () => {
    expect(metodos.size).toBe(PUERTO.metodosEsperados)
    expect([...cableado.keys()].sort()).toEqual([...metodos.keys()].sort())
    for (const [metodo, implementacion] of cableado) {
      expect(
        implementacion,
        `${PUERTO.constante}.${metodo} no esta cableado a una funcion con nombre del adaptador: la guardia no puede seguir una lambda con cuerpo, un bind, un spread ni un reenvio que no pase \`db\` y todos sus parametros`,
      ).toMatch(/^\w+$/)
    }
  })

  it(`${PUERTO.nombre}: el propio puerto EXIGE \`${LITERAL}\` en cada firma, y no opcional`, () => {
    for (const [metodo, parametros] of metodos) {
      expect(FORMA_DE_AMBITO.declaracion.test(parametros), `${metodo} ya no exige \`${LITERAL}\``).toBe(true)
      expect(
        /\bscope\s*\?\s*:/.test(parametros) || /\bscope\s*:[^,)]*=/.test(parametros),
        `${metodo} declara el ambito opcional`,
      ).toBe(false)
    }
  })

  for (const metodo of metodos.keys()) {
    it(`${PUERTO.nombre}.${metodo} declara \`${LITERAL}\` y lo lleva hasta el punto unico`, () => {
      const implementacion = cableado.get(metodo)
      expect(implementacion, `${metodo} no esta cableado en lib/composition`).toBeTruthy()
      const funcion = adaptador.funciones.find((f) => f.nombre === implementacion)
      expect(funcion, `${ADAPTADOR} no declara ${implementacion ?? '?'} que cablea ${metodo}`).toBeTruthy()
      if (funcion === undefined) return
      expect(new RegExp(`^export\\s+async\\s+function\\s+${funcion.nombre}\\b`, 'm').test(adaptador.codigo)).toBe(true)
      expect(declaraElAmbito(funcion), `${funcion.nombre} no declara \`${LITERAL}\``).toBe(true)
      expect(adaptador.consumidoras.has(funcion.nombre), `${funcion.nombre} no lleva el ambito a ./company-scope`).toBe(true)
    })
  }
})

describe('R2 — las escrituras sobre una conexion existente llevan el ambito en el `where` de cada `updateMany`', () => {
  const cableado = cableadoDe(PUERTO.constante, PUERTO.nombre)
  const adaptador = analizar(ADAPTADOR)

  it.each([
    ['update', 1],
    ['recordWebhookHandshake', 2],
  ] as const)('%s: sus %i `updateMany` llevan `whatsappConnectionCompanyScope(scope)` y `deletedAt: null`', (metodo, esperadas) => {
    const funcion = adaptador.funciones.find((f) => f.nombre === cableado.get(metodo))
    expect(funcion).toBeTruthy()
    const cuerpo = funcion?.cuerpo ?? ''
    const llamadas = [...cuerpo.matchAll(/\bprisma\s*\.\s*whatsappConnection\s*\.\s*updateMany\s*\(/g)]
    expect(llamadas, 'la actualizacion tiene que ser un `updateMany` acotado').toHaveLength(esperadas)
    for (const llamada of llamadas) {
      const abre = cuerpo.indexOf('(', llamada.index)
      const argumentos = cuerpo.slice(abre + 1, cierreEquilibrado(cuerpo, abre, '(', ')'))
      expect(/\bwhatsappConnectionCompanyScope\s*\(\s*scope\s*\)/.test(argumentos)).toBe(true)
      expect(/\bdeletedAt\s*:\s*null\b/.test(argumentos)).toBe(true)
    }
  })
})

describe('R45 — las escrituras sobre un contacto llevan el ambito en el `where` de cada `updateMany`', () => {
  const cableado = cableadoDelPuerto(PUERTO_CONTACTOS)
  const adaptador = analizar(ADAPTADOR_CONTACTOS)

  it.each([
    ['setLink', 1],
    ['setBlocked', 1],
  ] as const)('%s: sus %i `updateMany` llevan `whatsappContactCompanyScope(scope)` en el `where`', (metodo, esperadas) => {
    const funcion = adaptador.funciones.find((f) => f.nombre === cableado.get(metodo))
    expect(funcion).toBeTruthy()
    const cuerpo = funcion?.cuerpo ?? ''
    const llamadas = [...cuerpo.matchAll(/\bdb\s*\.\s*whatsappContact\s*\.\s*updateMany\s*\(/g)]
    expect(llamadas, 'la escritura tiene que ser un `updateMany` acotado').toHaveLength(esperadas)
    for (const llamada of llamadas) {
      const abre = cuerpo.indexOf('(', llamada.index)
      const argumentos = cuerpo.slice(abre + 1, cierreEquilibrado(cuerpo, abre, '(', ')'))
      expect(objetoDeLaClave(argumentos, 'where') ?? '').toMatch(/\bwhatsappContactCompanyScope\s*\(\s*scope\s*\)/)
    }
  })

  it('el adaptador no escribe un contacto por `update`, `upsert`, `create` ni `delete`', () => {
    expect(adaptador.codigo).not.toMatch(/\bdb\s*\.\s*whatsappContact\s*\.\s*(?:update|upsert|create|createMany|delete|deleteMany)\s*\(/)
  })
})

/**
 * Las llamadas `prisma.<modelo>.<operacion>(` (o `tx.`, dentro de una transaccion interactiva) de
 * `cuerpo` cuyo argumento no lleva `<envoltura>(scope)`.
 */
function escriturasSinAmbito(cuerpo: string, modelo: string, operacion: string, envoltura: string): {
  readonly llamadas: number
  readonly sinAmbito: number
} {
  const patron = new RegExp(`\\b(?:prisma|tx)\\s*\\.\\s*${modelo}\\s*\\.\\s*${operacion}\\s*\\(`, 'g')
  const llamadas = [...cuerpo.matchAll(patron)]
  const sinAmbito = llamadas.filter((llamada) => {
    const abre = cuerpo.indexOf('(', llamada.index)
    const argumentos = cuerpo.slice(abre + 1, cierreEquilibrado(cuerpo, abre, '(', ')'))
    return !new RegExp(`\\b${envoltura}\\s*\\(\\s*scope\\s*\\)`).test(argumentos)
  })
  return { llamadas: llamadas.length, sinAmbito: sinAmbito.length }
}

describe('R3 — las escrituras de plantillas llevan el ambito en cada `updateMany`, y el alta en su SQL', () => {
  const cableado = cableadoDe(PUERTO_PLANTILLAS.constante, PUERTO_PLANTILLAS.nombre)
  const adaptador = analizar(ADAPTADOR_PLANTILLAS)
  const funcionDe = (metodo: string) => adaptador.funciones.find((f) => f.nombre === cableado.get(metodo))

  it.each([
    ['markDeleted', 1],
    ['applySync', 3],
    ['applyWebhookUpdates', 1],
    ['replaceVariables', 1],
    ['setEnabled', 1],
  ] as const)('%s: sus %i `updateMany` de plantillas llevan `whatsappTemplateCompanyScope(scope)`', (metodo, esperadas) => {
    const funcion = funcionDe(metodo)
    expect(funcion).toBeTruthy()
    const { llamadas, sinAmbito } = escriturasSinAmbito(
      funcion?.cuerpo ?? '',
      'whatsappTemplate',
      'updateMany',
      'whatsappTemplateCompanyScope',
    )
    expect(llamadas).toBe(esperadas)
    expect(sinAmbito).toBe(0)
  })

  it('applySync: la hora en la conexion va por `whatsappConnectionCompanyScope(scope)` y solo a una viva; las altas llevan `companyScopeColumns(scope)`', () => {
    const cuerpo = funcionDe('applySync')?.cuerpo ?? ''
    const conexion = escriturasSinAmbito(cuerpo, 'whatsappConnection', 'updateMany', 'whatsappConnectionCompanyScope')
    expect(conexion).toEqual({ llamadas: 1, sinAmbito: 0 })
    const llamada = /\bprisma\s*\.\s*whatsappConnection\s*\.\s*updateMany\s*\(/.exec(cuerpo)
    const abre = cuerpo.indexOf('(', llamada?.index ?? 0)
    expect(cuerpo.slice(abre, cierreEquilibrado(cuerpo, abre, '(', ')'))).toMatch(/\bdeletedAt\s*:\s*null\b/)
    expect(cuerpo).toMatch(/\bconst\s+columns\s*=\s*companyScopeColumns\s*\(\s*scope\s*\)/)
    expect(escriturasSinAmbito(cuerpo, 'whatsappTemplate', 'createMany', 'companyScopeColumns').llamadas).toBe(1)
    expect(cuerpo).toMatch(/createMany\s*\(\s*\{\s*data\s*:[\s\S]*\.\.\.columns\b/)
  })

  it('insertCreated: la empresa del SQL sale de `companyScopeColumns(scope)` y el `DO UPDATE` no toca otra empresa', () => {
    const funcion = funcionDe('insertCreated')
    expect(funcion).toBeTruthy()
    expect(funcion?.cuerpo ?? '').toMatch(/\bconst\s+columns\s*=\s*companyScopeColumns\s*\(\s*scope\s*\)/)
    const fuente = sinComentarios(readFileSync(join(PERSISTENCE_ROOT, ADAPTADOR_PLANTILLAS), 'utf8'))
    const texto = fuente.slice(funcion?.inicio ?? 0, (funcion?.fin ?? 0) + 1)
    expect(texto).toMatch(/\$\{\s*columns\.companyId\s*\}::uuid/)
    expect(texto).toMatch(/DO UPDATE[\s\S]*WHERE\s+"whatsapp_templates"\."company_id"\s*=\s*EXCLUDED\."company_id"/)
  })
})

/** Los bloques de SQL crudo (`$queryRaw` / `$executeRaw` como plantilla etiquetada) que no filtran por la empresa de `columns`. */
function sqlCrudoSinEmpresa(texto: string): { readonly bloques: number; readonly sinEmpresa: number } {
  const bloques = [...texto.matchAll(/\$(?:queryRaw|executeRaw)\s*(?:<[^`]*>)?\s*`([^`]*)`/g)]
  const sinEmpresa = bloques.filter((bloque) => !/"company_id"\s*=\s*\$\{\s*columns\.companyId\s*\}::uuid/.test(bloque[1] ?? ''))
  return { bloques: bloques.length, sinEmpresa: sinEmpresa.length }
}

describe('R63 — las relaciones y las variables propias llevan el ambito en cada escritura', () => {
  const plantillas = analizar(ADAPTADOR_PLANTILLAS)
  const variables = analizar(ADAPTADOR_VARIABLES)
  const cableadoPlantillas = cableadoDe(PUERTO_PLANTILLAS.constante, PUERTO_PLANTILLAS.nombre)
  const cableadoVariables = cableadoDe(PUERTO_VARIABLES.constante, PUERTO_VARIABLES.nombre)
  const cuerpoDe = (adaptador: ArchivoAnalizado, cableado: ReadonlyMap<string, string>, metodo: string) =>
    adaptador.funciones.find((f) => f.nombre === cableado.get(metodo))?.cuerpo ?? ''
  const textoDe = (archivo: string, adaptador: ArchivoAnalizado, nombre: string) => {
    const funcion = adaptador.funciones.find((f) => f.nombre === nombre)
    const fuente = sinComentarios(readFileSync(join(PERSISTENCE_ROOT, archivo), 'utf8'))
    return fuente.slice(funcion?.inicio ?? 0, (funcion?.fin ?? 0) + 1)
  }

  it.each([
    ['markDeleted', 1],
    ['replaceVariables', 1],
  ] as const)('%s: sus %i `deleteMany` de relaciones llevan `whatsappTemplateVariableCompanyScope(scope)`', (metodo, esperadas) => {
    expect(
      escriturasSinAmbito(
        cuerpoDe(plantillas, cableadoPlantillas, metodo),
        'whatsappTemplateVariable',
        'deleteMany',
        'whatsappTemplateVariableCompanyScope',
      ),
    ).toEqual({ llamadas: esperadas, sinAmbito: 0 })
  })

  it.each(['insertCreated', 'replaceVariables'] as const)(
    '%s: las relaciones se crean con `relationData(columns, …)` y `columns` sale de `companyScopeColumns(scope)`',
    (metodo) => {
      const cuerpo = cuerpoDe(plantillas, cableadoPlantillas, metodo)
      expect(cuerpo).toMatch(/\bconst\s+columns\s*=\s*companyScopeColumns\s*\(\s*scope\s*\)/)
      expect(cuerpo).toMatch(/\btx\s*\.\s*whatsappTemplateVariable\s*\.\s*createMany\s*\(\s*\{\s*data\s*:[\s\S]*relationData\s*\(\s*columns\b/)
      expect(plantillas.funciones.find((f) => f.nombre === 'relationData')?.cuerpo ?? '').toMatch(/\.\.\.columns\b/)
    },
  )

  it('applySync y lockIfUnchanged: cada bloque de SQL crudo filtra por la empresa de `companyScopeColumns(scope)`', () => {
    const applySync = textoDe(ADAPTADOR_PLANTILLAS, plantillas, cableadoPlantillas.get('applySync') ?? '')
    expect(sqlCrudoSinEmpresa(applySync)).toEqual({ bloques: 2, sinEmpresa: 0 })
    expect(sqlCrudoSinEmpresa(textoDe(ADAPTADOR_PLANTILLAS, plantillas, 'lockIfUnchanged'))).toEqual({ bloques: 1, sinEmpresa: 0 })
    expect(sqlCrudoSinEmpresa(textoDe(ADAPTADOR_VARIABLES, variables, 'lockedKey'))).toEqual({ bloques: 1, sinEmpresa: 0 })
  })

  it.each([
    ['update', 'update', 1],
    ['delete', 'deleteMany', 1],
  ] as const)('variables propias %s: sus %s llevan `whatsappVariableKeyCompanyScope(scope)`', (metodo, operacion, esperadas) => {
    expect(
      escriturasSinAmbito(
        cuerpoDe(variables, cableadoVariables, metodo),
        'whatsappVariableKey',
        operacion,
        'whatsappVariableKeyCompanyScope',
      ),
    ).toEqual({ llamadas: esperadas, sinAmbito: 0 })
  })

  it('variables propias create: la empresa del alta sale de `companyScopeColumns(scope)`', () => {
    expect(cuerpoDe(variables, cableadoVariables, 'create')).toMatch(/data\s*:\s*\{\s*\.\.\.companyScopeColumns\s*\(\s*scope\s*\)/)
  })
})

/** Horas que el SQL recibe desde JS (`${…}::timestamptz`): un `Date` pierde los microsegundos de la base. */
function horasDesdeJs(texto: string): number {
  return [...texto.matchAll(/\$\{[^}]*\}\s*::\s*timestamp(?:tz)?\b/g)].length
}

/** Los bloques de SQL crudo que escriben (`UPDATE`, `INSERT`, `DELETE`). */
function sqlCrudoQueEscribe(texto: string): readonly string[] {
  return [...texto.matchAll(/\$(?:queryRaw|executeRaw)\s*(?:<[^`]*>)?\s*`([^`]*)`/g)]
    .map((bloque) => bloque[1] ?? '')
    .filter((sql) => /\b(?:UPDATE|INSERT|DELETE)\b/i.test(sql))
}

const MARCA_QUE_NO_RETROCEDE =
  /UPDATE\s+"whatsapp_contacts"\s+c\s+SET\s+"last_read_at"\s*=\s*target\."at"\s*,\s*"updated_at"\s*=\s*now\(\)\s+FROM\s+target\s+WHERE\s+c\."company_id"\s*=\s*\$\{\s*columns\.companyId\s*\}::uuid[\s\S]*c\."last_read_at"\s*<\s*target\."at"/

describe('R39 — las lecturas de conversaciones filtran por empresa en cada SQL y la marca solo avanza', () => {
  const adaptador = analizar(ADAPTADOR_CONVERSACIONES)
  const fuente = sinComentarios(readFileSync(join(PERSISTENCE_ROOT, ADAPTADOR_CONVERSACIONES), 'utf8'))
  const cableado = cableadoDelPuerto(PUERTO_CONVERSACIONES)
  const textoDe = (metodo: string) => {
    const funcion = adaptador.funciones.find((f) => f.nombre === cableado.get(metodo))
    return fuente.slice(funcion?.inicio ?? 0, (funcion?.fin ?? 0) + 1)
  }

  it('cada bloque de SQL crudo del adaptador filtra por la empresa de `companyScopeColumns(scope)`', () => {
    expect(sqlCrudoSinEmpresa(fuente)).toEqual({ bloques: 8, sinEmpresa: 0 })
    for (const funcion of adaptador.funciones.filter((f) => /\$queryRaw/.test(f.cuerpo))) {
      expect(funcion.cuerpo, `${funcion.nombre} usa SQL crudo sin \`const columns = companyScopeColumns(scope)\``).toMatch(
        /\bconst\s+columns\s*=\s*companyScopeColumns\s*\(\s*scope\s*\)/,
      )
    }
  })

  it('ninguna hora entra al SQL desde JS: la del mensaje, la del cursor y la de la marca se calculan en la base', () => {
    expect(horasDesdeJs(fuente)).toBe(0)
    for (const funcion of adaptador.funciones) {
      expect(funcion.parametros, `${funcion.nombre} recibe un \`Date\``).not.toMatch(/:\s*Date\b/)
    }
  })

  it('la unica escritura es la marca de lectura de `advanceLastRead`, con `GREATEST` de hecho: solo si la hora nueva es mayor', () => {
    expect(adaptador.codigo).not.toMatch(
      /\bdb\s*\.\s*(?:whatsappContact|whatsappMessage)\s*\.\s*(?:update|updateMany|upsert|create|createMany|delete|deleteMany)\s*\(/,
    )
    expect(sqlCrudoQueEscribe(fuente)).toHaveLength(1)
    const escrituras = sqlCrudoQueEscribe(textoDe('advanceLastRead'))
    expect(escrituras).toHaveLength(1)
    expect(escrituras[0] ?? '').toMatch(MARCA_QUE_NO_RETROCEDE)
  })
})

describe('R39 — sensibilidad: las comprobaciones de conversaciones muerden', () => {
  it('una hora pasada desde JS al SQL se cuenta', () => {
    const texto =
      'await db.$queryRaw`UPDATE "whatsapp_contacts" SET "last_read_at" = ${at}::timestamptz WHERE "id" = ${id}::uuid`\n' +
      'await db.$queryRaw`SELECT 1 WHERE "created_at" < ${ before.at } :: timestamp`\n'
    expect(horasDesdeJs(texto)).toBe(2)
    expect(horasDesdeJs('await db.$queryRaw`SELECT COALESCE(m."meta_timestamp", m."created_at")`')).toBe(0)
  })

  it('un SQL con alias cuya empresa no sale de `columns` se cuenta como sin empresa', () => {
    const texto =
      'await db.$queryRaw`SELECT 1 FROM "whatsapp_contacts" c WHERE c."company_id" = ${companyId}::uuid`\n' +
      'await db.$queryRaw`SELECT 1 FROM "whatsapp_messages" m WHERE m."contact_id" = ${id}::uuid`\n' +
      'await db.$queryRaw`SELECT 1 FROM "whatsapp_messages" m WHERE m."company_id" = ${columns.companyId}::uuid`\n'
    expect(sqlCrudoSinEmpresa(texto)).toEqual({ bloques: 3, sinEmpresa: 2 })
  })

  it('una marca que se escribe sin la condicion de avance, sin empresa o desde otro valor no casa con la forma', () => {
    const buena =
      'UPDATE "whatsapp_contacts" c SET "last_read_at" = target."at", "updated_at" = now() FROM target ' +
      'WHERE c."company_id" = ${columns.companyId}::uuid AND c."id" = ${contactId}::uuid ' +
      'AND (c."last_read_at" IS NULL OR c."last_read_at" < target."at")'
    expect(buena).toMatch(MARCA_QUE_NO_RETROCEDE)
    expect(buena.replace(' OR c."last_read_at" < target."at"', '')).not.toMatch(MARCA_QUE_NO_RETROCEDE)
    expect(buena.replace('${columns.companyId}', '${companyId}')).not.toMatch(MARCA_QUE_NO_RETROCEDE)
    expect(buena.replace('= target."at",', '= ${at}::timestamptz,')).not.toMatch(MARCA_QUE_NO_RETROCEDE)
  })

  it('un segundo SQL que escribe se ve', () => {
    const texto =
      'await db.$queryRaw<{ id: string }[]>`UPDATE "whatsapp_contacts" SET "blocked_at" = NULL`\n' +
      'await db.$executeRaw`DELETE FROM "whatsapp_messages"`\n' +
      'await db.$queryRaw`SELECT 1`\n'
    expect(sqlCrudoQueEscribe(texto)).toHaveLength(2)
  })
})

describe('R63 — sensibilidad: las comprobaciones de relaciones muerden', () => {
  it('un `tx.whatsappTemplateVariable.deleteMany` sin la envoltura se cuenta como sin ambito', () => {
    const cuerpo =
      'await tx.whatsappTemplateVariable.deleteMany({ where: { templateId: id, ...whatsappTemplateVariableCompanyScope(scope) } })\n' +
      'await tx.whatsappTemplateVariable.deleteMany({ where: { templateId: id } })\n'
    expect(
      escriturasSinAmbito(cuerpo, 'whatsappTemplateVariable', 'deleteMany', 'whatsappTemplateVariableCompanyScope'),
    ).toEqual({ llamadas: 2, sinAmbito: 1 })
  })

  it('la envoltura de plantillas no cuenta como ambito de relaciones ni la de relaciones como la de variables', () => {
    const relaciones = 'await tx.whatsappTemplateVariable.deleteMany({ where: { id, ...whatsappTemplateCompanyScope(scope) } })\n'
    expect(
      escriturasSinAmbito(relaciones, 'whatsappTemplateVariable', 'deleteMany', 'whatsappTemplateVariableCompanyScope').sinAmbito,
    ).toBe(1)
    const variables = 'await tx.whatsappVariableKey.update({ where: { id, ...whatsappTemplateVariableCompanyScope(scope) } })\n'
    expect(escriturasSinAmbito(variables, 'whatsappVariableKey', 'update', 'whatsappVariableKeyCompanyScope').sinAmbito).toBe(1)
  })

  it('un bloque de SQL crudo sin el filtro de empresa se cuenta', () => {
    const texto =
      'await tx.$queryRaw<{ key: string }[]>`SELECT "key" FROM "whatsapp_variable_keys" WHERE "id" = ${id}::uuid FOR UPDATE`\n' +
      'await prisma.$executeRaw`DELETE FROM "whatsapp_template_variables" WHERE "company_id" = ${columns.companyId}::uuid`\n'
    expect(sqlCrudoSinEmpresa(texto)).toEqual({ bloques: 2, sinEmpresa: 1 })
  })

  it('una funcion del adaptador que consulta por `tx` sin estar cableada ni en `ayudantes` se ve', () => {
    const fuente =
      "import { whatsappTemplateVariableCompanyScope } from './company-scope'\n" +
      'async function suelta(tx: Prisma.TransactionClient, scope: IntegracionesScope) {\n' +
      '  return tx.whatsappTemplateVariable.findMany({ where: whatsappTemplateVariableCompanyScope(scope) })\n' +
      '}\n'
    expect(analizarFuente(fuente).funciones.filter((f) => tocaLaBase(f.cuerpo)).map((f) => f.nombre)).toEqual(['suelta'])
  })
})

describe('R3 — sensibilidad: las comprobaciones de plantillas muerden', () => {
  it('un `updateMany` de plantillas sin la envoltura se cuenta como sin ambito', () => {
    const cuerpo =
      'await prisma.whatsappTemplate.updateMany({ where: { id, ...whatsappTemplateCompanyScope(scope) }, data })\n' +
      'await prisma.whatsappTemplate.updateMany({ where: { id }, data })\n'
    expect(escriturasSinAmbito(cuerpo, 'whatsappTemplate', 'updateMany', 'whatsappTemplateCompanyScope')).toEqual({
      llamadas: 2,
      sinAmbito: 1,
    })
  })

  it('la envoltura de OTRA tabla no cuenta como ambito de plantillas', () => {
    const cuerpo = 'await prisma.whatsappTemplate.updateMany({ where: { id, ...whatsappConnectionCompanyScope(scope) } })\n'
    expect(escriturasSinAmbito(cuerpo, 'whatsappTemplate', 'updateMany', 'whatsappTemplateCompanyScope').sinAmbito).toBe(1)
  })

  it('un `$queryRaw` como plantilla etiquetada sin `scope` en la firma da hallazgo', () => {
    const fuente =
      "import { whatsappTemplateCompanyScope } from './company-scope'\n" +
      'export async function leak(id: string) {\n' +
      '  return prisma.$queryRaw`SELECT * FROM whatsapp_templates WHERE id = ${id}`\n' +
      '}\n'
    expect(hallazgosDe('x.ts', analizarFuente(fuente), false).join('\n')).toMatch(/sin declarar/)
  })
})

describe('R2, R32 — ninguna consulta del modulo se queda sin ambito, salvo las exenciones con nombre que aprobo el humano', () => {
  const archivos = readdirSync(PERSISTENCE_ROOT).filter((archivo) => archivo.endsWith('.ts'))

  it('los archivos de persistencia se barren todos, y el troceo VE las consultas', () => {
    expect(archivos).toContain(PUNTO_UNICO)
    for (const exento of EXENTOS_DEL_AMBITO.keys()) expect(archivos).toContain(exento)
    for (const puerto of PUERTOS) {
      expect(archivos).toContain(puerto.adaptador)
      const cableado = cableadoDelPuerto(puerto)
      const conConsulta = analizar(puerto.adaptador)
        .funciones.filter((f) => tocaLaBase(f.cuerpo))
        .map((f) => f.nombre)
      expect(conConsulta.sort()).toEqual([...cableado.values(), ...puerto.ayudantes].sort())
    }
  })

  for (const archivo of archivos) {
    const motivo = EXENTOS_DEL_AMBITO.get(archivo)
    const titulo =
      motivo === undefined
        ? `${archivo}: toda funcion que toca la base declara y consume el ambito, y nadie lee la empresa a mano`
        : `${archivo}: exento por nombre (${motivo}), con su forma exacta`
    it(titulo, () => {
      expect(hallazgosDelArchivo(archivo, analizar(archivo))).toEqual([])
    })
  }

  // 2026-10-20, QC-239, decision del humano: hasta esta fecha la lista tenia UNA sola entrada, el
  // resolutor de empresa del webhook. Se suma la transaccion de los contactos, con la forma estricta
  // de QC-141 D21. Una tercera entrada pone este caso en rojo.
  it('R32 — la lista de exentos tiene DOS entradas: el resolutor de empresa del webhook y la transaccion de los contactos', () => {
    expect([...EXENTOS_DEL_AMBITO.keys()]).toEqual([
      'whatsapp-webhook-directory-prisma.ts',
      'whatsapp-contact-unit-of-work-prisma.ts',
    ])
  })

  it('R32 — el resolutor exento es lo que lib/composition cablea al puerto `WhatsappWebhookDirectory`', () => {
    const { constante, nombre, metodo } = FORMA_EXENTA.puerto
    expect([...cableadoDe(constante, nombre).entries()]).toEqual([[metodo, FORMA_EXENTA.funcion]])
    const metodos = metodosDeLaInterfaz(join(MODULE_ROOT, 'ports', 'whatsapp-webhook-directory.ts'), nombre)
    expect([...metodos.keys()]).toEqual([metodo])
  })

  it('R32 — las exenciones viven en UNA sola lista de exentos: no hay otra lista de excepciones', () => {
    const nombresDeLista = ['SIN_AMBITO_POR_DECISION_APROBADA', 'EXCEPCIONES', 'EXENTAS', 'EXENTOS_DEL_AMBITO']
    const marcas = nombresDeLista.map((nombre) => new RegExp(`^\\s*(?:const|let|type|enum)\\s+${nombre}\\b`, 'm'))
    expect(marcas.some((marca) => marca.test('const EXCEPCIONES = new Set([])'))).toBe(true)

    const estaGuardia = sinComentarios(readFileSync(fileURLToPath(import.meta.url), 'utf8'))
    const declaradas = nombresDeLista.flatMap((nombre) =>
      [...estaGuardia.matchAll(new RegExp(`^\\s*(?:const|let|type|enum)\\s+${nombre}\\b`, 'gm'))].map((m) => m[0].trim()),
    )
    expect(declaradas, 'esta guardia declara una sola lista de exentos').toEqual(['const EXENTOS_DEL_AMBITO'])

    const fuentesDelModulo = (dir: string): readonly string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
        const ruta = join(dir, entrada.name)
        if (entrada.isDirectory()) return fuentesDelModulo(ruta)
        return entrada.isFile() && ruta.endsWith('.ts') ? [ruta] : []
      })

    for (const ruta of fuentesDelModulo(MODULE_ROOT)) {
      const codigo = sinComentarios(readFileSync(ruta, 'utf8'))
      for (const marca of marcas) {
        expect(marca.test(codigo), `${ruta} declara una lista de excepciones de ambito`).toBe(false)
      }
    }
  })
})

describe('R2 — sensibilidad: la guardia muerde con fuentes sinteticos', () => {
  const CABECERA = "import { whatsappConnectionCompanyScope } from './company-scope'\n"

  it('una consulta sin `scope` en la firma da hallazgo', () => {
    const fuente =
      CABECERA +
      'export async function leak(id: string) {\n' +
      '  return prisma.whatsappConnection.findFirst({ where: { id } })\n' +
      '}\n'
    expect(hallazgosDe('x.ts', analizarFuente(fuente), false).join('\n')).toMatch(/sin declarar/)
  })

  it('declarar el ambito y no llevarlo al punto unico da hallazgo', () => {
    const fuente =
      CABECERA +
      'export async function leak(id: string, scope: IntegracionesScope) {\n' +
      '  return prisma.whatsappConnection.findFirst({ where: { id } })\n' +
      '}\n'
    expect(hallazgosDe('x.ts', analizarFuente(fuente), false).join('\n')).toMatch(/no lo lleva/)
  })

  it('leer `scope.companyId` a mano fuera del punto unico da hallazgo', () => {
    const fuente =
      CABECERA +
      'export async function leak(id: string, scope: IntegracionesScope) {\n' +
      '  return prisma.whatsappConnection.findFirst({ where: { id, companyId: scope.companyId, ...whatsappConnectionCompanyScope(scope) } })\n' +
      '}\n'
    expect(hallazgosDe('x.ts', analizarFuente(fuente), false).join('\n')).toMatch(/a mano/)
  })

  it('una consulta fuera de una `function` declarada da hallazgo', () => {
    const fuente = CABECERA + 'export const leak = () => prisma.whatsappConnection.findMany({})\n'
    expect(hallazgosDe('x.ts', analizarFuente(fuente), false).join('\n')).toMatch(/fuera de una/)
  })

  it('el lector del cableado ve una lambda, un spread y un metodo que falta', () => {
    const fuente =
      'const whatsappConnectionRepository: WhatsappConnectionRepository = {\n' +
      '  findLive: (scope) => leak(scope),\n' +
      '  ...otro,\n' +
      '  create: insertWhatsappConnection,\n' +
      '}\n'
    const cableado = cableadoEnFuente(fuente, PUERTO.constante, PUERTO.nombre)
    expect(cableado?.get('create')).toBe('insertWhatsappConnection')
    expect([...(cableado?.values() ?? [])].filter((nombre) => !/^\w+$/.test(nombre))).toHaveLength(2)
    expect(cableado?.has('update')).toBe(false)
    expect(cableadoEnFuente('const x = {}\n', PUERTO.constante, PUERTO.nombre)).toBeNull()
  })

  it('el ambito llevado por un ayudante del mismo archivo cuenta como consumido', () => {
    const fuente =
      CABECERA +
      'function whereOf(id: string, scope: IntegracionesScope) {\n' +
      '  return { id, ...whatsappConnectionCompanyScope(scope) }\n' +
      '}\n' +
      'export async function ok(id: string, scope: IntegracionesScope) {\n' +
      '  return prisma.whatsappConnection.findFirst({ where: whereOf(id, scope) })\n' +
      '}\n'
    expect(hallazgosDe('x.ts', analizarFuente(fuente), false)).toEqual([])
  })
})

describe('R45 — sensibilidad: los adaptadores con `db` y su fabrica no escapan al barrido', () => {
  const CABECERA = "import { whatsappContactCompanyScope } from './company-scope'\n"
  const FABRICA = 'createWhatsappContactRepository'
  const INTERFAZ = 'WhatsappContactRepository'
  const fabrica = (miembros: string): string =>
    `export function ${FABRICA}(db: PrismaLike = prisma): ${INTERFAZ} {\n` +
    '  return {\n' +
    miembros +
    '  };\n' +
    '}\n'

  it('una consulta por `db` sin `scope` en la firma da hallazgo', () => {
    const fuente =
      CABECERA +
      'export async function leak(db: PrismaLike, id: string) {\n' +
      '  return db.whatsappContact.findFirst({ where: { id } })\n' +
      '}\n'
    expect(hallazgosDe('x.ts', analizarFuente(fuente), false).join('\n')).toMatch(/sin declarar/)
  })

  it('una consulta por `db` que declara el ambito y no lo lleva al punto unico da hallazgo', () => {
    const fuente =
      CABECERA +
      'export async function leak(db: PrismaLike, id: string, scope: IntegracionesScope) {\n' +
      '  return db.whatsappContact.findFirst({ where: { id } })\n' +
      '}\n'
    expect(hallazgosDe('x.ts', analizarFuente(fuente), false).join('\n')).toMatch(/no lo lleva/)
  })

  it('una consulta por `db` escrita dentro de la propia fabrica da hallazgo', () => {
    const fuente = CABECERA + fabrica('    findById: (id, scope) => db.whatsappContact.findFirst({ where: { id } }),\n')
    expect(hallazgosDe('x.ts', analizarFuente(fuente), false).join('\n')).toMatch(/sin declarar/)
  })

  it('control: un miembro que reenvia `db` y todos sus parametros a una funcion con nombre se lee con su nombre', () => {
    const cableado = cableadoEnFabrica(
      fabrica('    findById: (id, scope) => findWhatsappContactById(db, id, scope),\n'),
      FABRICA,
      INTERFAZ,
    )
    expect([...(cableado?.entries() ?? [])]).toEqual([['findById', 'findWhatsappContactById']])
  })

  it('un miembro que pierde el ambito, cambia el orden, no pasa `db`, tiene cuerpo o es un spread no queda cableado con nombre', () => {
    const cableado = cableadoEnFabrica(
      fabrica(
        '    findById: (id, scope) => findWhatsappContactById(db, id),\n' +
          '    findByWaIds: (waIds, scope) => findWhatsappContactsByWaIds(db, scope, waIds),\n' +
          '    setLink: (id, link, scope) => setWhatsappContactLink(prisma, id, link, scope),\n' +
          '    setBlocked: async (id, blocked, scope) => { return setWhatsappContactBlocked(db, id, blocked, scope) },\n' +
          '    ...otro,\n',
      ),
      FABRICA,
      INTERFAZ,
    )
    expect(cableado).not.toBeNull()
    expect(cableado?.size).toBe(5)
    expect([...(cableado?.values() ?? [])].filter((nombre) => /^\w+$/.test(nombre))).toEqual([])
  })

  it('una fabrica sin la firma `(db: PrismaLike): Interfaz`, o que no devuelve solo un objeto, no se lee', () => {
    const miembro = '    findById: (id, scope) => findWhatsappContactById(db, id, scope),\n'
    const sinTipo = fabrica(miembro).replace(`): ${INTERFAZ} {`, ') {')
    const sinTipoDeCliente = fabrica(miembro).replace('db: PrismaLike = prisma', 'db = prisma')
    const sinObjeto = `export function ${FABRICA}(db: PrismaLike): ${INTERFAZ} {\n  return otro(db)\n}\n`
    const conMasCodigo = fabrica(miembro).replace('  };\n}', '  };\n  leak()\n}')
    for (const fuente of [sinTipo, sinTipoDeCliente, sinObjeto, conMasCodigo, 'const x = {}\n']) {
      expect(cableadoEnFabrica(fuente, FABRICA, INTERFAZ)).toBeNull()
    }
  })
})

// 2026-10-20, QC-239: la recepcion lee los duenos de un numero por su propia transaccion, asi que
// su adaptador es una fabrica que recibe `deps` y no `db`. Hasta esta fecha el puerto se cableaba
// en lib/composition a `recordWhatsappInbound` por nombre; ahora se lee de la fabrica, y
// lib/composition tiene que construir el puerto con ella.
describe('R2 — la recepcion se cablea por su fabrica, y la fabrica no escapa al barrido', () => {
  const FABRICA = 'createWhatsappInboxRecorder'
  const INTERFAZ = 'WhatsappInboxRepository'
  const DEPS = PUERTO_INBOX.parametroDeFabrica ?? PARAMETRO_DB
  const fabrica = (miembros: string, firma = `deps: WhatsappInboxRecorderDeps`): string =>
    `export function ${FABRICA}(${firma}): ${INTERFAZ} {\n` +
    '  return {\n' +
    miembros +
    '  };\n' +
    '}\n'

  it('lib/composition construye `whatsappInboxRepository` con la fabrica del adaptador, y con nada mas', () => {
    const fuente = vaciarCadenas(sinComentarios(readFileSync(join(repoRoot, 'lib', 'composition', 'index.ts'), 'utf8')))
    expect(fuente).toMatch(new RegExp(`\\bconst\\s+whatsappInboxRepository\\s*:\\s*${INTERFAZ}\\s*=\\s*${FABRICA}\\s*\\(`))
    expect(fuente).not.toMatch(/\brecordWhatsappInbound\b/)
  })

  it('control: el miembro que reenvia `deps` y todos sus parametros se lee con su nombre', () => {
    const cableado = cableadoEnFabrica(
      fabrica('    record: (batch, connectionId, receivedAt, scope) => recordWhatsappInbound(deps, batch, connectionId, receivedAt, scope),\n'),
      FABRICA,
      INTERFAZ,
      DEPS,
    )
    expect([...(cableado?.entries() ?? [])]).toEqual([['record', 'recordWhatsappInbound']])
  })

  it('un miembro que pierde el ambito, no pasa `deps` primero o tiene cuerpo no queda cableado con nombre', () => {
    for (const miembro of [
      '    record: (batch, connectionId, receivedAt, scope) => recordWhatsappInbound(deps, batch, connectionId, receivedAt),\n',
      '    record: (batch, connectionId, receivedAt, scope) => recordWhatsappInbound(batch, connectionId, receivedAt, scope),\n',
      '    record: async (batch, connectionId, receivedAt, scope) => { return recordWhatsappInbound(deps, batch, connectionId, receivedAt, scope) },\n',
    ]) {
      const cableado = cableadoEnFabrica(fabrica(miembro), FABRICA, INTERFAZ, DEPS)
      expect(cableado).not.toBeNull()
      expect([...(cableado?.values() ?? [])].filter((nombre) => /^\w+$/.test(nombre))).toEqual([])
    }
  })

  it('una fabrica con otro parametro o sin el tipo del puerto no se lee', () => {
    const miembro = '    record: (b, c, r, scope) => recordWhatsappInbound(deps, b, c, r, scope),\n'
    for (const fuente of [
      fabrica(miembro, 'db: PrismaLike'),
      fabrica(miembro, 'deps: unknown'),
      fabrica(miembro).replace(`): ${INTERFAZ} {`, ') {'),
    ]) {
      expect(cableadoEnFabrica(fuente, FABRICA, INTERFAZ, DEPS)).toBeNull()
    }
  })

  it('una consulta escrita dentro de la propia fabrica da hallazgo', () => {
    const fuente =
      "import { whatsappContactCompanyScope } from './company-scope'\n" +
      fabrica('    record: (b, c, r, scope) => prisma.whatsappContact.findMany({ where: { waId: b } }),\n')
    expect(hallazgosDe('x.ts', analizarFuente(fuente), false).join('\n')).toMatch(/sin declarar/)
  })
})

describe('R32 — sensibilidad: la exencion del resolutor de empresa no es un cheque en blanco', () => {
  const EXENTO = 'whatsapp-webhook-directory-prisma.ts'
  const IMPORT = "import { prisma } from '@/lib/shared/db/prisma'\n"
  const resolutor = (consulta: string): string =>
    'export async function companyOfWhatsappConnection(connectionId: string): Promise<string | null> {\n' +
    `  const row = await ${consulta}\n` +
    '  return row?.companyId ?? null\n' +
    '}\n'
  const BUENA =
    "prisma.whatsappConnection.findFirst({\n    where: { id: connectionId, deletedAt: null },\n    select: { companyId: true },\n  })"
  const FUENTE_BUENA = IMPORT + resolutor(BUENA)

  const hallazgosComoExento = (fuente: string): string =>
    hallazgosDelArchivo(EXENTO, analizarFuente(fuente)).join('\n')

  it('control: la forma aprobada, con su nombre de archivo, no da hallazgo', () => {
    expect(hallazgosDelArchivo(EXENTO, analizarFuente(FUENTE_BUENA))).toEqual([])
  })

  it('el fuente real del resolutor no da hallazgo con su nombre', () => {
    const real = readFileSync(join(PERSISTENCE_ROOT, EXENTO), 'utf8')
    expect(hallazgosDelArchivo(EXENTO, analizarFuente(real))).toEqual([])
  })

  it('un segundo campo en el `select` da hallazgo', () => {
    const fuente = IMPORT + resolutor(BUENA.replace('{ companyId: true }', '{ companyId: true, appSecretCiphertext: true }'))
    expect(hallazgosComoExento(fuente)).toMatch(/select/)
  })

  it('un `select` ausente (la fila entera) da hallazgo', () => {
    const fuente = IMPORT + resolutor(BUENA.replace('select: { companyId: true },', ''))
    expect(hallazgosComoExento(fuente)).toMatch(/select/)
  })

  it('un `where` sin `deletedAt: null` da hallazgo', () => {
    const fuente = IMPORT + resolutor(BUENA.replace(', deletedAt: null', ''))
    expect(hallazgosComoExento(fuente)).toMatch(/deletedAt: null/)
  })

  it('otro acceso que no es `prisma.whatsappConnection.findFirst` da hallazgo', () => {
    const fuente = IMPORT + resolutor(BUENA.replace('findFirst', 'findMany'))
    expect(hallazgosComoExento(fuente)).toMatch(/unico acceso/)
  })

  it('una segunda funcion en el archivo exento da hallazgo, toque o no la base', () => {
    const conConsulta =
      FUENTE_BUENA +
      'export async function allConnections() {\n' +
      '  return prisma.whatsappConnection.findMany({})\n' +
      '}\n'
    expect(hallazgosComoExento(conConsulta)).toMatch(/exactamente una funcion/)
    expect(hallazgosComoExento(conConsulta)).toMatch(/exactamente una vez/)

    const sinConsulta = FUENTE_BUENA + 'export function helper(x: string) {\n  return x\n}\n'
    expect(hallazgosComoExento(sinConsulta)).toMatch(/exactamente una funcion/)
  })

  it('la misma funcion con otro nombre da hallazgo', () => {
    const fuente = FUENTE_BUENA.replace('companyOfWhatsappConnection', 'companyOfConnectionUnscoped')
    expect(hallazgosComoExento(fuente)).toMatch(/exactamente una funcion/)
  })

  it('SQL crudo dentro del archivo exento da hallazgo', () => {
    const fuente = IMPORT + resolutor('prisma.$queryRaw`SELECT company_id FROM whatsapp_connections`')
    expect(hallazgosComoExento(fuente)).toMatch(/SQL crudo/)
  })

  it('el mismo fuente aprobado con OTRO nombre de archivo da hallazgo: la exencion es por nombre', () => {
    expect(hallazgosDelArchivo('whatsapp-webhook-directory-prisma-copia.ts', analizarFuente(FUENTE_BUENA)).join('\n')).toMatch(
      /sin declarar/,
    )
    const real = readFileSync(join(PERSISTENCE_ROOT, EXENTO), 'utf8')
    expect(hallazgosDelArchivo('whatsapp-connection-lookup-prisma.ts', analizarFuente(real)).join('\n')).toMatch(
      /sin declarar/,
    )
  })
})

describe('R32 — sensibilidad: la exencion de la transaccion de los contactos no es un cheque en blanco', () => {
  const EXENTO = 'whatsapp-contact-unit-of-work-prisma.ts'
  const IMPORT = "import { prisma } from '@/lib/shared/db/prisma'\n"
  const BUENA =
    IMPORT +
    'export async function withWhatsappContactTransaction(run) {\n' +
    '  try {\n' +
    '    return await prisma.$transaction(run, { maxWait: 10_000, timeout: 30_000 })\n' +
    '  } catch (error) {\n' +
    '    if (!isCustomerPhoneLinkConflict(error)) throw error\n' +
    '    return prisma.$transaction(run, { maxWait: 10_000, timeout: 30_000 })\n' +
    '  }\n' +
    '}\n'
  const hallazgosComoExento = (fuente: string): string => hallazgosDelArchivo(EXENTO, analizarFuente(fuente)).join('\n')

  it('control: la forma aprobada no da hallazgo, y el fuente real tampoco', () => {
    expect(hallazgosDelArchivo(EXENTO, analizarFuente(BUENA))).toEqual([])
    const real = readFileSync(join(PERSISTENCE_ROOT, EXENTO), 'utf8')
    expect(hallazgosDelArchivo(EXENTO, analizarFuente(real))).toEqual([])
  })

  it('un `tx.whatsappContact.findMany` dentro del callback de `$transaction` da hallazgo', () => {
    const fuente =
      IMPORT +
      'export async function withWhatsappContactTransaction(run) {\n' +
      '  return prisma.$transaction(async (tx) => {\n' +
      '    await tx.whatsappContact.findMany()\n' +
      '    return run(tx)\n' +
      '  })\n' +
      '}\n'
    expect(hallazgosComoExento(fuente)).toMatch(/consulta por la transaccion/)
  })

  it('una consulta por `prisma.` en el exento da hallazgo, dentro o fuera de su funcion', () => {
    const dentro = BUENA.replace('try {\n', 'try {\n    await prisma.whatsappContact.findMany()\n')
    expect(hallazgosComoExento(dentro)).toMatch(/no es `prisma\.\$transaction`/)
    const otraFuncion = BUENA + 'export async function seCuela() {\n  return prisma.whatsappContact.findMany({})\n}\n'
    expect(hallazgosComoExento(otraFuncion)).toMatch(/no es `prisma\.\$transaction`/)
    expect(hallazgosComoExento(otraFuncion)).toMatch(/exactamente una funcion/)
  })

  it('una segunda funcion sin consulta, o la misma con otro nombre, da hallazgo', () => {
    expect(hallazgosComoExento(BUENA + 'export function helper(x: string) {\n  return x\n}\n')).toMatch(/exactamente una funcion/)
    expect(hallazgosComoExento(BUENA.replace('withWhatsappContactTransaction', 'withAnything'))).toMatch(/exactamente una funcion/)
  })

  it('SQL crudo, un alias de `prisma` o un import de namespace en el exento dan hallazgo', () => {
    expect(hallazgosComoExento(BUENA.replace('try {\n', 'try {\n    await prisma.$queryRaw`SELECT 1`\n'))).toMatch(/SQL crudo/)
    expect(hallazgosComoExento(BUENA.replace('{ prisma }', '{ prisma as db0 }'))).toMatch(/alias/)
    expect(hallazgosComoExento(BUENA.replace('import { prisma }', 'import * as db0'))).toMatch(/alias/)
  })

  it('el mismo fuente aprobado con OTRO nombre de archivo da hallazgo: la exencion es por nombre', () => {
    expect(hallazgosDelArchivo('whatsapp-contact-unit-of-work-prisma-copia.ts', analizarFuente(BUENA)).join('\n')).toMatch(
      /sin declarar/,
    )
  })

  it('la forma de la transaccion no sirve para el resolutor, ni la del resolutor para la transaccion', () => {
    expect(hallazgosDelArchivo('whatsapp-webhook-directory-prisma.ts', analizarFuente(BUENA)).join('\n')).toMatch(
      /exactamente una funcion/,
    )
    const resolutor = readFileSync(join(PERSISTENCE_ROOT, 'whatsapp-webhook-directory-prisma.ts'), 'utf8')
    expect(hallazgosComoExento(resolutor)).toMatch(/no es `prisma\.\$transaction`/)
  })
})

// --- Repositorio de salida (QC-240, 2026-10-23) -------------------------------------------------

/** Los argumentos de cada `db.<modelo>.<operacion>(` del texto (con sus cadenas intactas). */
function argumentosDeLlamadasDb(texto: string, modelo: string, operacion: string): readonly string[] {
  const patron = new RegExp(`\\bdb\\s*\\.\\s*${modelo}\\s*\\.\\s*${operacion}\\s*\\(`, 'g')
  return [...texto.matchAll(patron)].map((llamada) => {
    const abre = texto.indexOf('(', llamada.index)
    return texto.slice(abre + 1, cierreEquilibrado(texto, abre, '(', ')'))
  })
}

/** De los `updateMany` de mensajes, los que no llevan la envoltura de mensajes Y `status: 'SENDING'` en el `where`. */
function marcasSinCondicion(texto: string): { readonly llamadas: number; readonly sinCondicion: number } {
  const llamadas = argumentosDeLlamadasDb(texto, 'whatsappMessage', 'updateMany')
  const sinCondicion = llamadas.filter((argumentos) => {
    const where = objetoDeLaClave(argumentos, 'where') ?? ''
    return !/\bwhatsappMessageCompanyScope\s*\(\s*scope\s*\)/.test(where) || !/\bstatus\s*:\s*'SENDING'/.test(where)
  })
  return { llamadas: llamadas.length, sinCondicion: sinCondicion.length }
}

/** Los `INSERT` crudos cuya empresa no sale de `${columns.companyId}::uuid`, con `columns = companyScopeColumns(scope)`. */
function altasCrudasSinEmpresa(texto: string): { readonly bloques: number; readonly sinEmpresa: number } {
  const columnasDelAmbito = /\bconst\s+columns\s*=\s*companyScopeColumns\s*\(\s*scope\s*\)/.test(texto)
  const bloques = [...texto.matchAll(/\$(?:queryRaw|executeRaw)\s*`([^`]*)`/g)].filter((b) =>
    /\bINSERT\s+INTO\b/i.test(b[1] ?? ''),
  )
  const sinEmpresa = bloques.filter(
    (bloque) => !columnasDelAmbito || !/VALUES\s*\(\s*\$\{\s*columns\.companyId\s*\}::uuid/.test(bloque[1] ?? ''),
  )
  return { bloques: bloques.length, sinEmpresa: sinEmpresa.length }
}

describe('R43 (QC-240) — el repositorio de salida lleva el ambito en cada lectura y escritura', () => {
  const cableado = cableadoDelPuerto(PUERTO_SALIDA)
  const adaptador = analizar(ADAPTADOR_SALIDA)
  const fuente = sinComentarios(readFileSync(join(PERSISTENCE_ROOT, ADAPTADOR_SALIDA), 'utf8'))
  /** El texto de la funcion que cablea `metodo`, con sus cadenas: el troceo las vacia sin mover posiciones. */
  const textoDe = (metodo: string): string => {
    const funcion = adaptador.funciones.find((f) => f.nombre === cableado.get(metodo))
    expect(funcion, `${ADAPTADOR_SALIDA} no declara la funcion de ${metodo}`).toBeTruthy()
    return fuente.slice(funcion?.inicio ?? 0, (funcion?.fin ?? 0) + 1)
  }

  it.each(['markSent', 'markFailed'] as const)(
    '%s: su unico `updateMany` lleva `whatsappMessageCompanyScope(scope)` y `status: SENDING` en el `where`',
    (metodo) => {
      expect(marcasSinCondicion(textoDe(metodo))).toEqual({ llamadas: 1, sinCondicion: 0 })
    },
  )

  it('linkContact: su unico `updateMany` lleva `whatsappContactCompanyScope(scope)` en el `where`', () => {
    const llamadas = argumentosDeLlamadasDb(textoDe('linkContact'), 'whatsappContact', 'updateMany')
    expect(llamadas).toHaveLength(1)
    expect(objetoDeLaClave(llamadas[0] ?? '', 'where') ?? '').toMatch(/\bwhatsappContactCompanyScope\s*\(\s*scope\s*\)/)
  })

  it.each([
    ['findContact', 'findFirst'],
    ['findContactsByWaIds', 'findMany'],
  ] as const)('%s: su `%s` filtra por la conexion y por `whatsappContactCompanyScope(scope)`', (metodo, operacion) => {
    const llamadas = argumentosDeLlamadasDb(textoDe(metodo), 'whatsappContact', operacion)
    expect(llamadas).toHaveLength(1)
    const where = objetoDeLaClave(llamadas[0] ?? '', 'where') ?? ''
    expect(where).toMatch(/\bconnectionId\b/)
    expect(where).toMatch(/\bwhatsappContactCompanyScope\s*\(\s*scope\s*\)/)
  })

  it('findOutbound: su `findFirst` lleva `whatsappMessageCompanyScope(scope)` en el `where`', () => {
    const llamadas = argumentosDeLlamadasDb(textoDe('findOutbound'), 'whatsappMessage', 'findFirst')
    expect(llamadas).toHaveLength(1)
    expect(objetoDeLaClave(llamadas[0] ?? '', 'where') ?? '').toMatch(/\bwhatsappMessageCompanyScope\s*\(\s*scope\s*\)/)
  })

  it('insertSending: la empresa del alta sale de `companyScopeColumns(scope)`', () => {
    expect(textoDe('insertSending')).toMatch(/data\s*:\s*\{\s*\.\.\.companyScopeColumns\s*\(\s*scope\s*\)/)
  })

  it('ensureContact: el `INSERT` crudo toma la empresa de `companyScopeColumns(scope)` y la relectura lleva la envoltura', () => {
    const texto = textoDe('ensureContact')
    expect(altasCrudasSinEmpresa(texto)).toEqual({ bloques: 1, sinEmpresa: 0 })
    expect(texto).toMatch(/ON CONFLICT\s*\(\s*"connection_id"\s*,\s*"wa_id"\s*\)\s*DO NOTHING/)
    const relectura = argumentosDeLlamadasDb(texto, 'whatsappContact', 'findFirst')
    expect(relectura).toHaveLength(1)
    expect(objetoDeLaClave(relectura[0] ?? '', 'where') ?? '').toMatch(/\bwhatsappContactCompanyScope\s*\(\s*scope\s*\)/)
  })

  it('touchContact: su unico bloque de SQL crudo filtra por la empresa de `companyScopeColumns(scope)`', () => {
    const texto = textoDe('touchContact')
    expect(texto).toMatch(/\bconst\s+columns\s*=\s*companyScopeColumns\s*\(\s*scope\s*\)/)
    expect(sqlCrudoSinEmpresa(texto)).toEqual({ bloques: 1, sinEmpresa: 0 })
  })

  it('el adaptador no escribe un mensaje ni un contacto por `update`, `upsert` ni `delete`, ni da de alta un contacto por Prisma', () => {
    expect(adaptador.codigo).not.toMatch(/\bdb\s*\.\s*whatsappMessage\s*\.\s*(?:update|upsert|delete|deleteMany|createMany)\s*\(/)
    expect(adaptador.codigo).not.toMatch(
      /\bdb\s*\.\s*whatsappContact\s*\.\s*(?:update|upsert|create|createMany|delete|deleteMany)\s*\(/,
    )
  })
})

describe('R43 (QC-240) — sensibilidad: las comprobaciones del repositorio de salida muerden', () => {
  it('un `updateMany` de mensajes sin `status: SENDING`, con otro estado o con la envoltura de otra tabla, se cuenta', () => {
    const texto =
      "await db.whatsappMessage.updateMany({ where: { id, status: 'SENDING', ...whatsappMessageCompanyScope(scope) }, data })\n" +
      'await db.whatsappMessage.updateMany({ where: { id, ...whatsappMessageCompanyScope(scope) }, data })\n' +
      "await db.whatsappMessage.updateMany({ where: { id, status: 'SENDING', ...whatsappContactCompanyScope(scope) }, data })\n" +
      "await db.whatsappMessage.updateMany({ where: { id, status: 'SENT', ...whatsappMessageCompanyScope(scope) }, data })\n"
    expect(marcasSinCondicion(texto)).toEqual({ llamadas: 4, sinCondicion: 3 })
  })

  it('la condicion fuera del `where` (en el `data`) no cuenta', () => {
    const texto =
      "await db.whatsappMessage.updateMany({ where: { id }, data: { status: 'SENDING', ...whatsappMessageCompanyScope(scope) } })\n"
    expect(marcasSinCondicion(texto)).toEqual({ llamadas: 1, sinCondicion: 1 })
  })

  it('un `INSERT` crudo con la empresa de la entrada, o sin `columns` del ambito, se cuenta', () => {
    const bueno =
      'const columns = companyScopeColumns(scope)\n' +
      'await db.$executeRaw`INSERT INTO "whatsapp_contacts" ("company_id") VALUES (${columns.companyId}::uuid)`\n'
    expect(altasCrudasSinEmpresa(bueno)).toEqual({ bloques: 1, sinEmpresa: 0 })
    const deLaEntrada = bueno.replace('${columns.companyId}', '${companyId}')
    expect(altasCrudasSinEmpresa(deLaEntrada)).toEqual({ bloques: 1, sinEmpresa: 1 })
    const sinColumnas = bueno.replace('companyScopeColumns(scope)', 'otraCosa(scope)')
    expect(altasCrudasSinEmpresa(sinColumnas)).toEqual({ bloques: 1, sinEmpresa: 1 })
  })

  it('un miembro de la fabrica de salida que no reenvia `db` o pierde el ambito no queda cableado con nombre', () => {
    const fuente =
      'export function createWhatsappOutboxRepository(db: PrismaLike = prisma): WhatsappOutboxRepository {\n' +
      '  return {\n' +
      '    findOutbound: (id, scope) => findWhatsappOutboundMessage(db, id, scope),\n' +
      '    markSent: (id, wamid, scope) => markWhatsappMessageSent(prisma, id, wamid, scope),\n' +
      '    touchContact: (id, at, scope) => touchWhatsappContactOnSend(db, id, at),\n' +
      '  };\n' +
      '}\n'
    const cableado = cableadoEnFabrica(fuente, PUERTO_SALIDA.fabrica ?? '', PUERTO_SALIDA.nombre)
    expect(cableado?.get('findOutbound')).toBe('findWhatsappOutboundMessage')
    expect([...(cableado?.values() ?? [])].filter((nombre) => !/^\w+$/.test(nombre))).toHaveLength(2)
  })

  it('una funcion de salida que consulta por `db` sin llevar el ambito a la envoltura da hallazgo', () => {
    const fuente =
      "import { whatsappMessageCompanyScope } from './company-scope'\n" +
      'export async function findWhatsappOutboundMessage(db: PrismaLike, id: string, scope: IntegracionesScope) {\n' +
      '  return db.whatsappMessage.findFirst({ where: { id } })\n' +
      '}\n'
    expect(hallazgosDe(ADAPTADOR_SALIDA, analizarFuente(fuente), false).join('\n')).toMatch(/no lo lleva/)
  })
})
