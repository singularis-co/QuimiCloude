// Colocacion de las fotos de fabricacion en las anotaciones del recorrido. Funcion pura: sin DOM.
import { describe, expect, it } from 'vitest';

import { placeManufacturingEvidence } from '@/app/(private)/dashboard/recorrido/[id]/components';
import type { ExecutionTraceDetailStep } from '@/lib/modules/asignaciones';
import { ORDER_EVIDENCE, orderEvidenceGroup } from '@/tests/fixtures/order-evidence';

type Step = Pick<ExecutionTraceDetailStep, 'id' | 'stepPosition'>;

// Arranca en 1, avanza a 2, vuelve a 1, avanza a 2 y 3, termina y empaca (sin numero de paso).
const STEPS: readonly Step[] = [
  { id: 's1', stepPosition: 1 },
  { id: 's2', stepPosition: 2 },
  { id: 's3', stepPosition: 1 },
  { id: 's4', stepPosition: 2 },
  { id: 's5', stepPosition: 3 },
  { id: 'p1', stepPosition: null },
  { id: 'p2', stepPosition: null },
];

describe('placeManufacturingEvidence', () => {
  it('R12 - el grupo de un paso repetido va solo a su ultima anotacion', () => {
    const { byStepId } = placeManufacturingEvidence(STEPS, ORDER_EVIDENCE.manufacturing);
    expect(byStepId.get('s3')?.stepPosition).toBe(1);
    expect(byStepId.get('s4')?.stepPosition).toBe(2);
    expect(byStepId.has('s1')).toBe(false);
    expect(byStepId.has('s2')).toBe(false);
    expect([...byStepId.keys()].sort()).toEqual(['s3', 's4']);
  });

  it('R12 - una anotacion de un paso sin fotos no recibe grupo', () => {
    const { byStepId } = placeManufacturingEvidence(STEPS, ORDER_EVIDENCE.manufacturing);
    expect(byStepId.has('s5')).toBe(false);
  });

  it('R13 - el grupo de un paso sin ninguna anotacion va a others, ordenado por paso', () => {
    const groups = [orderEvidenceGroup('m', 7, 1), ...ORDER_EVIDENCE.manufacturing];
    const { others } = placeManufacturingEvidence(STEPS, groups);
    expect(others.map((group) => group.stepPosition)).toEqual([4, 7]);
  });

  it('R13 - si todos los pasos con fotos tienen anotacion, others queda vacio', () => {
    const { others } = placeManufacturingEvidence(STEPS, ORDER_EVIDENCE.manufacturing.slice(0, 2));
    expect(others).toEqual([]);
  });

  it('R12 - R13 - sin anotaciones, todos los grupos van a others', () => {
    const { byStepId, others } = placeManufacturingEvidence([], ORDER_EVIDENCE.manufacturing);
    expect(byStepId.size).toBe(0);
    expect(others).toHaveLength(ORDER_EVIDENCE.manufacturing.length);
  });

  it('R14 - ninguna foto de envasado se coloca en una anotacion', () => {
    const { byStepId, others } = placeManufacturingEvidence(STEPS, ORDER_EVIDENCE.manufacturing);
    const packingIds = new Set(ORDER_EVIDENCE.packing.flatMap((group) => group.photos ?? []).map((p) => p.id));
    const placedIds = [...byStepId.values(), ...others].flatMap((group) => group.photos ?? []).map((p) => p.id);
    expect(placedIds.length).toBeGreaterThan(0);
    expect(placedIds.some((id) => packingIds.has(id))).toBe(false);
    expect(byStepId.has('p1')).toBe(false);
    expect(byStepId.has('p2')).toBe(false);
  });

  it('R14 - las anotaciones de empaque, sin numero de paso, nunca reciben un grupo', () => {
    const packingOnly: readonly Step[] = [
      { id: 'p1', stepPosition: null },
      { id: 'p2', stepPosition: null },
    ];
    const { byStepId, others } = placeManufacturingEvidence(packingOnly, ORDER_EVIDENCE.packing);
    expect(byStepId.size).toBe(0);
    expect(others.map((group) => group.stepPosition)).toEqual([1]);
  });
});
