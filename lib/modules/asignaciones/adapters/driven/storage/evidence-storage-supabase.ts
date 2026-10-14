import { StorageClient, isStorageError } from '@supabase/storage-js';

import { readEvidenceStorageConfigFromEnv } from '../config/evidence-storage-config-env';

import type { EvidenceSignedUpload, EvidenceStorage } from '../../../ports/evidence-storage';

/**
 * El bucket privado de las fotos de evidencia. La configuracion se resuelve en cada llamada, para
 * que importar este archivo con las variables vacias no falle.
 *
 * La libreria devuelve el fallo en `error` en vez de lanzarlo: cada operacion lo envuelve con la
 * operacion y la ruta, salvo el «no existe» de la descarga, que el puerto devuelve como `null`.
 */

function bucketApi(): ReturnType<StorageClient['from']> {
  const config = readEvidenceStorageConfigFromEnv();
  const client = new StorageClient(config.url, {
    apikey: config.key,
    Authorization: `Bearer ${config.key}`,
  });
  return client.from(config.bucket);
}

/**
 * Segun la version del servicio, un objeto inexistente llega como HTTP 404 o como 400 con
 * `statusCode` 404 o el codigo `NoSuchKey`/`not_found` en el cuerpo.
 */
function isObjectNotFound(error: unknown): boolean {
  if (!isStorageError(error)) return false;
  const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  return (
    error.status === 404 || error.statusCode === '404' || code === 'NoSuchKey' || code === 'not_found'
  );
}

async function createSignedUpload(path: string): Promise<EvidenceSignedUpload> {
  const { data, error } = await bucketApi().createSignedUploadUrl(path);
  if (error) {
    throw new Error(`fallo al firmar la subida de la foto de evidencia en la ruta ${path}: ${error.message}`);
  }
  return { path: data.path, uploadUrl: data.signedUrl, token: data.token };
}

async function createSignedReadUrl(path: string, expiresInSeconds: number): Promise<string> {
  const { data, error } = await bucketApi().createSignedUrl(path, expiresInSeconds);
  if (error) {
    throw new Error(`fallo al firmar la lectura de la foto de evidencia en la ruta ${path}: ${error.message}`);
  }
  return data.signedUrl;
}

async function download(path: string): Promise<Uint8Array | null> {
  const { data, error } = await bucketApi().download(path);
  if (error) {
    if (isObjectNotFound(error)) return null;
    throw new Error(`fallo al descargar la foto de evidencia en la ruta ${path}: ${error.message}`);
  }
  return new Uint8Array(await data.arrayBuffer());
}

async function remove(path: string): Promise<void> {
  const { error } = await bucketApi().remove([path]);
  if (error) {
    throw new Error(`fallo al borrar la foto de evidencia en la ruta ${path}: ${error.message}`);
  }
}

export const evidenceStorageSupabase: EvidenceStorage = {
  createSignedUpload,
  createSignedReadUrl,
  download,
  remove,
};
