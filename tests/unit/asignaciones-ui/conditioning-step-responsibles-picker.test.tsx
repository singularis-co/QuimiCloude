import { useState } from 'react';

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CONDITIONING_STEP_RESPONSIBLE_TESTID,
  CONDITIONING_STEP_RESPONSIBLES_COUNT_TESTID,
  CONDITIONING_STEP_RESPONSIBLES_TESTID,
  ConditioningStepResponsiblesPicker,
} from '@/app/(private)/asignacion/acondicionamiento/[id]/components';
import type { ConditioningStepCandidateView } from '@/lib/modules/asignaciones';

vi.mock('@/lib/modules/asignaciones/adapters/driving/order-conditioning-actions', () => ({
  startConditioningAction: vi.fn(),
  finishConditioningAction: vi.fn(),
  saveConditioningBatchDataAction: vi.fn(),
  recordConditioningStepAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

const CANDIDATES: readonly ConditioningStepCandidateView[] = [
  { userId: 'user-me', displayName: 'Santiago Vargas', isSelf: true },
  { userId: 'user-lg', displayName: 'Laura Gómez', isSelf: false },
  { userId: 'user-ms', displayName: 'Mateo Sánchez', isSelf: false },
];

function Controlled({ initial = [] }: { readonly initial?: readonly string[] }) {
  const [selected, setSelected] = useState<readonly string[]>(initial);
  return <ConditioningStepResponsiblesPicker candidates={CANDIDATES} selected={selected} onChange={setSelected} />;
}

function botones(): HTMLElement[] {
  return screen.getAllByTestId(CONDITIONING_STEP_RESPONSIBLE_TESTID);
}

describe('«Responsables del paso»', () => {
  it('R22: es un grupo con nombre que lista al acondicionador primero, marcado «(tú)», y después al equipo', () => {
    render(<Controlled />);

    const grupo = screen.getByRole('group', { name: 'Responsables del paso' });
    expect(grupo).toBe(screen.getByTestId(CONDITIONING_STEP_RESPONSIBLES_TESTID));
    expect(within(grupo).getByText('Elige uno o más del equipo que hicieron este paso. Puedes elegirte a ti.')).toBeInTheDocument();
    expect(botones().map((boton) => boton.getAttribute('data-user-id'))).toEqual(['user-me', 'user-lg', 'user-ms']);
    expect(botones()[0]).toHaveTextContent('Santiago Vargas(tú)');
    expect(botones()[1]).not.toHaveTextContent('(tú)');
    expect(botones()[2]).not.toHaveTextContent('(tú)');
  });

  it('R22: cada persona es un botón conmutable con aria-pressed y su avatar de iniciales', () => {
    render(<Controlled />);

    for (const boton of botones()) {
      expect(boton.tagName).toBe('BUTTON');
      expect(boton).toHaveAttribute('aria-pressed', 'false');
      expect(boton.querySelector('[data-slot="avatar"]')).not.toBeNull();
    }
    expect(within(botones()[1]!).getByText('LG')).toBeInTheDocument();
  });

  it('R22: selección múltiple; el contador dice cuántos van elegidos y se puede desmarcar', () => {
    render(<Controlled />);
    const contador = screen.getByTestId(CONDITIONING_STEP_RESPONSIBLES_COUNT_TESTID);
    expect(contador).toHaveTextContent('Ninguno elegido');

    fireEvent.click(botones()[1]!);
    expect(botones()[1]).toHaveAttribute('aria-pressed', 'true');
    expect(contador).toHaveTextContent('1 elegido');

    fireEvent.click(botones()[0]!);
    expect(botones()[0]).toHaveAttribute('aria-pressed', 'true');
    expect(contador).toHaveTextContent('2 elegidos');

    fireEvent.click(botones()[1]!);
    expect(botones()[1]).toHaveAttribute('aria-pressed', 'false');
    expect(contador).toHaveTextContent('1 elegido');
  });

  it('R22: entrega la lista nueva en el orden en que se eligió', () => {
    const onChange = vi.fn();
    render(<ConditioningStepResponsiblesPicker candidates={CANDIDATES} selected={['user-ms']} onChange={onChange} />);

    fireEvent.click(botones()[0]!);
    expect(onChange).toHaveBeenLastCalledWith(['user-ms', 'user-me']);

    fireEvent.click(botones()[2]!);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('R22: los botones miden 48 px de alto como mínimo (objetivo táctil ≥ 44 px)', () => {
    render(<Controlled />);

    for (const boton of botones()) {
      expect(boton.className.split(/\s+/)).toContain('min-h-12');
    }
  });
});
