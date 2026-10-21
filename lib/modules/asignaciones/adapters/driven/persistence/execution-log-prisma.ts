import { Prisma, type OrderExecutionAction, type PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import {
  conditioningBatchSnapshotSchema,
  conditioningResponsiblesSchema,
  type ConditioningBatchSnapshotLine,
} from '../../../domain/conditioning-trace';
import type {
  ExecutionAction,
  ExecutionAppendOutcome,
  ExecutionEntryRecord,
  NewExecutionEntry,
} from '../../../domain/execution-entry';
import type { ExecutedOrdersFilter, ExecutionLogRepository } from '../../../ports/execution-log-repository';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export const EXECUTION_ACTION_TO_PRISMA = {
  start: 'START',
  resume: 'RESUME',
  advance: 'ADVANCE',
  go_back: 'GO_BACK',
  cancel: 'CANCEL',
  finish: 'FINISH',
  pack_start: 'PACK_START',
  pack_finish: 'PACK_FINISH',
  conditioning_start: 'CONDITIONING_START',
  conditioning_batch_save: 'CONDITIONING_BATCH_SAVE',
  conditioning_finish: 'CONDITIONING_FINISH',
  conditioning_step_advance: 'CONDITIONING_STEP_ADVANCE',
  conditioning_steps_complete: 'CONDITIONING_STEPS_COMPLETE',
  conditioning_responsibles_change: 'CONDITIONING_RESPONSIBLES_CHANGE',
} as const satisfies Record<ExecutionAction, OrderExecutionAction>;

function invertActionMap(): Readonly<Record<OrderExecutionAction, ExecutionAction>> {
  const inverse: Partial<Record<OrderExecutionAction, ExecutionAction>> = {};
  for (const [action, value] of Object.entries(EXECUTION_ACTION_TO_PRISMA) as [
    ExecutionAction,
    OrderExecutionAction,
  ][]) {
    inverse[value] = action;
  }
  return inverse as Record<OrderExecutionAction, ExecutionAction>;
}

export const EXECUTION_ACTION_FROM_PRISMA = invertActionMap();

function parseBatchLines(entryId: string, value: Prisma.JsonValue): readonly ConditioningBatchSnapshotLine[] {
  const parsed = conditioningBatchSnapshotSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`la foto de lote de la anotacion ${entryId} no tiene la forma esperada: ${parsed.error.message}`);
  }
  return parsed.data;
}

function parseResponsibles(entryId: string, value: Prisma.JsonValue): readonly string[] {
  const parsed = conditioningResponsiblesSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`los responsables de la anotacion ${entryId} no tienen la forma esperada: ${parsed.error.message}`);
  }
  return parsed.data;
}

// En un indice parcial, `meta.target` puede traer las columnas o el nombre del indice: se aceptan
// las dos. Es el unico indice unico de la tabla que nombra `step_position`.
const CONDITIONING_STEP_ONCE_MARKERS = ['order_execution_entries_conditioning_step_once', 'step_position'] as const;

function isConditioningStepOnceViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const target = error.meta?.target;
  const targets = typeof target === 'string' ? [target] : Array.isArray(target) ? target : [];
  return CONDITIONING_STEP_ONCE_MARKERS.some((marker) =>
    targets.some((item) => typeof item === 'string' && item.includes(marker)),
  );
}

type JsonColumns = Pick<Prisma.OrderExecutionEntryUncheckedCreateInput, 'batchLines' | 'responsibleUserIds'>;

function extraColumns(entry: NewExecutionEntry): JsonColumns {
  switch (entry.action) {
    case 'conditioning_batch_save':
      return { batchLines: conditioningBatchSnapshotSchema.parse(entry.batchLines) };
    case 'conditioning_step_advance':
    case 'conditioning_steps_complete':
    case 'conditioning_responsibles_change':
      return entry.responsibleUserIds === null
        ? {}
        : { responsibleUserIds: conditioningResponsiblesSchema.parse(entry.responsibleUserIds) };
    default:
      return {};
  }
}

/** Pedidos en cuyo equipo esta la persona y cuyo Comenzar anotado cae en el rango: sin esa anotacion
 *  no se sabe cuando trabajo, y no se reconstruye. */
async function listStartedOrderIdsOfTeamMember(
  db: PrismaLike,
  companyId: string,
  userId: string,
  inRange: Prisma.OrderExecutionEntryWhereInput,
): Promise<readonly string[]> {
  const memberships = await db.orderConditioningTeamMember.findMany({
    where: { companyId, userId },
    select: { orderId: true },
  });
  if (memberships.length === 0) return [];
  const rows = await db.orderExecutionEntry.groupBy({
    by: ['orderId'],
    where: {
      companyId,
      action: EXECUTION_ACTION_TO_PRISMA.conditioning_start,
      orderId: { in: memberships.map((member) => member.orderId) },
      ...inRange,
    },
  });
  return rows.map((row) => row.orderId);
}

/** Fabrica y no objeto ya construido: dentro de una transaccion tiene que escribir por su `tx`. */
export function createExecutionLogRepository(db: PrismaLike = prisma): ExecutionLogRepository {
  return {
    async append(entry: NewExecutionEntry): Promise<ExecutionAppendOutcome> {
      // Una columna que no se manda queda en NULL, como exigen los CHECK de las demas acciones.
      const extra = extraColumns(entry);
      try {
        await db.orderExecutionEntry.create({
          data: {
            companyId: entry.companyId,
            orderId: entry.orderId,
            userId: entry.userId,
            action: EXECUTION_ACTION_TO_PRISMA[entry.action],
            stepPosition: entry.stepPosition,
            reason: entry.action === 'cancel' ? entry.reason : null,
            ...extra,
            // Explicito: la anotacion lleva el mismo instante que el resto de la operacion.
            occurredAt: entry.occurredAt,
          },
        });
      } catch (error) {
        if (isConditioningStepOnceViolation(error)) return 'step_already_completed';
        throw error;
      }
      return 'ok';
    },

    async findLastStepPosition(companyId: string, orderId: string): Promise<number | null> {
      const row = await db.orderExecutionEntry.findFirst({
        where: { companyId, orderId, stepPosition: { not: null } },
        // `id` desempata dos anotaciones con el mismo instante.
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        select: { stepPosition: true },
      });
      return row?.stepPosition ?? null;
    },

    async listExecutedOrderIds(companyId: string, filter: ExecutedOrdersFilter): Promise<readonly string[]> {
      const occurredAt: Prisma.DateTimeFilter = {};
      if (filter.occurredFrom !== undefined) occurredAt.gte = filter.occurredFrom;
      if (filter.occurredBefore !== undefined) occurredAt.lt = filter.occurredBefore;
      const inRange: Prisma.OrderExecutionEntryWhereInput =
        Object.keys(occurredAt).length > 0 ? { occurredAt } : {};
      const where: Prisma.OrderExecutionEntryWhereInput = {
        companyId,
        ...(filter.userId === undefined ? {} : { userId: filter.userId }),
        ...inRange,
      };

      const [signed, asTeamMember] = await Promise.all([
        db.orderExecutionEntry.groupBy({ by: ['orderId'], where }),
        filter.userId === undefined ? [] : listStartedOrderIdsOfTeamMember(db, companyId, filter.userId, inRange),
      ]);
      return [...new Set([...signed.map((row) => row.orderId), ...asTeamMember])];
    },

    async listEntriesForOrders(
      companyId: string,
      orderIds: readonly string[],
    ): Promise<readonly ExecutionEntryRecord[]> {
      const rows = await db.orderExecutionEntry.findMany({
        where: { companyId, orderId: { in: [...orderIds] } },
        orderBy: [{ orderId: 'asc' }, { occurredAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          orderId: true,
          userId: true,
          action: true,
          stepPosition: true,
          reason: true,
          batchLines: true,
          responsibleUserIds: true,
          occurredAt: true,
        },
      });
      return rows.map((row) => ({
        ...row,
        action: EXECUTION_ACTION_FROM_PRISMA[row.action],
        batchLines: row.batchLines === null ? null : parseBatchLines(row.id, row.batchLines),
        responsibleUserIds:
          row.responsibleUserIds === null ? null : parseResponsibles(row.id, row.responsibleUserIds),
      }));
    },

    async listUserIdsWithEntries(companyId: string): Promise<readonly string[]> {
      const rows = await db.orderExecutionEntry.groupBy({ by: ['userId'], where: { companyId } });
      return rows.map((row) => row.userId);
    },
  };
}
