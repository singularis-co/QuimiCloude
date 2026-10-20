import type { IntegracionesScope } from '../domain/integraciones-scope';
import type { LocalTemplateForSync, TemplateSyncPlan } from '../domain/template-sync-plan';
import type {
  TemplateWebhookUpdate,
  WhatsappTemplateCategory,
  WhatsappTemplateRecord,
} from '../domain/whatsapp-template';

/** Sin `companyId` ni conexión: la empresa la pone el adaptador desde `scope`. */
export type NewCreatedTemplateRow = {
  readonly metaTemplateId: string;
  readonly name: string;
  readonly language: string;
  readonly category: WhatsappTemplateCategory;
  readonly components: readonly unknown[];
  readonly status: 'PENDING';
  readonly createdById: string;
  readonly lastSyncedAt: Date;
};

/** Vivas y eliminadas: una eliminada que Meta vuelve a listar se revive, no se duplica. */
export type TemplateSyncRow = LocalTemplateForSync;

/**
 * Solo filas de la empresa de `scope`; una de otra empresa es igual que una inexistente. `scope` va
 * al final de cada firma: una llamada que lo omita no compila.
 */
export interface WhatsappTemplateRepository {
  listLive(
    connectionId: string,
    filter: { readonly onlyApproved: boolean },
    scope: IntegracionesScope,
  ): Promise<readonly WhatsappTemplateRecord[]>;
  findLiveById(id: string, scope: IntegracionesScope): Promise<WhatsappTemplateRecord | null>;
  findLiveByNameAndLanguage(
    connectionId: string,
    name: string,
    language: string,
    scope: IntegracionesScope,
  ): Promise<WhatsappTemplateRecord | null>;
  /**
   * Si la sincronización ya insertó ese `metaTemplateId`, se queda su fila y solo gana el creador.
   * Otra viva con el mismo nombre e idioma lanza `WhatsappTemplateNameTakenError`.
   */
  insertCreated(
    row: NewCreatedTemplateRow,
    connectionId: string,
    scope: IntegracionesScope,
  ): Promise<WhatsappTemplateRecord>;
  markDeleted(id: string, at: Date, scope: IntegracionesScope): Promise<boolean>;
  listForSync(connectionId: string, scope: IntegracionesScope): Promise<readonly TemplateSyncRow[]>;
  /** Todo o nada. No borra lo creado desde `startedAt`, y anota `at` en la conexión. */
  applySync(
    connectionId: string,
    plan: TemplateSyncPlan,
    startedAt: Date,
    at: Date,
    scope: IntegracionesScope,
  ): Promise<void>;
  /** `unknown`: cuántos cambios no encontraron una plantilla viva de la conexión. */
  applyWebhookUpdates(
    connectionId: string,
    updates: readonly TemplateWebhookUpdate[],
    scope: IntegracionesScope,
  ): Promise<{ readonly unknown: number }>;
}
