import type { MovementReason } from '@/lib/modules/inventario';

// La derivación no sabe de tildes: lo que la lleva se escribe aquí.
const ACCENTED_LABELS: Partial<Record<MovementReason, string>> = {
  conteo_fisico: 'Conteo físico',
};

/**
 * Deriva la etiqueta legible de un motivo a partir del propio valor, sin enumerarlo a mano:
 * guion bajo a espacio y primera letra en mayuscula. Sin `'use client'` para que un Server
 * Component pueda llamarla.
 */
export function movementReasonLabel(reason: MovementReason): string {
  const accented = ACCENTED_LABELS[reason];
  if (accented !== undefined) return accented;
  const conEspacios = reason.split('_').join(' ');
  return conEspacios.charAt(0).toUpperCase() + conEspacios.slice(1);
}
