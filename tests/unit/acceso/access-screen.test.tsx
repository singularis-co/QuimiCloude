// `AccessScreen`: la pantalla compartida de acceso. Un `describe` por requisito.
//
// jsdom no aplica `app/globals.css`: lo que depende del CSS (fondo, puntero, entrada escalonada)
// se comprueba sobre el texto del bloque «Pantallas de acceso»; el estilo computado lo mide el E2E.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';

import { AccessScreen } from '@/components/shared/access-screen';

const CSS = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8');

/** El bloque delimitado de acceso, con los espacios normalizados. */
function bloqueDeAcceso(): string {
  const inicio = CSS.indexOf('/* ══ Pantallas de acceso — INICIO ══ */');
  const fin = CSS.indexOf('/* ══ Pantallas de acceso — FIN ══ */');
  if (inicio < 0 || fin < inicio) throw new Error('el bloque «Pantallas de acceso» no está en app/globals.css');
  return CSS.slice(inicio, fin).replace(/\s+/g, ' ');
}

function pintar(props: Partial<Parameters<typeof AccessScreen>[0]> = {}) {
  return render(
    <AccessScreen testId="pantalla" {...props}>
      <h1 id="titulo">Título</h1>
      <p>Bloque 2</p>
      <p>Bloque 3</p>
    </AccessScreen>,
  );
}

describe('R1: un único main a alto de ventana en dvh, sobre el degradado de la barra lateral, con la tarjeta centrada', () => {
  it('pinta un único main con data-access="screen", min-h-dvh y centrado en los dos ejes', () => {
    const { container } = pintar();
    const mains = container.querySelectorAll('main');
    expect(mains).toHaveLength(1);
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('data-access', 'screen');
    expect(main).toHaveAttribute('data-testid', 'pantalla');
    expect(main).toHaveClass('min-h-dvh', 'flex', 'items-center', 'justify-center');
    expect(main.className).not.toMatch(/\bh-screen\b|min-h-screen|100vh/);
  });

  it('la tarjeta va dentro del main y lleva sus hijos', () => {
    pintar();
    const tarjeta = screen.getByRole('main').querySelector('[data-access="card"]');
    expect(tarjeta).not.toBeNull();
    expect(tarjeta).toHaveAttribute('data-slot', 'card');
    expect(tarjeta).toContainElement(screen.getByRole('heading', { level: 1, name: 'Título' }));
  });

  it('el CSS pinta el main con var(--sidebar-panel-gradient) y nunca usa 100vh', () => {
    const bloque = bloqueDeAcceso();
    expect(bloque).toContain("[data-access='screen'] {");
    expect(bloque).toContain('background: var(--sidebar-panel-gradient);');
    expect(bloque).toContain('padding: 40px 16px;');
    expect(bloque).not.toContain('100vh');
  });

  it('el ancho de la tarjeta sale de data-width: 400 px por defecto y 440 px en wide', () => {
    const { unmount } = pintar();
    expect(document.querySelector('[data-access="card"]')).toHaveAttribute('data-width', 'default');
    unmount();
    pintar({ width: 'wide' });
    expect(document.querySelector('[data-access="card"]')).toHaveAttribute('data-width', 'wide');

    const bloque = bloqueDeAcceso();
    expect(bloque).toMatch(/\[data-access='card'\] \{[^}]*max-width: 400px;[^}]*padding: 32px 28px 20px;[^}]*border-radius: 18px;[^}]*box-shadow: var\(--shadow-dlg\);/);
    expect(bloque).toMatch(/\[data-access='card'\]\[data-width='wide'\] \{[^}]*max-width: 440px;[^}]*padding: 28px 28px 24px;/);
  });

  it('con labelledBy la tarjeta es una región nombrada por el h1', () => {
    pintar({ labelledBy: 'titulo' });
    expect(screen.getByRole('region', { name: 'Título' })).toHaveAttribute('data-access', 'card');
  });
});

describe('R2: moléculas decorativas ocultas a la asistencia, sin foco y sin puntero', () => {
  it('pinta cinco moléculas numeradas dentro de una capa aria-hidden', () => {
    pintar();
    const capa = document.querySelector('[data-access="molecules"]');
    expect(capa).not.toBeNull();
    expect(capa).toHaveAttribute('aria-hidden', 'true');
    const moleculas = capa!.querySelectorAll('svg[data-access="molecule"]');
    expect([...moleculas].map((m) => m.getAttribute('data-access-index'))).toEqual(['1', '2', '3', '4', '5']);
  });

  it('la capa no tiene nodos enfocables y las moléculas no son enfocables', () => {
    pintar();
    const capa = document.querySelector('[data-access="molecules"]')!;
    expect(capa.querySelectorAll('a, button, input, select, textarea, [tabindex]')).toHaveLength(0);
    for (const svg of capa.querySelectorAll('svg')) expect(svg).toHaveAttribute('focusable', 'false');
  });

  it('las moléculas no aparecen en el árbol accesible', () => {
    pintar();
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });

  it('el CSS quita el puntero a la capa de moléculas', () => {
    expect(bloqueDeAcceso()).toMatch(/\[data-access='molecules'\] \{[^}]*pointer-events: none;/);
  });
});

describe('R5: los bloques de la tarjeta entran escalonados, de abajo arriba, una sola vez', () => {
  it('los hijos de la tarjeta son sus hijos directos, que es lo que anima el CSS', () => {
    pintar();
    const tarjeta = document.querySelector('[data-access="card"]')!;
    expect([...tarjeta.children].map((h) => h.textContent)).toEqual(['Título', 'Bloque 2', 'Bloque 3']);
  });

  it('el CSS anima los hijos directos con screen-enter, una vez, con retardos 0/40/80/120/160/200 ms', () => {
    const bloque = bloqueDeAcceso();
    expect(bloque).toContain("[data-access='card'] > * { animation: screen-enter var(--dur-slow) var(--ease-enter) both; }");
    for (const [hijo, ms] of [['2', 40], ['3', 80], ['4', 120], ['5', 160], ['n + 6', 200]] as const) {
      expect(bloque).toContain(`[data-access='card'] > :nth-child(${hijo}) { animation-delay: ${ms}ms; }`);
    }
    // `screen-enter` sube desde 10 px más abajo: entra de abajo arriba.
    expect(CSS.replace(/\s+/g, ' ')).toContain('@keyframes screen-enter { from { opacity: 0; transform: translateY(10px); } }');
    expect(bloque).not.toMatch(/\[data-access='card'\] > \*[^}]*infinite/);
  });
});

describe('R6: tokens del tema activo, sin forzar el oscuro', () => {
  it('no pone la clase dark en ningún nodo', () => {
    const { container } = pintar();
    expect(container.querySelector('.dark')).toBeNull();
  });

  it('el CSS no fuerza el esquema oscuro y el degradado tiene valor en claro y en oscuro', () => {
    const bloque = bloqueDeAcceso();
    expect(bloque).not.toContain('color-scheme: dark');
    expect(bloque).not.toContain('backdrop-filter');
    const plano = CSS.replace(/\s+/g, ' ');
    expect(plano).toMatch(/:root \{ --sidebar-panel-gradient: linear-gradient\(/);
    expect(plano).toMatch(/\.dark \{ --sidebar-panel-gradient: linear-gradient\(/);
  });
});
