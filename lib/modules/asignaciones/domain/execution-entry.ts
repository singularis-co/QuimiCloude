import type {
  ConditioningAction,
  ConditioningBatchSnapshotLine,
  ConditioningStepCompletingAction,
} from './conditioning-trace';

export const EXECUTION_ACTIONS = [
  'start',
  'resume',
  'advance',
  'go_back',
  'cancel',
  'finish',
  'pack_start',
  'pack_finish',
  'conditioning_start',
  'conditioning_batch_save',
  'conditioning_finish',
  'conditioning_step_advance',
  'conditioning_steps_complete',
  'conditioning_responsibles_change',
] as const;

export type ExecutionAction = (typeof EXECUTION_ACTIONS)[number];

type PackingAction = 'pack_start' | 'pack_finish';

type StepAction = Exclude<ExecutionAction, 'cancel' | PackingAction | ConditioningAction>;

type Base = {
  readonly companyId: string;
  readonly orderId: string;
  readonly userId: string;
  readonly occurredAt: Date;
};

/** Comenzar, Terminar y el guardado de lote del acondicionamiento van sin posicion; sus pasos, con ella. */
export type NewExecutionEntry =
  | (Base & { readonly action: StepAction; readonly stepPosition: number | null })
  | (Base & { readonly action: 'cancel'; readonly stepPosition: number | null; readonly reason: string })
  | (Base & { readonly action: PackingAction; readonly stepPosition: null })
  | (Base & { readonly action: 'conditioning_start' | 'conditioning_finish'; readonly stepPosition: null })
  | (Base & {
      readonly action: 'conditioning_batch_save';
      readonly stepPosition: null;
      readonly batchLines: readonly ConditioningBatchSnapshotLine[];
    })
  | (Base & {
      readonly action: ConditioningStepCompletingAction;
      readonly stepPosition: number;
      readonly responsibleUserIds: readonly string[] | null;
    })
  | (Base & {
      readonly action: 'conditioning_responsibles_change';
      readonly stepPosition: number;
      readonly responsibleUserIds: readonly string[];
    });

/** Una anotacion leida del registro. `id` desempata dos anotaciones con el mismo instante. */
export type ExecutionEntryRecord = {
  readonly id: string;
  readonly orderId: string;
  readonly userId: string;
  readonly action: ExecutionAction;
  readonly stepPosition: number | null;
  readonly reason: string | null;
  /** No nulo solo en `conditioning_batch_save`. */
  readonly batchLines: readonly ConditioningBatchSnapshotLine[] | null;
  /** Solo en las anotaciones de paso de acondicionamiento; siempre en el cambio de responsables. */
  readonly responsibleUserIds: readonly string[] | null;
  readonly occurredAt: Date;
};

/** `step_already_completed`: otra escritura ya completo ese paso de acondicionamiento. */
export type ExecutionAppendOutcome = 'ok' | 'step_already_completed';

/** Lo que devuelven las escrituras de `pedidos` que corren dentro de la transaccion de ejecucion. */
export type ExecutionWriteOutcome = string | { readonly kind: string };

type ExecutionSuccess = 'ok' | { readonly kind: 'ok' };

/**
 * Unico criterio de exito para las escrituras dentro de la transaccion: Terminar empaque devuelve
 * un objeto, y comparar contra el literal `'ok'` abortaria ese exito.
 */
export function isExecutionSuccess<T extends ExecutionWriteOutcome>(
  outcome: T,
): outcome is Extract<T, ExecutionSuccess> {
  return typeof outcome === 'string' ? outcome === 'ok' : outcome.kind === 'ok';
}

/**
 * Se lanza dentro de la transaccion ante un desenlace que no es exito, para que se deshaga lo
 * que `pedidos` ya hubiera escrito; quien abrio la transaccion la atrapa al salir y la traduce.
 */
export class ExecutionAbortedError extends Error {
  constructor(readonly outcome: ExecutionWriteOutcome) {
    super(
      `desenlace '${typeof outcome === 'string' ? outcome : outcome.kind}' aborto la transaccion de ejecucion`,
    );
    this.name = 'ExecutionAbortedError';
  }
}
