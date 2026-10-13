import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { COUNTDOWN_RING_TESTID, CountdownRing } from '@/components/shared/countdown-ring';

const CIRCUNFERENCIA = 2 * Math.PI * 20;

let frames: FrameRequestCallback[] = [];

function simularMovimiento(reducido: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reducido && query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

function pasarFotograma() {
  act(() => {
    const pendientes = frames;
    frames = [];
    pendientes.forEach((callback) => callback(0));
  });
}

function progreso(): Element {
  const circulo = screen
    .getByTestId(COUNTDOWN_RING_TESTID)
    .querySelector('[data-slot="countdown-ring-progress"]');
  if (circulo === null) throw new Error('falta el círculo de progreso');
  return circulo;
}

function desplazamiento(): number {
  return Number(progreso().getAttribute('stroke-dashoffset'));
}

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  simularMovimiento(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('CountdownRing', () => {
  it('R38: está oculto a lectores de pantalla y usa el testid por defecto', () => {
    render(<CountdownRing seconds={5} />);

    expect(screen.getByTestId(COUNTDOWN_RING_TESTID)).toHaveAttribute('aria-hidden', 'true');
  });

  it('R38: arranca lleno y se vacía un fotograma después de montar', () => {
    render(<CountdownRing seconds={5} />);

    expect(desplazamiento()).toBe(0);
    pasarFotograma();
    expect(desplazamiento()).toBeCloseTo(CIRCUNFERENCIA);
  });

  it('R38: la transición es lineal y dura los `seconds` de la espera', () => {
    render(<CountdownRing seconds={7} />);

    expect((progreso() as SVGElement).style.transition).toBe('stroke-dashoffset 7s linear');
  });

  it('R38: `size` fija el lado y por defecto mide 40', () => {
    const { unmount } = render(<CountdownRing seconds={5} />);
    expect(screen.getByTestId(COUNTDOWN_RING_TESTID)).toHaveAttribute('width', '40');
    unmount();

    render(<CountdownRing seconds={5} size={20} />);
    const anillo = screen.getByTestId(COUNTDOWN_RING_TESTID);
    expect(anillo).toHaveAttribute('width', '20');
    expect(anillo).toHaveAttribute('height', '20');
  });

  it('R38: `testId` sustituye al de por defecto', () => {
    render(<CountdownRing seconds={5} testId="step-reader-wait-ring" />);

    expect(screen.getByTestId('step-reader-wait-ring')).toBeInTheDocument();
    expect(screen.queryByTestId(COUNTDOWN_RING_TESTID)).not.toBeInTheDocument();
  });

  it('R38: con movimiento reducido no anima y se queda lleno', () => {
    simularMovimiento(true);
    render(<CountdownRing seconds={5} />);

    pasarFotograma();
    expect(desplazamiento()).toBe(0);
    expect(frames).toHaveLength(0);
  });
});
