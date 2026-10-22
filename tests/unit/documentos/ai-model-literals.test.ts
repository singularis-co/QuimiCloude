// Los modelos de IA salen solo del catalogo de la base, y la app ya no lee la key ni el modelo del
// entorno. Barre `lib/` entero (y `app/` para las variables), comentarios incluidos: un id de
// modelo escrito a mano, aunque sea en un comentario, acaba copiado como valor por defecto.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

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

function toPosix(ruta: string): string {
  return ruta.split(sep).join('/');
}

// Prefijos de proveedores que OpenRouter antepone a sus ids (`<vendor>/<modelo>`). Sin barra
// detras del modelo: asi no se confunde con una ruta de import como `openai/resources/...`.
const VENDORS_OPENROUTER =
  'anthropic|openai|google|meta-llama|mistralai|deepseek|x-ai|qwen|cohere|amazon|microsoft|nvidia|moonshotai|z-ai|perplexity';

/** Un literal entre comillas con un id de modelo de Claude, Gemini, GPT o de OpenRouter. */
const ID_DE_MODELO = new RegExp(
  [
    `['"\`][^'"\`\\n]*(claude-|gemini-|gpt-[0-9a-z]|flash)[^'"\`\\n]*['"\`]`,
    `['"\`](${VENDORS_OPENROUTER})/[a-z0-9][a-z0-9.:_-]*['"\`]`,
  ].join('|'),
  'i',
);

const VARIABLES_RETIRADAS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'GEMINI_API_KEY', 'GEMINI_MODEL'];

function conHallazgo(dirs: readonly string[], prueba: (fuente: string) => boolean): string[] {
  return dirs
    .flatMap((dir) => archivosDe(join(repoRoot, dir)))
    .filter((abs) => prueba(readFileSync(abs, 'utf8')))
    .map((abs) => toPosix(relative(repoRoot, abs)))
    .sort();
}

describe('documentos — ningun id de modelo ni variable de IA escrito en el codigo', () => {
  it('R43 — el barrido recorre de verdad lib/ entero', () => {
    const archivos = archivosDe(join(repoRoot, 'lib'));
    expect(archivos.length).toBeGreaterThan(200);
    expect(archivos.map((abs) => toPosix(relative(repoRoot, abs)))).toContain(
      'lib/modules/documentos/adapters/driven/ai/ai-reader-openai.ts',
    );
  });

  it('R43 — ningun archivo de lib/ contiene un id de modelo de IA escrito a mano', () => {
    const hallazgos = conHallazgo(['lib'], (fuente) => ID_DE_MODELO.test(fuente));
    expect(hallazgos, `archivos con un id de modelo escrito a mano: ${hallazgos.join(', ')}`).toEqual([]);
  });

  it('R43 — el detector muerde con cada familia de id y no con codigo que no lo es', () => {
    for (const malo of [
      "const model = 'claude-haiku-5-5';",
      'const model = "gemini-3.8-flash";',
      'const model = `gpt-6-luna`;',
      "const model = 'anthropic/claude-haiku-5.5';",
      "const model = 'meta-llama/llama-4-maverick:free';",
      "// por defecto 'gemini-2.0-flash'",
    ]) {
      expect(ID_DE_MODELO.test(malo), malo).toBe(true);
    }
    for (const bueno of [
      "import OpenAI from 'openai';",
      "import type { X } from 'openai/resources/chat/completions';",
      "import Anthropic from '@anthropic-ai/sdk';",
      "import { GoogleGenAI } from '@google/genai';",
      "const model = entry.recipeModel;",
      "const ruta = 'proveedores/modificar';",
    ]) {
      expect(ID_DE_MODELO.test(bueno), bueno).toBe(false);
    }
  });

  it('R22 — ningun archivo de lib/ ni de app/ nombra las cuatro variables retiradas', () => {
    const hallazgos = conHallazgo(['lib', 'app'], (fuente) =>
      VARIABLES_RETIRADAS.some((nombre) => fuente.includes(nombre)),
    );
    expect(hallazgos, `archivos que nombran una variable retirada: ${hallazgos.join(', ')}`).toEqual([]);
  });

  it('R22 — el lector de variables de IA ya no existe', () => {
    expect(existsSync(join(repoRoot, 'lib/modules/documentos/adapters/driven/config/ai-config-env.ts'))).toBe(
      false,
    );
  });
});
