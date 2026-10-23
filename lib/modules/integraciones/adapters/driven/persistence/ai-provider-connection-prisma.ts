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
  model: true,
  unavailableModel: true,
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
    model: row.model,
    unavailableModel: row.unavailableModel,
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

const MODEL_FOREIGN_KEY = 'ai_provider_connections_model_fkey';

/** Se lee de `meta`, nunca del mensaje: su idioma depende del servidor. */
function constraintOf(error: Prisma.PrismaClientKnownRequestError): string {
  const meta: unknown = error.meta;
  if (typeof meta !== 'object' || meta === null) return '';
  for (const key of ['constraint', 'field_name'] as const) {
    const value: unknown = (meta as Record<string, unknown>)[key];
    if (typeof value === 'string') return value;
  }
  return '';
}

function isModelForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2003' &&
    constraintOf(error).includes(MODEL_FOREIGN_KEY)
  );
}

class AiModelOutsideCatalogError extends Error {
  constructor(cause: unknown) {
    super('integraciones: el modelo de la conexión no está en el catálogo de su proveedor', { cause });
    this.name = 'AiModelOutsideCatalogError';
  }
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
        model: row.model ?? null,
        unavailableModel: row.unavailableModel ?? null,
        createdById: row.createdById,
        updatedById: row.updatedById,
      },
      select: CONNECTION_SELECT,
    });
    return toRecord(created);
  } catch (error) {
    if (isCompanyRace(error)) throw new AiProviderConnectionRaceError();
    if (isModelForeignKeyViolation(error)) throw new AiModelOutsideCatalogError(error);
    throw error;
  }
}

/** `null` si la fila no existe o es de otra empresa: el `where` lo decide, no un `if`. */
export async function updateAiProviderConnection(
  id: string,
  patch: AiProviderConnectionPatch,
  scope: IntegracionesScope,
): Promise<AiProviderConnectionRecord | null> {
  let count: number;
  try {
    ({ count } = await prisma.aiProviderConnection.updateMany({
      where: { id, ...companyScopeColumns(scope) },
      data: {
        provider: patch.provider,
        apiKeyEnc: patch.apiKeyEnc,
        status: patch.status,
        lastError: patch.lastError,
        lastErrorAt: patch.lastErrorAt,
        lastCheckedAt: patch.lastCheckedAt,
        keyUpdatedAt: patch.keyUpdatedAt,
        model: patch.model,
        unavailableModel: patch.unavailableModel,
        updatedById: patch.updatedById,
      },
    }));
  } catch (error) {
    if (isModelForeignKeyViolation(error)) throw new AiModelOutsideCatalogError(error);
    throw error;
  }
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
