// Guardia: la libreria de la cola (`@upstash/qstash`) esta AISLADA en sus adaptadores. Los unicos
// archivos del repositorio que la importan son los dos de `documentos` y los dos de `integraciones`
// (`specs/QC-241-envio-whatsapp-sistema/design.md > 9`, requisito R38).
//
// Recorre ARCHIVOS, no el grafo de imports —por eso vive en `tests/guards/`—: un import nuevo de la
// libreria en una ruta sin test no lo veria ningun `vitest related`. Copia la forma de
// `guard-envio-de-correo.test.ts`: censo en memoria, funciones puras sobre el censo y un caso de
// SENSIBILIDAD que demuestra que la guardia muerde sin escribir ningun archivo en el arbol.
//
// Que `domain/` y `ports/` no importen la libreria ya lo vigila `guard-arquitectura-modulos`; esta
// guardia solo cuenta importadores.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/** Raiz del repo: dos niveles por encima de `tests/guards/`. */
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const DESIGN = 'specs/QC-241-envio-whatsapp-sistema/design.md > 9'

const LIBRERIA = '@upstash/qstash'

/** Los UNICOS importadores admitidos, en orden alfabetico. */
const IMPORTADORES_AUTORIZADOS = [
  'lib/modules/documentos/adapters/driven/queue/processing-queue-qstash.ts',
  'lib/modules/documentos/adapters/driven/queue/queue-signature-qstash.ts',
  'lib/modules/integraciones/adapters/driven/queue/whatsapp-queue-signature-qstash.ts',
  'lib/modules/integraciones/adapters/driven/queue/whatsapp-send-queue-qstash.ts',
] as const

/** Las raices de fuente que se recorren. `tests/` queda fuera: sus `vi.mock` nombran la libreria. */
const RAICES_DE_FUENTE = ['lib', 'app', 'components', 'scripts']

const EXTENSIONES = ['.ts', '.tsx', '.mjs']

/** Carpetas que nunca se recorren: no son fuente del repo. */
const CARPETAS_IGNORADAS = new Set(['node_modules', '.next', '.git', 'dist', 'coverage'])

/** Fuente sin lineas de comentario: las guardias miran codigo, no prosa. */
function sinComentarios(fuente: string): string {
  return fuente
    .split('\n')
    .filter((linea) => {
      const limpia = linea.trim()
      return !(limpia.startsWith('//') || limpia.startsWith('*') || limpia.startsWith('/*'))
    })
    .join('\n')
}

/** Todas las fuentes bajo una carpeta, en rutas relativas a la raiz y con `/` siempre. */
function fuentesBajo(carpetaRelativa: string): string[] {
  const encontradas: string[] = []
  const recorrer = (directorio: string) => {
    for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
      const completa = join(directorio, entrada.name)
      if (entrada.isDirectory()) {
        if (CARPETAS_IGNORADAS.has(entrada.name)) continue
        recorrer(completa)
        continue
      }
      if (EXTENSIONES.some((extension) => entrada.name.endsWith(extension))) {
        encontradas.push(relative(RAIZ, completa).split('\\').join('/'))
      }
    }
  }
  recorrer(join(RAIZ, carpetaRelativa))
  return encontradas
}

/** El CENSO: ruta -> fuente sin comentarios. Las comprobaciones trabajan sobre el, no sobre el disco. */
const CENSO: ReadonlyMap<string, string> = new Map(
  RAICES_DE_FUENTE.filter((carpeta) => existsSync(join(RAIZ, carpeta)))
    .flatMap((carpeta) => fuentesBajo(carpeta))
    .map((ruta) => [ruta, sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8'))] as const),
)

/** El paquete ENTERO o una subruta (`@upstash/qstash/nextjs`): las dos cuentan como importar la libreria. */
const ESPECIFICADOR = `['"]${LIBRERIA.replace('/', '\\/')}(?:\\/[^'"]*)?['"]`

/** `import`, `import type` y `export ... from` (todos acaban en `from '...'`), `require(...)` e `import(...)`. */
const PATRON = new RegExp(
  `from\\s+${ESPECIFICADOR}|require\\(\\s*${ESPECIFICADOR}\\s*\\)|import\\(\\s*${ESPECIFICADOR}\\s*\\)`,
)

function importadoresDe(censo: ReadonlyMap<string, string>): string[] {
  return [...censo.entries()]
    .filter(([, fuente]) => PATRON.test(fuente))
    .map(([ruta]) => ruta)
    .sort()
}

describe(`guardia: \`${LIBRERIA}\` aislada en sus adaptadores (${DESIGN})`, () => {
  it('R38: el censo no pasa en vacio y ve a los cuatro importadores autorizados', () => {
    expect(
      CENSO.size,
      'el recorrido de fuentes deberia encontrar cientos de archivos; si encuentra pocos, las ' +
        'raices de RAICES_DE_FUENTE ya no existen y la guardia esta pasando en vacio',
    ).toBeGreaterThan(100)
    for (const ruta of IMPORTADORES_AUTORIZADOS) {
      expect(
        CENSO.has(ruta),
        `${ruta} lo enumera ${DESIGN}, pero no aparece en el recorrido: o se ha renombrado ` +
          '(actualiza design.md y esta guardia) o se ha borrado',
      ).toBe(true)
    }
  })

  it(`R38: los unicos archivos que importan \`${LIBRERIA}\` son los cuatro adaptadores de la cola`, () => {
    expect(
      importadoresDe(CENSO),
      `La libreria de la cola esta AISLADA en cuatro archivos (${DESIGN}, requisito R38):\n` +
        IMPORTADORES_AUTORIZADOS.map((ruta) => `  - ${ruta}`).join('\n') +
        '\nSi SOBRA uno: lo que necesites de la cola se pide por el puerto de su modulo ' +
        '(`ProcessingQueue`, `QueueSignature`, `WhatsappSendQueue`, `WhatsappQueueSignature`) y se ' +
        'cablea en `lib/composition`. Si FALTA uno: el aislamiento se documento en el design.md y en la ' +
        'fila de `@upstash/qstash` de `docs/dependencias.md`; si el inventario cambia de verdad, cambia ' +
        'los tres a la vez.',
    ).toEqual([...IMPORTADORES_AUTORIZADOS])
  })

  it('R38 SENSIBILIDAD: un importador ficticio en el censo da hallazgo', () => {
    const censo = new Map(CENSO)
    censo.set(
      'lib/modules/pedidos/adapters/driven/queue/otra-cola.ts',
      `import { Client } from '${LIBRERIA}';\nexport const x = Client;\n`,
    )
    const hallados = importadoresDe(censo)
    expect(hallados).toContain('lib/modules/pedidos/adapters/driven/queue/otra-cola.ts')
    expect(hallados).not.toEqual([...IMPORTADORES_AUTORIZADOS])
  })

  it('R38 SENSIBILIDAD: import, import type, export from, require, import() y una subruta se detectan; un comentario y otro paquete no', () => {
    const ficticio = 'lib/modules/pedidos/domain/ficticio.ts'
    const detectadas = [
      `import { Client } from '${LIBRERIA}'`,
      `import type { Receiver } from "${LIBRERIA}"`,
      `export { Client } from '${LIBRERIA}'`,
      `const qstash = require('${LIBRERIA}')`,
      `const qstash = await import('${LIBRERIA}')`,
      `import { verifySignatureAppRouter } from '${LIBRERIA}/nextjs'`,
    ]
    for (const forma of detectadas) {
      const censo = new Map([[ficticio, sinComentarios(forma)]])
      expect(importadoresDe(censo), `la forma \`${forma}\` deberia detectarse`).toEqual([ficticio])
    }
    const ignoradas = [
      `// import { Client } from '${LIBRERIA}'`,
      ` * Unico archivo que importa \`${LIBRERIA}\`.`,
      `import { Redis } from '@upstash/redis'`,
    ]
    for (const forma of ignoradas) {
      const censo = new Map([[ficticio, sinComentarios(forma)]])
      expect(importadoresDe(censo), `la forma \`${forma}\` NO deberia detectarse`).toEqual([])
    }
  })
})
