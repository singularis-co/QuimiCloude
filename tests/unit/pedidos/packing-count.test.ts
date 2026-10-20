import { describe, expect, it } from 'vitest';

import {
  PACKING_DIFFERENCE_REASONS,
  PACKING_INCREASE_REASONS,
  PACKING_REASON_OTHER_MAX,
  checkPackingCounts,
  effectivePackages,
  maxPackagesForLine,
  packedTotalInOrderUnit,
  type PackedDistributionLine,
  type PackedLineCount,
  type PackingPlanLine,
} from '@/lib/modules/pedidos';

import type { UnitConversion } from '@/lib/modules/unidades';

const LITRO: UnitConversion = { id: 'litro', baseUnitId: null, factor: null };
const MILILITRO: UnitConversion = { id: 'mililitro', baseUnitId: 'litro', factor: '0.001' };
const KILO: UnitConversion = { id: 'kilo', baseUnitId: null, factor: null };

const LINES: readonly PackingPlanLine[] = [
  { id: 'linea-a', packages: 10 },
  { id: 'linea-b', packages: 4 },
];

function count(lineId: string, packedPackages: number, overrides: Partial<PackedLineCount> = {}): PackedLineCount {
  return { lineId, packedPackages, reason: null, reasonOther: null, ...overrides };
}

function asPlanned(): PackedLineCount[] {
  return [count('linea-a', 10), count('linea-b', 4)];
}

function errorOf(counts: readonly PackedLineCount[], lineId: string) {
  const result = checkPackingCounts(LINES, counts);
  return result.kind === 'invalid' ? (result.lineErrors.get(lineId) ?? null) : null;
}

describe('checkPackingCounts: conjunto de lineas', () => {
  it('R13: todas las lineas igual al plan, sin motivo, se aceptan', () => {
    expect(checkPackingCounts(LINES, asPlanned())).toEqual({ kind: 'ok' });
  });

  it('R13: falta una linea del pedido, se rechaza y la nombra', () => {
    const result = checkPackingCounts(LINES, [count('linea-a', 10)]);
    expect(result).toMatchObject({ kind: 'invalid', missingLineIds: ['linea-b'], unexpectedLineIds: [] });
  });

  it('R13: sobra una linea que no es del pedido, se rechaza', () => {
    const result = checkPackingCounts(LINES, [...asPlanned(), count('linea-ajena', 1)]);
    expect(result).toMatchObject({ kind: 'invalid', missingLineIds: [], unexpectedLineIds: ['linea-ajena'] });
  });

  it('R13: una linea repetida se rechaza aunque el conjunto este completo', () => {
    const result = checkPackingCounts(LINES, [...asPlanned(), count('linea-a', 10)]);
    expect(result).toMatchObject({ kind: 'invalid', unexpectedLineIds: ['linea-a'] });
  });

  it('R13: lista vacia contra un pedido con lineas, se rechaza', () => {
    expect(checkPackingCounts(LINES, [])).toMatchObject({ kind: 'invalid', missingLineIds: ['linea-a', 'linea-b'] });
  });
});

describe('checkPackingCounts: entero >= 0', () => {
  it('R2, R13: 0 envases se acepta con motivo', () => {
    const counts = [count('linea-a', 0, { reason: 'rotura' }), count('linea-b', 4)];
    expect(checkPackingCounts(LINES, counts)).toEqual({ kind: 'ok' });
  });

  it.each([[-1], [1.5], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    'R2, R13: %s no es un entero >= 0 y se rechaza',
    (value) => {
      expect(errorOf([count('linea-a', value, { reason: 'merma' }), count('linea-b', 4)], 'linea-a')).toBe(
        'invalid_count',
      );
    },
  );

  it('R2: marca cada linea con error, no solo la primera', () => {
    const result = checkPackingCounts(LINES, [count('linea-a', -1), count('linea-b', 2)]);
    expect(result.kind === 'invalid' ? [...result.lineErrors.entries()] : []).toEqual([
      ['linea-a', 'invalid_count'],
      ['linea-b', 'missing_reason'],
    ]);
  });
});

describe('checkPackingCounts: motivo segun diferencia y sentido', () => {
  it('R3, R6, R13: menos envases que el plan sin motivo, se rechaza', () => {
    expect(errorOf([count('linea-a', 9), count('linea-b', 4)], 'linea-a')).toBe('missing_reason');
  });

  it('R3, R6, R13: mas envases que el plan sin motivo, se rechaza', () => {
    expect(errorOf([count('linea-a', 11), count('linea-b', 4)], 'linea-a')).toBe('missing_reason');
  });

  it('R3, R13: igual al plan con motivo, se rechaza', () => {
    expect(errorOf([count('linea-a', 10, { reason: 'merma' }), count('linea-b', 4)], 'linea-a')).toBe(
      'unexpected_reason',
    );
  });

  it.each(PACKING_DIFFERENCE_REASONS.filter((reason) => reason !== 'otro'))(
    'R3, R13: con menos envases vale %s',
    (reason) => {
      expect(checkPackingCounts(LINES, [count('linea-a', 9, { reason }), count('linea-b', 4)])).toEqual({ kind: 'ok' });
    },
  );

  it.each(['merma', 'rotura'] as const)('R3, R4, R13: con mas envases %s no vale', (reason) => {
    expect(errorOf([count('linea-a', 11, { reason }), count('linea-b', 4)], 'linea-a')).toBe('reason_not_allowed');
  });

  it.each(['conteo_fisico', 'error_de_carga'] as const)('R3, R13: con mas envases vale %s', (reason) => {
    expect(checkPackingCounts(LINES, [count('linea-a', 11, { reason }), count('linea-b', 4)])).toEqual({ kind: 'ok' });
  });

  it('R3: las listas de motivos por sentido son las del tablero', () => {
    expect(PACKING_DIFFERENCE_REASONS).toEqual(['merma', 'rotura', 'conteo_fisico', 'error_de_carga', 'otro']);
    expect(PACKING_INCREASE_REASONS).toEqual(['conteo_fisico', 'error_de_carga', 'otro']);
  });

  it('R13: un motivo distinto de «Otro» con texto, se rechaza', () => {
    expect(
      errorOf([count('linea-a', 9, { reason: 'merma', reasonOther: 'algo' }), count('linea-b', 4)], 'linea-a'),
    ).toBe('unexpected_reason_other');
  });

  it('R13: igual al plan con texto de «Otro» y sin motivo, se rechaza', () => {
    expect(errorOf([count('linea-a', 10, { reasonOther: 'algo' }), count('linea-b', 4)], 'linea-a')).toBe(
      'unexpected_reason_other',
    );
  });
});

describe('checkPackingCounts: texto de «Otro»', () => {
  function withOther(reasonOther: string | null, packed = 9) {
    return [count('linea-a', packed, { reason: 'otro', reasonOther }), count('linea-b', 4)];
  }

  it('R5, R13: «Otro» con texto se acepta, en los dos sentidos', () => {
    expect(checkPackingCounts(LINES, withOther('se cayo una caja'))).toEqual({ kind: 'ok' });
    expect(checkPackingCounts(LINES, withOther('sobraron', 11))).toEqual({ kind: 'ok' });
  });

  it.each([[null], [''], ['   ']])('R6, R13: «Otro» con texto %j se rechaza', (text) => {
    expect(errorOf(withOther(text), 'linea-a')).toBe('missing_reason_other');
  });

  it('R13: 200 caracteres tras recortar se aceptan', () => {
    expect(PACKING_REASON_OTHER_MAX).toBe(200);
    expect(checkPackingCounts(LINES, withOther(`  ${'x'.repeat(200)}  `))).toEqual({ kind: 'ok' });
  });

  it('R13: 201 caracteres se rechazan', () => {
    expect(errorOf(withOther('x'.repeat(201)), 'linea-a')).toBe('reason_other_too_long');
  });
});

function packed(overrides: Partial<PackedDistributionLine> & { lineId: string }): PackedDistributionLine {
  return { presentationId: `p-${overrides.lineId}`, packedPackages: 1, content: '1', unit: LITRO, ...overrides };
}

describe('packedTotalInOrderUnit', () => {
  it('R7, R15: suma reales x contenido en la unidad del pedido con unidades mezcladas', () => {
    const result = packedTotalInOrderUnit(LITRO, [
      packed({ lineId: 'a', packedPackages: 3, content: '5', unit: LITRO }),
      packed({ lineId: 'b', packedPackages: 4, content: '250', unit: MILILITRO }),
    ]);
    expect(result).toEqual({ kind: 'ok', total: '16' });
  });

  it('R7, R19: una linea en 0 no aporta', () => {
    const result = packedTotalInOrderUnit(LITRO, [
      packed({ lineId: 'a', packedPackages: 0, content: '5' }),
      packed({ lineId: 'b', packedPackages: 2, content: '1.5' }),
    ]);
    expect(result).toEqual({ kind: 'ok', total: '3' });
  });

  it('R15: una unidad inconvertible se informa, no se suma', () => {
    const result = packedTotalInOrderUnit(LITRO, [packed({ lineId: 'a', unit: KILO, presentationId: 'p-kilo' })]);
    expect(result).toEqual({ kind: 'incompatible_units', presentationId: 'p-kilo' });
  });
});

describe('maxPackagesForLine', () => {
  it('R8, R15: mayor entero que no supera la cantidad con las demas lineas fijas', () => {
    const lines = [
      packed({ lineId: 'a', packedPackages: 3, content: '5', unit: LITRO }),
      packed({ lineId: 'b', packedPackages: 40, content: '250', unit: MILILITRO }),
    ];
    expect(maxPackagesForLine('20', LITRO, lines, 'b')).toBe(20);
    expect(maxPackagesForLine('20', LITRO, lines, 'a')).toBe(2);
  });

  it('R8, R15: con cantidad exacta el maximo llena justo la cantidad', () => {
    const lines = [packed({ lineId: 'a', packedPackages: 1, content: '2.5' })];
    expect(maxPackagesForLine('10', LITRO, lines, 'a')).toBe(4);
    expect(maxPackagesForLine('9.99', LITRO, lines, 'a')).toBe(3);
  });

  it('R8: si ni con 0 cabe, no hay maximo', () => {
    const lines = [packed({ lineId: 'a', content: '1' }), packed({ lineId: 'b', packedPackages: 30, content: '1' })];
    expect(maxPackagesForLine('20', LITRO, lines, 'a')).toBeNull();
  });

  it('R8: una linea que no esta en la lista no tiene maximo', () => {
    expect(maxPackagesForLine('20', LITRO, [packed({ lineId: 'a' })], 'z')).toBeNull();
  });
});

describe('effectivePackages', () => {
  it('R25: sin conteo guardado, cuenta el plan', () => {
    expect(effectivePackages({ packages: 6, packedPackages: null })).toBe(6);
  });

  it('R23, R24: con conteo guardado, cuenta el real, tambien 0', () => {
    expect(effectivePackages({ packages: 6, packedPackages: 4 })).toBe(4);
    expect(effectivePackages({ packages: 6, packedPackages: 0 })).toBe(0);
  });
});
