// El avance puro de los pasos de acondicionamiento: cuantos estan completados y quien es
// responsable de cada uno, a partir del registro de ejecucion.

import { describe, expect, it } from 'vitest'

import { conditioningProgress, sameResponsibles } from '@/lib/modules/asignaciones/domain/conditioning-steps'
import { conditioningResponsiblesSchema } from '@/lib/modules/asignaciones/domain/conditioning-trace'
import type { ExecutionAction, ExecutionEntryRecord } from '@/lib/modules/asignaciones/domain/execution-entry'

const ORDER = '22222222-2222-4222-8222-222222222222'
const ANA = '33333333-3333-4333-8333-333333333333'
const BEA = '44444444-4444-4444-8444-444444444444'
const CARLOS = '55555555-5555-4555-8555-555555555555'
const T0 = Date.parse('2026-10-21T08:00:00.000Z')

let seq = 0
function anotacion(
  action: ExecutionAction,
  stepPosition: number | null,
  responsibleUserIds: readonly string[] | null = null,
): ExecutionEntryRecord {
  seq += 1
  return {
    id: `e-${String(seq).padStart(4, '0')}`,
    orderId: ORDER,
    userId: ANA,
    action,
    stepPosition,
    reason: null,
    batchLines: null,
    responsibleUserIds,
    occurredAt: new Date(T0 + seq * 60_000),
  }
}

const avanza = (pos: number, responsables: readonly string[] | null = null) =>
  anotacion('conditioning_step_advance', pos, responsables)
const completa = (pos: number, responsables: readonly string[] | null = null) =>
  anotacion('conditioning_steps_complete', pos, responsables)
const cambia = (pos: number, responsables: readonly string[]) =>
  anotacion('conditioning_responsibles_change', pos, responsables)

describe('conditioningProgress: pasos completados (R27)', () => {
  it('R27: sin anotaciones de paso no hay ninguno completado', () => {
    const progreso = conditioningProgress([anotacion('conditioning_start', null)], 3)
    expect(progreso.completedCount).toBe(0)
    expect(progreso.responsibles.size).toBe(0)
  })

  it('R27: cuenta hasta la mayor posicion completada', () => {
    const progreso = conditioningProgress(
      [anotacion('conditioning_start', null), avanza(1), avanza(2), anotacion('conditioning_batch_save', null)],
      4,
    )
    expect(progreso.completedCount).toBe(2)
  })

  it('R27: completar el ultimo paso cuenta como completado', () => {
    expect(conditioningProgress([avanza(1), avanza(2), completa(3)], 3).completedCount).toBe(3)
  })

  it('R27: un cambio de responsables no completa ningun paso', () => {
    expect(conditioningProgress([avanza(1), cambia(1, [BEA]), cambia(2, [BEA])], 3).completedCount).toBe(1)
  })

  it('R27: las anotaciones de produccion y empaque con posicion no cuentan', () => {
    const progreso = conditioningProgress(
      [anotacion('start', 1), anotacion('advance', 4), anotacion('go_back', 3), anotacion('cancel', 2)],
      5,
    )
    expect(progreso.completedCount).toBe(0)
  })

  it('R27: si la formula perdio pasos, el conteo se recorta a la lista actual', () => {
    const anotaciones = [avanza(1), avanza(2), avanza(3), completa(4)]
    expect(conditioningProgress(anotaciones, 2).completedCount).toBe(2)
    expect(conditioningProgress(anotaciones, 0).completedCount).toBe(0)
  })

  it('R27: si la formula gano pasos, los nuevos quedan pendientes', () => {
    expect(conditioningProgress([avanza(1), completa(2)], 4).completedCount).toBe(2)
  })
})

describe('conditioningProgress: responsables vigentes por posicion (R28)', () => {
  it('R28: el paso sin marca de asignacion no tiene responsables', () => {
    const progreso = conditioningProgress([avanza(1), avanza(2, [ANA])], 3)
    expect(progreso.responsibles.has(1)).toBe(false)
    expect(progreso.responsibles.get(2)).toEqual([ANA])
  })

  it('R28: vale la ultima anotacion de la posicion que trae responsables; las anteriores siguen en el registro', () => {
    const anotaciones = [avanza(1, [ANA]), avanza(2, [BEA]), cambia(1, [BEA, CARLOS]), completa(3, [ANA]), cambia(1, [CARLOS])]
    const progreso = conditioningProgress(anotaciones, 3)
    expect(progreso.responsibles.get(1)).toEqual([CARLOS])
    expect(progreso.responsibles.get(2)).toEqual([BEA])
    expect(progreso.responsibles.get(3)).toEqual([ANA])
    expect(anotaciones).toHaveLength(5)
  })

  it('R28: una anotacion sin responsables no borra los vigentes de su posicion', () => {
    const progreso = conditioningProgress([cambia(1, [BEA]), avanza(1, null)], 2)
    expect(progreso.responsibles.get(1)).toEqual([BEA])
  })

  it('R28: el cambio de responsables de una posicion no toca las demas', () => {
    const progreso = conditioningProgress([avanza(1, [ANA]), avanza(2, [ANA]), cambia(2, [BEA])], 3)
    expect(progreso.responsibles.get(1)).toEqual([ANA])
    expect(progreso.responsibles.get(2)).toEqual([BEA])
  })
})

describe('sameResponsibles (R28)', () => {
  it('R28: el mismo conjunto en otro orden es el mismo', () => {
    expect(sameResponsibles([ANA, BEA], [BEA, ANA])).toBe(true)
  })

  it('R28: falta, sobra o cambia una persona: es otro conjunto', () => {
    expect(sameResponsibles([ANA, BEA], [ANA])).toBe(false)
    expect(sameResponsibles([ANA], [ANA, BEA])).toBe(false)
    expect(sameResponsibles([ANA, BEA], [ANA, CARLOS])).toBe(false)
  })

  it('R28: dos listas vacias son el mismo conjunto', () => {
    expect(sameResponsibles([], [])).toBe(true)
  })
})

describe('conditioningResponsiblesSchema (R28)', () => {
  it('R28: acepta uno o mas uuid distintos', () => {
    expect(conditioningResponsiblesSchema.safeParse([ANA]).success).toBe(true)
    expect(conditioningResponsiblesSchema.safeParse([ANA, BEA, CARLOS]).success).toBe(true)
  })

  it.each([
    ['una lista vacia', []],
    ['un repetido', [ANA, ANA]],
    ['un id que no es uuid', ['ana']],
    ['algo que no es lista', ANA],
    ['null', null],
  ])('R28: rechaza %s', (_caso, valor) => {
    expect(conditioningResponsiblesSchema.safeParse(valor).success).toBe(false)
  })
})
