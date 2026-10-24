// Limites de FORMA de QT-296 (R36): el texto del prompt de catalogo no viaja en git -ningun
// archivo del diff vive bajo borradores-de-prompts/-, nadie fuera del adaptador de entorno lee
// CATALOG_PROMPT y la ficha no trae dependencias -ni package.json ni pnpm-lock.yaml en el diff-.
// Mismo enfoque que `tests/unit/documentos/qc158-alcance.test.ts` R36: el caso que solo mira un
// invariante del arbol actual (CATALOG_PROMPT) corre siempre, en cualquier rama; los que miran el
// DIFF de esta ficha contra `origin/dev` (o `dev`) se saltan ruidosamente fuera de su rama. Los
// detectores son puros y se prueban aparte con una entrada infractora inventada, sin copiar el
// texto real del prompt.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    try {
      readFileSync(join(dir, 'package.json'));
      return dir;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) throw new Error(`no se encontro package.json subiendo desde ${startDir}`);
      dir = parent;
    }
  }
}

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));

function enDisco(rutaRelativa: string): string {
  return readFileSync(join(repoRoot, rutaRelativa), 'utf8');
}

// ---------------------------------------------------------------------------------------------
// GIT: BASE DE FUSION Y DIFF
// ---------------------------------------------------------------------------------------------

const RAMA_DE_LA_FICHA = 'feature/QT-296-tipo-y-subtipo-de-empaque-backend';
const CARPETA_SPEC = 'specs/QT-296-tipo-y-subtipo-de-empaque-backend/';
const BASES = ['origin/dev', 'dev'] as const;

function git(args: readonly string[]): string | null {
  try {
    return execFileSync('git', ['-c', 'core.quotepath=off', ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function lineas(salida: string | null): string[] {
  if (salida === null) return [];
  return salida
    .split('\n')
    .map((linea) => linea.trim())
    .filter((linea) => linea.length > 0);
}

function ramaActual(): string | null {
  const rama = git(['rev-parse', '--abbrev-ref', 'HEAD'])?.trim();
  return rama === undefined || rama.length === 0 ? null : rama;
}

function mergeBaseDeLaRama(): string | null {
  for (const base of BASES) {
    const sha = git(['merge-base', base, 'HEAD'])?.trim();
    if (sha !== undefined && sha.length > 0) return sha;
  }
  return null;
}

/** Lo commiteado desde la base, lo que aun no se commitea y lo nuevo sin seguimiento. */
function diffDeLaRamaONulo(mergeBase: string): readonly string[] | null {
  const seguidos = git(['diff', '--name-only', mergeBase]);
  const sinSeguimiento = git(['ls-files', '--others', '--exclude-standard']);
  if (seguidos === null || sinSeguimiento === null) return null;
  return [...new Set([...lineas(seguidos), ...lineas(sinSeguimiento)])].sort();
}

export type Preparacion =
  | { readonly tipo: 'saltar'; readonly motivo: string }
  | { readonly tipo: 'fallar'; readonly motivo: string }
  | { readonly tipo: 'medir'; readonly mergeBase: string };

/** La precondicion para los casos que exigen estar EN la rama de la ficha. Pura: se prueba sin git. */
export function preparar(rama: string | null, mergeBase: string | null): Preparacion {
  if (rama === null) {
    return { tipo: 'saltar', motivo: 'no se pudo leer la rama actual con git: este caso NO ha comprobado nada.' };
  }
  if (rama !== RAMA_DE_LA_FICHA) {
    return {
      tipo: 'saltar',
      motivo:
        `la rama actual es '${rama}' y no '${RAMA_DE_LA_FICHA}': este caso habla de lo que hace ` +
        'ESTA ficha, no de lo que haga quien pase despues. Este caso NO ha comprobado nada.',
    };
  }
  if (mergeBase === null) {
    return {
      tipo: 'fallar',
      motivo:
        `estamos en '${RAMA_DE_LA_FICHA}' y no se pudo calcular el merge-base con ${BASES.join(' ni con ')}: ` +
        'la guardia no puede mirar el diff de su propia ficha, y eso es rojo.',
    };
  }
  return { tipo: 'medir', mergeBase };
}

const rama = ramaActual();
const base = mergeBaseDeLaRama();

/** El diff de la ficha, o `null` si el caso se salto. Falla si el rango esta mal calculado. */
function diffOSalto(ctx: { skip: (nota?: string) => void }): readonly string[] | null {
  const listo = preparar(rama, base);
  if (listo.tipo === 'saltar') {
    ctx.skip(listo.motivo);
    return null;
  }
  if (listo.tipo === 'fallar') throw new Error(listo.motivo);
  const diff = diffDeLaRamaONulo(listo.mergeBase);
  if (diff === null) throw new Error('git no pudo calcular el diff de la rama: este caso NO ha comprobado nada.');
  if (!diff.some((archivo) => archivo.startsWith(CARPETA_SPEC))) {
    throw new Error(
      `el diff contra ${listo.mergeBase} no trae nada bajo ${CARPETA_SPEC}: el rango esta mal calculado y ` +
        'este caso pasaria en verde sin haber mirado el cambio de QT-296.',
    );
  }
  return diff;
}

describe('QT-296 — la precondicion de rama', () => {
  it('R36 — fuera de la rama de la ficha se salta ruidosamente, y en ella mide o falla', () => {
    const enDev = preparar('dev', 'abc123');
    expect(enDev.tipo).toBe('saltar');
    expect((enDev as { motivo: string }).motivo).toContain('NO ha comprobado nada');
    expect(preparar('feature/QC-999-lo-que-venga', 'abc123').tipo).toBe('saltar');
    expect(preparar(null, 'abc123').tipo).toBe('saltar');

    expect(preparar(RAMA_DE_LA_FICHA, null).tipo).toBe('fallar');
    expect(preparar(RAMA_DE_LA_FICHA, 'abc123')).toEqual({ tipo: 'medir', mergeBase: 'abc123' });
  });
});

// ---------------------------------------------------------------------------------------------
// R36a — NINGUN ARCHIVO DEL DIFF ESTA BAJO borradores-de-prompts/
// ---------------------------------------------------------------------------------------------

export function infraccionesDeBorrador(archivos: readonly string[]): string[] {
  return archivos.filter((archivo) => archivo.replace(/\\/g, '/').startsWith('borradores-de-prompts/')).sort();
}

describe('QT-296 R36a — el borrador del prompt de catalogo no viaja en el diff', () => {
  it('R36 — ningun archivo del diff contra dev vive bajo borradores-de-prompts/', (ctx) => {
    const diff = diffOSalto(ctx);
    if (diff === null) return;

    const infracciones = infraccionesDeBorrador(diff);
    expect(
      infracciones,
      'R36: el borrador del prompt vive fuera de git (TP lo ajusta ahi); ninguna version de el ' +
        `debe colarse en el diff de la ficha. Hallazgos:\n${infracciones.join('\n')}`,
    ).toEqual([]);
  });

  it('R36 — el detector muerde con una ruta bajo borradores-de-prompts/ y no con una que solo se le parece', () => {
    expect(
      infraccionesDeBorrador([
        'borradores-de-prompts/catalogo.md',
        'borradores-de-prompts\\sub\\otro.md',
        'docs/borradores-de-prompts.md',
        'lib/modules/documentos/domain/catalog-extraction.ts',
      ]),
    ).toEqual(['borradores-de-prompts/catalogo.md', 'borradores-de-prompts\\sub\\otro.md']);
    expect(infraccionesDeBorrador([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// R36b — NADIE FUERA DE strategy-prompt-env.ts LEE CATALOG_PROMPT
// ---------------------------------------------------------------------------------------------
//
// Es un invariante del arbol, asi que corre en cualquier rama. Se barren las raices de
// produccion: en `tests/` y `e2e/` el nombre aparece para PONER la variable o comprobar el
// mensaje que la nombra. `playwright.config.ts` no la lee: le PONE un texto ficticio para que el
// E2E corra sin red (la misma excepcion que fija QC-158 R36b).

export const ARCHIVOS_PERMITIDOS_PARA_CATALOG_PROMPT = [
  'lib/modules/documentos/adapters/driven/config/strategy-prompt-env.ts',
  'playwright.config.ts',
] as const;

const RAICES_DE_PRODUCCION = ['lib', 'app', 'components', 'db', 'middleware.ts', 'next.config.ts', 'playwright.config.ts'] as const;

export function infraccionesDeLecturaDelPrompt(archivos: readonly { ruta: string; fuente: string }[]): string[] {
  const hallazgos: string[] = [];
  for (const { ruta, fuente } of archivos) {
    const rutaNormalizada = ruta.replace(/\\/g, '/');
    if ((ARCHIVOS_PERMITIDOS_PARA_CATALOG_PROMPT as readonly string[]).includes(rutaNormalizada)) continue;
    if (fuente.includes('CATALOG_PROMPT')) hallazgos.push(rutaNormalizada);
  }
  return hallazgos.sort();
}

describe('QT-296 R36b — CATALOG_PROMPT solo se lee en el adaptador de entorno', () => {
  it('R36 — ningun archivo de produccion fuera de strategy-prompt-env.ts (y de playwright.config.ts, que la pone) nombra CATALOG_PROMPT', () => {
    const salida = git(['ls-files', ...RAICES_DE_PRODUCCION]);
    expect(salida, 'git no pudo listar las raices de produccion: R36 NO se ha comprobado.').not.toBeNull();

    const archivos = lineas(salida).map((ruta) => ({ ruta, fuente: enDisco(ruta) }));
    expect(archivos.length, 'no se ha leido ningun archivo de produccion').toBeGreaterThan(0);

    const infracciones = infraccionesDeLecturaDelPrompt(archivos);
    expect(
      infracciones,
      'R36: el texto del prompt entra por una unica puerta; leerlo en otro sitio es una segunda ' +
        `puerta que nadie vigila. Hallazgos:\n${infracciones.join('\n')}`,
    ).toEqual([]);
  });

  it('R36 — el detector muerde con un archivo de produccion ajeno que nombra la variable, y no con los permitidos', () => {
    expect(
      infraccionesDeLecturaDelPrompt([
        { ruta: 'lib/modules/documentos/domain/catalog-extraction.ts', fuente: 'const p = process.env.CATALOG_PROMPT;\n' },
        { ruta: 'lib/modules/documentos/adapters/driven/config/strategy-prompt-env.ts', fuente: "catalogo: 'CATALOG_PROMPT',\n" },
        { ruta: 'playwright.config.ts', fuente: "CATALOG_PROMPT: 'prompt ficticio',\n" },
        { ruta: 'lib/modules/inventario/domain/packaging-subtype.ts', fuente: "export const CAP = 'CAP';\n" },
      ]),
    ).toEqual(['lib/modules/documentos/domain/catalog-extraction.ts']);
  });
});

// ---------------------------------------------------------------------------------------------
// R36c — SIN DEPENDENCIA NUEVA: NI package.json NI pnpm-lock.yaml EN EL DIFF
// ---------------------------------------------------------------------------------------------

const MANIFIESTOS = ['package.json', 'pnpm-lock.yaml'] as const;

export function manifiestosEnElDiff(archivos: readonly string[]): string[] {
  return archivos
    .map((archivo) => archivo.replace(/\\/g, '/'))
    .filter((archivo) => (MANIFIESTOS as readonly string[]).includes(archivo))
    .sort();
}

describe('QT-296 R36c — la ficha no trae dependencias', () => {
  it('R36 — el diff contra dev no trae package.json ni pnpm-lock.yaml', (ctx) => {
    const diff = diffOSalto(ctx);
    if (diff === null) return;

    const tocados = manifiestosEnElDiff(diff);
    expect(
      tocados,
      `R36: esta ficha versiona solo el contrato JSON; no trae ninguna libreria. Tocados: ${tocados.join(', ')}`,
    ).toEqual([]);
  });

  it('R36 — el detector muerde con los manifiestos de la raiz y no con uno anidado o con otro nombre', () => {
    expect(
      manifiestosEnElDiff([
        'package.json',
        'pnpm-lock.yaml',
        'packages/otro/package.json',
        'docs/package.json.md',
        'lib/modules/inventario/index.ts',
      ]),
    ).toEqual(['package.json', 'pnpm-lock.yaml']);
    expect(manifiestosEnElDiff([])).toEqual([]);
  });
});
