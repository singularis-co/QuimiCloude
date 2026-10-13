import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PageHeader } from '@/components/shared/page-header';
import { PageShell } from '@/components/shared/page-shell';

afterEach(cleanup);

function classesOf(element: Element): Set<string> {
  return new Set((element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));
}

describe('PageShell', () => {
  it('R27 — márgenes por ventana, 20 px entre bloques y contenedor de consultas de ancho', () => {
    render(
      <PageShell>
        <p>contenido</p>
      </PageShell>,
    );

    const shell = screen.getByText('contenido').parentElement as HTMLElement;
    const clases = classesOf(shell);
    for (const clase of ['@container', 'gap-5', 'px-4', 'pt-4', 'pb-6', 'md:px-7', 'md:pt-6', 'md:pb-8']) {
      expect(clases.has(clase), clase).toBe(true);
    }
  });

  it('R27 — no añade una animación de entrada propia', () => {
    render(
      <PageShell className="extra">
        <p>contenido</p>
      </PageShell>,
    );
    const shell = screen.getByText('contenido').parentElement as HTMLElement;
    expect(shell.className).not.toMatch(/animate-|fade-in|slide-in|screen-enter/);
    expect(classesOf(shell).has('extra')).toBe(true);

    const fuente = readFileSync(join(process.cwd(), 'components', 'shared', 'page-shell.tsx'), 'utf8');
    expect(fuente).not.toMatch(/ScreenEnter|animate-/);
  });
});

describe('PageHeader', () => {
  it('R28 — el título es el único h1 y las acciones van a su derecha', () => {
    render(
      <PageHeader
        title="Pedidos"
        titleTestId="titulo"
        actions={<button type="button">Nuevo pedido</button>}
      />,
    );

    const titulos = screen.getAllByRole('heading', { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveTextContent('Pedidos');
    expect(titulos[0]).toHaveAttribute('data-testid', 'titulo');

    const raiz = titulos[0]?.parentElement?.parentElement as HTMLElement;
    const clases = classesOf(raiz);
    expect(clases.has('justify-between')).toBe(true);
    expect(clases.has('items-end')).toBe(true);
    expect(screen.getByRole('button', { name: 'Nuevo pedido' })).toBeInTheDocument();
  });

  it('R28 — sin acciones no pinta su contenedor', () => {
    const { container } = render(<PageHeader title="Pedidos" />);
    expect(container.querySelector('[data-slot="page-header-actions"]')).toBeNull();
  });

  it('R29 — la miga va en un nav con su nombre, el último paso es la página y los separadores se ocultan', () => {
    render(
      <PageHeader
        title="Pedido 42"
        breadcrumb={{
          label: 'Ruta',
          items: [
            { label: 'Pedidos', href: '/pedidos' },
            { label: 'Pedido 42' },
          ],
        }}
      />,
    );

    const nav = screen.getByRole('navigation', { name: 'Ruta' });
    const enlace = within(nav).getByRole('link', { name: 'Pedidos' });
    expect(enlace).toHaveAttribute('href', '/pedidos');

    const actual = within(nav).getByText('Pedido 42');
    expect(actual).toHaveAttribute('aria-current', 'page');

    const separadores = nav.querySelectorAll('svg');
    expect(separadores).toHaveLength(1);
    expect(separadores[0]).toHaveAttribute('aria-hidden', 'true');

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(nav.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('R30 — con contenedor de 760 px o menos las acciones ocupan todo el ancho y sus botones se reparten', () => {
    const { container } = render(
      <PageHeader title="Pedidos" actions={<button type="button">Nuevo</button>} />,
    );

    const acciones = container.querySelector('[data-slot="page-header-actions"]') as HTMLElement;
    const clases = classesOf(acciones);
    expect(clases.has('@max-[760px]:w-full')).toBe(true);
    expect(clases.has('@max-[760px]:*:flex-1')).toBe(true);

    const raiz = container.querySelector('[data-slot="page-header"]') as HTMLElement;
    expect(classesOf(raiz).has('flex-wrap')).toBe(true);
  });
});
