import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  IMPORT_STEPS_LABEL,
  IMPORT_STEPS_TESTID,
  IMPORT_STEP_LABELS,
  ImportSteps,
  importStepOf,
  importStepTestId,
  type ImportStep,
} from '@/app/(private)/inventario/importar/components';

afterEach(() => {
  cleanup();
});

const PASOS: readonly ImportStep[] = [1, 2, 3];

describe('barra de pasos', () => {
  it('R31 es una lista ordenada llamada «Pasos» con los tres pasos numerados en orden', () => {
    render(<ImportSteps current={1} />);

    const lista = screen.getByRole('list', { name: IMPORT_STEPS_LABEL });
    expect(lista.tagName).toBe('OL');
    expect(lista).toHaveAttribute('data-testid', IMPORT_STEPS_TESTID);
    const pasos = within(lista).getAllByRole('listitem');
    expect(pasos.map((paso) => paso.getAttribute('data-testid'))).toEqual(PASOS.map(importStepTestId));
    expect(pasos.map((paso) => paso.textContent)).toEqual(PASOS.map((paso) => `${paso}${IMPORT_STEP_LABELS[paso]}`));
    expect(pasos.map((paso) => paso.textContent)).toEqual([
      '1Elegir archivo',
      '2Vista previa',
      '3Importación terminada',
    ]);
  });

  for (const vigente of PASOS) {
    it(`R31 con el paso ${vigente} vigente, solo ese lleva aria-current="step"`, () => {
      render(<ImportSteps current={vigente} />);

      for (const paso of PASOS) {
        const elemento = screen.getByTestId(importStepTestId(paso));
        if (paso === vigente) expect(elemento).toHaveAttribute('aria-current', 'step');
        else expect(elemento).not.toHaveAttribute('aria-current');
      }
    });
  }

  it('R31 los pasos no son controles: ni botones, ni enlaces, ni pestañas, ni enfocables', () => {
    render(<ImportSteps current={2} />);

    const lista = screen.getByTestId(IMPORT_STEPS_TESTID);
    expect(within(lista).queryAllByRole('button')).toHaveLength(0);
    expect(within(lista).queryAllByRole('link')).toHaveLength(0);
    expect(within(lista).queryAllByRole('tab')).toHaveLength(0);
    expect(lista.querySelectorAll('[tabindex]')).toHaveLength(0);
  });

  it('R33 se desplaza en horizontal sin saltar de línea y sin pasar del ancho', () => {
    render(<ImportSteps current={1} />);

    const lista = screen.getByTestId(IMPORT_STEPS_TESTID);
    expect(lista).toHaveClass('overflow-x-auto', 'flex-nowrap', 'max-w-full');
    for (const paso of within(lista).getAllByRole('listitem')) {
      expect(paso).toHaveClass('flex-none', 'whitespace-nowrap');
    }
  });
});

describe('importStepOf', () => {
  it('R32 sin resultado es el paso 1', () => {
    expect(importStepOf(null)).toBe(1);
  });

  it('R32 un archivo rechazado sigue en el paso 1', () => {
    expect(importStepOf({ kind: 'rejected' })).toBe(1);
  });

  it('R32 la vista previa es el paso 2', () => {
    expect(importStepOf({ kind: 'preview' })).toBe(2);
  });

  it('R32 importado, sin nada importado y ya importado son el paso 3', () => {
    expect(importStepOf({ kind: 'imported' })).toBe(3);
    expect(importStepOf({ kind: 'nothing_imported' })).toBe(3);
    expect(importStepOf({ kind: 'already_imported' })).toBe(3);
  });
});
