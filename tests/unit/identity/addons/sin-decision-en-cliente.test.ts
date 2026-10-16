// Ningún componente de cliente decide qué añadido está activo: el recorte se resuelve en el servidor
// (sesión, corte de pantalla, caso de uso y trabajo de la cola) y al cliente solo llegan permisos ya
// recortados. Un archivo `'use client'` que use `effectiveAddons`, `hasAddon` o `assertAddon` estaría
// decidiendo con datos que puede manipular quien tiene el navegador.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const RAICES = ['app', 'components', 'lib', 'hooks'] as const;
const IGNORADOS = new Set(['node_modules', '.next']);
const PROHIBIDOS = ['effectiveAddons', 'hasAddon', 'assertAddon'] as const;

export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

export function isClientModule(source: string): boolean {
  return /^\s*(['"])use client\1\s*;?/.test(stripComments(source));
}

/** Las funciones de decisión de añadidos que el fuente nombra fuera de comentarios. */
export function decisionesDeAnadido(source: string): readonly string[] {
  const codigo = stripComments(source);
  return PROHIBIDOS.filter((nombre) => new RegExp(`\\b${nombre}\\b`).test(codigo));
}

function listSources(root: string): readonly string[] {
  let names: readonly string[] = [];
  try {
    names = readdirSync(root);
  } catch {
    return [];
  }
  return names.flatMap((name) => {
    if (IGNORADOS.has(name)) return [];
    const full = join(root, name);
    if (statSync(full).isDirectory()) return listSources(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe('ninguna decisión de añadidos en el cliente', () => {
  const repoRoot = process.cwd();
  const clientes = RAICES.flatMap((raiz) => listSources(join(repoRoot, raiz)))
    .map((file) => ({ file: relative(repoRoot, file).split('\\').join('/'), source: readFileSync(file, 'utf8') }))
    .filter(({ source }) => isClientModule(source));

  it('R35: ancla anti-vacuidad: el barrido encuentra componentes de cliente', () => {
    expect(clientes.length).toBeGreaterThan(10);
  });

  it('R35: ningún archivo `use client` importa effectiveAddons, hasAddon ni assertAddon', () => {
    const infractores = clientes
      .map(({ file, source }) => ({ file, usa: decisionesDeAnadido(source) }))
      .filter(({ usa }) => usa.length > 0);
    expect(infractores).toEqual([]);
  });

  describe('autocomprobación con fuentes sintéticos', () => {
    it("R35: un fuente 'use client' que importa hasAddon es rojo", () => {
      const fuente = "'use client';\nimport { hasAddon } from '@/lib/modules/identity';\nexport function X() { return null; }\n";
      expect(isClientModule(fuente)).toBe(true);
      expect(decisionesDeAnadido(fuente)).toEqual(['hasAddon']);
    });

    it('R35: con comillas dobles y un comentario delante también cuenta como cliente', () => {
      const fuente = '// cabecera\n"use client"\nimport { effectiveAddons, assertAddon } from "@/lib/modules/identity"\n';
      expect(isClientModule(fuente)).toBe(true);
      expect(decisionesDeAnadido(fuente)).toEqual(['effectiveAddons', 'assertAddon']);
    });

    it('R35: el nombre solo en un comentario no cuenta, y un módulo de servidor no es cliente', () => {
      expect(decisionesDeAnadido("'use client';\n// hasAddon aquí no\nexport const a = 1;\n")).toEqual([]);
      expect(isClientModule("import { hasAddon } from '@/lib/modules/identity';\n")).toBe(false);
    });
  });
});
