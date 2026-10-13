// Marco de las pantallas del operario: cabecera fija, pie fijo con margen seguro y raíz marcada
// para que la hoja global oculte la barra lateral y la cabecera privada.

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { THEME_TOGGLE_LABEL } from '@/app/(private)/components/theme-toggle';
import { OperatorScreenFrame } from '@/app/(private)/asignacion/components/operator-screen-frame';
import { Button } from '@/components/ui/button';

afterEach(cleanup);

const BASE = {
  eyebrow: '2026-0000003',
  title: 'Desengrasante alcalino',
  testId: 'order-execution-screen',
} as const;

describe('OperatorScreenFrame', () => {
  it('R1: la raíz lleva data-operator-screen y el data-testid de la pantalla', () => {
    render(
      <OperatorScreenFrame {...BASE}>
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    const root = screen.getByTestId('order-execution-screen');
    expect(root).toHaveAttribute('data-operator-screen');
    expect(root.parentElement?.querySelectorAll('[data-operator-screen]')).toHaveLength(1);
  });

  it('R2: la cabecera es pegajosa y pinta el número en mono y la receta como único h1', () => {
    render(
      <OperatorScreenFrame
        {...BASE}
        subtitle={<span>Pedido 120,00 kg</span>}
        status={<span data-testid="estado">En proceso</span>}
        headerActions={<button type="button">Acciones</button>}
      >
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    const header = screen.getByRole('banner');
    expect(header.className).toMatch(/\bsticky\b/);
    expect(header.className).toMatch(/\btop-0\b/);

    const numero = within(header).getByText('2026-0000003');
    expect(numero.className).toMatch(/\bfont-mono\b/);

    const titulos = screen.getAllByRole('heading', { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveTextContent('Desengrasante alcalino');

    expect(within(header).getByText('Pedido 120,00 kg')).toBeInTheDocument();
    expect(within(header).getByTestId('estado')).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Acciones' })).toBeInTheDocument();
  });

  it('R2, R3: la cabecera lleva «Cambiar tema» outline de 44 px', () => {
    render(
      <OperatorScreenFrame {...BASE}>
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    const toggle = within(screen.getByRole('banner')).getByRole('button', {
      name: THEME_TOGGLE_LABEL,
    });
    expect(toggle.className).toMatch(/\bsize-11\b/);
    expect(toggle.className).toMatch(/\bborder-border\b/);
  });

  it('R3: con back pinta un ArrowLink de vuelta táctil con su testid', () => {
    render(
      <OperatorScreenFrame
        {...BASE}
        back={{ href: '/asignacion?vista=por_empacar', label: 'Volver a «Por empacar»', testId: 'back-link' }}
      >
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    const link = screen.getByRole('link', { name: 'Volver a «Por empacar»' });
    expect(link).toHaveAttribute('href', '/asignacion?vista=por_empacar');
    expect(link).toHaveAttribute('data-testid', 'back-link');
    expect(link).toHaveAttribute('data-direction', 'back');
    expect(link.className).toMatch(/\bmin-h-11\b/);
    expect(link.className).toMatch(/\bmin-w-11\b/);
  });

  it('sin back no pinta enlace de vuelta', () => {
    render(
      <OperatorScreenFrame {...BASE}>
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('R2, R3: el pie es fijo, deja libre el margen seguro y sus botones xl miden 52 px', () => {
    render(
      <OperatorScreenFrame
        {...BASE}
        footer={
          <Button size="xl" type="button">
            Siguiente
          </Button>
        }
      >
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    const footer = screen.getByRole('contentinfo');
    expect(footer.className).toMatch(/\bfixed\b/);
    expect(footer.className).toMatch(/\binset-x-0\b/);
    expect(footer.className).toMatch(/\bbottom-0\b/);
    expect(footer.className).toContain('pb-[calc(14px+env(safe-area-inset-bottom))]');

    const boton = within(footer).getByRole('button', { name: 'Siguiente' });
    expect(boton.className).toMatch(/\bh-13\b/);

    const cuerpo = screen.getByText('contenido').parentElement;
    expect(cuerpo?.className).toContain('env(safe-area-inset-bottom)');
  });

  it('sin footer no pinta pie ni reserva su alto', () => {
    render(
      <OperatorScreenFrame {...BASE}>
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(screen.getByText('contenido').parentElement?.className).not.toContain(
      'safe-area-inset-bottom',
    );
  });

  it('R4: la raíz es contenedor de consultas de ancho', () => {
    render(
      <OperatorScreenFrame {...BASE}>
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    expect(screen.getByTestId('order-execution-screen').className).toMatch(/(^|\s)@container(\s|$)/);
  });
});
