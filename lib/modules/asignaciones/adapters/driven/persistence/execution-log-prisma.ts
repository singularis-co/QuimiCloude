import type { OrderExecutionAction, Prisma, PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import { conditioningBatchSnapshotSchema, type ConditioningBatchSnapshotLine } from '../../../domain/conditioning-trace';
import type { ExecutionAction, ExecutionEntryRecord, NewExecutionEntry } from '../../../domain/execution-entry';
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
    async append(entry: NewExecutionEntry): Promise<void> {
      // Las demas acciones no mandan la columna: queda en NULL, como exige su CHECK.
      const snapshot =
        entry.action === 'conditioning_batch_save'
          ? { batchLines: conditioningBatchSnapshotSchema.parse(entry.batchLines) }
          : {};
      await db.orderExecutionEntry.create({
        data: {
          companyId: entry.companyId,
          orderId: entry.orderId,
          userId: entry.userId,
          action: EXECUTION_ACTION_TO_PRISMA[entry.action],
          stepPosition: entry.stepPosition,
          reason: entry.action === 'cancel' ? entry.reason : null,
          ...snapshot,
          // Explicito: la anotacion lleva el mismo instante que el resto de la operacion.
          occurredAt: entry.occurredAt,
        },
      });
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
          occurredAt: true,
        },
      });
      return rows.map((row) => ({
        ...row,
        action: EXECUTION_ACTION_FROM_PRISMA[row.action],
        batchLines: row.batchLines === null ? null : parseBatchLines(row.id, row.batchLines),
      }));
    },

    async listUserIdsWithEntries(companyId: string): Promise<readonly string[]> {
      const rows = await db.orderExecutionEntry.groupBy({ by: ['userId'], where: { companyId } });
      return rows.map((row) => row.userId);
    },
  };
}
