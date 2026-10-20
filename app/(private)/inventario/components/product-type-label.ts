import type { ProductType } from '@/lib/modules/inventario';
import type { StatusTone } from '@/lib/shared/ui/status-tone';

/**
 * Etiqueta y tono del chip de cada tipo de producto. Las comparten las pestanas de tipo y la
 * columna «Tipo» de la tabla (que solo sale en «Todos»), para que el mismo tipo se lea igual en
 * los dos sitios. Sin `'use client'` para que un Server Component pueda importarlas.
 */
export const PRODUCT_TYPE_LABELS: Readonly<Record<ProductType, string>> = {
  PRODUCT: 'Producto',
  MACHINE: 'Máquina',
  PACKAGING: 'Envase',
  FINISHED_PRODUCT: 'Producto terminado',
};

/**
 * Un tono DISTINTO por tipo, para distinguirlos de un vistazo en la columna. No se usa `danger`:
 * se lee como error, y ningun tipo lo es. Tampoco `progress`, cuyo punto late.
 */
export const PRODUCT_TYPE_TONES: Readonly<Record<ProductType, StatusTone>> = {
  PRODUCT: 'info',
  MACHINE: 'neutral',
  PACKAGING: 'waiting',
  FINISHED_PRODUCT: 'success',
};
