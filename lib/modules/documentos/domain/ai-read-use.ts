import type { PdfStrategy } from './pdf-strategy';
import type { AiReadUse } from '@/lib/modules/integraciones';

/** Cada estrategia lee con el modelo de su uso; un `Record` no compila si una estrategia queda sin uso. */
export const USE_BY_STRATEGY: Record<PdfStrategy, AiReadUse> = {
  formula: 'recipe',
  catalogo: 'catalog',
};
