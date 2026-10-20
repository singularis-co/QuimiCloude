// Las fotos de un pedido terminado tal como las devuelven las actions de consulta: fabricacion en
// los pasos 1 (2 fotos), 2 (3) y 4 (1), sin el 3; envasado en el paso 1 (2). Mas una variante con
// la firma caida en un grupo de cada fase.
import { errorMessage, type ErrorState } from '@/lib/modules/errores';
import type {
  OrderEvidence,
  OrderEvidenceCount,
  OrderEvidenceGroup,
  StepEvidencePhotoView,
} from '@/lib/modules/asignaciones';

import { FINISHED_ORDER_ID } from './finished-product-detail';

export const EVIDENCE_ORDER_ID = FINISHED_ORDER_ID;

const READ_ORIGIN = 'https://evidencias.test/read';

function photoId(phase: 'm' | 'p', step: number, slot: number): string {
  return `e${phase === 'm' ? '1' : '2'}000000-0000-4000-8000-0000000${String(step).padStart(2, '0')}${String(slot).padStart(3, '0')}`;
}

function photos(phase: 'm' | 'p', step: number, count: number): readonly StepEvidencePhotoView[] {
  return Array.from({ length: count }, (_, index) => {
    const slot = index + 1;
    const id = photoId(phase, step, slot);
    return { id, slot, url: `${READ_ORIGIN}/${id}?expiresIn=900` };
  });
}

export function orderEvidenceGroup(phase: 'm' | 'p', stepPosition: number, count: number): OrderEvidenceGroup {
  return { stepPosition, photoCount: count, photos: photos(phase, stepPosition, count) };
}

/** Fabricacion: pasos 1, 2 y 4. Envasado: paso 1. Nueve fotos en total. */
export const ORDER_EVIDENCE: OrderEvidence = {
  manufacturing: [orderEvidenceGroup('m', 1, 2), orderEvidenceGroup('m', 2, 3), orderEvidenceGroup('m', 4, 1)],
  packing: [orderEvidenceGroup('p', 1, 2)],
};

export const ORDER_EVIDENCE_PHOTO_TOTAL = 9;

/** La misma evidencia con la firma caida: cada grupo conserva su `photoCount` y no trae fotos. */
export const ORDER_EVIDENCE_UNSIGNED: OrderEvidence = {
  manufacturing: ORDER_EVIDENCE.manufacturing.map((group) => ({ ...group, photos: null })),
  packing: ORDER_EVIDENCE.packing.map((group) => ({ ...group, photos: null })),
};

/** Solo fabricacion: el grupo de envasado no se pinta. */
export const ORDER_EVIDENCE_MANUFACTURING_ONLY: OrderEvidence = {
  manufacturing: ORDER_EVIDENCE.manufacturing,
  packing: [],
};

export const ORDER_EVIDENCE_EMPTY: OrderEvidence = { manufacturing: [], packing: [] };

export const ORDER_EVIDENCE_COUNTS: readonly OrderEvidenceCount[] = [
  { orderId: EVIDENCE_ORDER_ID, photoCount: ORDER_EVIDENCE_PHOTO_TOTAL },
];

const errorState = <C extends Exclude<ErrorState['code'], 'unexpected'>>(code: C) =>
  ({ status: 'error', code, message: errorMessage(code) }) as const;

export const ORDER_EVIDENCE_ERROR_STATES = {
  orderNotFound: errorState('order_not_found'),
  unauthorized: errorState('unauthorized'),
  invalidInput: errorState('invalid_input'),
} as const satisfies Record<string, ErrorState>;
