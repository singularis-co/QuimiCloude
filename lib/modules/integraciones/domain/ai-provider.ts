import type { IntegracionesScope } from './integraciones-scope';
import type { SecretContext } from './secret-context';

export const AI_PROVIDER_CODES = ['ANTHROPIC', 'GOOGLE', 'OPENAI', 'OPENROUTER'] as const;
export type AiProviderCode = (typeof AI_PROVIDER_CODES)[number];

export const AI_PROVIDER_CONNECTION_STATUSES = ['ACTIVE', 'ERROR'] as const;
export type AiProviderConnectionStatus = (typeof AI_PROVIDER_CONNECTION_STATUSES)[number];

export type AiReadUse = 'recipe' | 'catalog';

export function isAiProviderCode(value: unknown): value is AiProviderCode {
  return typeof value === 'string' && (AI_PROVIDER_CODES as readonly string[]).includes(value);
}

/** Una fila del catálogo global de proveedores. */
export type AiProviderEntry = {
  readonly code: AiProviderCode;
  readonly name: string;
  readonly recipeModel: string;
  readonly catalogModel: string;
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
};

/** Lo único que sale hacia la UI: sin la key ni su valor cifrado. */
export type AiProviderConnectionView = {
  readonly provider: AiProviderCode;
  readonly providerName: string;
  readonly recipeModel: string;
  readonly catalogModel: string;
  readonly status: AiProviderConnectionStatus;
  readonly lastError: string | null;
  readonly lastErrorAt: string | null;
  readonly lastCheckedAt: string | null;
  readonly keyUpdatedAt: string;
};

function isoOrNull(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

/** Campo a campo y sin spread: un campo nuevo de la fila no llega a la vista sin escribirlo aquí. */
export function toAiProviderConnectionView(
  record: AiProviderConnectionRecord,
  entry: AiProviderEntry,
): AiProviderConnectionView {
  return {
    provider: record.provider,
    providerName: entry.name,
    recipeModel: entry.recipeModel,
    catalogModel: entry.catalogModel,
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
