// Tokens de color de las secciones de la pantalla del operario (QC-291 R20, T3, design.md §3.3).
// Lee `app/globals.css` como texto: los tokens existen en claro y en oscuro, tienen su utilidad en
// `@theme inline` y el texto de la cabecera llega a AA (4,5:1) sobre cada fondo.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { contrastRatio, extractColorBlocks, readToken } from '../theme/contraste';

const GLOBALS_CSS_PATH = fileURLToPath(new URL('../../../app/globals.css', import.meta.url));
const CARD_PATH = fileURLToPath(
  new URL(
    '../../../app/(private)/asignacion/components/order-execution-collapsible-card.tsx',
    import.meta.url,
  ),
);

const BACKGROUNDS = ['section-materials', 'section-tools', 'section-team'] as const;
const TOKENS = [...BACKGROUNDS, 'section-foreground'] as const;

const EXPECTED = {
  light: {
    'section-materials': 'oklch(0.57 0.15 55)',
    'section-tools': 'oklch(0.55 0.15 255)',
    'section-team': 'oklch(0.54 0.13 160)',
    'section-foreground': 'oklch(0.99 0 0)',
  },
  dark: {
    'section-materials': 'oklch(0.68 0.14 60)',
    'section-tools': 'oklch(0.64 0.14 255)',
    'section-team': 'oklch(0.64 0.12 160)',
    'section-foreground': 'oklch(0.18 0 0)',
  },
} as const;

const css = readFileSync(GLOBALS_CSS_PATH, 'utf8');
const blocks = extractColorBlocks(css);
const modes = [
  ['light', blocks.light],
  ['dark', blocks.dark],
] as const;

function themeInline(): string {
  const start = css.indexOf('@theme inline {');
  if (start === -1) throw new Error('No se encontro @theme inline en globals.css');
  return css.slice(start, css.indexOf('}', start));
}

describe('R20 — tokens de color de sección (T3)', () => {
  it('R20: los cuatro tokens existen en :root y en .dark con los valores de design.md §3.3', () => {
    for (const [mode, block] of modes) {
      for (const name of TOKENS) {
        expect({ mode, name, value: readToken(block, name) }).toEqual({
          mode,
          name,
          value: EXPECTED[mode][name],
        });
      }
    }
  });

  it('R20: cada token tiene su utilidad en @theme inline', () => {
    const theme = themeInline();
    for (const name of TOKENS) {
      expect(theme).toContain(`--color-${name}: var(--${name});`);
    }
  });

  it('R20: el texto de sección contrasta al menos 4.5:1 sobre cada fondo, en claro y en oscuro', () => {
    for (const [mode, block] of modes) {
      const foreground = readToken(block, 'section-foreground');
      for (const name of BACKGROUNDS) {
        const ratio = contrastRatio(foreground, readToken(block, name));
        expect({ mode, name, passes: ratio >= 4.5, ratio }).toMatchObject({
          mode,
          name,
          passes: true,
        });
      }
    }
  });

  it('R20: la tarjeta con tono solo nombra tokens de sección que existen', () => {
    const card = readFileSync(CARD_PATH, 'utf8');
    const referenced = new Set([...card.matchAll(/--(section-[a-z-]+)/g)].map((m) => m[1]));

    expect([...referenced].sort()).toEqual([...TOKENS].sort());
  });
});
