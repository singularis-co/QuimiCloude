import type { WhatsappTemplateRecord } from './whatsapp-template';
import type { MetaTemplateSnapshot } from './whatsapp-template-meta';

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
>;

export type TemplateSyncPlan = {
  readonly inserts: readonly MetaTemplateSnapshot[];
  readonly updates: readonly { readonly id: string; readonly template: MetaTemplateSnapshot; readonly changed: boolean }[];
  readonly deletes: readonly string[];
};

export type TemplateSyncPlanInput = {
  readonly locals: readonly LocalTemplateForSync[];
  readonly snapshots: readonly MetaTemplateSnapshot[];
  /** Ids de Meta que no se borran aunque no vengan en la lista. */
  readonly protectedIds: readonly string[];
};

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

// Meta puede devolver las mismas claves en otro orden.
export function sameComponents(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

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

export function planTemplateSync({ locals, snapshots, protectedIds }: TemplateSyncPlanInput): TemplateSyncPlan {
  const localByMetaId = new Map(locals.map((local) => [local.metaTemplateId, local]));
  const inserts: MetaTemplateSnapshot[] = [];
  const updates: { id: string; template: MetaTemplateSnapshot; changed: boolean }[] = [];
  const unique = uniqueByMetaId(snapshots);
  for (const template of unique) {
    const local = localByMetaId.get(template.metaTemplateId);
    if (local === undefined) inserts.push(template);
    else updates.push({ id: local.id, template, changed: differs(local, template) });
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
