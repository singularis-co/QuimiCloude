import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { toAverageUnitCostByProduct } from '@/lib/modules/inventario/adapters/driven/persistence/product-prisma';
import { weightedAverageUnitCost } from '@/lib/modules/inventario/domain/unit-cost';

/**
 * Columna «Costo» del listado de inventario: el producto muestra el costo unitario medio
 * ponderado por la existencia de sus lotes con existencia > 0 y costo.
 */
describe('weightedAverageUnitCost', () => {
  it('pondera cada costo por la existencia de su lote', () => {
    // (10 x 2 + 20 x 3) / 5 = 16
    expect(
      weightedAverageUnitCost([
        { stock: '2.0000', unitCost: '10.0000' },
        { stock: '3.0000', unitCost: '20.0000' },
      ]),
    ).toBe('16.0000');
  });

  it('un solo lote devuelve su propio costo', () => {
    expect(weightedAverageUnitCost([{ stock: '7.5000', unitCost: '3.1234' }])).toBe('3.1234');
  });

  it('pondera existencias decimales y redondea a cuatro decimales mitad arriba', () => {
    // (1 x 0.5 + 2 x 1.25) / 1.75 = 3 / 1.75 = 1.714285... -> 1.7143
    expect(
      weightedAverageUnitCost([
        { stock: '0.5000', unitCost: '1.0000' },
        { stock: '1.2500', unitCost: '2.0000' },
      ]),
    ).toBe('1.7143');
  });

  it('ignora los lotes sin costo: ni pesan ni cuentan como costo cero', () => {
    expect(
      weightedAverageUnitCost([
        { stock: '4.0000', unitCost: null },
        { stock: '2.0000', unitCost: '10.0000' },
        { stock: '2.0000', unitCost: '20.0000' },
      ]),
    ).toBe('15.0000');
  });

  it('ignora los lotes con existencia cero', () => {
    expect(
      weightedAverageUnitCost([
        { stock: '0.0000', unitCost: '1000.0000' },
        { stock: '1.0000', unitCost: '5.0000' },
      ]),
    ).toBe('5.0000');
  });

  it('devuelve null si ningun lote tiene existencia y costo a la vez', () => {
    expect(
      weightedAverageUnitCost([
        { stock: '0.0000', unitCost: '10.0000' },
        { stock: '3.0000', unitCost: null },
      ]),
    ).toBeNull();
    expect(weightedAverageUnitCost([])).toBeNull();
  });

  it('lanza ante una cadena que no es decimal(14,4) en vez de saltarse el lote', () => {
    expect(() => weightedAverageUnitCost([{ stock: 'abc', unitCost: '1.0000' }])).toThrow();
  });
});

describe('toAverageUnitCostByProduct — de los lotes leidos al costo medio por producto', () => {
  it('agrupa por producto y deja fuera al que no tiene lotes que ponderar', () => {
    const mapa = toAverageUnitCostByProduct([
      { productId: 'p1', stock: new Prisma.Decimal('2'), unitCost: new Prisma.Decimal('10') },
      { productId: 'p1', stock: new Prisma.Decimal('3'), unitCost: new Prisma.Decimal('20') },
      { productId: 'p2', stock: new Prisma.Decimal('1'), unitCost: null },
    ]);

    expect(mapa.get('p1')).toBe('16.0000');
    expect(mapa.has('p2')).toBe(false);
  });
});
