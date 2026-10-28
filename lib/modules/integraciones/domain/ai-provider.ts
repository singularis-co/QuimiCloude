import type { IntegracionesScope } from './integraciones-scope';
import type { SecretContext } from './secret-context';

export const AI_PROVIDER_CODES = ['ANTHROPIC', 'GOOGLE', 'OPENAI', 'OPENROUTER'] as const;
export type AiProviderCode = (typeof AI_PROVIDER_CODES)[number];

export const AI_PROVIDER_CONNECTION_STATUSES = ['ACTIVE', 'ERROR'] as const;
export type AiProviderConnectionStatus = (typeof AI_PROVIDER_CONNECTION_STATUSES)[number];

export function isAiProviderCode(value: unknown): value is AiProviderCode {
  return typeof value === 'string' && (AI_PROVIDER_CODES as readonly string[]).includes(value);
}

export type AiModelOption = {
  readonly modelId: string;
  readonly isDefault: boolean;
};

/** Una fila del catálogo global de proveedores, con sus modelos en orden. */
export type AiProviderEntry = {
  readonly code: AiProviderCode;
  readonly name: string;
  readonly models: readonly AiModelOption[];
  readonly defaultModel: string;
};

/** Lleva el valor cifrado: nunca sale del módulo. */
export type AiProviderConnectionRecord = {
  readonly id: string;
  readonly companyId: string;
  readonly provider: AiProviderCode;
  readonly apiKeyEnc: string;
  readonly status: AiProviderConnectionStatus;
  readonly lastError: string | null;
  readonly lastErrorAt: Date | null;
  readonly lastCheckedAt: Date | null;
  readonly keyUpdatedAt: Date;
  /** Null: sin elección, se usa el predeterminado del catálogo. */
  readonly model: string | null;
  /** El modelo que el proveedor dijo no ofrecer; sin FK, puede ser el predeterminado. */
  readonly unavailableModel: string | null;
};

/** Lo único que sale hacia la UI: sin la key ni su valor cifrado. */
export type AiProviderConnectionView = {
  readonly provider: AiProviderCode;
  readonly providerName: string;
  readonly modelInUse: string;
  readonly modelIsDefault: boolean;
  readonly modelUnavailable: boolean;
  readonly modelOptions: readonly AiModelOption[];
  readonly status: AiProviderConnectionStatus;
  readonly lastError: string | null;
  readonly lastErrorAt: string | null;
  readonly lastCheckedAt: string | null;
  readonly keyUpdatedAt: string;
};

function isoOrNull(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

/** El predeterminado se lee del catálogo en cada uso: cambiarlo alcanza a quien no eligió. */
export function modelInUse(
  record: Pick<AiProviderConnectionRecord, 'model'>,
  entry: AiProviderEntry,
): string {
  if (record.model === null) return entry.defaultModel;
  if (!entry.models.some((option) => option.modelId === record.model)) {
    throw new Error(`integraciones: el catálogo de ${entry.code} no trae el modelo elegido ${record.model}`);
  }
  return record.model;
}

/** Campo a campo y sin spread: un campo nuevo de la fila no llega a la vista sin escribirlo aquí. */
export function toAiProviderConnectionView(
  record: AiProviderConnectionRecord,
  entry: AiProviderEntry,
): AiProviderConnectionView {
  const inUse = modelInUse(record, entry);
  return {
    provider: record.provider,
    providerName: entry.name,
    modelInUse: inUse,
    modelIsDefault: record.model === null,
    modelUnavailable: record.unavailableModel === inUse,
    modelOptions: entry.models
      .filter((option) => option.modelId !== record.unavailableModel)
      .map((option) => ({ modelId: option.modelId, isDefault: option.isDefault })),
    status: record.status,
    lastError: record.lastError,
    lastErrorAt: isoOrNull(record.lastErrorAt),
    lastCheckedAt: isoOrNull(record.lastCheckedAt),
    keyUpdatedAt: record.keyUpdatedAt.toISOString(),
  };
}

export const AI_PROVIDER_API_KEY_FIELD = 'api_key';

/** Liga la key cifrada a su empresa y a su fila: con otro id no se descifra. */
export function aiProviderKeyContext(connectionId: string, scope: IntegracionesScope): SecretContext {
  return { companyId: scope.companyId, recordId: connectionId, field: AI_PROVIDER_API_KEY_FIELD };
}
