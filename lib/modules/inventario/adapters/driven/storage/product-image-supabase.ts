import { randomUUID } from 'node:crypto';

import { StorageClient } from '@supabase/storage-js';

import type { ProductImageStorage, ProductImageUpload } from '../../../ports/product-image-storage';

export type ProductImageStorageConfig = {
  readonly url: string;
  readonly bucket: string;
  readonly key: string;
};

/**
 * La configuracion llega como funcion y se lee en cada llamada: asi la composicion arma la
 * fachada sin variables de entorno, y el bucket es el mismo que el de recetas sin que este
 * modulo importe el adaptador de otro.
 */
export function createProductImageStorageSupabase(
  readConfig: () => ProductImageStorageConfig,
): ProductImageStorage {
  function bucketApi(): ReturnType<StorageClient['from']> {
    const config = readConfig();
    const client = new StorageClient(config.url, { apikey: config.key, Authorization: `Bearer ${config.key}` });
    return client.from(config.bucket);
  }

  return {
    async upload(image: ProductImageUpload): Promise<string> {
      const path = `productos/${randomUUID()}.${image.extension}`;
      const { error } = await bucketApi().upload(path, image.bytes, {
        contentType: image.contentType,
        upsert: false,
      });
      if (error) {
        throw new Error(`fallo al subir la imagen de producto en la ruta ${path}: ${error.message}`);
      }
      return path;
    },

    async remove(path: string): Promise<void> {
      const { error } = await bucketApi().remove([path]);
      if (error) {
        throw new Error(`fallo al borrar la imagen de producto en la ruta ${path}: ${error.message}`);
      }
    },

    publicUrl(path: string): string {
      return bucketApi().getPublicUrl(path).data.publicUrl;
    },
  };
}
