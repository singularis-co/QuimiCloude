/**
 * Las tres variables se leen en cada llamada, nunca al importar: asi la composicion arma la
 * fachada sin bucket configurado. Si falta alguna, el error las nombra sin incluir ningun valor.
 *
 * La direccion del proyecto y la credencial son las mismas de los demas buckets; lo propio de las
 * fotos es el nombre del bucket.
 */

export type EvidenceStorageConfig = {
  readonly url: string;
  readonly bucket: string;
  readonly key: string;
};

const REQUIRED_ENV_VAR_NAMES = [
  'SUPABASE_STORAGE_URL',
  'SUPABASE_EVIDENCE_BUCKET',
  'SUPABASE_STORAGE_KEY',
] as const;

/** Vacia o solo espacios cuenta como ausente. */
function readEnv(name: string): string | null {
  const raw = process.env[name];
  return raw === undefined || raw.trim() === '' ? null : raw;
}

export function readEvidenceStorageConfigFromEnv(): EvidenceStorageConfig {
  const values = REQUIRED_ENV_VAR_NAMES.map(readEnv);
  const missing = REQUIRED_ENV_VAR_NAMES.filter((_, index) => values[index] === null);
  if (missing.length > 0) {
    throw new Error(`faltan las variables de entorno: ${missing.join(', ')}`);
  }

  const [url, bucket, key] = values as [string, string, string];
  return { url, bucket, key };
}
