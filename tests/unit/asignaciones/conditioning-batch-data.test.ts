// QC-219 T6 — `missingBatchDataLines`: cuantas lineas del reparto no tienen sus datos de lote.
import { describe, expect, it } from 'vitest';

import { missingBatchDataLines } from '@/lib/modules/asignaciones/domain/conditioning-batch-data';

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
