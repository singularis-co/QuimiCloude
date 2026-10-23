// Guardia: las pantallas de un añadido que no tienen permiso propio (las de importar) cortan con
// `requirePageAddon('<añadido>')`. Sin esa línea la pantalla compila, pinta y queda abierta a una
// empresa con el añadido apagado; nada más se pondría rojo.
//
// Mismo patrón que `guard-pantallas-exigen-permiso.test.ts`: barrido del árbol real, funciones
// puras, casos sintéticos que demuestran que la regla dispara y un ancla anti-vacuidad.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ADDONS, type Addon } from '@/lib/modules/identity';

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

const PRIVATE_ROOT = ['app', '(private)'] as const;
const NON_ROUTE_DIRS = new Set(['components']);
const SEGMENTO_DE_ANADIDO = 'importar';

/** Pantalla → añadido que la corta. Una pantalla `importar` nueva tiene que entrar aquí. */
export const PANTALLAS_DE_ANADIDO: Readonly<Record<string, Addon>> = {
  'app/(private)/inventario/importar/page.tsx': 'importacion_excel',
  'app/(private)/produccion/formulas/importar/[documentoId]/page.tsx': 'lectura_pdf',
  'app/(private)/proveedores/[id]/importar/[documentoId]/page.tsx': 'lectura_pdf',
};

export type Pantalla = { readonly file: string; readonly segments: readonly string[]; readonly source: string };

/** Los comentarios no ejecutan: primero los de línea y después los de bloque. */
export function stripComments(source: string): string {
  return source
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
}

export function listPrivatePages(root: string): readonly Pantalla[] {
  function walk(dir: string, segments: readonly string[]): readonly Pantalla[] {
    let names: readonly string[] = [];
    try {
      names = readdirSync(dir);
    } catch {
      return [];
    }
    const propias: readonly Pantalla[] = names.includes('page.tsx')
      ? [
          {
            file: [...PRIVATE_ROOT, ...segments, 'page.tsx'].join('/'),
            segments,
            source: readFileSync(join(dir, 'page.tsx'), 'utf8'),
          },
        ]
      : [];
    const hijas = names
      .filter((name) => !NON_ROUTE_DIRS.has(name) && statSync(join(dir, name)).isDirectory())
      .flatMap((name) => walk(join(dir, name), [...segments, name]));
    return [...propias, ...hijas];
  }
  return walk(join(root, ...PRIVATE_ROOT), []);
}

export function extractRequiredAddons(sourceSinComentarios: string): readonly string[] {
  const patron = /requirePageAddon\(\s*(['"`])([^'"`]*)\1\s*\)/g;
  return [...sourceSinComentarios.matchAll(patron)].map((match) => match[2] ?? '');
}

export type Infraccion =
  | { readonly clase: 'fuera-del-mapa'; readonly file: string }
  | { readonly clase: 'sin-llamada'; readonly file: string; readonly addon: Addon }
  | { readonly clase: 'otro-anadido'; readonly file: string; readonly addon: Addon; readonly found: readonly string[] }
  | { readonly clase: 'mapa-sin-pantalla'; readonly file: string };

export function findInfracciones(
  pantallas: readonly Pantalla[],
  mapa: Readonly<Record<string, Addon>>,
): readonly Infraccion[] {
  const porArchivo = new Map(pantallas.map((pantalla) => [pantalla.file, pantalla]));
  const fueraDelMapa = pantallas
    .filter((pantalla) => pantalla.segments.includes(SEGMENTO_DE_ANADIDO) && !(pantalla.file in mapa))
    .map((pantalla): Infraccion => ({ clase: 'fuera-del-mapa', file: pantalla.file }));
  const delMapa = Object.entries(mapa).flatMap(([file, addon]): readonly Infraccion[] => {
    const pantalla = porArchivo.get(file);
    if (pantalla === undefined) return [{ clase: 'mapa-sin-pantalla', file }];
    const found = extractRequiredAddons(stripComments(pantalla.source));
    if (found.length === 0) return [{ clase: 'sin-llamada', file, addon }];
    if (found.length !== 1 || found[0] !== addon) return [{ clase: 'otro-anadido', file, addon, found }];
    return [];
  });
  return [...fueraDelMapa, ...delMapa];
}

function describir(infracciones: readonly Infraccion[]): string {
  return infracciones
    .map((i) => {
      switch (i.clase) {
        case 'fuera-del-mapa':
          return `${i.file}: pantalla de importar sin entrada en PANTALLAS_DE_ANADIDO`;
        case 'sin-llamada':
          return `${i.file}: no llama a requirePageAddon('${i.addon}')`;
        case 'otro-anadido':
          return `${i.file}: exige ${JSON.stringify(i.found)} y debe exigir solo '${i.addon}'`;
        case 'mapa-sin-pantalla':
          return `${i.file}: está en PANTALLAS_DE_ANADIDO pero la página no existe`;
      }
    })
    .join('; ');
}

const CON_CORTE = (addon: string) =>
  `export default async function Page() {\n  await requirePagePermission('inventario.modificar');\n  await requirePageAddon('${addon}');\n  return null;\n}\n`;
const SIN_CORTE =
  "// requirePageAddon('importacion_excel') en un comentario no cuenta\nexport default async function Page() {\n  await requirePagePermission('inventario.modificar');\n  return null;\n}\n";

describe('guardia: pantallas de añadido sin permiso propio', () => {
  const pantallas = listPrivatePages(repoRoot);

  it('R13, R23: ancla anti-vacuidad: el barrido encuentra pantallas privadas y las tres de importar', () => {
    expect(pantallas.length).toBeGreaterThan(10);
    const deImportar = pantallas.filter((p) => p.segments.includes(SEGMENTO_DE_ANADIDO)).map((p) => p.file);
    for (const file of Object.keys(PANTALLAS_DE_ANADIDO)) expect(deImportar).toContain(file);
  });

  it('R13, R23: el mapa solo nombra añadidos del catálogo', () => {
    for (const addon of Object.values(PANTALLAS_DE_ANADIDO)) expect(ADDONS).toContain(addon);
  });

  it('R13, R23: toda pantalla de importar está en el mapa y corta con requirePageAddon de su añadido', () => {
    const infracciones = findInfracciones(pantallas, PANTALLAS_DE_ANADIDO);
    expect(infracciones, describir(infracciones)).toEqual([]);
  });

  describe('autocomprobación con fuentes sintéticos', () => {
    const FILE = 'app/(private)/inventario/importar/page.tsx';
    const segments = ['inventario', 'importar'];
    const mapa = { [FILE]: 'importacion_excel' } as const;

    it('R13: una pantalla de importar sin requirePageAddon (o solo en un comentario) es roja', () => {
      expect(findInfracciones([{ file: FILE, segments, source: SIN_CORTE }], mapa)).toEqual([
        { clase: 'sin-llamada', file: FILE, addon: 'importacion_excel' },
      ]);
    });

    it('R13: con requirePageAddon de su añadido no hay infracción', () => {
      expect(findInfracciones([{ file: FILE, segments, source: CON_CORTE('importacion_excel') }], mapa)).toEqual([]);
    });

    it('R13: con la clave de otro añadido es roja', () => {
      expect(findInfracciones([{ file: FILE, segments, source: CON_CORTE('lectura_pdf') }], mapa)).toEqual([
        { clase: 'otro-anadido', file: FILE, addon: 'importacion_excel', found: ['lectura_pdf'] },
      ]);
    });

    it('R13: una pantalla de importar nueva sin entrada en el mapa es roja', () => {
      const nueva = 'app/(private)/pedidos/importar/page.tsx';
      expect(
        findInfracciones([{ file: nueva, segments: ['pedidos', 'importar'], source: CON_CORTE('importacion_excel') }], {}),
      ).toEqual([{ clase: 'fuera-del-mapa', file: nueva }]);
    });

    it('R13: una entrada del mapa sin página es roja', () => {
      expect(findInfracciones([], mapa)).toEqual([{ clase: 'mapa-sin-pantalla', file: FILE }]);
    });
  });
});
