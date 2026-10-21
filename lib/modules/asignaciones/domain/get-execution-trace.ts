import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { OrderNotFoundError } from './errors';
import { buildExecutionTrace, type TraceStep } from './execution-trace';
import {
  findPeopleByIds,
  listConditioningTeams,
  toTraceTeamMember,
  type ListExecutionTracesDeps,
} from './list-execution-traces';

import type {
  ConditioningAction,
  ConditioningBatchSnapshotLine,
  ExecutionTraceTeamMember,
  TraceDurations,
} from './conditioning-trace';
import type { ExecutionAction } from './execution-entry';
import type { ConditioningTeamMemberRow } from '../ports/conditioning-team-repository';
import type { PersonRef } from '@/lib/modules/identity';
import { formatOrderNumber, ORDER_STATUS_VALUES, type OrderStatus } from '@/lib/modules/pedidos';

const getExecutionTraceSchema = z.strictObject({ orderId: z.string().uuid() });

type DetailStepBase = {
  readonly id: string;
  readonly orderId: string;
  /** Quien firma: en `conditioning_start` es el supervisor; en `conditioning_batch_save`, quien guardo. */
  readonly userId: string;
  /** `null` si el directorio ya no devuelve a esa persona. */
  readonly userDisplayName: string | null;
  readonly occurredAt: Date;
  readonly gapToNextMs: number | null;
  readonly isGoBack: boolean;
};

export type ExecutionTraceDetailStep =
  | (DetailStepBase & {
      readonly action: Exclude<ExecutionAction, ConditioningAction>;
      readonly stepPosition: number | null;
      readonly reason: string | null;
    })
  | (DetailStepBase & {
      readonly action: 'conditioning_start';
      readonly stepPosition: null;
      readonly reason: null;
      /** En orden de composicion; vacio si se comenzo sin equipo. */
      readonly team: readonly ExecutionTraceTeamMember[];
    })
  | (DetailStepBase & {
      readonly action: 'conditioning_batch_save';
      readonly stepPosition: null;
      readonly reason: null;
      /** La foto, en el orden en que se enviaron las lineas. */
      readonly lines: readonly ConditioningBatchSnapshotLine[];
    })
  | (DetailStepBase & {
      readonly action: 'conditioning_finish';
      readonly stepPosition: null;
      readonly reason: null;
    });

export type ExecutionTraceDetail = {
  readonly orderId: string;
  readonly numberText: string;
  readonly status: OrderStatus;
  readonly deleted: boolean;
  readonly active: boolean;
  readonly steps: readonly ExecutionTraceDetailStep[];
  readonly firstAt: Date;
  readonly lastAt: Date;
  readonly durations: TraceDurations;
  readonly goBackCount: number;
};

/** El detalle no pinta receta ni reparto: sin los catalogos que solo usa la lista. */
export type GetExecutionTraceDeps = Omit<ListExecutionTracesDeps, 'recipes' | 'presentations'>;

function toDetailStep(
  step: TraceStep,
  refs: ReadonlyMap<string, PersonRef>,
  team: readonly ConditioningTeamMemberRow[],
): ExecutionTraceDetailStep {
  const base: DetailStepBase = {
    id: step.id,
    orderId: step.orderId,
    userId: step.userId,
    userDisplayName: refs.get(step.userId)?.displayName ?? null,
    occurredAt: step.occurredAt,
    gapToNextMs: step.gapToNextMs,
    isGoBack: step.isGoBack,
  };
  switch (step.action) {
    case 'conditioning_start':
      return {
        ...base,
        action: step.action,
        stepPosition: null,
        reason: null,
        team: team.map((member) => toTraceTeamMember(member, refs)),
      };
    case 'conditioning_batch_save':
      if (step.batchLines === null) throw new Error(`La anotacion ${step.id} no tiene la foto del guardado`);
      return { ...base, action: step.action, stepPosition: null, reason: null, lines: step.batchLines };
    case 'conditioning_finish':
      return { ...base, action: step.action, stepPosition: null, reason: null };
    case 'conditioning_step_advance':
    case 'conditioning_steps_complete':
    case 'conditioning_responsibles_change':
      throw new Error(`El recorrido no sabe pintar la anotacion ${step.id} (${step.action})`);
    default:
      return { ...base, action: step.action, stepPosition: step.stepPosition, reason: step.reason };
  }
}

export function createGetExecutionTrace(
  deps: GetExecutionTraceDeps,
): (actor: Actor | null | undefined, input: unknown, now: Date) => Promise<ExecutionTraceDetail> {
  return async function getExecutionTrace(
    actor: Actor | null | undefined,
    input: unknown,
    now: Date,
  ): Promise<ExecutionTraceDetail> {
    // Autorizar va antes de validar la entrada y antes de tocar ningun puerto.
    requirePermission(actor, 'dashboard.consultar');

    // Un id mal formado, uno que no existe, uno de otra empresa y uno sin anotaciones dan el mismo
    // error: la pantalla no puede distinguirlos.
    const parsed = getExecutionTraceSchema.safeParse(input);
    if (!parsed.success) throw new OrderNotFoundError();
    const { orderId } = parsed.data;
    const companyId = actor.companyId;

    const summaries = await deps.orders.listSummariesByIdsIncludingDeleted(
      companyId,
      [orderId],
      ORDER_STATUS_VALUES,
      1,
      1,
    );
    const order = summaries.items.find((item) => item.id === orderId);
    if (order === undefined) throw new OrderNotFoundError();

    const entries = await deps.log.listEntriesForOrders(companyId, [orderId]);
    if (entries.length === 0) throw new OrderNotFoundError();

    const trace = buildExecutionTrace(entries, order, now);
    const teams = await listConditioningTeams(deps.team, companyId, new Map([[orderId, entries]]));
    const team = teams.get(orderId) ?? [];
    const refs = await findPeopleByIds(
      deps.people,
      companyId,
      [...new Set([...trace.userIds, ...team.map((member) => member.userId)])],
      now,
    );

    return {
      orderId: order.id,
      numberText: formatOrderNumber(order.number),
      status: order.status,
      deleted: order.deleted,
      active: trace.active,
      steps: trace.steps.map((step) => toDetailStep(step, refs, team)),
      firstAt: trace.firstAt,
      lastAt: trace.lastAt,
      durations: trace.durations,
      goBackCount: trace.goBackCount,
    };
  };
}
