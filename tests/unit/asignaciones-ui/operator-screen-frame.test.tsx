// Marco de las pantallas del operario: alto de la ventana, scroll solo en el contenido, cabecera y
// pie en flujo con margen seguro, y raíz marcada para que la hoja global oculte la barra lateral.

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { THEME_TOGGLE_LABEL } from '@/app/(private)/components/theme-toggle';
import * as frameModule from '@/app/(private)/asignacion/components/operator-screen-frame';
import { OperatorScreenFrame } from '@/app/(private)/asignacion/components/operator-screen-frame';
import { Button } from '@/components/ui/button';

afterEach(cleanup);

const BASE = {
  eyebrow: '2026-0000003',
  title: 'Desengrasante alcalino',
  testId: 'order-execution-screen',
} as const;

const BACK = {
  href: '/asignacion?vista=por_empacar',
  label: 'Volver a «Por empacar»',
  testId: 'back-link',
} as const;

function clases(el: Element | null | undefined): string[] {
  return (el?.getAttribute('class') ?? '').split(/\s+/);
}

describe('OperatorScreenFrame — marco', () => {
  it('R1: la raíz ocupa el alto de la ventana y no hace scroll; solo la zona central lo hace', () => {
    render(
      <OperatorScreenFrame {...BASE} footer={<button type="button">Comenzar</button>}>
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    const root = screen.getByTestId('order-execution-screen');
    expect(root).toHaveAttribute('data-operator-screen');
    expect(clases(root)).toEqual(
      expect.arrayContaining(['h-dvh', 'flex', 'flex-col', 'overflow-hidden', '@container']),
    );
    expect(clases(root)).not.toContain('min-h-dvh');

    const zona = root.querySelector('[data-slot="operator-scroll"]');
    expect(clases(zona)).toEqual(
      expect.arrayContaining(['flex-1', 'min-h-0', 'overflow-y-auto', 'overscroll-contain']),
    );
    expect(zona?.contains(screen.getByText('contenido'))).toBe(true);

    const header = screen.getByRole('banner');
    const footer = screen.getByRole('contentinfo');
    expect(clases(header)).toContain('flex-none');
    expect(clases(footer)).toContain('flex-none');
    expect(zona?.contains(header)).toBe(false);
    expect(zona?.contains(footer)).toBe(false);
    expect([...root.children]).toEqual([header, zona, footer]);
  });

  it('R1: el pie va en flujo, sin position fixed, y el cuerpo no reserva su alto', () => {
    render(
      <OperatorScreenFrame {...BASE} footer={<button type="button">Comenzar</button>}>
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    expect(clases(screen.getByRole('contentinfo'))).not.toContain('fixed');
    const cuerpo = screen.getByTestId('order-execution-screen').querySelector(
      '[data-slot="operator-body"]',
    );
    expect(cuerpo?.getAttribute('class')).not.toMatch(/pb-\[calc/);
    expect(cuerpo?.getAttribute('class')).not.toContain('safe-area-inset-bottom');
  });

  it('R1: el marco ya no exporta la reserva de la columna lateral', () => {
    expect(Object.keys(frameModule)).not.toContain('STEP_READER_SIDE_COLUMN_RESERVE');
  });

  it('R1: overlay va dentro de la raíz y fuera de la zona con scroll', () => {
    render(
      <OperatorScreenFrame {...BASE} overlay={<div data-testid="capa">capa</div>}>
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    const root = screen.getByTestId('order-execution-screen');
    const capa = screen.getByTestId('capa');
    expect(root.contains(capa)).toBe(true);
    expect(root.querySelector('[data-slot="operator-scroll"]')?.contains(capa)).toBe(false);
    expect(clases(root)).toContain('relative');
  });

  it('R11: la cabecera reserva el margen seguro de arriba y el pie el de abajo', () => {
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

    expect(screen.getByRole('banner').className).toContain('env(safe-area-inset-top)');
    const footer = screen.getByRole('contentinfo');
    expect(footer.className).toContain('pb-[calc(14px+env(safe-area-inset-bottom))]');
    expect(within(footer).getByRole('button', { name: 'Siguiente' }).className).toMatch(/\bh-13\b/);
  });

  it('sin footer ni footerSlotRef no pinta pie', () => {
    render(
      <OperatorScreenFrame {...BASE}>
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('R9: footerSlotRef y progressSlotRef dan un nodo dentro del pie y otro dentro de la cabecera', () => {
    let pie: HTMLDivElement | null = null;
    let progreso: HTMLDivElement | null = null;
    render(
      <OperatorScreenFrame
        {...BASE}
        footerSlotRef={(n) => {
          pie = n;
        }}
        progressSlotRef={(n) => {
          progreso = n;
        }}
      >
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    expect(pie).not.toBeNull();
    expect(progreso).not.toBeNull();
    expect(screen.getByRole('contentinfo').contains(pie)).toBe(true);
    expect(screen.getByRole('banner').contains(progreso)).toBe(true);
  });

  it('sin progressSlotRef no hay hueco de progreso en la cabecera', () => {
    render(
      <OperatorScreenFrame {...BASE}>
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    expect(screen.getByRole('banner').querySelector('[data-slot="operator-progress"]')).toBeNull();
  });
});

describe('OperatorScreenFrame — cabecera', () => {
  it('R2: pinta la fase y el número, este en su propio elemento, y la receta como único h1', () => {
    render(
      <OperatorScreenFrame {...BASE} phaseLabel="Fabricación" eyebrowTestId="numero">
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    const header = screen.getByRole('banner');
    expect(header.querySelector('[data-slot="operator-phase"]')).toHaveTextContent(
      'Fabricación · 2026-0000003',
    );
    const numero = within(header).getByTestId('numero');
    expect(numero).toHaveAttribute('data-slot', 'operator-eyebrow');
    expect(numero.textContent).toBe('2026-0000003');
    expect(numero.className).toMatch(/\bfont-mono\b/);

    const titulos = screen.getAllByRole('heading', { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveTextContent('Desengrasante alcalino');
  });

  it('R2: sin phaseLabel la línea es solo el número', () => {
    render(
      <OperatorScreenFrame {...BASE}>
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    expect(
      screen.getByRole('banner').querySelector('[data-slot="operator-phase"]')?.textContent,
    ).toBe('2026-0000003');
  });

  it('R2: el h1 mide 30 px / 700 y baja a 24 px con contenedor de 560 px o menos', () => {
    render(
      <OperatorScreenFrame {...BASE}>
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    expect(clases(screen.getByRole('heading', { level: 1 }))).toEqual(
      expect.arrayContaining(['text-[30px]', 'font-bold', '@max-[560px]:text-2xl']),
    );
  });

  it('R2: el chip de cantidad y la insignia de estado van en la cabecera; quantity sustituye a subtitle', () => {
    render(
      <OperatorScreenFrame
        {...BASE}
        quantity={<span data-testid="cantidad">Cantidad 120,00 kg</span>}
        subtitle={<span>Pedido 120,00 kg</span>}
        status={<span data-testid="estado">En proceso</span>}
      >
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    const header = screen.getByRole('banner');
    expect(within(header).getByTestId('cantidad')).toHaveTextContent('Cantidad 120,00 kg');
    expect(within(header).getByTestId('estado')).toBeInTheDocument();
    expect(within(header).queryByText('Pedido 120,00 kg')).not.toBeInTheDocument();
  });

  it('R2: la cabecera sigue siendo pegajosa arriba', () => {
    render(
      <OperatorScreenFrame {...BASE}>
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    expect(clases(screen.getByRole('banner'))).toEqual(expect.arrayContaining(['sticky', 'top-0']));
  });

  it('R3: sin running, pinta el enlace de vuelta habilitado, táctil y con su destino', () => {
    render(
      <OperatorScreenFrame {...BASE} back={BACK}>
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    const link = screen.getByRole('link', { name: 'Volver a «Por empacar»' });
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/asignacion?vista=por_empacar');
    expect(link).toHaveAttribute('data-testid', 'back-link');
    expect(link).not.toHaveAttribute('aria-disabled');
    expect(link.className).toMatch(/\bmin-h-11\b/);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('R4: con running no hay enlace de vuelta, ni deshabilitado, y la línea de estado dice exactamente su texto', () => {
    render(
      <OperatorScreenFrame {...BASE} back={BACK} running="Fabricando">
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('back-link')).not.toBeInTheDocument();

    const estado = within(screen.getByRole('banner')).getByRole('status');
    expect(estado.textContent).toBe('Fabricando');
    expect(estado.textContent).not.toMatch(/\d/);
  });

  it('R5: a nombre de otro (sin running) la cabecera lleva la vuelta habilitada y ninguna línea de estado', () => {
    render(
      <OperatorScreenFrame {...BASE} back={BACK}>
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    expect(screen.getByRole('link', { name: 'Volver a «Por empacar»' })).toHaveAttribute('href');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('con back deshabilitado la vuelta se ve, pero no navega ni recibe el foco', () => {
    render(
      <OperatorScreenFrame {...BASE} back={{ ...BACK, disabled: true }}>
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    const vuelta = screen.getByTestId('back-link');
    expect(vuelta.tagName).not.toBe('A');
    expect(vuelta).not.toHaveAttribute('href');
    expect(vuelta).toHaveAttribute('aria-disabled', 'true');
  });

  it('R7: la cabecera conserva «Cambiar tema» de 44 px y las acciones del pedido junto a él', () => {
    render(
      <OperatorScreenFrame
        {...BASE}
        running="Fabricando"
        headerActions={
          <Button type="button" size="icon" touch>
            Acciones
          </Button>
        }
      >
        <p>contenido</p>
      </OperatorScreenFrame>,
    );

    const header = screen.getByRole('banner');
    const toggle = within(header).getByRole('button', { name: THEME_TOGGLE_LABEL });
    expect(toggle.className).toMatch(/\bsize-11\b/);
    const acciones = within(header).getByRole('button', { name: 'Acciones' });
    expect(toggle.parentElement).toBe(acciones.parentElement);
    expect(toggle.parentElement).toHaveAttribute('data-slot', 'operator-header-controls');
  });
});
