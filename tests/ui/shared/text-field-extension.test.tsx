import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TextField } from '@/components/shared/text-field';

const ID = 'numero';
const ERROR = 'Este número no es válido.';

afterEach(() => {
  cleanup();
});

describe('TextField · placeholder', () => {
  it('R33 — `placeholder` llega al input', () => {
    render(<TextField id={ID} label="Número" placeholder="321 1234567" />);

    expect(screen.getByRole('textbox', { name: 'Número' })).toHaveAttribute(
      'placeholder',
      '321 1234567',
    );
  });

  it('R33 — sin `placeholder`, el input no lo lleva', () => {
    render(<TextField id={ID} label="Número" />);

    expect(screen.getByRole('textbox', { name: 'Número' })).not.toHaveAttribute('placeholder');
  });
});

describe('TextField · errorOutside', () => {
  it('R9 — con `errorOutside`, el input queda inválido y enlazado a `errorId`, y el campo no pinta el error', () => {
    render(<TextField id={ID} label="Número" error={ERROR} errorId="fuera" errorOutside />);

    const input = screen.getByRole('textbox', { name: 'Número' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'fuera');
    expect(screen.queryByText(ERROR)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('R9 — sin `errorOutside`, el campo pinta su error como siempre', () => {
    render(<TextField id={ID} label="Número" error={ERROR} />);

    expect(screen.getByRole('alert')).toHaveTextContent(ERROR);
    expect(screen.getByRole('textbox', { name: 'Número' })).toHaveAttribute(
      'aria-describedby',
      `${ID}-error`,
    );
  });
});
