import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { OrderDistributionLabel } from '@/components/shared/order-distribution-label';

afterEach(() => {
  cleanup();
});

describe('OrderDistributionLabel', () => {
  it('R26: con una sola linea pinta «envases × nombre» sin «+0»', () => {
    render(<OrderDistributionLabel lines={[{ presentationName: 'Botella 200 ml', packages: 5 }]} />);

    const label = screen.getByTestId('order-distribution');
    expect(label.textContent).toBe('5 × Botella 200 ml');
    expect(label).not.toHaveAttribute('data-empty');
  });

  it('R26: con varias lineas pinta todas separadas por coma, sin «+N»; el title las lista todas', () => {
    render(
      <OrderDistributionLabel
        lines={[
          { presentationName: 'Botella 200 ml', packages: 5 },
          { presentationName: 'Bidón 20L', packages: 2 },
          { presentationName: 'Caja x 12', packages: 1 },
        ]}
      />,
    );

    const label = screen.getByTestId('order-distribution');
    expect(label.textContent).toBe('5 × Botella 200 ml, 2 × Bidón 20L, 1 × Caja x 12');
    expect(label).toHaveAttribute('title', '5 × Botella 200 ml, 2 × Bidón 20L, 1 × Caja x 12');
    // El texto largo salta de linea dentro de un ancho maximo, no ensancha la celda de la tabla.
    expect(label).toHaveClass('max-w-xs', 'whitespace-normal', 'break-words');
  });

  it('R27: con el reparto vacio pinta «Sin presentación»', () => {
    render(<OrderDistributionLabel lines={[]} />);

    const label = screen.getByTestId('order-distribution');
    expect(label.textContent).toBe('Sin presentación');
    expect(label).toHaveAttribute('data-empty', 'true');
  });

  it('una linea cuyo nombre no se pudo resolver lleva el marcador de ausencia, no el id', () => {
    render(<OrderDistributionLabel lines={[{ presentationName: null, packages: 3 }]} />);

    expect(screen.getByTestId('order-distribution').textContent).toBe('3 × —');
  });

  it('R44: una linea con envase pinta el nombre del envase; sin envase, el de la presentacion', () => {
    render(
      <OrderDistributionLabel
        lines={[
          { presentationName: 'Botella 200 ml', packagingName: 'Botella PET ámbar 200 ml', packages: 5 },
          { presentationName: 'Bidón 20L', packagingName: null, packages: 2 },
        ]}
      />,
    );

    const label = screen.getByTestId('order-distribution');
    expect(label.textContent).toBe('5 × Botella PET ámbar 200 ml, 2 × Bidón 20L');
    expect(label).toHaveAttribute('title', '5 × Botella PET ámbar 200 ml, 2 × Bidón 20L');
  });

  it('una linea con envase y volumen pinta «envase · volumen»; sin volumen, solo el envase', () => {
    render(
      <OrderDistributionLabel
        lines={[
          {
            presentationName: 'Botella chica',
            packagingName: 'Embase pequeño 2',
            presentationContent: '300.0000',
            presentationUnitLabel: 'ml',
            packages: 9,
          },
          { presentationName: 'Bidón 20L', packagingName: 'Bidón azul', packages: 2 },
        ]}
      />,
    );

    const label = screen.getByTestId('order-distribution');
    expect(label.textContent).toBe('9 × Embase pequeño 2 · 300 ml, 2 × Bidón azul');
    expect(label).toHaveAttribute('title', '9 × Embase pequeño 2 · 300 ml, 2 × Bidón azul');
  });
});
