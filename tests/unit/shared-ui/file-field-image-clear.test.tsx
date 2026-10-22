import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FileField } from '@/components/shared/file-field';
import { ImageField } from '@/components/shared/image-field';

import { setupUser } from '../../helpers/user-event';

/**
 * Quitar la imagen: con `variant="image"` y vista previa es una X redonda sobre la esquina superior
 * derecha de la imagen, con tooltip; con `variant="file"` sigue siendo el botón con texto bajo la
 * zona.
 */

const PREFIX = 'probe-image';
const IMAGEN = 'https://example.test/imagen.png';
const AREA_TACTIL = ['min-h-11', 'min-w-11'];

function tooltipsAbiertos(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-slot="tooltip-content"]')).map(
    (popup) => popup.textContent ?? '',
  );
}

function montarImagen(onClear = vi.fn<() => void>()) {
  render(
    <FileField
      label="Imagen"
      variant="image"
      accept={['image/png']}
      maxBytes={1024}
      onSelect={vi.fn()}
      onClear={onClear}
      clearable
      clearLabel="Quitar imagen"
      previewUrl={IMAGEN}
      testIdPrefix={PREFIX}
    />,
  );
  return onClear;
}

afterEach(() => {
  cleanup();
});

describe('FileField — quitar la imagen', () => {
  it('con imagen, quitar es una X sin texto dentro de la zona, en la esquina superior derecha', () => {
    montarImagen();

    const quitar = screen.getByTestId(`${PREFIX}-clear`);
    expect(screen.getByTestId(`${PREFIX}-dropzone`).contains(quitar)).toBe(true);
    expect(quitar).toHaveAccessibleName('Quitar imagen');
    expect(quitar).toHaveTextContent('');
    expect(quitar.querySelector('svg[aria-hidden]')).not.toBeNull();
    expect(quitar).toHaveAttribute('type', 'button');
    expect(quitar).toHaveClass('absolute', 'top-1', 'right-1', 'rounded-full', 'bg-black/60');
    expect(quitar).toHaveClass(...AREA_TACTIL);
  });

  it('pulsar la X quita la imagen sin abrir el selector de archivos', async () => {
    const user = setupUser();
    const onClear = montarImagen();
    const input = screen.getByTestId<HTMLInputElement>(`${PREFIX}-input`);
    const abrirSelector = vi.spyOn(input, 'click');

    await user.click(screen.getByTestId(`${PREFIX}-clear`));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(abrirSelector).not.toHaveBeenCalled();
  });

  it('el puntero o el foco sobre la X muestran el tooltip «Quitar imagen»', async () => {
    const user = setupUser();
    montarImagen();

    const quitar = screen.getByTestId(`${PREFIX}-clear`);
    await user.hover(quitar);
    await waitFor(() => expect(tooltipsAbiertos()).toContain('Quitar imagen'));
    await user.unhover(quitar);

    quitar.blur();
    await user.tab();
    expect(quitar).toHaveFocus();
    await waitFor(() => expect(tooltipsAbiertos()).toContain('Quitar imagen'));
  });

  it('con variant="file" quitar sigue siendo el botón con texto, fuera de la zona', () => {
    render(
      <FileField
        label="Documento"
        accept={['image/png']}
        maxBytes={1024}
        onSelect={vi.fn()}
        onClear={vi.fn()}
        clearable
        clearLabel="Quitar archivo"
        previewUrl={IMAGEN}
        testIdPrefix={PREFIX}
      />,
    );

    const quitar = screen.getByTestId(`${PREFIX}-clear`);
    expect(screen.getByTestId(`${PREFIX}-dropzone`).contains(quitar)).toBe(false);
    expect(quitar).toHaveTextContent('Quitar archivo');
  });
});

describe('ImageField — X de quitar', () => {
  it('en edición con imagen guardada ofrece la X «Quitar imagen» sobre la imagen; en el alta no', () => {
    const props = {
      initialImageUrl: IMAGEN,
      value: { kind: 'untouched' } as const,
      onChange: vi.fn(),
      maxBytes: 1024,
      validate: () => ({ ok: true }) as const,
      testIdPrefix: PREFIX,
    };
    const { unmount } = render(<ImageField mode="edit" {...props} />);

    const zona = screen.getByTestId(`${PREFIX}-dropzone`);
    expect(within(zona).getByRole('button', { name: 'Quitar imagen' })).toHaveAttribute(
      'data-testid',
      `${PREFIX}-clear`,
    );
    unmount();

    render(<ImageField mode="create" {...props} />);
    expect(screen.queryByTestId(`${PREFIX}-clear`)).toBeNull();
  });
});
