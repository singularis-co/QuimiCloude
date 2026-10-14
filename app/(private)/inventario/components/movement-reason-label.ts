import type { MovementReason } from '@/lib/modules/inventario';

/**
 * Deriva la etiqueta legible de un motivo a partir del propio valor, sin enumerarlo a mano:
 * guion bajo a espacio y primera letra en mayuscula. Sin `'use client'` para que un Server
 * Component pueda llamarla.
 */
export function movementReasonLabel(reason: MovementReason): string {
  const conEspacios = reason.split('_').join(' ');
  return conEspacios.charAt(0).toUpperCase() + conEspacios.slice(1);
}
