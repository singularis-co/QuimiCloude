/**
 * Las fotos guardadas de un pedido, para consultarlas despues de ejecutarlo. Puro: sin I/O, para
 * que la pantalla use los tipos tal cual desde el barril.
 *
 * Un grupo se rotula con el numero de paso con el que se guardo la foto, no con la posicion que
 * ese paso tenga hoy en la formula: la formula puede haberse editado despues.
 */
import type { StepEvidencePhotoView } from './step-evidence';
import type { StepEvidenceRow } from '../ports/step-evidence-repository';

export type OrderEvidenceGroup = {
  readonly stepPosition: number;
  readonly photoCount: number;
  /** `null` si no se pudo firmar la lectura: la pantalla ofrece reintentar. */
  readonly photos: readonly StepEvidencePhotoView[] | null;
};

export type OrderEvidence = {
  /** Por `stepPosition` ascendente. */
  readonly manufacturing: readonly OrderEvidenceGroup[];
  readonly packing: readonly OrderEvidenceGroup[];
};

export type OrderEvidenceCount = { readonly orderId: string; readonly photoCount: number };

/** Lo que devuelven los casos de uso: `signingFailure` va al log y nunca a la pantalla. */
export type OrderEvidenceRead = {
  readonly evidence: OrderEvidence;
  readonly signingFailure: string | null;
};

export type StepEvidenceRowGroup = {
  readonly stepPosition: number;
  readonly rows: readonly StepEvidenceRow[];
};

/** Filas de UNA fase, agrupadas por paso; los grupos por paso y las filas por `slot`. */
export function groupEvidenceRows(rows: readonly StepEvidenceRow[]): readonly StepEvidenceRowGroup[] {
  const byStep = new Map<number, StepEvidenceRow[]>();
  for (const row of rows) {
    const group = byStep.get(row.stepPosition);
    if (group === undefined) byStep.set(row.stepPosition, [row]);
    else group.push(row);
  }
  return [...byStep.entries()]
    .sort(([a], [b]) => a - b)
    .map(([stepPosition, group]) => ({
      stepPosition,
      rows: [...group].sort((a, b) => a.slot - b.slot),
    }));
}
