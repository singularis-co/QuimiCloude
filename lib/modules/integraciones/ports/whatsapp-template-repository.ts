import type { IntegracionesScope } from '../domain/integraciones-scope';
import type { LocalTemplateForSync, TemplateSyncPlan } from '../domain/template-sync-plan';
import type {
  TemplateWebhookUpdate,
  WhatsappTemplateCategory,
  WhatsappTemplateRecord,
} from '../domain/whatsapp-template';
import type { TemplateMappingStatus, TemplateVariableBinding } from '../domain/whatsapp-template-variables';

/** Se escriben siempre juntos: una plantilla sin relacionar no puede quedar habilitada. */
export type TemplateMappingWrite = { readonly mappingStatus: TemplateMappingStatus; readonly enabled: boolean };

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
  readonly variables: readonly TemplateVariableBinding[];
} & TemplateMappingWrite;

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
   * Si la sincronización ya insertó ese `metaTemplateId`, se queda su fila y solo gana el creador
   * (`inserted: false`, sin escribir relaciones). Otra viva con el mismo nombre e idioma lanza
   * `WhatsappTemplateNameTakenError`.
   */
  insertCreated(
    row: NewCreatedTemplateRow,
    connectionId: string,
    scope: IntegracionesScope,
  ): Promise<{ readonly record: WhatsappTemplateRecord; readonly inserted: boolean }>;
  /**
   * Sustituye todas las relaciones. `false`, sin escribir, si la plantilla ya no está viva o sus
   * componentes ya no son `expectedComponents`.
   */
  replaceVariables(
    id: string,
    bindings: readonly TemplateVariableBinding[],
    mapping: TemplateMappingWrite,
    expectedComponents: unknown,
    scope: IntegracionesScope,
  ): Promise<boolean>;
  /** Misma condición que `replaceVariables`. */
  setEnabled(id: string, enabled: boolean, expectedComponents: unknown, scope: IntegracionesScope): Promise<boolean>;
  /** También quita sus relaciones y la deshabilita. */
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
