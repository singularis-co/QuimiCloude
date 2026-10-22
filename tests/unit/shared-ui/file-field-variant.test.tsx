// `variant` de `FileField`: la vista previa de imagen llena la zona y oculta nombre y tamaño;
// sin `variant`, el campo sigue pintando la miniatura y los datos del archivo.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileField } from '@/components/shared/file-field';

import { setupUser } from '../../helpers/user-event';

const PREFIX = 'campo';

function png(name = 'foto.png'): File {
  return new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, { type: 'image/png' });
}

function montar(variant?: 'file' | 'image') {
  render(
    <FileField
      label="Imagen"
      accept={['image/png']}
      maxBytes={1024 * 1024}
      onSelect={vi.fn()}
      placeholder="Arrastra la imagen aquí o haz clic para elegirla"
      testIdPrefix={PREFIX}
      variant={variant}
    />,
  );
}

beforeEach(() => {
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FileField variant', () => {
  it('image: la vista previa llena la zona con object-contain y sin nombre ni tamaño', async () => {
    const user = setupUser();
    montar('image');

    expect(screen.getByTestId(`${PREFIX}-preview-placeholder`)).toHaveTextContent(
      'Arrastra la imagen aquí o haz clic para elegirla',
    );
    await user.upload(screen.getByTestId(`${PREFIX}-input`), png());

    const preview = await screen.findByTestId(`${PREFIX}-preview`);
    expect(preview).toHaveClass('h-full', 'w-full', 'object-contain');
    expect(screen.getByTestId(`${PREFIX}-change-hint`)).toHaveTextContent(
      'Haz clic o arrastra otro para cambiarla',
    );
    expect(screen.queryByTestId(`${PREFIX}-file-name`)).toBeNull();
    expect(screen.queryByTestId(`${PREFIX}-file-meta`)).toBeNull();
    expect(screen.getByTestId(`${PREFIX}-dropzone`)).not.toHaveTextContent('foto.png');
  });

  it('sin variant: conserva la miniatura y el nombre y el tamaño del archivo', async () => {
    const user = setupUser();
    montar();

    await user.upload(screen.getByTestId(`${PREFIX}-input`), png());

    expect(await screen.findByTestId(`${PREFIX}-file-name`)).toHaveTextContent('foto.png');
    expect(screen.getByTestId(`${PREFIX}-file-meta`)).toBeInTheDocument();
    expect(screen.getByTestId(`${PREFIX}-preview`)).toHaveClass('object-cover');
    expect(screen.queryByTestId(`${PREFIX}-change-hint`)).toBeNull();
  });
});
