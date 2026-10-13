import { describe, expect, it } from 'vitest';

import { orderDistributionLineText } from '@/components/shared/order-distribution-label';
import { EMPTY_MARK } from '@/lib/shared/ui/empty-mark';

describe('orderDistributionLineText', () => {
  it('R13 — pinta los bultos con el nombre del envase', () => {
    expect(
      orderDistributionLineText({ packages: 3, packagingName: 'Caja', presentationName: '1 L' }),
    ).toBe('3 × Caja');
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
