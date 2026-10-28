import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import {
  isAiProviderCode,
  type AiModelOption,
  type AiProviderCode,
  type AiProviderEntry,
} from '../../../domain/ai-provider';

const PROVIDER_SELECT = {
  code: true,
  name: true,
} satisfies Prisma.AiProviderSelect;

const MODEL_SELECT = {
  provider: true,
  modelId: true,
  isDefault: true,
} satisfies Prisma.AiModelSelect;

const MODEL_ORDER = [
  { provider: 'asc' },
  { sortOrder: 'asc' },
  { modelId: 'asc' },
] satisfies Prisma.AiModelOrderByWithRelationInput[];

type ProviderRow = Prisma.AiProviderGetPayload<{ select: typeof PROVIDER_SELECT }>;
type ModelRow = Prisma.AiModelGetPayload<{ select: typeof MODEL_SELECT }>;

/** Sin predeterminado no hay modelo en uso posible: el proveedor no sale, como un código desconocido. */
function toEntry(row: ProviderRow, modelRows: readonly ModelRow[]): AiProviderEntry | null {
  if (!isAiProviderCode(row.code)) return null;
  const models: AiModelOption[] = modelRows
    .filter((model) => model.provider === row.code)
    .map((model) => ({ modelId: model.modelId, isDefault: model.isDefault }));
  const defaultModel = models.find((model) => model.isDefault);
  if (defaultModel === undefined) return null;
  return { code: row.code, name: row.name, models, defaultModel: defaultModel.modelId };
}

/** Tabla global sin empresa: por eso vive fuera de `persistence/`, donde todo exige ámbito. */
export async function listAiProviders(): Promise<readonly AiProviderEntry[]> {
  const [rows, models] = await Promise.all([
    prisma.aiProvider.findMany({ orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }], select: PROVIDER_SELECT }),
    prisma.aiModel.findMany({ orderBy: MODEL_ORDER, select: MODEL_SELECT }),
  ]);
  return rows
    .map((row) => toEntry(row, models))
    .filter((entry): entry is AiProviderEntry => entry !== null);
}

export async function getAiProvider(code: AiProviderCode): Promise<AiProviderEntry | null> {
  const [row, models] = await Promise.all([
    prisma.aiProvider.findUnique({ where: { code }, select: PROVIDER_SELECT }),
    prisma.aiModel.findMany({ where: { provider: code }, orderBy: MODEL_ORDER, select: MODEL_SELECT }),
  ]);
  return row === null ? null : toEntry(row, models);
}
