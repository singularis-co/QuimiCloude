import { describe, expect, it } from 'vitest';

import {
  convertSupplyBatch,
  pickSupplyTarget,
  PRODUCT_TYPES,
  type SupplyHomonym,
} from '@/lib/modules/inventario';
import type { UnitConversion } from '@/lib/modules/unidades';

// Factores con cuatro decimales, como salen de la columna `decimal(14,4)`.
const L: UnitConversion = { id: 'l', baseUnitId: null, factor: null };
const ML: UnitConversion = { id: 'ml', baseUnitId: 'l', factor: '0.0010' };
const KG: UnitConversion = { id: 'kg', baseUnitId: null, factor: null };
const U: UnitConversion = { id: 'u', baseUnitId: null, factor: null };
const UNITS = [L, ML, KG, U];

function homonym(id: string, unitId: string, stock: string): SupplyHomonym {
  return { id, name: 'Glicerina', type: PRODUCT_TYPES.PRODUCT, unitId, stock };
}

describe('pickSupplyTarget', () => {
  it('R1 solo cuentan homónimos con unidad de la misma familia', () => {
    const enL = homonym('a', 'l', '1');
    const enKg = homonym('b', 'kg', '50');
    const enMl = homonym('c', 'ml', '300');
    const sinUnidadVisible = homonym('d', 'gal', '900');

    const result = pickSupplyTarget('ml', [enL, enKg, enMl, sinUnidadVisible], UNITS);

    expect(result?.family).toEqual([enL, enMl]);
    expect(result?.target).toBe(enL);
    expect(pickSupplyTarget('ml', [enKg, sinUnidadVisible], UNITS)).toBeNull();
  });

  it('R2 una unidad suelta es su propia familia', () => {
    const enU = homonym('a', 'u', '3');
    const enL = homonym('b', 'l', '10');

    expect(pickSupplyTarget('u', [enL, enU], UNITS)).toEqual({ target: enU, family: [enU] });
    expect(pickSupplyTarget('u', [enL], UNITS)).toBeNull();
  });

  it('R5 gana el de más existencia comparada en la base sin truncar', () => {
    // 1.0001 l frente a 1000.15 ml = 1.00015 l: truncado a 4 decimales empatarían en 1.0001.
    const enL = homonym('a', 'l', '1.0001');
    const enMl = homonym('b', 'ml', '1000.15');

    expect(pickSupplyTarget('ml', [enL, enMl], UNITS)?.target).toBe(enMl);
  });

  it('R5 en empate gana el primero (más antiguo)', () => {
    const antiguo = homonym('a', 'ml', '500');
    const nuevo = homonym('b', 'l', '0.5');

    expect(pickSupplyTarget('l', [antiguo, nuevo], UNITS)?.target).toBe(antiguo);
  });
});

describe('convertSupplyBatch', () => {
  it('R4 500 ml pasan a 0.5 l', () => {
    expect(convertSupplyBatch({ stock: '500', unitCost: null }, ML, L)).toEqual({
      kind: 'ok',
      stock: '0.5',
      unitCost: null,
    });
  });

  it('R6 0.004 por ml pasa a 4 por l', () => {
    expect(convertSupplyBatch({ stock: '500', unitCost: '0.004' }, ML, L)).toEqual({
      kind: 'ok',
      stock: '0.5',
      unitCost: '4',
    });
  });

  it('R8 0.25 ml a l no cabe y no se redondea', () => {
    expect(convertSupplyBatch({ stock: '0.25', unitCost: '1' }, ML, L)).toEqual({
      kind: 'stock_out_of_range',
      stock: '0.00025',
    });
  });

  it('R8 más de 10 cifras enteras no cabe', () => {
    expect(convertSupplyBatch({ stock: '9999999999', unitCost: null }, L, ML)).toEqual({
      kind: 'stock_out_of_range',
      stock: '9999999999000',
    });
  });

  it('R9 0.25 por l a ml no cabe', () => {
    expect(convertSupplyBatch({ stock: '2', unitCost: '0.25' }, L, ML)).toEqual({
      kind: 'cost_out_of_range',
      stock: '2000',
      unitCost: '0.00025',
    });
  });

  it('misma unidad devuelve la entrada', () => {
    expect(convertSupplyBatch({ stock: '0.25', unitCost: '0.00001' }, ML, ML)).toEqual({
      kind: 'ok',
      stock: '0.25',
      unitCost: '0.00001',
    });
  });
});
