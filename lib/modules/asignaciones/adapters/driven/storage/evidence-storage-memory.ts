import type { EvidenceSignedUpload, EvidenceStorage } from '../../../ports/evidence-storage';

/**
 * El bucket de las fotos en memoria, para el E2E sin red. La composicion solo lo elige con
 * `EVIDENCE_E2E_DOUBLES` puesta, y solo la pone `playwright.config.ts`.
 *
 * Se niega a leer o borrar una ruta que no firmo: un doble que respondiera a cualquiera dejaria
 * pasar una ruta mal emparejada. Los bytes no llegan aqui (el E2E intercepta la subida), asi que
 * `download` devuelve siempre la misma imagen PNG valida.
 */

/** Dominio reservado: no resuelve, asi que una subida sin interceptar falla en vez de salir. */
const E2E_STORAGE_ORIGIN = 'https://evidencias-e2e.invalid';

/** PNG de 1 x 1 pixel. */
const MINIMAL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const MINIMAL_PNG = Uint8Array.from(atob(MINIMAL_PNG_BASE64), (char) => char.charCodeAt(0));

const signedPaths = new Set<string>();

/** Rechaza la promesa, no lanza: quien encadena con `.catch` tambien lo ve. */
function whenSigned<T>(path: string, operation: string, run: () => T): Promise<T> {
  if (!signedPaths.has(path)) {
    return Promise.reject(
      new Error(`el almacenamiento en memoria no firmo la ruta ${path}: ${operation} imposible`),
    );
  }
  return Promise.resolve(run());
}

export const evidenceStorageMemory: EvidenceStorage = {
  createSignedUpload(path: string): Promise<EvidenceSignedUpload> {
    signedPaths.add(path);
    return Promise.resolve({
      path,
      uploadUrl: `${E2E_STORAGE_ORIGIN}/upload/${path}`,
      token: crypto.randomUUID(),
    });
  },

  createSignedReadUrl(path: string, expiresInSeconds: number): Promise<string> {
    return whenSigned(
      path,
      'firmar la lectura',
      () => `${E2E_STORAGE_ORIGIN}/read/${path}?expiresIn=${String(expiresInSeconds)}`,
    );
  },

  createSignedReadUrls(paths: readonly string[], expiresInSeconds: number): Promise<readonly string[]> {
    return Promise.all(paths.map((path) => evidenceStorageMemory.createSignedReadUrl(path, expiresInSeconds)));
  },

  download(path: string): Promise<Uint8Array | null> {
    return whenSigned(path, 'la descarga', () => MINIMAL_PNG.slice());
  },

  remove(path: string): Promise<void> {
    return whenSigned(path, 'el borrado', () => {
      signedPaths.delete(path);
    });
  },
};
