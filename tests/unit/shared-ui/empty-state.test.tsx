import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { EmptyState } from '@/components/shared/empty-state';

afterEach(cleanup);

describe('EmptyState', () => {
  it('R13: pinta el mensaje con su testid y el contenedor con las clases por defecto', () => {
    render(<EmptyState testId="x-empty" messageTestId="x-empty-message" message="No hay nada." />);

    const contenedor = screen.getByTestId('x-empty');
    expect(contenedor.className).toBe(
      'flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center',
    );
    const mensaje = screen.getByTestId('x-empty-message');
    expect(mensaje.tagName).toBe('P');
    expect(mensaje).toHaveTextContent('No hay nada.');
    expect(mensaje.className).toBe('text-sm text-muted-foreground');
    expect(within(contenedor).queryByRole('link')).toBeNull();
  });

  it('R13: sin messageTestId el mensaje no lleva data-testid', () => {
    render(<EmptyState testId="x-empty" message="No hay nada." />);

    expect(screen.getByText('No hay nada.').hasAttribute('data-testid')).toBe(false);
  });

  it('R13: la vuelta a la primera pagina es un enlace con aspecto de boton y talla tactil', () => {
    render(
      <EmptyState
        testId="x-empty"
        message="Esta página ya no tiene nada."
        firstPage={{ href: '/x?page=1', label: 'Volver a la primera página', testId: 'x-first' }}
      />,
    );

    const enlace = screen.getByRole('link', { name: 'Volver a la primera página' });
    expect(enlace).toHaveAttribute('href', '/x?page=1');
    expect(enlace).toHaveAttribute('data-slot', 'button');
    expect(enlace).toHaveAttribute('data-testid', 'x-first');
    expect(enlace.className.split(' ')).toEqual(expect.arrayContaining(['min-h-11', 'min-w-11']));
  });

  it('R13: el orden es mensaje, limpiar busqueda, primera pagina y acciones', () => {
    render(
      <EmptyState
        testId="x-empty"
        message="Sin datos."
        clearSearch={{ href: '/x', label: 'Limpiar la búsqueda', testId: 'x-clear' }}
        firstPage={{ href: '/x?page=1', label: 'Volver a la primera página', testId: 'x-first' }}
      >
        <button type="button" data-testid="x-create">
          Crear
        </button>
      </EmptyState>,
    );

    const hijos = Array.from(screen.getByTestId('x-empty').children);
    expect(hijos.map((hijo) => hijo.getAttribute('data-testid') ?? hijo.tagName)).toEqual([
      'P',
      'x-clear',
      'x-first',
      'x-create',
    ]);
  });

  it('R13: respeta la clase del contenedor que se le pase', () => {
    render(<EmptyState testId="x-empty" message="Sin datos." className="p-2" />);

    expect(screen.getByTestId('x-empty').className).toBe('p-2');
  });

  it('R19: sin icon ni heading el arbol es identico al de hoy', () => {
    const { container } = render(
      <EmptyState
        testId="x-empty"
        messageTestId="x-empty-message"
        message="Sin datos."
        clearSearch={{ href: '/x', label: 'Limpiar la búsqueda', testId: 'x-clear' }}
        firstPage={{ href: '/x?page=1', label: 'Volver a la primera página', testId: 'x-first' }}
      >
        <button type="button">Crear</button>
      </EmptyState>,
    );

    const contenedor = screen.getByTestId('x-empty');
    expect(container.children).toHaveLength(1);
    expect(Array.from(contenedor.children).map((hijo) => hijo.tagName)).toEqual([
      'P',
      'A',
      'A',
      'BUTTON',
    ]);
    expect(contenedor.querySelector('[aria-hidden]')).toBeNull();
    expect(within(contenedor).queryByRole('heading')).toBeNull();
  });

  it('R19: el recuadro del icono va primero y esta oculto a lectores', () => {
    render(
      <EmptyState
        testId="x-empty"
        message="Sin datos."
        icon={{ node: <svg data-testid="x-icon" /> }}
      />,
    );

    const primero = screen.getByTestId('x-empty').firstElementChild;
    expect(primero).toHaveAttribute('aria-hidden', 'true');
    expect(primero).toContainElement(screen.getByTestId('x-icon'));
    expect(primero?.className).toContain('bg-muted');
    expect(primero?.className).toContain('text-muted-foreground');
  });

  it('R19: el recuadro mide 44 px por defecto y 64 px con lg', () => {
    render(
      <>
        <EmptyState testId="x-default" message="A." icon={{ node: <svg /> }} />
        <EmptyState testId="x-lg" message="B." icon={{ node: <svg />, size: 'lg' }} />
      </>,
    );

    const porDefecto = screen.getByTestId('x-default').firstElementChild;
    expect(porDefecto).toHaveAttribute('data-size', 'default');
    expect(porDefecto?.className.split(' ')).toEqual(
      expect.arrayContaining(['size-11', 'rounded-[12px]']),
    );
    const grande = screen.getByTestId('x-lg').firstElementChild;
    expect(grande).toHaveAttribute('data-size', 'lg');
    expect(grande?.className.split(' ')).toEqual(
      expect.arrayContaining(['size-16', 'rounded-[16px]']),
    );
  });

  it('R19: el encabezado es h1 o h2 segun level y va antes del mensaje', () => {
    render(
      <>
        <EmptyState
          testId="x-uno"
          message="Mensaje uno."
          heading={{ level: 1, text: 'Titulo uno' }}
        />
        <EmptyState
          testId="x-dos"
          message="Mensaje dos."
          heading={{ level: 2, text: 'Titulo dos' }}
        />
      </>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Titulo uno' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Titulo dos' })).toBeInTheDocument();
    expect(
      Array.from(screen.getByTestId('x-uno').children).map((hijo) => hijo.tagName),
    ).toEqual(['H1', 'P']);
  });

  it('R19: el eyebrow va antes del encabezado, en monoespaciada', () => {
    render(
      <EmptyState
        testId="x-empty"
        message="Revisa la dirección."
        icon={{ node: <svg />, size: 'lg' }}
        heading={{ level: 1, eyebrow: '404', text: 'No encontrada' }}
      />,
    );

    const hijos = Array.from(screen.getByTestId('x-empty').children);
    expect(hijos.map((hijo) => hijo.tagName)).toEqual(['SPAN', 'SPAN', 'H1', 'P']);
    expect(hijos[1]).toHaveTextContent('404');
    expect(hijos[1]?.className).toContain('font-mono');
    expect(hijos[1]).not.toHaveAttribute('aria-hidden');
    expect(within(screen.getByTestId('x-empty')).queryByRole('link')).toBeNull();
  });
});
