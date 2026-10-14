/** El bucket privado de las fotos de evidencia, sin nombrar al proveedor. */

export type EvidenceSignedUpload = {
  /** Ruta dentro del bucket, nunca una URL completa. */
  readonly path: string;
  readonly uploadUrl: string;
  /** El que consume la subida desde el navegador. */
  readonly token: string;
};

export interface EvidenceStorage {
  /** Sin plazo: el del enlace de subida lo fija el proveedor y nadie de este lado puede cambiarlo. */
  createSignedUpload(path: string): Promise<EvidenceSignedUpload>;
  createSignedReadUrl(path: string, expiresInSeconds: number): Promise<string>;
  /** `null` si la ruta no existe: no se subio nada. */
  download(path: string): Promise<Uint8Array | null>;
  remove(path: string): Promise<void>;
}
