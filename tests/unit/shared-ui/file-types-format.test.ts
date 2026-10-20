// Formateo de tamanos para los mensajes de limite y el pie de la miniatura. Las unidades son
// decimales (1 MB = 1 000 000 B), como los limites que fijan los modulos.

import { describe, expect, it } from 'vitest';

import { formatFileSize, formatMegabytes } from '@/components/shared/file-types';
import { MAX_PRODUCT_IMAGE_BYTES } from '@/lib/modules/inventario';
import { MAX_IMAGE_BYTES } from '@/lib/modules/recetas';

describe('formatMegabytes', () => {
  it('el limite de imagen de producto y de receta (4 400 000 B) se lee «4.4»', () => {
    expect(formatMegabytes(MAX_PRODUCT_IMAGE_BYTES)).toBe('4.4');
    expect(formatMegabytes(MAX_IMAGE_BYTES)).toBe('4.4');
  });

  it('un numero entero de MB sale sin decimales', () => {
    expect(formatMegabytes(1_000_000)).toBe('1');
    expect(formatMegabytes(20_000_000)).toBe('20');
  });

  it('el resto sale con un decimal, y sin «.0» si redondea a entero', () => {
    expect(formatMegabytes(2_140_000)).toBe('2.1');
    expect(formatMegabytes(20 * 1024 * 1024)).toBe('21');
  });
});

describe('formatFileSize', () => {
  it('bytes, KB y MB con los mismos cortes decimales', () => {
    expect(formatFileSize(999)).toBe('999 B');
    expect(formatFileSize(480_000)).toBe('480 KB');
    expect(formatFileSize(4_400_000)).toBe('4.4 MB');
  });

  it('un archivo por encima del limite nunca se describe por debajo de el', () => {
    expect(formatFileSize(MAX_PRODUCT_IMAGE_BYTES + 1)).toBe('4.4 MB');
  });
});
