import { describe, expect, it } from 'vitest';

import {
  packagedQuantityOf,
  productionCostTotal,
  summarizeFinishedStock,
} from '@/lib/modules/inventario';

import { finishedProductDetail } from '../../fixtures/finished-product-detail';

describe('summarizeFinishedStock', () => {
  it('R11, R12: suma el total exacto, agrupa por contenido ascendente y junta los lotes sin contenido', () => {
    const summary = summarizeFinishedStock([
      { stock: '9.0000', packageContent: '4.0000' },
      { stock: '10.5000', packageContent: '1.0000' },
      { stock: '2.2500', packageContent: null },
      { stock: '0.0000', packageContent: '1.0000' },
    ]);

    expect(summary).toEqual({
      total: '21.7500',
      byPackageContent: [
        { packageContent: '1.0000', packages: 10, remainder: '0.5' },
        { packageContent: '4.0000', packages: 2, remainder: '1' },
      ],
      withoutPackage: '2.2500',
    });
    expect(summary).toEqual(finishedProductDetail().stock);
  });

  it('R12: suma envases y restos de los lotes con el mismo contenido, aunque se escriba distinto', () => {
    const summary = summarizeFinishedStock([
      { stock: '2.7000', packageContent: '0.5' },
      { stock: '1.9000', packageContent: '0.5000' },
    ]);

    expect(summary.byPackageContent).toEqual([
      { packageContent: '0.5000', packages: 8, remainder: '0.6' },
    ]);
    expect(summary.total).toBe('4.6000');
    expect(summary.withoutPackage).toBeNull();
  });

  it('R12: restos exactos, sin coma flotante (0.1 + 0.2 da 0.3)', () => {
    const summary = summarizeFinishedStock([
      { stock: '1.1000', packageContent: '1.0000' },
      { stock: '1.2000', packageContent: '1.0000' },
    ]);

    expect(summary.byPackageContent).toEqual([
      { packageContent: '1.0000', packages: 2, remainder: '0.3' },
    ]);
    expect(summary.total).toBe('2.3000');
  });

  it('R12: un resto que suma cero sale como null', () => {
    const summary = summarizeFinishedStock([{ stock: '8.0000', packageContent: '2.0000' }]);

    expect(summary.byPackageContent).toEqual([{ packageContent: '2.0000', packages: 4, remainder: null }]);
  });

  it('R11, R12: solo lotes agotados dan total cero y ninguna entrada', () => {
    expect(
      summarizeFinishedStock([
        { stock: '0.0000', packageContent: '1.0000' },
        { stock: '0.0000', packageContent: null },
      ]),
    ).toEqual({ total: '0.0000', byPackageContent: [], withoutPackage: null });
    expect(summarizeFinishedStock([])).toEqual({ total: '0.0000', byPackageContent: [], withoutPackage: null });
  });

  it('R12: un lote con contenido 0 cuenta como sin envase', () => {
    const summary = summarizeFinishedStock([{ stock: '3.0000', packageContent: '0.0000' }]);

    expect(summary.byPackageContent).toEqual([]);
    expect(summary.withoutPackage).toBe('3.0000');
  });
});

describe('productionCostTotal', () => {
  it('R21: redondea mitad arriba cuando el quinto decimal es 5', () => {
    expect(productionCostTotal('1.2345', '1.5')).toBe('1.8518');
    expect(productionCostTotal('0.0001', '0.5')).toBe('0.0001');
  });

  it('R21: por debajo de la mitad trunca', () => {
    expect(productionCostTotal('0.0001', '0.4999')).toBe('0.0000');
    expect(productionCostTotal('1.2345', '1.4999')).toBe('1.8516');
  });

  it('R21: multiplica exacto con cantidades de cuatro decimales', () => {
    expect(productionCostTotal('2.5000', '12.0000')).toBe('30.0000');
    expect(productionCostTotal('3.3333', '3.0003')).toBe('10.0009');
    expect(productionCostTotal('12345.6789', '9876.5432')).toBe('121932630.9892');
  });
});

describe('packagedQuantityOf', () => {
  it('sin contenido de envase devuelve null', () => {
    expect(packagedQuantityOf('10.0000', null)).toBeNull();
  });

  it('con contenido 0 devuelve null', () => {
    expect(packagedQuantityOf('10.0000', '0.0000')).toBeNull();
    expect(packagedQuantityOf('10.0000', '0')).toBeNull();
  });

  it('cuenta envases enteros y el resto sin ceros sobrantes', () => {
    expect(packagedQuantityOf('10.5000', '1.0000')).toEqual({ packages: 10, remainder: '0.5' });
    expect(packagedQuantityOf('9.0000', '4.0000')).toEqual({ packages: 2, remainder: '1' });
    expect(packagedQuantityOf('8.0000', '2.0000')).toEqual({ packages: 4, remainder: null });
    expect(packagedQuantityOf('0.7500', '1.0000')).toEqual({ packages: 0, remainder: '0.75' });
  });
});
