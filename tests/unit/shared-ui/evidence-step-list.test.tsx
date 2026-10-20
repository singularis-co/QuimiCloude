import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EvidenceStepList } from '@/components/shared/step-evidence';
import type { OrderEvidenceGroup } from '@/lib/modules/asignaciones';

import { ORDER_EVIDENCE, ORDER_EVIDENCE_UNSIGNED, orderEvidenceGroup } from '../../fixtures/order-evidence';
import { setupUser } from '../../helpers/user-event';

afterEach(cleanup);

function rows() {
  return screen.getAllByTestId('evidence-step-row');
}

describe('EvidenceStepList', () => {
  it('R8 — rotula cada grupo «Paso N» con su número guardado y los ordena por paso', () => {
    const groups: OrderEvidenceGroup[] = [
      orderEvidenceGroup('m', 4, 1),
      orderEvidenceGroup('m', 1, 2),
      orderEvidenceGroup('m', 2, 3),
    ];
    render(<EvidenceStepList groups={groups} phaseLabel="fabricación" onRetry={vi.fn()} />);

    expect(rows().map((row) => row.getAttribute('data-step'))).toEqual(['1', '2', '4']);
    expect(within(rows()[2]!).getByText('Paso 4')).toBeInTheDocument();
    expect(screen.queryByText('Paso 3')).toBeNull();
    expect(screen.getByRole('group', { name: 'Evidencia de fabricación, paso 2' })).toBeInTheDocument();
    expect(within(rows()[1]!).getByTestId('step-evidence-count')).toHaveTextContent('3/3');
  });

  it('R8 — las fotos de cada grupo van por su casilla', () => {
    const [first] = ORDER_EVIDENCE.manufacturing;
    const reversed: OrderEvidenceGroup = { ...first!, photos: [...first!.photos!].reverse() };
    render(<EvidenceStepList groups={[reversed]} phaseLabel="fabricación" onRetry={vi.fn()} />);

    const imgs = screen.getByTestId('step-evidence-grid').querySelectorAll('img');
    expect([...imgs].map((img) => img.getAttribute('src'))).toEqual(first!.photos!.map((p) => p.url));
  });

  it('R23 — un grupo sin fotos legibles pinta su cabecera, el aviso y «Reintentar» llama a onRetry', async () => {
    const user = setupUser();
    const onRetry = vi.fn();
    render(
      <EvidenceStepList
        groups={[ORDER_EVIDENCE_UNSIGNED.manufacturing[1]!, ORDER_EVIDENCE.manufacturing[0]!]}
        phaseLabel="fabricación"
        onRetry={onRetry}
      />,
    );

    const failed = screen.getByRole('group', { name: 'Evidencia de fabricación, paso 2' });
    expect(within(failed).getByText('Paso 2')).toBeInTheDocument();
    expect(within(failed).getByTestId('step-evidence-count')).toHaveTextContent('3/3');
    expect(within(failed).getByRole('alert')).toHaveTextContent('No se pudieron cargar las fotos.');
    expect(within(failed).queryAllByRole('img', { hidden: true })).toHaveLength(0);

    await user.click(within(failed).getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    const ok = screen.getByRole('group', { name: 'Evidencia de fabricación, paso 1' });
    expect(within(ok).queryByRole('alert')).toBeNull();
  });

  it('R23 — «Reintentar» tiene un área táctil de 44 px', () => {
    render(
      <EvidenceStepList groups={ORDER_EVIDENCE_UNSIGNED.packing} phaseLabel="envasado" onRetry={vi.fn()} />,
    );

    const retry = screen.getByRole('button', { name: 'Reintentar' });
    expect(retry.className).toContain('min-h-11');
  });

  it('R25 — con la lista vacía no pinta nada: ni bloque, ni encabezado, ni aviso', () => {
    const { container } = render(
      <EvidenceStepList groups={[]} phaseLabel="envasado" onRetry={vi.fn()} testId="lista" />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('lista')).toBeNull();
  });
});
