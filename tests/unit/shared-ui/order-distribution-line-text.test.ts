import { describe, expect, it } from 'vitest';

import { orderDistributionLineText } from '@/components/shared/order-distribution-label';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

describe('orderDistributionLineText', () => {
  it('R13 — pinta los bultos con el nombre del envase', () => {
    expect(
      orderDistributionLineText({ packages: 3, packagingName: 'Caja', presentationName: '1 L' }),
    ).toBe('3 × Caja');
  });

  it('con envase y volumen, pinta envase · contenido sin ceros de relleno y unidad', () => {
    expect(
      orderDistributionLineText({
        packages: 9,
        packagingName: 'Embase pequeño 2',
        presentationName: 'Botella chica',
        presentationContent: '300.0000',
        presentationUnitLabel: 'ml',
      }),
    ).toBe('9 × Embase pequeño 2 · 300 ml');
    expect(
      orderDistributionLineText({
        packages: 2,
        packagingName: 'Garrafa',
        presentationName: null,
        presentationContent: '1.5000',
        presentationUnitLabel: 'l',
      }),
    ).toBe('2 × Garrafa · 1.5 l');
  });

  it('con envase y sin contenido o sin unidad, pinta solo el envase', () => {
    expect(
      orderDistributionLineText({
        packages: 3,
        packagingName: 'Caja',
        presentationName: '1 L',
        presentationContent: null,
        presentationUnitLabel: 'l',
      }),
    ).toBe('3 × Caja');
    expect(
      orderDistributionLineText({
        packages: 3,
        packagingName: 'Caja',
        presentationName: '1 L',
        presentationContent: '1.0000',
        presentationUnitLabel: null,
      }),
    ).toBe('3 × Caja');
  });

  it('sin envase, el volumen no se pinta: queda el nombre de la presentación', () => {
    expect(
      orderDistributionLineText({
        packages: 2,
        packagingName: null,
        presentationName: '1 L',
        presentationContent: '1.0000',
        presentationUnitLabel: 'l',
      }),
    ).toBe('2 × 1 L');
  });

  it('R13 — sin envase, recurre al nombre de la presentación', () => {
    expect(
      orderDistributionLineText({ packages: 2, packagingName: null, presentationName: '1 L' }),
    ).toBe('2 × 1 L');
    expect(orderDistributionLineText({ packages: 4, presentationName: '5 L' })).toBe('4 × 5 L');
  });

  it('R13 — sin envase ni presentación, pinta la marca de ausente', () => {
    expect(
      orderDistributionLineText({ packages: 1, packagingName: null, presentationName: null }),
    ).toBe(`1 × ${EMPTY_MARK}`);
    expect(EMPTY_MARK).toBe('—');
  });
});
