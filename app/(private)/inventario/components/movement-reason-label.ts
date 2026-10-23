import type { MovementReason } from '@/lib/modules/inventario';

// Exhaustivo a propósito: un motivo nuevo en el dominio no compila hasta tener su texto.
const MOVEMENT_REASON_LABELS: Readonly<Record<MovementReason, string>> = {
  merma: 'Merma',
  rotura: 'Rotura',
  conteo_fisico: 'Conteo físico',
  error_de_carga: 'Error de carga',
};

/** Etiqueta legible de un motivo de ajuste. Sin `'use client'` para que un Server Component pueda llamarla. */
export function movementReasonLabel(reason: MovementReason): string {
  return MOVEMENT_REASON_LABELS[reason];
}
