import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { INVENTORY_ROUTE, finishedProductDetailRoute } from '@/lib/shared/routes';

/**
 * Contrato de la ficha de producto terminado: guardias de codigo, sin DOM. Lo que la ficha promete
 * NO hacer (escribir, incrustar su URL, traer su propio layout) no se ve renderizando; se ve en la
 * fuente.
 */

const RAIZ = join(__dirname, '..', '..', '..', '..');

function aPosix(ruta: string): string {
  return ruta.split('\\').join('/');
}

/** La carpeta sale de la funcion de rutas: `[id]` es el segmento dinamico del App Router. */
const CARPETA_RUTA = aPosix(
  join(
    'app',
    '(private)',
    ...finishedProductDetailRoute('[id]').split('/').filter((segmento) => segmento.length > 0),
  ),
);
const PAGE_PATH = `${CARPETA_RUTA}/page.tsx`;
const COMPONENTES_PATH = `${CARPETA_RUTA}/components`;
const BARREL_PATH = `${COMPONENTES_PATH}/index.ts`;

/** El segmento estatico propio de la ficha, derivado y no escrito a mano. */
const SEGMENTO_FICHA = `/${finishedProductDetailRoute('x').slice(INVENTORY_ROUTE.length + 1).split('/')[0]}`;

function leer(rutaRelativa: string): string {
  return readFileSync(join(RAIZ, rutaRelativa), 'utf8');
}

function esLineaDeComentario(linea: string): boolean {
  const limpia = linea.trim();
  return limpia.startsWith('//') || limpia.startsWith('*') || limpia.startsWith('/*');
}

function sinComentarios(codigo: string): string {
  return codigo
    .split('\n')
    .filter((linea) => !esLineaDeComentario(linea))
    .join('\n');
}

function fuentesBajo(carpetaRelativa: string): string[] {
  const encontradas: string[] = [];
  const recorrer = (directorio: string) => {
    for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
      const completa = join(directorio, entrada.name);
      if (entrada.isDirectory()) {
        recorrer(completa);
        continue;
      }
      if (entrada.name.endsWith('.ts') || entrada.name.endsWith('.tsx')) {
        encontradas.push(aPosix(relative(RAIZ, completa)));
      }
    }
  };
  recorrer(join(RAIZ, carpetaRelativa));
  return encontradas.sort();
}

const FUENTES_DE_LA_RUTA = fuentesBajo(CARPETA_RUTA);

/** Especificadores de import (estaticos, dinamicos y reexports) de un archivo. */
function especificadores(codigo: string): string[] {
  const encontrados: string[] = [];
  const patron = /(?:from\s+|import\s*\(\s*|import\s+)(['"])([^'"]+)\1/g;
  let encaje: RegExpExecArray | null;
  while ((encaje = patron.exec(sinComentarios(codigo))) !== null) encontrados.push(encaje[2]);
  return encontrados;
}

/** Los nombres importados de un especificador concreto, en cualquier import con llaves. */
function nombresImportadosDe(codigo: string, especificador: string): string[] {
  const nombres: string[] = [];
  const patron = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+(['"])([^'"]+)\2/g;
  let encaje: RegExpExecArray | null;
  while ((encaje = patron.exec(sinComentarios(codigo))) !== null) {
    if (encaje[3] !== especificador) continue;
    for (const parte of encaje[1].split(',')) {
      const nombre = parte.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0];
      if (nombre.length > 0) nombres.push(nombre);
    }
  }
  return nombres;
}

/** Cuerpo de la funcion exportada por defecto, sin la firma. */
function cuerpoDelDefault(codigo: string): string {
  const inicio = codigo.indexOf('export default async function');
  expect(inicio, 'la pagina debe exportar por defecto una funcion async').toBeGreaterThan(-1);
  const firmaCierra = codigo.indexOf(') {', inicio);
  return codigo.slice(firmaCierra + 3);
}

function primeraSentencia(codigo: string): string {
  return cuerpoDelDefault(codigo).trimStart().split('\n')[0].trim();
}

function saltaElBarrel(especificador: string): boolean {
  return /^\.\/components\/[^/]+/.test(especificador) || /producto-terminado\/\[id\]\/components\/[^/]+/.test(especificador);
}

const COMPONENTES_INVENTARIO = 'app/(private)/inventario/components';
const BARREL_INVENTARIO = `${COMPONENTES_INVENTARIO}/index.ts`;
const ESPECIFICADOR_INVENTARIO = '@/app/(private)/inventario/components';

/** La directiva solo cuenta como primera sentencia del modulo, tras comentarios y lineas vacias. */
function esModuloDeCliente(codigo: string): boolean {
  const primera = sinComentarios(codigo)
    .split('\n')
    .map((linea) => linea.trim())
    .find((linea) => linea.length > 0);
  return primera !== undefined && /^['"]use client['"];?$/.test(primera);
}

/** Nombres de valor (no `type`) importados de un especificador; un `import type {}` no cuenta. */
function valoresImportadosDe(codigo: string, especificador: string): string[] {
  const nombres: string[] = [];
  const patron = /import\s+(type\s+)?\{([^}]*)\}\s+from\s+(['"])([^'"]+)\3/g;
  let encaje: RegExpExecArray | null;
  while ((encaje = patron.exec(sinComentarios(codigo))) !== null) {
    if (encaje[1] !== undefined || encaje[4] !== especificador) continue;
    for (const parte of encaje[2].split(',')) {
      const limpia = parte.trim();
      if (limpia.length === 0 || limpia.startsWith('type ')) continue;
      nombres.push(limpia.split(/\s+as\s+/)[0]);
    }
  }
  return nombres;
}

function archivoDelModulo(especificador: string): string | null {
  const base = especificador.startsWith('@/')
    ? especificador.slice(2)
    : `${COMPONENTES_INVENTARIO}/${especificador.replace(/^\.\//, '')}`;
  for (const candidato of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    if (existsSync(join(RAIZ, candidato))) return candidato;
  }
  return null;
}

/** El archivo del que el barrel reexporta un nombre, o `null` si no lo reexporta. */
function origenEnElBarrel(barrel: string, nombre: string): string | null {
  const patron = /export\s*\{([^}]*)\}\s*from\s*(['"])([^'"]+)\2/g;
  let encaje: RegExpExecArray | null;
  while ((encaje = patron.exec(sinComentarios(barrel))) !== null) {
    const exportados = encaje[1].split(',').map((parte) => parte.trim().split(/\s+as\s+/).pop());
    if (exportados.includes(nombre)) return archivoDelModulo(encaje[3]);
  }
  return null;
}

const ACCIONES_DE_ESCRITURA = [
  '@/lib/modules/inventario/adapters/driving/product-actions',
  '@/lib/modules/inventario/adapters/driving/batch-actions',
  '@/lib/modules/inventario/adapters/driving/inventory-import-actions',
  '@/lib/modules/pedidos/adapters/driving/order-actions',
] as const;

const ACCIONES_DE_LECTURA = '@/lib/modules/inventario/adapters/driving/finished-product-actions';
const LECTURAS_PERMITIDAS = new Set([
  'getFinishedProductAction',
  'listFinishedProductBatchesAction',
  'listFinishedProductMovementsAction',
  'listFinishedProductDeliveriesAction',
  'listFinishedProductCostsAction',
]);

describe('contrato de la ficha de producto terminado', () => {
  it('la pantalla existe donde la ubica finishedProductDetailRoute, con su barrel', () => {
    expect(existsSync(join(RAIZ, PAGE_PATH)), `deberia existir ${PAGE_PATH}`).toBe(true);
    expect(existsSync(join(RAIZ, BARREL_PATH)), `deberia existir ${BARREL_PATH}`).toBe(true);
  });

  it("R1 — requirePagePermission('inventario.consultar') es la primera linea de la pagina", () => {
    expect(primeraSentencia(sinComentarios(leer(PAGE_PATH)))).toBe(
      "await requirePagePermission('inventario.consultar');",
    );
  });

  it('R1 — la guardia de la primera linea muerde con una pagina que lee antes de exigir el permiso', () => {
    const fabricada = [
      'export default async function Pagina({ params }) {',
      '  const { id } = await params;',
      "  await requirePagePermission('inventario.consultar');",
      '}',
    ].join('\n');
    expect(primeraSentencia(fabricada)).not.toContain('requirePagePermission');
  });

  it('R7, R36 — ningun archivo de la ruta importa una Server Action de escritura, tampoco la de anular entregas', () => {
    const hallazgos: string[] = [];

    for (const ruta of FUENTES_DE_LA_RUTA) {
      const codigo = leer(ruta);
      for (const especificador of especificadores(codigo)) {
        if ((ACCIONES_DE_ESCRITURA as readonly string[]).includes(especificador)) {
          hallazgos.push(`${ruta} -> ${especificador}`);
          continue;
        }
        if (/\/adapters\/driving\//.test(especificador) && especificador !== ACCIONES_DE_LECTURA) {
          if (!especificador.endsWith('/require-page-permission')) {
            hallazgos.push(`${ruta} -> ${especificador}`);
          }
        }
      }
      for (const nombre of nombresImportadosDe(codigo, ACCIONES_DE_LECTURA)) {
        if (!LECTURAS_PERMITIDAS.has(nombre) && !/Result$/.test(nombre)) {
          hallazgos.push(`${ruta} -> ${nombre}`);
        }
      }
      if (/voidDelivery/i.test(sinComentarios(codigo))) hallazgos.push(`${ruta} -> voidDelivery`);
    }

    expect(hallazgos).toEqual([]);
  });

  it('R7, R36 — la guardia de escritura muerde con una fuente fabricada', () => {
    const fabricada = [
      "import { voidDeliveryAction } from '@/lib/modules/pedidos/adapters/driving/order-actions';",
      "import { listProducedProductsAction } from '@/lib/modules/inventario/adapters/driving/finished-product-actions';",
    ].join('\n');
    expect(especificadores(fabricada)).toContain(ACCIONES_DE_ESCRITURA[3]);
    expect(nombresImportadosDe(fabricada, ACCIONES_DE_LECTURA)).toEqual(['listProducedProductsAction']);
    expect(LECTURAS_PERMITIDAS.has('listProducedProductsAction')).toBe(false);
  });

  it('R30 — ningun archivo de la ruta incrusta la direccion de la ficha', () => {
    const conElLiteral = FUENTES_DE_LA_RUTA.filter((ruta) =>
      sinComentarios(leer(ruta)).includes(SEGMENTO_FICHA),
    );
    expect(SEGMENTO_FICHA.length).toBeGreaterThan(1);
    expect(conElLiteral).toEqual([]);
  });

  it('sin main propio y sin layout propio', () => {
    for (const ruta of FUENTES_DE_LA_RUTA) {
      expect(ruta, 'la ruta no declara su propio layout').not.toMatch(/\/layout\.tsx$/);
      expect(sinComentarios(leer(ruta)), `${ruta} no declara un main`).not.toContain('<main');
    }
  });

  it('R16 — la ruta solo llama desde el servidor a valores del barrel de /inventario que no vienen de un modulo de cliente', () => {
    const barrel = leer(BARREL_INVENTARIO);
    const hallazgos: string[] = [];
    let importados = 0;

    for (const ruta of FUENTES_DE_LA_RUTA) {
      const codigo = leer(ruta);
      if (esModuloDeCliente(codigo)) continue;
      for (const nombre of valoresImportadosDe(codigo, ESPECIFICADOR_INVENTARIO)) {
        importados += 1;
        const origen = origenEnElBarrel(barrel, nombre);
        if (origen === null) {
          hallazgos.push(`${ruta} -> ${nombre} (no sale del barrel)`);
          continue;
        }
        if (esModuloDeCliente(leer(origen))) hallazgos.push(`${ruta} -> ${nombre} (${origen})`);
      }
    }

    expect(importados).toBeGreaterThan(0);
    expect(hallazgos).toEqual([]);

    const origenDeLaEtiqueta = origenEnElBarrel(barrel, 'movementReasonLabel');
    expect(origenDeLaEtiqueta).not.toBeNull();
    expect(esModuloDeCliente(leer(origenDeLaEtiqueta as string))).toBe(false);
  });

  it('R16 — la guardia de modulo de cliente muerde con fuentes fabricadas', () => {
    const barrelFabricado = "export { BatchHistory, movementReasonLabel } from './batch-history';";
    const origen = origenEnElBarrel(barrelFabricado, 'movementReasonLabel');
    expect(origen).toBe(`${COMPONENTES_INVENTARIO}/batch-history.tsx`);
    expect(esModuloDeCliente(leer(origen as string))).toBe(true);
    expect(esModuloDeCliente("// cabecera\n\"use client\";\nexport const x = 1;")).toBe(true);
    expect(
      valoresImportadosDe(
        `import { type A, b as c, D } from '${ESPECIFICADOR_INVENTARIO}';\nimport type { E } from '${ESPECIFICADOR_INVENTARIO}';`,
        ESPECIFICADOR_INVENTARIO,
      ),
    ).toEqual(['b', 'D']);
  });

  it('los componentes solo salen por el barrel, que no declara frontera de cliente', () => {
    const barrel = sinComentarios(leer(BARREL_PATH));
    expect(barrel).not.toMatch(/['"]use client['"]/);

    for (const ruta of FUENTES_DE_LA_RUTA) {
      if (!ruta.startsWith(`${COMPONENTES_PATH}/`) || ruta === BARREL_PATH) continue;
      const modulo = `./${(ruta.split('/').pop() as string).replace(/\.tsx?$/, '')}`;
      expect(barrel, `el barrel debe reexportar ${modulo}`).toContain(`from '${modulo}'`);
    }

    const pagina = leer(PAGE_PATH);
    expect(sinComentarios(pagina)).toContain("from './components'");
    expect(especificadores(pagina).filter(saltaElBarrel)).toEqual([]);

    const profundos: string[] = [];
    for (const carpeta of ['app', 'components', 'lib', 'hooks', 'tests']) {
      for (const ruta of fuentesBajo(carpeta)) {
        if (ruta.startsWith(`${COMPONENTES_PATH}/`)) continue;
        for (const especificador of especificadores(leer(ruta))) {
          if (especificador.startsWith('./components/') && !ruta.startsWith(`${CARPETA_RUTA}/`)) continue;
          if (saltaElBarrel(especificador)) profundos.push(`${ruta} -> ${especificador}`);
        }
      }
    }
    expect(profundos).toEqual([]);

    for (const entrada of readdirSync(join(RAIZ, CARPETA_RUTA), { withFileTypes: true })) {
      if (entrada.isDirectory()) {
        expect(entrada.name, 'la unica carpeta de la ruta es components/').toBe('components');
        continue;
      }
      expect(entrada.name, `${entrada.name} no es un archivo del App Router`).toBe('page.tsx');
    }
  });
});
