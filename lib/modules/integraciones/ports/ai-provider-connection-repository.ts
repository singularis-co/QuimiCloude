import type {
  AiProviderCode,
  AiProviderConnectionRecord,
  AiProviderConnectionStatus,
} from '../domain/ai-provider';
import type { IntegracionesScope } from '../domain/integraciones-scope';

/** Sin `companyId`: la empresa la pone el adaptador desde `scope`, nunca desde la fila. */
export type NewAiProviderConnectionRow = {
  readonly id: string;
  readonly provider: AiProviderCode;
  readonly apiKeyEnc: string;
  readonly status: AiProviderConnectionStatus;
  readonly lastError: string | null;
  readonly lastErrorAt: Date | null;
  readonly lastCheckedAt: Date | null;
  readonly keyUpdatedAt: Date;
  readonly createdById: string;
  readonly updatedById: string;
};

/** Solo lo que una operación puede cambiar; un campo ausente se conserva. */
export type AiProviderConnectionPatch = {
  readonly provider?: AiProviderCode;
  readonly apiKeyEnc?: string;
  readonly status?: AiProviderConnectionStatus;
  readonly lastError?: string | null;
  readonly lastErrorAt?: Date | null;
  readonly lastCheckedAt?: Date | null;
  readonly keyUpdatedAt?: Date;
  readonly updatedById?: string;
};

/** Interno del módulo: el caso de uso de guardar lo resuelve y no sale por el contrato. */
export class AiProviderConnectionRaceError extends Error {
  constructor() {
    super('integraciones: otro guardado creó la conexión de la empresa a la vez');
    this.name = 'AiProviderConnectionRaceError';
  }
}

/**
 * Solo la fila de la empresa de `scope`. `null` es igual para «no existe» y «de otra empresa».
 * `scope` va al final de cada firma: una llamada que lo omita no compila. Si `create` choca con la
 * conexión que otro guardado acaba de crear en la misma empresa, lanza `AiProviderConnectionRaceError`.
 */
export interface AiProviderConnectionRepository {
  find(scope: IntegracionesScope): Promise<AiProviderConnectionRecord | null>;
  create(row: NewAiProviderConnectionRow, scope: IntegracionesScope): Promise<AiProviderConnectionRecord>;
  update(
    id: string,
    patch: AiProviderConnectionPatch,
    scope: IntegracionesScope,
  ): Promise<AiProviderConnectionRecord | null>;
  delete(scope: IntegracionesScope): Promise<void>;
}
