// `Notice` con `actions`: los botones van dentro del cuerpo, debajo del texto, y el aviso conserva
// su rol y su animación de entrada. Sin la prop, el árbol no cambia.

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';

afterEach(cleanup);

function clasesDe(element: Element): string[] {
  return (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}

function avisoConAcciones(onReview = vi.fn(), onSaveBlocked = vi.fn()) {
  render(
    <Notice
      tone="danger"
      testId="aviso"
      title="No alcanza el material para Suavizante (receta 4)."
      actions={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onReview}>
            Revisar receta
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={onSaveBlocked}>
            Guardar bloqueada
          </Button>
        </>
      }
    >
      Falta fragancia lavanda.
    </Notice>,
  );
  return screen.getByTestId('aviso');
}

describe('Notice con acciones', () => {
  it('R17: pinta las acciones dentro del aviso, debajo del texto y en su orden', () => {
    const aviso = avisoConAcciones();

    const acciones = within(aviso).getAllByRole('button');
    expect(acciones.map((b) => b.textContent)).toEqual(['Revisar receta', 'Guardar bloqueada']);
    const fila = aviso.querySelector('[data-slot="notice-actions"]');
    expect(fila).not.toBeNull();
    expect(fila?.parentElement).toBe(aviso.children[1]);
    const texto = within(aviso).getByText('Falta fragancia lavanda.');
    expect(texto.compareDocumentPosition(fila as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('R17: cada acción llama a su callback y el aviso sigue siendo una alerta', () => {
    const onReview = vi.fn();
    const onSaveBlocked = vi.fn();
    const aviso = avisoConAcciones(onReview, onSaveBlocked);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar bloqueada' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revisar receta' }));

    expect(onSaveBlocked).toHaveBeenCalledTimes(1);
    expect(onReview).toHaveBeenCalledTimes(1);
    expect(aviso).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('alert')).toBe(aviso);
  });

  it('R46: con acciones, el aviso entra con la animación de los avisos', () => {
    const aviso = avisoConAcciones();

    expect(clasesDe(aviso)).toEqual(
      expect.arrayContaining(['animate-in', 'fade-in', 'slide-in-from-bottom-[10px]', 'duration-(--dur-slow)']),
    );
  });

  it('R17: sin `actions` no hay fila de acciones ni botones', () => {
    render(
      <Notice tone="danger" testId="aviso">
        Cuerpo
      </Notice>,
    );

    const aviso = screen.getByTestId('aviso');
    expect(aviso.querySelector('[data-slot="notice-actions"]')).toBeNull();
    expect(within(aviso).queryByRole('button')).not.toBeInTheDocument();
  });
});
