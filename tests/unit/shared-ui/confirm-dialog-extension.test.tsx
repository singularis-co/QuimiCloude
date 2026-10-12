import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';

import { arbolAccesible } from '../paridad/arbol-accesible';

const TEST_IDS = {
  dialog: 'extension-dialog',
  dismiss: 'extension-dismiss',
  confirm: 'extension-confirm',
  form: 'extension-form',
} as const;

const TEXTS = {
  title: 'Terminar',
  description: 'Se va a terminar.',
  dismiss: 'Cancelar',
  confirm: 'Confirmar',
} as const;

afterEach(() => {
  cleanup();
});

function Dialogo({
  contentClassName,
  confirmSlot,
}: {
  readonly contentClassName?: string;
  readonly confirmSlot?: ReactNode;
}) {
  return (
    <ConfirmDialog
      open
      texts={TEXTS}
      testIds={TEST_IDS}
      submit={{ kind: 'action', action: () => undefined }}
      layout="form-wraps-all"
      contentClassName={contentClassName}
      confirmSlot={confirmSlot}
    />
  );
}

function arbolSinExtensiones(): string {
  render(
    <ConfirmDialog
      open
      texts={TEXTS}
      testIds={TEST_IDS}
      submit={{ kind: 'action', action: () => undefined }}
      layout="form-wraps-all"
    />,
  );
  const arbol = arbolAccesible();
  cleanup();
  return arbol;
}

describe('ConfirmDialog: contentClassName y confirmSlot', () => {
  it('R18: sin las props el árbol es el mismo que sin pasarlas', () => {
    const antes = arbolSinExtensiones();

    render(<Dialogo />);

    expect(arbolAccesible()).toBe(antes);
    expect(screen.getByTestId(TEST_IDS.confirm)).toHaveAttribute('type', 'submit');
  });

  it('R18: con confirmSlot el pie pinta el nodo dado y no el botón propio', () => {
    render(
      <Dialogo
        confirmSlot={
          <button type="submit" disabled data-testid="slot-propio">
            Terminar ya
          </button>
        }
      />,
    );

    const form = screen.getByTestId(TEST_IDS.form);
    const slot = within(form).getByTestId('slot-propio');
    expect(slot).toHaveTextContent('Terminar ya');
    expect(slot).toBeDisabled();
    expect(screen.queryByTestId(TEST_IDS.confirm)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TEXTS.confirm })).not.toBeInTheDocument();
    expect(slot.parentElement).toBe(within(form).getByTestId(TEST_IDS.dismiss).parentElement);
  });

  it('R18: con contentClassName la clase llega al contenido sin quitar las suyas', () => {
    render(<Dialogo contentClassName="max-h-[100dvh] overflow-y-auto" />);

    const contenido = screen.getByTestId(TEST_IDS.dialog);
    expect(contenido).toHaveClass('max-h-[100dvh]', 'overflow-y-auto', 'fixed');
  });
});
