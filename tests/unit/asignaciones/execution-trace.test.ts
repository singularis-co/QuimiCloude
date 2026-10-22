// El calculo puro del recorrido de un pedido: tramos, duraciones por fase, total, vueltas atras y
// personas.

import { describe, expect, it } from 'vitest'

import type { ExecutionAction, ExecutionEntryRecord } from '@/lib/modules/asignaciones/domain/execution-entry'
import { FINAL_STATUSES, buildExecutionTrace } from '@/lib/modules/asignaciones/domain/execution-trace'

const ORDER = '22222222-2222-4222-8222-222222222222'
const ANA = '33333333-3333-4333-8333-333333333333'
const LUIS = '44444444-4444-4444-8444-444444444444'
const T0 = Date.parse('2026-10-01T08:00:00.000Z')
const MIN = 60_000
const HOUR = 60 * MIN

let seq = 0
function entry(action: ExecutionAction, offsetMs: number, userId = ANA): ExecutionEntryRecord {
  seq += 1
  const sinPaso = action === 'pack_start' || action === 'pack_finish' || action.startsWith('conditioning_')
  return {
    id: `e-${String(seq).padStart(4, '0')}`,
    orderId: ORDER,
    userId,
    action,
    stepPosition: sinPaso ? null : 1,
    reason: action === 'cancel' ? 'sin material' : null,
    batchLines: null,
    responsibleUserIds: null,
    occurredAt: new Date(T0 + offsetMs),
  }
}

const NOW = new Date(T0 + 100 * HOUR)
const vivo = (status: Parameters<typeof buildExecutionTrace>[1]['status']) => ({ status, deleted: false })

/** Ejecucion completa con una pausa larga antes de `resume` y hueco entre `finish` y `pack_start`. */
function recorridoEntregado(): ExecutionEntryRecord[] {
  return [
    entry('start', 0),
    entry('advance', 10 * MIN),
    entry('resume', 10 * MIN + 20 * HOUR), // pausa larga
    entry('go_back', 10 * MIN + 20 * HOUR + 5 * MIN, LUIS),
    entry('finish', 21 * HOUR),
    entry('pack_start', 30 * HOUR, LUIS), // hueco finish -> pack_start
    entry('pack_finish', 31 * HOUR, LUIS),
  ]
}

/** Produccion 1 h, empaque 30 min y acondicionamiento 45 min con dos guardados, todo cerrado. */
function recorridoAcondicionado(): ExecutionEntryRecord[] {
  return [
    entry('start', 0),
    entry('advance', 20 * MIN),
    entry('finish', HOUR),
    entry('pack_start', 2 * HOUR, LUIS),
    entry('pack_finish', 2 * HOUR + 30 * MIN, LUIS),
    entry('conditioning_start', 5 * HOUR),
    entry('conditioning_batch_save', 5 * HOUR + 10 * MIN, LUIS),
    entry('conditioning_batch_save', 5 * HOUR + 20 * MIN, LUIS),
    entry('conditioning_finish', 5 * HOUR + 45 * MIN),
  ]
}

describe('buildExecutionTrace: tramos (R14)', () => {
  it('R14: cada anotacion salvo la ultima lleva el tramo hasta la siguiente; la ultima, null', () => {
    const trace = buildExecutionTrace(
      [entry('start', 0), entry('advance', 90_000), entry('advance', 90_000 + 30_000)],
      vivo('EN_CURSO'),
      NOW,
    )
    expect(trace.steps.map((s) => s.gapToNextMs)).toEqual([90_000, 30_000, null])
  })

  it('R14: los pasos conservan los campos de la anotacion en el mismo orden', () => {
    const entries = recorridoEntregado()
    const trace = buildExecutionTrace(entries, vivo('ENTREGADO'), NOW)
    expect(trace.steps.map((s) => s.id)).toEqual(entries.map((e) => e.id))
    expect(trace.steps[0]).toMatchObject(entries[0] ?? {})
  })

  it('R14: dos anotaciones del mismo instante dan tramo 0', () => {
    const trace = buildExecutionTrace([entry('start', 0), entry('advance', 0)], vivo('EN_CURSO'), NOW)
    expect(trace.steps[0]?.gapToNextMs).toBe(0)
  })
})

describe('buildExecutionTrace: forma del resultado', () => {
  it('R15 R19: el resultado lleva active, durations y totalDuration, y ya no `duration`', () => {
    const trace = buildExecutionTrace(recorridoEntregado(), vivo('ENTREGADO'), NOW)
    expect(Object.keys(trace).sort()).toEqual([
      'active',
      'durations',
      'firstAt',
      'goBackCount',
      'lastAt',
      'steps',
      'totalDuration',
      'userIds',
    ])
    expect(Object.keys(trace.durations).sort()).toEqual(['conditioning', 'packing', 'production'])
    expect(Object.keys(trace.totalDuration).sort()).toEqual(['kind', 'ms'])
  })

  it('R15: firstAt y lastAt siguen siendo la primera y la ultima anotacion', () => {
    const trace = buildExecutionTrace(recorridoEntregado(), vivo('ENTREGADO'), NOW)
    expect(trace.firstAt).toEqual(new Date(T0))
    expect(trace.lastAt).toEqual(new Date(T0 + 31 * HOUR))
  })

  it('R15: FINAL_STATUSES es exactamente ENTREGADO y CANCELADO', () => {
    expect([...FINAL_STATUSES]).toEqual(['ENTREGADO', 'CANCELADO'])
  })
})

describe('buildExecutionTrace: active (R28)', () => {
  it.each(['EN_CURSO', 'POR_EMPACAR', 'EN_EMPAQUE', 'BLOQUEADO', 'POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO'] as const)(
    'R3 R28: %s vivo es active',
    (status) => {
      expect(buildExecutionTrace([entry('start', 0)], vivo(status), NOW).active).toBe(true)
    },
  )

  it.each(['ENTREGADO', 'CANCELADO'] as const)('R3 R28: %s no es active', (status) => {
    expect(buildExecutionTrace([entry('start', 0)], vivo(status), NOW).active).toBe(false)
  })

  it('R3 R28: dado de baja nunca es active, aunque su estado lo sea', () => {
    const trace = buildExecutionTrace([entry('start', 0)], { status: 'EN_CURSO', deleted: true }, NOW)
    expect(trace.active).toBe(false)
  })
})

describe('buildExecutionTrace: duracion por fase', () => {
  it('R19: tres fases cerradas', () => {
    const trace = buildExecutionTrace(recorridoAcondicionado(), vivo('TERMINADO'), NOW)
    expect(trace.durations).toEqual({
      production: { kind: 'closed', ms: HOUR },
      packing: { kind: 'closed', ms: 30 * MIN },
      conditioning: { kind: 'closed', ms: 45 * MIN },
    })
  })

  it('R19: cada fase usa la primera anotacion que la abre y la primera que la cierra despues', () => {
    const trace = buildExecutionTrace(
      [
        entry('finish', 0), // un cierre antes de abrir no cuenta
        entry('start', 10 * MIN),
        entry('finish', 40 * MIN),
        entry('finish', 90 * MIN),
      ],
      vivo('ENTREGADO'),
      NOW,
    )
    expect(trace.durations.production).toEqual({ kind: 'closed', ms: 30 * MIN })
  })

  it('R20: fase abierta hasta now en su estado', () => {
    const produccion = buildExecutionTrace([entry('start', 0), entry('advance', HOUR)], vivo('EN_CURSO'), NOW)
    expect(produccion.durations.production).toEqual({ kind: 'open', ms: 100 * HOUR })

    const empaque = buildExecutionTrace(
      [entry('start', 0), entry('finish', HOUR), entry('pack_start', 2 * HOUR)],
      vivo('EN_EMPAQUE'),
      NOW,
    )
    expect(empaque.durations).toEqual({
      production: { kind: 'closed', ms: HOUR },
      packing: { kind: 'open', ms: 98 * HOUR },
      conditioning: null,
    })

    const acondicionamiento = buildExecutionTrace(
      [entry('conditioning_start', 4 * HOUR), entry('conditioning_batch_save', 5 * HOUR)],
      vivo('EN_ACONDICIONAMIENTO'),
      NOW,
    )
    expect(acondicionamiento.durations.conditioning).toEqual({ kind: 'open', ms: 96 * HOUR })
  })

  it('R21: sin cierre fuera de su estado o dado de baja', () => {
    // Pedido ya en EN_EMPAQUE sin finish anotado: produccion mide hasta su ultima anotacion.
    const sinFinish = buildExecutionTrace(
      [entry('start', 0), entry('advance', 20 * MIN), entry('pack_start', 2 * HOUR)],
      vivo('EN_EMPAQUE'),
      NOW,
    )
    expect(sinFinish.durations.production).toEqual({ kind: 'unclosed', ms: 20 * MIN })
    expect(sinFinish.durations.packing?.kind).toBe('open')

    // Dado de baja en su propio estado: no es open.
    const deBaja = buildExecutionTrace(
      [entry('conditioning_start', 0), entry('conditioning_batch_save', 15 * MIN)],
      { status: 'EN_ACONDICIONAMIENTO', deleted: true },
      NOW,
    )
    expect(deBaja.durations.conditioning).toEqual({ kind: 'unclosed', ms: 15 * MIN })

    // ENTREGADO sin pack_finish: empaque sin cierre, medido hasta pack_start (su unica anotacion).
    const sinPackFinish = buildExecutionTrace(
      [entry('start', 0), entry('finish', HOUR), entry('pack_start', 2 * HOUR)],
      vivo('ENTREGADO'),
      NOW,
    )
    expect(sinPackFinish.durations.packing).toEqual({ kind: 'unclosed', ms: 0 })
  })

  it('R21: la ultima anotacion de la fase no incluye las de otras fases', () => {
    const trace = buildExecutionTrace(
      [entry('start', 0), entry('advance', 10 * MIN), entry('conditioning_start', 3 * HOUR)],
      vivo('EN_ACONDICIONAMIENTO'),
      NOW,
    )
    expect(trace.durations.production).toEqual({ kind: 'unclosed', ms: 10 * MIN })
  })

  it('R22: fase sin apertura es null; guardados sin Comenzar', () => {
    const soloProduccion = buildExecutionTrace([entry('start', 0), entry('finish', HOUR)], vivo('ENTREGADO'), NOW)
    expect(soloProduccion.durations.packing).toBeNull()
    expect(soloProduccion.durations.conditioning).toBeNull()

    const guardadosSinComenzar = buildExecutionTrace(
      [entry('conditioning_batch_save', 0), entry('conditioning_batch_save', HOUR), entry('conditioning_finish', 2 * HOUR)],
      vivo('TERMINADO'),
      NOW,
    )
    expect(guardadosSinComenzar.durations).toEqual({ production: null, packing: null, conditioning: null })
  })

  it('R22: una produccion sin start es null aunque haya avances', () => {
    const trace = buildExecutionTrace([entry('advance', 0), entry('finish', HOUR)], vivo('ENTREGADO'), NOW)
    expect(trace.durations.production).toBeNull()
  })
})

describe('buildExecutionTrace: pausas de produccion (R23)', () => {
  it('R23: descuenta pausas antes de cada resume; resume doble; BLOQUEADO no', () => {
    // Pausa larga de 20 h antes del resume: produccion 21 h de reloj - 20 h = 1 h.
    const entregado = buildExecutionTrace(recorridoEntregado(), vivo('ENTREGADO'), NOW)
    expect(entregado.durations.production).toEqual({ kind: 'closed', ms: HOUR })

    // Dos resume seguidos (recarga): descuenta advance->resume1 y resume1->resume2.
    const doble = buildExecutionTrace(
      [
        entry('start', 0),
        entry('advance', 10 * MIN),
        entry('resume', 40 * MIN),
        entry('resume', 45 * MIN),
        entry('finish', 60 * MIN),
      ],
      vivo('ENTREGADO'),
      NOW,
    )
    expect(doble.durations.production).toEqual({ kind: 'closed', ms: 25 * MIN })

    // Sin resume no hay pausa: un hueco largo entre anotaciones cuenta entero, y el estado
    // BLOQUEADO tampoco descuenta nada.
    const bloqueado = buildExecutionTrace(
      [entry('start', 0), entry('advance', 3 * HOUR)],
      vivo('BLOQUEADO'),
      NOW,
    )
    expect(bloqueado.durations.production).toEqual({ kind: 'unclosed', ms: 3 * HOUR })
  })

  it('R23: en una fase abierta descuenta las pausas hasta now', () => {
    const trace = buildExecutionTrace(
      [entry('start', 0), entry('advance', 10 * MIN), entry('resume', 2 * HOUR + 10 * MIN)],
      vivo('EN_CURSO'),
      NOW,
    )
    expect(trace.durations.production).toEqual({ kind: 'open', ms: 98 * HOUR })
  })

  it('R23: un resume posterior al cierre no descuenta nada', () => {
    const trace = buildExecutionTrace(
      [entry('start', 0), entry('finish', HOUR), entry('resume', 5 * HOUR)],
      vivo('ENTREGADO'),
      NOW,
    )
    expect(trace.durations.production).toEqual({ kind: 'closed', ms: HOUR })
  })

  it('R23: empaque y acondicionamiento no descuentan pausas', () => {
    const trace = buildExecutionTrace(
      [
        entry('pack_start', 0),
        entry('resume', 2 * HOUR),
        entry('pack_finish', 3 * HOUR),
        entry('conditioning_start', 4 * HOUR),
        entry('resume', 6 * HOUR),
        entry('conditioning_finish', 7 * HOUR),
      ],
      vivo('TERMINADO'),
      NOW,
    )
    expect(trace.durations.packing).toEqual({ kind: 'closed', ms: 3 * HOUR })
    expect(trace.durations.conditioning).toEqual({ kind: 'closed', ms: 3 * HOUR })
  })
})

describe('buildExecutionTrace: cancelar (R24)', () => {
  it('R24: cancel cierra solo la fase en curso', () => {
    // Cancelar en produccion: la cierra en ese instante; empaque y acondicionamiento siguen null.
    const enProduccion = buildExecutionTrace(
      [entry('start', 0), entry('advance', 10 * MIN), entry('cancel', 45 * MIN)],
      vivo('CANCELADO'),
      NOW,
    )
    expect(enProduccion.durations).toEqual({
      production: { kind: 'closed', ms: 45 * MIN },
      packing: null,
      conditioning: null,
    })

    // Cancelar en empaque: cierra empaque; produccion ya estaba cerrada y no cambia.
    const enEmpaque = buildExecutionTrace(
      [entry('start', 0), entry('finish', HOUR), entry('pack_start', 2 * HOUR), entry('cancel', 2 * HOUR + 20 * MIN)],
      vivo('CANCELADO'),
      NOW,
    )
    expect(enEmpaque.durations).toEqual({
      production: { kind: 'closed', ms: HOUR },
      packing: { kind: 'closed', ms: 20 * MIN },
      conditioning: null,
    })
  })

  it('R24: un cancel tras una fase ya cerrada no cierra ninguna', () => {
    const trace = buildExecutionTrace(
      [entry('start', 0), entry('finish', HOUR), entry('cancel', 3 * HOUR)],
      vivo('CANCELADO'),
      NOW,
    )
    expect(trace.durations).toEqual({ production: { kind: 'closed', ms: HOUR }, packing: null, conditioning: null })
  })

  it('R24: un cancel como unica anotacion no abre ni cierra ninguna fase', () => {
    const trace = buildExecutionTrace([entry('cancel', 0)], vivo('CANCELADO'), NOW)
    expect(trace.durations).toEqual({ production: null, packing: null, conditioning: null })
    expect(trace.totalDuration).toEqual({ kind: 'closed', ms: 0 })
  })

  it('R24: un cancel tras una anotacion de acondicionamiento no lo cierra, pero si es su ultima anotacion', () => {
    const trace = buildExecutionTrace(
      [entry('conditioning_start', 0), entry('conditioning_batch_save', 10 * MIN), entry('cancel', 30 * MIN)],
      vivo('CANCELADO'),
      NOW,
    )
    expect(trace.durations.conditioning).toEqual({ kind: 'unclosed', ms: 30 * MIN })
  })

  it('R24: dado de baja con cancel en produccion sigue cerrada en el cancel', () => {
    const trace = buildExecutionTrace(
      [entry('start', 0), entry('cancel', 5 * MIN)],
      { status: 'CANCELADO', deleted: true },
      NOW,
    )
    expect(trace.durations.production).toEqual({ kind: 'closed', ms: 5 * MIN })
  })
})

describe('buildExecutionTrace: total (R26)', () => {
  it('R26: total = suma, null = 0, precedencia del kind', () => {
    // Suma sin las esperas entre fases: 1 h + 30 min + 45 min.
    const cerrado = buildExecutionTrace(recorridoAcondicionado(), vivo('TERMINADO'), NOW)
    expect(cerrado.totalDuration).toEqual({ kind: 'closed', ms: HOUR + 30 * MIN + 45 * MIN })

    // Una fase null suma 0.
    const sinEmpaque = buildExecutionTrace(
      [entry('start', 0), entry('finish', HOUR), entry('conditioning_start', 2 * HOUR), entry('conditioning_finish', 3 * HOUR)],
      vivo('TERMINADO'),
      NOW,
    )
    expect(sinEmpaque.durations.packing).toBeNull()
    expect(sinEmpaque.totalDuration).toEqual({ kind: 'closed', ms: 2 * HOUR })

    // open gana a unclosed: produccion sin cierre y acondicionamiento en curso.
    const abierta = buildExecutionTrace(
      [entry('start', 0), entry('advance', 10 * MIN), entry('conditioning_start', HOUR)],
      vivo('EN_ACONDICIONAMIENTO'),
      NOW,
    )
    expect(abierta.durations.production?.kind).toBe('unclosed')
    expect(abierta.totalDuration).toEqual({ kind: 'open', ms: 10 * MIN + 99 * HOUR })

    // unclosed gana a closed.
    const sinCierre = buildExecutionTrace(
      [entry('start', 0), entry('finish', HOUR), entry('pack_start', 2 * HOUR), entry('pack_start', 2 * HOUR + 5 * MIN)],
      vivo('ENTREGADO'),
      NOW,
    )
    expect(sinCierre.totalDuration).toEqual({ kind: 'unclosed', ms: HOUR + 5 * MIN })
  })

  it('R26: las tres fases null dan closed con 0', () => {
    const trace = buildExecutionTrace([entry('advance', 0), entry('advance', HOUR)], vivo('ENTREGADO'), NOW)
    expect(trace.totalDuration).toEqual({ kind: 'closed', ms: 0 })
  })

  it('R26: el ms del total es exacto, sin redondear', () => {
    const trace = buildExecutionTrace([entry('start', 0), entry('finish', 61_234)], vivo('ENTREGADO'), NOW)
    expect(trace.totalDuration).toEqual({ kind: 'closed', ms: 61_234 })
  })
})

describe('buildExecutionTrace: vueltas atras (R16)', () => {
  it('R16: cada go_back queda marcado y goBackCount los cuenta', () => {
    const trace = buildExecutionTrace(
      [entry('start', 0), entry('advance', 1), entry('go_back', 2), entry('advance', 3), entry('go_back', 4)],
      vivo('EN_CURSO'),
      NOW,
    )
    expect(trace.steps.map((s) => s.isGoBack)).toEqual([false, false, true, false, true])
    expect(trace.goBackCount).toBe(2)
  })

  it('R16: sin go_back el contador es 0', () => {
    expect(buildExecutionTrace([entry('start', 0)], vivo('EN_CURSO'), NOW).goBackCount).toBe(0)
  })
})

describe('buildExecutionTrace: personas', () => {
  it('R2: personas distintas en orden de aparicion', () => {
    const trace = buildExecutionTrace(recorridoEntregado(), vivo('ENTREGADO'), NOW)
    expect(trace.userIds).toEqual([ANA, LUIS])
  })

  it('R2: sin anotaciones lanza (el caso de uso nunca la llama asi)', () => {
    expect(() => buildExecutionTrace([], vivo('EN_CURSO'), NOW)).toThrow()
  })
})

type StepAction = 'conditioning_step_advance' | 'conditioning_steps_complete' | 'conditioning_responsibles_change'

function pasoDeAcondicionamiento(action: StepAction, offsetMs: number, stepPosition: number): ExecutionEntryRecord {
  return { ...entry(action, offsetMs, LUIS), stepPosition, responsibleUserIds: [LUIS] }
}

describe('buildExecutionTrace: anotaciones de paso de acondicionamiento (R38)', () => {
  /** Lo de `recorridoAcondicionado` mas pasos, un cambio de responsables y el cierre de pasos. */
  function conPasos(): ExecutionEntryRecord[] {
    const base = recorridoAcondicionado()
    const terminar = base[base.length - 1]
    return [
      ...base.slice(0, -1),
      pasoDeAcondicionamiento('conditioning_step_advance', 5 * HOUR + 25 * MIN, 1),
      pasoDeAcondicionamiento('conditioning_responsibles_change', 5 * HOUR + 30 * MIN, 1),
      pasoDeAcondicionamiento('conditioning_steps_complete', 5 * HOUR + 40 * MIN, 2),
      ...(terminar === undefined ? [] : [terminar]),
    ]
  }

  it('R38: con la fase cerrada, las duraciones y el total no cambian por las anotaciones de paso', () => {
    const sin = buildExecutionTrace(recorridoAcondicionado(), vivo('TERMINADO'), NOW)
    const con = buildExecutionTrace(conPasos(), vivo('TERMINADO'), NOW)
    expect(con.durations).toEqual(sin.durations)
    expect(con.durations.conditioning).toEqual({ kind: 'closed', ms: 45 * MIN })
    expect(con.totalDuration).toEqual(sin.totalDuration)
  })

  it('R38: con la fase abierta, se mide desde Comenzar hasta now', () => {
    const trace = buildExecutionTrace(
      [
        entry('conditioning_start', 4 * HOUR),
        pasoDeAcondicionamiento('conditioning_step_advance', 5 * HOUR, 1),
        pasoDeAcondicionamiento('conditioning_steps_complete', 6 * HOUR, 2),
      ],
      vivo('EN_ACONDICIONAMIENTO'),
      NOW,
    )
    expect(trace.durations.conditioning).toEqual({ kind: 'open', ms: 96 * HOUR })
    expect(trace.durations.production).toBeNull()
  })

  it('R38: las anotaciones de paso cuentan dentro de la fase: sin cierre, la fase llega hasta la ultima', () => {
    const trace = buildExecutionTrace(
      [
        entry('conditioning_start', 0),
        pasoDeAcondicionamiento('conditioning_step_advance', 10 * MIN, 1),
        pasoDeAcondicionamiento('conditioning_responsibles_change', 25 * MIN, 1),
      ],
      { status: 'EN_ACONDICIONAMIENTO', deleted: true },
      NOW,
    )
    expect(trace.durations.conditioning).toEqual({ kind: 'unclosed', ms: 25 * MIN })
  })

  it('R38: ni abren ni cierran la fase: sin Comenzar la fase es null', () => {
    const trace = buildExecutionTrace(
      [
        pasoDeAcondicionamiento('conditioning_step_advance', 0, 1),
        pasoDeAcondicionamiento('conditioning_steps_complete', HOUR, 2),
      ],
      vivo('EN_ACONDICIONAMIENTO'),
      NOW,
    )
    expect(trace.durations.conditioning).toBeNull()
  })

  it('R38: un cancel tras una anotacion de paso no cierra el acondicionamiento', () => {
    const trace = buildExecutionTrace(
      [
        entry('conditioning_start', 0),
        pasoDeAcondicionamiento('conditioning_step_advance', 10 * MIN, 1),
        entry('cancel', 20 * MIN),
      ],
      vivo('EN_ACONDICIONAMIENTO'),
      NOW,
    )
    expect(trace.durations.conditioning?.kind).toBe('open')
  })

  it('R38: las anotaciones de paso son pasos del recorrido, con su posicion y sin vuelta atras', () => {
    const trace = buildExecutionTrace(conPasos(), vivo('TERMINADO'), NOW)
    const pasos = trace.steps.filter((step) => step.stepPosition !== null && step.action.startsWith('conditioning_'))
    expect(pasos.map((step) => [step.action, step.stepPosition, step.isGoBack])).toEqual([
      ['conditioning_step_advance', 1, false],
      ['conditioning_responsibles_change', 1, false],
      ['conditioning_steps_complete', 2, false],
    ])
    expect(trace.goBackCount).toBe(0)
  })
})
