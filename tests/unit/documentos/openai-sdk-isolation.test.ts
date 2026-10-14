// `openai` se importa desde un solo archivo del repositorio: sustituir la libreria es reescribir
// ese archivo, no buscarla por el arbol.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ADAPTADOR = 'lib/modules/documentos/adapters/driven/ai/ai-reader-openai.ts';
const ARBOL_VIGILADO = ['lib', 'app', 'components', 'scripts'];

function archivosDe(absDir: string): readonly string[] {
  if (!existsSync(absDir)) return [];
  const salida: string[] = [];
  const recorrer = (dir: string) => {
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (/\.(ts|tsx|mts|mjs|js|cjs)$/.test(ruta)) salida.push(ruta);
    }
  };
  recorrer(absDir);
  return salida;
}

function fuenteSinComentarios(source: string): string {
  return source
    .split('\n')
    .map((line) => line.replace(/\/\/[^\n]*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
}

function importaOpenAi(source: string): boolean {
  return /from\s+['"]openai(\/[^'"]*)?['"]|require\(\s*['"]openai(\/[^'"]*)?['"]\s*\)|import\(\s*['"]openai(\/[^'"]*)?['"]\s*\)/.test(
    fuenteSinComentarios(source),
  );
}

describe('documentos — la libreria openai vive en un solo archivo (R29)', () => {
  it('R29 — el barrido recorre de verdad el arbol vigilado', () => {
    const fuentes = ARBOL_VIGILADO.flatMap((dir) => archivosDe(join(repoRoot, dir)));
    expect(fuentes.length).toBeGreaterThan(100);
  });

  it('R29 — un unico archivo de produccion importa openai, y es el adaptador', () => {
    const importadores = ARBOL_VIGILADO.flatMap((dir) => archivosDe(join(repoRoot, dir)))
      .filter((abs) => importaOpenAi(readFileSync(abs, 'utf8')))
      .map((abs) => relative(repoRoot, abs).split(sep).join('/'))
      .sort();

    expect(importadores).toEqual([ADAPTADOR]);
  });

  it('R29 — el detector dispara con un import, un subpath, un require y un import dinamico, y no con un comentario ni otro paquete', () => {
    expect(importaOpenAi("import OpenAI from 'openai';")).toBe(true);
    expect(importaOpenAi("import type { X } from 'openai/resources/chat/completions';")).toBe(true);
    expect(importaOpenAi("const o = require('openai');")).toBe(true);
    expect(importaOpenAi("const o = await import('openai');")).toBe(true);
    expect(importaOpenAi('// se nombra openai en un comentario')).toBe(false);
    expect(importaOpenAi("import { x } from '@/lib/openai-cosa';")).toBe(false);
    expect(importaOpenAi("import { x } from 'openai-otro';")).toBe(false);
  });
});
