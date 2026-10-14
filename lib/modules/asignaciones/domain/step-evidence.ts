// lib/modules/asignaciones/domain/step-evidence.ts
/**
 * Las fotos de evidencia de un paso: tope, plazo de lectura, ruta en el bucket y que pasos de la
 * lista actual se quedaron sin ninguna. Puro: sin I/O y sin importar ningun otro modulo, para que
 * la pantalla lo use tal cual desde el barril.
 *
 * Las fotos se atan al NUMERO de paso (1, 2, ...): los pasos no tienen identificador propio.
 */

export const EVIDENCE_PHASES = ['manufacturing', 'packing'] as const;

/** `manufacturing` recorre `steps`; `packing`, `packing_steps`. */
export type EvidencePhase = (typeof EVIDENCE_PHASES)[number];

export const MAX_EVIDENCE_PER_STEP = 3;

export const EVIDENCE_READ_LINK_TTL_SECONDS = 15 * 60;

/** Lo unico que esta logica necesita de un paso de la formula. */
export type EvidenceStep = {
  readonly requiresEvidence?: boolean;
};

export type StepEvidencePhotoView = {
  readonly id: string;
  readonly slot: number;
  readonly url: string;
};

export type StepEvidenceView = {
  readonly stepPosition: number;
  readonly photos: readonly StepEvidencePhotoView[];
};

/**
 * `<empresa>/<pedido>/<uuid>`. El nombre lo pone el servidor: nada de la peticion entra en la
 * ruta, asi que no hay forma de pedir una carpeta ajena.
 */
export function buildEvidencePath(companyId: string, orderId: string): string {
  return `${companyId}/${orderId}/${crypto.randomUUID()}`;
}

/**
 * `true` solo si la ruta tiene exactamente tres segmentos, los dos primeros son esa empresa y ese
 * pedido, y el tercero es un nombre real. Con el largo fijo, un `..` no puede sacar la ruta de la
 * carpeta del pedido; se rechaza igual para que nadie la normalice despues.
 */
export function isEvidencePathOf(path: string, companyId: string, orderId: string): boolean {
  if (companyId.length === 0 || orderId.length === 0) return false;
  const segments = path.split('/');
  if (segments.length !== 3) return false;
  const [company, order, name] = segments as [string, string, string];
  if (company !== companyId || order !== orderId) return false;
  return name.length > 0 && name !== '.' && name !== '..';
}

/** `position` empieza en 1. Una posicion que no existe en la lista no exige nada. */
export function stepRequiresEvidence(steps: readonly EvidenceStep[], position: number): boolean {
  if (!Number.isInteger(position) || position < 1) return false;
  return steps[position - 1]?.requiresEvidence === true;
}

/**
 * Las posiciones que exigen evidencia en la lista ACTUAL y no tienen ninguna foto, en orden
 * ascendente. Una foto de una posicion que ya no exige evidencia, o que ya no existe, no cubre a
 * ninguna otra.
 */
export function missingEvidencePositions(
  steps: readonly EvidenceStep[],
  rows: readonly { readonly stepPosition: number }[],
): readonly number[] {
  const covered = new Set(rows.map((row) => row.stepPosition));
  const missing: number[] = [];
  steps.forEach((step, index) => {
    const position = index + 1;
    if (step.requiresEvidence === true && !covered.has(position)) missing.push(position);
  });
  return missing;
}
