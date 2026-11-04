import type { Prisma, PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import type { AiModelPair, AiModelPairChoice, AiModelRole } from '../../../domain/ai-model-pair';
import { isAiProviderCode, type AiProviderCode } from '../../../domain/ai-provider';
import type { AiModelPairRepository } from '../../../ports/ai-model-pair-repository';

type PrismaLike = PrismaClient | Prisma.TransactionClient;

const PAIR_SELECT = {
  provider: true,
  role: true,
  primaryModelId: true,
  fallbackModelId: true,
  updatedBy: true,
  updatedAt: true,
} satisfies Prisma.AiAgentModelPairSelect;

type PairRow = Prisma.AiAgentModelPairGetPayload<{ select: typeof PAIR_SELECT }>;

function toPair(row: PairRow): AiModelPair {
  if (!isAiProviderCode(row.provider)) {
    throw new Error(`integraciones: par de modelos con un proveedor desconocido ${String(row.provider)}`);
  }
  return {
    provider: row.provider,
    role: row.role,
    primaryModelId: row.primaryModelId,
    fallbackModelId: row.fallbackModelId,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
  };
}

/** Tabla de plataforma sin empresa: por eso vive fuera de `persistence/`, donde todo exige ámbito. */
export async function listAiModelPairs(db: PrismaLike): Promise<readonly AiModelPair[]> {
  const rows = await db.aiAgentModelPair.findMany({
    orderBy: [{ provider: 'asc' }, { role: 'asc' }],
    select: PAIR_SELECT,
  });
  return rows.map(toPair);
}

export async function getAiModelPair(
  db: PrismaLike,
  provider: AiProviderCode,
  role: AiModelRole,
): Promise<AiModelPair | null> {
  const row = await db.aiAgentModelPair.findUnique({ where: { provider_role: { provider, role } }, select: PAIR_SELECT });
  return row === null ? null : toPair(row);
}

/**
 * `where` y `create` con la misma clave: Prisma lo manda como un solo `INSERT ... ON CONFLICT DO
 * UPDATE`, así que dos guardados a la vez no chocan; gana el último. Las FK y el CHECK de la base
 * siguen cortando un modelo de otro proveedor o un par con los dos modelos iguales.
 */
export async function saveAiModelPair(db: PrismaLike, pair: AiModelPairChoice, actorId: string): Promise<AiModelPair> {
  const columns = {
    primaryModelId: pair.primaryModelId,
    fallbackModelId: pair.fallbackModelId,
    updatedBy: actorId,
    updatedAt: new Date(),
  };
  const row = await db.aiAgentModelPair.upsert({
    where: { provider_role: { provider: pair.provider, role: pair.role } },
    create: { provider: pair.provider, role: pair.role, ...columns },
    update: columns,
    select: PAIR_SELECT,
  });
  return toPair(row);
}

export function createAiModelPairPrisma(db: PrismaLike = prisma): AiModelPairRepository {
  return {
    list: () => listAiModelPairs(db),
    get: (provider, role) => getAiModelPair(db, provider, role),
    save: (pair, actorId) => saveAiModelPair(db, pair, actorId),
  };
}
