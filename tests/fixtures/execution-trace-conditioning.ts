// Recorridos con acondicionamiento para los tests de UI. Los datos son los del tablero
// `docs/diseno/canvas/RecorridoAcondicionamiento.dc.html` (variantes `terminado`, `en_curso` y
// `anterior`) y `DashboardAcondicionamiento.dc.html`.
import type {
  ConditioningBatchSnapshotLine,
  ExecutionTraceDetail,
  ExecutionTraceDetailStep,
  ExecutionTraceRow,
  ExecutionTraceTeamMember,
} from '@/lib/modules/asignaciones';

const S = 1000;
const MIN = 60 * S;
const H = 60 * MIN;

export const CONDITIONING_DURATION_MS = {
  production: 2 * H + 53 * MIN,
  packing: 28 * MIN + 12 * S,
  conditioningClosed: 2 * H + 8 * MIN,
  conditioningOpen: H + 12 * MIN,
} as const;

export const TRACE_PEOPLE = {
  laura: { userId: 'f0000000-0000-4000-8000-0000000000a1', displayName: 'Laura Gómez' },
  mateo: { userId: 'f0000000-0000-4000-8000-0000000000a2', displayName: 'Mateo Sánchez' },
  valentina: { userId: 'f0000000-0000-4000-8000-0000000000a3', displayName: 'Valentina Herrera' },
  santiago: { userId: 'f0000000-0000-4000-8000-0000000000a4', displayName: 'Santiago Vargas' },
  camila: { userId: 'f0000000-0000-4000-8000-0000000000a5', displayName: 'Camila Ríos' },
} as const;

const WORK_GROUP_ID = 'f1000000-0000-4000-8000-000000000001';
export const WORK_GROUP_NAME = 'Turno mañana';

export const MIXED_TEAM: readonly ExecutionTraceTeamMember[] = [
  {
    ...TRACE_PEOPLE.laura,
    origin: { kind: 'workGroup', workGroupId: WORK_GROUP_ID, workGroupName: WORK_GROUP_NAME },
  },
  {
    ...TRACE_PEOPLE.mateo,
    origin: { kind: 'workGroup', workGroupId: WORK_GROUP_ID, workGroupName: WORK_GROUP_NAME },
  },
  { ...TRACE_PEOPLE.valentina, origin: { kind: 'direct' } },
];

const PRESENTATION_GALLON = 'f2000000-0000-4000-8000-000000000001';
const PRESENTATION_LITER = 'f2000000-0000-4000-8000-000000000002';

function line(
  batchSuffix: string,
  lot: string,
  presentationId: string,
  presentationName: string | null,
): ConditioningBatchSnapshotLine {
  return {
    batchId: `f3000000-0000-4000-8000-00000000000${batchSuffix}`,
    presentationId,
    presentationName,
    lot,
    expiryDate: '2028-10-02',
    productionDate: '2026-10-02',
  };
}

export const FIRST_SAVE_LINES: readonly ConditioningBatchSnapshotLine[] = [
  line('1', 'L-0000', PRESENTATION_GALLON, 'Galón 3,78 L'),
  line('2', 'L-0001', PRESENTATION_LITER, 'Litro 1 L'),
];

/** La corrección: un guardado completo nuevo, con una presentación que el catálogo no devolvió. */
export const CORRECTION_SAVE_LINES: readonly ConditioningBatchSnapshotLine[] = [
  line('3', 'L-0002', PRESENTATION_GALLON, 'Galón 3,78 L'),
  line('2', 'L-0001', PRESENTATION_LITER, null),
];

const IN_PROGRESS_SAVE_LINES: readonly ConditioningBatchSnapshotLine[] = [
  line('4', 'L-0000', PRESENTATION_GALLON, 'Galón 3,78 L'),
];

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type StepDraft = DistributiveOmit<ExecutionTraceDetailStep, 'id' | 'orderId' | 'gapToNextMs'>;

type ProductionAction = Exclude<
  ExecutionTraceDetailStep['action'],
  'conditioning_start' | 'conditioning_batch_save' | 'conditioning_finish'
>;

function at(time: string): Date {
  return new Date(`2026-10-02T${time}:00.000Z`);
}

function base(person: { readonly userId: string; readonly displayName: string }, time: string) {
  return { userId: person.userId, userDisplayName: person.displayName, occurredAt: at(time), isGoBack: false };
}

function production(
  action: ProductionAction,
  stepPosition: number,
  person: { readonly userId: string; readonly displayName: string },
  time: string,
): StepDraft {
  return { ...base(person, time), action, stepPosition, reason: null, isGoBack: action === 'go_back' };
}

const PRODUCTION_AND_PACKING: readonly StepDraft[] = [
  production('start', 1, TRACE_PEOPLE.laura, '08:12'),
  production('advance', 2, TRACE_PEOPLE.laura, '08:40'),
  production('advance', 3, TRACE_PEOPLE.mateo, '09:15'),
  production('go_back', 2, TRACE_PEOPLE.mateo, '09:31'),
  production('resume', 2, TRACE_PEOPLE.laura, '10:02'),
  production('advance', 6, TRACE_PEOPLE.laura, '10:48'),
  production('finish', 6, TRACE_PEOPLE.laura, '11:05'),
  production('pack_start', 1, TRACE_PEOPLE.mateo, '11:12'),
  production('pack_finish', 2, TRACE_PEOPLE.mateo, '11:40'),
];

function conditioningStart(
  time: string,
  team: readonly ExecutionTraceTeamMember[],
): StepDraft {
  return { ...base(TRACE_PEOPLE.santiago, time), action: 'conditioning_start', stepPosition: null, reason: null, team };
}

function conditioningSave(time: string, lines: readonly ConditioningBatchSnapshotLine[]): StepDraft {
  return {
    ...base(TRACE_PEOPLE.santiago, time),
    action: 'conditioning_batch_save',
    stepPosition: null,
    reason: null,
    lines,
  };
}

function conditioningFinish(time: string): StepDraft {
  return { ...base(TRACE_PEOPLE.santiago, time), action: 'conditioning_finish', stepPosition: null, reason: null };
}

function withIds(orderId: string, drafts: readonly StepDraft[]): ExecutionTraceDetailStep[] {
  return drafts.map((draft, index) => {
    const next = drafts[index + 1];
    return {
      ...draft,
      id: `${orderId}-e${index + 1}`,
      orderId,
      gapToNextMs: next === undefined ? null : next.occurredAt.getTime() - draft.occurredAt.getTime(),
    };
  });
}

export const FINISHED_ORDER_ID = 'f4000000-0000-4000-8000-000000000006';
export const IN_PROGRESS_ORDER_ID = 'f4000000-0000-4000-8000-000000000003';
export const PREVIOUS_ORDER_ID = 'f4000000-0000-4000-8000-000000000002';
export const UNCLOSED_ORDER_ID = 'f4000000-0000-4000-8000-000000000008';

/** Variante `terminado`: producción, empaque y acondicionamiento cerrados; equipo mixto y dos guardados. */
export const FINISHED_CONDITIONING_TRACE: ExecutionTraceDetail = {
  orderId: FINISHED_ORDER_ID,
  numberText: '2026-0000006',
  status: 'TERMINADO',
  deleted: false,
  active: false,
  steps: withIds(FINISHED_ORDER_ID, [
    ...PRODUCTION_AND_PACKING,
    conditioningStart('13:02', MIXED_TEAM),
    conditioningSave('13:40', FIRST_SAVE_LINES),
    conditioningSave('14:26', CORRECTION_SAVE_LINES),
    conditioningFinish('15:10'),
  ]),
  firstAt: at('08:12'),
  lastAt: at('15:10'),
  durations: {
    production: { kind: 'closed', ms: CONDITIONING_DURATION_MS.production },
    packing: { kind: 'closed', ms: CONDITIONING_DURATION_MS.packing },
    conditioning: { kind: 'closed', ms: CONDITIONING_DURATION_MS.conditioningClosed },
  },
  goBackCount: 1,
};

/** Variante `en_curso`: Comenzar sin equipo y la fase de acondicionamiento abierta. */
export const IN_PROGRESS_CONDITIONING_TRACE: ExecutionTraceDetail = {
  orderId: IN_PROGRESS_ORDER_ID,
  numberText: '2026-0000003',
  status: 'EN_ACONDICIONAMIENTO',
  deleted: false,
  active: true,
  steps: withIds(IN_PROGRESS_ORDER_ID, [
    ...PRODUCTION_AND_PACKING,
    conditioningStart('13:20', []),
    conditioningSave('13:45', IN_PROGRESS_SAVE_LINES),
  ]),
  firstAt: at('08:12'),
  lastAt: at('13:45'),
  durations: {
    production: { kind: 'closed', ms: CONDITIONING_DURATION_MS.production },
    packing: { kind: 'closed', ms: CONDITIONING_DURATION_MS.packing },
    conditioning: { kind: 'open', ms: CONDITIONING_DURATION_MS.conditioningOpen },
  },
  goBackCount: 1,
};

/** Variante `anterior`: sin Comenzar anotado, así que no hay duración de acondicionamiento. */
export const PREVIOUS_CONDITIONING_TRACE: ExecutionTraceDetail = {
  orderId: PREVIOUS_ORDER_ID,
  numberText: '2026-0000002',
  status: 'TERMINADO',
  deleted: false,
  active: false,
  steps: withIds(PREVIOUS_ORDER_ID, PRODUCTION_AND_PACKING),
  firstAt: at('08:12'),
  lastAt: at('11:40'),
  durations: {
    production: { kind: 'closed', ms: CONDITIONING_DURATION_MS.production },
    packing: { kind: 'closed', ms: CONDITIONING_DURATION_MS.packing },
    conditioning: null,
  },
  goBackCount: 1,
};

/** Dado de baja a mitad del acondicionamiento: la fase queda sin cierre anotado. */
export const UNCLOSED_CONDITIONING_TRACE: ExecutionTraceDetail = {
  ...IN_PROGRESS_CONDITIONING_TRACE,
  orderId: UNCLOSED_ORDER_ID,
  numberText: '2026-0000008',
  deleted: true,
  active: false,
  steps: withIds(UNCLOSED_ORDER_ID, [
    ...PRODUCTION_AND_PACKING,
    conditioningStart('13:20', []),
    conditioningSave('13:45', IN_PROGRESS_SAVE_LINES),
  ]),
  durations: {
    production: { kind: 'closed', ms: CONDITIONING_DURATION_MS.production },
    packing: { kind: 'closed', ms: CONDITIONING_DURATION_MS.packing },
    conditioning: { kind: 'unclosed', ms: 25 * MIN },
  },
};

function row(overrides: Partial<ExecutionTraceRow> & Pick<ExecutionTraceRow, 'orderId' | 'numberText'>): ExecutionTraceRow {
  return {
    status: 'TERMINADO',
    deleted: false,
    active: false,
    people: [TRACE_PEOPLE.laura],
    firstAt: at('08:12'),
    lastAt: at('15:10'),
    totalDuration: { kind: 'closed', ms: 0 },
    goBackCount: 0,
    ...overrides,
  };
}

/** Total abierto: 4 h 33 min y 12 s, que la lista trunca a 4 h 33 min. */
export const OPEN_TOTAL_ROW = row({
  orderId: IN_PROGRESS_ORDER_ID,
  numberText: '2026-0000003',
  status: 'EN_ACONDICIONAMIENTO',
  active: true,
  people: [TRACE_PEOPLE.laura, TRACE_PEOPLE.mateo, TRACE_PEOPLE.santiago],
  lastAt: at('13:45'),
  totalDuration: { kind: 'open', ms: 4 * H + 33 * MIN + 12 * S },
  goBackCount: 1,
});

/** Total cerrado con más de tres personas: firmantes y después el equipo. */
export const CLOSED_TOTAL_ROW = row({
  orderId: FINISHED_ORDER_ID,
  numberText: '2026-0000006',
  people: [TRACE_PEOPLE.laura, TRACE_PEOPLE.mateo, TRACE_PEOPLE.santiago, TRACE_PEOPLE.valentina, TRACE_PEOPLE.camila],
  totalDuration: { kind: 'closed', ms: 5 * H + 29 * MIN + 12 * S },
  goBackCount: 1,
});

/** Dado de baja sin cierre: no lleva «En curso» aunque su estado no sea final. */
export const UNCLOSED_TOTAL_ROW = row({
  orderId: UNCLOSED_ORDER_ID,
  numberText: '2026-0000008',
  status: 'EN_ACONDICIONAMIENTO',
  deleted: true,
  people: [TRACE_PEOPLE.mateo, TRACE_PEOPLE.santiago],
  lastAt: at('13:45'),
  totalDuration: { kind: 'unclosed', ms: 3 * H + 46 * MIN + 59 * S },
  goBackCount: 1,
});

/** Pedido vivo con todas sus fases cerradas: lleva «En curso» por `active`, no por sus duraciones. */
export const ACTIVE_CLOSED_TOTAL_ROW = row({
  orderId: 'f4000000-0000-4000-8000-000000000004',
  numberText: '2026-0000004',
  status: 'POR_EMPACAR',
  active: true,
  people: [TRACE_PEOPLE.valentina],
  totalDuration: { kind: 'closed', ms: H + 47 * MIN },
});

export const CONDITIONING_TRACE_ROWS: readonly ExecutionTraceRow[] = [
  OPEN_TOTAL_ROW,
  CLOSED_TOTAL_ROW,
  UNCLOSED_TOTAL_ROW,
  ACTIVE_CLOSED_TOTAL_ROW,
];
