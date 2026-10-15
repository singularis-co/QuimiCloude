import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Checkbox } from '@/components/ui/checkbox';
import { setupUser } from '../../helpers/user-event';

afterEach(cleanup);

function indicatorIcon(): SVGElement | null {
  return document.querySelector('[data-slot="checkbox-indicator"] svg');
}

describe('Checkbox indeterminado', () => {
  it('R37 — con indeterminate se anuncia como mixed y pinta un guion, no la marca', () => {
    render(<Checkbox aria-label="Todo lo de Ana" indeterminate />);

    const casilla = screen.getByRole('checkbox', { name: 'Todo lo de Ana' });
    expect(casilla).toHaveAttribute('aria-checked', 'mixed');
    expect(casilla).toHaveAttribute('data-indeterminate');
    expect(indicatorIcon()).toHaveAttribute('data-icon', 'indeterminate');
    expect(indicatorIcon()).toHaveClass('lucide-minus');
  });

  it('R37 — indeterminate manda sobre checked: sigue mixed y con guion', () => {
    render(<Checkbox aria-label="Todo lo de Ana" indeterminate checked />);

    expect(screen.getByRole('checkbox', { name: 'Todo lo de Ana' })).toHaveAttribute(
      'aria-checked',
      'mixed',
    );
    expect(indicatorIcon()).toHaveAttribute('data-icon', 'indeterminate');
  });

  it('R37 — al pulsarla avisa con onCheckedChange, como una casilla normal', async () => {
    const user = setupUser();
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Todo lo de Ana" indeterminate onCheckedChange={onCheckedChange} />);

    await user.click(screen.getByRole('checkbox', { name: 'Todo lo de Ana' }));

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange.mock.calls[0]?.[0]).toBe(true);
  });

  it('R37 — sin la prop nada cambia: desmarcada sin indicador, marcada con la marca de siempre', () => {
    const { rerender } = render(<Checkbox aria-label="Frasco 200 ml" checked={false} />);

    const casilla = screen.getByRole('checkbox', { name: 'Frasco 200 ml' });
    expect(casilla).toHaveAttribute('aria-checked', 'false');
    expect(casilla).not.toHaveAttribute('data-indeterminate');
    expect(indicatorIcon()).toBeNull();

    rerender(<Checkbox aria-label="Frasco 200 ml" checked />);

    expect(casilla).toHaveAttribute('aria-checked', 'true');
    expect(casilla).not.toHaveAttribute('data-indeterminate');
    expect(indicatorIcon()).toHaveClass('lucide-check');
    expect(indicatorIcon()).not.toHaveAttribute('data-icon');
  });
});
