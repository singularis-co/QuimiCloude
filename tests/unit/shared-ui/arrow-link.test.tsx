import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ArrowLink } from '@/components/shared/arrow-link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

afterEach(cleanup);

function clasesDe(elemento: Element): string[] {
  return (elemento.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}

function flechaDe(enlace: HTMLElement): SVGElement {
  const svg = enlace.querySelector('svg');
  if (svg === null) throw new Error('ArrowLink no pinto la flecha');
  return svg;
}

describe('ArrowLink es un enlace real con aspecto de Button', () => {
  it('R49 — pinta un <a href> que navega, nunca un boton ni un submit', () => {
    const { container } = render(
      <form>
        <ArrowLink href="/pedidos" direction="back">
          Volver a pedidos
        </ArrowLink>
      </form>,
    );

    const enlace = screen.getByRole('link', { name: 'Volver a pedidos' });
    expect(enlace.tagName).toBe('A');
    expect(enlace).toHaveAttribute('href', '/pedidos');
    expect(enlace).not.toHaveAttribute('type');
    expect(container.querySelector('button')).toBeNull();
  });

  it('R49 — back: flecha a la izquierda DELANTE del texto, oculta a lectores', () => {
    render(
      <ArrowLink href="/a" direction="back">
        Volver
      </ArrowLink>,
    );

    const enlace = screen.getByRole('link', { name: 'Volver' });
    const flecha = flechaDe(enlace);
    expect(enlace.firstChild).toBe(flecha);
    expect(clasesDe(flecha)).toContain('lucide-arrow-left');
    expect(flecha).toHaveAttribute('aria-hidden', 'true');
    expect(enlace.querySelectorAll('svg')).toHaveLength(1);
  });

  it('R49 — forward: flecha a la derecha DETRAS del texto, oculta a lectores', () => {
    render(
      <ArrowLink href="/b" direction="forward">
        Ir al pedido
      </ArrowLink>,
    );

    const enlace = screen.getByRole('link', { name: 'Ir al pedido' });
    const flecha = flechaDe(enlace);
    expect(enlace.lastChild).toBe(flecha);
    expect(clasesDe(flecha)).toContain('lucide-arrow-right');
    expect(flecha).toHaveAttribute('aria-hidden', 'true');
    expect(enlace.querySelectorAll('svg')).toHaveLength(1);
  });

  it('R49 — respeta variante, talla y touch de Button', () => {
    render(
      <ArrowLink href="/c" direction="forward" variant="secondary" size="sm" touch testId="ir">
        Seguir
      </ArrowLink>,
    );

    const clases = clasesDe(screen.getByTestId('ir'));
    const esperadas = cn(buttonVariants({ variant: 'secondary', size: 'sm', touch: true }));
    for (const clase of esperadas.split(/\s+/)) {
      expect(clases).toContain(clase);
    }
  });

  it('R49 — touch="mobile" sube a 44 px solo en movil', () => {
    render(
      <ArrowLink href="/c" direction="back" touch="mobile" testId="volver">
        Volver
      </ArrowLink>,
    );

    expect(clasesDe(screen.getByTestId('volver'))).toContain('max-md:min-h-11');
  });

  it('R49 — back lleva relleno izquierdo de 10 px', () => {
    render(
      <ArrowLink href="/c" direction="back" testId="volver">
        Volver
      </ArrowLink>,
    );

    expect(clasesDe(screen.getByTestId('volver'))).toContain('pl-2.5');
  });
});

describe('la flecha se adelanta al pasar el puntero', () => {
  it('R50 — back: se desplaza 3 px a la izquierda en 200 ms con la curva estandar', () => {
    render(
      <ArrowLink href="/a" direction="back">
        Volver
      </ArrowLink>,
    );

    const clases = clasesDe(flechaDe(screen.getByRole('link')));
    expect(clases).toContain('group-hover/button:-translate-x-[3px]');
    expect(clases).toContain('transition-[translate]');
    expect(clases).toContain('duration-(--dur-base)');
    expect(clases).toContain('ease-(--ease-standard)');
  });

  it('R50 — forward: se desplaza 3 px a la derecha', () => {
    render(
      <ArrowLink href="/b" direction="forward">
        Seguir
      </ArrowLink>,
    );

    const clases = clasesDe(flechaDe(screen.getByRole('link')));
    expect(clases).toContain('group-hover/button:translate-x-[3px]');
    expect(clases).toContain('duration-(--dur-base)');
  });

  it('R50 — el movimiento cuelga de hover (en Tailwind v4, solo con hover: hover) y del grupo del enlace', () => {
    render(
      <ArrowLink href="/b" direction="forward">
        Seguir
      </ArrowLink>,
    );

    const enlace = screen.getByRole('link');
    expect(clasesDe(enlace)).toContain('group/button');
    const movimientos = clasesDe(flechaDe(enlace)).filter((clase) => clase.includes('translate-x'));
    expect(movimientos.length).toBeGreaterThan(0);
    for (const clase of movimientos) expect(clase.startsWith('group-hover/button:')).toBe(true);
  });
});

describe('variante por defecto y nombre accesible', () => {
  it('R51 — back sin variante pinta outline', () => {
    render(
      <ArrowLink href="/a" direction="back" testId="volver">
        Volver
      </ArrowLink>,
    );

    const clases = clasesDe(screen.getByTestId('volver'));
    expect(clases).toContain('btn-veil');
    expect(clases).toContain('border-border');
    expect(clases).not.toContain('bg-primary');
  });

  it('R51 — forward sin variante pinta default', () => {
    render(
      <ArrowLink href="/b" direction="forward" testId="seguir">
        Seguir
      </ArrowLink>,
    );

    const clases = clasesDe(screen.getByTestId('seguir'));
    expect(clases).toContain('bg-primary');
    expect(clases).toContain('btn-shine');
  });

  it('R51 — el nombre accesible es exactamente el texto visible', () => {
    render(
      <ArrowLink href="/b" direction="forward">
        Ir a inventario
      </ArrowLink>,
    );

    const enlace = screen.getByRole('link');
    expect(enlace).toHaveAccessibleName('Ir a inventario');
    expect(enlace).toHaveTextContent('Ir a inventario');
  });
});
