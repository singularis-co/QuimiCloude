// QC-219 T6 — `missingBatchDataLines`: cuantas lineas del reparto no tienen sus datos de lote.
import { describe, expect, it } from 'vitest';

import { batchDataForm, missingBatchDataLines } from '@/lib/modules/asignaciones/domain/conditioning-batch-data';

import { loteDeLinea, uuid } from './conditioning-doubles';

function linea(presentationId: string, packages = 3, packedPackages: number | null = null) {
  return { presentationId, packages, packedPackages };
}

const DATOS = { lot: 'CR-2610-A', expiryDate: '2027-04-30', productionDate: '2026-10-01' };

describe('QC-219 — missingBatchDataLines', () => {
  it('R4, R15: una linea con lote y sin datos cuenta como sin datos', () => {
    expect(missingBatchDataLines([linea('p1')], [loteDeLinea('p1', uuid('7'))])).toBe(1);
  });

  it('R15: una linea con sus datos no cuenta', () => {
    expect(missingBatchDataLines([linea('p1')], [loteDeLinea('p1', uuid('7'), DATOS)])).toBe(0);
  });

  it('R17: una linea sin lote de produccion cuenta como sin datos', () => {
    expect(missingBatchDataLines([linea('p1')], [])).toBe(1);
  });

  it('R17: un pedido sin lineas no tiene ninguna sin datos', () => {
    expect(missingBatchDataLines([], [])).toBe(0);
    expect(missingBatchDataLines([], [loteDeLinea('p1', uuid('7'))])).toBe(0);
  });

  it('R4: cuenta por presentacion: sin lote, sin datos y con datos en el mismo pedido', () => {
    const lineas = [linea('p1'), linea('p2'), linea('p3')];
    const lotes = [loteDeLinea('p2', uuid('8')), loteDeLinea('p3', uuid('9'), DATOS)];
    expect(missingBatchDataLines(lineas, lotes)).toBe(2);
  });

  it('R17: un lote de otra presentacion no cubre la linea', () => {
    expect(missingBatchDataLines([linea('p1')], [loteDeLinea('p9', uuid('7'), DATOS)])).toBe(1);
  });

  it('QC-281 R23: una linea empacada con 0 envases no tiene lote y no cuenta como sin datos', () => {
    expect(missingBatchDataLines([linea('p1', 3, 0)], [])).toBe(0);
  });

  it('QC-281 R23: con una linea en 0 solo cuentan las demas lineas sin datos', () => {
    const lineas = [linea('p1', 3, 0), linea('p2', 4, 2), linea('p3', 5, 5)];
    expect(missingBatchDataLines(lineas, [loteDeLinea('p3', uuid('9'), DATOS)])).toBe(1);
  });

  it('QC-281 R25: una linea sin conteo guardado se lee con el plan y sigue contando como hoy', () => {
    expect(missingBatchDataLines([linea('p1', 3, null)], [])).toBe(1);
  });
});

describe('QC-284 — batchDataForm: como abre el formulario unico del pedido', () => {
  const LINEAS = [{ presentationId: 'p1' }, { presentationId: 'p2' }];

  it('R14: un pedido con datos uniformes abre relleno con esos datos', () => {
    expect(batchDataForm(LINEAS, [loteDeLinea('p1', uuid('7'), DATOS), loteDeLinea('p2', uuid('8'), DATOS)])).toEqual({
      kind: 'shared',
      ...DATOS,
    });
  });

  it('R14: un pedido sin datos abre vacio y sin aviso', () => {
    expect(batchDataForm(LINEAS, [loteDeLinea('p1', uuid('7')), loteDeLinea('p2', uuid('8'))])).toEqual({
      kind: 'empty',
    });
  });

  it('R14: una linea sin lote no impide abrir relleno ni vacio: no cuenta para decidir', () => {
    expect(batchDataForm(LINEAS, [loteDeLinea('p1', uuid('7'), DATOS)])).toEqual({ kind: 'shared', ...DATOS });
    expect(batchDataForm(LINEAS, [loteDeLinea('p2', uuid('8'))])).toEqual({ kind: 'empty' });
  });

  it('R15: datos a medias (una linea con datos y otra sin ellos) -> aviso con el codigo actual de cada una', () => {
    expect(batchDataForm(LINEAS, [loteDeLinea('p1', uuid('7'), DATOS), loteDeLinea('p2', uuid('8'))])).toEqual({
      kind: 'divergent',
      lines: [
        { presentationId: 'p1', lot: 'CR-2610-A' },
        { presentationId: 'p2', lot: 'AUTO-p2' },
      ],
    });
  });

  it('R15: dos lotes distintos -> aviso', () => {
    const form = batchDataForm(LINEAS, [
      loteDeLinea('p1', uuid('7'), DATOS),
      loteDeLinea('p2', uuid('8'), { ...DATOS, lot: 'CR-2610-B' }),
    ]);
    expect(form).toEqual({
      kind: 'divergent',
      lines: [
        { presentationId: 'p1', lot: 'CR-2610-A' },
        { presentationId: 'p2', lot: 'CR-2610-B' },
      ],
    });
  });

  it.each([
    ['vencimiento', { expiryDate: '2027-05-01' }],
    ['dia de produccion', { productionDate: '2026-09-30' }],
  ])('R15: el mismo lote con distinto %s -> aviso', (_n, cambio) => {
    expect(
      batchDataForm(LINEAS, [loteDeLinea('p1', uuid('7'), DATOS), loteDeLinea('p2', uuid('8'), { ...DATOS, ...cambio })])
        .kind,
    ).toBe('divergent');
  });

  it('R15: la comparacion del codigo distingue mayusculas', () => {
    expect(
      batchDataForm(LINEAS, [loteDeLinea('p1', uuid('7'), DATOS), loteDeLinea('p2', uuid('8'), { ...DATOS, lot: 'cr-2610-a' })])
        .kind,
    ).toBe('divergent');
  });

  it('R15: el aviso lista todas las lineas en su orden de alta, y una sin lote como `null`', () => {
    const lineas = [{ presentationId: 'p3' }, { presentationId: 'p1' }, { presentationId: 'p2' }];
    const form = batchDataForm(lineas, [
      loteDeLinea('p1', uuid('7'), DATOS),
      loteDeLinea('p3', uuid('9'), { ...DATOS, lot: 'OTRO' }),
    ]);
    expect(form).toEqual({
      kind: 'divergent',
      lines: [
        { presentationId: 'p3', lot: 'OTRO' },
        { presentationId: 'p1', lot: 'CR-2610-A' },
        { presentationId: 'p2', lot: null },
      ],
    });
  });

  it('R17: un pedido sin ninguna linea con lote -> `no_batches`', () => {
    expect(batchDataForm(LINEAS, [])).toEqual({ kind: 'no_batches' });
    expect(batchDataForm([], [])).toEqual({ kind: 'no_batches' });
  });

  it('R17: un lote de otra presentacion no cuenta como linea con lote', () => {
    expect(batchDataForm(LINEAS, [loteDeLinea('p9', uuid('7'), DATOS)])).toEqual({ kind: 'no_batches' });
  });

  it('R16: es pura: no cambia lo que recibe', () => {
    const lotes = Object.freeze([Object.freeze(loteDeLinea('p1', uuid('7'), DATOS)), Object.freeze(loteDeLinea('p2', uuid('8')))]);
    const lineas = Object.freeze(LINEAS.map((linea) => Object.freeze({ ...linea })));
    expect(() => batchDataForm(lineas, lotes)).not.toThrow();
    expect(lotes[1]?.lot).toBe('AUTO-p2');
  });
});
