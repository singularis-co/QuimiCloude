import type { WhatsappTemplateRecord } from './whatsapp-template';
import { sameComponents } from './whatsapp-template-components';
import type { MetaTemplateSnapshot } from './whatsapp-template-meta';
import { componentsChanged, mappingStatusOf, type TemplateMappingStatus } from './whatsapp-template-variables';

export type LocalTemplateForSync = Pick<
  WhatsappTemplateRecord,
  | 'id'
  | 'metaTemplateId'
  | 'name'
  | 'language'
  | 'category'
  | 'status'
  | 'statusRaw'
  | 'rejectedReason'
  | 'components'
  | 'deletedAt'
  | 'mappingStatus'
  | 'enabled'
>;

export type TemplateSyncInsert = {
  readonly template: MetaTemplateSnapshot;
  readonly mappingStatus: TemplateMappingStatus;
  readonly enabled: boolean;
};

/** Sin `resetVariables`, los dos campos `AfterReset` son los que la fila ya tenia. */
export type TemplateSyncUpdate = {
  readonly id: string;
  readonly template: MetaTemplateSnapshot;
  readonly changed: boolean;
  readonly resetVariables: boolean;
  readonly mappingStatusAfterReset: TemplateMappingStatus;
  readonly enabledAfterReset: boolean;
};

export type TemplateSyncPlan = {
  readonly inserts: readonly TemplateSyncInsert[];
  readonly updates: readonly TemplateSyncUpdate[];
  readonly deletes: readonly string[];
};

export type TemplateSyncPlanInput = {
  readonly locals: readonly LocalTemplateForSync[];
  readonly snapshots: readonly MetaTemplateSnapshot[];
  /** Ids de Meta que no se borran aunque no vengan en la lista. */
  readonly protectedIds: readonly string[];
};

function differs(local: LocalTemplateForSync, template: MetaTemplateSnapshot): boolean {
  return (
    local.deletedAt !== null ||
    local.name !== template.name ||
    local.language !== template.language ||
    local.category !== template.category ||
    local.status !== template.status ||
    local.statusRaw !== template.statusRaw ||
    local.rejectedReason !== template.rejectedReason ||
    !sameComponents(local.components, template.components)
  );
}

function uniqueByMetaId(snapshots: readonly MetaTemplateSnapshot[]): MetaTemplateSnapshot[] {
  const seen = new Map<string, MetaTemplateSnapshot>();
  for (const snapshot of snapshots) {
    if (!seen.has(snapshot.metaTemplateId)) seen.set(snapshot.metaTemplateId, snapshot);
  }
  return [...seen.values()];
}

/** Sin relaciones: solo queda relacionada si no tiene huecos, y solo entonces nace habilitada. */
function importedMapping(components: unknown): { mappingStatus: TemplateMappingStatus; enabled: boolean } {
  const mappingStatus = mappingStatusOf(components, []);
  return { mappingStatus, enabled: mappingStatus === 'MAPPED' };
}

function updateOf(local: LocalTemplateForSync, template: MetaTemplateSnapshot): TemplateSyncUpdate {
  const changed = differs(local, template);
  const revived = local.deletedAt !== null;
  const resetVariables = revived || componentsChanged(local.components, template.components);
  if (!resetVariables) {
    return { id: local.id, template, changed, resetVariables, mappingStatusAfterReset: local.mappingStatus, enabledAfterReset: local.enabled };
  }
  const imported = importedMapping(template.components);
  // Sin huecos se conserva la habilitacion: solo volver a «sin relacionar» deshabilita.
  const enabledAfterReset = revived ? imported.enabled : imported.mappingStatus === 'MAPPED' && local.enabled;
  return { id: local.id, template, changed, resetVariables, mappingStatusAfterReset: imported.mappingStatus, enabledAfterReset };
}

export function planTemplateSync({ locals, snapshots, protectedIds }: TemplateSyncPlanInput): TemplateSyncPlan {
  const localByMetaId = new Map(locals.map((local) => [local.metaTemplateId, local]));
  const inserts: TemplateSyncInsert[] = [];
  const updates: TemplateSyncUpdate[] = [];
  const unique = uniqueByMetaId(snapshots);
  for (const template of unique) {
    const local = localByMetaId.get(template.metaTemplateId);
    if (local === undefined) inserts.push({ template, ...importedMapping(template.components) });
    else updates.push(updateOf(local, template));
  }
  const kept = new Set([...unique.map((t) => t.metaTemplateId), ...protectedIds]);
  const deletes = locals
    .filter((local) => local.deletedAt === null && !kept.has(local.metaTemplateId))
    .map((local) => local.id);
  return { inserts, updates, deletes };
}

export function templateSyncCounts(plan: TemplateSyncPlan): { imported: number; updated: number; deleted: number } {
  return {
    imported: plan.inserts.length,
    updated: plan.updates.filter((update) => update.changed).length,
    deleted: plan.deletes.length,
  };
}
