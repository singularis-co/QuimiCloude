import { describe, expect, it } from 'vitest';

import { groupEvidenceRows } from '@/lib/modules/asignaciones';
import type { StepEvidenceRow } from '@/lib/modules/asignaciones/ports/step-evidence-repository';

import { PEDIDO } from './evidence-doubles';

function fila(id: string, stepPosition: number, slot: number): StepEvidenceRow {
  return { id, orderId: PEDIDO, phase: 'manufacturing', stepPosition, slot, path: `c/${PEDIDO}/${id}` };
}

describe('groupEvidenceRows', () => {
  it('R8: agrupa por numero de paso guardado, en orden ascendente, aunque las filas lleguen desordenadas', () => {
    const grupos = groupEvidenceRows([fila('a', 4, 1), fila('b', 1, 1), fila('c', 2, 1), fila('d', 1, 2)]);

    expect(grupos.map((grupo) => grupo.stepPosition)).toEqual([1, 2, 4]);
  });

  it('R8: dentro de cada paso ordena las fotos por casilla', () => {
    const grupos = groupEvidenceRows([fila('c', 2, 3), fila('a', 2, 1), fila('b', 2, 2)]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0]!.rows.map((row) => row.slot)).toEqual([1, 2, 3]);
    expect(grupos[0]!.rows.map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });

  it('R8: conserva los pasos con hueco tal cual, sin renumerarlos ni rellenar el que falta', () => {
    const grupos = groupEvidenceRows([fila('a', 1, 1), fila('b', 2, 1), fila('c', 4, 1)]);

    expect(grupos.map((grupo) => grupo.stepPosition)).toEqual([1, 2, 4]);
    expect(grupos.every((grupo) => grupo.rows.length === 1)).toBe(true);
  });

  it('R8: una casilla con hueco dentro del paso tampoco se renumera', () => {
    const grupos = groupEvidenceRows([fila('b', 3, 3), fila('a', 3, 1)]);

    expect(grupos[0]!.rows.map((row) => row.slot)).toEqual([1, 3]);
  });

  it('sin filas devuelve una lista vacia', () => {
    expect(groupEvidenceRows([])).toEqual([]);
  });

  it('no muta la lista de entrada', () => {
    const filas = [fila('b', 2, 2), fila('a', 2, 1)];
    groupEvidenceRows(filas);

    expect(filas.map((row) => row.id)).toEqual(['b', 'a']);
  });
});
