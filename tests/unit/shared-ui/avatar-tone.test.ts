import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { avatarTone, type AvatarTone } from '@/lib/shared/ui/avatar-tone';

const TONOS: readonly AvatarTone[] = [1, 2, 3, 4, 5, 6];

function fnv1a(key: string): number {
  let hash = 0x811c9dc5;
  for (const char of key) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function pintar(tone?: AvatarTone): string {
  return renderToStaticMarkup(
    createElement(Avatar, { tone }, createElement(AvatarFallback, null, 'AT')),
  );
}

describe('avatarTone', () => {
  it('R40 — el mismo identificador da siempre el mismo tono', () => {
    const id = '7b0f2c4e-1a2b-4c3d-8e9f-0123456789ab';
    const primera = avatarTone(id);
    for (let vez = 0; vez < 5; vez += 1) expect(avatarTone(id)).toBe(primera);
  });

  it('R40 — devuelve un tono entre 1 y 6', () => {
    for (let indice = 0; indice < 500; indice += 1) {
      expect(TONOS).toContain(avatarTone(`persona-${indice}`));
    }
  });

  it('R40 — es FNV-1a de 32 bits modulo 6 mas 1', () => {
    for (const key of ['a', 'Ana Torres', '00000001-0000-4000-8000-000000000001', 'zz']) {
      expect(avatarTone(key)).toBe((fnv1a(key) % 6) + 1);
    }
  });

  it('R40 — la cadena vacia da el tono 1', () => {
    expect(avatarTone('')).toBe(1);
  });

  it('R40 — reparte los seis tonos entre identificadores distintos', () => {
    const vistos = new Set<AvatarTone>();
    for (let indice = 0; indice < 200; indice += 1) vistos.add(avatarTone(`usuario-${indice}`));
    expect([...vistos].sort()).toEqual([...TONOS]);
  });
});

describe('Avatar con tone', () => {
  it.each(TONOS)('R41 — tone=%i marca data-tone y el fallback lee los tokens de ese color', (tone) => {
    const html = pintar(tone);
    expect(html).toContain(`data-tone="${tone}"`);
    expect(html).toContain(`group-data-[tone=${tone}]/avatar:bg-avatar-${tone}`);
    expect(html).toContain(`group-data-[tone=${tone}]/avatar:text-avatar-${tone}-text`);
  });

  it('R41 — sin tone no hay data-tone y el fallback sigue con bg-muted', () => {
    const html = pintar();
    expect(html).not.toContain('data-tone');
    expect(html).toMatch(/class="[^"]*\bbg-muted\b/);
  });
});
