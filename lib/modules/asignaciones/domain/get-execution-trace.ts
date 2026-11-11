import { z } from 'zod';

import { requirePermission, type Actor } from './actor';
import { OrderNotFoundError } from './errors';
import { buildExecutionTrace, combineDurations, type TraceDuration, type TraceStep } from './execution-trace';
import {
  entriesSpan,
  findPeopleByIds,
  groupEntriesByLine,
  isOrderActive,
  listConditioningTeams,
  listOrderContents,
  NO_PROGRESS,
  recipesInOrder,
  signerIds,
  toTracePresentations,
  toTraceTeamMember,
  type ExecutionTracePresentation,
  type ListExecutionTracesDeps,
} from './list-execution-traces';
import { unitLabelOf } from './order-distribution-view';

import type {
  ConditioningAction,
  ConditioningBatchSnapshotLine,
  ConditioningStepCompletingAction,
  ExecutionTraceTeamMember,
  TraceDurations,
} from './conditioning-trace';
import type { ExecutionAction } from './execution-entry';
import type { ConditioningTeamMemberRow } from '../ports/conditioning-team-repository';
import type { PersonRef } from '@/lib/modules/identity';
import {
  formatOrderNumber,
  ORDER_STATUS_VALUES,
  type OrderLineStatus,
  type OrderProgress,
  type OrderStatus,
} from '@/lib/modules/pedidos';
import type { UnitCatalog } from '@/lib/modules/unidades';

const getExecutionTraceSchema = z.strictObject({ orderId: z.string().uuid() });

/** `displayName` `null` si el directorio ya no devuelve a esa persona. */
export type TracePerson = { readonly userId: string; readonly displayName: string | null };

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
    })
  | (DetailStepBase & {
      readonly action: ConditioningStepCompletingAction;
      readonly stepPosition: number;
      readonly reason: null;
      /** Vacio si el paso no pide asignacion. */
      readonly responsibles: readonly TracePerson[];
    })
  | (DetailStepBase & {
      readonly action: 'conditioning_responsibles_change';
      readonly stepPosition: number;
      readonly reason: null;
      /** Los vigentes en esa posicion justo antes del cambio. */
      readonly previous: readonly TracePerson[];
      readonly responsibles: readonly TracePerson[];
    });

/** Una receta del pedido con su propio recorrido: nada de otra receta entra aqui. */
export type ExecutionTraceRecipe = {
  readonly lineId: string;
  /** `null` = la receta no vuelve del catalogo. */
  readonly recipeName: string | null;
  readonly status: OrderLineStatus;
  readonly quantity: string;
  readonly unitLabel: string | null;
  readonly presentations: readonly ExecutionTracePresentation[];
  readonly steps: readonly ExecutionTraceDetailStep[];
  readonly durations: TraceDurations;
  readonly totalDuration: TraceDuration;
  readonly goBackCount: number;
};

export type ExecutionTraceDetail = {
  readonly orderId: string;
  readonly numberText: string;
  readonly status: OrderStatus;
  readonly deleted: boolean;
  readonly active: boolean;
  /** Cuenta todas las recetas vivas, tambien las que no tienen seccion. */
  readonly progress: OrderProgress;
  /** La suma de las secciones: abierta si alguna lo esta. */
  readonly totalDuration: TraceDuration;
  readonly firstAt: Date;
  readonly lastAt: Date;
  /** En orden de alta; solo las recetas con al menos una anotacion. */
  readonly recipes: readonly ExecutionTraceRecipe[];
};

export type GetExecutionTraceDeps = ListExecutionTracesDeps & {
  readonly units: Pick<UnitCatalog, 'findRefs'>;
};

function toTracePeople(userIds: readonly string[], refs: ReadonlyMap<string, PersonRef>): readonly TracePerson[] {
  return userIds.map((userId) => ({ userId, displayName: refs.get(userId)?.displayName ?? null }));
}

function conditioningStepPosition(step: TraceStep): number {
  if (step.stepPosition === null) throw new Error(`La anotacion ${step.id} (${step.action}) no tiene paso`);
  return step.stepPosition;
}

/**
 * El cambio de responsables solo guarda el conjunto nuevo: el anterior se reconstruye recorriendo
 * las anotaciones en orden, de ahi que el mapa de vigentes se arrastre de un paso al siguiente.
 */
function toDetailStep(
  step: TraceStep,
  refs: ReadonlyMap<string, PersonRef>,
  team: readonly ConditioningTeamMemberRow[],
  currentResponsibles: Map<number, readonly string[]>,
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
    case 'conditioning_steps_complete': {
      const stepPosition = conditioningStepPosition(step);
      const responsibleUserIds = step.responsibleUserIds ?? [];
      currentResponsibles.set(stepPosition, responsibleUserIds);
      return {
        ...base,
        action: step.action,
        stepPosition,
        reason: null,
        responsibles: toTracePeople(responsibleUserIds, refs),
      };
    }
    case 'conditioning_responsibles_change': {
      const stepPosition = conditioningStepPosition(step);
      if (step.responsibleUserIds === null) throw new Error(`La anotacion ${step.id} no tiene los responsables nuevos`);
      const previous = currentResponsibles.get(stepPosition) ?? [];
      currentResponsibles.set(stepPosition, step.responsibleUserIds);
      return {
        ...base,
        action: step.action,
        stepPosition,
        reason: null,
        previous: toTracePeople(previous, refs),
        responsibles: toTracePeople(step.responsibleUserIds, refs),
      };
    }
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

    const [teams, contents] = await Promise.all([
      listConditioningTeams(deps.team, companyId, entries),
      listOrderContents(deps, companyId, [orderId]),
    ]);
    const outline = contents.outlines.get(orderId);
    const byLine = groupEntriesByLine(entries);
    // Las recetas del pedido son las del outline: de uno dado de baja, las que tenia al darse de baja.
    const sections = recipesInOrder(outline).flatMap((recipe) => {
      const lineEntries = byLine.get(recipe.lineId);
      if (lineEntries === undefined) return [];
      return [
        {
          recipe,
          team: teams.get(recipe.lineId) ?? [],
          trace: buildExecutionTrace(lineEntries, { status: recipe.status, deleted: order.deleted }, now),
        },
      ];
    });

    const unitIds = [
      ...new Set(sections.map(({ recipe }) => recipe.unitId).filter((id): id is string => id !== null)),
    ];
    const [units, refs] = await Promise.all([
      unitIds.length === 0 ? [] : deps.units.findRefs(unitIds, companyId),
      findPeopleByIds(
        deps.people,
        companyId,
        [
          ...new Set([
            ...signerIds(entries),
            ...sections.flatMap(({ team }) => team.map((member) => member.userId)),
            ...entries.flatMap((entry) => entry.responsibleUserIds ?? []),
          ]),
        ],
        now,
      ),
    ]);
    const unitLabels = new Map(units.map((unit) => [unit.id, unitLabelOf(unit)]));

    const recipes = sections.map(({ recipe, team, trace }): ExecutionTraceRecipe => {
      // Los responsables vigentes se arrastran dentro de la receta, nunca de una a otra.
      const currentResponsibles = new Map<number, readonly string[]>();
      return {
        lineId: recipe.lineId,
        recipeName: contents.recipes.get(recipe.recipeId)?.name ?? null,
        status: recipe.status,
        quantity: recipe.quantity,
        unitLabel: recipe.unitId === null ? null : unitLabels.get(recipe.unitId) ?? null,
        presentations: toTracePresentations(recipe.presentationLines, contents.presentationNames),
        steps: trace.steps.map((step) => toDetailStep(step, refs, team, currentResponsibles)),
        durations: trace.durations,
        totalDuration: trace.totalDuration,
        goBackCount: trace.goBackCount,
      };
    });

    return {
      orderId: order.id,
      numberText: formatOrderNumber(order.number),
      status: order.status,
      deleted: order.deleted,
      active: isOrderActive(order),
      progress: outline?.progress ?? NO_PROGRESS,
      totalDuration: combineDurations(recipes.map((recipe) => recipe.totalDuration)),
      ...entriesSpan(entries),
      recipes,
    };
  };
}
