import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/shared/db/prisma';

import { AiProviderConnectionRaceError } from '../../../ports/ai-provider-connection-repository';

import { companyScopeColumns } from './company-scope';

import type { AiProviderConnectionRecord } from '../../../domain/ai-provider';
import type { IntegracionesScope } from '../../../domain/integraciones-scope';
import type {
  AiProviderConnectionPatch,
  NewAiProviderConnectionRow,
} from '../../../ports/ai-provider-connection-repository';

/** Exactamente los campos de `AiProviderConnectionRecord`: la auditoría no sale. */
const CONNECTION_SELECT = {
  id: true,
  companyId: true,
  provider: true,
  apiKeyEnc: true,
  status: true,
  lastError: true,
  lastErrorAt: true,
  lastCheckedAt: true,
  keyUpdatedAt: true,
} satisfies Prisma.AiProviderConnectionSelect;

type ConnectionRow = Prisma.AiProviderConnectionGetPayload<{ select: typeof CONNECTION_SELECT }>;

function toRecord(row: ConnectionRow): AiProviderConnectionRecord {
  return {
    id: row.id,
    companyId: row.companyId,
    provider: row.provider,
    apiKeyEnc: row.apiKeyEnc,
    status: row.status,
    lastError: row.lastError,
    lastErrorAt: row.lastErrorAt,
    lastCheckedAt: row.lastCheckedAt,
    keyUpdatedAt: row.keyUpdatedAt,
  };
}

/** `meta.target` trae el nombre del índice o sus columnas, según el índice. */
const COMPANY_INDEX = 'ai_provider_connections_company_id_key';
const COMPANY_COLUMNS: readonly string[] = ['company_id', 'companyId'];

function targetsOf(error: Prisma.PrismaClientKnownRequestError): readonly string[] {
  const target = error.meta?.target;
  if (typeof target === 'string') return [target];
  if (Array.isArray(target)) return target.filter((item): item is string => typeof item === 'string');
  return [];
}

/** Otra violación de unicidad, como la clave primaria, no es la carrera y se propaga tal cual. */
function isCompanyRace(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const targets = targetsOf(error);
  if (targets.some((target) => target.includes(COMPANY_INDEX))) return true;
  return targets.length === 1 && COMPANY_COLUMNS.includes(targets[0] ?? '');
}

export async function findAiProviderConnection(
  scope: IntegracionesScope,
): Promise<AiProviderConnectionRecord | null> {
  const row = await prisma.aiProviderConnection.findFirst({
    where: companyScopeColumns(scope),
    select: CONNECTION_SELECT,
  });
  return row === null ? null : toRecord(row);
}

export async function insertAiProviderConnection(
  row: NewAiProviderConnectionRow,
  scope: IntegracionesScope,
): Promise<AiProviderConnectionRecord> {
  try {
    const created = await prisma.aiProviderConnection.create({
      data: {
        ...companyScopeColumns(scope),
        id: row.id,
        provider: row.provider,
        apiKeyEnc: row.apiKeyEnc,
        status: row.status,
        lastError: row.lastError,
        lastErrorAt: row.lastErrorAt,
        lastCheckedAt: row.lastCheckedAt,
        keyUpdatedAt: row.keyUpdatedAt,
        createdById: row.createdById,
        updatedById: row.updatedById,
      },
      select: CONNECTION_SELECT,
    });
    return toRecord(created);
  } catch (error) {
    if (isCompanyRace(error)) throw new AiProviderConnectionRaceError();
    throw error;
  }
}

/** `null` si la fila no existe o es de otra empresa: el `where` lo decide, no un `if`. */
export async function updateAiProviderConnection(
  id: string,
  patch: AiProviderConnectionPatch,
  scope: IntegracionesScope,
): Promise<AiProviderConnectionRecord | null> {
  const { count } = await prisma.aiProviderConnection.updateMany({
    where: { id, ...companyScopeColumns(scope) },
    data: {
      provider: patch.provider,
      apiKeyEnc: patch.apiKeyEnc,
      status: patch.status,
      lastError: patch.lastError,
      lastErrorAt: patch.lastErrorAt,
      lastCheckedAt: patch.lastCheckedAt,
      keyUpdatedAt: patch.keyUpdatedAt,
      updatedById: patch.updatedById,
    },
  });
  if (count === 0) return null;
  const row = await prisma.aiProviderConnection.findFirst({
    where: { id, ...companyScopeColumns(scope) },
    select: CONNECTION_SELECT,
  });
  return row === null ? null : toRecord(row);
}

export async function deleteAiProviderConnection(scope: IntegracionesScope): Promise<void> {
  await prisma.aiProviderConnection.deleteMany({ where: companyScopeColumns(scope) });
}
