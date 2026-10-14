import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import { isAiProviderCode, type AiProviderCode, type AiProviderEntry } from '../../../domain/ai-provider';

const ENTRY_SELECT = {
  code: true,
  name: true,
  recipeModel: true,
  catalogModel: true,
} satisfies Prisma.AiProviderSelect;

type EntryRow = Prisma.AiProviderGetPayload<{ select: typeof ENTRY_SELECT }>;

function toEntry(row: EntryRow): AiProviderEntry | null {
  if (!isAiProviderCode(row.code)) return null;
  return {
    code: row.code,
    name: row.name,
    recipeModel: row.recipeModel,
    catalogModel: row.catalogModel,
  };
}

/** Tabla global sin empresa: por eso vive fuera de `persistence/`, donde todo exige ámbito. */
export async function listAiProviders(): Promise<readonly AiProviderEntry[]> {
  const rows = await prisma.aiProvider.findMany({
    orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    select: ENTRY_SELECT,
  });
  return rows.map(toEntry).filter((entry): entry is AiProviderEntry => entry !== null);
}

export async function getAiProvider(code: AiProviderCode): Promise<AiProviderEntry | null> {
  const row = await prisma.aiProvider.findUnique({ where: { code }, select: ENTRY_SELECT });
  return row === null ? null : toEntry(row);
}
