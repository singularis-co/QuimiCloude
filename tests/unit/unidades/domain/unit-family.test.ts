import { describe, expect, it } from 'vitest';

import { unitFamilyId } from '@/lib/modules/unidades';

describe('unitFamilyId', () => {
  it('R1 una unidad base es su propia familia', () => {
    expect(unitFamilyId({ id: 'l', baseUnitId: null })).toBe('l');
  });

  it('R1 una derivada pertenece a la familia de su base', () => {
    expect(unitFamilyId({ id: 'ml', baseUnitId: 'l' })).toBe('l');
  });

  it('R2 una unidad suelta, sin base ni derivadas, es su propia familia', () => {
    expect(unitFamilyId({ id: 'u', baseUnitId: null })).toBe('u');
    expect(unitFamilyId({ id: 'u', baseUnitId: null })).not.toBe(
      unitFamilyId({ id: 'ml', baseUnitId: 'l' }),
    );
  });
});
