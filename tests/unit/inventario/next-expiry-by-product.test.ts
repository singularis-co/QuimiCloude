import { describe, expect, it } from 'vitest';

import { toNextExpiryByProduct } from '@/lib/modules/inventario/adapters/driven/persistence/product-prisma';

describe('toNextExpiryByProduct — del agregado `_min.expiryDate` a fecha de calendario', () => {
  it('serializa como YYYY-MM-DD, sin hora ni desplazamiento de zona', () => {
    const mapa = toNextExpiryByProduct([
      { productId: 'p1', _min: { expiryDate: new Date('2026-12-01T00:00:00.000Z') } },
    ]);

    expect(mapa.get('p1')).toBe('2026-12-01');
  });

  it('un producto cuyo minimo es null no entra en el mapa', () => {
    const mapa = toNextExpiryByProduct([
      { productId: 'p1', _min: { expiryDate: null } },
      { productId: 'p2', _min: { expiryDate: new Date('2027-03-10T00:00:00.000Z') } },
    ]);

    expect(mapa.has('p1')).toBe(false);
    expect([...mapa]).toEqual([['p2', '2027-03-10']]);
  });
});
