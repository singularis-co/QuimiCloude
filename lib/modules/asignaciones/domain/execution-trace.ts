import type { OrderStatus } from '@/lib/modules/pedidos';

import type { ExecutionPhase, TraceDurations } from './conditioning-trace';
import type { ExecutionAction, ExecutionEntryRecord } from './execution-entry';

/**
 * Los estados sin ninguna transicion de salida en la tabla de `pedidos`
 * (`order-transitions.ts`). Esa tabla no es publica, por eso se repiten aqui.
 */
export const FINAL_STATUSES: readonly OrderStatus[] = ['ENTREGADO', 'CANCELADO'];

export type TraceDuration =
  | { readonly kind: 'closed'; readonly ms: number }
  | { readonly kind: 'open'; readonly ms: number }
  | { readonly kind: 'unclosed'; readonly ms: number };

export type TraceStep = ExecutionEntryRecord & {
  readonly gapToNextMs: number | null;
  readonly isGoBack: boolean;
};

export type ExecutionTrace = {
  readonly steps: readonly TraceStep[];
  readonly firstAt: Date;
  readonly lastAt: Date;
  readonly active: boolean;
  readonly durations: TraceDurations;
  readonly totalDuration: TraceDuration;
  readonly goBackCount: number;
  /** Solo quien firma anotaciones, no el equipo. */
  readonly userIds: readonly string[];
};

export type TraceOrderState = { readonly status: OrderStatus; readonly deleted: boolean };

type PhaseRule = {
  readonly opens: ExecutionAction;
  readonly closes: ExecutionAction;
  readonly status: OrderStatus;
  /** Solo produccion: un `resume` es la unica senal de pausa del registro. */
  readonly discountsPauses: boolean;
};

const PHASE_RULES: Readonly<Record<ExecutionPhase, PhaseRule>> = {
  production: { opens: 'start', closes: 'finish', status: 'EN_CURSO', discountsPauses: true },
  packing: { opens: 'pack_start', closes: 'pack_finish', status: 'EN_EMPAQUE', discountsPauses: false },
  conditioning: {
    opens: 'conditioning_start',
    closes: 'conditioning_finish',
    status: 'EN_ACONDICIONAMIENTO',
    discountsPauses: false,
  },
};

/** Las fases que un `cancel` puede cerrar; el acondicionamiento solo se cierra al terminar. */
const CANCELLABLE_PHASES: readonly ExecutionPhase[] = ['production', 'packing'];

const PHASE_OF_ACTION: Readonly<Record<Exclude<ExecutionAction, 'cancel'>, ExecutionPhase>> = {
  start: 'production',
  resume: 'production',
  advance: 'production',
  go_back: 'production',
  finish: 'production',
  pack_start: 'packing',
  pack_finish: 'packing',
  conditioning_start: 'conditioning',
  conditioning_batch_save: 'conditioning',
  conditioning_finish: 'conditioning',
  conditioning_step_advance: 'conditioning',
  conditioning_steps_complete: 'conditioning',
  conditioning_responsibles_change: 'conditioning',
};

/** Un `cancel` hereda la fase de la anotacion que lo precede; el primero de todos no tiene fase. */
function phasesOf(entries: readonly ExecutionEntryRecord[]): readonly (ExecutionPhase | null)[] {
  const phases: (ExecutionPhase | null)[] = [];
  for (const entry of entries) {
    phases.push(entry.action === 'cancel' ? (phases[phases.length - 1] ?? null) : PHASE_OF_ACTION[entry.action]);
  }
  return phases;
}

function measurePhase(
  phase: ExecutionPhase,
  entries: readonly ExecutionEntryRecord[],
  phases: readonly (ExecutionPhase | null)[],
  order: TraceOrderState,
  now: Date,
): TraceDuration | null {
  const rule = PHASE_RULES[phase];
  const openIndex = entries.findIndex((entry) => entry.action === rule.opens);
  const opening = entries[openIndex];
  if (opening === undefined) return null;
  const openAt = opening.occurredAt.getTime();

  const closesPhase = (entry: ExecutionEntryRecord, index: number): boolean =>
    index > openIndex &&
    (entry.action === rule.closes ||
      (entry.action === 'cancel' && phases[index] === phase && CANCELLABLE_PHASES.includes(phase)));
  const closing = entries.find(closesPhase);

  let kind: TraceDuration['kind'];
  let endAt: number;
  if (closing !== undefined) {
    kind = 'closed';
    endAt = closing.occurredAt.getTime();
  } else if (!order.deleted && order.status === rule.status) {
    kind = 'open';
    endAt = now.getTime();
  } else {
    kind = 'unclosed';
    endAt = openAt;
    entries.forEach((entry, index) => {
      if (index >= openIndex && phases[index] === phase) endAt = Math.max(endAt, entry.occurredAt.getTime());
    });
  }

  let pauses = 0;
  if (rule.discountsPauses) {
    entries.forEach((entry, index) => {
      const previous = entries[index - 1];
      const at = entry.occurredAt.getTime();
      if (entry.action !== 'resume' || previous === undefined || index <= openIndex || at > endAt) return;
      pauses += at - previous.occurredAt.getTime();
    });
  }

  return { kind, ms: Math.max(0, endAt - openAt - pauses) };
}

/** `open` gana a `unclosed`, y `unclosed` a `closed`. Una fase `null` suma 0. */
function sumDurations(durations: TraceDurations): TraceDuration {
  const present = [durations.production, durations.packing, durations.conditioning].filter(
    (duration): duration is TraceDuration => duration !== null,
  );
  const ms = present.reduce((sum, duration) => sum + duration.ms, 0);
  if (present.some((duration) => duration.kind === 'open')) return { kind: 'open', ms };
  if (present.some((duration) => duration.kind === 'unclosed')) return { kind: 'unclosed', ms };
  return { kind: 'closed', ms };
}

/**
 * Recorrido de UN pedido a partir de sus anotaciones ya ordenadas (al menos una). `now` entra por
 * parametro porque el dominio no tiene reloj.
 */
export function buildExecutionTrace(
  entries: readonly ExecutionEntryRecord[],
  order: TraceOrderState,
  now: Date,
): ExecutionTrace {
  const first = entries[0];
  const last = entries[entries.length - 1];
  if (first === undefined || last === undefined) {
    throw new Error('buildExecutionTrace necesita al menos una anotacion');
  }

  const steps: TraceStep[] = entries.map((entry, index) => {
    const next = entries[index + 1];
    return {
      ...entry,
      gapToNextMs: next === undefined ? null : next.occurredAt.getTime() - entry.occurredAt.getTime(),
      isGoBack: entry.action === 'go_back',
    };
  });

  const phases = phasesOf(entries);
  const durations: TraceDurations = {
    production: measurePhase('production', entries, phases, order, now),
    packing: measurePhase('packing', entries, phases, order, now),
    conditioning: measurePhase('conditioning', entries, phases, order, now),
  };

  const userIds: string[] = [];
  for (const entry of entries) {
    if (!userIds.includes(entry.userId)) userIds.push(entry.userId);
  }

  return {
    steps,
    firstAt: first.occurredAt,
    lastAt: last.occurredAt,
    active: !order.deleted && !FINAL_STATUSES.includes(order.status),
    durations,
    totalDuration: sumDurations(durations),
    goBackCount: steps.filter((step) => step.isGoBack).length,
    userIds,
  };
}
