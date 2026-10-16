// Tarjeta plegable de las secciones del operario: con `tone`, la cabecera lleva el color de su
// sección; sin él, se ve como antes.

import { cleanup, render, screen } from '@testing-library/react';
import { FlaskConicalIcon } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  OPERATOR_SECTION_TONE_CLASSES,
  OrderExecutionCollapsibleCard,
  type OperatorSectionTone,
} from '@/app/(private)/asignacion/components/order-execution-collapsible-card';

afterEach(cleanup);

const TEST_IDS = {
  card: 'tarjeta',
  trigger: 'disparador',
  count: 'contador',
  content: 'contenido',
} as const;

function pintar(tone?: OperatorSectionTone) {
  render(
    <OrderExecutionCollapsibleCard
      icon={FlaskConicalIcon}
      title="Materiales"
      titleId="titulo-materiales"
      count={3}
      tone={tone}
      testIds={TEST_IDS}
    >
      <p>dentro</p>
    </OrderExecutionCollapsibleCard>,
  );
}

function clases(testId: string): string[] {
  return screen.getByTestId(testId).className.split(/\s+/);
}

describe('OrderExecutionCollapsibleCard', () => {
  it.each([
    ['materials', 'bg-(--section-materials)'],
    ['tools', 'bg-(--section-tools)'],
    ['team', 'bg-(--section-team)'],
  ] as const)('R20: con tone=%s la cabecera lleva %s y el texto de sección', (tone, fondo) => {
    pintar(tone);

    expect(OPERATOR_SECTION_TONE_CLASSES[tone]).toBe(fondo);
    expect(clases(TEST_IDS.trigger)).toEqual(
      expect.arrayContaining([fondo, 'text-(--section-foreground)', 'w-full']),
    );
    expect(clases(TEST_IDS.count)).toEqual(
      expect.arrayContaining(['bg-(--section-foreground)/22']),
    );
    expect(clases(TEST_IDS.count)).not.toContain('bg-muted');
  });

  it('R20: sin tone la cabecera se ve como hoy, sin color de sección', () => {
    pintar();

    const disparador = clases(TEST_IDS.trigger);
    expect(disparador).toContain('rounded-xl');
    expect(disparador.some((c) => c.includes('--section-'))).toBe(false);
    expect(clases(TEST_IDS.count)).toContain('bg-muted');
    expect(screen.getByTestId(TEST_IDS.trigger)).not.toHaveAttribute('data-tone');
  });

  it('R20: abierta al entrar, con su título, su contador y el contenido montado', () => {
    pintar('materials');

    const disparador = screen.getByTestId(TEST_IDS.trigger);
    expect(disparador).toHaveAttribute('aria-expanded', 'true');
    expect(disparador).toHaveTextContent('Materiales');
    expect(screen.getByTestId(TEST_IDS.count)).toHaveTextContent('3');
    expect(screen.getByText('dentro')).toBeInTheDocument();
  });
});
