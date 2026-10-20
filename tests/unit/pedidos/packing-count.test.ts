import { describe, expect, it } from 'vitest';

import {
  PACKING_DIFFERENCE_REASONS,
  PACKING_INCREASE_REASONS,
  PACKING_REASON_OTHER_MAX,
  checkPackingCounts,
  effectivePackages,
  maxPackagesForLine,
  orderedPackages,
  packedTotalInOrderUnit,
  packingSurplusByLine,
  type PackedDistributionLine,
  type PackedLineCount,
  type PackingPlanLine,
  type PackingSurplus,
  type SurplusLine,
} from '@/lib/modules/pedidos';
import { compareDecimals } from '@/lib/modules/pedidos/domain/order-distribution';

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

describe('compareDecimals', () => {
  it('R7: compara decimales en texto sin importar la escala', () => {
    expect(compareDecimals('10', '10.0000')).toBe(0);
    expect(compareDecimals('2.5', '10')).toBe(-1);
    expect(compareDecimals('0.25', '0.125')).toBe(1);
    expect(compareDecimals('-1', '0.5')).toBe(-1);
  });
});

function surplusLine(overrides: Partial<SurplusLine> & { lineId: string; plan: number }): SurplusLine {
  return { ...packed(overrides), plan: overrides.plan };
}

/** Plan del ejemplo de requirements: 5 x 1 L + 1 x 5 L para un pedido de 10 L. */
function litroYGalon(realLitro: number, realGalon: number): SurplusLine[] {
  return [
    surplusLine({ lineId: 'litro', plan: 5, packedPackages: realLitro, content: '1' }),
    surplusLine({ lineId: 'galon', plan: 1, packedPackages: realGalon, content: '5' }),
  ];
}

function libres(result: PackingSurplus): Record<string, number> {
  if (result.kind !== 'ok') throw new Error(`se esperaba ok y llego ${result.kind}`);
  return Object.fromEntries(result.byLine);
}

describe('packingSurplusByLine', () => {
  it('R5: sin superar la cantidad no hay libres aunque una linea pase su plan (9 x 1 L + 0 x 5 L)', () => {
    const result = packingSurplusByLine('10', LITRO, litroYGalon(9, 0));
    expect(result).toMatchObject({ kind: 'ok', excess: '0' });
    expect(libres(result)).toEqual({ litro: 0, galon: 0 });
  });

  it('R5: envasado exacto a la cantidad, sin libres', () => {
    const result = packingSurplusByLine('10', LITRO, litroYGalon(5, 1));
    expect(result).toMatchObject({ kind: 'ok', excess: '0' });
    expect(libres(result)).toEqual({ litro: 0, galon: 0 });
  });

  it('R6: 7 x 1 L + 1 x 5 L deja 2 libres de 1 L', () => {
    const result = packingSurplusByLine('10', LITRO, litroYGalon(7, 1));
    expect(result).toMatchObject({ kind: 'ok', excess: '2' });
    expect(libres(result)).toEqual({ litro: 2, galon: 0 });
  });

  it('R6: 12 x 1 L + 0 x 5 L deja 2 libres de 1 L; la linea por debajo del plan no deja libres', () => {
    const result = packingSurplusByLine('10', LITRO, litroYGalon(12, 0));
    expect(result).toMatchObject({ kind: 'ok', excess: '2' });
    expect(libres(result)).toEqual({ litro: 2, galon: 0 });
  });

  it('R6: una linea nunca deja mas libres que reales menos plan, aunque el excedente de para mas', () => {
    const result = packingSurplusByLine('4', LITRO, [surplusLine({ lineId: 'a', plan: 5, packedPackages: 6, content: '1' })]);
    expect(result).toMatchObject({ kind: 'ok', excess: '2' });
    expect(libres(result)).toEqual({ a: 1 });
  });

  it('R7, P3: excedente de 5 L con 1 L +4 y 5 L +1 deja 1 libre de 5 L y 0 de 1 L', () => {
    const result = packingSurplusByLine('10', LITRO, [
      surplusLine({ lineId: 'litro', plan: 1, packedPackages: 5, content: '1' }),
      surplusLine({ lineId: 'galon', plan: 1, packedPackages: 2, content: '5' }),
    ]);
    expect(result).toMatchObject({ kind: 'ok', excess: '5' });
    expect(libres(result)).toEqual({ litro: 0, galon: 1 });
  });

  it('R6, R7: con unidades mezcladas convierte el contenido y no pasa del excedente', () => {
    const result = packingSurplusByLine('12', LITRO, [
      surplusLine({ lineId: 'cuarto', plan: 4, packedPackages: 10, content: '250', unit: MILILITRO }),
      surplusLine({ lineId: 'litro', plan: 9, packedPackages: 12, content: '1' }),
    ]);
    expect(result).toMatchObject({ kind: 'ok', excess: '2.5' });
    expect(libres(result)).toEqual({ cuarto: 2, litro: 2 });
  });

  it('R7: lo que no llega a un envase entero sigue en el pedido', () => {
    const result = packingSurplusByLine('10.5', LITRO, [surplusLine({ lineId: 'a', plan: 10, packedPackages: 11, content: '1' })]);
    expect(result).toMatchObject({ kind: 'ok', excess: '0.5' });
    expect(libres(result)).toEqual({ a: 0 });
  });

  it('R7: a igual contenido manda el orden del reparto', () => {
    const mililitros = surplusLine({ lineId: 'ml', plan: 1, packedPackages: 4, content: '1000', unit: MILILITRO });
    const litros = surplusLine({ lineId: 'l', plan: 1, packedPackages: 4, content: '1' });
    expect(libres(packingSurplusByLine('4', LITRO, [mililitros, litros]))).toEqual({ ml: 3, l: 1 });
    expect(libres(packingSurplusByLine('4', LITRO, [litros, mililitros]))).toEqual({ l: 3, ml: 1 });
  });

  it('R3: una linea sin contenido se informa, haya o no excedente', () => {
    const sinContenido = surplusLine({ lineId: 'b', plan: 1, packedPackages: 1, content: null, presentationId: 'p-sin' });
    const conExcedente = [surplusLine({ lineId: 'a', plan: 1, packedPackages: 30, content: '1' }), sinContenido];
    expect(packingSurplusByLine('10', LITRO, conExcedente)).toEqual({
      kind: 'presentation_without_content',
      presentationId: 'p-sin',
    });
    expect(packingSurplusByLine('10', LITRO, [sinContenido])).toEqual({
      kind: 'presentation_without_content',
      presentationId: 'p-sin',
    });
  });

  it('R3: una unidad inconvertible se informa, haya o no excedente', () => {
    const kilo = surplusLine({ lineId: 'k', plan: 1, packedPackages: 3, content: '1', unit: KILO, presentationId: 'p-kilo' });
    expect(packingSurplusByLine('1', LITRO, [kilo])).toEqual({ kind: 'incompatible_units', presentationId: 'p-kilo' });
    expect(packingSurplusByLine('100', LITRO, [kilo])).toEqual({ kind: 'incompatible_units', presentationId: 'p-kilo' });
  });

  it('R22: el resultado solo depende de los datos, para que dialogo y servidor coincidan', () => {
    expect(packingSurplusByLine('10', LITRO, litroYGalon(12, 0))).toEqual(packingSurplusByLine('10', LITRO, litroYGalon(12, 0)));
  });
});

describe('orderedPackages', () => {
  it('R12: el pedido espera los reales menos los libres', () => {
    expect(orderedPackages({ packages: 5, packedPackages: 12, packedSurplusPackages: 2 })).toBe(10);
  });

  it('R11, R12: sin conteo guardado ni libres, espera el plan', () => {
    expect(orderedPackages({ packages: 6, packedPackages: null, packedSurplusPackages: 0 })).toBe(6);
  });

  it('R11: con conteo y sin libres, espera los reales, tambien 0', () => {
    expect(orderedPackages({ packages: 1, packedPackages: 0, packedSurplusPackages: 0 })).toBe(0);
    expect(orderedPackages({ packages: 6, packedPackages: 4, packedSurplusPackages: 0 })).toBe(4);
  });
});
