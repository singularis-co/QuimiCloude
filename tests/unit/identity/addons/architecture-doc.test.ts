// `docs/architecture.md` dice la regla vigente del permiso efectivo: rol ∩ añadidos activos,
// resuelto en cada petición. Las dos frases que la contradecían quedan enmendadas.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const doc = readFileSync(join(process.cwd(), 'docs', 'architecture.md'), 'utf8');

function vinetaDe(inicio: string): string {
  const desde = doc.indexOf(inicio);
  expect(desde, `no se encontró «${inicio}»`).toBeGreaterThanOrEqual(0);
  const resto = doc.slice(desde);
  const fin = resto.search(/\n\s*(- \*\*|\d+\. \*\*)/);
  return fin === -1 ? resto : resto.slice(0, fin);
}

describe('docs/architecture.md y el permiso efectivo', () => {
  it('R37: ya no dice que los permisos de la sesión son una foto del instante del login', () => {
    expect(doc).not.toContain('foto del instante del login');
  });

  it('R37: dice que el permiso efectivo es rol ∩ añadidos activos, resuelto en cada petición', () => {
    expect(doc).toContain('rol ∩ añadidos activos');
    expect(doc).toContain('Los permisos se resuelven en cada petición');
  });

  it('R37: la viñeta «Nada de infraestructura por si acaso» queda enmendada: nada que amplíe el rol, añadidos que recortan', () => {
    const vineta = vinetaDe('**Nada de infraestructura «por si acaso».**');
    expect(vineta).not.toContain('mas alla de su rol');
    expect(vineta).toContain('**que amplíen** su rol');
    expect(vineta).toContain('`companies.addons`');
    expect(vineta).toContain('rol ∩ añadidos activos');
    expect(vineta).toContain('usuario en varias empresas');
  });

  it('R37: nombra el catálogo, los cortes sin permiso propio, la guardia de rutas sin sesión y los crons como núcleo', () => {
    expect(doc).toContain('identity/domain/company-addons.ts');
    expect(doc).toContain('`requireAddon`');
    expect(doc).toContain('`requirePageAddon`');
    expect(doc).toContain('guard-rutas-fuera-de-sesion');
    expect(doc).toContain('Los crons son **núcleo** y no miran añadidos');
  });
});
