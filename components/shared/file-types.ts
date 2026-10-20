// components/shared/file-types.ts
//
// El VOCABULARIO de tipos de archivo que admite `<FileField>`: una union de `type`, no un
// `string`. El consumidor delimita lo que acepta pasando un ARRAY de estos literales
// (`accept={['image/jpeg', 'image/png']}`), asi que un tipo mal escrito o no contemplado es
// un error de compilacion, no un `accept` silenciosamente inutil en tiempo de ejecucion.
//
// Sin dependencias: la deteccion por firma de las imagenes de receta ya vive en el dominio
// (`lib/modules/recetas/domain/recipe-image.ts`) y este modulo NO la duplica; aqui solo esta
// el vocabulario que necesita la UI para componer el `accept` del input y sus mensajes.

/** Tipos MIME que la UI sabe ofrecer y describir. Ampliar aqui, nunca en el consumidor. */
export type UploadableFileType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/avif'
  | 'image/gif'
  | 'application/pdf'
  | 'text/csv'
  | 'text/plain';

/** Etiqueta corta de cada tipo, para el mensaje de "formato no admitido". */
const FILE_TYPE_LABELS: Readonly<Record<UploadableFileType, string>> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/avif': 'AVIF',
  'image/gif': 'GIF',
  'application/pdf': 'PDF',
  'text/csv': 'CSV',
  'text/plain': 'TXT',
};

/** Subconjunto de imagenes: lo unico que el compresor puede reescalar y reencodear. */
export type UploadableImageType = Extract<UploadableFileType, `image/${string}`>;

/** Imagenes que un `<canvas>` sabe ESCRIBIR (GIF nunca; AVIF depende del navegador). */
export const ENCODABLE_IMAGE_TYPES: readonly UploadableImageType[] = [
  'image/webp',
  'image/jpeg',
  'image/png',
];

export function isImageType(type: UploadableFileType): type is UploadableImageType {
  return type.startsWith('image/');
}

/** `true` si `value` es uno de los tipos admitidos por `accept`. */
export function isAcceptedType(
  value: string,
  accept: readonly UploadableFileType[],
): value is UploadableFileType {
  return (accept as readonly string[]).includes(value);
}

/** Valor del atributo `accept` del input, en el orden que dio el consumidor. */
export function toAcceptAttribute(accept: readonly UploadableFileType[]): string {
  return accept.join(',');
}

/** "usa JPEG, PNG o WebP" — la lista legible que acompana al rechazo por formato. */
export function describeAcceptedTypes(accept: readonly UploadableFileType[]): string {
  const labels = accept.map((type) => FILE_TYPE_LABELS[type]);
  if (labels.length <= 1) return labels[0] ?? '';
  return `${labels.slice(0, -1).join(', ')} o ${labels[labels.length - 1]}`;
}

/**
 * Unidades DECIMALES (SI): 1 KB = 1000 B y 1 MB = 1 000 000 B. Los limites de los modulos se
 * escriben en bytes decimales (`4_400_000`, el corte del cuerpo de una Server Action en Vercel),
 * y la importacion ya los describe asi; con 1024² un limite de 4 400 000 B saldria «4.2 MB» y un
 * archivo rechazado por pasarse podria verse «4.3 MB», por debajo del limite anunciado.
 */
const BYTES_PER_KB = 1000;
const BYTES_PER_MB = 1000 * 1000;

/** Tamano en MB con como mucho un decimal, para los mensajes de limite. */
export function formatMegabytes(bytes: number): string {
  const megabytes = Math.round((bytes / BYTES_PER_MB) * 10) / 10;
  return Number.isInteger(megabytes) ? `${megabytes}` : megabytes.toFixed(1);
}

/** Tamaño legible de un archivo: `480 KB`, `2.1 MB`. Para el pie de la miniatura. */
export function formatFileSize(bytes: number): string {
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  if (bytes < BYTES_PER_MB) return `${Math.round(bytes / BYTES_PER_KB)} KB`;
  return `${formatMegabytes(bytes)} MB`;
}
