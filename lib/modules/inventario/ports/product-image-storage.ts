/** Archivo ya validado por `validateProductImage`, listo para subir. */
export type ProductImageUpload = {
  readonly bytes: Uint8Array;
  readonly contentType: string;
  readonly extension: 'jpg' | 'png' | 'webp';
};

export interface ProductImageStorage {
  /** Devuelve la RUTA dentro del bucket (`productos/<uuid>.<ext>`), que es lo que se guarda. */
  upload(image: ProductImageUpload): Promise<string>;

  /** Unico borrado: lo usan tanto reemplazar como quitar la imagen. */
  remove(path: string): Promise<void>;

  /** URL publica de lectura compuesta a partir de la ruta guardada. */
  publicUrl(path: string): string;
}
