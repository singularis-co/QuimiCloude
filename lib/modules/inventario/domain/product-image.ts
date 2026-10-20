/**
 * Formato y tamano de la imagen de un producto. Funcion pura: el caso de uso la llama antes de
 * subir nada.
 *
 * Copia de la regla de `recetas` y no un import de su barrel: `recetas` ya importa el de
 * `inventario`, y el ciclo entre contratos no compensa por treinta lineas.
 */

/**
 * 4.4 MB decimales: el cuerpo de una Server Action en Vercel se corta en 4.5 MB y el resto del
 * formulario necesita margen.
 */
export const MAX_PRODUCT_IMAGE_BYTES = 4_400_000;

export type ProductImageFormat = {
  readonly contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  readonly extension: 'jpg' | 'png' | 'webp';
};

export type ProductImageValidation =
  | ({ readonly ok: true } & ProductImageFormat)
  | { readonly ok: false; readonly reason: 'too_large' | 'unsupported_format' };

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46];
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50];

function matchesSignature(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.byteLength < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/** Por el contenido y nunca por la extension ni el tipo que declara el cliente. */
function detectFormat(bytes: Uint8Array): ProductImageFormat | null {
  if (matchesSignature(bytes, JPEG_SIGNATURE)) return { contentType: 'image/jpeg', extension: 'jpg' };
  if (matchesSignature(bytes, PNG_SIGNATURE)) return { contentType: 'image/png', extension: 'png' };
  if (matchesSignature(bytes, RIFF_SIGNATURE) && matchesSignature(bytes, WEBP_SIGNATURE, 8)) {
    return { contentType: 'image/webp', extension: 'webp' };
  }
  return null;
}

export function validateProductImage(bytes: Uint8Array): ProductImageValidation {
  if (bytes.byteLength > MAX_PRODUCT_IMAGE_BYTES) return { ok: false, reason: 'too_large' };

  const format = detectFormat(bytes);
  if (!format) return { ok: false, reason: 'unsupported_format' };

  return { ok: true, ...format };
}
