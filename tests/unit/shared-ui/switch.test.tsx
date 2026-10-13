import { useState } from 'react';

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Switch } from '@/components/ui/switch';

afterEach(cleanup);

function Controlado({ onChange }: { readonly onChange?: (checked: boolean) => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <Switch
      checked={checked}
      onCheckedChange={(next) => {
        setChecked(next);
        onChange?.(next);
      }}
    >
      Requiere evidencia
    </Switch>
  );
}

describe('Switch', () => {
  it('R1 — se anuncia como interruptor, apagado por defecto, con el texto como nombre', () => {
    render(<Switch>Requiere evidencia</Switch>);

    const control = screen.getByRole('switch', { name: 'Requiere evidencia' });
    expect(control).toHaveAttribute('aria-checked', 'false');
  });

  it('R1 — al pulsarlo cambia aria-checked y avisa del nuevo valor', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlado onChange={onChange} />);
    const control = screen.getByRole('switch', { name: 'Requiere evidencia' });

    await user.click(control);
    expect(control).toHaveAttribute('aria-checked', 'true');
    expect(onChange).toHaveBeenLastCalledWith(true);

    await user.click(control);
    expect(control).toHaveAttribute('aria-checked', 'false');
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('R1 — se opera con teclado: Tab lo enfoca y Espacio o Enter lo conmutan', async () => {
    const user = userEvent.setup();
    render(<Controlado />);
    const control = screen.getByRole('switch', { name: 'Requiere evidencia' });

    await user.tab();
    expect(control).toHaveFocus();

    await user.keyboard(' ');
    expect(control).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{Enter}');
    expect(control).toHaveAttribute('aria-checked', 'false');
  });

  it('R1 — deshabilitado no cambia ni con el puntero ni con el teclado', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Switch disabled onCheckedChange={onChange}>
        Requiere evidencia
      </Switch>,
    );
    const control = screen.getByRole('switch', { name: 'Requiere evidencia' });

    expect(control).toHaveAttribute('aria-disabled', 'true');
    await user.click(control);
    control.focus();
    await user.keyboard(' ');

    expect(control).toHaveAttribute('aria-checked', 'false');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('R1 — pista de 36 × 20 y botón de 16 px que se desliza 16 px en 200 ms', () => {
    render(<Switch defaultChecked>Requiere evidencia</Switch>);
    const control = screen.getByRole('switch', { name: 'Requiere evidencia' });
    const track = control.querySelector('[data-slot="switch-track"]');
    const thumb = control.querySelector('[data-slot="switch-thumb"]');

    expect(track?.className).toEqual(expect.stringContaining('h-5 w-9'));
    expect(track?.className).toContain('group-data-checked/switch:bg-primary');
    expect(track?.className).toContain('bg-input');
    expect(track?.className).toContain('duration-200');
    expect(thumb?.className).toContain('size-4');
    expect(thumb?.className).toContain('data-checked:translate-x-4');
    expect(thumb?.className).toContain('duration-200');
    expect(thumb).toHaveAttribute('data-checked');
  });

  it('R1 — área táctil de 44 px en teléfono', () => {
    render(<Switch>Requiere evidencia</Switch>);
    const control = screen.getByRole('switch', { name: 'Requiere evidencia' });

    expect(control.className).toContain('min-h-11');
    expect(control.className).toContain('min-w-11');
  });
});
