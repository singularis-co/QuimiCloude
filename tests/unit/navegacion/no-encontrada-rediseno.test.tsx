import { cleanup, render, screen } from '@testing-library/react';

import PrivateNotFound from '@/app/(private)/not-found';

const TITULO = 'No encontramos esta página';
const MENSAJE = 'Revisa la dirección e inténtalo de nuevo, o continúa desde el menú lateral.';

afterEach(() => {
  cleanup();
});

describe('Página no encontrada rediseñada', () => {
  it('R19: el icono de búsqueda va en un recuadro oculto a los lectores de pantalla', () => {
    render(<PrivateNotFound />);

    const pantalla = screen.getByTestId('private-not-found');
    const icono = pantalla.querySelector('svg');
    expect(icono).not.toBeNull();
    const recuadro = icono?.closest('span[aria-hidden="true"]');
    expect(recuadro).not.toBeNull();
    expect(recuadro?.getAttribute('data-size')).toBe('lg');
  });

  it('R19: la etiqueta «404» va en la fuente monoespaciada', () => {
    render(<PrivateNotFound />);

    const etiqueta = screen.getByText('404');
    expect(etiqueta.className).toContain('font-mono');
  });

  it('R19: hay un único h1 y dice «No encontramos esta página»', () => {
    render(<PrivateNotFound />);

    const titulos = screen.getAllByRole('heading', { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveTextContent(TITULO);
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
  });

  it('R19: muestra el mensaje exacto', () => {
    render(<PrivateNotFound />);

    expect(screen.getByText(MENSAJE)).toBeInTheDocument();
  });

  it('R19: no pinta ningún enlace ni botón', () => {
    render(<PrivateNotFound />);

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('R19: no pinta ningún main propio y ocupa el área de contenido centrado', () => {
    const { container } = render(<PrivateNotFound />);

    expect(screen.queryAllByRole('main')).toHaveLength(0);
    expect(container.querySelector('main')).toBeNull();
    const pantalla = screen.getByTestId('private-not-found');
    expect(pantalla.tagName).toBe('DIV');
    expect(pantalla.className).toContain('flex-1');
    expect(pantalla.className).toContain('min-h-[460px]');
    expect(pantalla.className).toContain('justify-center');
  });
});
