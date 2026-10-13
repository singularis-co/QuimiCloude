import type { EvidencePhase } from '../domain/step-evidence';

export type StepEvidenceRow = {
  readonly id: string;
  readonly orderId: string;
  readonly phase: EvidencePhase;
  readonly stepPosition: number;
  readonly slot: number;
  readonly path: string;
};

/** `contentType` y `sizeBytes` son los leidos del archivo subido, nunca los que declara el cliente. */
export type NewStepEvidence = {
  readonly companyId: string;
  readonly orderId: string;
  readonly phase: EvidencePhase;
  readonly stepPosition: number;
  readonly path: string;
  readonly contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  readonly sizeBytes: number;
  readonly uploadedBy: string;
};

/** Toda operacion filtra por `companyId`: una fila de otra empresa es una fila que no existe. */
export interface StepEvidenceRepository {
  /** Ordenadas por paso y por `slot`. */
  listByOrder(companyId: string, orderId: string, phase: EvidencePhase): Promise<readonly StepEvidenceRow[]>;
  findById(companyId: string, orderId: string, phase: EvidencePhase, id: string): Promise<StepEvidenceRow | null>;
  /** En el primer `slot` libre del paso; `'limit'` si ya no queda ninguno, tambien si otra peticion
   *  ocupo el ultimo a la vez. */
  insert(row: NewStepEvidence): Promise<StepEvidenceRow | 'limit'>;
  /** Borra `replacedId` e inserta la nueva en su mismo `slot`, todo o nada. `'not_found'` si
   *  `replacedId` no es una foto de ese pedido, fase y paso en esa empresa. */
  replace(replacedId: string, row: NewStepEvidence): Promise<StepEvidenceRow | 'not_found'>;
  /** La fila borrada, o `null` si no existia. */
  delete(companyId: string, orderId: string, phase: EvidencePhase, id: string): Promise<StepEvidenceRow | null>;
  /** De esos pedidos, los que tienen al menos una foto en la fase indicada para cada uno. */
  listOrderIdsWithEvidence(
    companyId: string,
    candidates: readonly { readonly orderId: string; readonly phase: EvidencePhase }[],
  ): Promise<readonly string[]>;
}
