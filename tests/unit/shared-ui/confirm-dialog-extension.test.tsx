import { cleanup, render, screen, within } from '@testing-library/react';
import { TrashIcon } from 'lucide-react';
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

const TEST_IDS_CON_SLOT = {
  dialog: TEST_IDS.dialog,
  dismiss: TEST_IDS.dismiss,
  form: TEST_IDS.form,
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
  readonly confirmSlot?: NonNullable<ReactNode>;
}) {
  const comunes = {
    open: true,
    texts: TEXTS,
    submit: { kind: 'action', action: () => undefined },
    layout: 'form-wraps-all',
    contentClassName,
  } as const;
  return confirmSlot === undefined ? (
    <ConfirmDialog {...comunes} testIds={TEST_IDS} />
  ) : (
    <ConfirmDialog {...comunes} testIds={TEST_IDS_CON_SLOT} confirmSlot={confirmSlot} />
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

  it('R18: con confirmSlot no se admite testIds.confirm; sin él sigue siendo obligatorio', () => {
    const slot = <button type="submit">Terminar ya</button>;
    const conSlotYConfirm = () => (
      // @ts-expect-error con confirmSlot el testid del botón lo pone quien pasa el slot
      <ConfirmDialog open texts={TEXTS} testIds={TEST_IDS} confirmSlot={slot} />
    );
    const sinSlotNiConfirm = () => (
      // @ts-expect-error sin confirmSlot el botón propio necesita su testid
      <ConfirmDialog open texts={TEXTS} testIds={TEST_IDS_CON_SLOT} />
    );

    render(<ConfirmDialog open texts={TEXTS} testIds={TEST_IDS_CON_SLOT} confirmSlot={slot} />);

    expect(screen.getByRole('button', { name: 'Terminar ya' })).toBeInTheDocument();
    expect(conSlotYConfirm).toBeTypeOf('function');
    expect(sinSlotNiConfirm).toBeTypeOf('function');
  });

  it('R18: con contentClassName la clase llega al contenido sin quitar las suyas', () => {
    render(<Dialogo contentClassName="max-h-[100dvh] overflow-y-auto" />);

    const contenido = screen.getByTestId(TEST_IDS.dialog);
    expect(contenido).toHaveClass('max-h-[100dvh]', 'overflow-y-auto', 'fixed');
  });
});

function sigue(a: Node, b: Node): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

describe('ConfirmDialog: descriptionPlacement', () => {
  const MENSAJE = 'extension-message';
  const conMensaje = { ...TEST_IDS, message: MENSAJE } as const;

  function arbolSinPlacement(): string {
    render(
      <ConfirmDialog
        open
        texts={TEXTS}
        testIds={conMensaje}
        submit={{ kind: 'action', action: () => undefined }}
        layout="error-in-form"
        aside={<p data-testid="aside">Cifras</p>}
      />,
    );
    const arbol = arbolAccesible();
    cleanup();
    return arbol;
  }

  it('con «header» el árbol es el mismo que sin pasarla', () => {
    const antes = arbolSinPlacement();

    render(
      <ConfirmDialog
        open
        texts={TEXTS}
        testIds={conMensaje}
        submit={{ kind: 'action', action: () => undefined }}
        layout="error-in-form"
        aside={<p data-testid="aside">Cifras</p>}
        descriptionPlacement="header"
      />,
    );

    expect(arbolAccesible()).toBe(antes);
    expect(sigue(screen.getByTestId(MENSAJE), screen.getByTestId('aside'))).toBe(true);
  });

  it('con «after-aside» la descripción va tras aside y antes de children, y sigue describiendo el diálogo', () => {
    render(
      <ConfirmDialog
        open
        texts={TEXTS}
        testIds={conMensaje}
        submit={{ kind: 'action', action: () => undefined }}
        layout="error-in-form"
        aside={<p data-testid="aside">Cifras</p>}
        descriptionPlacement="after-aside"
      >
        <input aria-label="Campo" data-testid="campo" />
      </ConfirmDialog>,
    );

    const titulo = screen.getByRole('heading', { name: TEXTS.title });
    const mensaje = screen.getByTestId(MENSAJE);
    expect(sigue(titulo, screen.getByTestId('aside'))).toBe(true);
    expect(sigue(screen.getByTestId('aside'), mensaje)).toBe(true);
    expect(sigue(mensaje, screen.getByTestId('campo'))).toBe(true);
    expect(titulo.parentElement).not.toContainElement(mensaje);
    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(TEXTS.description);
  });

  it('con «after-aside» y form-wraps-all la descripción va dentro del form tras la cabecera', () => {
    render(
      <ConfirmDialog
        open
        texts={TEXTS}
        testIds={conMensaje}
        submit={{ kind: 'action', action: () => undefined }}
        layout="form-wraps-all"
        descriptionPlacement="after-aside"
      />,
    );

    const form = screen.getByTestId(TEST_IDS.form);
    expect(within(form).getByTestId(MENSAJE)).toHaveTextContent(TEXTS.description);
  });

  it('con «after-aside» sin form la descripción va tras aside', () => {
    render(
      <ConfirmDialog
        open
        texts={TEXTS}
        testIds={conMensaje}
        aside={<p data-testid="aside">Cifras</p>}
        descriptionPlacement="after-aside"
      />,
    );

    expect(sigue(screen.getByTestId('aside'), screen.getByTestId(MENSAJE))).toBe(true);
  });
});

describe('ConfirmDialog: icon', () => {
  it('sin icon el árbol no cambia y no hay media', () => {
    const antes = arbolSinExtensiones();

    render(
      <ConfirmDialog
        open
        texts={TEXTS}
        testIds={TEST_IDS}
        submit={{ kind: 'action', action: () => undefined }}
        layout="form-wraps-all"
        icon={undefined}
      />,
    );

    expect(arbolAccesible()).toBe(antes);
    expect(
      screen.getByTestId(TEST_IDS.dialog).querySelector('[data-slot="alert-dialog-media"]'),
    ).toBeNull();
  });

  it('con icon pinta el glifo decorativo en AlertDialogMedia, delante del título, con su tono', () => {
    render(
      <ConfirmDialog
        open
        texts={TEXTS}
        testIds={TEST_IDS}
        icon={{ glyph: TrashIcon, tone: 'danger', testId: 'icono' }}
      />,
    );

    const icono = screen.getByTestId('icono');
    expect(icono).toHaveAttribute('data-slot', 'alert-dialog-media');
    expect(icono).toHaveAttribute('data-tone', 'danger');
    expect(icono).toHaveClass('size-11', 'bg-destructive-subtle', 'text-destructive-text');
    const glifo = icono.querySelector('svg');
    expect(glifo).toHaveAttribute('aria-hidden', 'true');
    expect(glifo).toHaveClass('size-5');
    const titulo = screen.getByRole('heading', { name: TEXTS.title });
    expect(sigue(icono, titulo)).toBe(true);
    // Decorativo: no cambia el nombre accesible del diálogo.
    expect(screen.getByRole('alertdialog')).toHaveAccessibleName(TEXTS.title);
  });

  it('sin tone usa el fondo neutro', () => {
    render(<ConfirmDialog open texts={TEXTS} testIds={TEST_IDS} icon={{ glyph: TrashIcon, testId: 'icono' }} />);

    const icono = screen.getByTestId('icono');
    expect(icono).toHaveAttribute('data-tone', 'neutral');
    expect(icono).toHaveClass('bg-muted');
  });
});
