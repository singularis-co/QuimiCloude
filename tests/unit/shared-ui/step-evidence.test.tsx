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
    const message = 'No se pudo subir: pesa más de 4.4 MB. Elige otra foto.';
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

describe('StepEvidence en modo consulta', () => {
  function group() {
    return screen.getByRole('group', { name: 'Evidencia de fabricación, paso 3' });
  }

  function loadAll() {
    for (const img of screen.getByTestId('step-evidence-grid').querySelectorAll('img')) {
      fireEvent.load(img);
    }
  }

  it('R20 — consulta: sin añadir, cambiar ni quitar; el visor abre «Foto n del paso N» con «Cerrar»', async () => {
    const user = setupUser();
    render(
      <StepEvidence consult phaseLabel="fabricación" heading="Paso 3" stepPosition={3} photos={[OK_1, OK_2]} />,
    );
    loadAll();

    const block = group();
    expect(block).toHaveAttribute('data-consult');
    expect(within(block).getByText('Paso 3')).toBeInTheDocument();
    expect(within(block).getByTestId('step-evidence-count')).toHaveTextContent('2/3');
    expect(screen.queryByTestId('step-evidence-add')).toBeNull();
    expect(screen.queryByTestId('step-evidence-input')).toBeNull();
    expect(screen.queryByRole('button', { name: /Cambiar|Quitar|Añadir/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Foto 2 del paso 3' }));
    const viewer = await screen.findByRole('dialog', { name: 'Foto 2 del paso 3' });
    expect(within(viewer).getByRole('img', { name: 'Foto 2 del paso 3' })).toHaveAttribute('src', OK_2.url);
    await user.click(within(viewer).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('R20 — una casilla en error no ofrece «Quitar» en consulta', () => {
    render(
      <StepEvidence
        consult
        phaseLabel="fabricación"
        stepPosition={3}
        photos={[{ id: 'x', status: 'error', message: 'No se pudo mostrar.' }]}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Quitar' })).toBeNull();
  });

  it('R21 — consulta: sin «Fijada al terminar», sin «Obligatoria…» y sin textos de ayuda', () => {
    render(<StepEvidence consult phaseLabel="fabricación" stepPosition={3} photos={[OK_1]} />);

    expect(screen.queryByText('Fijada al terminar')).toBeNull();
    expect(screen.queryByText('Obligatoria · de 1 a 3 fotos')).toBeNull();
    expect(screen.queryByTestId('step-evidence-requirement')).toBeNull();
    expect(screen.queryByTestId('step-evidence-hint')).toBeNull();
    expect(screen.queryByText(/JPG, PNG o WebP/)).toBeNull();
    expect(screen.queryByText(/El pedido ya terminó/)).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('R21 — sin `consult`, ejecución y solo lectura no cambian: región «Evidencia» con sus textos y sin esqueleto', () => {
    const { rerender } = render(<StepEvidence stepPosition={1} photos={[OK_1]} />);

    expect(region()).not.toHaveAttribute('data-consult');
    expect(screen.getByText('Obligatoria · de 1 a 3 fotos')).toBeInTheDocument();
    expect(screen.getByTestId('step-evidence-hint')).toHaveTextContent(/JPG, PNG o WebP/);
    expect(screen.queryByTestId('step-evidence-skeleton')).toBeNull();
    expect(screen.queryByTestId('step-evidence-loading')).toBeNull();

    rerender(<StepEvidence stepPosition={1} photos={[OK_1]} readOnly />);
    expect(screen.getByText('Fijada al terminar')).toBeInTheDocument();
    expect(screen.getByTestId('step-evidence-hint')).toHaveTextContent(/El pedido ya terminó/);
  });

  it('R21 — sin `consult`, una miniatura que no carga no pasa a «Vista vencida»', () => {
    render(<StepEvidence stepPosition={1} photos={[OK_1]} readOnly onReload={vi.fn()} />);

    fireEvent.error(screen.getByTestId('step-evidence-tile-1').querySelector('img')!);

    expect(screen.queryByText('Vista vencida')).toBeNull();
    expect(screen.getByTestId('step-evidence-tile-1')).toHaveAttribute('data-status', 'ok');
  });

  it('R22 — cada miniatura es esqueleto con «Cargando fotos…» hasta que su imagen carga', () => {
    render(<StepEvidence consult phaseLabel="fabricación" stepPosition={3} photos={[OK_1, OK_2]} />);

    expect(screen.getAllByTestId('step-evidence-skeleton')).toHaveLength(2);
    expect(screen.getByTestId('step-evidence-loading')).toHaveTextContent('Cargando fotos…');
    expect(screen.getByTestId('step-evidence-grid')).toHaveAttribute('aria-busy', 'true');

    fireEvent.load(screen.getByTestId('step-evidence-tile-1').querySelector('img')!);
    expect(within(screen.getByTestId('step-evidence-tile-1')).queryByTestId('step-evidence-skeleton')).toBeNull();
    expect(within(screen.getByTestId('step-evidence-tile-2')).getByTestId('step-evidence-skeleton')).toBeInTheDocument();

    fireEvent.load(screen.getByTestId('step-evidence-tile-2').querySelector('img')!);
    expect(screen.queryByTestId('step-evidence-skeleton')).toBeNull();
    expect(screen.getByTestId('step-evidence-loading')).toHaveTextContent('');
    expect(screen.getByTestId('step-evidence-grid')).not.toHaveAttribute('aria-busy');
  });

  describe('miniatura ya resuelta antes de enganchar los handlers', () => {
    const proto = HTMLImageElement.prototype;
    const original = {
      complete: Object.getOwnPropertyDescriptor(proto, 'complete'),
      naturalWidth: Object.getOwnPropertyDescriptor(proto, 'naturalWidth'),
    };

    function fakeImageState(complete: boolean, naturalWidth: number) {
      Object.defineProperty(proto, 'complete', { configurable: true, get: () => complete });
      Object.defineProperty(proto, 'naturalWidth', { configurable: true, get: () => naturalWidth });
    }

    afterEach(() => {
      for (const [key, descriptor] of Object.entries(original)) {
        if (descriptor === undefined) {
          Reflect.deleteProperty(proto, key);
        } else {
          Object.defineProperty(proto, key, descriptor);
        }
      }
    });

    it('R22 — una miniatura ya cargada antes de enganchar el handler sale de cargando', () => {
      fakeImageState(true, 640);
      render(<StepEvidence consult phaseLabel="fabricación" stepPosition={3} photos={[OK_1, OK_2]} />);

      expect(screen.queryByTestId('step-evidence-skeleton')).toBeNull();
      expect(screen.getByTestId('step-evidence-loading')).toHaveTextContent('');
      expect(screen.getByTestId('step-evidence-grid')).not.toHaveAttribute('aria-busy');
      expect(screen.getByRole('button', { name: 'Foto 1 del paso 3' })).toBeInTheDocument();
    });

    it('R22 — una miniatura ya fallida antes de enganchar el handler pasa a «Vista vencida»', () => {
      fakeImageState(true, 0);
      render(<StepEvidence consult phaseLabel="fabricación" stepPosition={3} photos={[OK_1]} />);

      const tile = screen.getByTestId('step-evidence-tile-1');
      expect(tile).toHaveAttribute('data-status', 'expired');
      expect(within(tile).getByText('Vista vencida')).toBeInTheDocument();
      expect(screen.getByTestId('step-evidence-grid')).not.toHaveAttribute('aria-busy');
    });

    it('R22 — una miniatura aún sin terminar sigue en cargando', () => {
      fakeImageState(false, 0);
      render(<StepEvidence consult phaseLabel="fabricación" stepPosition={3} photos={[OK_1]} />);

      expect(screen.getByTestId('step-evidence-skeleton')).toBeInTheDocument();
      expect(screen.getByTestId('step-evidence-grid')).toHaveAttribute('aria-busy', 'true');
    });

    it('R21 — sin `consult`, una miniatura ya fallida no pasa a «Vista vencida»', () => {
      fakeImageState(true, 0);
      render(<StepEvidence stepPosition={1} photos={[OK_1]} readOnly onReload={vi.fn()} />);

      expect(screen.queryByText('Vista vencida')).toBeNull();
      expect(screen.getByTestId('step-evidence-tile-1')).toHaveAttribute('data-status', 'ok');
    });
  });

  it('R22 — la casilla `loading` pinta un esqueleto sin foto ni botón', () => {
    render(
      <StepEvidence
        consult
        phaseLabel="envasado"
        stepPosition={1}
        photos={[
          { id: 'l-1', status: 'loading' },
          { id: 'l-2', status: 'loading' },
        ]}
      />,
    );

    const tile = screen.getByTestId('step-evidence-tile-1');
    expect(tile).toHaveAttribute('data-status', 'loading');
    expect(within(tile).getByTestId('step-evidence-skeleton')).toBeInTheDocument();
    expect(tile.querySelector('img')).toBeNull();
    expect(within(tile).queryByRole('button')).toBeNull();
    expect(screen.getByText('Cargando fotos…')).toBeInTheDocument();
  });

  it('R20 — consulta: el contador n/3 cuenta las casillas que no son `error`, incluidas las `loading`', () => {
    render(
      <StepEvidence
        consult
        phaseLabel="envasado"
        stepPosition={1}
        photos={[
          OK_1,
          { id: 'l-1', status: 'loading' },
          { id: 'x', status: 'error', message: 'No se pudo mostrar.' },
        ]}
      />,
    );

    expect(screen.getByTestId('step-evidence-count')).toHaveTextContent('2/3');
    expect(screen.getByTestId('step-evidence-count')).toHaveAccessibleName('2 de 3 fotos');
  });

  it('R21 — fuera de consulta el contador sigue contando solo las `ok`', () => {
    render(<StepEvidence stepPosition={1} photos={[OK_1, { id: 'l-1', status: 'loading' }]} />);

    expect(screen.getByTestId('step-evidence-count')).toHaveTextContent('1/3');
  });

  it('R24 — si la miniatura no carga, la casilla muestra «Vista vencida» y «Recargar» llama a onReload', async () => {
    const user = setupUser();
    const onReload = vi.fn();
    render(
      <StepEvidence
        consult
        phaseLabel="fabricación"
        stepPosition={3}
        photos={[OK_1, OK_2]}
        onReload={onReload}
      />,
    );

    fireEvent.error(screen.getByTestId('step-evidence-tile-2').querySelector('img')!);

    const tile = screen.getByTestId('step-evidence-tile-2');
    expect(tile).toHaveAttribute('data-status', 'expired');
    expect(within(tile).getByText('Vista vencida')).toBeInTheDocument();
    expect(within(tile).queryByRole('button', { name: 'Foto 2 del paso 3' })).toBeNull();
    const reload = within(tile).getByRole('button', { name: 'Recargar la foto 2 del paso 3' });
    expect(reload).toHaveTextContent('Recargar');
    expect(reload.className).toContain('min-h-11');

    await user.click(reload);
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('R24 — una lectura firmada nueva de la misma foto vuelve a pintarla', () => {
    const { rerender } = render(
      <StepEvidence consult phaseLabel="fabricación" stepPosition={3} photos={[OK_1]} onReload={vi.fn()} />,
    );
    fireEvent.error(screen.getByTestId('step-evidence-tile-1').querySelector('img')!);
    expect(screen.getByText('Vista vencida')).toBeInTheDocument();

    rerender(
      <StepEvidence
        consult
        phaseLabel="fabricación"
        stepPosition={3}
        photos={[{ ...OK_1, url: 'https://storage.test/1.webp?fresh' }]}
        onReload={vi.fn()}
      />,
    );

    expect(screen.queryByText('Vista vencida')).toBeNull();
    expect(screen.getByRole('button', { name: 'Foto 1 del paso 3' })).toBeInTheDocument();
  });

  it('R24 — sin onReload la casilla vencida no pinta «Recargar»', () => {
    render(<StepEvidence consult phaseLabel="fabricación" stepPosition={3} photos={[OK_1]} />);

    fireEvent.error(screen.getByTestId('step-evidence-tile-1').querySelector('img')!);

    expect(screen.getByText('Vista vencida')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Recargar/ })).toBeNull();
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
