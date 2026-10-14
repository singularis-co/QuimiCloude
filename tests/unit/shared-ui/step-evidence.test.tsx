import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  EvidenceMissingDialog,
  StepEvidence,
  type StepEvidenceTile,
} from '@/components/shared/step-evidence';

import { setupUser } from '../../helpers/user-event';

afterEach(cleanup);

const OK_1: StepEvidenceTile = { id: 'ev-1', status: 'ok', url: 'https://storage.test/1.webp' };
const OK_2: StepEvidenceTile = { id: 'ev-2', status: 'ok', url: 'https://storage.test/2.webp' };
const OK_3: StepEvidenceTile = { id: 'ev-3', status: 'ok', url: 'https://storage.test/3.webp' };

function photo(name = 'foto.jpg', type = 'image/jpeg'): File {
  return new File([new Uint8Array([1])], name, { type });
}

function region() {
  return screen.getByRole('region', { name: 'Evidencia' });
}

describe('StepEvidence', () => {
  it('R13 — sin fotos: bloque «Evidencia», contador 0/3, texto de obligatoria y «Añadir foto»', () => {
    render(<StepEvidence stepPosition={1} photos={[]} />);

    const block = region();
    expect(within(block).getByTestId('step-evidence-count')).toHaveTextContent('0/3');
    expect(within(block).getByTestId('step-evidence-count')).toHaveAccessibleName('0 de 3 fotos');
    expect(within(block).getByText('Obligatoria · de 1 a 3 fotos')).toBeInTheDocument();
    expect(within(block).getByRole('button', { name: /Añadir foto/ })).toBeInTheDocument();
    expect(within(block).queryByRole('button', { name: /Añadir otra foto/ })).toBeNull();
    expect(within(block).queryAllByRole('img', { hidden: true })).toHaveLength(0);
  });

  it('R13 — con 1 o 2 fotos: las pinta, las cuenta y ofrece «Añadir otra foto»', () => {
    const { rerender } = render(<StepEvidence stepPosition={2} photos={[OK_1]} />);

    expect(screen.getByTestId('step-evidence-count')).toHaveTextContent('1/3');
    expect(screen.getByRole('button', { name: 'Foto 1 del paso 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Añadir otra foto/ })).toBeInTheDocument();

    rerender(<StepEvidence stepPosition={2} photos={[OK_1, OK_2]} />);

    expect(screen.getByTestId('step-evidence-count')).toHaveTextContent('2/3');
    expect(screen.getByRole('button', { name: 'Foto 2 del paso 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Añadir otra foto/ })).toBeInTheDocument();
  });

  it('R13 — con 3 fotos no hay casilla de añadir', () => {
    render(<StepEvidence stepPosition={1} photos={[OK_1, OK_2, OK_3]} />);

    expect(screen.getByTestId('step-evidence-count')).toHaveTextContent('3/3');
    expect(screen.queryByTestId('step-evidence-add')).toBeNull();
  });

  it('R16 — una foto subiendo muestra su porcentaje y su barra, y no cuenta', () => {
    render(
      <StepEvidence
        stepPosition={1}
        photos={[OK_1, { id: 'local-1', status: 'uploading', percent: 40 }]}
      />,
    );

    const tile = screen.getByTestId('step-evidence-tile-2');
    expect(within(tile).getByRole('status')).toHaveTextContent('Subiendo 40 %');
    expect(within(tile).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByTestId('step-evidence-count')).toHaveTextContent('1/3');
    expect(within(tile).queryByRole('button')).toBeNull();
  });

  it('R17 — una casilla en error muestra su motivo, no cuenta y «Quitar» la descarta', async () => {
    const user = setupUser();
    const onRemove = vi.fn();
    const message = 'No se pudo subir: pesa más de 5 MB. Elige otra foto.';
    render(
      <StepEvidence
        stepPosition={1}
        photos={[{ id: 'local-1', status: 'error', message }]}
        onRemove={onRemove}
      />,
    );

    const tile = screen.getByTestId('step-evidence-tile-1');
    expect(within(tile).getByRole('alert')).toHaveTextContent(message);
    expect(screen.getByTestId('step-evidence-count')).toHaveTextContent('0/3');

    await user.click(within(tile).getByRole('button', { name: 'Quitar' }));
    expect(onRemove).toHaveBeenCalledWith('local-1');
  });

  it('R18 — elegir un archivo con «Añadir foto» lo entrega a onAdd', async () => {
    const user = setupUser();
    const onAdd = vi.fn();
    const onChange = vi.fn();
    render(<StepEvidence stepPosition={1} photos={[]} onAdd={onAdd} onChange={onChange} />);
    const file = photo();

    await user.click(screen.getByRole('button', { name: /Añadir foto/ }));
    await user.upload(screen.getByTestId('step-evidence-input'), file);

    expect(onAdd).toHaveBeenCalledWith(file);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('R18 — en escritorio se puede soltar una foto sobre «Añadir foto»', () => {
    const onAdd = vi.fn();
    render(<StepEvidence stepPosition={1} photos={[]} onAdd={onAdd} />);
    const file = photo();

    fireEvent.drop(screen.getByTestId('step-evidence-add'), { dataTransfer: { files: [file] } });

    expect(onAdd).toHaveBeenCalledWith(file);
  });

  it('R19 — «Cambiar» entrega el archivo nuevo con la foto que sustituye', async () => {
    const user = setupUser();
    const onAdd = vi.fn();
    const onChange = vi.fn();
    render(<StepEvidence stepPosition={2} photos={[OK_1, OK_2]} onAdd={onAdd} onChange={onChange} />);
    const file = photo('nueva.png', 'image/png');

    await user.click(screen.getByRole('button', { name: 'Cambiar la foto 2 del paso 2' }));
    await user.upload(screen.getByTestId('step-evidence-input'), file);

    expect(onChange).toHaveBeenCalledWith('ev-2', file);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('R19 — «Quitar» sobre una foto contada la retira', async () => {
    const user = setupUser();
    const onRemove = vi.fn();
    render(<StepEvidence stepPosition={3} photos={[OK_1, OK_2]} onRemove={onRemove} />);

    await user.click(screen.getByRole('button', { name: 'Quitar la foto 1 del paso 3' }));

    expect(onRemove).toHaveBeenCalledWith('ev-1');
  });

  it('R20 — tocar una foto la abre ampliada en un diálogo que se cierra con «Cerrar»', async () => {
    const user = setupUser();
    render(<StepEvidence stepPosition={2} photos={[OK_1, OK_2]} />);

    await user.click(screen.getByRole('button', { name: 'Foto 2 del paso 2' }));

    const viewer = await screen.findByRole('dialog', { name: 'Foto 2 del paso 2' });
    expect(within(viewer).getByRole('img', { name: 'Foto 2 del paso 2' })).toHaveAttribute(
      'src',
      OK_2.url,
    );

    await user.click(within(viewer).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('R21 — en un paso anterior, añadir, cambiar y quitar siguen disponibles con las mismas reglas', async () => {
    const user = setupUser();
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    render(<StepEvidence stepPosition={1} photos={[OK_1]} onAdd={onAdd} onRemove={onRemove} />);

    expect(screen.getByRole('button', { name: 'Cambiar la foto 1 del paso 1' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Quitar la foto 1 del paso 1' }));
    await user.upload(screen.getByTestId('step-evidence-input'), photo());

    expect(onRemove).toHaveBeenCalledWith('ev-1');
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('R24 — en solo lectura muestra las fotos sin añadir, cambiar ni quitar, fijadas al terminar', async () => {
    const user = setupUser();
    render(<StepEvidence stepPosition={1} photos={[OK_1, OK_2]} readOnly />);

    expect(screen.getByText('Fijada al terminar')).toBeInTheDocument();
    expect(
      screen.getByText('El pedido ya terminó: las fotos no se pueden cambiar ni quitar.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Obligatoria · de 1 a 3 fotos')).toBeNull();
    expect(screen.queryByTestId('step-evidence-add')).toBeNull();
    expect(screen.queryByTestId('step-evidence-input')).toBeNull();
    expect(screen.queryByRole('button', { name: /Cambiar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Quitar/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Foto 1 del paso 1' }));
    expect(await screen.findByRole('dialog', { name: 'Foto 1 del paso 1' })).toBeInTheDocument();
  });

  it('R25 — «Añadir foto», «Cambiar» y «Quitar» tienen un área táctil de al menos 44 × 44 px', () => {
    render(
      <StepEvidence
        stepPosition={1}
        photos={[OK_1, { id: 'local-1', status: 'error', message: 'No se pudo subir.' }]}
      />,
    );

    const controls = [
      screen.getByTestId('step-evidence-add'),
      screen.getByRole('button', { name: 'Cambiar la foto 1 del paso 1' }),
      screen.getByRole('button', { name: 'Quitar la foto 1 del paso 1' }),
      within(screen.getByTestId('step-evidence-tile-2')).getByRole('button', { name: 'Quitar' }),
    ];
    for (const control of controls) {
      expect(control.className).toContain('min-h-11');
      expect(control.className).toContain('min-w-11');
    }
  });

  it('R25 — la entrada de archivo admite solo JPEG, PNG y WebP y pide la cámara trasera', () => {
    render(<StepEvidence stepPosition={1} photos={[]} />);

    const input = screen.getByTestId('step-evidence-input');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
    expect(input).toHaveAttribute('capture', 'environment');
    expect(input).not.toHaveAttribute('multiple');
  });
});

describe('EvidenceMissingDialog', () => {
  it('R22 — lista un botón «Paso <n>» por paso sin fotos que lleva a ese paso', async () => {
    const user = setupUser();
    const onOpenChange = vi.fn();
    const onGoToStep = vi.fn();
    render(
      <EvidenceMissingDialog
        open
        onOpenChange={onOpenChange}
        positions={[1, 3]}
        onGoToStep={onGoToStep}
      />,
    );

    const dialog = await screen.findByRole('alertdialog', { name: 'Falta evidencia' });
    expect(within(dialog).getByRole('button', { name: 'Paso 1' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Paso 3' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Paso 3' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onGoToStep).toHaveBeenCalledWith(3);
  });

  it('R22 — «Cerrar» cierra sin ir a ningún paso', async () => {
    const user = setupUser();
    const onOpenChange = vi.fn();
    const onGoToStep = vi.fn();
    render(
      <EvidenceMissingDialog open onOpenChange={onOpenChange} positions={[2]} onGoToStep={onGoToStep} />,
    );

    const dialog = await screen.findByRole('alertdialog', { name: 'Falta evidencia' });
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar' }));

    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
    expect(onGoToStep).not.toHaveBeenCalled();
  });
});
