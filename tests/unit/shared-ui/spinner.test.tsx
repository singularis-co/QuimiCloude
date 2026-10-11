import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Spinner } from '@/components/shared/spinner';

const GIRO = 'animate-[spin_0.9s_linear_infinite]';

function svgOf(container: HTMLElement): SVGElement {
  const svg = container.querySelector('svg');
  if (svg === null) throw new Error('Spinner no pinto ningun svg');
  return svg;
}

function classesOf(element: Element): string[] {
  return (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}

afterEach(cleanup);

describe('Spinner', () => {
  it('R22 — por defecto (sm) lleva size-4 y gira', () => {
    const { container } = render(<Spinner />);

    const clases = classesOf(svgOf(container));
    expect(clases).toContain('size-4');
    expect(clases).toContain(GIRO);
  });

  it('R22 — size="sm" da lo mismo que el defecto', () => {
    const porDefecto = render(<Spinner />);
    const clasesPorDefecto = classesOf(svgOf(porDefecto.container));
    cleanup();

    const sm = render(<Spinner size="sm" />);
    expect(classesOf(svgOf(sm.container))).toEqual(clasesPorDefecto);
  });

  it('R22 — size="inherit" no fija tamano y deja que lo ponga el contenedor', () => {
    const { container } = render(<Spinner size="inherit" />);

    const clases = classesOf(svgOf(container));
    expect(clases).not.toContain('size-4');
    expect(clases).toContain(GIRO);
  });

  it('R22 — es decorativo: aria-hidden y sin rol ni nombre accesible', () => {
    const { container } = render(<Spinner />);

    const svg = svgOf(container);
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role');
    expect(svg).not.toHaveAttribute('aria-label');
  });

  it('R22 — es el icono de cargador de lucide (loader-circle)', () => {
    const { container } = render(<Spinner />);

    expect(classesOf(svgOf(container))).toContain('lucide-loader-circle');
  });

  it('R22 — anade las clases que se le pasan', () => {
    const { container } = render(<Spinner className="text-muted-foreground" />);

    expect(classesOf(svgOf(container))).toContain('text-muted-foreground');
  });
});

describe('Spinner del rediseño', () => {
  it('R43 — gira una vuelta cada 0,9 s a velocidad constante, no con el animate-spin de 1 s', () => {
    const { container } = render(<Spinner />);

    const clases = classesOf(svgOf(container));
    expect(clases).toContain(GIRO);
    expect(clases).not.toContain('animate-spin');
  });

  it('R43 — size="lg" mide 20 px (size-5) y gira igual', () => {
    const { container } = render(<Spinner size="lg" />);

    const clases = classesOf(svgOf(container));
    expect(clases).toContain('size-5');
    expect(clases).not.toContain('size-4');
    expect(clases).toContain(GIRO);
    expect(svgOf(container)).toHaveAttribute('aria-hidden', 'true');
  });

  it('R43 — es un solo icono', () => {
    const { container } = render(<Spinner size="lg" />);

    expect(container.querySelectorAll('svg')).toHaveLength(1);
  });
});

const RAIZ = join(__dirname, '..', '..', '..');
const SPINNER = join('components', 'shared', 'spinner.tsx');
const GIRO_PROPIO = /animate-spin|animate-\[spin|Loader2Icon/;

function archivosDe(carpeta: string): string[] {
  return readdirSync(join(RAIZ, carpeta), { withFileTypes: true, recursive: true })
    .filter((entrada) => entrada.isFile() && /\.(tsx?|css)$/.test(entrada.name))
    .map((entrada) => relative(RAIZ, join(entrada.parentPath, entrada.name)));
}

describe('un solo icono de carga girando', () => {
  it('R44 — ningun archivo de app/ o components/ fuera de spinner.tsx gira su propio icono', () => {
    const infractores = [...archivosDe('app'), ...archivosDe('components')]
      .filter((archivo) => archivo !== SPINNER)
      .filter((archivo) => GIRO_PROPIO.test(readFileSync(join(RAIZ, archivo), 'utf8')));

    expect(infractores.map((archivo) => archivo.split(sep).join('/'))).toEqual([]);
  });

  it('R44 — el Toaster pinta Spinner en su icono de carga', () => {
    const fuente = readFileSync(join(RAIZ, 'components', 'ui', 'sonner.tsx'), 'utf8');

    expect(fuente).toMatch(/from ["']@\/components\/shared\/spinner["']/);
    expect(fuente).toMatch(/loading:\s*\(?\s*<Spinner\b/);
  });
});
