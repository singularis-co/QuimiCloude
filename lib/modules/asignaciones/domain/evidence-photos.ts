/**
 * Lo que comparten los casos de uso de fotos: firmar la lectura de las fotos de un pedido y borrar
 * un archivo sin que su fallo deshaga lo ya registrado.
 */
import { EVIDENCE_READ_LINK_TTL_SECONDS, type StepEvidencePhotoView, type StepEvidenceView } from './step-evidence';

import type { EvidenceStorage } from '../ports/evidence-storage';
import type { StepEvidenceRow } from '../ports/step-evidence-repository';

/** Un borrado del bucket que fallo despues de registrar. Lo escribe en el log quien llama. */
export type EvidenceStorageWarning = {
  readonly operation: 'remove';
  readonly path: string;
  readonly message: string;
};

export async function removeEvidenceSafely(
  storage: EvidenceStorage,
  path: string,
): Promise<EvidenceStorageWarning | null> {
  try {
    await storage.remove(path);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { operation: 'remove', path, message };
  }
}

/** Para el diagnostico de un rechazo: el borrado no cambia el error que se devuelve. */
export function describeWarning(warning: EvidenceStorageWarning | null): string | undefined {
  return warning === null ? undefined : `no se pudo borrar ${warning.path}: ${warning.message}`;
}

async function signPhotos(
  storage: EvidenceStorage,
  rows: readonly StepEvidenceRow[],
): Promise<readonly StepEvidencePhotoView[]> {
  const sorted = [...rows].sort((a, b) => a.slot - b.slot);
  return Promise.all(
    sorted.map(async (row) => ({
      id: row.id,
      slot: row.slot,
      url: await storage.createSignedReadUrl(row.path, EVIDENCE_READ_LINK_TTL_SECONDS),
    })),
  );
}

/** Las fotos de un paso, por `slot`, con su URL de lectura. */
export function signStepPhotos(
  storage: EvidenceStorage,
  rows: readonly StepEvidenceRow[],
  stepPosition: number,
): Promise<readonly StepEvidencePhotoView[]> {
  return signPhotos(
    storage,
    rows.filter((row) => row.stepPosition === stepPosition),
  );
}

/** Un elemento por paso con fotos, en orden de paso. */
export async function toStepEvidenceViews(
  storage: EvidenceStorage,
  rows: readonly StepEvidenceRow[],
): Promise<readonly StepEvidenceView[]> {
  const positions = [...new Set(rows.map((row) => row.stepPosition))].sort((a, b) => a - b);
  return Promise.all(
    positions.map(async (stepPosition) => ({
      stepPosition,
      photos: await signStepPhotos(storage, rows, stepPosition),
    })),
  );
}
