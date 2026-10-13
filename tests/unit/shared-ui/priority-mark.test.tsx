import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PriorityMark, type PriorityLevel } from '@/components/shared/priority-mark';

function classesOf(element: Element): string[] {
  return (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}

function iconOf(mark: HTMLElement): SVGElement {
  const svg = mark.querySelector('svg');
  if (svg === null) throw new Error('PriorityMark no pinto el icono');
  return svg;
}

const ETIQUETAS: Readonly<Record<PriorityLevel, string>> = { 1: 'Baja', 2: 'Media', 3: 'Alta', 4: 'Crítica' };

afterEach(cleanup);

describe('PriorityMark', () => {
  it.each([1, 2, 3] as const)('R12 — el nivel %i pinta tres barras crecientes con esa cantidad llenas y las vacías atenuadas', (level) => {
    render(<PriorityMark level={level} label={ETIQUETAS[level]} data-testid="mark" />);
    const barras = Array.from(iconOf(screen.getByTestId('mark')).querySelectorAll('rect'));

    expect(barras).toHaveLength(3);
    expect(barras.map((barra) => Number(barra.getAttribute('height')))).toEqual([5, 9, 13]);
    expect(barras.filter((barra) => barra.getAttribute('data-filled') === 'true')).toHaveLength(level);
    for (const barra of barras.filter((b) => b.getAttribute('data-filled') === 'false')) {
      expect(barra).toHaveAttribute('opacity', '0.2');
    }
    expect(screen.getByTestId('mark')).toHaveTextContent(ETIQUETAS[level]);
  });

  it.each([1, 2, 3] as const)('R13 — el nivel %i no lleva color de estado ni peso 600', (level) => {
    render(<PriorityMark level={level} label={ETIQUETAS[level]} data-testid="mark" />);
    const clases = classesOf(screen.getByTestId('mark'));

    expect(clases.filter((clase) => /^text-(destructive|warning|success|info)/.test(clase))).toEqual([]);
    expect(clases).not.toContain('font-semibold');
  });

  it('R13 — el nivel 4 (Crítica) pinta un triángulo de aviso en vez de barras, en color de peligro y peso 600', () => {
    render(<PriorityMark level={4} label={ETIQUETAS[4]} data-testid="mark" />);
    const mark = screen.getByTestId('mark');
    const icono = iconOf(mark);

    expect(icono.querySelector('path')).not.toBeNull();
    expect(icono.querySelectorAll('rect[data-filled]')).toHaveLength(0);
    expect(classesOf(mark)).toEqual(expect.arrayContaining(['text-destructive-text', 'font-semibold']));
    expect(mark).toHaveTextContent(ETIQUETAS[4]);
  });

  it.each([1, 2, 3, 4] as const)(
    'R14 — el nivel %i oculta el icono a lectores, deja la etiqueta como nombre y no la parte',
    (level) => {
      render(<PriorityMark level={level} label={ETIQUETAS[level]} data-testid="mark" />);
      const mark = screen.getByTestId('mark');

      expect(iconOf(mark)).toHaveAttribute('aria-hidden', 'true');
      expect(mark.textContent).toBe(ETIQUETAS[level]);
      expect(classesOf(mark)).toContain('whitespace-nowrap');
    },
  );
});
