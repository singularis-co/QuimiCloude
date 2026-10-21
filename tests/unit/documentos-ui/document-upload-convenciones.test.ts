// Guardias de ausencia de la pieza de subida: lo que NO puede aparecer. Se leen los archivos del
// componente y los del repo que podrian delatar un montaje, una ruta o un permiso nuevos.
//
// Cubre R9, R15, R16, R18, R19 y R22 (`specs/QC-107-componente-de-carga-de-archivos/tasks.md > T10`).

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { MAX_FILES_PER_BATCH } from '@/lib/modules/documentos';
import { DOCUMENT_UPLOAD_PERMISSION } from '@/lib/modules/documentos/domain/actor';
import { PERMISSIONS } from '@/lib/modules/identity';
import { FORMULAS_ROUTE } from '@/lib/shared/routes';

const RAIZ = join(__dirname, '..', '..', '..');

const CARPETA_DEL_COMPONENTE = 'components/shared/document-upload';

/**
 * Donde el montaje de la ventana de subida esta permitido: QC-159 le da a cada fila de fórmula un
 * enlace de revisión (`reviewHrefFor`), y esa función no puede cruzar del Server Component
 * (`page.tsx`) al cliente. Por eso el listado de fórmulas deja de montar el diálogo directo y pasa
 * a montarlo, como ya hacía el detalle de proveedor, a través de un envoltorio de cliente propio.
 */
const PANTALLA_CON_MONTAJE = 'app/(private)/proveedores/[id]/components/catalog-pdf-upload.tsx';
const PAGINA_DEL_PROVEEDOR = 'app/(private)/proveedores/[id]/page.tsx';

/** La carpeta de las pantallas de formulas, DERIVADA de la constante de ruta. */
const CARPETA_DE_FORMULAS = `app/(private)${FORMULAS_ROUTE}`;
const PAGINA_DE_FORMULAS = `${CARPETA_DE_FORMULAS}/page.tsx`;
const ENVOLTORIO_DE_FORMULAS = `${CARPETA_DE_FORMULAS}/components/formula-pdf-upload.tsx`;

/** Los dos y unicos puntos de montaje de la pieza: ambos, envoltorios de cliente. */
const MONTAJES_PERMITIDOS = [ENVOLTORIO_DE_FORMULAS, PANTALLA_CON_MONTAJE].sort();

/** Lo que identifica al componente alla donde se importe. */
const MARCAS_DEL_COMPONENTE = ['document-upload', 'DocumentUpload'] as const;

function aPosix(ruta: string): string {
  return ruta.split('\\').join('/');
}

function leer(rutaRelativa: string): string {
  return readFileSync(join(RAIZ, rutaRelativa), 'utf8');
}

/**
 * Fuente sin comentarios: estas guardias miran codigo, no prosa. Sin esto, una cabecera que
 * explica por que algo esta prohibido pondria roja la guardia que lo prohibe.
 */
function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');
}

function fuentesBajo(carpeta: string): string[] {
  const encontradas: string[] = [];

  const recorrer = (directorio: string) => {
    for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
      const completa = join(directorio, entrada.name);
      if (entrada.isDirectory()) {
        if (entrada.name === 'node_modules' || entrada.name === '.next') continue;
        recorrer(completa);
        continue;
      }
      if (entrada.name.endsWith('.ts') || entrada.name.endsWith('.tsx')) {
        encontradas.push(aPosix(relative(RAIZ, completa)));
      }
    }
  };

  recorrer(join(RAIZ, carpeta));
  return encontradas.sort();
}

const FUENTES_DEL_COMPONENTE = fuentesBajo(CARPETA_DEL_COMPONENTE);
const CODIGO_DEL_COMPONENTE = FUENTES_DEL_COMPONENTE.map((ruta) => ({
  ruta,
  codigo: sinComentarios(leer(ruta)),
}));

/** El codigo sin sus lineas de import: lo que el archivo DECLARA, no lo que trae del contrato. */
function sinImportes(codigo: string): string {
  return codigo.replace(/import[\s\S]*?from\s+'[^']+';/g, ' ');
}

/** Los `from '<lo que sea>'` de un archivo. */
function importesDe(codigo: string): string[] {
  return [...codigo.matchAll(/from\s+'([^']+)'/g)].map((coincidencia) => coincidencia[1] ?? '');
}

/** Un import es de un paquete cuando no es relativo ni entra por el alias del repo. */
function esPaquete(especificador: string): boolean {
  return !especificador.startsWith('.') && !especificador.startsWith('@/');
}

describe('lo que la pieza de subida NO trae', () => {
  it('no anade ninguna dependencia: el sondeo se resuelve con la plataforma (R9)', () => {
    expect(FUENTES_DEL_COMPONENTE.length).toBeGreaterThan(0);

    const paquetes = new Set(
      CODIGO_DEL_COMPONENTE.flatMap(({ codigo }) => importesDe(codigo)).filter(esPaquete),
    );

    // `react` para el sondeo (`useEffect` + `setTimeout`) y `lucide-react` para los iconos, ya
    // en el stack; el enlace de revision llega por `ArrowLink`: nada mas.
    expect([...paquetes].sort()).toEqual(['lucide-react', 'react']);

    const manifiesto = JSON.parse(leer('package.json')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const declaradas = { ...manifiesto.dependencies, ...manifiesto.devDependencies };
    for (const candidata of ['swr', '@tanstack/react-query', 'react-dropzone', 'axios']) {
      expect(declaradas, `${candidata} entro en el manifiesto`).not.toHaveProperty(candidata);
    }
  });

  it('no abre ninguna suscripcion de tiempo real ni incorpora el cliente de Supabase (R15)', () => {
    for (const { ruta, codigo } of CODIGO_DEL_COMPONENTE) {
      expect(codigo, ruta).not.toMatch(
        /supabase|createClient|realtime|\.channel\(|\.subscribe\(|new WebSocket|EventSource/i,
      );
    }
  });

  it('no emite ningun aviso ni notificacion cuando una tanda termina (R16)', () => {
    for (const { ruta, codigo } of CODIGO_DEL_COMPONENTE) {
      expect(codigo, ruta).not.toMatch(
        /sonner|toast|Notification\(|requestPermission|navigator\.vibrate|window\.alert/i,
      );
    }
  });

  it('no anade ninguna ruta, constante de ruta ni item de menu propios de documentos (R19)', () => {
    const rutas = sinComentarios(leer('lib/shared/routes.ts'));
    expect(rutas).not.toMatch(/documento/i);
    expect(rutas).not.toMatch(/\/subida|\/cargas/i);

    const menu = sinComentarios(leer('lib/shared/navigation/private-nav.ts'));
    expect(menu).not.toMatch(/documento/i);

    expect(existsSync(join(RAIZ, 'app/(private)/documentos'))).toBe(false);

    // Enmienda: el listado de formulas ya no monta el dialogo directo (necesita `reviewHrefFor`,
    // que no cruza del Server Component al cliente), asi que pasa por su propio envoltorio de
    // cliente, igual que el detalle de proveedor. Los dos montajes siguen siendo envoltorios.
    const paginasQueLoMontan = fuentesBajo('app')
      .filter((ruta) => ruta.endsWith('.tsx'))
      .filter((ruta) =>
        MARCAS_DEL_COMPONENTE.some((marca) => sinComentarios(leer(ruta)).includes(marca)),
      );
    expect(paginasQueLoMontan).toEqual(MONTAJES_PERMITIDOS);

    // Y la pantalla del proveedor usa ese envoltorio, nunca el componente directo.
    const pagina = sinComentarios(leer(PAGINA_DEL_PROVEEDOR));
    expect(pagina).not.toMatch(/DocumentUpload/);
    expect(pagina).toContain('CatalogPdfUpload');
  });

  it('el tope y los tipos se importan del contrato del modulo y no se reescriben (R22)', () => {
    const componente = CODIGO_DEL_COMPONENTE.find(({ ruta }) =>
      ruta.endsWith('document-upload.tsx'),
    );
    expect(componente).toBeDefined();
    expect(componente?.codigo).toMatch(
      /import\s+\{[^}]*MAX_FILES_PER_BATCH[^}]*\}\s+from\s+'@\/lib\/modules\/documentos'/,
    );
    expect(componente?.codigo).toMatch(
      /import\s+\{[^}]*PdfStrategy[^}]*\}\s+from\s+'@\/lib\/modules\/documentos'/,
    );

    // Las etiquetas se indexan por el tipo del modulo: un quinto estado no compilaria.
    const etiquetas = CODIGO_DEL_COMPONENTE.find(({ ruta }) => ruta.endsWith('labels.ts'));
    expect(etiquetas?.codigo).toContain('Record<DocumentFileStatus, string>');

    for (const { ruta, codigo } of CODIGO_DEL_COMPONENTE) {
      // Ni el tope reescrito a mano...
      expect(codigo, ruta).not.toMatch(new RegExp(`\\b${MAX_FILES_PER_BATCH}\\b`));
      // ...ni ninguno de los tipos redeclarado en la capa de interfaz.
      expect(sinImportes(codigo), ruta).not.toMatch(
        /(type|interface)\s+(PdfStrategy|DocumentFileStatus|DocumentFileStatusEntry|BatchStatus)\b/,
      );
      // ...ni la estrategia escrita como literal: llega por la prop.
      expect(codigo, ruta).not.toMatch(/'(catalogo|formula)'/);
    }
  });

  it('la unica fuente de formulas que monta la pieza es su envoltorio de cliente, y no aparece ningun permiso nuevo (R18)', () => {
    const fuentesDeFormulas = fuentesBajo(CARPETA_DE_FORMULAS);
    expect(fuentesDeFormulas.length).toBeGreaterThan(0);

    // Enmienda: el listado de formulas deja de montar la pieza directo y pasa a montarla a
    // traves de `components/formula-pdf-upload.tsx` (necesita `reviewHrefFor`, y una funcion no
    // cruza del Server Component al cliente); `page.tsx`, `nueva/` y `[id]/` no la montan.
    const queLaMontan = fuentesDeFormulas.filter((ruta) => {
      const codigo = sinComentarios(leer(ruta));
      return MARCAS_DEL_COMPONENTE.some((marca) => codigo.includes(marca));
    });
    expect(queLaMontan).toEqual([aPosix(ENVOLTORIO_DE_FORMULAS)]);

    // Y la pagina del listado usa ese envoltorio, nunca el componente directo.
    const pagina = sinComentarios(leer(PAGINA_DE_FORMULAS));
    expect(pagina).not.toMatch(/DocumentUpload/);
    expect(pagina).toContain('FormulaPdfUpload');

    // Y no se le presta el permiso de proveedores para poder subir desde ahi.
    for (const ruta of fuentesDeFormulas) {
      expect(sinComentarios(leer(ruta)), ruta).not.toMatch(/proveedores\.\w+/);
    }

    // El catalogo gano un permiso propio de documentos: los unicos codigos que casan con este
    // patron son exactamente esos dos, sin ningun otro `subir` ni `carga`.
    const codigos = PERMISSIONS.map((permiso) => permiso.code);
    const quePareceDeSubida = codigos.filter((codigo) => /documento|subir|carga/i.test(codigo));
    expect(quePareceDeSubida.sort()).toEqual(['documentos.consultar', 'documentos.modificar']);

    // Lo que el modulo exige es un codigo que vive en el catalogo, no un string suelto sin registrar.
    expect(codigos).toContain(DOCUMENT_UPLOAD_PERMISSION);

    // El componente no nombra ningun permiso: quien autoriza es el caso de uso.
    for (const { ruta, codigo } of CODIGO_DEL_COMPONENTE) {
      expect(codigo, ruta).not.toMatch(/permission|permiso/i);
    }
  });
});

/** Si una fuente escribe el literal del permiso de subida en vez de llamar al predicado. */
function escribeElLiteralDePermiso(codigo: string): boolean {
  return /documentos\.modificar/.test(codigo);
}

/** Si una fuente llama al predicado del modulo para decidir si se monta la pieza. */
function llamaAlPredicadoDeSubida(codigo: string): boolean {
  return /canUploadDocuments\(/.test(codigo);
}

/** Si una fuente nombra un permiso o un rol a mano, en vez de dejarlo en manos del caso de uso. */
function nombraUnPermisoOUnRol(codigo: string): boolean {
  return /permission|permiso|roleName/i.test(codigo);
}

describe('quien decide el montaje es el servidor, nunca la pieza (R12)', () => {
  const PAGINAS_QUE_MONTAN = [PAGINA_DE_FORMULAS, PAGINA_DEL_PROVEEDOR];

  it('ninguna pagina de app/ escribe el literal del permiso de subida', () => {
    const paginas = fuentesBajo('app');
    expect(paginas.length).toBeGreaterThan(0);

    const infractoras = paginas.filter((ruta) => escribeElLiteralDePermiso(sinComentarios(leer(ruta))));
    expect(infractoras).toEqual([]);
  });

  it('las dos paginas que montan la pieza llaman a canUploadDocuments', () => {
    for (const ruta of PAGINAS_QUE_MONTAN) {
      expect(llamaAlPredicadoDeSubida(sinComentarios(leer(ruta))), ruta).toBe(true);
    }
  });

  it('ningun fuente de la carpeta del componente nombra un permiso o un rol', () => {
    for (const { ruta, codigo } of CODIGO_DEL_COMPONENTE) {
      expect(nombraUnPermisoOUnRol(codigo), ruta).toBe(false);
    }
  });

  it('los tres detectores muerden con un texto de ejemplo malo y no con uno bueno', () => {
    expect(escribeElLiteralDePermiso("assertPermission(actor, 'documentos.modificar')")).toBe(true);
    expect(escribeElLiteralDePermiso("canUploadDocuments(await identity.getSessionUser())")).toBe(false);

    expect(llamaAlPredicadoDeSubida('const canUpload = canUploadDocuments(actor);')).toBe(true);
    expect(llamaAlPredicadoDeSubida('const canUpload = true;')).toBe(false);

    expect(nombraUnPermisoOUnRol('if (actor.roleName === "admin") return true;')).toBe(true);
    expect(nombraUnPermisoOUnRol('const strategy = props.strategy;')).toBe(false);
  });
});

/** Si un import trae el dialogo directamente de la libreria en vez de la primitiva del repo. */
function importaElDialogoDeBaseUiDirecto(codigo: string): boolean {
  return /from\s+'@base-ui\/react/.test(codigo);
}

describe('la ventana de subida usa la primitiva de dialogo existente (R20)', () => {
  it('la carpeta del componente importa el dialogo solo de la primitiva del repo, nunca de @base-ui/react', () => {
    for (const { ruta, codigo } of CODIGO_DEL_COMPONENTE) {
      expect(importaElDialogoDeBaseUiDirecto(codigo), ruta).toBe(false);
    }
  });

  it('el detector muerde con un ejemplo malo y no con uno bueno', () => {
    expect(importaElDialogoDeBaseUiDirecto("import { Dialog } from '@base-ui/react/dialog';")).toBe(
      true,
    );
    expect(
      importaElDialogoDeBaseUiDirecto("import { Dialog } from '@/components/ui/dialog';"),
    ).toBe(false);
  });
});

/** Ancho máximo de línea de los archivos de producción de QC-306 (P8 de su spec). */
const ANCHO_MAXIMO = 100;

/**
 * Los archivos de producción que toca QC-306: toda la carpeta de la pieza (recorrida, para que un
 * archivo nuevo entre solo) y el envoltorio, el barrel y la página de fórmulas.
 */
const ARCHIVOS_CON_FORMATO = [
  ...FUENTES_DEL_COMPONENTE,
  ENVOLTORIO_DE_FORMULAS,
  `${CARPETA_DE_FORMULAS}/components/index.ts`,
  PAGINA_DE_FORMULAS,
];

/** Las líneas de una fuente que superan el ancho máximo, como `archivo:línea (columnas)`. */
function lineasLargas(ruta: string, fuente: string): string[] {
  return fuente
    .split(/\r?\n/)
    .map((linea, indice) => ({ numero: indice + 1, columnas: [...linea].length }))
    .filter(({ columnas }) => columnas > ANCHO_MAXIMO)
    .map(({ numero, columnas }) => `${ruta}:${numero} (${columnas})`);
}

describe('formato de los archivos de producción de la pieza (QC-306)', () => {
  it('R36, R37 — cada archivo termina con salto de línea final y ninguna línea pasa de 100 columnas', () => {
    expect(FUENTES_DEL_COMPONENTE.length).toBeGreaterThan(0);

    const sinSaltoFinal = ARCHIVOS_CON_FORMATO.filter((ruta) => !leer(ruta).endsWith('\n'));
    expect(sinSaltoFinal).toEqual([]);

    const largas = ARCHIVOS_CON_FORMATO.flatMap((ruta) => lineasLargas(ruta, leer(ruta)));
    expect(largas).toEqual([]);
  });

  it('el detector de líneas largas muerde con 101 columnas y no con 100', () => {
    expect(lineasLargas('x.ts', `${'a'.repeat(100)}\n`)).toEqual([]);
    expect(lineasLargas('x.ts', `ok\n${'a'.repeat(101)}\n`)).toEqual(['x.ts:2 (101)']);
  });
});

/** Las celdas de una fila de tabla Markdown, sin los bordes. */
function celdasDe(fila: string): string[] {
  return fila
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((celda) => celda.trim());
}

describe('la fila de la pieza en el catálogo de componentes (QC-306)', () => {
  it('R38 — la fila de DocumentBatchPanel cita en Diseño el tablero del panel y no declara la sincronía entre pestañas como no cubierta', () => {
    const catalogo = leer('components/shared/CATALOGO.md');
    const fila = catalogo
      .split(/\r?\n/)
      .find((linea) => linea.startsWith('| `DocumentBatchPanel`'));
    expect(fila, 'falta la fila de DocumentBatchPanel').toBeDefined();

    const celdas = celdasDe(fila ?? '');
    expect(celdas).toHaveLength(7);
    const alcance = celdas[3] ?? '';
    const diseno = celdas[6] ?? '';

    const tableros = [...diseno.matchAll(/docs\/diseno\/canvas\/([\w-]+)\.dc\.html/g)];
    expect(tableros.length, `Diseño = «${diseno}»`).toBeGreaterThan(0);
    for (const [ruta, nombre] of tableros) {
      expect(existsSync(join(RAIZ, ruta)), ruta).toBe(true);
      expect(['Formulas', 'ModalesProduccion'], ruta).not.toContain(nombre);
    }

    const noCubre = alcance.split('No cubre:')[1] ?? '';
    expect(noCubre).not.toMatch(/entre pestañas/);
  });
});
