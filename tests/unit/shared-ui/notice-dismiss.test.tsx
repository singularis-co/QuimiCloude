import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Notice } from '@/components/shared/notice';

afterEach(cleanup);

function clasesDe(element: Element): string[] {
  return (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}

describe('Notice con cierre', () => {
  it('R15: sin `dismissible` el aviso solo tiene su icono y su contenido, sin botón', () => {
    render(
      <Notice tone="success" title="Hecho" testId="aviso">
        Cuerpo
      </Notice>,
    );
    const aviso = screen.getByTestId('aviso');

    expect(aviso.children).toHaveLength(2);
    expect(aviso.children[0]).toHaveAttribute('data-slot', 'notice-icon');
    expect(aviso.children[1]?.tagName).toBe('DIV');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('R15: con `dismissible` hay un botón «Cerrar» de 44 × 44 px detrás del contenido', () => {
    render(
      <Notice tone="info" testId="aviso" dismissible={{ label: 'Cerrar', testId: 'aviso-cerrar' }}>
        Cuerpo
      </Notice>,
    );
    const boton = screen.getByRole('button', { name: 'Cerrar' });

    expect(boton).toHaveAttribute('type', 'button');
    expect(boton).toHaveAttribute('data-testid', 'aviso-cerrar');
    expect(clasesDe(boton)).toContain('size-11');
    expect(screen.getByTestId('aviso').lastElementChild).toBe(boton);
    expect(boton.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('R15: al pulsar «Cerrar» el aviso deja de pintarse', () => {
    render(
      <>
        <Notice tone="warning" testId="aviso" dismissible={{ label: 'Cerrar' }}>
          Cuerpo
        </Notice>
        <p>Resto de la página</p>
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByTestId('aviso')).not.toBeInTheDocument();
    expect(screen.getByText('Resto de la página')).toBeInTheDocument();
  });
});
