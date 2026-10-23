import { cleanup, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PropagateVersionsDialog } from '@/app/(private)/produccion/formulas/components/propagate-versions-dialog';

import { setupUser } from '../../helpers/user-event';

type Version = { readonly id: string; readonly name: string; readonly isUnderReview: boolean };

const UNA: readonly Version[] = [{ id: 'v-1', name: 'Sin perfume', isUnderReview: false }];
const TRES: readonly Version[] = [
  { id: 'v-1', name: 'Sin perfume', isUnderReview: false },
  { id: 'v-2', name: 'Concentrada', isUnderReview: true },
  { id: 'v-3', name: 'Diluida', isUnderReview: false },
];

function Anfitrion({
  versions,
  onSave,
}: {
  readonly versions: readonly Version[];
  readonly onSave: (ids: readonly string[]) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" data-testid="reabrir" onClick={() => setOpen(true)}>
        Reabrir
      </button>
      <PropagateVersionsDialog
        open={open}
        versions={versions}
        onOpenChange={setOpen}
        onSave={(ids) => {
          onSave(ids);
          setOpen(false);
        }}
      />
    </>
  );
}

async function abrir(versions: readonly Version[], onSave = vi.fn<(ids: readonly string[]) => void>()) {
  render(<Anfitrion versions={versions} onSave={onSave} />);
  const dialogo = await screen.findByTestId('propagate-versions-dialog');
  return { dialogo, onSave };
}

afterEach(() => {
  cleanup();
});

describe('PropagateVersionsDialog — rediseño (QC-264)', () => {
  it('R27: con una versión, el título va en singular con el número en monoespaciada', async () => {
    const { dialogo } = await abrir(UNA);

    const titulo = within(dialogo).getByTestId('propagate-versions-title');
    expect(titulo).toHaveTextContent('1 versión parte de esta fórmula');
    const cifra = within(titulo).getByTestId('propagate-versions-count');
    expect(cifra).toHaveTextContent('1');
    expect(cifra).toHaveClass('font-mono');
    expect(within(dialogo).getByRole('heading', { name: '1 versión parte de esta fórmula' })).toBe(
      titulo,
    );
  });

  it('R27: con varias, el título va en plural con el número en monoespaciada', async () => {
    const { dialogo } = await abrir(TRES);

    const titulo = within(dialogo).getByTestId('propagate-versions-title');
    expect(titulo).toHaveTextContent('3 versiones parten de esta fórmula');
    expect(within(titulo).getByTestId('propagate-versions-count')).toHaveClass('font-mono');
  });

  it('R28: cada versión es una fila de al menos 48 px con su casilla y su nombre', async () => {
    const { dialogo } = await abrir(TRES);

    const filas = within(dialogo).getAllByTestId('propagate-version-row');
    expect(filas).toHaveLength(3);
    filas.forEach((fila, indice) => {
      expect(fila).toHaveClass('min-h-12');
      const casilla = within(fila).getByRole('checkbox', { name: TRES[indice]?.name });
      expect(casilla).toHaveAttribute('data-version-id', TRES[indice]?.id);
      expect(casilla).toHaveClass('min-h-11', 'min-w-11');
    });
  });

  it('R28: «Por revisar» es un StatusBadge waiting solo en las versiones que lo están', async () => {
    const { dialogo } = await abrir(TRES);

    const [primera, segunda, tercera] = within(dialogo).getAllByTestId('propagate-version-row');
    expect(within(primera).queryByTestId('propagate-version-under-review')).toBeNull();
    expect(within(tercera).queryByTestId('propagate-version-under-review')).toBeNull();
    const marca = within(segunda).getByTestId('propagate-version-under-review');
    expect(marca).toHaveAttribute('data-slot', 'badge');
    expect(marca).toHaveAttribute('data-tone', 'waiting');
    expect(marca).toHaveTextContent('Por revisar');
    expect(within(segunda).getByRole('checkbox')).toHaveAccessibleName('Concentrada');
  });

  it('R29: todas marcadas al abrir; propagar envía las marcadas en el orden de la lista', async () => {
    const user = setupUser();
    const { dialogo, onSave } = await abrir(TRES);

    const casillas = within(dialogo).getAllByRole('checkbox');
    for (const casilla of casillas) expect(casilla).toHaveAttribute('aria-checked', 'true');

    await user.click(casillas[1] as HTMLElement);
    await user.click(within(dialogo).getByTestId('propagate-versions-confirm'));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(['v-1', 'v-3']);
  });

  it('R29: sin ninguna marcada «Guardar y propagar» queda deshabilitado; «Guardar sin propagar» envía la lista vacía', async () => {
    const user = setupUser();
    const { dialogo, onSave } = await abrir(UNA);

    await user.click(within(dialogo).getByRole('checkbox'));
    expect(within(dialogo).getByTestId('propagate-versions-confirm')).toBeDisabled();

    await user.click(within(dialogo).getByTestId('propagate-versions-skip'));
    expect(onSave).toHaveBeenCalledWith([]);
  });

  it('R29: «Cancelar», «Guardar sin propagar» y «Guardar y propagar» conservan su texto y su área táctil', async () => {
    const { dialogo } = await abrir(TRES);

    const botones = [
      within(dialogo).getByTestId('propagate-versions-cancel'),
      within(dialogo).getByTestId('propagate-versions-skip'),
      within(dialogo).getByTestId('propagate-versions-confirm'),
    ];
    expect(botones.map((boton) => boton.textContent)).toEqual([
      'Cancelar',
      'Guardar sin propagar',
      'Guardar y propagar',
    ]);
    for (const boton of botones) expect(boton).toHaveClass('min-h-11');
    expect(dialogo).toHaveClass('max-h-[85dvh]');
  });

  it('R29: al reabrir tras cancelar con una desmarcada, vuelven a estar todas marcadas', async () => {
    const user = setupUser();
    const { dialogo, onSave } = await abrir(TRES);

    await user.click(within(dialogo).getAllByRole('checkbox')[0] as HTMLElement);
    await user.click(within(dialogo).getByTestId('propagate-versions-cancel'));
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('reabrir'));
    const otraVez = await screen.findByTestId('propagate-versions-dialog');
    for (const casilla of within(otraVez).getAllByRole('checkbox')) {
      expect(casilla).toHaveAttribute('aria-checked', 'true');
    }
  });
});
