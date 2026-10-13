// Las pantallas del operario ocultan la barra lateral y la cabecera privada desde la hoja global
// (`body:has([data-operator-screen])`). Lee el CSS como texto, igual que `motion-tokens.test.ts`.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const css = readFileSync(
  fileURLToPath(new URL('../../../app/globals.css', import.meta.url)),
  'utf8',
);

/** Sin comentarios y con los espacios colapsados. */
const normalizado = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');

function reglaQueOculta(selector: string): string | undefined {
  for (const m of normalizado.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectores = m[1].split(',').map((s) => s.trim());
    if (selectores.includes(selector)) return m[2];
  }
  return undefined;
}

describe('operator-chrome-css', () => {
  it('R1: oculta la barra lateral (con su hueco) cuando hay una pantalla del operario', () => {
    const cuerpo = reglaQueOculta('body:has([data-operator-screen]) [data-slot="sidebar"]');
    expect(cuerpo).toBeDefined();
    expect(cuerpo).toMatch(/display: ?none/);
  });

  it('R1: oculta la cabecera privada cuando hay una pantalla del operario', () => {
    const cuerpo = reglaQueOculta(
      'body:has([data-operator-screen]) [data-testid="private-header"]',
    );
    expect(cuerpo).toBeDefined();
    expect(cuerpo).toMatch(/display: ?none/);
  });

  it('R6: la regla depende de la marca del operario, no oculta la barra en general', () => {
    for (const m of normalizado.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/display: ?none/.test(m[2])) continue;
      for (const selector of m[1].split(',').map((s) => s.trim())) {
        if (selector.includes('[data-slot="sidebar"]') || selector.includes('private-header')) {
          expect(selector).toContain('[data-operator-screen]');
        }
      }
    }
  });
});
