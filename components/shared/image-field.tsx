'use client';

import { MISSING_IMAGE_SRC } from './entity-image';
import { FileField } from './file-field';
import { formatMegabytes, type UploadableFileType } from './file-types';

/**
 * Campo de la imagen de una entidad (receta, producto) sobre `FileField`, con tres estados en vez
 * de `File | null | undefined`, que colapsaria «no tocado» y «quitado»:
 *
 * - `untouched`: el usuario no toco el campo; la operacion no recibe imagen y la guardada se queda.
 * - `replaced`: eligio un archivo valido; la operacion recibe sus bytes.
 * - `cleared`: pidio quitarla; la operacion recibe `null`. Solo en edicion: en el alta no se
 *   ofrece el boton, asi que el estado no se puede alcanzar desde la interfaz.
 *
 * La regla de formato y tamano la aporta el consumidor (`validate`), porque es la de su modulo y
 * se aplica sobre los bytes finales, ya comprimidos si hizo falta.
 */
export type ImageFieldState =
  | { readonly kind: 'untouched' }
  | { readonly kind: 'replaced'; readonly bytes: Uint8Array }
  | { readonly kind: 'cleared' };

export type ImageFieldValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'too_large' | 'unsupported_format' };

const ACCEPTED_TYPES: readonly UploadableFileType[] = ['image/jpeg', 'image/png', 'image/webp'];

export type ImageFieldProps = {
  readonly mode: 'create' | 'edit';
  /** Imagen guardada, que se ensena mientras el campo siga `untouched`. `null` si no hay. */
  readonly initialImageUrl: string | null;
  readonly value: ImageFieldState;
  readonly onChange: (next: ImageFieldState) => void;
  readonly maxBytes: number;
  readonly validate: (bytes: Uint8Array) => ImageFieldValidation;
  readonly testIdPrefix: string;
  readonly label?: string;
  readonly placeholder?: string;
  readonly clearLabel?: string;
  readonly tooLargeMessage?: string;
  readonly unsupportedFormatMessage?: string;
};

export function ImageField({
  mode,
  initialImageUrl,
  value,
  onChange,
  maxBytes,
  validate,
  testIdPrefix,
  label = 'Imagen',
  placeholder = 'Arrastra la imagen aquí o haz clic para elegirla',
  clearLabel = 'Quitar imagen',
  tooLargeMessage = `El archivo supera el tamaño máximo (${formatMegabytes(maxBytes)} MB).`,
  unsupportedFormatMessage = 'Formato no admitido: usa JPEG, PNG o WebP.',
}: ImageFieldProps) {
  return (
    <FileField
      label={label}
      // La zona de arrastre se explica sola; la etiqueta queda para el lector de pantalla.
      hideLabel
      variant="image"
      accept={ACCEPTED_TYPES}
      maxBytes={maxBytes}
      testIdPrefix={testIdPrefix}
      placeholder={placeholder}
      // El mismo marcador que las tablas: la aplicacion dice «aqui no hay imagen» de una sola manera.
      emptyImageSrc={MISSING_IMAGE_SRC}
      clearLabel={clearLabel}
      clearable={mode === 'edit' && value.kind !== 'cleared'}
      onClear={() => onChange({ kind: 'cleared' })}
      previewUrl={value.kind === 'untouched' ? initialImageUrl : null}
      validateBytes={(bytes) => {
        const validation = validate(bytes);
        if (validation.ok) return { ok: true };
        return {
          ok: false,
          message: validation.reason === 'too_large' ? tooLargeMessage : unsupportedFormatMessage,
        };
      }}
      onSelect={({ bytes }) => onChange({ kind: 'replaced', bytes })}
    />
  );
}
