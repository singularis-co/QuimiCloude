import { Prisma, type EvidencePhase as DbEvidencePhase, type PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import { MAX_EVIDENCE_PER_STEP, type EvidencePhase } from '../../../domain/step-evidence';

import type {
  NewStepEvidence,
  StepEvidenceRepository,
  StepEvidenceRow,
} from '../../../ports/step-evidence-repository';

const TO_DB_PHASE: Readonly<Record<EvidencePhase, DbEvidencePhase>> = {
  manufacturing: 'MANUFACTURING',
  packing: 'PACKING',
};

const FROM_DB_PHASE: Readonly<Record<DbEvidencePhase, EvidencePhase>> = {
  MANUFACTURING: 'manufacturing',
  PACKING: 'packing',
};

const ROW_SELECT = {
  id: true,
  orderId: true,
  phase: true,
  stepPosition: true,
  slot: true,
  path: true,
} as const satisfies Prisma.OrderStepEvidenceSelect;

type DbRow = Prisma.OrderStepEvidenceGetPayload<{ select: typeof ROW_SELECT }>;

function toRow(row: DbRow): StepEvidenceRow {
  return {
    id: row.id,
    orderId: row.orderId,
    phase: FROM_DB_PHASE[row.phase],
    stepPosition: row.stepPosition,
    slot: row.slot,
    path: row.path,
  };
}

function firstFreeSlot(taken: readonly { readonly slot: number }[]): number | null {
  const used = new Set(taken.map((row) => row.slot));
  for (let slot = 1; slot <= MAX_EVIDENCE_PER_STEP; slot += 1) {
    if (!used.has(slot)) return slot;
  }
  return null;
}

/** Que indice unico salto: el del tope por paso es el unico que nombra `slot`, el de la ruta el
 *  unico que nombra `path`. */
function uniqueViolationOn(error: unknown, column: 'slot' | 'path'): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const target = error.meta?.target;
  const targets = typeof target === 'string' ? [target] : Array.isArray(target) ? target : [];
  return targets.some((item) => typeof item === 'string' && item.includes(column));
}

function createData(row: NewStepEvidence, slot: number): Prisma.OrderStepEvidenceUncheckedCreateInput {
  return {
    companyId: row.companyId,
    orderId: row.orderId,
    phase: TO_DB_PHASE[row.phase],
    stepPosition: row.stepPosition,
    slot,
    path: row.path,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    uploadedBy: row.uploadedBy,
  };
}

export function createStepEvidenceRepository(db: PrismaClient = prisma): StepEvidenceRepository {
  return {
    async listByOrder(companyId, orderId, phase) {
      const rows = await db.orderStepEvidence.findMany({
        where: { companyId, orderId, phase: TO_DB_PHASE[phase] },
        orderBy: [{ stepPosition: 'asc' }, { slot: 'asc' }],
        select: ROW_SELECT,
      });
      return rows.map(toRow);
    },

    async findById(companyId, orderId, phase, id) {
      const row = await db.orderStepEvidence.findFirst({
        where: { id, companyId, orderId, phase: TO_DB_PHASE[phase] },
        select: ROW_SELECT,
      });
      return row === null ? null : toRow(row);
    },

    async insert(row) {
      // Si otra peticion ocupa el slot elegido entre leer y escribir, se vuelve a mirar: puede
      // quedar otro libre.
      for (let attempt = 0; attempt < MAX_EVIDENCE_PER_STEP; attempt += 1) {
        const taken = await db.orderStepEvidence.findMany({
          where: {
            companyId: row.companyId,
            orderId: row.orderId,
            phase: TO_DB_PHASE[row.phase],
            stepPosition: row.stepPosition,
          },
          select: { slot: true },
        });
        const slot = firstFreeSlot(taken);
        if (slot === null) return 'limit';
        try {
          const created = await db.orderStepEvidence.create({ data: createData(row, slot), select: ROW_SELECT });
          return toRow(created);
        } catch (error) {
          if (uniqueViolationOn(error, 'path')) return 'path_taken';
          if (!uniqueViolationOn(error, 'slot')) throw error;
        }
      }
      return 'limit';
    },

    async replace(replacedId, row) {
      try {
        return await db.$transaction(async (tx) => {
          const previous = await tx.orderStepEvidence.findFirst({
            where: {
              id: replacedId,
              companyId: row.companyId,
              orderId: row.orderId,
              phase: TO_DB_PHASE[row.phase],
              stepPosition: row.stepPosition,
            },
            select: { id: true, slot: true },
          });
          if (previous === null) return 'not_found' as const;

          // Otra peticion pudo borrarla entre la lectura y aqui: entonces no hay nada que sustituir.
          const removed = await tx.orderStepEvidence.deleteMany({
            where: { id: previous.id, companyId: row.companyId },
          });
          if (removed.count === 0) return 'not_found' as const;

          const created = await tx.orderStepEvidence.create({
            data: createData(row, previous.slot),
            select: ROW_SELECT,
          });
          return toRow(created);
        });
      } catch (error) {
        // Fuera de la transaccion: el choque ya la deshizo y la vieja sigue en su sitio.
        if (uniqueViolationOn(error, 'path')) return 'path_taken';
        throw error;
      }
    },

    async delete(companyId, orderId, phase, id) {
      const row = await db.orderStepEvidence.findFirst({
        where: { id, companyId, orderId, phase: TO_DB_PHASE[phase] },
        select: ROW_SELECT,
      });
      if (row === null) return null;
      const removed = await db.orderStepEvidence.deleteMany({ where: { id: row.id, companyId } });
      return removed.count === 0 ? null : toRow(row);
    },

    async listOrderIdsWithEvidence(companyId, candidates) {
      const idsOf = (phase: EvidencePhase): string[] =>
        candidates.filter((candidate) => candidate.phase === phase).map((candidate) => candidate.orderId);
      const conditions = (['manufacturing', 'packing'] as const)
        .map((phase) => ({ phase: TO_DB_PHASE[phase], orderId: { in: idsOf(phase) } }))
        .filter((condition) => condition.orderId.in.length > 0);
      if (conditions.length === 0) return [];

      const rows = await db.orderStepEvidence.findMany({
        where: { companyId, OR: conditions },
        distinct: ['orderId'],
        select: { orderId: true },
      });
      return rows.map((row) => row.orderId);
    },

    async countByOrders(companyId, orderIds) {
      if (orderIds.length === 0) return new Map();
      const groups = await db.orderStepEvidence.groupBy({
        by: ['orderId'],
        where: { companyId, orderId: { in: [...orderIds] } },
        _count: { _all: true },
      });
      return new Map(groups.map((group) => [group.orderId, group._count._all]));
    },
  };
}
